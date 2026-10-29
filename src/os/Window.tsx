import { useRef } from "react";
import { useLang } from "../machine/store";
import { DESK_H, SCREEN_W, useOs, type Win } from "./osStore";
import { APP_META } from "./apps/meta";
import { APP_COMPONENTS } from "./apps";
import { AppIcon } from "./AppIcon";
import { stageScale } from "./util";

const MIN_W = 380;
const MIN_H = 240;

/** Окно: перетаскивание за заголовок, привязка к краям, изменение размера, свернуть/развернуть/закрыть. */
export function Window({ win, active }: { win: Win; active: boolean }) {
  const os = useOs();
  const { lang } = useLang();
  const meta = APP_META[win.app];
  const Body = APP_COMPONENTS[win.app];
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const rs = useRef<{ px: number; py: number; w: number; h: number; dir: string } | null>(null);

  const g = win.max
    ? { x: 0, y: 0, w: SCREEN_W, h: DESK_H }
    : win.snap === "left"
      ? { x: 0, y: 0, w: SCREEN_W / 2, h: DESK_H }
      : win.snap === "right"
        ? { x: SCREEN_W / 2, y: 0, w: SCREEN_W / 2, h: DESK_H }
        : win;

  const onTitleDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".wbtn") || e.button !== 0) return;
    os.focus(win.id);
    const { k, left } = stageScale();
    let { x, y } = win;
    if (win.max || win.snap) {
      // оторвать развёрнутое окно: оно встаёт под курсор в обычном размере
      x = (e.clientX - left) / k - win.w / 2;
      y = 0;
      os.update(win.id, { max: false, snap: null, x, y });
    }
    drag.current = { px: e.clientX, py: e.clientY, x, y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onTitleMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { k } = stageScale();
    os.update(win.id, {
      x: d.x + (e.clientX - d.px) / k,
      y: Math.max(0, Math.min(DESK_H - 40, d.y + (e.clientY - d.py) / k)),
    });
  };
  const onTitleUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    const { k, left, top } = stageScale();
    const px = (e.clientX - left) / k;
    const py = (e.clientY - top) / k;
    if (px <= 6) os.update(win.id, { snap: "left" });
    else if (px >= SCREEN_W - 6) os.update(win.id, { snap: "right" });
    else if (py <= 4) os.update(win.id, { max: true });
  };

  const onResizeDown = (dir: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    os.focus(win.id);
    rs.current = { px: e.clientX, py: e.clientY, w: win.w, h: win.h, dir };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = rs.current;
    if (!r) return;
    const { k } = stageScale();
    os.update(win.id, {
      w: r.dir.includes("e") ? Math.max(MIN_W, r.w + (e.clientX - r.px) / k) : win.w,
      h: r.dir.includes("s") ? Math.max(MIN_H, r.h + (e.clientY - r.py) / k) : win.h,
    });
  };
  const onResizeUp = () => { rs.current = null; };
  const handle = (dir: string) => (
    <div className={"rs rs-" + dir} onPointerDown={onResizeDown(dir)} onPointerMove={onResizeMove} onPointerUp={onResizeUp} />
  );

  return (
    <div
      className={"win" + (active ? " active" : "") + (win.max || win.snap ? " docked" : "")}
      style={{ left: g.x, top: g.y, width: g.w, height: g.h, zIndex: win.z }}
      onPointerDown={(e) => { e.stopPropagation(); if (!active) os.focus(win.id); useOs.getState().toggleStart(false); }}
    >
      <div className="win-title" onPointerDown={onTitleDown} onPointerMove={onTitleMove} onPointerUp={onTitleUp} onDoubleClick={() => os.toggleMax(win.id)}>
        <AppIcon name={meta.icon} size={22} />
        <span className="win-name">{meta.title[lang]}</span>
        <div className="wbtns">
          <button className="wbtn" onClick={() => os.minimize(win.id)}>
            <svg viewBox="0 0 12 12"><path d="M2 6h8" /></svg>
          </button>
          <button className="wbtn" onClick={() => os.toggleMax(win.id)}>
            <svg viewBox="0 0 12 12">{win.max || win.snap ? <path d="M3.5 1.5h7v7M1.5 3.5h7v7h-7z" /> : <path d="M1.5 1.5h9v9h-9z" />}</svg>
          </button>
          <button className="wbtn close" onClick={() => os.close(win.id)}>
            <svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </div>
      </div>
      <div className="win-body">
        <Body winId={win.id} />
      </div>
      {!win.max && !win.snap && (
        <>
          {handle("e")}
          {handle("s")}
          {handle("se")}
        </>
      )}
    </div>
  );
}
