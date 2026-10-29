// Дерево страниц Advanced Mode.
import { l, type L } from "../../machine/i18n";
import { DEVICE_IDS, HW, STORAGE, type DeviceId } from "../../machine/hardware";
import type { Config } from "../../machine/params";
import { requiredDramV, requiredVcore, tempClass, noiseClass, vcoreClass, type Readings } from "../../machine/sensors";
import { SLOTS } from "../../machine/profiles";
import type { ActionId } from "./actions";

export type Item =
  | { kind: "header"; label: L }
  | { kind: "info"; label: L; value: string; cls?: string; grey?: boolean }
  | { kind: "param"; id: string }
  | { kind: "sub"; page: string; label: L }
  | { kind: "boot"; index: number }
  | { kind: "action"; id: ActionId; label: L; help: L }
  | { kind: "override"; dev: DeviceId }
  | { kind: "profile"; slot: number }
  | { kind: "fan" }
  | { kind: "graph" };

export const TABS: { id: string; title: L }[] = [
  { id: "favorites", title: l("My Favorites", "Избранное") },
  { id: "main", title: l("Main", "Главная") },
  { id: "tweaker", title: l("Tweaker", "Разгон") },
  { id: "advanced", title: l("Advanced", "Расширенные") },
  { id: "monitor", title: l("Monitor", "Мониторинг") },
  { id: "boot", title: l("Boot", "Загрузка") },
  { id: "tool", title: l("Tool", "Сервис") },
  { id: "security", title: l("Security", "Безопасность") },
  { id: "exit", title: l("Exit", "Выход") },
];

export const PAGE_TITLES: Record<string, L> = {
  ...Object.fromEntries(TABS.map((t) => [t.id, t.title])),
  cpu: l("CPU Configuration", "Настройки процессора"),
  memory: l("Memory Configuration", "Настройки памяти"),
  timing: l("DRAM Timing Control", "Тайминги памяти"),
  pci: l("PCI Subsystem Settings", "Подсистема PCI"),
  usb: l("USB Configuration", "Настройки USB"),
  periph: l("Integrated Peripherals", "Встроенные устройства"),
  nvme: l("NVMe Configuration", "Накопители NVMe"),
  power: l("Power Management Setup", "Управление питанием"),
  secureboot: l("Secure Boot", "Безопасная загрузка"),
  keys: l("Key Management", "Управление ключами"),
  tpm: l("Trusted Computing", "Доверенные вычисления"),
  qfan: l("Q-Fan Control", "Управление вентиляторами"),
  profiles: l("OC Profiles", "Профили разгона"),
  spd: l("SPD Information", "Сведения SPD"),
};

const h = (en: string, ru: string): Item => ({ kind: "header", label: l(en, ru) });
const info = (en: string, ru: string, value: string, cls?: string): Item => ({ kind: "info", label: l(en, ru), value, cls });
const grey = (en: string, ru: string, value: string): Item => ({ kind: "info", label: l(en, ru), value, grey: true });
const p = (id: string): Item => ({ kind: "param", id });
const sub = (page: string): Item => ({ kind: "sub", page, label: PAGE_TITLES[page] });
const act = (id: ActionId, en: string, ru: string, helpEn: string, helpRu: string): Item => ({ kind: "action", id, label: l(en, ru), help: l(helpEn, helpRu) });

export function pageItems(page: string, c: Config, r: Readings): Item[] {
  const now = new Date();
  switch (page) {
    case "favorites":
      return [
        h("Frequently used", "Часто используемые"),
        p("xmp"), p("cpuRatio"), p("cpuVcore"), p("fanProfile"), p("virtualization"),
        h("Boot & devices", "Загрузка и устройства"),
        p("secureBoot"), p("csm"), p("fastBoot"), p("sataMode"), p("lanController"), p("hdAudio"),
      ];
    case "main":
      return [
        h("BIOS Information", "Сведения о BIOS"),
        info("BIOS Version", "Версия BIOS", HW.bios),
        info("Build Date", "Дата сборки", HW.buildDate),
        info("EC Version", "Версия EC", "MBEC-7E26-0207"),
        info("ME/PSP Firmware", "Прошивка PSP", "0.37.0.4F"),
        h("Platform", "Платформа"),
        info("Product", "Плата", HW.product),
        info("Processor", "Процессор", HW.cpu),
        info("CPU Speed", "Частота CPU", `${r.freq} GHz`),
        info("Total Memory", "Объём памяти", `${HW.ramTotalMb} MB`),
        info("Memory Speed", "Частота памяти", `${r.dramFreq} MT/s`),
        h("System Settings", "Системные настройки"),
        info("System Date", "Системная дата", now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })),
        info("System Time", "Системное время", now.toLocaleTimeString("en-GB")),
        p("language"),
        grey("Access Level", "Уровень доступа", c.setupPassword ? "Administrator (protected)" : "Administrator"),
      ];
    case "tweaker":
      return [
        info("Target CPU Speed", "Целевая частота CPU", `${((c.cpuRatio || HW.baseRatio) * r.bclk / 1000).toFixed(2)} GHz`),
        info("Target DRAM Frequency", "Целевая частота DRAM", `${r.dramFreq} MT/s  (${r.timings})`),
        h("CPU", "Процессор"),
        p("cpuRatio"),
        p("bclk"),
        p("pbo"),
        p("cpb"),
        p("thermalLimit"),
        h("Voltage", "Напряжения"),
        p("cpuVcore"),
        info("Required Vcore", "Нужное напряжение ядра", `${requiredVcore(c).toFixed(3)} V`),
        p("llc"),
        p("dramVoltage"),
        info("Required DRAM Voltage", "Нужное напряжение DRAM", `${requiredDramV(c).toFixed(3)} V`),
        h("Memory", "Память"),
        p("xmp"),
        p("dramFreq"),
        sub("timing"),
      ];
    case "timing":
      return [
        info("Current Timings", "Текущие тайминги", r.timings),
        p("tCL"), p("tRCD"), p("tRP"), p("tRAS"),
        grey("Command Rate", "Command Rate", "Auto (1T)"),
        grey("tRFC", "tRFC", "Auto"),
        grey("Gear Down Mode", "Gear Down Mode", "Auto"),
      ];
    case "advanced":
      return [sub("cpu"), sub("memory"), sub("pci"), sub("usb"), sub("periph"), sub("nvme"), sub("power")];
    case "cpu":
      return [
        h("CPU Information", "Сведения о процессоре"),
        info("CPU Type", "Тип CPU", HW.cpu),
        info("Cores / Threads", "Ядра / потоки", `${HW.cores} / ${c.smt ? HW.threads : HW.cores}`),
        info("L2 / L3 Cache", "Кэш L2 / L3", `${HW.l2} / ${HW.l3}`),
        info("CPU Speed", "Частота CPU", `${r.freq} GHz`),
        info("CPU Core Voltage", "Напряжение ядра", `${r.vcore.toFixed(3)} V`, vcoreClass(r.vcore)),
        h("CPU Settings", "Настройки процессора"),
        p("smt"),
        p("virtualization"),
        p("cstate"),
        grey("NX Mode", "NX Mode", "Enabled"),
        grey("IOMMU", "IOMMU", c.virtualization ? "Enabled" : "Auto"),
      ];
    case "memory":
      return [
        h("Memory Information", "Сведения о памяти"),
        info("Total Memory", "Объём", `${HW.ramTotalMb} MB (DDR5, Dual Channel)`),
        info("DRAM Frequency", "Частота", `${r.dramFreq} MT/s`),
        info("DRAM Timings", "Тайминги", r.timings),
        info("DRAM Voltage", "Напряжение", `${r.dramV.toFixed(3)} V`),
        h("Memory Settings", "Настройки памяти"),
        p("memContext"),
        p("powerDown"),
        grey("DRAM Frequency Ratio", "Делитель частоты", "Auto"),
        grey("Memory Interleaving", "Чередование памяти", "Auto"),
      ];
    case "pci":
      return [p("above4g"), p("rebar"), p("pcieSpeed"), p("sriov"), grey("PCI Latency Timer", "PCI Latency Timer", "32 PCI Bus Clocks")];
    case "usb":
      return [
        info("USB Devices", "USB-устройства", c.usbStorage ? "1 Drive, 1 Keyboard, 1 Mouse" : "1 Keyboard, 1 Mouse"),
        p("legacyUsb"),
        p("xhciHandoff"),
        p("usbStorage"),
      ];
    case "periph":
      return [p("lanController"), p("lanRom"), p("hdAudio"), p("sataMode"), p("igpu"), grey("Onboard Wi-Fi", "Встроенный Wi-Fi", "Not Present")];
    case "nvme":
      return STORAGE.filter((d) => d.port.startsWith("M2")).flatMap((d): Item[] => [
        h(d.port, d.port),
        info("Device", "Устройство", d.device ?? "Not Present"),
        ...(d.device ? [info("Interface", "Интерфейс", "PCIe 4.0 x4"), info("Capacity", "Ёмкость", d.size ?? "—"), grey("Self-Test", "Самопроверка", "Passed")] : []),
      ]);
    case "power":
      return [p("erp"), p("acLoss"), p("wol")];
    case "boot":
      return [
        h("Boot Configuration", "Настройки загрузки"),
        p("fastBoot"),
        p("bootLogo"),
        p("numlock"),
        p("csm"),
        grey("Boot Mode", "Режим загрузки", c.csm ? "UEFI and Legacy" : "UEFI"),
        h("Boot Option Priorities", "Порядок загрузки"),
        ...(c.bootOrder as DeviceId[]).map((_, i): Item => ({ kind: "boot", index: i })),
        h("Boot Override", "Разовая загрузка"),
        ...DEVICE_IDS.map((dev): Item => ({ kind: "override", dev })),
      ];
    case "tool":
      return [
        h("Firmware", "Прошивка"),
        act("flash", "Kestrel Instant Flash", "Kestrel Instant Flash", "Update the BIOS from the USB drive. The PC restarts with the new version.", "Обновить BIOS с USB-накопителя. Компьютер перезагрузится с новой версией."),
        h("Overclocking", "Разгон"),
        sub("profiles"),
        sub("spd"),
        h("Sharing", "Обмен"),
        act("share", "Share Configuration Link", "Поделиться ссылкой на настройки", "Copies a link with your current settings (without password). Whoever opens it can apply them.", "Копирует ссылку с текущими настройками (без пароля). Открывший её сможет их применить."),
      ];
    case "profiles":
      return [
        info("Profiles keep", "Профиль хранит", "CPU, memory, voltages, fans"),
        ...Array.from({ length: SLOTS }, (_, i): Item => ({ kind: "profile", slot: i })),
      ];
    case "spd":
      return ["A2", "B2"].flatMap((slot): Item[] => [
        h(`DIMM_${slot}`, `DIMM_${slot}`),
        info("Module", "Модуль", HW.dimms[slot] ?? "Empty"),
        info("Manufacturer", "Производитель", "Kestrel Memory"),
        info("Part Number", "Номер детали", "KF560C30-16"),
        info("JEDEC", "JEDEC", "DDR5-4800  40-40-40-77  1.10 V"),
        info("XMP Profile 1", "XMP Profile 1", "DDR5-5600  36-36-36-76  1.25 V"),
        info("XMP Profile 2", "XMP Profile 2", "DDR5-6000  30-38-38-96  1.35 V"),
      ]);
    case "security":
      return [
        h("Passwords", "Пароли"),
        p("setupPassword"),
        grey("User Password", "Пароль пользователя", "Not Installed"),
        h("Platform Security", "Безопасность платформы"),
        sub("secureboot"),
        sub("tpm"),
      ];
    case "secureboot":
      return [
        info("System Mode", "Режим системы", "User"),
        info("Secure Boot State", "Состояние", c.secureBoot && !c.csm ? "Active" : "Not Active", c.secureBoot && !c.csm ? "ok" : "warn"),
        ...(c.csm ? [grey("Note", "Примечание", "Disable CSM to use Secure Boot")] : []),
        p("secureBoot"),
        p("secureBootMode"),
        sub("keys"),
      ];
    case "keys":
      return [
        grey("Platform Key (PK)", "Platform Key (PK)", "Installed"),
        grey("Key Exchange Keys (KEK)", "Key Exchange Keys (KEK)", "2 Keys"),
        grey("Authorized Signatures (db)", "Authorized Signatures (db)", "4 Keys"),
        grey("Forbidden Signatures (dbx)", "Forbidden Signatures (dbx)", "77 Keys"),
        grey("Factory Key Provision", "Factory Key Provision", "Enabled"),
      ];
    case "tpm":
      return [
        p("ftpm"),
        grey("TPM Spec Version", "Версия TPM", c.ftpm === "Disabled" ? "—" : "2.0"),
        grey("Firmware Version", "Версия прошивки", c.ftpm === "Disabled" ? "—" : "6.32.0.6"),
      ];
    case "monitor":
      return [
        { kind: "graph" },
        sub("qfan"),
        h("Temperatures", "Температуры"),
        info("CPU Temperature", "Температура CPU", `${r.temp.toFixed(1)} °C`, tempClass(r.temp)),
        info("Motherboard Temperature", "Температура платы", `${r.mbTemp.toFixed(1)} °C`, tempClass(r.mbTemp)),
        info("Throttle Limit", "Порог троттлинга", c.thermalLimit === "Auto" ? "92 °C (Auto)" : c.thermalLimit),
        h("Voltages", "Напряжения"),
        info("CPU Vcore", "CPU Vcore", `${r.vcore.toFixed(3)} V`, vcoreClass(r.vcore)),
        info("DRAM Voltage", "Напряжение DRAM", `${r.dramV.toFixed(3)} V`),
        info("+12V", "+12V", `${r.v12.toFixed(3)} V`),
        info("+5V", "+5V", `${r.v5.toFixed(3)} V`),
        info("+3.3V", "+3.3V", `${r.v33.toFixed(3)} V`),
        h("Fans", "Вентиляторы"),
        info("CPU_FAN", "CPU_FAN", `${r.rpm} RPM  (${r.duty.toFixed(0)} %)`),
        info("SYS_FAN1", "SYS_FAN1", `${r.sysRpm} RPM`),
        info("SYS_FAN2", "SYS_FAN2", `${Math.round(r.sysRpm * 0.96)} RPM`),
        grey("AIO_PUMP", "AIO_PUMP", "N/A"),
        info("Estimated Noise", "Уровень шума", `${r.noise.toFixed(1)} dB`, noiseClass(r.noise)),
      ];
    case "qfan":
      return [
        p("fanProfile"),
        { kind: "fan" },
        p("sysFanProfile"),
        p("fanFailWarn"),
      ];
    case "exit":
      return [
        h("Save Options", "Сохранение"),
        act("save", "Save Changes and Reset", "Сохранить и перезагрузить", "Save all changes and restart the system.", "Сохранить все изменения и перезагрузить систему."),
        act("discardExit", "Discard Changes and Exit", "Выйти без сохранения", "Exit Setup without saving. The last saved configuration will be used.", "Выйти без сохранения. Будет использована последняя сохранённая конфигурация."),
        act("discard", "Discard Changes", "Отменить изменения", "Revert unsaved changes and stay in Setup.", "Отменить несохранённые изменения и остаться в Setup."),
        act("defaults", "Load Optimized Defaults", "Заводские настройки", "Load optimized default values for all settings (until saved).", "Вернуть заводские значения всех параметров (до сохранения)."),
        h("Options", "Параметры"),
        p("biosLog"),
        act("clearCmos", "Clear CMOS", "Очистить CMOS", "Erase all saved settings and the Setup password, as if the CMOS battery was removed.", "Стереть все сохранённые настройки и пароль Setup, как если бы вынули батарейку CMOS."),
      ];
  }
  return [];
}

export const isSelectable = (it: Item) => ["param", "sub", "boot", "action", "override", "profile"].includes(it.kind);
