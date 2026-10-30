// Класс на стороне ученика: аккаунт, задания учителя, синхронизация «что у меня на экране» и выполнение
// команд удалённого управления (сообщение, блокировка экрана, задание, перезагрузка, выключение, сброс BIOS).
import { create } from "zustand";
import { useStore } from "../machine/store";
import { cpuGhz } from "../machine/sensors";
import { bootScript } from "../machine/boot";
import { useOs } from "../os/osStore";
import { useLearn, startTask } from "../learn/store";
import { cleanCfg, type Task } from "../learn/tasks";
import { api, ApiError } from "./api";

export interface Me { id: number; login: string; name: string; role: "teacher" | "student"; classCode?: string; maxStudents?: number }
export interface Assignment { id: number; title: string; descr: string; goal: string; cfg: Record<string, unknown>; done_ms: number | null }
interface Command { id: number; kind: string; payload: Record<string, any> }

/** Что видно учителю о компьютере ученика. */
export interface Snapshot {
  phase: string;
  /** os: этап ОС (splash, login, desktop, crash…); setup: ez/adv */
  screen: string;
  ghz: number;
  temp: number;
  /** окно на переднем плане */
  app: string | null;
  activity: { kind: "lesson"; id: string; step: number } | { kind: "task"; title: string; assignment: number | null; done: boolean } | { kind: "drill"; i: number; of: number; score: number } | null;
  locked: boolean;
  /** POST/загрузка закончится ошибкой: её заголовок */
  error?: string;
}

interface ClassState {
  /** unknown — ещё проверяем; offline — сервера класса нет (GitHub Pages); ready — можно входить */
  status: "unknown" | "offline" | "ready";
  me: Me | null;
  teacher: { name: string } | null;
  assignments: Assignment[];
  /** задание учителя, которое сейчас выполняется */
  active: { id: number; started: number } | null;
  /** сообщение учителя и блокировка экрана */
  message: { text: string; at: number } | null;
  lock: string | null;
  /** окно «Мой класс» поверх экрана */
  sheet: boolean;
}

const KEY = "kestrel.class";
const saved = (): Pick<ClassState, "active" | "lock"> => {
  try { return { active: null, lock: null, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { active: null, lock: null }; }
};

export const useClass = create<ClassState>(() => ({ status: "unknown", me: null, teacher: null, assignments: [], message: null, sheet: false, ...saved() }));
useClass.subscribe(({ active, lock }) => { try { localStorage.setItem(KEY, JSON.stringify({ active, lock })); } catch { /* хранилище недоступно */ } });

export async function refreshMe() {
  try {
    const r = await api<{ user: Me | null; teacher: { name: string } | null }>("me");
    useClass.setState({ status: "ready", me: r.user, teacher: r.teacher });
    if (r.user?.role === "student") void syncNow();
    else useClass.setState({ assignments: [], lock: null });
  } catch (e) {
    useClass.setState({ status: e instanceof ApiError && e.code !== "network" ? "offline" : useClass.getState().status === "ready" ? "ready" : "offline" });
  }
}

export async function login(loginName: string, password: string) {
  await api("auth/login", { login: loginName.trim().toLowerCase(), password });
  await refreshMe();
}

export async function register(p: { login: string; name: string; password: string; code: string }) {
  await api("auth/register", { ...p, login: p.login.trim().toLowerCase(), code: p.code.trim().toUpperCase() });
  await refreshMe();
}

export async function logout() {
  await api("auth/logout", {}).catch(() => {});
  useClass.setState({ me: null, teacher: null, assignments: [], active: null, lock: null, message: null });
}

export async function joinClass(code: string) {
  await api("class/join", { code: code.trim().toUpperCase() });
  await refreshMe();
}

export async function leaveClass() {
  await api("class/leave", {});
  useClass.setState({ teacher: null, assignments: [], active: null, lock: null });
}

const taskId = (id: number) => `class-${id}`;

/** Начать задание учителя: компьютер «ломается» как задумал учитель, проверка — как у заданий по ссылке. */
export function startAssignment(a: Pick<Assignment, "id" | "title" | "descr" | "goal" | "cfg">) {
  const me = useClass.getState().me;
  if (!me) return;
  const task: Task = { t: a.title, d: a.descr, g: a.goal, c: cleanCfg(a.cfg), n: taskId(a.id) };
  startTask(task, me.name);
  useClass.setState({ active: { id: a.id, started: Date.now() }, sheet: false });
}

function snapshot(): Snapshot {
  const m = useStore.getState();
  const os = useOs.getState();
  const L = useLearn.getState();
  const c = useClass.getState();
  const top = os.windows.filter((w) => w.phase !== "closing").sort((a, b) => b.z - a.z)[0];
  let activity: Snapshot["activity"] = null;
  if (L.drill) activity = { kind: "drill", i: L.drill.i + 1, of: L.drill.queue.length, score: L.drill.results.reduce((s, r) => s + r.points, 0) };
  else if (L.task) activity = { kind: "task", title: L.task.t, assignment: c.active?.id ?? null, done: !!L.code };
  else if (L.lesson) activity = { kind: "lesson", id: L.lesson, step: L.step };
  const final = m.phase === "boot" ? bootScript(m.saved, m.override).final : null;
  return {
    ...(final && (final.type === "error" || final.type === "ocfail") ? { error: final.title.en } : {}),
    phase: m.phase,
    screen: m.phase === "os" ? os.stage : m.phase === "setup" ? m.mode : m.phase,
    ghz: Math.round(cpuGhz(m.phase === "setup" ? m.pending : m.saved) * 100) / 100,
    temp: Math.round(m.thermal.temp),
    app: m.phase === "os" && os.stage === "desktop" ? top?.app ?? null : null,
    activity,
    locked: !!c.lock,
  };
}

function run(cmd: Command) {
  const m = useStore.getState();
  switch (cmd.kind) {
    case "message":
      useClass.setState({ message: { text: String(cmd.payload.text ?? ""), at: Date.now() } });
      break;
    case "lock":
      useClass.setState({ lock: String(cmd.payload.text ?? "") });
      break;
    case "unlock":
      useClass.setState({ lock: null });
      break;
    case "assign":
      if (cmd.payload.assignment) startAssignment(cmd.payload.assignment);
      break;
    case "restart":
      if (m.phase === "off") m.powerOn(); else m.restart();
      break;
    case "shutdown":
      useOs.getState().dismiss?.();
      m.shutdown();
      break;
    case "reset":
      // заводские настройки BIOS (язык и пароль importConfig сохраняет)
      m.importConfig({});
      if (m.phase !== "off") m.restart();
      break;
  }
}

let syncing = false;
export async function syncNow() {
  const c = useClass.getState();
  if (syncing || c.me?.role !== "student") return;
  syncing = true;
  try {
    const L = useLearn.getState();
    const r = await api<{ commands: Command[]; assignments: Assignment[] }>("sync", { state: snapshot(), progress: { lessons: L.done, drillBest: L.drillBest } });
    useClass.setState({ assignments: r.assignments });
    // учитель убрал ученика из класса или удалил задание — снять «активное»
    const active = useClass.getState().active;
    if (active && !r.assignments.some((a) => a.id === active.id)) useClass.setState({ active: null });
    r.commands.forEach(run);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) useClass.setState({ me: null, teacher: null, assignments: [], lock: null });
  } finally {
    syncing = false;
  }
}

/** Задание учителя выполнено — отправить результат. */
async function submitIfDone() {
  const { active } = useClass.getState();
  const L = useLearn.getState();
  if (!active || !L.code || L.task?.n !== taskId(active.id)) return;
  useClass.setState({ active: null });
  try {
    await api("submit", { assignment: active.id, ms: Date.now() - active.started });
    useClass.setState((s) => ({ assignments: s.assignments.map((a) => (a.id === active.id ? { ...a, done_ms: Date.now() - active.started } : a)) }));
  } catch {
    useClass.setState({ active }); // попробуем при следующем изменении
  }
}

/** Подключить класс: проверить вход и синхронизироваться каждые 5 секунд. Вызывается один раз в App. */
export function attachClass() {
  void refreshMe();
  const id = window.setInterval(() => void syncNow(), 5000);
  const off = useLearn.subscribe(() => void submitIfDone());
  return () => { clearInterval(id); off(); };
}
