import { create } from "zustand";
import { APP_META } from "./apps/meta";
import { HOME, join, useFs } from "./fs";
import { useStore } from "../machine/store";

export type OsStage = "splash" | "lock" | "desktop" | "crash" | "leaving";

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;
/** строка меню сверху */
export const MENUBAR_H = 34;
/** зона дока снизу: развёрнутое окно её не перекрывает */
export const DOCK_ZONE = 112;
/** рабочая область для развёрнутых и прилипших окон */
export const WORK = { top: MENUBAR_H, h: SCREEN_H - MENUBAR_H - DOCK_ZONE };

/** длительности анимаций окон, мс (совпадают с os.css) */
export const ANIM = { open: 280, close: 200, minimize: 460, zoom: 380 };

export type Panel = "launchpad" | "spotlight" | "control" | "widgets" | "about" | "shortcuts" | null;

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
  /** «Не беспокоить»: без звуков уведомлений */
  dnd: boolean;
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
    const n = s.windows.length % 6;
    const z = s.zTop + 1;
    const x = Math.round((SCREEN_W - meta.w) / 2) - 100 + n * 40;
    const y = MENUBAR_H + Math.max(20, Math.round((WORK.h - meta.h) / 2) - 60) + n * 34;
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
    if (!w) return;
    get().update(id, { max: w.snap ? true : !w.max, snap: null, anim: true });
    after(ANIM.zoom, id, { anim: false });
  },
  snap: (id, side, max = false) => {
    get().update(id, { snap: side, max, anim: true });
    after(ANIM.zoom, id, { anim: false });
  },
  update: (id, p) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...p } : w)) })),
  quit: (app) => get().windows.filter((w) => w.app === app && w.phase !== "closing").forEach((w) => get().close(w.id)),
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel, menu: null, ctx: null })),
  setMenu: (menu) => set({ menu, panel: null, ctx: null }),
  openCtx: (ctx) => set({ ctx, menu: null, panel: null }),
  dismiss: () => set({ panel: null, menu: null, ctx: null }),
  setPref: (k, v) =>
    set((s) => {
      const prefs = { ...s.prefs, [k]: v };
      savePrefs(prefs);
      return { prefs };
    }),
}));

/** Верхнее видимое окно. */
export const topWindow = (ws: Win[]) => ws.filter((w) => !w.min && w.phase !== "closing" && w.phase !== "minimizing").sort((a, b) => b.z - a.z)[0];
