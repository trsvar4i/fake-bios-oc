// Готовые задания учителя: каждое честно ломает компьютер, а эталонное решение чинит — по той же модели,
// которой пользуется сервер при проверке.
import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";
import { cleanCfg, configSolves, goalDone, goalTitle, goalValid, parseGoal } from "./goals";

describe("библиотека заданий", () => {
  it("30 заданий: по 10 каждого уровня, id уникальны, тексты на двух языках", () => {
    expect(LIBRARY).toHaveLength(30);
    for (const level of [1, 2, 3]) expect(LIBRARY.filter((x) => x.level === level)).toHaveLength(10);
    expect(new Set(LIBRARY.map((x) => x.id)).size).toBe(30);
    for (const x of LIBRARY) for (const s of [x.title, x.descr, x.answer]) { expect(s.ru.length, x.id).toBeGreaterThan(3); expect(s.en.length, x.id).toBeGreaterThan(3); }
  });

  for (const x of LIBRARY) {
    it(`${x.id}: поломка мешает цели, эталонное решение её достигает`, () => {
      expect(goalValid(x.goal)).toBe(true);
      // настройки задания проходят ту же проверку, что ссылки и сервер
      expect(cleanCfg(x.cfg)).toEqual(x.cfg);
      expect(configSolves(x.goal, x.cfg)).toBe(false);
      expect(configSolves(x.goal, { ...x.cfg, ...x.fix })).toBe(true);
    });
  }
});

describe("цели", () => {
  it("составные цели и старые короткие имена", () => {
    expect(parseGoal("online")).toEqual({ base: "boot", conds: ["lan"] });
    expect(parseGoal("boot+lan+lan")).toBeNull();
    expect(parseGoal("fly")).toBeNull();
    expect(parseGoal("boot+hack")).toBeNull();
    expect(goalTitle("boot+secure+lan", "ru")).toBe("Загрузиться до рабочего стола; Secure Boot включён; сеть работает");
  });
  it("в симуляторе нужна и правильная настройка, и событие", () => {
    expect(goalDone("boot+lan", { lanController: true }, "boot")).toBe(true);
    expect(goalDone("boot+lan", { lanController: true }, "vm")).toBe(false);
    expect(goalDone("boot+lan", { lanController: false }, "boot")).toBe(false);
    // дошёл до рабочего стола через F11, а порядок загрузки сломан — не засчитывается
    expect(goalDone("boot", { bootOrder: ["USB", "DVD", "HDD", "PXE", "OS"] }, "boot")).toBe(false);
  });
});
