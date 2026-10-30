// Прогресс обучения: активный урок или задание преподавателя, текущий шаг, пройденные уроки,
// резервная копия настроек BIOS ученика. Шаги проверяются автоматически по событиям и состоянию.
import { create } from "zustand";
import { useStore } from "../machine/store";
import { defaults, type Config } from "../machine/params";
import { onEvent } from "../machine/events";
import { useOs } from "../os/osStore";
import { lessonOf, type Ctx } from "./lessons";
import { GOALS, completionCode, type Task } from "./tasks";
import { drillFault, drillPoints, drillSolved, newShift } from "./drill";

const KEY = "kestrel.lessons";

interface Saved {
  /** пройденные уроки: id → когда */
  done: Record<string, number>;
  lesson: string | null;
  step: number;
  /** задание преподавателя и имя ученика */
  task: Task | null;
  student: string;
  /** код выполнения задания (когда цель достигнута) */
  code: string | null;
  /** настройки BIOS до начала урока/задания — чтобы вернуть */
  backup: Config | null;
  /** тренировка «Случайные поломки» */
  drill: Drill | null;
  /** лучший результат смены */
  drillBest: number;
}

export interface DrillResult { id: string; ms: number; points: number; hints: number; gaveUp: boolean }

export interface Drill {
  /** поломки смены и номер текущей */
  queue: string[];
  i: number;
  /** когда началась текущая поломка */
  started: number;
  hints: number;
  results: DrillResult[];
  /** текущая поломка починена (или сдана) — показать разбор */
  solved: DrillResult | null;
  /** смена закончена — показать итоги */
  over: boolean;
}

interface LearnState extends Saved {
  /** урок только что пройден — показать итоги */
  finished: string | null;
  /** открыт список уроков поверх экрана (например, с экрана питания) */
  picker: boolean;
}

function load(): Saved {
  const empty: Saved = { done: {}, lesson: null, step: 0, task: null, student: "", code: null, backup: null, drill: null, drillBest: 0 };
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return empty; }
}

export const useLearn = create<LearnState>(() => ({ ...load(), finished: null, picker: false }));

useLearn.subscribe((s) => {
  const { done, lesson, step, task, student, code, backup, drill, drillBest } = s;
  try { localStorage.setItem(KEY, JSON.stringify({ done, lesson, step, task, student, code, backup, drill, drillBest })); } catch { /* хранилище недоступно */ }
});

/** Настроить машину под урок: заводские настройки + особенности урока; с ОС — перезагрузка. */
function prepareMachine(cfg: Config) {
  const m = useStore.getState();
  const backup = useLearn.getState().backup ?? structuredClone(m.saved);
  m.importConfig(cfg);
  useOs.getState().dismiss?.();
  if (m.phase === "os" || m.phase === "setup" || m.phase === "boot") m.restart();
  return backup;
}

/** Поломка тренировки: заводские настройки + неисправность, затем «включение» с нуля, чтобы был виден симптом. */
function breakMachine(cfg: Config) {
  const m = useStore.getState();
  const backup = useLearn.getState().backup ?? structuredClone(m.saved);
  m.importConfig(cfg);
  useOs.getState().dismiss?.();
  if (m.phase !== "off") useStore.setState({ phase: "off" });
  window.setTimeout(() => { if (useStore.getState().phase === "off") useStore.getState().powerOn(); }, 450);
  return backup;
}

export function startDrill() {
  const queue = newShift();
  const backup = breakMachine(drillFault(queue[0])!.cfg);
  useLearn.setState({ drill: { queue, i: 0, started: Date.now(), hints: 0, results: [], solved: null, over: false },
    lesson: null, step: 0, task: null, code: null, finished: null, picker: false, backup });
}

export function drillHint() {
  const d = useLearn.getState().drill;
  if (d && !d.solved && d.hints < 2) useLearn.setState({ drill: { ...d, hints: d.hints + 1 } });
}

export function drillGiveUp() {
  const d = useLearn.getState().drill;
  if (!d || d.solved) return;
  useLearn.setState({ drill: { ...d, solved: { id: d.queue[d.i], ms: Date.now() - d.started, points: 0, hints: d.hints, gaveUp: true } } });
}

/** Следующая поломка или итоги смены. */
export function drillNext() {
  const s = useLearn.getState();
  const d = s.drill;
  if (!d?.solved) return;
  const results = [...d.results, d.solved];
  if (d.i + 1 >= d.queue.length) {
    const total = results.reduce((a, r) => a + r.points, 0);
    useLearn.setState({ drill: { ...d, results, solved: null, over: true }, drillBest: Math.max(s.drillBest, total) });
    return;
  }
  breakMachine(drillFault(d.queue[d.i + 1])!.cfg);
  useLearn.setState({ drill: { ...d, results, i: d.i + 1, started: Date.now(), hints: 0, solved: null } });
}

export function startLesson(id: string) {
  const lesson = lessonOf(id);
  if (!lesson) return;
  const backup = prepareMachine(lesson.setup ?? {});
  useLearn.setState({ drill: null, lesson: id, step: 0, task: null, code: null, finished: null, picker: false, backup });
  check();
}

export function startTask(task: Task, student: string) {
  const backup = prepareMachine(task.c);
  useLearn.setState({ drill: null, task, student: student.trim(), code: null, lesson: null, step: 0, finished: null, picker: false, backup });
}

/** Закончить урок/задание. restore — вернуть настройки BIOS, которые были до него. */
export function leave(restore: boolean) {
  const { backup } = useLearn.getState();
  if (restore && backup) {
    const d = defaults();
    // importConfig принимает отличия от заводских — передаём всю старую конфигурацию
    useStore.getState().importConfig(Object.fromEntries(Object.keys(d).map((k) => [k, backup[k] ?? d[k]])));
  }
  useLearn.setState({ lesson: null, step: 0, task: null, code: null, finished: null, drill: null, backup: restore ? null : useLearn.getState().backup });
}

export function skipStep() {
  const s = useLearn.getState();
  const lesson = lessonOf(s.lesson);
  if (!lesson) return;
  advance(lesson.steps.length);
}

function advance(total: number) {
  const s = useLearn.getState();
  const next = s.step + 1;
  if (next >= total) {
    useLearn.setState({ done: { ...s.done, [s.lesson!]: Date.now() }, finished: s.lesson, lesson: null, step: 0 });
  } else {
    useLearn.setState({ step: next });
  }
}

function ctx(): Ctx {
  const m = useStore.getState();
  return {
    phase: m.phase, mode: m.mode, advTab: m.advTab, saved: m.saved, pending: m.pending,
    apps: useOs.getState().windows.filter((w) => w.phase !== "closing").map((w) => w.app),
  };
}

/** Проверить текущий шаг (и следующие, если они уже выполнены состоянием). */
export function check(ev?: string) {
  const s = useLearn.getState();
  const d = s.drill;
  if (d) {
    const fault = drillFault(d.queue[d.i]);
    if (fault && !d.solved && !d.over && drillSolved(fault, ctx(), ev)) {
      const ms = Date.now() - d.started;
      useLearn.setState({ drill: { ...d, solved: { id: fault.id, ms, points: drillPoints(fault, ms, d.hints), hints: d.hints, gaveUp: false } } });
    }
    return;
  }
  if (s.task && !s.code) {
    if (GOALS[s.task.g]?.done(ctx(), ev)) useLearn.setState({ code: completionCode(s.task, s.student) });
    return;
  }
  const lesson = lessonOf(s.lesson);
  if (!lesson) return;
  let guard = 0;
  let event = ev;
  while (guard++ < lesson.steps.length) {
    const cur = useLearn.getState();
    if (cur.lesson !== lesson.id) return;
    const step = lesson.steps[cur.step];
    if (!step || !step.done(ctx(), event)) return;
    advance(lesson.steps.length);
    event = undefined; // событие засчитывает только один шаг
  }
}

/** Подключить автопроверку: события машины и изменения состояния. Вызывается один раз в App. */
export function attachLearning() {
  const offEvent = onEvent((ev) => check(ev));
  const offMachine = useStore.subscribe(() => check());
  const offOs = useOs.subscribe(() => check());
  return () => { offEvent(); offMachine(); offOs(); };
}
