// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../machine/store";
import { emitEvent } from "../machine/events";
import { LESSONS } from "./lessons";
import { FAULTS, GOALS, completionCode, parseTask, taskLink, verifyCode, type Task } from "./tasks";
import { attachLearning, drillGiveUp, drillHint, drillNext, leave, startDrill, startLesson, useLearn } from "./store";
import { DRILL, SHIFT, drillFault, drillPoints, drillSolved, newShift } from "./drill";
import { defaults, type Config } from "../machine/params";
import { bootScript, deviceAvailable } from "../machine/boot";

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

/** Компьютер с заводскими настройками и правками. */
const pc = (c: Config) => ({ ...defaults(), ...c }) as Config;
/** Дошёл бы до рабочего стола без сбоя? */
const boots = (c: Config) => { const f = bootScript(c).final; return f.type === "os" && !f.unstable; };
const ctxOf = (saved: Config) => ({ phase: "os" as const, mode: "ez" as const, advTab: 0, saved, pending: saved, apps: [] });

describe("случайные поломки", () => {
  it("каждая поломка действительно ломает компьютер", () => {
    for (const f of DRILL) {
      const c = pc(f.cfg);
      const broken = f.goal === "boot" ? !boots(c)
        : f.goal === "online" ? !c.lanController
        : f.goal === "sound" ? !c.hdAudio
        : f.goal === "safeboot" ? bootScript(c).final.type === "error"
        : f.goal === "linux" ? !deviceAvailable(c, "USB")
        : f.goal === "vm" ? !c.virtualization : false;
      expect(broken, f.id).toBe(true);
      expect(f.name.ru.length * f.symptom.ru.length * f.cause.ru.length * f.hints[1].ru.length, f.id).toBeGreaterThan(0);
    }
  });

  it("починка по подсказке работает и соблюдает условие клиента", () => {
    const fixes: Record<string, Config> = {
      raid: { sataMode: "AHCI" }, oc: { cpuVcore: 0 }, memory: { dramVoltage: 0 }, hot: { cpuRatio: 50 }, bclk: { bclk: 0 },
      "raid-lan": { sataMode: "AHCI", lanController: true }, "oc-mute": { cpuVcore: 0, hdAudio: true },
      offline: { lanController: true }, mute: { hdAudio: true }, secure: { bootOrder: defaults().bootOrder },
    };
    for (const [id, fix] of Object.entries(fixes)) {
      const f = drillFault(id)!;
      const c = pc({ ...f.cfg, ...fix });
      expect(boots(c), id).toBe(true);
      expect(drillSolved(f, ctxOf(c), "boot"), id).toBe(true);
    }
    // сброс разгона «в ноль» не засчитывается, если клиент просил оставить 5 ГГц
    expect(drillSolved(drillFault("oc")!, ctxOf(pc({})), "boot")).toBe(false);
    expect(drillSolved(drillFault("memory")!, ctxOf(pc({})), "boot")).toBe(false);
    expect(drillSolved(drillFault("secure")!, ctxOf(pc({ secureBoot: false })), "boot")).toBe(false);
  });

  it("смена: 5 разных поломок от простых к сложным", () => {
    const q = newShift();
    expect(q).toHaveLength(SHIFT);
    expect(new Set(q).size).toBe(SHIFT);
    const levels = q.map((id) => drillFault(id)!.level);
    expect(levels).toEqual([...levels].sort());
  });

  it("очки: сложность, скорость, подсказки", () => {
    const f = drillFault("oc")!;
    expect(drillPoints(f, 0, 0)).toBe(300);
    expect(drillPoints(f, 10 * 60_000, 0)).toBe(200);
    expect(drillPoints(f, 10 * 60_000, 2)).toBe(120);
    expect(drillPoints(drillFault("raid")!, 10 * 60_000, 2)).toBe(20);
  });

  it("ход смены: поломка, починка, сдача, итоги и рекорд", () => {
    const off = attachLearning();
    useLearn.setState({ drill: null, drillBest: 0, backup: null });
    useStore.setState({ phase: "off" });
    const before = useStore.getState().saved.sataMode;
    startDrill();
    for (let i = 0; i < SHIFT; i++) {
      const d = useLearn.getState().drill!;
      const f = drillFault(d.queue[d.i])!;
      // поломка применена к машине
      for (const [k, v] of Object.entries(f.cfg)) expect(useStore.getState().saved[k]).toEqual(v);
      if (i === 1) {
        drillHint();
        drillGiveUp();
        expect(useLearn.getState().drill!.solved).toMatchObject({ gaveUp: true, points: 0, hints: 1 });
      } else {
        emitEvent("nothing");
        expect(useLearn.getState().drill!.solved).toBeNull();
        // «чиним» напрямую: заводские настройки + то, что клиент просил сохранить
        const keep: Config = f.id === "oc" || f.id === "oc-mute" ? { cpuRatio: 50 } : f.id === "memory" ? { xmp: "Profile 2" } : {};
        useStore.setState({ saved: pc({ ...keep, virtualization: true }) });
        emitEvent(f.goal === "vm" ? "vm" : f.goal === "linux" ? "linux" : "boot");
        expect(useLearn.getState().drill!.solved, f.id).toMatchObject({ gaveUp: false });
      }
      drillNext();
    }
    const d = useLearn.getState().drill!;
    expect(d.over).toBe(true);
    expect(d.results).toHaveLength(SHIFT);
    expect(useLearn.getState().drillBest).toBe(d.results.reduce((a, r) => a + r.points, 0));
    leave(true);
    expect(useLearn.getState().drill).toBeNull();
    expect(useStore.getState().saved.sataMode).toBe(before);
    off();
  });
});
