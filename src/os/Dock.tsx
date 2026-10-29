// Док (как в macOS): увеличение иконок под курсором, подпись, точка у запущенных, отскок при запуске.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../machine/store";
import { useOs } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon } from "./AppIcon";
import { stageScale } from "./util";

const BASE = 72;
const MAX = 124;
/** на каком расстоянии от курсора иконки ещё увеличиваются */
const RANGE = 230;

const GAP = 6;
/** разделитель перед последней иконкой: линия и отступы */
const SEP = 21;
const DOCK_APPS = ["thispc", "launchpad", "terminal", "notes", "taskmgr", "vm", "settings"];

/** Центр иконки в неувеличенном доке: увеличение считается от него, чтобы иконки не «дрожали». */
function baseCenter(i: number) {
  const n = DOCK_APPS.length;
  const w = n * BASE + (n - 1) * GAP + SEP;
  return 960 - w / 2 + i * (BASE + GAP) + BASE / 2 + (i === n - 1 ? SEP : 0);
}

export function Dock() {
  const os = useOs();
  const { lang } = useLang();
  const [mx, setMx] = useState<number | null>(null);
  const [bounce, setBounce] = useState<Record<string, number>>({});
  const prev = useRef<Record<string, number> | null>(null);

  // запуск приложения: иконка подпрыгивает
  useEffect(() => {
    const counts: Record<string, number> = {};
    os.windows.forEach((w) => { counts[w.app] = (counts[w.app] ?? 0) + 1; });
    const before = prev.current;
    if (before) for (const app of Object.keys(counts)) {
      if (counts[app] > (before[app] ?? 0)) setBounce((b) => ({ ...b, [app]: (b[app] ?? 0) + 1 }));
    }
    prev.current = counts;
  }, [os.windows.length]);

  const size = (i: number) => {
    if (mx === null) return BASE;
    const d = Math.abs(mx - baseCenter(i));
    if (d > RANGE) return BASE;
    return BASE + (MAX - BASE) * (Math.cos((d / RANGE) * Math.PI) + 1) / 2;
  };

  const title = (app: string) => (app === "launchpad" ? "Launchpad" : APP_META[app].title[lang]);
  const click = (app: string) => {
    if (app === "launchpad") return os.setPanel("launchpad");
    const ws = os.windows.filter((w) => w.app === app && w.phase !== "closing");
    if (!ws.length) return os.open(app);
    // свёрнутое окно возвращается из дока, иначе приложение выходит на передний план
    const target = ws.find((w) => w.min) ?? ws.sort((a, b) => b.z - a.z)[0];
    os.focus(target.id);
  };

  return (
    <div className="dock-wrap" onPointerDown={(e) => e.stopPropagation()}>
      <div
        className={"dock" + (mx === null ? "" : " hover")}
        onPointerMove={(e) => { const { k, left } = stageScale(); setMx((e.clientX - left) / k); }}
        onPointerLeave={() => setMx(null)}
      >
        {DOCK_APPS.map((app, i) => {
          const s = size(i);
          const running = os.windows.some((w) => w.app === app && w.phase !== "closing");
          return (
            <div key={app} className="dock-slot">
              {i === DOCK_APPS.length - 1 && <div className="dock-sep" />}
              <div
                data-app={app}
                className="dock-item"
                style={{ width: s, height: s }}
                onClick={() => click(app)}
              >
                <span className="dock-label">{title(app)}</span>
                <span key={bounce[app] ?? 0} className={"dock-icon" + (bounce[app] ? " bounce" : "")}>
                  <AppIcon name={app === "launchpad" ? "launchpad" : APP_META[app].icon} size={s} />
                </span>
                <i className={"dock-dot" + (running ? " on" : "")} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
