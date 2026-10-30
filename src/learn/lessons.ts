// Уроки: пошаговые сценарии с автопроверкой. Шаг засчитывается по событию машины
// (вход в BIOS, сбой ОС, загрузка Linux…) или по состоянию (стоит ли нужный параметр).
import { l, type L } from "../machine/i18n";
import type { Config } from "../machine/params";
import { requiredVcore, stability } from "../machine/sensors";

/** Что видно шагу: состояние машины и открытые программы ОС. */
export interface Ctx {
  phase: string;
  mode: string;
  advTab: number;
  saved: Config;
  pending: Config;
  apps: string[];
}

export interface Step {
  text: L;
  hint?: L;
  /** ev — только что произошедшее событие (см. src/machine/events.ts), иначе undefined */
  done: (c: Ctx, ev?: string) => boolean;
}

export interface Lesson {
  id: string;
  title: L;
  level: 1 | 2 | 3;
  minutes: number;
  summary: L;
  /** отличия от заводских настроек, с которых начинается урок */
  setup?: Config;
  steps: Step[];
  /** что ученик вынес из урока — показывается в конце */
  takeaways: L[];
}

const on = (event: string) => (_: Ctx, ev?: string) => ev === event;
const both = (a: (c: Ctx) => boolean, b: (c: Ctx) => boolean) => (c: Ctx) => a(c) || b(c);
const inSetup = (c: Ctx) => c.phase === "setup";
/** параметр выставлен: в BIOS (ещё не сохранён) или уже в CMOS */
const set = (pred: (cfg: Config) => boolean) => both((c) => pred(c.saved), (c) => inSetup(c) && pred(c.pending));
const savedOnly = (pred: (cfg: Config) => boolean) => (c: Ctx) => c.phase !== "setup" && pred(c.saved);

export const LESSONS: Lesson[] = [
  {
    id: "bios-tour",
    title: l("Meet the BIOS", "Знакомство с BIOS"),
    level: 1, minutes: 4,
    summary: l("Power on, watch POST, enter UEFI Setup and look around without breaking anything.",
      "Включить компьютер, увидеть POST, зайти в UEFI Setup и осмотреться, ничего не сломав."),
    steps: [
      { text: l("Press the power button.", "Нажмите кнопку питания."), done: (c) => c.phase !== "off" },
      { text: l("While the logo is on screen, press DEL to enter UEFI Setup.", "Пока на экране логотип, нажмите DEL — откроется UEFI Setup."),
        hint: l("Missed it? Restart and press DEL right away.", "Не успели? Перезагрузите компьютер и сразу жмите DEL."), done: on("bios") },
      { text: l("This is EZ Mode — the overview. Press F7 to switch to Advanced Mode.", "Это EZ Mode — обзорный режим. Нажмите F7, чтобы перейти в расширенный (Advanced Mode)."),
        done: (c) => inSetup(c) && c.mode === "adv" },
      { text: l("Open the Monitor tab: here are CPU temperature, fan speed and voltages.", "Откройте вкладку Monitor: здесь температура процессора, обороты вентиляторов и напряжения."),
        hint: l("Use ← → or click the tab name.", "Стрелки ← → или щелчок по названию вкладки."), done: (c) => inSetup(c) && c.mode === "adv" && c.advTab === 4 },
      { text: l("Leave without saving: press Esc and choose to discard. Wait for the desktop.", "Выйдите без сохранения: Esc и «не сохранять». Дождитесь рабочего стола."),
        done: on("boot") },
    ],
    takeaways: [
      l("POST is the self-test the firmware runs before anything else.", "POST — самопроверка, которую прошивка делает до всего остального."),
      l("DEL during the logo opens UEFI Setup; F7 switches EZ / Advanced.", "DEL на логотипе открывает UEFI Setup, F7 переключает EZ и Advanced."),
      l("Leaving without saving changes nothing — a safe way to look around.", "Выход без сохранения ничего не меняет — безопасный способ осмотреться."),
    ],
  },
  {
    id: "boot-order",
    title: l("Boot order: start Linux from USB", "Порядок загрузки: Linux с флешки"),
    level: 1, minutes: 5,
    summary: l("Change which device the PC boots from and start a live Linux from the USB stick.",
      "Поменять устройство, с которого стартует компьютер, и запустить «живой» Linux с флешки."),
    setup: { secureBoot: false },
    steps: [
      { text: l("Power on and enter UEFI Setup (DEL).", "Включите компьютер и зайдите в UEFI Setup (DEL)."), done: on("bios") },
      { text: l("Make the USB flash drive the first boot device.", "Поставьте флешку (USB Flash) первой в порядке загрузки."),
        hint: l("In EZ Mode drag the USB icon to the first place, or Advanced → Boot → Boot Priority.", "В EZ Mode перетащите значок флешки на первое место, или Advanced → Boot → порядок загрузки."),
        done: set((c) => (c.bootOrder as string[])[0] === "USB") },
      { text: l("Save and restart: F10.", "Сохраните и перезагрузитесь: F10."), done: savedOnly((c) => (c.bootOrder as string[])[0] === "USB") },
      { text: l("Watch the PC start Live Linux from the stick.", "Смотрите: компьютер загружает Live Linux с флешки."), done: on("linux") },
      { text: l("Put Kestrel OS first again, save, and boot to the desktop.", "Верните Kestrel OS на первое место, сохраните и загрузитесь до рабочего стола."),
        hint: l("Or press F11 during POST for a one-time Boot Menu.", "Ещё способ — F11 во время POST: разовое меню загрузки."), done: on("boot") },
    ],
    takeaways: [
      l("The firmware tries devices in Boot Priority order and starts the first bootable one.", "Прошивка перебирает устройства по порядку загрузки и стартует с первого загрузочного."),
      l("F11 at POST picks a device once, without changing the order.", "F11 на POST выбирает устройство один раз, порядок не меняется."),
    ],
  },
  {
    id: "secure-boot",
    title: l("Secure Boot", "Безопасная загрузка (Secure Boot)"),
    level: 2, minutes: 5,
    summary: l("See why the PC refuses an unsigned boot loader and two ways around it.",
      "Понять, почему компьютер отказывается грузить неподписанный загрузчик, и два способа это обойти."),
    setup: { bootOrder: ["USB", "OS", "DVD", "HDD", "PXE"] },
    steps: [
      { text: l("The USB stick is first in the boot order. Power on and see what happens.", "Флешка стоит первой в порядке загрузки. Включите компьютер и посмотрите, что будет."),
        done: on("secureboot") },
      { text: l("Secure Boot blocked the unsigned Linux. Enter BIOS and either disable Secure Boot or enable Launch CSM.", "Secure Boot не пустил неподписанный Linux. Зайдите в BIOS и выключите Secure Boot или включите Launch CSM."),
        hint: l("Advanced → Security → Secure Boot, or Advanced → Boot → Launch CSM.", "Advanced → Security → Secure Boot или Advanced → Boot → Launch CSM."),
        done: set((c) => !c.secureBoot || !!c.csm) },
      { text: l("Save (F10) and boot Live Linux.", "Сохраните (F10) и загрузите Live Linux."), done: on("linux") },
      { text: l("Turn protection back on: Secure Boot on, CSM off, Kestrel OS first. Boot to the desktop.", "Верните защиту: Secure Boot включён, CSM выключен, Kestrel OS первая. Загрузитесь до рабочего стола."),
        done: (c, ev) => ev === "boot" && !!c.saved.secureBoot && !c.saved.csm },
    ],
    takeaways: [
      l("Secure Boot only starts boot loaders signed with trusted keys — it stops boot-level malware.", "Secure Boot запускает только загрузчики с доверенной подписью — это защита от вредоносных программ на уровне загрузки."),
      l("CSM emulates the old BIOS; while it is on, Secure Boot does not work.", "CSM эмулирует старый BIOS; пока он включён, Secure Boot не действует."),
      l("Turn protection back on after you are done.", "После работы защиту стоит вернуть."),
    ],
  },
  {
    id: "overclock",
    title: l("Overclocking the CPU", "Разгон процессора"),
    level: 2, minutes: 7,
    summary: l("Raise the clock, crash the OS with too little voltage, then find a stable setting.",
      "Поднять частоту, уронить систему нехваткой напряжения и найти стабильную настройку."),
    steps: [
      { text: l("Enter BIOS → Advanced (F7) → Tweaker.", "Зайдите в BIOS → Advanced (F7) → вкладка Tweaker."), done: (c) => inSetup(c) && c.mode === "adv" && c.advTab === 2 },
      { text: l("Set CPU Ratio to 50 (5.0 GHz) and CPU Core Voltage to 1.200 V by hand. Save with F10.", "Поставьте множитель CPU Ratio = 50 (5,0 ГГц) и вручную CPU Core Voltage = 1,200 В. Сохраните F10."),
        hint: l("Next to the voltage BIOS shows “Required Vcore” — we deliberately give less.", "Рядом с напряжением BIOS показывает «нужное напряжение» — мы специально даём меньше."),
        done: savedOnly((c) => c.cpuRatio >= 50 && c.cpuVcore > 0 && c.cpuVcore / 1000 < requiredVcore(c)) },
      { text: l("Boot and watch the OS crash: the CPU is unstable without enough voltage.", "Загрузитесь и посмотрите, как система упадёт: без нужного напряжения процессор нестабилен."),
        done: on("crash") },
      { text: l("Back in BIOS, raise CPU Core Voltage to the required value (or set Auto) and keep the ratio at 50. Reach the desktop.", "В BIOS поднимите напряжение до нужного (или поставьте Auto), множитель оставьте 50. Дойдите до рабочего стола."),
        hint: l("The crash screen can also reset the overclock — but then you lose the 5 GHz.", "Экран сбоя умеет сбрасывать разгон — но тогда 5 ГГц пропадут."),
        done: (c, ev) => ev === "boot" && c.saved.cpuRatio >= 50 && stability(c.saved).cpu === "ok" },
      { text: l("Open System Monitor and check the clock and the temperature.", "Откройте «Мониторинг» и посмотрите частоту и температуру."), done: (c) => c.apps.includes("taskmgr") },
    ],
    takeaways: [
      l("Higher clock needs higher voltage; too little voltage makes the CPU unstable.", "Чем выше частота, тем больше нужно напряжения; при нехватке процессор нестабилен."),
      l("More voltage means more heat — overclocking is always a trade-off.", "Больше напряжения — больше тепла: разгон всегда компромисс."),
    ],
  },
  {
    id: "cooling",
    title: l("Cooling and throttling", "Охлаждение и троттлинг"),
    level: 2, minutes: 6,
    summary: l("Overheat the CPU under load and learn when fans help and when they don’t.",
      "Перегреть процессор под нагрузкой и понять, когда помогают вентиляторы, а когда нет."),
    steps: [
      { text: l("In BIOS set CPU Fan Mode to Silent and CPU Ratio to 52. Save.", "В BIOS поставьте режим вентилятора CPU — Silent, множитель — 52. Сохраните."),
        hint: l("Monitor → Q-Fan for the fan, Tweaker for the ratio.", "Monitor → Q-Fan для вентилятора, Tweaker для множителя."),
        done: savedOnly((c) => c.fanProfile === "Silent" && c.cpuRatio >= 52) },
      { text: l("Boot, open Terminal and type stress.", "Загрузитесь, откройте Терминал и наберите stress."), done: on("stress") },
      { text: l("Wait: the CPU heats up and starts throttling — lowering its clock to survive.", "Подождите: процессор нагреется и начнёт троттлинг — сам сбросит частоту, чтобы не сгореть."),
        hint: l("Watch the temperature on the Perch or in System Monitor.", "Следите за температурой на «Насесте» или в «Мониторинге»."), done: on("hot") },
      { text: l("Try to fix it with fans: set CPU Fan Mode to Full Speed in BIOS. Then lower CPU Ratio to 50 or less. Boot to the desktop.", "Попробуйте спасти вентиляторами: в BIOS поставьте Full Speed. Потом снизьте множитель до 50 или ниже. Загрузитесь до рабочего стола."),
        hint: l("At 5.2 GHz even full-speed fans are not enough — only a lower clock helps.", "На 5,2 ГГц не хватает даже вентиляторов на максимуме — помогает только снижение частоты."),
        done: (c, ev) => ev === "boot" && (c.saved.cpuRatio || 45) <= 50 },
    ],
    takeaways: [
      l("Throttling is self-protection: the CPU slows down instead of burning out.", "Троттлинг — самозащита: процессор замедляется, а не сгорает."),
      l("Fans have a limit; past it only less heat (a lower clock or voltage) helps.", "У вентиляторов есть предел; дальше помогает только меньше тепла — ниже частота или напряжение."),
    ],
  },
  {
    id: "memory",
    title: l("Memory and XMP", "Память и XMP"),
    level: 2, minutes: 5,
    summary: l("Turn on a fast memory profile, fail memory training, and fix it with the right voltage.",
      "Включить быстрый профиль памяти, провалить тренировку памяти и починить нужным напряжением."),
    steps: [
      { text: l("In BIOS set XMP to Profile 2 and DRAM Voltage to 1.200 V by hand. Save.", "В BIOS включите XMP — Profile 2, а напряжение DRAM вручную поставьте 1,200 В. Сохраните."),
        hint: l("Advanced → Tweaker: Extreme Memory Profile and DRAM Voltage.", "Advanced → Tweaker: Extreme Memory Profile и DRAM Voltage."),
        done: savedOnly((c) => c.xmp === "Profile 2" && c.dramVoltage > 0 && c.dramVoltage < 1330) },
      { text: l("Watch POST fail memory training: “Overclocking Failed”. Press F1 to enter BIOS.", "Посмотрите, как POST провалит тренировку памяти — «Overclocking Failed». Нажмите F1, чтобы зайти в BIOS."), done: on("memfail") },
      { text: l("Set XMP Profile 2 again with DRAM Voltage on Auto (or 1.350 V). Boot to the desktop.", "Снова включите XMP Profile 2, напряжение DRAM — Auto (или 1,350 В). Загрузитесь до рабочего стола."),
        done: (c, ev) => ev === "boot" && c.saved.xmp === "Profile 2" && stability(c.saved).mem === "ok" },
    ],
    takeaways: [
      l("XMP is a factory overclocking profile stored on the memory stick.", "XMP — заводской профиль разгона, записанный на самой планке памяти."),
      l("Faster memory needs its rated voltage; without it training fails.", "Быстрой памяти нужно её штатное напряжение, иначе тренировка не проходит."),
    ],
  },
  {
    id: "no-boot",
    title: l("Diagnosis: the PC won’t boot", "Диагностика: компьютер не загружается"),
    level: 3, minutes: 4,
    summary: l("Someone changed a setting and booting fails. Read the error and fix the cause.",
      "Кто-то поменял настройку — и загрузка падает. Прочитать ошибку и найти причину."),
    setup: { sataMode: "RAID" },
    steps: [
      { text: l("Power on and read the error carefully.", "Включите компьютер и внимательно прочитайте ошибку."), done: on("raid") },
      { text: l("INACCESSIBLE_BOOT_DEVICE: the system can’t see its disk. Find the disk controller mode in BIOS and set it back.", "INACCESSIBLE_BOOT_DEVICE: система не видит свой диск. Найдите в BIOS режим контроллера дисков и верните его."),
        hint: l("Advanced → Advanced → SATA Mode: AHCI.", "Advanced → Advanced → режим SATA: AHCI."), done: set((c) => c.sataMode === "AHCI") },
      { text: l("Save and boot to the desktop.", "Сохраните и загрузитесь до рабочего стола."), done: on("boot") },
    ],
    takeaways: [
      l("The disk controller mode must match the one the OS was installed with.", "Режим контроллера дисков должен совпадать с тем, в котором установлена система."),
      l("Read the error text: it usually names the area to look at.", "Читайте текст ошибки: он обычно подсказывает, где искать."),
    ],
  },
  {
    id: "virtualization",
    title: l("Virtualization", "Виртуализация"),
    level: 3, minutes: 4,
    summary: l("Run a computer inside the computer — after enabling the CPU feature in BIOS.",
      "Запустить компьютер внутри компьютера — сначала включив нужную функцию процессора в BIOS."),
    steps: [
      { text: l("Boot to the desktop and open Kestrel VM. Try to start a machine.", "Загрузитесь до рабочего стола и откройте Kestrel VM. Попробуйте запустить машину."),
        done: (c) => c.apps.includes("vm") },
      { text: l("It refuses: virtualization is off. Restart to BIOS and enable SVM Mode.", "Не запускается: виртуализация выключена. Перезагрузитесь в BIOS и включите SVM Mode."),
        hint: l("EZ Mode has an SVM tile; or Advanced → Advanced → CPU Configuration.", "В EZ Mode есть плитка SVM; или Advanced → Advanced → CPU Configuration."), done: set((c) => !!c.virtualization) },
      { text: l("Save, boot and start a guest system in Kestrel VM.", "Сохраните, загрузитесь и запустите гостевую систему в Kestrel VM."), done: on("vm") },
    ],
    takeaways: [
      l("Virtual machines need hardware support (AMD SVM / Intel VT-x) enabled in firmware.", "Виртуальным машинам нужна аппаратная поддержка процессора (AMD SVM / Intel VT-x), включённая в прошивке."),
    ],
  },
];

export const lessonOf = (id: string | null) => LESSONS.find((x) => x.id === id) ?? null;
