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

const ratioOf = (c: Config) => c.cpuRatio || HW.baseRatio;
/** Частота ядра по настройкам BIOS, ГГц (без режима питания и троттлинга). */
export const cpuGhz = (c: Config) => ratioOf(c) / 10;

/** Напряжение, которого хватает множителю (его же ставит Auto). */
export function requiredVcore(c: Config) {
  const oc = Math.max(0, ratioOf(c) - HW.baseRatio);
  const uc = Math.max(0, HW.baseRatio - ratioOf(c));
  return 1.1 + oc * 0.03 - uc * 0.01;
}
export const vcoreOf = (c: Config) => (c.cpuVcore ? c.cpuVcore / 1000 : requiredVcore(c));
export const dramVOf = (c: Config) => (c.dramVoltage ? c.dramVoltage / 1000 : XMP[c.xmp].volt);

const DRAM_MIN: Record<string, number> = { "Disabled": 1.05, "Profile 1": 1.2, "Profile 2": 1.33 };

/** Стабильность разгона. fail — POST не пройдёт, unstable — ОС упадёт. */
export function stability(c: Config): { cpu: "ok" | "unstable" | "fail"; mem: "ok" | "fail" } {
  const lack = requiredVcore(c) - vcoreOf(c);
  return {
    cpu: lack > 0.06 ? "fail" : lack > 0.005 ? "unstable" : "ok",
    mem: dramVOf(c) < DRAM_MIN[c.xmp] ? "fail" : "ok",
  };
}

/** Режим питания ОС: «Тихий» снижает частоту, «Производительность» поднимает. */
export type Power = "quiet" | "balanced" | "performance";
/** Нагрузка от ОС. В BIOS и на POST — обычная (0.35), как было всегда. */
export interface Workload { load: number; power: Power }
export const IDLE_WORKLOAD: Workload = { load: 0.35, power: "balanced" };

const POWER_RATIO: Record<Power, number> = { quiet: -8, balanced: 0, performance: 2 };
/** С какой температуры процессор начинает сбрасывать частоту, °C */
export const THROTTLE_AT = 92;

/** Тепловыделение без учёта охлаждения, °C */
function heat(c: Config, w: Workload = IDLE_WORKLOAD): number {
  return baseHeat(c) + (w.load - 0.35) * 26 + POWER_RATIO[w.power] * 1.6;
}
function baseHeat(c: Config): number {
  const oc = Math.max(0, ratioOf(c) - HW.baseRatio);
  const uc = Math.max(0, HW.baseRatio - ratioOf(c));
  const extraV = vcoreOf(c) - requiredVcore(c); // перенапряжение греет, андервольт охлаждает
  return 56 + oc * 6.5 - uc * 0.8 + extraV * 80 + XMP[c.xmp].heat + (c.cpb === "Auto" ? 2 : 0) + (c.smt ? 1 : 0);
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
  const throttle = th.temp > THROTTLE_AT ? Math.min(12, Math.ceil((th.temp - THROTTLE_AT) * 1.5)) : 0;
  const ratio = Math.max(20, ratioOf(c) + POWER_RATIO[w.power] - throttle);
  const mem = XMP[c.xmp];
  const temp = th.temp + th.jitter;
  const rpm = Math.round(th.rpm);
  return {
    ratio,
    throttled: throttle > 0,
    load: w.load,
    freq: (ratio / 10).toFixed(2),
    vcore: vcoreOf(c),
    dramV: dramVOf(c),
    dramFreq: mem.freq,
    timings: mem.timings,
    temp,
    mbTemp: 30 + (th.temp - 40) * 0.25 + th.jitter * 0.3,
    duty: dutyAt(activeCurve(c), th.temp),
    rpm,
    sysRpm: Math.round(rpm * 0.75),
    noise: 15 + rpm * 0.014,
    v12: 12.1 + th.jitter * 0.01,
    v5: 5.04 + th.jitter * 0.005,
    v33: 3.32 + th.jitter * 0.003,
  };
}
export type Readings = ReturnType<typeof readings>;

export const tempClass = (t: number) => (t < 70 ? "ok" : t < 85 ? "warn" : "crit");
export const noiseClass = (n: number) => (n < 32 ? "ok" : n < 42 ? "warn" : "crit");
export const vcoreClass = (v: number) => (v > 1.4 ? "crit" : v > 1.3 ? "warn" : "");
