import { l, type L } from "./i18n";
import { DEVICES, HW, STORAGE, XMP, type DeviceId } from "./hardware";
import type { Config } from "./params";
import { equilibrium, stability } from "./sensors";

export interface BootLine { text: string; cls?: "err" | "hl" }
export interface BootFinal {
  type: "os" | "linux" | "error" | "ocfail";
  title: L;
  hint: L;
  /** сирена перегрева */
  alarm?: boolean;
  /** ОС стартует, но упадёт: не хватает напряжения ядра */
  unstable?: boolean;
}

/** Устройство видно прошивке при данной конфигурации? */
export function deviceAvailable(c: Config, dev: DeviceId): boolean {
  if (dev === "PXE") return c.lanController && c.lanRom;
  if (dev === "USB") return c.usbStorage;
  return true;
}

/** Сценарий POST и загрузки. `only` — разовая загрузка с одного устройства (Boot Menu / Boot Override). */
export function bootScript(c: Config, only?: DeviceId | null): { lines: BootLine[]; final: BootFinal } {
  const lines: BootLine[] = [];
  const L = (text: string, cls?: BootLine["cls"]) => lines.push({ text, cls });
  const temp = equilibrium(c);
  const freq = ((c.cpuRatio || HW.baseRatio) / 10).toFixed(2);

  L(`KESTREL UEFI BIOS ${HW.bios}`, "hl");
  L(`${HW.product}`);
  L(`CPU: ${HW.cpu} @ ${freq} GHz`);
  L(`Memory: ${HW.ramTotalMb} MB DDR5 @ ${XMP[c.xmp].freq} MT/s${c.xmp !== "Disabled" ? ` (XMP ${c.xmp})` : ""}`);
  if (!c.fastBoot) {
    if (c.xmp !== "Disabled" && c.memContext !== "Enabled" && stability(c).mem === "ok") L("Memory training ... OK");
    L(`SVM Mode: ${c.virtualization ? "Enabled" : "Disabled"}`);
    L(`SATA Mode: ${c.sataMode}`);
    L(`HD Audio Controller: ${c.hdAudio ? "Enabled" : "Disabled"}`);
    L(`TPM: ${c.ftpm}`);
    L("Detecting storage devices...");
    STORAGE.filter((d) => d.device && (d.port !== "USB" || c.usbStorage)).forEach((d) => L(`  ${d.port}: ${d.device}`));
  } else {
    L("Fast Boot: skipping device enumeration");
  }

  const stab = stability(c);
  if (stab.mem === "fail" || stab.cpu === "fail") {
    L("");
    L(stab.mem === "fail" ? "Memory training ... FAILED" : "CPU initialization ... FAILED", "err");
    return {
      lines,
      final: {
        type: "ocfail",
        title: l("Overclocking Failed!", "Ошибка разгона!"),
        hint: stab.mem === "fail"
          ? l("Memory could not be trained with the current XMP profile and DRAM voltage.", "Память не прошла тренировку с текущим профилем XMP и напряжением DRAM.")
          : l("The CPU could not start: CPU Core Voltage is far too low for the selected ratio.", "Процессор не запустился: напряжение ядра слишком мало для выбранного множителя."),
      },
    };
  }

  if (temp >= 95) {
    L("");
    L(`CPU Over Temperature Error! (${temp.toFixed(0)} °C)`, "err");
    L("System halted to protect the processor.", "err");
    return {
      lines,
      final: {
        type: "error",
        alarm: true,
        title: l("CPU Over Temperature", "Перегрев процессора"),
        hint: l("Lower the CPU Ratio or use a stronger fan curve.", "Снизьте множитель CPU или выберите более мощную кривую вентилятора."),
      },
    };
  }

  L("");
  const order = only ? [only] : (c.bootOrder as DeviceId[]);
  for (const dev of order) {
    if (!deviceAvailable(c, dev)) continue;
    L(`Booting from ${DEVICES[dev].name}...`);
    if (dev === "OS") {
      if (c.sataMode === "RAID") {
        L("  Kestrel OS: boot device is not accessible.", "err");
        return {
          lines,
          final: {
            type: "error",
            title: l("INACCESSIBLE_BOOT_DEVICE", "INACCESSIBLE_BOOT_DEVICE"),
            hint: l("The storage controller is in RAID mode, but the OS was installed in AHCI. Switch back to AHCI.",
              "Контроллер накопителей в режиме RAID, а ОС установлена в AHCI. Верните AHCI."),
          },
        };
      }
      L("  Kestrel OS Boot Manager found. Signature: valid");
      return {
        lines,
        final: {
          type: "os",
          unstable: stab.cpu === "unstable",
          title: l("Starting Kestrel OS", "Запуск Kestrel OS"),
          hint: l(
            `${c.virtualization ? "Virtualization on: VMs available." : "Virtualization off: VMs will not start."} ${c.hdAudio ? "Audio works." : "No audio: HD Audio disabled."}`,
            `${c.virtualization ? "Виртуализация включена: VM доступны." : "Виртуализация выключена: VM не запустятся."} ${c.hdAudio ? "Звук работает." : "Звука нет: HD Audio выключен."}`
          ),
        },
      };
    }
    if (dev === "HDD") L("  No bootable partition found.", "err");
    if (dev === "DVD") L("  No media in drive.", "err");
    if (dev === "PXE") {
      L("  PXE-E16: No offer received.", "err");
      L("  PXE-M0F: Exiting PXE ROM.", "err");
    }
    if (dev === "USB") {
      if (c.secureBoot) {
        L("  Secure Boot Violation: Invalid signature detected.", "err");
        return {
          lines,
          final: {
            type: "error",
            title: l("Secure Boot Violation", "Нарушение Secure Boot"),
            hint: l("The USB boot loader is not signed. Disable Secure Boot or move the USB drive down in Boot Priority.",
              "Загрузчик на флешке не подписан. Отключите Secure Boot или опустите флешку ниже в порядке загрузки."),
          },
        };
      }
      L("  GRUB loader found.");
      return {
        lines,
        final: {
          type: "linux",
          title: l("Live Linux — Try or Install", "Live Linux — Try or Install"),
          hint: l("Booted from the USB drive. Secure Boot is off.", "Загрузка с флешки. Secure Boot выключен."),
        },
      };
    }
  }
  return {
    lines,
    final: {
      type: "error",
      title: l("Reboot and Select proper Boot device", "Reboot and Select proper Boot device"),
      hint: l("No device in Boot Priority could boot.", "Ни одно устройство в порядке загрузки не загрузилось."),
    },
  };
}
