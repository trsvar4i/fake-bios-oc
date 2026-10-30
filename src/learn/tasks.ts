// Задания преподавателя без сервера: «сломанный» компьютер и цель упакованы в ссылку #task=…
// Ученик чинит, а при достижении цели получает код выполнения. Код зависит от задания и имени ученика,
// поэтому преподаватель проверяет его у себя (вкладка «Преподавателю» в программе «Обучение»).
import { l, type L } from "../machine/i18n";
import { PARAMS, defaults, type Config } from "../machine/params";
import { DEVICE_IDS } from "../machine/hardware";
import type { Ctx } from "./lessons";

export interface Task {
  /** заголовок и пояснение от преподавателя */
  t: string;
  d: string;
  /** цель (ключ GOALS) */
  g: string;
  /** отличия настроек BIOS от заводских: «поломка» */
  c: Config;
  /** случайная соль: у каждого задания свои коды */
  n: string;
}

export const GOALS: Record<string, { title: L; done: (c: Ctx, ev?: string) => boolean }> = {
  boot: { title: l("Boot to the desktop", "Загрузиться до рабочего стола"), done: (_, ev) => ev === "boot" },
  online: { title: l("Boot to the desktop with the network working", "Загрузиться до рабочего стола с работающей сетью"),
    done: (c, ev) => ev === "boot" && !!c.saved.lanController },
  sound: { title: l("Boot to the desktop with sound working", "Загрузиться до рабочего стола со звуком"),
    done: (c, ev) => ev === "boot" && !!c.saved.hdAudio },
  safeboot: { title: l("Boot to the desktop with Secure Boot on", "Загрузиться до рабочего стола с включённым Secure Boot"),
    done: (c, ev) => ev === "boot" && !!c.saved.secureBoot && !c.saved.csm },
  linux: { title: l("Boot Live Linux from the USB stick", "Загрузить Live Linux с флешки"), done: (_, ev) => ev === "linux" },
  vm: { title: l("Start a guest system in Kestrel VM", "Запустить гостевую систему в Kestrel VM"), done: (_, ev) => ev === "vm" },
  oc5: { title: l("Run at 5 GHz and reach the desktop without a crash", "Работать на 5 ГГц и дойти до рабочего стола без сбоя"), done: (_, ev) => ev === "oc5" },
};

/** Готовые неисправности для заданий. */
export const FAULTS: { id: string; title: L; desc: L; cfg: Config; goal: string }[] = [
  { id: "raid", title: l("The disk is “missing”", "Диск «пропал»"),
    desc: l("The PC stops with INACCESSIBLE_BOOT_DEVICE. Find out why and fix it.", "Компьютер останавливается с ошибкой INACCESSIBLE_BOOT_DEVICE. Выясните причину и исправьте."),
    cfg: { sataMode: "RAID" }, goal: "boot" },
  { id: "oc", title: l("Unstable overclock", "Нестабильный разгон"),
    desc: l("The OS crashes right after boot. Make the PC stable — keep it as fast as you can.", "Система падает сразу после загрузки. Сделайте компьютер стабильным — и как можно более быстрым."),
    cfg: { cpuRatio: 50, cpuVcore: 1220 }, goal: "boot" },
  { id: "memory", title: l("Memory won’t train", "Память не проходит тренировку"),
    desc: l("POST says Overclocking Failed. Make the fast memory profile work.", "POST пишет Overclocking Failed. Заставьте быстрый профиль памяти работать."),
    cfg: { xmp: "Profile 2", dramVoltage: 1200 }, goal: "boot" },
  { id: "secure", title: l("Locked out by Secure Boot", "Secure Boot не пускает"),
    desc: l("Someone left the USB stick first. Get back to Kestrel OS without turning protection off.", "Кто-то оставил флешку первой. Вернитесь в Kestrel OS, не выключая защиту."),
    cfg: { bootOrder: ["USB", "DVD", "HDD", "PXE", "OS"] }, goal: "safeboot" },
  { id: "offline", title: l("No internet", "Нет интернета"),
    desc: l("The Store and Browser say there is no connection. Bring the network back.", "Магазин и Браузер пишут, что нет подключения. Верните сеть."),
    cfg: { lanController: false }, goal: "online" },
  { id: "mute", title: l("No sound", "Нет звука"),
    desc: l("The PC is silent. Find where the sound went.", "Компьютер молчит. Найдите, куда делся звук."),
    cfg: { hdAudio: false }, goal: "sound" },
  { id: "linux", title: l("Boot the rescue stick", "Загрузить спасательную флешку"),
    desc: l("Start Live Linux from the USB stick. Secure Boot is in the way.", "Запустите Live Linux с флешки. Мешает Secure Boot."),
    cfg: {}, goal: "linux" },
  { id: "vm", title: l("Virtual lab", "Виртуальная лаборатория"),
    desc: l("Start a guest system in Kestrel VM.", "Запустите гостевую систему в Kestrel VM."),
    cfg: {}, goal: "vm" },
];

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export const newNonce = () => Math.random().toString(36).slice(2, 8);

export function taskLink(task: Task): string {
  return `${location.origin}${location.pathname}#task=${b64(JSON.stringify(task))}`;
}

/** Разобрать задание из адреса или вставленной ссылки; настройки проверяются как у #cfg. */
export function parseTask(text: string): Task | null {
  const m = text.match(/task=([\w-]+)/);
  if (!m) return null;
  try {
    const raw = JSON.parse(unb64(m[1]));
    if (typeof raw.t !== "string" || typeof raw.g !== "string" || !GOALS[raw.g] || typeof raw.n !== "string") return null;
    const d = defaults();
    const c: Config = {};
    for (const [k, v] of Object.entries(raw.c ?? {})) {
      if (!(k in PARAMS) || k === "setupPassword" || k === "language") continue;
      if (Array.isArray(d[k]) !== Array.isArray(v) || (!Array.isArray(v) && typeof d[k] !== typeof v)) continue;
      const p = PARAMS[k];
      if (p.type === "select" && !p.options!.includes(v as string)) continue;
      if (p.type === "number" && (typeof v !== "number" || v < p.min! || v > p.max!)) continue;
      if (k === "bootOrder" && !((v as string[]).length === DEVICE_IDS.length && DEVICE_IDS.every((x) => (v as string[]).includes(x)))) continue;
      c[k] = v;
    }
    return { t: raw.t.slice(0, 120), d: String(raw.d ?? "").slice(0, 600), g: raw.g, c, n: raw.n.slice(0, 16) };
  } catch {
    return null;
  }
}

const normName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ").replace(/ё/g, "е");

/** Код выполнения: хеш FNV-1a от соли задания, цели и имени ученика → «XXX-XXX». */
export function completionCode(task: Pick<Task, "n" | "g">, student: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${task.n}|${task.g}|${normName(student)}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const s = h.toString(36).toUpperCase().padStart(7, "0").slice(-6);
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export const verifyCode = (task: Pick<Task, "n" | "g">, student: string, code: string) =>
  completionCode(task, student) === code.trim().toUpperCase().replace(/\s/g, "").replace(/^(\w{3})(\w{3})$/, "$1-$2");
