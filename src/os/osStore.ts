import { create } from "zustand";
import { APP_META } from "./apps/meta";
import { HOME, join, useFs } from "./fs";
import { prefsKey, setCurrentUser } from "./users";
import { useStore } from "../machine/store";

export type OsStage = "splash" | "lock" | "desktop" | "crash" | "leaving";

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;
/** сверху у Kestrel нет панели: рабочая область начинается от края экрана */
export const WORK_TOP = 0;
/** зона «Насеста» снизу: развёрнутое окно её не перекрывает */
export const PERCH_ZONE = 96;
/** рабочая область для развёрнутых и прилипших окон */
export const WORK = { top: WORK_TOP, h: SCREEN_H - WORK_TOP - PERCH_ZONE };

/** длительности анимаций окон, мс (совпадают с os.css) */
export const ANIM = { open: 340, close: 220, minimize: 420, zoom: 380 };

/** Панели оболочки: «Гнездо» (все программы), «Бросок» (командная палитра), «Хаб» (уведомления и быстрые настройки). */
export type Panel = "nest" | "swoop" | "hub" | "widgets" | "about" | "shortcuts" | "overview" | "welcome" | null;

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
  /** на каком рабочем столе окно (0…) */
  space: number;
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
  /** закреплённые на «Насесте» приложения, по порядку (ключ dock — с прежних версий) */
  dock: string[];
  /** устарело: увеличение дока из прежних версий */
  dockMagnify: boolean;
  /** подписи у запущенных программ на «Насесте» */
  perchLabels: boolean;
  /** «Ночной свет»: тёплый оттенок экрана */
  nightLight: boolean;
  /** облегчённый режим: меньше размытия и анимаций (auto — по устройству) */
  lite: "auto" | "on" | "off";
  widgets: Widget[];
  reminders: Reminder[];
  /** события календаря: "2026-10-29" → список */
  events: Record<string, string[]>;
  /** оформление: светлое, тёмное или по времени суток */
  theme: "dark" | "light" | "auto";
  /** режим питания: передаётся в модель машины (частота и нагрев) */
  power: "quiet" | "balanced" | "performance";
  /** приложения, установленные из Магазина */
  installed: string[];
  /** имя компьютера (Терминал, «Об этом компьютере») */
  hostName: string;
  /** 12-часовой формат времени */
  hour12: boolean;
  /** приветствие уже показано этому пользователю */
  welcomed: boolean;
}

// ---------- настройки пользователя (переживают перезагрузку) ----------
export const DEFAULT_DOCK = ["finder", "browser", "learn", "appstore", "notes", "reminders", "calendar", "calculator", "clock", "terminal", "taskmgr", "settings"];
const DEFAULT_PREFS: Prefs = {
  wallpaper: "aurora", notes: "", userName: "User", password: "", passwordHint: "", lastHardware: "",
  dock: DEFAULT_DOCK,
  dockMagnify: true,
  perchLabels: true,
  nightLight: false,
  lite: "auto",
  widgets: [
    { id: 1, kind: "clock", size: "s", x: 40, y: 70 },
    { id: 2, kind: "calendar", size: "s", x: 230, y: 70 },
    { id: 3, kind: "system", size: "m", x: 40, y: 260 },
  ],
  reminders: [],
  events: {},
  theme: "dark",
  power: "balanced",
  installed: [],
  hostName: "Kestrel",
  hour12: false,
  welcomed: false,
};

/** Настройки пользователя (по умолчанию — текущего). */
function loadPrefs(id?: string): Prefs {
  try {
    const raw = localStorage.getItem(prefsKey(id));
    const p: Prefs = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
    // кнопка Launchpad из прежнего дока стала постоянной кнопкой «Гнезда»
    p.dock = p.dock.filter((a) => APP_META[a]);
    return p;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
function savePrefs(p: Prefs) {
  try { localStorage.setItem(prefsKey(), JSON.stringify(p)); } catch { /* хранилище недоступно */ }
}

interface OsState {
  stage: OsStage;
  leaving: "shutdown" | "restart" | "firmware" | "update";
  windows: Win[];
  nextId: number;
  zTop: number;
  /** открытая панель: «Гнездо», «Бросок», «Хаб», галерея виджетов, «О программе» */
  panel: Panel;
  /** для какого приложения открыто окно «О программе» */
  aboutApp: string | null;
  /** открытое меню (меню окна, меню питания) */
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
  /** уведомления (в «Хабе») и показанный сейчас всплывающий тост */
  notices: Notice[];
  banner: number | null;
  /** рабочие столы: сколько их и какой открыт; dir — откуда «въехал» текущий (для анимации) */
  spaces: number;
  space: number;
  spaceDir: -1 | 0 | 1;
  /** нагрузочный тест из Терминала (`stress`) идёт до этого момента */
  stressUntil: number;
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
  /** перейти на рабочий стол; добавить; убрать (окна переезжают на соседний) */
  goSpace: (i: number) => void;
  addSpace: () => void;
  removeSpace: (i: number) => void;
  moveToSpace: (id: number, i: number) => void;
  /** сменить пользователя: окна закрываются, загружаются его настройки и файлы */
  switchUser: (id: string) => void;
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
  spaces: 2,
  space: 0,
  spaceDir: 0,
  stressUntil: 0,
  prefs: loadPrefs(),

  reset: () => set({ stage: "splash", windows: [], nextId: 1, zTop: 10, panel: null, menu: null, ctx: null, sleeping: false, space: 0, spaceDir: 0 }),
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
    if (existing) {
      if (meta.single && arg !== undefined) get().update(existing.id, { arg });
      get().focus(existing.id);
      return;
    }
    const z = s.zTop + 1;
    // каскад: новое окно чуть ниже и правее предыдущего, чтобы окна не ложились стопкой
    const last = [...s.windows].filter((w) => w.phase !== "closing" && !w.max && !w.snap).sort((a, b) => b.id - a.id)[0];
    let x = Math.round((SCREEN_W - meta.w) / 2) - 120;
    let y = WORK_TOP + Math.max(24, Math.round((WORK.h - meta.h) / 2) - 50);
    if (last) { x = last.x + 44; y = last.y + 38; }
    if (x + meta.w > SCREEN_W - 20 || y + meta.h > WORK.top + WORK.h) { x = 140 + (s.nextId % 5) * 30; y = WORK_TOP + 24 + (s.nextId % 5) * 26; }
    const win: Win = { id: s.nextId, app, arg, x, y, w: meta.w, h: meta.h, z, min: false, max: false, snap: null, phase: "opening", space: s.space };
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
    // окно на другом рабочем столе — сначала переезжаем туда
    if (w.space !== get().space) get().goSpace(w.space);
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
  goSpace: (i) => {
    const s = get();
    const to = Math.max(0, Math.min(s.spaces - 1, i));
    if (to === s.space) return;
    set({ space: to, spaceDir: to > s.space ? 1 : -1, menu: null, ctx: null, panel: s.panel === "overview" ? "overview" : null });
    // класс анимации въезда снимается, чтобы следующий переход проигрался заново
    window.setTimeout(() => useOs.setState({ spaceDir: 0 }), 450);
  },
  addSpace: () => set((s) => (s.spaces >= 6 ? {} : { spaces: s.spaces + 1 })),
  removeSpace: (i) => set((s) => {
    if (s.spaces <= 1) return {};
    const dest = i === 0 ? 0 : i - 1;
    return {
      spaces: s.spaces - 1,
      space: s.space > i || s.space === s.spaces - 1 ? Math.max(0, s.space - 1) : s.space,
      windows: s.windows.map((w) => (w.space === i ? { ...w, space: dest } : w.space > i ? { ...w, space: w.space - 1 } : w)),
    };
  }),
  moveToSpace: (id, i) => get().update(id, { space: i }),
  switchUser: (id) => {
    setCurrentUser(id);
    useFs.getState().reload();
    set({ prefs: loadPrefs(id), windows: [], notices: [], banner: null, panel: null, menu: null, ctx: null, space: 0, stressUntil: 0 });
  },
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

/** Новая учётная запись: настройки по умолчанию с её именем. */
export function createUserPrefs(id: string, name: string) {
  try { localStorage.setItem(prefsKey(id), JSON.stringify({ ...DEFAULT_PREFS, userName: name, wallpaper: ["ocean", "forest", "ember", "rose"][Math.floor(Math.random() * 4)] })); } catch { /* хранилище недоступно */ }
}

/** Приложение есть в системе: встроенное или установлено из Магазина. */
export const isAvailable = (id: string) => !!APP_META[id] && (!APP_META[id].store || useOs.getState().prefs.installed.includes(id));

/** Видимые окна (не свёрнутые и не закрывающиеся). */
export const visibleWindows = (ws: Win[], space = useOs.getState().space) => ws.filter((w) => !w.min && w.phase !== "closing" && w.phase !== "minimizing" && w.space === space);

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
export const topWindow = (ws: Win[]) => visibleWindows(ws).sort((a, b) => b.z - a.z)[0];
