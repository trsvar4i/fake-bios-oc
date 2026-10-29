// Док (как в macOS): закреплённые и запущенные приложения, Корзина, увеличение под курсором,
// точка у запущенных, отскок при запуске, меню по правой кнопке.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../machine/store";
import { useOs, type MenuItem } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon } from "./AppIcon";
import { TRASH, isTrashed, useFs } from "./fs";
import { stageScale } from "./util";
import { useDrop } from "./apps/Finder";

const BASE = 72;
const MAX = 124;
/** на каком расстоянии от курсора иконки ещё увеличиваются */
const RANGE = 230;
const GAP = 6;
/** разделитель: линия и отступы */
const SEP = 21;

type Slot = { kind: "app"; app: string } | { kind: "sep" } | { kind: "trash" };

/** Центры иконок в неувеличенном доке: увеличение считается от них, чтобы иконки не «дрожали». */
function centers(slots: Slot[]) {
  const widths = slots.map((s) => (s.kind === "sep" ? SEP : BASE));
  const total = widths.reduce((a, b) => a + b, 0) + GAP * (slots.filter((s) => s.kind !== "sep").length - 1);
  let x = 960 - total / 2;
  return slots.map((s, i) => {
    const c = x + widths[i] / 2;
    x += widths[i] + (s.kind === "sep" ? 0 : GAP);
    return c;
  });
}

/**
 * Плавное увеличение: позиция курсора и сила эффекта догоняют цель покадрово (requestAnimationFrame),
 * поэтому иконки растут и опадают мягко, без рывков от событий мыши.
 */
function useMagnify() {
  const [frame, setFrame] = useState({ x: 960, strength: 0 });
  const target = useRef({ x: 960, strength: 0 });
  const cur = useRef({ x: 960, strength: 0 });
  const raf = useRef(0);
  const loop = () => {
    const c = cur.current, t = target.current;
    c.x += (t.x - c.x) * 0.28;
    c.strength += (t.strength - c.strength) * 0.16;
    const done = Math.abs(t.x - c.x) < 0.3 && Math.abs(t.strength - c.strength) < 0.002;
    if (done) { c.x = t.x; c.strength = t.strength; }
    setFrame({ ...c });
    raf.current = done ? 0 : requestAnimationFrame(loop);
  };
  const kick = () => { if (!raf.current) raf.current = requestAnimationFrame(loop); };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return {
    ...frame,
    aim: (x: number) => {
      // при входе в док курсор подхватывается сразу, без «наезда» от прошлой позиции
      if (cur.current.strength < 0.05) cur.current.x = x;
      target.current = { x, strength: 1 };
      kick();
    },
    release: () => { target.current = { ...target.current, strength: 0 }; kick(); },
  };
}

export function Dock() {
  const os = useOs();
  const { t, lang } = useLang();
  const trashFull = useFs((s) => Object.keys(s.nodes).some(isTrashed));
  const trashDrop = useDrop(TRASH);
  const mag = useMagnify();
  const [bounce, setBounce] = useState<Record<string, number>>({});
  const prev = useRef<Record<string, number> | null>(null);

  const alive = os.windows.filter((w) => w.phase !== "closing");
  const pinned = os.prefs.dock;
  const extra = [...new Set(alive.map((w) => w.app))].filter((a) => !pinned.includes(a) && !APP_META[a].hidden);
  const slots: Slot[] = [
    ...pinned.map((app): Slot => ({ kind: "app", app })),
    ...(extra.length ? [{ kind: "sep" } as Slot, ...extra.map((app): Slot => ({ kind: "app", app }))] : []),
    { kind: "sep" }, { kind: "trash" },
  ];
  const cx = centers(slots);

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
    if (!os.prefs.dockMagnify || mag.strength < 0.001) return BASE;
    const d = Math.abs(mag.x - cx[i]);
    if (d > RANGE) return BASE;
    return BASE + (MAX - BASE) * mag.strength * (Math.cos((d / RANGE) * Math.PI) + 1) / 2;
  };

  const title = (app: string) => (app === "launchpad" ? "Launchpad" : APP_META[app].title[lang]);
  const click = (app: string) => {
    if (app === "launchpad") return os.setPanel("launchpad");
    const ws = alive.filter((w) => w.app === app);
    if (!ws.length) return os.open(app);
    // свёрнутое окно возвращается из дока, иначе приложение выходит на передний план
    const target = ws.find((w) => w.min) ?? [...ws].sort((a, b) => b.z - a.z)[0];
    os.focus(target.id);
  };

  /** Меню иконки: окна приложения, закрепление, скрыть, завершить. */
  const appMenu = (app: string): MenuItem[] => {
    const keep = pinned.includes(app);
    const pinItem: MenuItem = {
      label: keep ? t("Remove from Dock", "Убрать из Dock") : t("Keep in Dock", "Оставить в Dock"),
      run: () => os.setPref("dock", keep ? pinned.filter((a) => a !== app) : [...pinned, app]),
    };
    if (app === "launchpad") return [{ label: t("Open", "Открыть"), run: () => os.setPanel("launchpad") }, "sep", pinItem];
    const ws = alive.filter((w) => w.app === app);
    const name = APP_META[app].title[lang];
    const items: MenuItem[] = ws.map((w) => ({
      label: w.arg ? `${name} — ${w.arg === "~" ? os.prefs.userName : w.arg.split("/").pop()}` : name,
      run: () => os.focus(w.id),
      check: !w.min,
    }));
    if (ws.length) items.push("sep");
    if (!(APP_META[app].single && ws.length)) items.push({ label: ws.length ? t("New Window", "Новое окно") : t("Open", "Открыть"), run: () => os.open(app) });
    items.push(pinItem);
    if (ws.length) {
      items.push("sep",
        { label: t("Hide", "Скрыть"), run: () => ws.filter((w) => !w.min).forEach((w) => os.minimize(w.id)) },
        { label: t("Quit", "Завершить"), run: () => os.quit(app) });
    }
    return items;
  };
  const trashMenu = (): MenuItem[] => [
    { label: t("Open", "Открыть"), run: () => os.open("finder", TRASH) },
    { label: t("Empty Trash", "Очистить Корзину"), run: () => useFs.getState().emptyTrash(), disabled: !trashFull },
  ];

  /** Меню дока раскрывается вверх над иконкой. */
  const menuAt = (e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    const { k, left, top } = stageScale();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    os.openCtx({ x: (r.left + r.width / 2 - left) / k, y: (r.top - top) / k - 12, items, above: true });
  };

  return (
    <div className="dock-wrap" onPointerDown={(e) => e.stopPropagation()}>
      <div
        className="dock"
        onPointerMove={(e) => { const { k, left } = stageScale(); mag.aim((e.clientX - left) / k); }}
        onPointerLeave={() => mag.release()}
      >
        {slots.map((slot, i) => {
          if (slot.kind === "sep") return <div key={"sep" + i} className="dock-sep" />;
          const s = size(i);
          if (slot.kind === "trash") {
            return (
              <div key="trash" data-app="trash" className={"dock-item" + (trashDrop.over ? " drop" : "")} style={{ width: s, height: s }} {...trashDrop.props}
                onClick={() => os.open("finder", TRASH)} onContextMenu={(e) => menuAt(e, trashMenu())}>
                <span className="dock-label">{t("Trash", "Корзина")}</span>
                <span className="dock-icon"><AppIcon name={trashFull ? "trashFull" : "trash"} size={s} /></span>
              </div>
            );
          }
          const app = slot.app;
          const running = alive.some((w) => w.app === app);
          return (
            <div key={app} data-app={app} className="dock-item" style={{ width: s, height: s }}
              onClick={() => click(app)} onContextMenu={(e) => menuAt(e, appMenu(app))}>
              <span className="dock-label">{title(app)}</span>
              <span key={bounce[app] ?? 0} className={"dock-icon" + (bounce[app] ? " bounce" : "")}>
                <AppIcon name={app === "launchpad" ? "launchpad" : APP_META[app].icon} size={s} />
              </span>
              <i className={"dock-dot" + (running ? " on" : "")} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
