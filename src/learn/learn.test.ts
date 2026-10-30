// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../machine/store";
import { emitEvent } from "../machine/events";
import { LESSONS } from "./lessons";
import { FAULTS, GOALS, completionCode, parseTask, taskLink, verifyCode, type Task } from "./tasks";
import { attachLearning, leave, startLesson, useLearn } from "./store";

const task: Task = { t: "Диск пропал", d: "Почините", g: "boot", c: { sataMode: "RAID" }, n: "abc123" };

describe("коды выполнения", () => {
  it("один и тот же для задания и имени, имя без учёта регистра, пробелов и ё", () => {
    const code = completionCode(task, "Пётр Иванов");
    expect(code).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/);
    expect(verifyCode(task, "  пётр   иванов ", code)).toBe(true);
    expect(verifyCode(task, "Петр Иванов", code.replace("-", "").toLowerCase())).toBe(true);
  });
  it("разный для другого ученика и другого задания", () => {
    const code = completionCode(task, "Анна");
    expect(verifyCode(task, "Мария", code)).toBe(false);
    expect(verifyCode({ ...task, n: "zzz999" }, "Анна", code)).toBe(false);
  });
});

describe("ссылка на задание", () => {
  it("кодируется и разбирается обратно", () => {
    const back = parseTask(taskLink(task));
    expect(back).toEqual(task);
  });
  it("мусор и чужие параметры отбрасываются", () => {
    const evil = taskLink({ ...task, c: { sataMode: "RAID", setupPassword: "x", nonsense: 1, cpuRatio: 999 } as never });
    expect(parseTask(evil)!.c).toEqual({ sataMode: "RAID" });
    expect(parseTask("#task=%%%")).toBeNull();
    expect(parseTask(taskLink({ ...task, g: "fly" }))).toBeNull();
  });
  it("все готовые поломки проходят проверку и имеют цель", () => {
    for (const f of FAULTS) {
      expect(GOALS[f.goal]).toBeTruthy();
      expect(parseTask(taskLink({ t: "x", d: "", g: f.goal, c: f.cfg, n: "n" }))!.c).toEqual(f.cfg);
    }
  });
});

describe("уроки", () => {
  beforeEach(() => {
    useLearn.setState({ lesson: null, step: 0, task: null, code: null, finished: null, backup: null, done: {} });
    useStore.setState({ phase: "off" });
  });

  it("у каждого урока есть шаги и тексты на двух языках", () => {
    const ids = new Set(LESSONS.map((x) => x.id));
    expect(ids.size).toBe(LESSONS.length);
    for (const lesson of LESSONS) {
      expect(lesson.steps.length).toBeGreaterThan(1);
      for (const s of [lesson.title, lesson.summary, ...lesson.steps.map((x) => x.text), ...lesson.takeaways]) {
        expect(s.en.length).toBeGreaterThan(3);
        expect(s.ru.length).toBeGreaterThan(3);
      }
    }
  });

  it("«Компьютер не загружается»: настройка урока, шаги по событиям и состоянию, итог", () => {
    const off = attachLearning();
    const before = useStore.getState().saved.sataMode;
    startLesson("no-boot");
    expect(useStore.getState().saved.sataMode).toBe("RAID");
    expect(useLearn.getState().step).toBe(0);

    emitEvent("raid");
    expect(useLearn.getState().step).toBe(1);
    emitEvent("boot"); // не тот шаг — ничего не происходит
    expect(useLearn.getState().step).toBe(1);

    useStore.setState({ saved: { ...useStore.getState().saved, sataMode: "AHCI" }, phase: "post" });
    expect(useLearn.getState().step).toBe(2);

    emitEvent("boot");
    expect(useLearn.getState().finished).toBe("no-boot");
    expect(useLearn.getState().done["no-boot"]).toBeTruthy();

    leave(true);
    expect(useStore.getState().saved.sataMode).toBe(before);
    off();
  });

  it("задание: код появляется только при достижении цели", () => {
    const off = attachLearning();
    useLearn.setState({ task: { ...task, g: "online" }, student: "Анна", code: null });
    useStore.setState({ saved: { ...useStore.getState().saved, lanController: false } });
    emitEvent("boot");
    expect(useLearn.getState().code).toBeNull();
    useStore.setState({ saved: { ...useStore.getState().saved, lanController: true } });
    emitEvent("boot");
    expect(useLearn.getState().code).toBe(completionCode({ ...task, g: "online" }, "Анна"));
    off();
  });
});
