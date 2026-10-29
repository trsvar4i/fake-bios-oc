// Фейковое железо. Только чтение.
import { unlock } from "./quests";

const FW_KEY = "kestrel.fw";
/** Доступное обновление прошивки (ставится из «Системных настроек» ОС). */
export const FW_LATEST = { bios: "E7E26KS.220", buildDate: "10/22/2026" };
const FW_FACTORY = { bios: "E7E26KS.214", buildDate: "07/12/2026" };

function firmware(): { bios: string; buildDate: string } {
  try { return JSON.parse(localStorage.getItem(FW_KEY) ?? "null") ?? FW_FACTORY; } catch { return FW_FACTORY; }
}
/** Записать новую прошивку (её увидят POST, Setup и ОС после перезагрузки). */
export function flashFirmware(v: { bios: string; buildDate: string }) {
  try { localStorage.setItem(FW_KEY, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
  unlock("flash");
}

export const HW = {
  product: "Kestrel B650 Nightfall (KS-7E26)",
  get bios() { return firmware().bios; },
  get buildDate() { return firmware().buildDate; },
  cpu: "AMD Ryzen 7 7700X 8-Core Processor",
  cores: 8,
  threads: 16,
  bclk: 100,
  baseRatio: 45, // 4.5 GHz
  l2: "8 MB",
  l3: "32 MB",
  ramTotalMb: 32768,
  dimms: { A1: null, A2: "16 GB DDR5 Kestrel Fury", B1: null, B2: "16 GB DDR5 Kestrel Fury" } as Record<string, string | null>,
};

export const STORAGE: { port: string; device: string | null; size?: string; note?: string }[] = [
  { port: "M2_1", device: "Kestrel NV2 1TB NVMe (PCIe 4.0 x4)", size: "1000 GB", note: "Kestrel OS" },
  { port: "M2_2", device: null },
  { port: "SATA1", device: "DataVault HDD 2TB (7200 RPM)", size: "2000 GB", note: "Data" },
  { port: "SATA2", device: null },
  { port: "SATA3", device: "OptiDisc DVD-RW", size: "—", note: "No media" },
  { port: "SATA4", device: null },
  { port: "USB", device: "USB Flash Drive 32GB", size: "32 GB", note: "Live Linux" },
];

export type DeviceId = "OS" | "HDD" | "DVD" | "USB" | "PXE";
export const DEVICE_IDS: DeviceId[] = ["OS", "HDD", "DVD", "USB", "PXE"];

export const DEVICES: Record<DeviceId, { name: string; short: string; icon: string }> = {
  OS: { name: "Kestrel OS Boot Manager (M2_1: Kestrel NV2 1TB)", short: "Kestrel OS", icon: "nvme" },
  HDD: { name: "SATA1: DataVault HDD 2TB", short: "SATA HDD", icon: "hdd" },
  DVD: { name: "SATA3: OptiDisc DVD-RW", short: "DVD-RW", icon: "dvd" },
  USB: { name: "UEFI USB: Flash Drive 32GB (Live Linux)", short: "USB Flash", icon: "usb" },
  PXE: { name: "UEFI Network: PXE IPv4 Ethernet", short: "PXE Network", icon: "lan" },
};

export const XMP: Record<string, { freq: number; volt: number; timings: string; heat: number }> = {
  "Disabled":  { freq: 4800, volt: 1.10, timings: "40-40-40-77", heat: 0 },
  "Profile 1": { freq: 5600, volt: 1.25, timings: "36-36-36-76", heat: 1 },
  "Profile 2": { freq: 6000, volt: 1.35, timings: "30-38-38-96", heat: 2 },
};

export type Curve = [number, number][]; // [температура °C, скважность %]

export const FAN_PRESETS: Record<string, Curve> = {
  "Silent":      [[30, 20], [60, 30], [75, 55], [90, 100]],
  "Standard":    [[30, 30], [50, 40], [70, 70], [85, 100]],
  "Performance": [[30, 45], [50, 60], [65, 85], [80, 100]],
  "Full Speed":  [[30, 100], [50, 100], [70, 100], [85, 100]],
};
