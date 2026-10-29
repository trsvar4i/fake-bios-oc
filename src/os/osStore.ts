import { create } from "zustand";
import { APP_META } from "./apps/meta";
import { HOME, join, useFs } from "./fs";
import { useStore } from "../machine/store";

export type OsStage = "splash" | "lock" | "desktop" | "crash" | "leaving";

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;
/** верхняя полоса с тремя «островками» (меню, часы, статус) */
export const MENUBAR_H = 52;
/** зона дока снизу: развёрнутое окно её не перекрывает */
export const DOCK_ZONE = 112;
/** рабочая область для развёрнутых и прилипших окон */
export const WORK = { top: MENUBAR_H, h: SCREEN_H - MENUBAR_H - DOCK_ZONE };

/** длительности анимаций окон, мс (совпадают с os.css) */
export const ANIM = { open: 280, close: 200, minimize: 460, zoom: 380 };

export type Panel = "launchpad" | "spotlight" | "control" | "widgets" | "about" | "shortcuts" | "overview" | "notifications" | null;

export interface Notice { id: number; app: string; title: string; body: string; time: number }

/** Пункт меню: строка меню, контекстные меню, меню дока. */
export type MenuItem =
  | { label: string; run?: () => void; disabled?: boolean; check?: boolean; shortcut?: string; danger?: boolean }
  | "sep";

export interface CtxMenu { x: number; y: number; items: MenuItem[]; /** меню дока раскрывается вверх */ above?: boolean }

export interface Win {
  id: number;
  app: string;
  /** что открыто в окне: папка Finder, файл TextEdit */
  arg?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  min: boolean;
  max: boolean;
  snap: "left" | "right" | null;
  /** идущая анимация: появление, закрытие, сворачивание в док, возврат из дока */
  phase?: "opening" | "closing" | "minimizing" | "restoring";
  /** плавный переход размеров (развернуть, прилипнуть) */
  anim?: boolean;
}

export interface Widget { id: number; kind: string; size: "s" | "m"; x: number; y: number }
export interface Reminder { id: number; text: string; done: boolean }

export interface Prefs {
  wallpaper: string;
  notes: string;
  userName: string;
  /** пароль локальной учётной записи; "" — вход без пароля */
  password: string;
  passwordHint: string;
  /** отпечаток настроек оборудования при прошлой загрузке; "" — система ещё ни разу не запускалась */
  lastHardware: string;
  /** закреплённые в доке приложения, по порядку */
  dock: string[];
  dockMagnify: boolean;
  widgets: Widget[];
  reminders: Reminder[];
  /** события календаря: "2026-10-29" → список */
  events: Record<string, string[]>;
  /** оформление: светлое, тёмное или по времени суток */
  theme: "dark" | "light" | "auto";
}

// ---------- настройки пользователя (переживают перезагрузку) ----------
const OS_KEY = "kestrel.os";
export const DEFAULT_DOCK = ["finder", "launchpad", "notes", "reminders", "calendar", "calculator", "clock", "terminal", "taskmgr", "settings"];
const DEFAULT_PREFS: Prefs = {
  wallpaper: "aurora", notes: "", userName: "User", password: "", passwordHint: "", lastHardware: "",
  dock: DEFAULT_DOCK,
  dockMagnify: true,
  widgets: [
    { id: 1, kind: "clock", size: "s", x: 40, y: 70 },
    { id: 2, kind: "calendar", size: "s", x: 230, y: 70 },
    { id: 3, kind: "system", size: "m", x: 40, y: 260 },
  ],
  reminders: [],
  events: {},
  theme: "dark",
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(OS_KEY);
    const p: Prefs = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
    p.dock = p.dock.filter((a) => a === "launchpad" || APP_META[a]);
    return p;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
function savePrefs(p: Prefs) {
  try { localStorage.setItem(OS_KEY, JSON.stringify(p)); } catch { /* хранилище недоступно */ }
}

interface OsState {
  stage: OsStage;
  leaving: "shutdown" | "restart" | "firmware";
  windows: Win[];
  nextId: number;
  zTop: number;
  /** открытая панель: Launchpad, Spotlight, пункт управления, галерея виджетов, «О программе» */
  panel: Panel;
  /** для какого приложения открыто окно «О программе» */
  aboutApp: string | null;
  /** открытое меню строки меню */
  menu: string | null;
  /** открытое контекстное меню */
  ctx: CtxMenu | null;
  /** фокус на рабочем столе (а не в окне): виджеты яркие */
  deskFocus: boolean;
  /** режим сна: экран погашен */
  sleeping: boolean;
  /** яркость экрана 0.3…1 (пункт управления) */
  brightness: number;
  /** «Не беспокоить»: без звуков и баннеров уведомлений */
  dnd: boolean;
  /** уведомления (центр уведомлений) и показанный сейчас баннер */
  notices: Notice[];
  banner: number | null;
  /** переключатель приложений (⌥`): порядок приложений и выбранное */
  switcher: { apps: string[]; i: number } | null;
  prefs: Prefs;

  reset: () => void;
  setStage: (s: OsStage) => void;
  open: (app: string, arg?: string) => void;
  close: (id: number) => void;
  focus: (id: number) => void;
  minimize: (id: number) => void;
  toggleMax: (id: number) => void;
  snap: (id: number, side: "left" | "right" | null, max?: boolean) => void;
  update: (id: number, p: Partial<Win>) => void;
  /** закрыть все окна приложения */
  quit: (app: string) => void;
  setPanel: (p: Panel) => void;
  setMenu: (m: string | null) => void;
  openCtx: (c: CtxMenu) => void;
  /** закрыть все всплывающие панели и меню */
  dismiss: () => void;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  notify: (app: string, title: string, body?: string) => void;
}

/** Снять флаг анимации окна, когда она закончится. */
function after(ms: number, id: number, p: Partial<Win>) {
  window.setTimeout(() => useOs.getState().update(id, p), ms);
}

export const useOs = create<OsState>((set, get) => ({
  stage: "splash",
  leaving: "shutdown",
  windows: [],
  nextId: 1,
  zTop: 10,
  panel: null,
  aboutApp: null,
  menu: null,
  ctx: null,
  deskFocus: true,
  sleeping: false,
  brightness: 1,
  dnd: false,
  notices: [],
  banner: null,
  switcher: null,
  prefs: loadPrefs(),

  reset: () => set({ stage: "splash", windows: [], nextId: 1, zTop: 10, panel: null, menu: null, ctx: null, sleeping: false }),
  setStage: (stage) => set({ stage, panel: null, menu: null, ctx: null }),

  open: (app, arg) => {
    // TextEdit без файла — сразу новый документ в «Документах»
    if (app === "textedit" && arg === undefined) {
      const fs = useFs.getState();
      const dir = `${HOME}/Documents`;
      arg = join(dir, fs.freeName(dir, useStore.getState().pending.language === "Русский" ? "без названия" : "untitled", ".txt"));
      fs.write(arg, "");
    }
    const s = get();
    const meta = APP_META[app];
    set({ panel: null, menu: null, ctx: null, deskFocus: false });
    const existing = s.windows.find((w) => w.app === app && w.phase !== "closing" && (meta.single || (arg !== undefined && w.arg === arg && app !== "finder")));
    if (existing) { get().focus(existing.id); return; }
    const z = s.zTop + 1;
    // каскад: новое окно чуть ниже и правее предыдущего, чтобы окна не ложились стопкой
    const last = [...s.windows].filter((w) => w.phase !== "closing" && !w.max && !w.snap).sort((a, b) => b.id - a.id)[0];
    let x = Math.round((SCREEN_W - meta.w) / 2) - 120;
    let y = MENUBAR_H + Math.max(16, Math.round((WORK.h - meta.h) / 2) - 70);
    if (last) { x = last.x + 44; y = last.y + 38; }
    if (x + meta.w > SCREEN_W - 20 || y + meta.h > WORK.top + WORK.h) { x = 140 + (s.nextId % 5) * 30; y = MENUBAR_H + 16 + (s.nextId % 5) * 26; }
    const win: Win = { id: s.nextId, app, arg, x, y, w: meta.w, h: meta.h, z, min: false, max: false, snap: null, phase: "opening" };
    set({ windows: [...s.windows, win], nextId: s.nextId + 1, zTop: z });
    after(ANIM.open, win.id, { phase: undefined });
  },
  close: (id) => {
    get().update(id, { phase: "closing" });
    window.setTimeout(() => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })), ANIM.close);
  },
  focus: (id) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w) return;
    const z = get().zTop + 1;
    if (w.min) {
      set((s) => ({ zTop: z, deskFocus: false, windows: s.windows.map((x) => (x.id === id ? { ...x, z, min: false, phase: "restoring" } : x)) }));
      after(ANIM.minimize, id, { phase: undefined });
    } else {
      set((s) => ({ zTop: z, deskFocus: false, windows: s.windows.map((x) => (x.id === id ? { ...x, z } : x)) }));
    }
  },
  minimize: (id) => {
    get().update(id, { phase: "minimizing" });
    after(ANIM.minimize, id, { phase: undefined, min: true });
  },
  toggleMax: (id) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w || APP_META[w.app].fixed) return;
    get().update(id, { max: w.snap ? true : !w.max, snap: null, anim: true });
    after(ANIM.zoom, id, { anim: false });
  },
  snap: (id, side, max = false) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w || APP_META[w.app].fixed) return;
    get().update(id, { snap: side, max, anim: true });
    after(ANIM.zoom, id, { anim: false });
  },
  update: (id, p) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...p } : w)) })),
  quit: (app) => get().windows.filter((w) => w.app === app && w.phase !== "closing").forEach((w) => get().close(w.id)),
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel, menu: null, ctx: null })),
  setMenu: (menu) => set({ menu, panel: null, ctx: null }),
  openCtx: (ctx) => set({ ctx, menu: null, panel: null }),
  dismiss: () => set({ panel: null, menu: null, ctx: null }),
  notify: (app, title, body = "") => {
    const n: Notice = { id: Date.now() + Math.random(), app, title, body, time: Date.now() };
    set((s) => ({ notices: [n, ...s.notices].slice(0, 30), banner: s.dnd ? s.banner : n.id }));
    if (!get().dnd) window.setTimeout(() => { if (useOs.getState().banner === n.id) useOs.setState({ banner: null }); }, 5000);
  },
  setPref: (k, v) =>
    set((s) => {
      const prefs = { ...s.prefs, [k]: v };
      savePrefs(prefs);
      return { prefs };
    }),
}));

/** Видимые окна (не свёрнутые и не закрывающиеся). */
export const visibleWindows = (ws: Win[]) => ws.filter((w) => !w.min && w.phase !== "closing" && w.phase !== "minimizing");

/**
 * Раскладка «Все окна»: настоящие окна уменьшаются и встают сеткой.
 * Возвращает для каждого окна прямоугольник, в который оно вписывается.
 */
export function overviewLayout(ws: Win[]): Record<number, { x: number; y: number; w: number; h: number }> {
  const list = [...ws].sort((a, b) => a.id - b.id);
  const n = list.length;
  if (!n) return {};
  const cols = Math.ceil(Math.sqrt(n * 1.4));
  const rows = Math.ceil(n / cols);
  const area = { x: 80, y: 140, w: SCREEN_W - 160, h: SCREEN_H - 140 - 190 };
  const cw = area.w / cols, ch = area.h / rows;
  const out: Record<number, { x: number; y: number; w: number; h: number }> = {};
  list.forEach((w, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const offset = (cols - inRow) * cw / 2;
    const g = w.max ? { w: SCREEN_W, h: WORK.h } : w.snap ? { w: SCREEN_W / 2, h: WORK.h } : w;
    const k = Math.min((cw * 0.84) / g.w, (ch * 0.78) / g.h, 0.8);
    const tw = g.w * k, th = g.h * k;
    out[w.id] = { x: area.x + offset + c * cw + (cw - tw) / 2, y: area.y + r * ch + (ch - th) / 2, w: tw, h: th };
  });
  return out;
}

/** Верхнее видимое окно. */
export const topWindow = (ws: Win[]) => ws.filter((w) => !w.min && w.phase !== "closing" && w.phase !== "minimizing").sort((a, b) => b.z - a.z)[0];
