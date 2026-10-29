import { useEffect, useState } from "react";
import { useOs } from "./osStore";
import { useLang } from "../machine/store";

/** Часы и минуты с учётом языка и 12/24-часового формата из настроек. */
export function useTimeFormat() {
  const { lang } = useLang();
  const hour12 = useOs((s) => s.prefs.hour12);
  return (d: Date, timeZone?: string) =>
    // 12-часовой формат с AM/PM как в en-US; 24-часовой — по языку системы
    d.toLocaleTimeString(hour12 ? "en-US" : lang === "ru" ? "ru-RU" : "en-GB", { hour: hour12 ? "numeric" : "2-digit", minute: "2-digit", hour12, timeZone });
}

/** Масштаб сцены 1920×1080 и её смещение на экране — для перевода координат мыши. */
export function stageScale() {
  const el = document.querySelector(".stage") as HTMLElement;
  const r = el.getBoundingClientRect();
  return { k: r.width / 1920, left: r.left, top: r.top };
}

/** Текущее время, обновляется раз в секунду. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Монтирование с анимацией ухода: после закрытия элемент ещё `ms` живёт с флагом closing,
 * чтобы успела проиграться CSS-анимация исчезновения.
 */
export function usePresence(open: boolean, ms = 200): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    const id = window.setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(id);
  }, [open, ms]);
  return { mounted: open || mounted, closing: !open && mounted };
}
