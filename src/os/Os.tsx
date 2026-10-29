import { useEffect, useState, type CSSProperties } from "react";
// общие стили первыми: стили приложений (apps/*.css) подключаются после и уточняют их
import "./os.css";
import { useOs } from "./osStore";
import { Crash, Leaving, LockScreen, Splash } from "./Screens";
import { Desktop } from "./Desktop";
import { wallpaperOf } from "./wallpapers";

export function Os() {
  const stage = useOs((s) => s.stage);
  const sleeping = useOs((s) => s.sleeping);

  // сон: любое касание будит компьютер — на экран блокировки
  useEffect(() => {
    if (!sleeping) return;
    const wake = () => useOs.setState({ sleeping: false, stage: useOs.getState().stage === "desktop" ? "lock" : useOs.getState().stage });
    const id = window.setTimeout(() => {
      window.addEventListener("keydown", wake, { once: true });
      window.addEventListener("pointerdown", wake, { once: true });
    }, 600);
    return () => { clearTimeout(id); window.removeEventListener("keydown", wake); window.removeEventListener("pointerdown", wake); };
  }, [sleeping]);
  const wp = wallpaperOf(useOs((s) => s.prefs.wallpaper));
  const lite = useLite();
  const calm = useReducedMotion();
  // акцент и оттенок стекла берутся из обоев и расходятся по всему интерфейсу через CSS-переменные
  const tokens = { "--accent": wp.accent, "--glass": wp.glass } as CSSProperties;

  return (
    <div className={"os" + (lite ? " lite" : "") + (calm ? " calm" : "")} style={tokens}>
      {stage === "splash" && <Splash />}
      {stage === "lock" && <LockScreen />}
      {stage === "desktop" && <Desktop />}
      {stage === "crash" && <Crash />}
      {stage === "leaving" && <Leaving />}
      {sleeping && <div className="sleep-screen" />}
    </div>
  );
}

/** Слабое или сенсорное устройство: мало ядер, мало памяти или телефон. */
export function weakDevice() {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const touch = navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) < 820;
  return cores <= 4 || mem <= 4 || touch;
}

/** Облегчённый режим (без размытия): вручную в Настройках или автоматически на слабых устройствах. */
export function useLite() {
  const mode = useOs((s) => s.prefs.lite);
  const [weak] = useState(weakDevice);
  return mode === "on" || (mode === "auto" && weak);
}

/** Системная настройка «уменьшить движение». */
export function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [on, setOn] = useState(() => typeof matchMedia !== "undefined" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const m = matchMedia(query);
    const fn = () => setOn(m.matches);
    m.addEventListener?.("change", fn);
    return () => m.removeEventListener?.("change", fn);
  }, []);
  return on;
}
