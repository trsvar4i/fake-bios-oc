// Дерево страниц Advanced Mode.
import { l, type L } from "../machine/i18n";
import { DEVICE_IDS, HW, type DeviceId } from "../machine/hardware";
import type { Config } from "../machine/params";
import { requiredVcore, tempClass, noiseClass, vcoreClass, type Readings } from "../machine/sensors";
import type { ActionId } from "./actions";

export type Item =
  | { kind: "header"; label: L }
  | { kind: "info"; label: L; value: string; cls?: string; grey?: boolean }
  | { kind: "param"; id: string }
  | { kind: "sub"; page: string; label: L }
  | { kind: "boot"; index: number }
  | { kind: "action"; id: ActionId; label: L; help: L }
  | { kind: "override"; dev: DeviceId }
  | { kind: "fan" };

export const TABS: { id: string; title: L }[] = [
  { id: "main", title: l("Main", "Главная") },
  { id: "advanced", title: l("Advanced", "Расширенные") },
  { id: "boot", title: l("Boot", "Загрузка") },
  { id: "security", title: l("Security", "Безопасность") },
  { id: "monitor", title: l("Monitor", "Мониторинг") },
  { id: "exit", title: l("Save & Exit", "Сохранение и выход") },
];

export const PAGE_TITLES: Record<string, L> = {
  ...Object.fromEntries(TABS.map((t) => [t.id, t.title])),
  cpu: l("CPU Configuration", "Настройки процессора"),
  memory: l("Memory Configuration", "Настройки памяти"),
  pci: l("PCI Subsystem Settings", "Подсистема PCI"),
  usb: l("USB Configuration", "Настройки USB"),
  periph: l("Integrated Peripherals", "Встроенные устройства"),
  power: l("Power Management Setup", "Управление питанием"),
  secureboot: l("Secure Boot", "Безопасная загрузка"),
  keys: l("Key Management", "Управление ключами"),
  tpm: l("Trusted Computing", "Доверенные вычисления"),
};

const h = (en: string, ru: string): Item => ({ kind: "header", label: l(en, ru) });
const info = (en: string, ru: string, value: string, cls?: string): Item => ({ kind: "info", label: l(en, ru), value, cls });
const grey = (en: string, ru: string, value: string): Item => ({ kind: "info", label: l(en, ru), value, grey: true });
const p = (id: string): Item => ({ kind: "param", id });
const sub = (page: string): Item => ({ kind: "sub", page, label: PAGE_TITLES[page] });

export function pageItems(page: string, c: Config, r: Readings): Item[] {
  const now = new Date();
  switch (page) {
    case "main":
      return [
        h("System Information", "Сведения о системе"),
        info("BIOS Version", "Версия BIOS", HW.bios),
        info("BIOS Build Date", "Дата сборки BIOS", HW.buildDate),
        info("Product", "Плата", HW.product),
        info("Processor", "Процессор", HW.cpu),
        info("CPU Speed", "Частота CPU", `${r.freq} GHz`),
        info("Total Memory", "Объём памяти", `${HW.ramTotalMb} MB`),
        info("Memory Speed", "Частота памяти", `${r.dramFreq} MT/s`),
        h("System Settings", "Системные настройки"),
        info("System Date", "Системная дата", now.toLocaleDateString("en-GB")),
        info("System Time", "Системное время", now.toLocaleTimeString("en-GB")),
        p("language"),
        grey("Access Level", "Уровень доступа", "Administrator"),
      ];
    case "advanced":
      return [sub("cpu"), sub("memory"), sub("pci"), sub("usb"), sub("periph"), sub("power")];
    case "cpu":
      return [
        h("CPU Information", "Сведения о процессоре"),
        info("CPU Type", "Тип CPU", HW.cpu),
        info("Cores / Threads", "Ядра / потоки", `${HW.cores} / ${c.smt ? HW.threads : HW.cores}`),
        info("L2 / L3 Cache", "Кэш L2 / L3", `${HW.l2} / ${HW.l3}`),
        info("CPU Speed", "Частота CPU", `${r.freq} GHz`),
        info("CPU Core Voltage", "Напряжение ядра", `${r.vcore.toFixed(3)} V`, vcoreClass(r.vcore)),
        h("CPU Settings", "Настройки процессора"),
        p("cpuRatio"),
        p("cpuVcore"),
        info("Required Vcore for Ratio", "Нужное напряжение", `${requiredVcore(c).toFixed(3)} V`),
        p("cpb"),
        p("smt"),
        p("virtualization"),
        p("cstate"),
        grey("NX Mode", "NX Mode", "Enabled"),
        grey("IOMMU", "IOMMU", "Auto"),
      ];
    case "memory":
      return [
        h("Memory Information", "Сведения о памяти"),
        info("Total Memory", "Объём", `${HW.ramTotalMb} MB (DDR5, Dual Channel)`),
        info("DRAM Frequency", "Частота", `${r.dramFreq} MT/s`),
        info("DRAM Timings", "Тайминги", r.timings),
        info("DRAM Voltage", "Напряжение", `${r.dramV.toFixed(3)} V`),
        h("Memory Settings", "Настройки памяти"),
        p("xmp"),
        p("dramVoltage"),
        p("memContext"),
        p("powerDown"),
        grey("DRAM Frequency Ratio", "Делитель частоты", "Auto"),
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
    case "power":
      return [p("erp"), p("acLoss"), p("wol")];
    case "boot":
      return [
        h("Boot Configuration", "Настройки загрузки"),
        p("fastBoot"),
        p("bootLogo"),
        p("numlock"),
        grey("Boot Mode", "Режим загрузки", "UEFI"),
        h("Boot Option Priorities", "Порядок загрузки"),
        ...(c.bootOrder as DeviceId[]).map((_, i): Item => ({ kind: "boot", index: i })),
      ];
    case "security":
      return [
        sub("secureboot"),
        sub("tpm"),
        h("Passwords", "Пароли"),
        grey("Administrator Password", "Пароль администратора", "Not Installed"),
        grey("User Password", "Пароль пользователя", "Not Installed"),
      ];
    case "secureboot":
      return [
        info("System Mode", "Режим системы", "User"),
        info("Secure Boot State", "Состояние", c.secureBoot ? "Active" : "Not Active", c.secureBoot ? "ok" : "warn"),
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
        h("Temperatures", "Температуры"),
        info("CPU Temperature", "Температура CPU", `${r.temp.toFixed(1)} °C`, tempClass(r.temp)),
        info("Motherboard Temperature", "Температура платы", `${r.mbTemp.toFixed(1)} °C`, tempClass(r.mbTemp)),
        h("Voltages", "Напряжения"),
        info("CPU Vcore", "CPU Vcore", `${r.vcore.toFixed(3)} V`, vcoreClass(r.vcore)),
        info("DRAM Voltage", "Напряжение DRAM", `${r.dramV.toFixed(3)} V`),
        info("+12V", "+12V", `${r.v12.toFixed(2)} V`),
        info("+5V", "+5V", `${r.v5.toFixed(2)} V`),
        info("+3.3V", "+3.3V", `${r.v33.toFixed(2)} V`),
        h("CPU Fan Control", "Управление вентилятором CPU"),
        p("fanProfile"),
        { kind: "fan" },
        p("fanFailWarn"),
        info("CPU_FAN1", "CPU_FAN1", `${r.rpm} RPM  (${r.duty.toFixed(0)} %)`),
        info("SYS_FAN1", "SYS_FAN1", `${r.sysRpm} RPM`),
        info("Estimated Noise", "Уровень шума", `${r.noise.toFixed(1)} dB`, noiseClass(r.noise)),
      ];
    case "exit":
      return [
        h("Save Options", "Сохранение"),
        { kind: "action", id: "save", label: l("Save Changes and Reset", "Сохранить и перезагрузить"), help: l("Save all changes and restart the system.", "Сохранить все изменения и перезагрузить систему.") },
        { kind: "action", id: "discardExit", label: l("Discard Changes and Exit", "Выйти без сохранения"), help: l("Exit Setup without saving. The last saved configuration will be used.", "Выйти без сохранения. Будет использована последняя сохранённая конфигурация.") },
        { kind: "action", id: "discard", label: l("Discard Changes", "Отменить изменения"), help: l("Revert unsaved changes and stay in Setup.", "Отменить несохранённые изменения и остаться в Setup.") },
        { kind: "action", id: "defaults", label: l("Restore Defaults", "Заводские настройки"), help: l("Load optimized default values for all settings (until saved).", "Вернуть заводские значения всех параметров (до сохранения).") },
        h("Boot Override", "Разовая загрузка"),
        ...DEVICE_IDS.map((dev): Item => ({ kind: "override", dev })),
        h("Options", "Параметры"),
        p("biosLog"),
        { kind: "action", id: "clearCmos", label: l("Clear CMOS", "Очистить CMOS"), help: l("Erase all saved settings, as if the CMOS battery was removed.", "Стереть все сохранённые настройки, как если бы вынули батарейку CMOS.") },
      ];
  }
  return [];
}

export const isSelectable = (it: Item) => ["param", "sub", "boot", "action", "override"].includes(it.kind);
