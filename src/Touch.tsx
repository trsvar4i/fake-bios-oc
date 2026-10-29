// Телефоны и планшеты: подсказка повернуть экран, долгое нажатие вместо правой кнопки,
// экранные клавиши для POST и BIOS (DEL, F11, F7, F10, Esc), полноэкранный режим.
import { useEffect, useState } from "react";
import { useStore, useLang } from "./machine/store";

export const isTouch = () => typeof window !== "undefined" && (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

/** Долгое нажатие пальцем (0,5 с без сдвига) открывает контекстное меню, как правая кнопка мыши. */
export function useLongPress() {
  useEffect(() => {
    let timer: number | null = null;
    let start: { x: number; y: number; target: EventTarget | null } | null = null;
    const cancel = () => { if (timer !== null) clearTimeout(timer); timer = null; start = null; };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      start = { x: e.clientX, y: e.clientY, target: e.target };
      timer = window.setTimeout(() => {
        if (!start?.target) return;
        start.target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: start.x, clientY: start.y }));
        navigator.vibrate?.(15);
        cancel();
      }, 500);
    };
    const move = (e: PointerEvent) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel(); };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", cancel, true);
    window.addEventListener("pointercancel", cancel, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", cancel, true);
      window.removeEventListener("pointercancel", cancel, true);
    };
  }, []);
}

const press = (key: string) => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, code: key.startsWith("F") ? key : key === "Delete" ? "Delete" : key, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
};

const fullscreen = () => {
  const el = document.documentElement;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el.requestFullscreen?.().then(() => (screen.orientation as any)?.lock?.("landscape").catch(() => {}));
};

/** Слой поверх сцены на сенсорных экранах. */
export function TouchLayer() {
  const { t } = useLang();
  const phase = useStore((s) => s.phase);
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useLongPress();
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  if (!isTouch()) return null;

  // клавиши, без которых на телефоне не попасть в BIOS и не управлять им
  const keys: [string, string][] =
    phase === "post" ? [["Delete", "DEL · Setup"], ["F11", "F11 · Boot"]]
      : phase === "setup" ? [["F7", "F7"], ["Escape", "Esc"], ["F10", t("F10 · Save", "F10 · Сохр.")], ["Enter", "Enter"]]
        : phase === "boot" ? [["Delete", "DEL"], ["F1", "F1"], ["F2", "F2"]]
          : [];

  return (
    <>
      {portrait && !dismissed && (
        <div className="rotate-hint">
          <div className="rotate-phone" />
          <p>{t("Turn your phone sideways — the PC screen is wide.", "Поверните телефон — экран компьютера широкий.")}</p>
          <button onClick={() => { setDismissed(true); fullscreen(); }}>{t("Full screen", "На весь экран")}</button>
          <button className="ghost" onClick={() => setDismissed(true)}>{t("Continue anyway", "Всё равно продолжить")}</button>
        </div>
      )}
      <div className="touch-bar">
        {keys.map(([k, label]) => <button key={k} onClick={() => press(k)}>{label}</button>)}
        <button className="touch-fs" onClick={fullscreen} aria-label="Full screen">⛶</button>
      </div>
    </>
  );
}
