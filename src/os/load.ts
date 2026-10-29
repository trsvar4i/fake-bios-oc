// Нагрузка на процессор от системы: открытые программы, нагрузочный тест, режим питания.
// Модель машины по ней греет процессор, раскручивает вентиляторы и сбрасывает частоту при перегреве.
import { useEffect, useRef } from "react";
import { useStore, useLang } from "../machine/store";
import { readings } from "../machine/sensors";
import { useOs } from "./osStore";
import { APP_META } from "./apps/meta";

/** Загрузка, к которой стремится процессор: фон системы + окна + нагрузочный тест. */
export function targetLoad(): number {
  const os = useOs.getState();
  let load = 0.06;
  for (const w of os.windows) {
    if (w.phase === "closing") continue;
    const k = APP_META[w.app]?.load ?? 0.03;
    load += w.min ? k * 0.3 : k;
  }
  if (os.stressUntil > Date.now()) load = 1;
  return Math.min(1, load);
}

export function useLoadService() {
  const { t } = useLang();
  const power = useOs((s) => s.prefs.power);
  const lastWarn = useRef(0);
  const wasHot = useRef(false);

  useEffect(() => { useStore.setState({ power }); }, [power]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = useStore.getState();
      // плавно, с небольшим «дыханием», как у настоящей загрузки
      const next = s.load + (targetLoad() - s.load) * 0.35 + (Math.random() - 0.5) * 0.02;
      useStore.setState({ load: Math.min(1, Math.max(0.02, next)) });
      const hot = readings(s.saved, s.thermal, s).throttled;
      if (hot && !wasHot.current && Date.now() - lastWarn.current > 60_000) {
        lastWarn.current = Date.now();
        useOs.getState().notify("taskmgr", t("CPU is overheating", "Процессор перегревается"),
          t("Clock speed lowered to cool down. Check the fans in BIOS.", "Частота снижена, чтобы остыть. Проверьте вентиляторы в BIOS."));
      }
      wasHot.current = hot;
    }, 1000);
    // вне системы — обычная нагрузка BIOS
    return () => { clearInterval(id); useStore.setState({ load: 0.35, power: "balanced" }); };
  }, []);
}
