import { create } from "zustand";
import { APP_META } from "./apps/meta";

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

export type Panel = "launchpad" | "spotlight" | "control" | null;

export interface Win {
  id: number;
  app: string;
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

export interface Prefs {
  wallpaper: string;
  notes: string;
  userName: string;
  /** пароль локальной учётной записи; "" — вход без пароля */
  password: string;
  passwordHint: string;
  /** отпечаток настроек оборудования при прошлой загрузке; "" — система ещё ни разу не запускалась */
  lastHardware: string;
}

// ---------- настройки пользователя (переживают перезагрузку) ----------
const OS_KEY = "kestrel.os";
const DEFAULT_PREFS: Prefs = { wallpaper: "aurora", notes: "", userName: "User", password: "", passwordHint: "", lastHardware: "" };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(OS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
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
  /** открытая панель: Launchpad, Spotlight, пункт управления */
  panel: Panel;
  /** открытое меню строки меню */
  menu: string | null;
  /** яркость экрана 0.3…1 (пункт управления) */
  brightness: number;
  /** «Не беспокоить»: без звуков уведомлений */
  dnd: boolean;
  prefs: Prefs;

  reset: () => void;
  setStage: (s: OsStage) => void;
  open: (app: string) => void;
  close: (id: number) => void;
  focus: (id: number) => void;
  minimize: (id: number) => void;
  toggleMax: (id: number) => void;
  snap: (id: number, side: "left" | "right" | null, max?: boolean) => void;
  update: (id: number, p: Partial<Win>) => void;
  setPanel: (p: Panel) => void;
  setMenu: (m: string | null) => void;
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
  menu: null,
  brightness: 1,
  dnd: false,
  prefs: loadPrefs(),

  reset: () => set({ stage: "splash", windows: [], nextId: 1, zTop: 10, panel: null, menu: null }),
  setStage: (stage) => set({ stage, panel: null, menu: null }),

  open: (app) => {
    const s = get();
    const meta = APP_META[app];
    set({ panel: null, menu: null });
    if (meta.single) {
      const existing = s.windows.find((w) => w.app === app && w.phase !== "closing");
      if (existing) { get().focus(existing.id); return; }
    }
    const n = s.windows.length % 6;
    const z = s.zTop + 1;
    const x = Math.round((SCREEN_W - meta.w) / 2) - 100 + n * 40;
    const y = MENUBAR_H + Math.max(20, Math.round((WORK.h - meta.h) / 2) - 60) + n * 34;
    const win: Win = { id: s.nextId, app, x, y, w: meta.w, h: meta.h, z, min: false, max: false, snap: null, phase: "opening" };
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
      set((s) => ({ zTop: z, windows: s.windows.map((x) => (x.id === id ? { ...x, z, min: false, phase: "restoring" } : x)) }));
      after(ANIM.minimize, id, { phase: undefined });
    } else {
      set((s) => ({ zTop: z, windows: s.windows.map((x) => (x.id === id ? { ...x, z } : x)) }));
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
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel, menu: null })),
  setMenu: (menu) => set({ menu, panel: null }),
  dismiss: () => set({ panel: null, menu: null }),
  setPref: (k, v) =>
    set((s) => {
      const prefs = { ...s.prefs, [k]: v };
      savePrefs(prefs);
      return { prefs };
    }),
}));

/** Верхнее видимое окно. */
export const topWindow = (ws: Win[]) => ws.filter((w) => !w.min && w.phase !== "closing" && w.phase !== "minimizing").sort((a, b) => b.z - a.z)[0];
