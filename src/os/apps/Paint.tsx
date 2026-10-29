import { useEffect, useRef, useState } from "react";
import { useLang } from "../../machine/store";
import { useOs } from "../osStore";
import { HOME, join, nameOf, useFs } from "../fs";
import "./Paint.css";

const W = 1200;
const H = 760;
const COLORS = ["#1d1d1f", "#ffffff", "#ff453a", "#ff9f0a", "#ffd60a", "#30d158", "#40c8e0", "#0a84ff", "#5e5ce6", "#bf5af2", "#ff375f", "#a2845e"];
const SIZES = [3, 8, 16, 32];
const PICTURES = `${HOME}/Pictures`;

/** Рисовалка: кисть, ластик, заливка фона, отмена; сохраняет PNG в «Картинки» (или в открытый файл). */
export function Paint({ winId }: { winId: number }) {
  const { t } = useLang();
  const arg = useOs((s) => s.windows.find((w) => w.id === winId)?.arg);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[7]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [saved, setSaved] = useState<string | null>(null);
  const undo = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);

  const ctx = () => canvas.current!.getContext("2d")!;
  const clear = (fill = "#ffffff") => { const c = ctx(); c.fillStyle = fill; c.fillRect(0, 0, W, H); };

  // открыть картинку, если окно запущено из Finder
  useEffect(() => {
    clear();
    const data = arg ? useFs.getState().read(arg) : null;
    if (data?.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx().drawImage(img, 0, 0, W, H);
      img.src = data;
    }
  }, [arg]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const c = ctx();
    c.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    c.lineWidth = tool === "eraser" ? size * 2.5 : size;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  };

  const save = () => {
    const fs = useFs.getState();
    let path = arg;
    if (!path) {
      if (!fs.isDir(PICTURES)) fs.mkdir(PICTURES);
      path = join(PICTURES, fs.freeName(PICTURES, t("Drawing", "Рисунок"), ".png"));
      useOs.getState().update(winId, { arg: path });
    }
    fs.write(path, canvas.current!.toDataURL("image/png"));
    setSaved(nameOf(path));
    window.setTimeout(() => setSaved(null), 2200);
  };

  return (
    <div className="paint">
      <div className="pt-bar">
        <div className="seg">
          <button className={tool === "brush" ? "on" : ""} onClick={() => setTool("brush")}>{t("Brush", "Кисть")}</button>
          <button className={tool === "eraser" ? "on" : ""} onClick={() => setTool("eraser")}>{t("Eraser", "Ластик")}</button>
        </div>
        <div className="pt-sizes">
          {SIZES.map((s) => (
            <button key={s} className={size === s ? "on" : ""} onClick={() => setSize(s)} title={`${s}px`}>
              <i style={{ width: Math.min(22, s), height: Math.min(22, s) }} />
            </button>
          ))}
        </div>
        <div className="pt-colors">
          {COLORS.map((c) => (
            <button key={c} className={color === c && tool === "brush" ? "on" : ""} style={{ background: c }} onClick={() => { setColor(c); setTool("brush"); }} />
          ))}
        </div>
        <div className="pt-spacer" />
        <button className="set-btn" disabled={!undo.current.length} onClick={() => { const img = undo.current.pop(); if (img) ctx().putImageData(img, 0, 0); setSaved(null); }}>{t("Undo", "Отменить")}</button>
        <button className="set-btn" onClick={() => { undo.current.push(ctx().getImageData(0, 0, W, H)); clear(tool === "brush" ? color : "#ffffff"); }}>{t("Fill", "Залить")}</button>
        <button className="set-btn primary" onClick={save}>{saved ? `✓ ${saved}` : t("Save", "Сохранить")}</button>
      </div>
      <div className="pt-stage">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            undo.current.push(ctx().getImageData(0, 0, W, H));
            if (undo.current.length > 30) undo.current.shift();
            const p = pos(e);
            last.current = p;
            stroke(p, { x: p.x + 0.1, y: p.y });
          }}
          onPointerMove={(e) => { if (!last.current) return; const p = pos(e); stroke(last.current, p); last.current = p; }}
          onPointerUp={() => { last.current = null; }}
        />
      </div>
    </div>
  );
}
