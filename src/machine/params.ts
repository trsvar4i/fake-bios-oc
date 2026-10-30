import { l, type L, type Lang } from "./i18n";
import { DEVICES, FAN_PRESETS, XMP, type Curve, type DeviceId } from "./hardware";

export type Config = Record<string, any>;

export interface Param {
  label: L;
  type: "toggle" | "select" | "number" | "order" | "curve" | "password";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  default: unknown;
  help: L;
  /** параметр серый и не редактируется, пока условие истинно */
  disabledIf?: (c: Config) => boolean;
  /** для number: допустимы 0 (Auto) или значения от autoZero до max */
  autoZero?: number;
}

/** Приводит число к допустимому значению параметра. dir подсказывает, куда «перепрыгнуть» через запрещённый диапазон. */
export function normalizeNumber(p: Param, v: number, dir = 1): number {
  v = Math.min(p.max!, Math.max(p.min!, v));
  if (p.autoZero && v > 0 && v < p.autoZero) return dir > 0 ? p.autoZero : 0;
  return v;
}

const toggle = (label: L, def: boolean, help: L, disabledIf?: Param["disabledIf"]): Param =>
  ({ label, type: "toggle", default: def, help, disabledIf });
const select = (label: L, options: string[], def: string, help: L, disabledIf?: Param["disabledIf"]): Param =>
  ({ label, type: "select", options, default: def, help, disabledIf });

/** Язык по умолчанию — как у браузера (русский для ru/uk/be/kk), иначе английский. */
function browserLanguage(): "English" | "Русский" {
  const lang = typeof navigator !== "undefined" ? navigator.language ?? "" : "";
  return /^(ru|uk|be|kk)/i.test(lang) ? "Русский" : "English";
}

export const PARAMS: Record<string, Param> = {
  // Main
  language: select(l("System Language", "Язык системы"), ["English", "Русский"], browserLanguage(),
    l("Language of the Setup interface.", "Язык интерфейса Setup.")),

  // CPU
  cpuRatio: {
    label: l("CPU Ratio", "Множитель CPU"), type: "number", min: 0, max: 55, step: 1, default: 0,
    help: l("CPU core multiplier. 0 = Auto (45 → 4.5 GHz). A higher ratio raises Vcore and temperature. At 95 °C the system halts during POST.",
      "Множитель ядра CPU. 0 = Auto (45 → 4.5 ГГц). Выше множитель — выше Vcore и температура. От 95 °C система останавливается на POST."),
  },
  cpuVcore: {
    label: l("CPU Core Voltage", "Напряжение ядра CPU"), type: "number", min: 0, max: 1500, step: 5, default: 0, autoZero: 900,
    help: l("0 = Auto: the board picks a safe voltage for the ratio. Manual value in mV (1350 = 1.350 V). Too low for the ratio → the OS crashes or POST fails; too high → extra heat.",
      "0 = Auto: плата сама подбирает безопасное напряжение под множитель. Ручное значение в мВ (1350 = 1,350 В). Слишком мало для множителя — ОС падает или POST не проходит; слишком много — лишний нагрев."),
  },
  bclk: {
    label: l("CPU BCLK Frequency", "Частота BCLK"), type: "number", min: 0, max: 10500, step: 25, default: 0, autoZero: 9500,
    help: l("Base clock in hundredths of MHz (10000 = 100.00 MHz). 0 = Auto. CPU and memory frequency scale with it; above 103 MHz storage and PCIe get flaky.",
      "Базовая частота в сотых МГц (10000 = 100,00 МГц). 0 = Auto. Частоты процессора и памяти растут вместе с ней; выше 103 МГц накопители и PCIe начинают сбоить."),
  },
  llc: select(l("CPU Load-Line Calibration", "Калибровка Load-Line (LLC)"), ["Auto", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"], "Auto",
    l("Compensates voltage droop under load. Higher levels keep Vcore up: a heavy overclock becomes stable, but the CPU runs hotter.",
      "Компенсирует просадку напряжения под нагрузкой. Чем выше уровень, тем стабильнее разгон, но процессор горячее.")),
  pbo: select(l("Precision Boost Overdrive", "Precision Boost Overdrive"), ["Auto", "Disabled", "Enabled"], "Auto",
    l("Raises power limits: +200 MHz boost under load and a few degrees more heat.", "Поднимает лимиты мощности: +200 МГц под нагрузкой и несколько градусов тепла.")),
  thermalLimit: select(l("CPU Thermal Throttle Limit", "Порог троттлинга CPU"), ["Auto", "95 °C", "90 °C", "85 °C", "80 °C", "75 °C"], "Auto",
    l("Temperature at which the CPU lowers its clock to cool down. Auto = 92 °C.", "Температура, с которой процессор снижает частоту, чтобы остыть. Auto = 92 °C.")),
  cpb: select(l("Core Performance Boost", "Core Performance Boost"), ["Auto", "Disabled"], "Auto",
    l("Lets the CPU boost above base clock under load. Adds a little heat.", "Разрешает процессору разгоняться выше базовой частоты под нагрузкой. Немного добавляет нагрева.")),
  smt: toggle(l("SMT Mode", "SMT (многопоточность)"), true,
    l("Simultaneous multithreading: two threads per core.", "Одновременная многопоточность: два потока на ядро.")),
  virtualization: toggle(l("SVM Mode", "SVM (виртуализация)"), false,
    l("AMD-V hardware virtualization. Required for virtual machines in the OS.", "Аппаратная виртуализация AMD-V. Без неё в ОС не запустятся виртуальные машины.")),
  cstate: select(l("Global C-state Control", "Управление C-state"), ["Auto", "Enabled", "Disabled"], "Auto",
    l("CPU idle power-saving states.", "Энергосберегающие состояния процессора в простое.")),

  // Memory
  xmp: select(l("Extreme Memory Profile (XMP)", "Профиль памяти (XMP)"), Object.keys(XMP), "Disabled",
    l("Memory overclocking profile: higher frequency and DRAM voltage, tighter timings. Without it memory runs at 4800 MT/s.",
      "Профиль разгона памяти: выше частота и напряжение DRAM, плотнее тайминги. Без профиля память работает на 4800 MT/s.")),
  dramVoltage: {
    label: l("DRAM Voltage", "Напряжение DRAM"), type: "number", min: 0, max: 1500, step: 5, default: 0, autoZero: 1100,
    help: l("0 = Auto: taken from the XMP profile. Manual value in mV. XMP Profile 1 needs at least 1.200 V, Profile 2 at least 1.330 V, otherwise memory training fails.",
      "0 = Auto: берётся из профиля XMP. Ручное значение в мВ. XMP Profile 1 требует не меньше 1,200 В, Profile 2 — не меньше 1,330 В, иначе тренировка памяти не пройдёт."),
  },
  dramFreq: select(l("DRAM Frequency", "Частота DRAM"), ["Auto", "DDR5-4800", "DDR5-5200", "DDR5-5600", "DDR5-6000", "DDR5-6400", "DDR5-6800"], "Auto",
    l("Auto follows the XMP profile. A manual frequency needs enough DRAM voltage for the chosen timings, or memory training fails.",
      "Auto — по профилю XMP. Ручной частоте нужно достаточно напряжения DRAM для выбранных таймингов, иначе тренировка памяти не пройдёт.")),
  tCL: {
    label: l("CAS Latency (tCL)", "CAS Latency (tCL)"), type: "number", min: 0, max: 50, step: 1, default: 0, autoZero: 26,
    help: l("0 = Auto. Lower is faster. Frequency divided by tCL is how hard you push the memory: tighter needs more DRAM voltage.",
      "0 = Auto. Меньше — быстрее. Частота, делённая на tCL, — насколько сильно нагружена память: плотнее — нужно больше напряжения DRAM."),
  },
  tRCD: {
    label: l("RAS# to CAS# Delay (tRCD)", "RAS# to CAS# Delay (tRCD)"), type: "number", min: 0, max: 50, step: 1, default: 0, autoZero: 28,
    help: l("0 = Auto. Delay between opening a row and reading a column.", "0 = Auto. Задержка между открытием строки и чтением столбца."),
  },
  tRP: {
    label: l("Row Precharge Time (tRP)", "Row Precharge Time (tRP)"), type: "number", min: 0, max: 50, step: 1, default: 0, autoZero: 28,
    help: l("0 = Auto. Time to close a row before opening the next one.", "0 = Auto. Время закрытия строки перед открытием следующей."),
  },
  tRAS: {
    label: l("RAS# Active Time (tRAS)", "RAS# Active Time (tRAS)"), type: "number", min: 0, max: 120, step: 1, default: 0, autoZero: 48,
    help: l("0 = Auto. Minimum time a row stays open.", "0 = Auto. Минимальное время, которое строка остаётся открытой."),
  },
  memContext: select(l("Memory Context Restore", "Memory Context Restore"), ["Auto", "Enabled", "Disabled"], "Auto",
    l("Skips memory training on subsequent boots.", "Пропускает тренировку памяти при следующих загрузках.")),
  powerDown: select(l("Power Down Enable", "Power Down Enable"), ["Auto", "Enabled", "Disabled"], "Auto",
    l("DRAM power-down mode when idle.", "Режим пониженного питания DRAM в простое.")),

  // PCI
  above4g: toggle(l("Above 4G Decoding", "Above 4G Decoding"), true,
    l("Allows 64-bit devices to map memory above 4 GB.", "Позволяет 64-битным устройствам использовать адреса выше 4 ГБ.")),
  rebar: toggle(l("Re-Size BAR Support", "Поддержка Re-Size BAR"), false,
    l("Lets the CPU access the whole video memory. Requires Above 4G Decoding.", "Даёт процессору доступ ко всей видеопамяти. Требует Above 4G Decoding."),
    (c) => !c.above4g),
  pcieSpeed: select(l("PCIe x16 Link Speed", "Скорость PCIe x16"), ["Auto", "Gen3", "Gen4", "Gen5"], "Auto",
    l("Maximum PCI Express generation for the graphics slot.", "Максимальное поколение PCI Express для слота видеокарты.")),
  sriov: toggle(l("SR-IOV Support", "Поддержка SR-IOV"), false,
    l("Single Root I/O Virtualization for PCIe devices.", "Виртуализация ввода-вывода для PCIe-устройств.")),

  // USB
  legacyUsb: select(l("Legacy USB Support", "Legacy USB Support"), ["Enabled", "Disabled", "Auto"], "Enabled",
    l("USB keyboard and mouse support before the OS loads.", "Поддержка USB-клавиатуры и мыши до загрузки ОС.")),
  xhciHandoff: toggle(l("XHCI Hand-off", "XHCI Hand-off"), true,
    l("Passes USB controller ownership to the OS driver.", "Передаёт управление USB-контроллером драйверу ОС.")),
  usbStorage: toggle(l("USB Mass Storage Driver Support", "Поддержка USB-накопителей"), true,
    l("Without it USB drives are invisible to the firmware and cannot boot.", "Без неё USB-накопители не видны прошивке и с них нельзя загрузиться.")),

  // Integrated peripherals
  lanController: toggle(l("Onboard LAN Controller", "Встроенный сетевой контроллер"), true,
    l("Disabling removes the network card, including network (PXE) boot.", "Если выключить, пропадёт сетевая карта и загрузка по сети (PXE).")),
  lanRom: toggle(l("LAN Option ROM", "LAN Option ROM"), false,
    l("Network card boot ROM. Without it PXE boot is unavailable.", "Загрузочный ROM сетевой карты. Без него загрузка по сети (PXE) недоступна."),
    (c) => !c.lanController),
  hdAudio: toggle(l("HD Audio Controller", "Звуковой контроллер HD Audio"), true,
    l("Onboard audio. When disabled, the OS has no sound.", "Встроенный звук. Если выключить, в ОС не будет звука.")),
  sataMode: select(l("SATA Mode", "Режим SATA"), ["AHCI", "RAID"], "AHCI",
    l("Storage controller mode. The OS was installed in AHCI mode; in RAID it will not find its boot disk.",
      "Режим контроллера накопителей. ОС установлена в AHCI — в режиме RAID она не найдёт загрузочный диск.")),
  igpu: select(l("Integrated Graphics", "Встроенная графика"), ["Auto", "Force", "Disabled"], "Auto",
    l("Integrated GPU of the processor.", "Встроенный графический процессор CPU.")),

  // Power
  erp: toggle(l("ErP Ready", "ErP Ready"), false,
    l("Cuts standby power: disables USB power and Wake On LAN while off.", "Снижает потребление в выключенном состоянии: отключает питание USB и пробуждение по сети.")),
  acLoss: select(l("Restore after AC Power Loss", "После пропадания питания"), ["Power Off", "Power On", "Last State"], "Power Off",
    l("What the PC does when power comes back.", "Что делает ПК, когда питание возвращается.")),
  wol: toggle(l("Wake On LAN", "Пробуждение по сети"), false,
    l("Power on by a network packet. Unavailable with ErP Ready or without the LAN controller.", "Включение по сетевому пакету. Недоступно при ErP Ready или без сетевого контроллера."),
    (c) => c.erp || !c.lanController),

  // Boot
  csm: toggle(l("Launch CSM", "Запуск CSM"), false,
    l("Compatibility Support Module for legacy boot. While CSM is on, Secure Boot cannot be active — unsigned loaders start.",
      "Модуль совместимости для старой загрузки. Пока CSM включён, Secure Boot не работает — запускаются неподписанные загрузчики.")),
  fastBoot: toggle(l("Fast Boot", "Быстрая загрузка"), false,
    l("Skips part of POST: faster boot, less diagnostics, shorter time to press DEL.", "Пропускает часть POST: загрузка быстрее, меньше диагностики и меньше времени, чтобы нажать DEL.")),
  bootLogo: toggle(l("Full Screen Logo Display", "Полноэкранный логотип"), true,
    l("Shows the logo during POST. When disabled, POST shows diagnostic text.", "Показывать логотип при POST. Если выключить, POST покажет диагностический текст.")),
  numlock: select(l("Bootup NumLock State", "NumLock при загрузке"), ["On", "Off"], "On",
    l("NumLock state after power-on.", "Состояние NumLock после включения.")),

  // Security
  secureBoot: toggle(l("Secure Boot", "Безопасная загрузка"), true,
    l("Only signed boot loaders may start. An unsigned Linux USB stick will be blocked. Unavailable while CSM is on.", "Разрешает только подписанные загрузчики. Неподписанная флешка с Linux будет заблокирована. Недоступно при включённом CSM."),
    (c) => c.csm),
  secureBootMode: select(l("Secure Boot Mode", "Режим Secure Boot"), ["Standard", "Custom"], "Standard",
    l("Custom mode allows managing keys manually.", "Режим Custom позволяет управлять ключами вручную."),
    (c) => !c.secureBoot || c.csm),
  ftpm: select(l("Security Device Support", "Устройство TPM"), ["AMD fTPM", "Discrete TPM", "Disabled"], "AMD fTPM",
    l("Trusted Platform Module used by the OS for encryption.", "Модуль TPM, который ОС использует для шифрования.")),

  setupPassword: {
    label: l("Administrator Password", "Пароль администратора"), type: "password", default: "",
    help: l("Asked when entering Setup with DEL. Forgot it? Clear CMOS (F2 on a POST error, or Exit → Clear CMOS) removes it.",
      "Спрашивается при входе в Setup по DEL. Забыли? Clear CMOS (F2 при ошибке POST или Exit → Clear CMOS) его сбросит."),
  },

  // Fans
  fanProfile: select(l("CPU Fan Mode", "Режим вентилятора CPU"), [...Object.keys(FAN_PRESETS), "Custom"], "Standard",
    l("CPU fan curve. Silent is quiet but hot, Full Speed is cool but loud. Drag the curve points to make a Custom curve.",
      "Кривая вентилятора CPU. Silent — тихо, но горячо, Full Speed — холодно, но шумно. Перетащите точки графика, чтобы сделать свою кривую.")),
  fanCurve: {
    label: l("CPU Fan Curve", "Кривая вентилятора CPU"), type: "curve", default: FAN_PRESETS.Standard.map((p) => [...p]),
    help: l("Custom fan curve points.", "Точки пользовательской кривой вентилятора."),
  },
  sysFanProfile: select(l("Chassis Fan Mode", "Режим корпусных вентиляторов"), ["Silent", "Standard", "Turbo", "Full Speed"], "Standard",
    l("Case fans move air through the case: faster means a few degrees cooler CPU and more noise.", "Корпусные вентиляторы продувают корпус: быстрее — процессор на несколько градусов холоднее, но шумнее.")),
  fanFailWarn: toggle(l("CPU Fan Fail Warning Control", "Предупреждение об отказе вентилятора"), true,
    l("Warns during POST if the CPU fan stops.", "Предупреждение на POST, если вентилятор CPU остановился.")),

  // Exit
  biosLog: toggle(l("BIOS Log Review", "Журнал изменений BIOS"), true,
    l("Show the list of changes before saving.", "Показывать список изменений перед сохранением.")),

  bootOrder: {
    label: l("Boot Priority", "Порядок загрузки"), type: "order", default: ["OS", "USB", "DVD", "HDD", "PXE"],
    help: l("Order in which the firmware looks for a boot device.", "Порядок, в котором прошивка ищет загрузочное устройство."),
  },
};

export const defaults = (): Config =>
  Object.fromEntries(Object.entries(PARAMS).map(([id, p]) => [id, structuredClone(p.default)]));

export const clone = (c: Config): Config => structuredClone(c);

export const isDisabled = (id: string, c: Config) => !!PARAMS[id].disabledIf?.(c);

export function formatValue(id: string, v: any, lang: Lang): string {
  const p = PARAMS[id];
  if (p.type === "toggle") return v ? (lang === "ru" ? "Включено" : "Enabled") : (lang === "ru" ? "Выключено" : "Disabled");
  if (id === "cpuRatio") return v === 0 ? "Auto" : `${v} (${(v / 10).toFixed(1)} GHz)`;
  if (id === "cpuVcore" || id === "dramVoltage") return v === 0 ? "Auto" : `${(v / 1000).toFixed(3)} V`;
  if (id === "bclk") return v === 0 ? "Auto" : `${(v / 100).toFixed(2)} MHz`;
  if (p.type === "number" && v === 0 && p.autoZero) return "Auto";
  if (p.type === "password") return v ? (lang === "ru" ? "Установлен" : "Installed") : (lang === "ru" ? "Не установлен" : "Not Installed");
  if (id === "bootOrder") return (v as DeviceId[]).map((d) => DEVICES[d].short).join(" → ");
  if (id === "fanCurve") return (v as Curve).map(([t, d]) => `${t}°/${d}%`).join("  ");
  return String(v);
}
