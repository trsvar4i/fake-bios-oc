// Профили разгона (OC Profiles) и ссылки на конфигурацию BIOS.
import { PARAMS, defaults, type Config } from "./params";
import { DEVICE_IDS } from "./hardware";

/** Что входит в профиль разгона: процессор, память, вентиляторы. */
export const OC_KEYS = ["cpuRatio", "bclk", "cpuVcore", "llc", "pbo", "cpb", "thermalLimit", "xmp", "dramFreq", "dramVoltage", "tCL", "tRCD", "tRP", "tRAS", "fanProfile", "fanCurve", "sysFanProfile"];

export interface OcProfile { name: string; date: number; cfg: Config }
const KEY = "kestrel.ocprofiles";
export const SLOTS = 6;

export function loadProfiles(): (OcProfile | null)[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.from({ length: SLOTS }, (_, i) => list[i] ?? null);
  } catch {
    return Array(SLOTS).fill(null);
  }
}
export function saveProfile(slot: number, name: string, c: Config) {
  const list = loadProfiles();
  list[slot] = { name, date: Date.now(), cfg: Object.fromEntries(OC_KEYS.map((k) => [k, structuredClone(c[k])])) };
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* хранилище недоступно */ }
}

// ---------- ссылка на конфигурацию: #cfg=… ----------
/** Не передаются ссылкой: пароль и язык посетителя. */
const PRIVATE = ["setupPassword", "language"];

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

/** Ссылка на текущую страницу с отличиями конфигурации от заводской. */
export function shareLink(c: Config): string {
  const d = defaults();
  const diff = Object.fromEntries(Object.keys(PARAMS).filter((k) => !PRIVATE.includes(k) && JSON.stringify(c[k]) !== JSON.stringify(d[k])).map((k) => [k, c[k]]));
  return `${location.origin}${location.pathname}#cfg=${b64(JSON.stringify(diff))}`;
}

/** Разобрать конфигурацию из адреса: только известные параметры правильного типа. */
export function parseShared(hash: string): Config | null {
  const m = hash.match(/cfg=([\w-]+)/);
  if (!m) return null;
  try {
    const raw = JSON.parse(unb64(m[1]));
    const d = defaults();
    const out: Config = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!(k in PARAMS) || PRIVATE.includes(k)) continue;
      if (Array.isArray(d[k]) !== Array.isArray(v) || (!Array.isArray(v) && typeof d[k] !== typeof v)) continue;
      const p = PARAMS[k];
      if (p.type === "select" && !p.options!.includes(v as string)) continue;
      if (p.type === "number" && (typeof v !== "number" || v < p.min! || v > p.max!)) continue;
      if (k === "bootOrder" && !((v as string[]).length === DEVICE_IDS.length && DEVICE_IDS.every((x) => (v as string[]).includes(x)))) continue;
      out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
