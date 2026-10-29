import { useEffect, useState } from "react";

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
