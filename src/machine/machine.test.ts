// Тесты модели машины: новые настройки BIOS действительно меняют исход загрузки.
import { describe, expect, it } from "vitest";
import { defaults } from "./params";
import { bootScript } from "./boot";
import { cpuGhz, memOf, requiredVcore, stability } from "./sensors";
import { parseShared } from "./profiles";

const cfg = (p: Record<string, unknown>) => ({ ...defaults(), ...p });

describe("BIOS → загрузка", () => {
  it("заводские настройки грузят Kestrel OS", () => {
    expect(bootScript(defaults()).final.type).toBe("os");
  });

  it("CSM отключает Secure Boot: флешка с Linux загружается", () => {
    const usbFirst = ["USB", "OS", "DVD", "HDD", "PXE"];
    expect(bootScript(cfg({ bootOrder: usbFirst })).final.title.en).toBe("Secure Boot Violation");
    expect(bootScript(cfg({ bootOrder: usbFirst, csm: true })).final.type).toBe("linux");
  });

  it("BCLK поднимает частоту, а LLC спасает чуть недостающее напряжение", () => {
    expect(cpuGhz(cfg({ bclk: 10200 }))).toBeCloseTo(4.59, 2);
    const c = cfg({ cpuRatio: 52 });
    const short = Math.round((requiredVcore(c) - 0.015) * 1000);
    expect(stability({ ...c, cpuVcore: short }).cpu).toBe("unstable");
    expect(stability({ ...c, cpuVcore: short, llc: "Level 3" }).cpu).toBe("ok");
  });

  it("слишком плотные тайминги без напряжения DRAM проваливают тренировку памяти", () => {
    const tight = cfg({ dramFreq: "DDR5-6400", tCL: 28 });
    expect(memOf(tight).freq).toBe(6400);
    expect(bootScript(tight).final.type).toBe("ocfail");
    expect(bootScript({ ...tight, dramVoltage: 1500 }).final.type).toBe("os");
  });

  it("BCLK выше 103 МГц роняет систему после загрузки", () => {
    expect(bootScript(cfg({ bclk: 10350 })).final.unstable).toBe(true);
  });
});

describe("ссылка на конфигурацию", () => {
  it("берёт только известные параметры допустимых значений и не трогает пароль", () => {
    const raw = { cpuRatio: 50, xmp: "Profile 9", setupPassword: "x", foo: 1, csm: true };
    const hash = "#cfg=" + btoa(JSON.stringify(raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(parseShared(hash)).toEqual({ cpuRatio: 50, csm: true });
  });
});
