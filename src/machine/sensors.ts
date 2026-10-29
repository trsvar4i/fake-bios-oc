import { FAN_PRESETS, HW, XMP, type Curve } from "./hardware";
import type { Config } from "./params";

export const activeCurve = (c: Config): Curve =>
  c.fanProfile === "Custom" ? c.fanCurve : FAN_PRESETS[c.fanProfile];

export function dutyAt(curve: Curve, t: number): number {
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [t0, d0] = curve[i - 1];
    const [t1, d1] = curve[i];
    if (t <= t1) return d0 + ((t - t0) / (t1 - t0)) * (d1 - d0);
  }
  return curve[curve.length - 1][1];
}

/** Базовая частота, МГц (Auto — 100). */
export const bclkOf = (c: Config) => (c.bclk ? c.bclk / 100 : HW.bclk);
/** Множитель с учётом BCLK: 45 при 100 МГц = 4,5 ГГц; при 102 МГц — уже 45,9. */
const ratioOf = (c: Config) => (c.cpuRatio || HW.baseRatio) * bclkOf(c) / HW.bclk;
/** Частота ядра по настройкам BIOS, ГГц (без режима питания и троттлинга). */
export const cpuGhz = (c: Config) => ratioOf(c) / 10;

/** Напряжение, которого хватает множителю (его же ставит Auto). */
export function requiredVcore(c: Config) {
  const oc = Math.max(0, ratioOf(c) - HW.baseRatio);
  const uc = Math.max(0, HW.baseRatio - ratioOf(c));
  return 1.1 + oc * 0.03 - uc * 0.01;
}
/** Сколько напряжения добавляет LLC под нагрузкой: компенсирует просадку. */
const LLC_BOOST: Record<string, number> = { "Auto": 0, "Level 1": 0.005, "Level 2": 0.01, "Level 3": 0.02, "Level 4": 0.03, "Level 5": 0.04 };
export const llcBoost = (c: Config) => LLC_BOOST[c.llc] ?? 0;
export const vcoreOf = (c: Config) => (c.cpuVcore ? c.cpuVcore / 1000 : requiredVcore(c));
export const dramVOf = (c: Config) => (c.dramVoltage ? c.dramVoltage / 1000 : XMP[c.xmp].volt);

const DRAM_MIN: Record<string, number> = { "Disabled": 1.05, "Profile 1": 1.2, "Profile 2": 1.33 };
const XMP_CL: Record<string, number> = { "Disabled": 40, "Profile 1": 36, "Profile 2": 30 };

/** Память по настройкам: частота с учётом BCLK, тайминги (Auto — из профиля XMP). */
export function memOf(c: Config) {
  const xmp = XMP[c.xmp];
  const auto = xmp.timings.split("-").map(Number);
  const base = c.dramFreq && c.dramFreq !== "Auto" ? Number(String(c.dramFreq).slice(5)) : xmp.freq;
  const t = [c.tCL || auto[0], c.tRCD || auto[1], c.tRP || auto[2], c.tRAS || auto[3]];
  const manual = (c.dramFreq && c.dramFreq !== "Auto") || !!(c.tCL || c.tRCD || c.tRP || c.tRAS);
  return { freq: Math.round(base * bclkOf(c) / HW.bclk), timings: t.join("-"), cl: t[0], manual };
}

/** Напряжение DRAM, которого хватает частоте и таймингам. */
export function requiredDramV(c: Config) {
  const m = memOf(c);
  if (!m.manual) return DRAM_MIN[c.xmp];
  // «плотность»: частота на такт задержки; JEDEC 4800/40 = 120, XMP 6000/30 = 200
  return 1.05 + Math.max(0, m.freq / m.cl - 120) * 0.0034 + Math.max(0, m.freq - 6400) * 0.0002;
}

/** Стабильность разгона. fail — POST не пройдёт, unstable — ОС упадёт. */
export function stability(c: Config): { cpu: "ok" | "unstable" | "fail"; mem: "ok" | "fail" } {
  const lack = requiredVcore(c) - vcoreOf(c) - llcBoost(c);
  const m = memOf(c);
  const memTooFast = m.freq > 7000 || bclkOf(c) > 104;
  return {
    cpu: lack > 0.06 ? "fail" : lack > 0.005 ? "unstable" : "ok",
    mem: memTooFast || dramVOf(c) < requiredDramV(c) - 1e-9 ? "fail" : "ok",
  };
}

/** Режим питания ОС: «Тихий» снижает частоту, «Производительность» поднимает. */
export type Power = "quiet" | "balanced" | "performance";
/** Нагрузка от ОС. В BIOS и на POST — обычная (0.35), как было всегда. */
export interface Workload { load: number; power: Power }
export const IDLE_WORKLOAD: Workload = { load: 0.35, power: "balanced" };

const POWER_RATIO: Record<Power, number> = { quiet: -8, balanced: 0, performance: 2 };
/** С какой температуры процессор начинает сбрасывать частоту, °C (по умолчанию 92, задаётся в BIOS) */
export const THROTTLE_AT = 92;
export const throttleAt = (c: Config) => (c.thermalLimit && c.thermalLimit !== "Auto" ? parseInt(c.thermalLimit, 10) : THROTTLE_AT);
/** Корпусные вентиляторы: насколько холоднее (−) или теплее (+) процессору и сколько шума. */
const SYS_FAN: Record<string, { dt: number; rpm: number }> = {
  "Silent": { dt: 1.5, rpm: 0.55 }, "Standard": { dt: 0, rpm: 0.75 }, "Turbo": { dt: -1.5, rpm: 1.05 }, "Full Speed": { dt: -3, rpm: 1.4 },
};
const sysFan = (c: Config) => SYS_FAN[c.sysFanProfile] ?? SYS_FAN.Standard;

/** Тепловыделение без учёта охлаждения, °C */
function heat(c: Config, w: Workload = IDLE_WORKLOAD): number {
  return baseHeat(c) + (w.load - 0.35) * 26 + POWER_RATIO[w.power] * 1.6;
}
function baseHeat(c: Config): number {
  const oc = Math.max(0, ratioOf(c) - HW.baseRatio);
  const uc = Math.max(0, HW.baseRatio - ratioOf(c));
  const extraV = vcoreOf(c) - requiredVcore(c); // перенапряжение греет, андервольт охлаждает
  const m = memOf(c);
  const memHeat = m.manual ? Math.max(0, (m.freq - 4800) / 600) : XMP[c.xmp].heat;
  return 56 + oc * 6.5 - uc * 0.8 + (extraV + llcBoost(c)) * 80 + memHeat + (c.cpb === "Auto" ? 2 : 0) + (c.smt ? 1 : 0)
    + (c.pbo === "Enabled" ? 3 : 0) + sysFan(c).dt;
}

/** Температура, к которой стремится CPU при текущей скорости вентилятора. */
export const targetTemp = (c: Config, t: number, w?: Workload) => heat(c, w) - 0.25 * dutyAt(activeCurve(c), t);

/** Установившаяся температура (для POST). */
export function equilibrium(c: Config): number {
  let t = 50;
  for (let i = 0; i < 80; i++) t += (targetTemp(c, t) - t) * 0.3;
  return t;
}

export interface Thermal {
  temp: number;
  rpm: number;
  jitter: number;
  acc: number;
}

export function initialThermal(c: Config): Thermal {
  const temp = equilibrium(c);
  return { temp, rpm: dutyAt(activeCurve(c), temp) * 24, jitter: 0, acc: 0 };
}

/** Шаг тепловой модели: температура и обороты меняются плавно. */
export function stepThermal(th: Thermal, c: Config, dt: number, w?: Workload): Thermal {
  const temp = th.temp + (targetTemp(c, th.temp, w) - th.temp) * Math.min(1, dt / 4);
  const rpmTarget = dutyAt(activeCurve(c), temp) * 24;
  const rpm = th.rpm + (rpmTarget - th.rpm) * Math.min(1, dt / 1.2);
  let { jitter, acc } = th;
  acc += dt;
  if (acc >= 1) { acc = 0; jitter = (Math.random() - 0.5) * 0.8; }
  return { temp, rpm, jitter, acc };
}

export function readings(c: Config, th: Thermal, w: Workload = IDLE_WORKLOAD) {
  // режим питания меняет частоту, перегрев её сбрасывает (троттлинг)
  const limit = throttleAt(c);
  const throttle = th.temp > limit ? Math.min(12, Math.ceil((th.temp - limit) * 1.5)) : 0;
  const boost = c.pbo === "Enabled" && w.load > 0.5 ? 2 : 0;
  const ratio = Math.max(20, ratioOf(c) + POWER_RATIO[w.power] + boost - throttle);
  const mem = memOf(c);
  const temp = th.temp + th.jitter;
  const rpm = Math.round(th.rpm);
  return {
    ratio,
    throttled: throttle > 0,
    load: w.load,
    freq: (ratio / 10).toFixed(2),
    vcore: vcoreOf(c) + llcBoost(c) - 0.012 * w.load,
    bclk: bclkOf(c),
    multiplier: c.cpuRatio || HW.baseRatio,
    dramV: dramVOf(c),
    dramFreq: mem.freq,
    timings: mem.timings,
    temp,
    mbTemp: 30 + (th.temp - 40) * 0.25 + th.jitter * 0.3,
    duty: dutyAt(activeCurve(c), th.temp),
    rpm,
    sysRpm: Math.round(1100 * sysFan(c).rpm + th.jitter * 6),
    noise: 15 + rpm * 0.014 + (sysFan(c).rpm - 0.75) * 9,
    v12: 12.1 + th.jitter * 0.01,
    v5: 5.04 + th.jitter * 0.005,
    v33: 3.32 + th.jitter * 0.003,
  };
}
export type Readings = ReturnType<typeof readings>;

export const tempClass = (t: number) => (t < 70 ? "ok" : t < 85 ? "warn" : "crit");
export const noiseClass = (n: number) => (n < 32 ? "ok" : n < 42 ? "warn" : "crit");
export const vcoreClass = (v: number) => (v > 1.4 ? "crit" : v > 1.3 ? "warn" : "");
