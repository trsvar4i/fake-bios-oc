// Цели заданий и их проверка по модели компьютера. Модуль общий: им пользуется симулятор (засчитать шаг)
// и сервер класса (api/) — он прогоняет присланную учеником конфигурацию BIOS через ту же модель,
// поэтому «выполнить» задание, не зная правильных настроек, нельзя. Импорты с .js — для Node на сервере.
import { l, type L, type Lang } from "../machine/i18n.js";
import { bootScript } from "../machine/boot.js";
import { cpuGhz, memOf } from "../machine/sensors.js";
import { PARAMS, defaults, type Config } from "../machine/params.js";
import { DEVICE_IDS } from "../machine/hardware.js";

/**
 * Цель — строка «основа+условие+условие»: boot+lan+secure.
 * Основа: boot — загрузиться до рабочего стола; vm — запустить гостевую систему; linux — Live Linux с флешки.
 */
const BASES: Record<string, { title: L; event: string }> = {
  boot: { title: l("Boot to the desktop", "Загрузиться до рабочего стола"), event: "boot" },
  vm: { title: l("Start a guest system in Kestrel VM", "Запустить гостевую систему в Kestrel VM"), event: "vm" },
  linux: { title: l("Boot Live Linux from the USB stick", "Загрузить Live Linux с флешки"), event: "linux" },
};

const CONDS: Record<string, { title: L; ok: (c: Config) => boolean }> = {
  lan: { title: l("network works", "сеть работает"), ok: (c) => !!c.lanController },
  audio: { title: l("sound works", "звук работает"), ok: (c) => !!c.hdAudio },
  secure: { title: l("Secure Boot is on", "Secure Boot включён"), ok: (c) => !!c.secureBoot && !c.csm },
  xmp: { title: l("XMP memory profile is on", "профиль памяти XMP включён"), ok: (c) => c.xmp !== "Disabled" },
  oc5: { title: l("CPU at 5.0 GHz or more", "процессор на 5,0 ГГц и выше"), ok: (c) => cpuGhz(c) >= 5 - 1e-9 },
  silent: { title: l("fans in Silent mode", "вентиляторы в режиме Silent"), ok: (c) => c.fanProfile === "Silent" },
  smt: { title: l("all 16 CPU threads", "все 16 потоков процессора"), ok: (c) => !!c.smt },
  usb: { title: l("USB drives work", "USB-накопители работают"), ok: (c) => !!c.usbStorage },
  svm: { title: l("virtualization is on", "виртуализация включена"), ok: (c) => !!c.virtualization },
  mem6000: { title: l("memory at 6000 MT/s or more", "память на 6000 МТ/с и выше"), ok: (c) => memOf(c).freq >= 6000 },
};

/** Старые короткие имена целей (ссылки-задания и уже созданные задания класса). */
const ALIASES: Record<string, string> = { online: "boot+lan", sound: "boot+audio", safeboot: "boot+secure", oc5: "boot+oc5" };

export interface Goal { base: string; conds: string[] }

export function parseGoal(id: unknown): Goal | null {
  if (typeof id !== "string" || id.length > 60) return null;
  const [base, ...conds] = (ALIASES[id] ?? id).split("+");
  if (!BASES[base] || conds.length > 5 || new Set(conds).size !== conds.length || !conds.every((x) => CONDS[x])) return null;
  return { base, conds };
}

export const goalValid = (id: unknown) => parseGoal(id) !== null;

export function goalTitle(id: string, lang: Lang): string {
  const g = parseGoal(id);
  if (!g) return id;
  return [BASES[g.base].title[lang], ...g.conds.map((x) => CONDS[x].title[lang])].join(lang === "ru" ? "; " : "; ");
}

/** Оставить только допустимые настройки BIOS (без пароля и языка) — для ссылок, заданий и проверки на сервере. */
export function cleanCfg(raw: unknown): Config {
  const d = defaults();
  const c: Config = {};
  if (!raw || typeof raw !== "object") return c;
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in PARAMS) || k === "setupPassword" || k === "language") continue;
    if (Array.isArray(d[k]) !== Array.isArray(v) || (!Array.isArray(v) && typeof d[k] !== typeof v)) continue;
    const p = PARAMS[k];
    if (p.type === "select" && !p.options!.includes(v as string)) continue;
    if (p.type === "number" && (typeof v !== "number" || v < p.min! || v > p.max!)) continue;
    if (k === "bootOrder" && !((v as string[]).length === DEVICE_IDS.length && DEVICE_IDS.every((x) => (v as string[]).includes(x)))) continue;
    c[k] = v;
  }
  return c;
}

/** Компьютер с этими настройками сам (по порядку загрузки) доходит до рабочего стола без сбоя. */
function bootsOs(c: Config) {
  const f = bootScript(c).final;
  return f.type === "os" && !f.unstable;
}

/** Решает ли конфигурация BIOS цель — по модели, без учёта того, как ученик до неё дошёл. */
export function configSolves(id: string, cfg: Config): boolean {
  const g = parseGoal(id);
  if (!g) return false;
  const c = { ...defaults(), ...cleanCfg(cfg) };
  const base = g.base === "linux"
    ? !!c.usbStorage && bootScript(c, "USB").final.type === "linux"
    : bootsOs(c) && (g.base !== "vm" || !!c.virtualization);
  return base && g.conds.every((x) => CONDS[x].ok(c));
}

/** Засчитать в симуляторе: нужное событие (дошёл до рабочего стола, запустил VM…) и настройки, которые его гарантируют. */
export function goalDone(id: string, saved: Config, ev?: string): boolean {
  const g = parseGoal(id);
  return !!g && ev === BASES[g.base].event && configSolves(id, saved);
}

/** Цели для выпадающего списка «своего» задания. */
export const GOAL_PRESETS = ["boot", "boot+lan", "boot+audio", "boot+secure", "boot+xmp", "boot+oc5", "boot+usb", "boot+smt", "boot+silent",
  "boot+lan+audio", "boot+secure+lan", "boot+oc5+xmp", "vm", "linux"];
