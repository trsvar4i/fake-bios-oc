import { useLayoutEffect, useRef, useState } from "react";
import { useLang } from "../machine/store";
import { MENUBAR_H, SCREEN_W, WORK, overviewLayout, useOs, visibleWindows, type Win } from "./osStore";
import { APP_META } from "./apps/meta";
import { APP_COMPONENTS } from "./apps";
import { stageScale } from "./util";
import { AppIcon } from "./AppIcon";
import { HOME, TRASH, nameOf } from "./fs";

const MIN_W = 380;
const MIN_H = 240;
/** насколько близко к краю нужно поднести курсор, чтобы окно прилипло */
const EDGE = 8;

type Snap = "left" | "right" | "max" | null;

const geometry = (s: Snap) =>
  s === "max"
    ? { x: 0, y: WORK.top, w: SCREEN_W, h: WORK.h }
    : s === "left"
      ? { x: 0, y: WORK.top, w: SCREEN_W / 2, h: WORK.h }
      : { x: SCREEN_W / 2, y: WORK.top, w: SCREEN_W / 2, h: WORK.h };

/**
 * Окно в стиле macOS: «светофор» слева, заголовок по центру.
 * Перетаскивание за заголовок, прилипание к краям с подсказкой, изменение размера,
 * анимации появления, закрытия и сворачивания в док.
 */
export function Window({ win, active }: { win: Win; active: boolean }) {
  const os = useOs();
  const { lang } = useLang();
  const meta = APP_META[win.app];
  const user = useOs((s) => s.prefs.userName);
  // заголовок: у Finder — папка, у TextEdit — имя файла
  const title = win.arg === undefined ? meta.title[lang]
    : win.arg === HOME ? user : win.arg === TRASH ? (lang === "ru" ? "Корзина" : "Trash") : win.arg === "disk" ? "Kestrel HD" : nameOf(win.arg);
  const Body = APP_COMPONENTS[win.app];
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const rs = useRef<{ px: number; py: number; w: number; h: number; dir: string } | null>(null);
  const [hint, setHint] = useState<Snap>(null);

  const g = win.max ? geometry("max") : win.snap ? geometry(win.snap) : win;
  const fixed = !!meta.fixed;

  // «Все окна»: окно плавно уменьшается в свою ячейку сетки
  const overview = os.panel === "overview";
  const cell = overview ? overviewLayout(visibleWindows(os.windows, os.space))[win.id] : undefined;
  const ovTransform = cell
    ? `translate(${cell.x - g.x}px, ${cell.y - g.y}px) scale(${cell.w / g.w})`
    : undefined;

  // сворачивание «джинном»: окно втягивается в свою иконку в доке и возвращается из неё
  useLayoutEffect(() => {
    if (win.phase !== "minimizing" && win.phase !== "restoring") return;
    const icon = document.querySelector(`.dock [data-app="${win.app}"]`);
    const node = el.current;
    if (!icon || !node) return;
    const { k, left, top } = stageScale();
    const r = icon.getBoundingClientRect();
    const ix = (r.left + r.width / 2 - left) / k;
    const iy = (r.top + r.height / 2 - top) / k;
    node.style.setProperty("--gx", `${ix - (g.x + g.w / 2)}px`);
    node.style.setProperty("--gy", `${iy - (g.y + g.h / 2)}px`);
  }, [win.phase]);

  const toStage = (e: React.PointerEvent) => {
    const { k, left, top } = stageScale();
    return { px: (e.clientX - left) / k, py: (e.clientY - top) / k };
  };
  const snapAt = (px: number, py: number): Snap =>
    px <= EDGE ? "left" : px >= SCREEN_W - EDGE ? "right" : py <= MENUBAR_H + 2 ? "max" : null;

  const onTitleDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".traffic") || e.button !== 0) return;
    os.focus(win.id);
    let { x, y } = win;
    if (win.max || win.snap) {
      // оторвать развёрнутое окно: оно встаёт под курсор в обычном размере
      const { px, py } = toStage(e);
      x = px - win.w / 2;
      y = Math.max(MENUBAR_H, py - 20);
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
      y: Math.max(MENUBAR_H, Math.min(WORK.top + WORK.h - 40, d.y + (e.clientY - d.py) / k)),
    });
    const { px, py } = toStage(e);
    setHint(fixed ? null : snapAt(px, py));
  };
  const onTitleUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setHint(null);
    const { px, py } = toStage(e);
    const s = snapAt(px, py);
    if (fixed) return;
    if (s === "max") os.snap(win.id, null, true);
    else if (s) os.snap(win.id, s);
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

  const slide = os.spaceDir === 1 ? "from-right" : os.spaceDir === -1 ? "from-left" : null;
  const cls = ["win", active && "active", (win.max || win.snap) && "docked", win.anim && "anim", win.phase, overview && "in-overview", !win.phase && slide]
    .filter(Boolean).join(" ");

  return (
    <>
      {hint && <div className="snap-ghost" style={{ left: geometry(hint).x, top: geometry(hint).y, width: geometry(hint).w, height: geometry(hint).h }} />}
      <div
        ref={el}
        className={cls}
        style={{ left: g.x, top: g.y, width: g.w, height: g.h, zIndex: win.z, transform: ovTransform }}
        onPointerDown={(e) => { e.stopPropagation(); if (!active || overview) os.focus(win.id); os.dismiss(); }}
      >
        {overview && <div className="ov-catch" title={title} />}
        <div className="win-title" onPointerDown={onTitleDown} onPointerMove={onTitleMove} onPointerUp={onTitleUp} onDoubleClick={() => !fixed && os.toggleMax(win.id)}>
          <div className="traffic">
            <button className="tl tl-close" onClick={() => os.close(win.id)} aria-label="Close">
              <svg viewBox="0 0 12 12"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" /></svg>
            </button>
            <button className="tl tl-min" onClick={() => os.minimize(win.id)} aria-label="Minimize">
              <svg viewBox="0 0 12 12"><path d="M2.5 6h7" /></svg>
            </button>
            <button className="tl tl-zoom" disabled={fixed} onClick={() => os.toggleMax(win.id)} aria-label="Zoom">
              <svg viewBox="0 0 12 12"><path className="fill" d="M3.2 7.6 7.6 3.2H3.2zM8.8 4.4 4.4 8.8h4.4z" /></svg>
            </button>
          </div>
          <span className="win-name"><AppIcon name={meta.icon} size={20} />{title}</span>
        </div>
        <div className="win-body">
          <Body winId={win.id} />
        </div>
        {!win.max && !win.snap && !fixed && (
          <>
            {handle("e")}
            {handle("s")}
            {handle("se")}
          </>
        )}
      </div>
    </>
  );
}
