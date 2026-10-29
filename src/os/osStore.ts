import { create } from "zustand";
import { APP_META } from "./apps/meta";

export type OsStage = "splash" | "lock" | "desktop" | "crash" | "leaving";

export const SCREEN_W = 1920;
export const TASKBAR_H = 56;
export const DESK_H = 1080 - TASKBAR_H;

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
}

export interface Prefs {
  wallpaper: string;
  notes: string;
  userName: string;
  /** отпечаток настроек оборудования при прошлой загрузке; "" — система ещё ни разу не запускалась */
  lastHardware: string;
}

// ---------- настройки пользователя (переживают перезагрузку) ----------
const OS_KEY = "kestrel.os";
const DEFAULT_PREFS: Prefs = { wallpaper: "aurora", notes: "", userName: "User", lastHardware: "" };

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
  startOpen: boolean;
  selectedIcon: string | null;
  prefs: Prefs;

  reset: () => void;
  setStage: (s: OsStage) => void;
  open: (app: string) => void;
  close: (id: number) => void;
  focus: (id: number) => void;
  minimize: (id: number) => void;
  toggleMax: (id: number) => void;
  update: (id: number, p: Partial<Win>) => void;
  toggleStart: (v?: boolean) => void;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
}

export const useOs = create<OsState>((set, get) => ({
  stage: "splash",
  leaving: "shutdown",
  windows: [],
  nextId: 1,
  zTop: 10,
  startOpen: false,
  selectedIcon: null,
  prefs: loadPrefs(),

  reset: () => set({ stage: "splash", windows: [], nextId: 1, zTop: 10, startOpen: false, selectedIcon: null }),
  setStage: (stage) => set({ stage, startOpen: false }),

  open: (app) => {
    const s = get();
    const meta = APP_META[app];
    if (meta.single) {
      const existing = s.windows.find((w) => w.app === app);
      if (existing) { get().focus(existing.id); set({ startOpen: false }); return; }
    }
    const n = s.windows.length % 6;
    const z = s.zTop + 1;
    const win: Win = { id: s.nextId, app, x: 220 + n * 40, y: 50 + n * 34, w: meta.w, h: meta.h, z, min: false, max: false, snap: null };
    set({ windows: [...s.windows, win], nextId: s.nextId + 1, zTop: z, startOpen: false });
  },
  close: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),
  focus: (id) =>
    set((s) => {
      const z = s.zTop + 1;
      return { zTop: z, windows: s.windows.map((w) => (w.id === id ? { ...w, z, min: false } : w)) };
    }),
  minimize: (id) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, min: true } : w)) })),
  toggleMax: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, max: w.snap ? true : !w.max, snap: null } : w)) })),
  update: (id, p) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...p } : w)) })),
  toggleStart: (v) => set((s) => ({ startOpen: v ?? !s.startOpen })),
  setPref: (k, v) =>
    set((s) => {
      const prefs = { ...s.prefs, [k]: v };
      savePrefs(prefs);
      return { prefs };
    }),
}));

/** Верхнее видимое окно. */
export const topWindow = (ws: Win[]) => ws.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0];
