import { useEffect, useRef, useState } from "react";
import { useStore } from "../../machine/store";
import { DEVICES, HW, type DeviceId } from "../../machine/hardware";
import { cpuGhz, memOf } from "../../machine/sensors";
import { deviceAvailable } from "../../machine/boot";
import { sound } from "../../machine/audio";

/** Вход в Setup: если в BIOS задан пароль администратора — сначала спросить его. */
export function guardedSetup(onCancel: () => void = () => useStore.getState().boot()) {
  const s = useStore.getState();
  const secret = s.saved.setupPassword as string;
  if (!secret) return s.enterSetup();
  let tries = 0;
  const ru = s.saved.language === "Русский";
  s.openDialog({
    title: ru ? "Введите пароль" : "Enter Password",
    password: {
      hint: ru ? "Пароль администратора BIOS. Esc — отмена" : "BIOS administrator password. Esc to cancel",
      onSubmit: (v) => {
        if (v === secret) { useStore.getState().enterSetup(); return true; }
        // после трёх неверных попыток система просто продолжает загрузку
        if (++tries >= 3) { onCancel(); return true; }
        return false;
      },
      onCancel,
    },
  });
}

/** Экран включения: логотип, DEL — Setup, F11 — Boot Menu. Если ничего не нажать — загрузка. */
export function Post() {
  const saved = useStore((s) => s.saved);
  // «Restart to UEFI» из ОС: сразу в Setup
  const toSetup = useStore((s) => s.toSetup);
  const [stage, setStage] = useState<"splash" | "entering" | "menu">(toSetup ? "entering" : "splash");
  const [msg, setMsg] = useState(toSetup ? "Entering Setup..." : "");
  const [focus, setFocus] = useState(0);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!toSetup) return;
    const id = window.setTimeout(() => {
      useStore.getState().patch({ toSetup: false });
      guardedSetup();
    }, 1400);
    return () => clearTimeout(id);
  }, [toSetup]);

  // инициализация дисков и один короткий бип — POST пройден
  useEffect(() => {
    const ids = [
      window.setTimeout(() => sound.hddSeek(4), 250),
      window.setTimeout(() => sound.beep(), saved.fastBoot ? 200 : 700),
    ];
    return () => ids.forEach(clearTimeout);
  }, []);

  // окно, в которое можно успеть нажать DEL
  useEffect(() => {
    if (stage !== "splash") return;
    const id = window.setTimeout(() => useStore.getState().boot(), saved.fastBoot ? 1500 : 4000);
    return () => clearTimeout(id);
  }, [stage, saved.fastBoot]);

  const devices = (saved.bootOrder as DeviceId[]).filter((d) => deviceAvailable(saved, d));
  const menu = [
    ...devices.map((d) => ({ label: DEVICES[d].name, run: () => useStore.getState().boot(d) })),
    { label: "Enter Setup", run: () => guardedSetup() },
  ];

  const enterSetup = () => {
    if (stage !== "splash") return;
    setStage("entering");
    setMsg("Entering Setup...");
    later(() => guardedSetup(), 900);
  };
  const enterMenu = () => {
    if (stage !== "splash") return;
    setStage("entering");
    setMsg("Entering Boot Menu...");
    later(() => setStage("menu"), 700);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage === "splash") {
        if (e.key === "Delete") { e.preventDefault(); enterSetup(); }
        if (e.key === "F11") { e.preventDefault(); enterMenu(); }
      }
      if (stage === "menu") {
        e.preventDefault();
        if (e.key === "ArrowDown") setFocus((f) => (f + 1) % menu.length);
        if (e.key === "ArrowUp") setFocus((f) => (f - 1 + menu.length) % menu.length);
        if (e.key === "Enter") menu[focus].run();
        if (e.key === "Escape") useStore.getState().boot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="post">
      {saved.bootLogo ? (
        <div className="post-logo">
          <div className="pl-mark" />
          <div className="pl-text">KESTREL</div>
          <div className="pl-sub">NIGHTFALL SERIES</div>
        </div>
      ) : (
        <pre className="post-text">
{`Kestrel UEFI BIOS ${HW.bios}  (${HW.buildDate})
${HW.product}

CPU : ${HW.cpu}
      Speed: ${cpuGhz(saved).toFixed(2)} GHz
DRAM: ${HW.ramTotalMb} MB DDR5 @ ${memOf(saved).freq} MT/s

Initializing USB controllers .. Done.
${saved.usbStorage ? "1 Drive, " : ""}1 Keyboard, 1 Mouse`}
        </pre>
      )}

      <div className="post-bottom">
        <span onClick={enterSetup}>Press <b>DEL</b> key to enter Setup</span>
        <span onClick={enterMenu}>Press <b>F11</b> key to enter Boot Menu</span>
      </div>

      {stage === "entering" && <div className="post-msg">{msg}</div>}

      {stage === "menu" && (
        <div className="bootmenu">
          <div className="bm-title">Please select boot device:</div>
          <div className="bm-list">
            {menu.map((m, i) => (
              <div key={i} className={"bm-item" + (i === focus ? " focus" : "")} onMouseEnter={() => setFocus(i)} onClick={m.run}>
                {m.label}
              </div>
            ))}
          </div>
          <div className="bm-help">↑ and ↓ to move selection<br />ENTER to select boot device<br />ESC to boot using defaults</div>
        </div>
      )}
    </div>
  );
}
