// «Случайные поломки»: смена из нескольких неисправностей подряд. Пользователь видит только жалобу
// клиента, сам ищет причину в BIOS и чинит. Очки — за сложность и скорость, подсказки стоят очков.
import { l, type L } from "../machine/i18n";
import type { Config } from "../machine/params";
import { GOALS } from "./tasks";

export interface DrillFault {
  id: string;
  /** коротко, что сломано — для итогов смены */
  name: L;
  /** 1 — лёгкая, 2 — средняя, 3 — сложная (часто две причины сразу) */
  level: 1 | 2 | 3;
  /** жалоба клиента: симптом, без причины */
  symptom: L;
  cfg: Config;
  /** цель из GOALS */
  goal: string;
  /** дополнительное условие клиента (например, «разгон не трогать») */
  keep?: { text: L; ok: (saved: Config) => boolean };
  hints: [L, L];
  /** что было сломано — показывается после починки или сдачи */
  cause: L;
}

export const DRILL: DrillFault[] = [
  { id: "raid", name: l("SATA in RAID mode", "SATA в режиме RAID"), level: 1, goal: "boot", cfg: { sataMode: "RAID" },
    symptom: l("“After someone ‘tidied up’ BIOS, the PC shows a blue screen with INACCESSIBLE_BOOT_DEVICE.”",
      "«После того как кто-то “навёл порядок” в BIOS, компьютер показывает синий экран INACCESSIBLE_BOOT_DEVICE.»"),
    hints: [l("The system can’t talk to its own disk. Look at how the disk controller works.", "Система не может работать со своим диском. Посмотрите, в каком режиме работает контроллер дисков."),
      l("Advanced → Integrated Peripherals → SATA Mode: AHCI.", "Расширенные → Встроенные устройства → SATA Mode: AHCI.")],
    cause: l("SATA Mode was switched to RAID. The installed OS has no RAID driver, so it can’t find its disk.", "SATA Mode переключили в RAID. У установленной системы нет RAID-драйвера, и она не видит свой диск.") },
  { id: "offline", name: l("LAN controller off", "Выключена сетевая карта"), level: 1, goal: "online", cfg: { lanController: false },
    symptom: l("“The Store and the Browser say there is no connection. The cable is fine, the router is fine.”",
      "«Магазин и Браузер пишут, что нет подключения. Кабель в порядке, роутер в порядке.»"),
    hints: [l("If the cable is fine, maybe the network card itself is off.", "Если кабель в порядке, может быть, выключена сама сетевая карта."),
      l("Advanced → Integrated Peripherals → Onboard LAN Controller: Enabled.", "Расширенные → Встроенные устройства → сетевой контроллер: включить.")],
    cause: l("The onboard LAN controller was disabled in BIOS — the OS doesn’t see a network card at all.", "Встроенный сетевой контроллер был выключен в BIOS — ОС вообще не видит сетевую карту.") },
  { id: "mute", name: l("HD Audio off", "Выключен звук HD Audio"), level: 1, goal: "sound", cfg: { hdAudio: false },
    symptom: l("“No sound at all. Speakers work on another PC.”", "«Звука нет совсем. Колонки на другом компьютере работают.»"),
    hints: [l("The speakers are fine — so the sound chip on the board?", "Колонки исправны — значит, звуковой чип на плате?"),
      l("Advanced → Integrated Peripherals → HD Audio Controller: Enabled.", "Расширенные → Встроенные устройства → HD Audio: включить.")],
    cause: l("The HD Audio controller was disabled in BIOS.", "Звуковой контроллер HD Audio был выключен в BIOS.") },
  { id: "secure", name: l("USB first in boot order", "Флешка первой в загрузке"), level: 1, goal: "safeboot", cfg: { bootOrder: ["USB", "DVD", "HDD", "PXE", "OS"] },
    symptom: l("“The PC shows a Secure Boot Violation. Don’t you dare turn the protection off!”",
      "«Компьютер пишет Secure Boot Violation. Защиту не выключать ни в коем случае!»"),
    keep: { text: l("Secure Boot must stay on", "Secure Boot должен остаться включённым"), ok: (c) => !!c.secureBoot && !c.csm },
    hints: [l("It’s trying to start something that is not Kestrel OS. What does it boot from first?", "Компьютер пытается запустить что-то кроме Kestrel OS. С чего он загружается первым?"),
      l("Boot → Boot Option Priorities: put Kestrel OS first.", "Загрузка → Порядок загрузки: Kestrel OS первой.")],
    cause: l("The USB stick was first in the boot order. Its loader is unsigned, so Secure Boot blocks it.", "Флешка стояла первой в порядке загрузки. Её загрузчик не подписан, и Secure Boot его блокирует.") },
  { id: "oc", name: l("Too little CPU voltage", "Мало напряжения на CPU"), level: 2, goal: "boot", cfg: { cpuRatio: 50, cpuVcore: 1220 },
    symptom: l("“I overclocked to 5 GHz and now the system crashes right at the login screen. I want to keep the 5 GHz.”",
      "«Разогнал до 5 ГГц, и теперь система падает прямо на экране входа. 5 ГГц хочу оставить.»"),
    keep: { text: l("Keep the CPU at 5.0 GHz or more", "Процессор должен остаться на 5,0 ГГц или выше"), ok: (c) => Number(c.cpuRatio) >= 50 },
    hints: [l("The clock is fine; a fast CPU needs enough power.", "Частота ни при чём: быстрому процессору нужно достаточно питания."),
      l("Tweaker → CPU Core Voltage: raise it a little (about 1.25 V) or set Auto.", "Разгон → CPU Core Voltage: немного поднимите (около 1,25 В) или поставьте Auto.")],
    cause: l("CPU Core Voltage was too low for 5 GHz: enough to pass POST, not enough to stay stable.", "Напряжения CPU Core Voltage не хватало для 5 ГГц: на POST хватало, на стабильную работу — нет.") },
  { id: "memory", name: l("DRAM voltage too low for XMP", "Мало напряжения памяти для XMP"), level: 2, goal: "boot", cfg: { xmp: "Profile 2", dramVoltage: 1200 },
    symptom: l("“After I enabled fast memory, the PC says Overclocking Failed. I paid for that memory speed!”",
      "«После того как включил быструю память, компьютер пишет Overclocking Failed. Я за эту частоту платил!»"),
    keep: { text: l("Keep an XMP profile on", "XMP-профиль должен остаться включённым"), ok: (c) => c.xmp !== "Disabled" },
    hints: [l("The fast profile itself is fine. Is the memory getting the voltage it needs?", "Сам быстрый профиль в порядке. А хватает ли памяти напряжения?"),
      l("Tweaker → DRAM Voltage: Auto (the profile sets 1.35 V itself).", "Разгон → DRAM Voltage: Auto (профиль сам выставит 1,35 В).")],
    cause: l("DRAM Voltage was manually fixed at 1.20 V — too low for the XMP profile.", "DRAM Voltage вручную зафиксировали на 1,20 В — для XMP-профиля этого мало.") },
  { id: "hot", name: l("Overheating: ratio 55, silent fans", "Перегрев: множитель 55, тихие вентиляторы"), level: 2, goal: "boot", cfg: { cpuRatio: 55, fanProfile: "Silent" },
    symptom: l("“The PC was too loud, so my nephew made it ‘quieter and faster’. Now it says CPU Over Temperature.”",
      "«Компьютер шумел, и племянник сделал его “тише и быстрее”. Теперь пишет CPU Over Temperature.»"),
    hints: [l("Two things changed: the fans and the CPU clock. Check the Monitor tab.", "Поменяли две вещи: вентиляторы и частоту процессора. Загляните на вкладку Monitor."),
      l("Tweaker → CPU Ratio: Auto or 50 and lower. Fans alone won’t help at 55.", "Разгон → CPU Ratio: Auto или 50 и ниже. Одни вентиляторы при 55 не спасут.")],
    cause: l("The CPU ratio was pushed to 55 — too hot for any cooling here — and fans were set to Silent.", "Множитель подняли до 55 — такую температуру здешнее охлаждение не снимет, — а вентиляторы поставили на Silent.") },
  { id: "bclk", name: l("BCLK raised to 103.5 MHz", "BCLK поднят до 103,5 МГц"), level: 2, goal: "boot", cfg: { bclk: 10350 },
    symptom: l("“The ratio and voltage are stock, but the system still crashes at login.”", "«Множитель и напряжение заводские, а система всё равно падает на экране входа.»"),
    hints: [l("Frequency = ratio × base clock. The ratio is stock — what about the base?", "Частота = множитель × базовая частота. Множитель заводской — а база?"),
      l("Tweaker → BCLK Frequency: Auto (100 MHz).", "Разгон → BCLK: Auto (100 МГц).")],
    cause: l("BCLK was raised to 103.5 MHz. Above ~103 MHz it destabilises the whole platform, not just the CPU.", "BCLK подняли до 103,5 МГц. Выше ~103 МГц нестабильной становится вся платформа, а не только процессор.") },
  { id: "vm", name: l("SVM virtualization off", "Выключена виртуализация SVM"), level: 2, goal: "vm", cfg: {},
    symptom: l("“Kestrel VM says hardware virtualization is unavailable. I need my test machine running.”",
      "«Kestrel VM пишет, что аппаратная виртуализация недоступна. Мне нужно запустить тестовую машину.»"),
    hints: [l("Virtual machines need a CPU feature that is switched off by default.", "Виртуальным машинам нужна функция процессора, которая по умолчанию выключена."),
      l("Advanced → CPU Configuration → SVM Mode: Enabled, then start a VM in Kestrel VM.", "Расширенные → Конфигурация CPU → SVM: включить, затем запустите машину в Kestrel VM.")],
    cause: l("SVM Mode (AMD-V) was off — hardware virtualization was not available to the OS.", "SVM Mode (AMD-V) был выключен — аппаратная виртуализация была недоступна ОС.") },
  { id: "rescue", name: l("USB storage off + Secure Boot", "Выключены USB-накопители + Secure Boot"), level: 3, goal: "linux", cfg: { usbStorage: false },
    symptom: l("“I need to boot the rescue USB stick, but the PC acts as if it isn’t even plugged in.”",
      "«Нужно загрузиться со спасательной флешки, а компьютер ведёт себя, будто её вообще нет.»"),
    hints: [l("Two obstacles: the board ignores USB drives, and Secure Boot rejects unsigned loaders.", "Два препятствия: плата не видит USB-накопители, а Secure Boot не пускает неподписанные загрузчики."),
      l("Advanced → USB Configuration → USB Mass Storage: Enabled; Security → Secure Boot: off; then put USB first or use the F11 boot menu.", "Расширенные → USB → поддержка USB-накопителей: вкл.; Безопасность → Secure Boot: выкл.; затем USB первой или меню F11.")],
    cause: l("USB Mass Storage support was disabled, and Secure Boot blocks the stick’s unsigned loader.", "Поддержка USB-накопителей была выключена, а Secure Boot ещё и блокирует неподписанный загрузчик флешки.") },
  { id: "raid-lan", name: l("RAID + LAN off", "RAID + выключена сеть"), level: 3, goal: "online", cfg: { sataMode: "RAID", lanController: false },
    symptom: l("“The PC came back from a ‘repair shop’: blue screen at boot. And they say the internet was broken too.”",
      "«Компьютер вернули из “ремонта”: синий экран при загрузке. И говорят, интернет тоже барахлил.»"),
    hints: [l("Two separate faults: one stops the boot, the other you’ll only notice on the desktop.", "Две отдельные поломки: одна мешает загрузке, вторую заметите только на рабочем столе."),
      l("Advanced → Integrated Peripherals: SATA Mode AHCI and LAN Controller Enabled.", "Расширенные → Встроенные устройства: SATA Mode AHCI и сетевой контроллер вкл.")],
    cause: l("SATA Mode was RAID (no boot) and the LAN controller was disabled (no network).", "SATA Mode стоял в RAID (нет загрузки), а сетевой контроллер был выключен (нет сети).") },
  { id: "oc-mute", name: l("Low CPU voltage + HD Audio off", "Мало напряжения CPU + нет звука"), level: 3, goal: "sound", cfg: { cpuRatio: 50, cpuVcore: 1220, hdAudio: false },
    symptom: l("“A gamer friend ‘optimized’ my PC: it crashes at login, and before that there was no sound. Keep his 5 GHz, please.”",
      "«Друг-геймер “оптимизировал” мой ПК: падает на экране входа, а ещё раньше пропал звук. Его 5 ГГц оставьте, пожалуйста.»"),
    keep: { text: l("Keep the CPU at 5.0 GHz or more", "Процессор должен остаться на 5,0 ГГц или выше"), ok: (c) => Number(c.cpuRatio) >= 50 },
    hints: [l("The crash is about CPU power; the silence is about a disabled device.", "Сбой — из-за питания процессора; тишина — из-за выключенного устройства."),
      l("Tweaker → CPU Core Voltage: Auto or ~1.25 V; Advanced → Integrated Peripherals → HD Audio: Enabled.", "Разгон → CPU Core Voltage: Auto или ~1,25 В; Расширенные → Встроенные устройства → HD Audio: вкл.")],
    cause: l("Too little CPU Core Voltage for 5 GHz, and HD Audio switched off.", "Не хватало CPU Core Voltage для 5 ГГц, а HD Audio был выключен.") },
];

export const drillFault = (id: string | undefined) => DRILL.find((f) => f.id === id);

export const SHIFT = 5;
export const HINT_COST = 40;
/** время, за которое ещё дают бонус за скорость */
const PAR_MS = 4 * 60_000;

/** Очки за поломку: 100 × сложность + бонус за скорость (до 100) − 40 за подсказку, минимум 10. */
export function drillPoints(f: DrillFault, ms: number, hints: number): number {
  const speed = Math.round(100 * Math.max(0, 1 - ms / PAR_MS));
  return Math.max(10, f.level * 100 + speed - hints * HINT_COST);
}

/** Починено ли: цель достигнута и условие клиента соблюдено. */
export function drillSolved(f: DrillFault, ctx: Parameters<(typeof GOALS)[string]["done"]>[0], ev?: string): boolean {
  return !!GOALS[f.goal]?.done(ctx, ev) && (f.keep?.ok(ctx.saved) ?? true);
}

/** Смена: 2 лёгкие, 2 средние, 1 сложная, без повторов, от простого к сложному. */
export function newShift(rand: () => number = Math.random): string[] {
  const pick = (level: number, n: number) => DRILL.filter((f) => f.level === level).map((f) => ({ f, k: rand() })).sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.f.id);
  return [...pick(1, 2), ...pick(2, 2), ...pick(3, 1)];
}
