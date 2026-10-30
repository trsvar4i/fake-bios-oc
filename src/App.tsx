import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useStore } from "./machine/store";
import { Dialog } from "./bios/ui/Dialog";
import { Setup } from "./bios/setup/Setup";
import { Post } from "./bios/post/Post";
import { BootScreen } from "./bios/post/BootScreen";
import { PowerScreen } from "./bios/post/PowerScreen";
import { Os } from "./os/Os";
import { useOs } from "./os/osStore";
import { firmwareAccent } from "./os/wallpapers";
import { Tour } from "./Tour";
import { TouchLayer } from "./Touch";
import { QuestToast } from "./QuestToast";
import { Learning } from "./learn/Learn";
import { ClassLayer } from "./class/ClassUi";
import { parseShared } from "./machine/profiles";
import { PARAMS, formatValue } from "./machine/params";

const STAGE_W = 1920;
const STAGE_H = 1080;

/** Фиксированный экран 1920×1080, масштабируется целиком под окно — как настоящий монитор. */
function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  // BIOS и POST окрашены в акцент обоев рабочего стола текущего пользователя
  const wallpaper = useOs((s) => s.prefs.wallpaper);
  return (
    <div className="viewport" style={firmwareAccent(wallpaper) as CSSProperties}>
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
      <TouchLayer />
    </div>
  );
}

/** Ссылка с #cfg=…: предложить применить присланные настройки BIOS. */
function offerSharedConfig() {
  const cfg = parseShared(location.hash);
  if (!cfg) return;
  const clear = () => history.replaceState(null, "", location.pathname + location.search);
  const s = useStore.getState();
  const ru = s.saved.language === "Русский";
  const lang = ru ? "ru" : "en";
  s.openDialog({
    title: ru ? "Настройки BIOS по ссылке" : "Shared BIOS Configuration",
    body: (
      <>
        <p>{ru ? "Кто-то поделился своими настройками BIOS. Применить их к этому компьютеру? Остальное вернётся к заводским значениям." : "Someone shared their BIOS settings. Apply them to this PC? Everything else returns to factory defaults."}</p>
        <table className="changes"><tbody>
          {Object.entries(cfg).map(([k, v]) => <tr key={k}><td>{PARAMS[k].label[lang]}</td><td className="new">{formatValue(k, v, lang)}</td></tr>)}
        </tbody></table>
      </>
    ),
    buttons: [
      { label: ru ? "Применить" : "Apply", run: () => { useStore.getState().importConfig(cfg); clear(); } },
      { label: ru ? "Не надо" : "Ignore", run: clear },
    ],
  });
}

export function App() {
  const phase = useStore((s) => s.phase);
  useEffect(offerSharedConfig, []);

  // тепловая модель живёт всегда, даже на POST
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const s = useStore.getState();
      s.tick((now - last) / 1000);
      last = now;
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <Stage>
      {phase === "off" && <PowerScreen />}
      {phase === "post" && <Post />}
      {phase === "setup" && <Setup />}
      {phase === "boot" && <BootScreen />}
      {phase === "os" && <Os />}
      {phase === "off" && <Tour />}
      <Dialog />
      <QuestToast />
      <Learning />
        <ClassLayer />
    </Stage>
  );
}
