import { useEffect, useState } from "react";
import { useLang } from "../machine/store";
import { DEVICES } from "../machine/hardware";
import { useOs, topWindow } from "./osStore";
import { AppIcon } from "./AppIcon";
import { Window } from "./Window";
import { MenuBar } from "./MenuBar";
import { Dock } from "./Dock";
import { Launchpad, Spotlight } from "./Overlays";
import { stageScale, usePresence } from "./util";

/** Рабочий стол в духе macOS: строка меню, окна, док, значок диска справа, Launchpad и Spotlight. */
export function Desktop() {
  const os = useOs();
  const { t } = useLang();
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [diskSel, setDiskSel] = useState(false);
  const top = topWindow(os.windows);

  // Ctrl+Space — Spotlight, Esc закрывает панели и меню
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey) { e.preventDefault(); os.setPanel("spotlight"); }
      else if (e.key === "Escape") { os.dismiss(); setCtx(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="desktop"
      onPointerDown={() => { os.dismiss(); setCtx(null); setDiskSel(false); }}
      onContextMenu={(e) => {
        e.preventDefault();
        const { k, left, top: tp } = stageScale();
        setCtx({ x: (e.clientX - left) / k, y: (e.clientY - tp) / k });
      }}
    >
      <Wallpaper id={os.prefs.wallpaper} />
      <div
        className={"disk-icon" + (diskSel ? " sel" : "")}
        onPointerDown={(e) => { e.stopPropagation(); os.dismiss(); setCtx(null); setDiskSel(true); }}
        onDoubleClick={() => os.open("thispc")}
      >
        <AppIcon name="disk" size={76} />
        <span>{DEVICES.OS.short}</span>
      </div>

      {os.windows.filter((w) => !w.min).map((w) => (
        <Window key={w.id} win={w} active={top?.id === w.id} />
      ))}

      <ContextMenu at={ctx} onClose={() => setCtx(null)} items={[
        [t("Change Wallpaper…", "Изменить обои…"), () => os.open("settings")],
        [t("Open Terminal", "Открыть Терминал"), () => os.open("terminal")],
        [t("New Note", "Новая заметка"), () => os.open("notes")],
        [t("About This PC", "Об этом компьютере"), () => os.open("thispc")],
      ]} />

      <Dock />
      <MenuBar />
      <Launchpad />
      <Spotlight />
      <div className="dim" style={{ opacity: 1 - os.brightness }} />
    </div>
  );
}

/** Обои с плавной сменой: новый слой проявляется поверх старого. */
function Wallpaper({ id }: { id: string }) {
  const [layers, setLayers] = useState([id]);
  useEffect(() => {
    if (layers[layers.length - 1] === id) return;
    setLayers((l) => [l[l.length - 1], id]);
    const t = window.setTimeout(() => setLayers([id]), 750);
    return () => clearTimeout(t);
  }, [id]);
  return <>{layers.map((w, i) => <div key={w} className={"wallpaper wp-" + w + (i > 0 ? " next" : "")} />)}</>;
}

function ContextMenu({ at, items, onClose }: { at: { x: number; y: number } | null; items: [string, () => void][]; onClose: () => void }) {
  const [pos, setPos] = useState(at);
  useEffect(() => { if (at) setPos(at); }, [at]);
  const { mounted, closing } = usePresence(!!at, 160);
  if (!mounted || !pos) return null;
  return (
    <div className={"ctxmenu dropdown" + (closing ? " closing" : "")} style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
      {items.map(([label, run]) => (
        <button key={label} className="dd-item" onClick={() => { onClose(); run(); }}>
          <span className="dd-check" />
          {label}
        </button>
      ))}
    </div>
  );
}
