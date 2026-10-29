import { create } from "zustand";
import type { ReactNode } from "react";
import { DEVICE_IDS, type DeviceId } from "./hardware";
import { PARAMS, clone, defaults, type Config } from "./params";
import { IDLE_WORKLOAD, activeCurve, initialThermal, readings, stepThermal, type Power, type Thermal } from "./sensors";
import type { Lang } from "./i18n";

export type Phase = "off" | "post" | "setup" | "boot" | "os";

export interface DialogSpec {
  title: string;
  body?: ReactNode;
  list?: { label: string; value: unknown }[];
  current?: unknown;
  onPick?: (v: any) => void;
  number?: { value: number; min: number; max: number; step: number; hint: string; onApply: (v: number) => void };
  buttons?: { label: string; run: () => void }[];
  /** поле пароля: onSubmit возвращает true, если пароль принят (окно закрывается) */
  password?: { hint: string; onSubmit: (v: string) => boolean; onCancel?: () => void };
  /** прогресс (прошивка): 0…100, окно без кнопок */
  progress?: number;
}

// ---------- CMOS (настройки переживают перезагрузку страницы) ----------
const CMOS_KEY = "kestrel.cmos";

function loadCmos(): Config {
  const c = defaults();
  try {
    const raw = localStorage.getItem(CMOS_KEY);
    if (!raw) return c;
    const stored = JSON.parse(raw);
    for (const id of Object.keys(PARAMS)) {
      if (!(id in stored)) continue;
      if (Array.isArray(c[id]) !== Array.isArray(stored[id]) || (!Array.isArray(c[id]) && typeof c[id] !== typeof stored[id])) continue;
      c[id] = stored[id];
    }
    const order = c.bootOrder as DeviceId[];
    if (order.length !== DEVICE_IDS.length || !DEVICE_IDS.every((d) => order.includes(d))) c.bootOrder = defaults().bootOrder;
  } catch {
    /* повреждённый CMOS — работаем с заводскими настройками */
  }
  return c;
}
function writeCmos(c: Config) {
  try { localStorage.setItem(CMOS_KEY, JSON.stringify(c)); } catch { /* хранилище недоступно */ }
}
function wipeCmos() {
  try { localStorage.removeItem(CMOS_KEY); } catch { /* хранилище недоступно */ }
}

// ---------- Store ----------
interface State {
  saved: Config;
  pending: Config;
  phase: Phase;
  override: DeviceId | null;
  mode: "ez" | "adv";
  ezTab: string;
  /** фокус клавиатуры в EZ Mode */
  ezZone: string;
  ezIdx: number;
  advTab: number;
  advPath: string[];
  advSel: Record<string, number>;
  dialog: DialogSpec | null;
  thermal: Thermal;
  hint: string;
  /** ОС загружена с нестабильным разгоном — упадёт при старте */
  osUnstable: boolean;
  /** перезагрузка сразу в Setup (из ОС: «Restart to UEFI») */
  toSetup: boolean;
  /** загрузка процессора 0…1 — задаёт ОС по запущенным программам */
  load: number;
  /** режим питания из «Хаба» ОС */
  power: Power;
  /** история датчиков раз в секунду, последние 90 с (графики Hardware Monitor) */
  hist: { temp: number[]; rpm: number[]; vcore: number[]; acc: number };

  patch: (p: Partial<State>) => void;
  setParam: (id: string, v: unknown) => void;
  setCurvePoint: (i: number, t: number, d: number) => void;
  moveBoot: (from: number, to: number) => void;
  swapBoot: (index: number, dev: DeviceId) => void;
  openDialog: (d: DialogSpec) => void;
  closeDialog: () => void;
  saveAndReset: () => void;
  discardAndExit: () => void;
  discard: () => void;
  loadDefaults: () => void;
  clearCmos: () => void;
  enterSetup: () => void;
  boot: (dev?: DeviceId | null) => void;
  restart: () => void;
  restartToSetup: () => void;
  powerOn: () => void;
  shutdown: () => void;
  tick: (dt: number) => void;
  /** язык системы (тот же параметр, что в BIOS) — сразу записывается в CMOS */
  setLanguage: (lang: "English" | "Русский") => void;
  /** вернуть множитель и напряжение процессора в Auto и записать в CMOS (после сбоя) */
  resetOverclock: () => void;
  /** применить конфигурацию из ссылки: заводские настройки + присланные отличия (язык и пароль — свои) */
  importConfig: (diff: Config) => void;
}

const initial = loadCmos();

export const useStore = create<State>((set, get) => ({
  saved: initial,
  pending: clone(initial),
  phase: "off",
  override: null,
  mode: "ez",
  ezTab: "cpu",
  ezZone: "nav",
  ezIdx: 0,
  advTab: 0,
  advPath: [],
  advSel: {},
  dialog: null,
  thermal: initialThermal(initial),
  hint: "",
  osUnstable: false,
  toSetup: false,
  load: IDLE_WORKLOAD.load,
  power: IDLE_WORKLOAD.power,
  hist: { temp: [], rpm: [], vcore: [], acc: 0 },

  patch: (p) => set(p),
  setParam: (id, v) => set((s) => ({ pending: { ...s.pending, [id]: v } })),

  setCurvePoint: (i, t, d) =>
    set((s) => {
      const curve = activeCurve(s.pending).map((p) => [...p] as [number, number]);
      const prev = curve[i - 1];
      const next = curve[i + 1];
      const tMin = prev ? prev[0] + 3 : 20;
      const tMax = next ? next[0] - 3 : 100;
      const dMin = prev ? prev[1] : 0;
      const dMax = next ? next[1] : 100;
      curve[i] = [Math.round(Math.min(tMax, Math.max(tMin, t))), Math.round(Math.min(dMax, Math.max(dMin, d)))];
      return { pending: { ...s.pending, fanProfile: "Custom", fanCurve: curve } };
    }),

  moveBoot: (from, to) =>
    set((s) => {
      const order = [...s.pending.bootOrder];
      const [dev] = order.splice(from, 1);
      order.splice(to > from ? to - 1 : to, 0, dev);
      return { pending: { ...s.pending, bootOrder: order } };
    }),

  swapBoot: (index, dev) =>
    set((s) => {
      const order = [...s.pending.bootOrder];
      const j = order.indexOf(dev);
      [order[index], order[j]] = [order[j], order[index]];
      return { pending: { ...s.pending, bootOrder: order } };
    }),

  openDialog: (d) => set({ dialog: d }),
  closeDialog: () => set({ dialog: null }),

  saveAndReset: () => {
    const c = clone(get().pending);
    writeCmos(c);
    set({ saved: c, pending: clone(c), dialog: null, phase: "post", override: null });
  },
  discardAndExit: () => set((s) => ({ pending: clone(s.saved), dialog: null, phase: "post", override: null })),
  discard: () => set((s) => ({ pending: clone(s.saved) })),
  loadDefaults: () => set({ pending: defaults() }),
  clearCmos: () => {
    wipeCmos();
    const d = defaults();
    set({ saved: d, pending: clone(d), dialog: null, phase: "post", override: null });
  },

  enterSetup: () => set((s) => ({ phase: "setup", pending: clone(s.saved), advPath: [], dialog: null })),
  boot: (dev = null) => set({ phase: "boot", override: dev, dialog: null }),
  restart: () => set({ phase: "post", override: null, dialog: null }),
  restartToSetup: () => set({ phase: "post", override: null, dialog: null, toSetup: true }),
  powerOn: () => set((s) => ({ phase: "post", override: null, dialog: null, thermal: initialThermal(s.saved) })),
  shutdown: () => set((s) => ({ phase: "off", override: null, dialog: null, pending: clone(s.saved) })),

  tick: (dt) => {
    const s = get();
    const c = s.phase === "setup" ? s.pending : s.saved;
    const w = s.phase === "os" ? { load: s.load, power: s.power } : IDLE_WORKLOAD;
    const thermal = stepThermal(s.thermal, c, dt, w);
    let hist = { ...s.hist, acc: s.hist.acc + dt };
    if (hist.acc >= 1) {
      const r = readings(c, thermal, w);
      const push = (a: number[], v: number) => [...a, v].slice(-90);
      hist = { temp: push(hist.temp, r.temp), rpm: push(hist.rpm, r.rpm), vcore: push(hist.vcore, r.vcore), acc: 0 };
    }
    set({ thermal, hist });
  },
  setLanguage: (language) => {
    const c = { ...clone(get().saved), language };
    writeCmos(c);
    set((s) => ({ saved: c, pending: { ...s.pending, language } }));
  },
  importConfig: (diff) => {
    const cur = get().saved;
    const c = { ...defaults(), ...clone(diff), language: cur.language, setupPassword: cur.setupPassword };
    writeCmos(c);
    set({ saved: c, pending: clone(c), thermal: initialThermal(c) });
  },
  resetOverclock: () => {
    const d = defaults();
    const c = { ...clone(get().saved), cpuRatio: d.cpuRatio, cpuVcore: d.cpuVcore, bclk: d.bclk, llc: d.llc };
    writeCmos(c);
    set({ saved: c, pending: clone(c) });
  },
}));

/** Язык интерфейса: в Setup меняется сразу, как в настоящем BIOS. */
export function useLang(): { lang: Lang; t: (en: string, ru?: string) => string } {
  const lang: Lang = useStore((s) => (s.pending.language === "Русский" ? "ru" : "en"));
  return { lang, t: (en, ru) => (lang === "ru" && ru ? ru : en) };
}

export const isChanged = (s: { saved: Config; pending: Config }, id: string) =>
  JSON.stringify(s.pending[id]) !== JSON.stringify(s.saved[id]);
export const changedIds = (s: { saved: Config; pending: Config }) => Object.keys(PARAMS).filter((id) => isChanged(s, id));
