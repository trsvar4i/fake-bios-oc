import { useEffect, type CSSProperties } from "react";
import { useOs } from "./osStore";
import { Crash, Leaving, LockScreen, Splash } from "./Screens";
import { Desktop } from "./Desktop";
import { wallpaperOf } from "./wallpapers";
import "./os.css";

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
  // акцент и оттенок стекла берутся из обоев и расходятся по всему интерфейсу через CSS-переменные
  const tokens = { "--accent": wp.accent, "--glass": wp.glass } as CSSProperties;

  return (
    <div className="os" style={tokens}>
      {stage === "splash" && <Splash />}
      {stage === "lock" && <LockScreen />}
      {stage === "desktop" && <Desktop />}
      {stage === "crash" && <Crash />}
      {stage === "leaving" && <Leaving />}
      {sleeping && <div className="sleep-screen" />}
    </div>
  );
}
