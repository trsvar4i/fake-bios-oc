// @vitest-environment jsdom
// Тесты интерфейса: настоящие компоненты в jsdom, ввод с клавиатуры и щелчки — как у пользователя.
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useFs } from "./fs";
import { isAvailable, useOs } from "./osStore";
import { useStore } from "../machine/store";
import { Calculator } from "./apps/Calculator";
import { Terminal } from "./apps/Terminal";
import { AppStore } from "./apps/AppStore";
import { ensureNotes } from "./apps/Notes";

const initialFs = useFs.getState().nodes;
const initialPrefs = useOs.getState().prefs;
beforeEach(() => {
  useFs.setState({ nodes: { ...initialFs } });
  useOs.setState({ prefs: { ...initialPrefs, installed: [] }, windows: [], notices: [] });
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

describe("Калькулятор", () => {
  it("считает с клавиатуры", () => {
    const { container } = render(<Calculator />);
    const calc = container.querySelector(".calc")!;
    for (const key of ["1", "2", "+", "7", "*", "2", "Enter"]) fireEvent.keyDown(calc, { key });
    expect(container.querySelector(".calc-display")!.textContent).toBe("38");
  });
});

describe("Терминал", () => {
  const run = (cmd: string) => {
    const input = document.querySelector(".term-input input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: cmd } });
    fireEvent.keyDown(input, { key: "Enter" });
  };

  it("создаёт и удаляет файлы в общей файловой системе — ровно один раз даже в StrictMode", () => {
    render(<StrictMode><Terminal winId={1} /></StrictMode>);
    run("mkdir Desktop/box");
    run("touch Desktop/box/a.txt");
    run("mv Desktop/box/a.txt Documents/b.txt");
    expect(useFs.getState().exists("~/Documents/b.txt")).toBe(true);
    run("rm Documents/b.txt");
    expect(useFs.getState().exists("~/Documents/b.txt")).toBe(false);
    // прежняя ошибка: команда выполнялась дважды и писала ложное «No such file»
    expect(document.querySelector(".terminal")!.textContent).not.toMatch(/No such file/);
  });

  it("неизвестная команда — как в zsh", () => {
    render(<Terminal winId={1} />);
    run("foo");
    expect(screen.getByText("zsh: command not found: foo")).toBeTruthy();
  });
});

describe("Магазин", () => {
  it("ставит программу одной кнопкой, и она становится доступна", () => {
    vi.useFakeTimers();
    useStore.setState({ saved: { ...useStore.getState().saved, lanController: true } });
    render(<AppStore />);
    expect(isAvailable("paint")).toBe(false);
    fireEvent.click(screen.getAllByText("Get")[0]);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(useOs.getState().prefs.installed.length).toBe(1);
    expect(useOs.getState().notices.length).toBe(1);
    vi.useRealTimers();
  });

  it("без сетевой карты в BIOS загружать нельзя", () => {
    useStore.setState({ saved: { ...useStore.getState().saved, lanController: false } });
    render(<AppStore />);
    for (const b of screen.getAllByText("Get")) expect((b as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Заметки", () => {
  it("старая заметка из настроек переезжает файлом в ~/Notes — один раз", () => {
    useOs.getState().setPref("notes", "купить молоко");
    ensureNotes(false);
    ensureNotes(false);
    expect(useFs.getState().read("~/Notes/Note.txt")).toBe("купить молоко");
    expect(useFs.getState().list("~/Notes").length).toBe(1);
    expect(useOs.getState().prefs.notes).toBe("");
  });
});
