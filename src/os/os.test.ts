import { beforeEach, describe, expect, it } from "vitest";
import { HOME, TRASH, resolvePath, useFs } from "./fs";
import { apply, show } from "./apps/Calculator";
import { SCREEN_W, overviewLayout, type Win } from "./osStore";

const initial = useFs.getState().nodes;
beforeEach(() => useFs.setState({ nodes: { ...initial } }));
const fs = () => useFs.getState();

describe("файловая система", () => {
  it("разбирает пути относительно папки", () => {
    expect(resolvePath("~/Documents", "..")).toBe(HOME);
    expect(resolvePath("~/Documents", "./a/../b")).toBe("~/Documents/b");
    expect(resolvePath("~/Desktop", "~/Downloads")).toBe("~/Downloads");
    expect(resolvePath(HOME, "../..")).toBe(HOME);
  });

  it("создаёт папки и файлы, подбирает свободное имя", () => {
    expect(fs().mkdir("~/Desktop/Work")).toBe(true);
    expect(fs().mkdir("~/Desktop/Work")).toBe(false);
    expect(fs().freeName("~/Desktop", "Work")).toBe("Work 2");
    expect(fs().write("~/Desktop/Work/a.txt", "hi")).toBe(true);
    expect(fs().write("~/Nope/a.txt", "x")).toBe(false);
    expect(fs().list("~/Desktop/Work")).toEqual(["a.txt"]);
  });

  it("сортирует: сначала папки, потом файлы", () => {
    fs().write("~/Desktop/b.txt", "");
    fs().mkdir("~/Desktop/z");
    fs().write("~/Desktop/a.txt", "");
    expect(fs().list("~/Desktop")).toEqual(["z", "a.txt", "b.txt"]);
  });

  it("переименовывает и переносит папку вместе с содержимым", () => {
    fs().mkdir("~/Desktop/P");
    fs().write("~/Desktop/P/n.txt", "x");
    expect(fs().rename("~/Desktop/P", "Q")).toBe("~/Desktop/Q");
    expect(fs().move("~/Desktop/Q", "~/Documents")).toBe("~/Documents/Q");
    expect(fs().read("~/Documents/Q/n.txt")).toBe("x");
    expect(fs().exists("~/Desktop/Q")).toBe(false);
  });

  it("не переносит папку саму в себя", () => {
    fs().mkdir("~/Desktop/A");
    fs().mkdir("~/Desktop/A/B");
    expect(fs().move("~/Desktop/A", "~/Desktop/A/B")).toBeNull();
    expect(fs().exists("~/Desktop/A/B")).toBe(true);
  });

  it("Корзина: удалить, вернуть на место, очистить", () => {
    fs().write("~/Desktop/x.txt", "1");
    fs().trash("~/Desktop/x.txt");
    expect(fs().list(TRASH)).toEqual(["x.txt"]);
    fs().putBack(`${TRASH}/x.txt`);
    expect(fs().read("~/Desktop/x.txt")).toBe("1");
    fs().trash("~/Desktop/x.txt");
    fs().emptyTrash();
    expect(fs().list(TRASH)).toEqual([]);
    expect(fs().exists(TRASH)).toBe(true);
  });
});

describe("калькулятор", () => {
  it("считает и форматирует", () => {
    expect(apply(12, 7, "+")).toBe(19);
    expect(apply(10, 4, "÷")).toBe(2.5);
    expect(show(0.1 + 0.2)).toBe("0.3");
    expect(show(-9)).toBe("−9");
    expect(show(apply(5, 0, "÷"))).toBe("Error");
    expect(show(123456789012)).toMatch(/e\+/);
  });
});

describe("«Все окна»", () => {
  const win = (id: number, w: number, h: number): Win => ({ id, app: "notes", x: 100, y: 100, w, h, z: id, min: false, max: false, snap: null });
  it("раскладывает окна без наложений в пределах экрана", () => {
    const ws = [win(1, 800, 600), win(2, 1200, 700), win(3, 340, 540), win(4, 900, 600), win(5, 600, 400)];
    const cells = Object.values(overviewLayout(ws));
    expect(cells).toHaveLength(5);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(SCREEN_W);
    }
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap).toBe(false);
    }
  });
});
