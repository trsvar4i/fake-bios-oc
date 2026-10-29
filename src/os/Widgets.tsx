// Виджеты рабочего стола: часы, календарь, напоминания, состояние ПК (из модели BIOS), заметки.
// Перетаскиваются, меняют размер через контекстное меню, добавляются из галереи.
import { useRef, useState } from "react";
import { useStore, useLang } from "../machine/store";
import { readings, tempClass } from "../machine/sensors";
import { l, type L } from "../machine/i18n";
import { WORK_TOP, SCREEN_W, WORK, topWindow, useOs, type Widget } from "./osStore";
import { Dial } from "./apps/Clock";
import { dayKey, monthGrid } from "./apps/Calendar";
import { toggleReminder } from "./apps/Reminders";
import { stageScale, useNow, usePresence, useTimeFormat } from "./util";
import { ctxAt } from "./apps/Finder";
import { useNoteFiles } from "./apps/Notes";
import { useFs } from "./fs";

export const WSIZE = { s: { w: 176, h: 176 }, m: { w: 372, h: 176 } };
const GRID = 196;

interface Kind { title: L; desc: L; app: string; render: (size: "s" | "m") => JSX.Element }

export const KINDS: Record<string, Kind> = {
  clock: { title: l("Clock", "Часы"), desc: l("Time on an analog dial", "Время на циферблате"), app: "clock", render: (s) => <ClockW size={s} /> },
  calendar: { title: l("Calendar", "Календарь"), desc: l("Today and upcoming events", "Сегодня и ближайшие события"), app: "calendar", render: (s) => <CalendarW size={s} /> },
  reminders: { title: l("Reminders", "Напоминания"), desc: l("Your to-do list", "Список дел"), app: "reminders", render: (s) => <RemindersW size={s} /> },
  system: { title: l("This PC", "Этот компьютер"), desc: l("Live CPU temperature, clock and fans", "Температура, частота и вентиляторы — вживую"), app: "taskmgr", render: (s) => <SystemW size={s} /> },
  notes: { title: l("Notes", "Заметки"), desc: l("Your latest note", "Последняя заметка"), app: "notes", render: (s) => <NotesW size={s} /> },
};

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Первое свободное место по сетке, сверху вниз слева направо. */
function freeSpot(size: "s" | "m", widgets: Widget[]) {
  const { w, h } = WSIZE[size];
  for (let x = 40; x + w < SCREEN_W - 200; x += GRID) {
    for (let y = WORK_TOP + 36; y + h < WORK.top + WORK.h; y += GRID) {
      const r = { x, y, w, h };
      if (!widgets.some((o) => overlaps(r, { x: o.x, y: o.y, ...WSIZE[o.size] }))) return { x, y };
    }
  }
  return { x: 40, y: WORK_TOP + 36 };
}

export function addWidget(kind: string, size: "s" | "m") {
  const list = useOs.getState().prefs.widgets;
  const id = Math.max(0, ...list.map((w) => w.id)) + 1;
  useOs.getState().setPref("widgets", [...list, { id, kind, size, ...freeSpot(size, list) }]);
}
const removeWidget = (id: number) => useOs.getState().setPref("widgets", useOs.getState().prefs.widgets.filter((w) => w.id !== id));
const patchWidget = (id: number, p: Partial<Widget>) =>
  useOs.getState().setPref("widgets", useOs.getState().prefs.widgets.map((w) => (w.id === id ? { ...w, ...p } : w)));

/** Слой виджетов на рабочем столе. */
export function DesktopWidgets() {
  const os = useOs();
  const { t } = useLang();
  const editing = os.panel === "widgets";
  // когда фокус в окне, виджеты приглушаются, как в macOS
  const dim = !os.deskFocus && !!topWindow(os.windows) && !editing;
  return (
    <div className={"widgets" + (dim ? " dim" : "") + (editing ? " editing" : "")}>
      {os.prefs.widgets.filter((w) => KINDS[w.kind]).map((w) => (
        <DesktopWidget key={w.id} w={w} editing={editing} t={t} />
      ))}
    </div>
  );
}

function DesktopWidget({ w, editing, t }: { w: Widget; editing: boolean; t: (en: string, ru: string) => string }) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const kind = KINDS[w.kind];
  const { w: width, h } = WSIZE[w.size];
  const pos = drag ?? w;

  return (
    <div
      className={"widget " + w.size + (drag ? " dragging" : "")}
      style={{ left: pos.x, top: pos.y, width, height: h }}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
        e.stopPropagation();
        useOs.setState({ deskFocus: true, panel: editing ? "widgets" : null, menu: null, ctx: null });
        start.current = { px: e.clientX, py: e.clientY, x: w.x, y: w.y, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const { k } = stageScale();
        const dx = (e.clientX - s.px) / k, dy = (e.clientY - s.py) / k;
        if (!s.moved && Math.hypot(dx, dy) < 4) return;
        s.moved = true;
        setDrag({ x: s.x + dx, y: s.y + dy });
      }}
      onPointerUp={() => {
        const s = start.current;
        start.current = null;
        if (!s?.moved || !drag) return;
        // прилипание к сетке 20 px и рамки рабочей области
        const snap = (v: number) => Math.round(v / 20) * 20;
        patchWidget(w.id, {
          x: Math.max(20, Math.min(SCREEN_W - width - 20, snap(drag.x))),
          y: Math.max(WORK_TOP + 16, Math.min(WORK.top + WORK.h - h, snap(drag.y))),
        });
        setDrag(null);
      }}
      onDoubleClick={() => useOs.getState().open(kind.app)}
      onContextMenu={(e) => ctxAt(e, [
        { label: t("Small", "Маленький"), check: w.size === "s", run: () => patchWidget(w.id, { size: "s" }) },
        { label: t("Medium", "Средний"), check: w.size === "m", run: () => patchWidget(w.id, { size: "m" }) },
        "sep",
        { label: t(`Open ${kind.title.en}`, `Открыть «${kind.title.ru}»`), run: () => useOs.getState().open(kind.app) },
        { label: t("Edit Widgets…", "Изменить виджеты…"), run: () => useOs.getState().setPanel("widgets") },
        "sep",
        { label: t("Remove Widget", "Удалить виджет"), run: () => removeWidget(w.id), danger: true },
      ])}
    >
      {kind.render(w.size)}
      {editing && <button className="widget-remove" onClick={() => removeWidget(w.id)} aria-label="Remove">−</button>}
    </div>
  );
}

/** Галерея виджетов: снизу экрана, как в macOS. Щелчок по превью добавляет виджет. */
export function WidgetGallery() {
  const os = useOs();
  const { t, lang } = useLang();
  const [sel, setSel] = useState("clock");
  const { mounted, closing } = usePresence(os.panel === "widgets", 260);
  if (!mounted) return null;
  const kind = KINDS[sel];
  return (
    <div className={"wgallery" + (closing ? " closing" : "")} onPointerDown={(e) => e.stopPropagation()}>
      <div className="wg-side">
        <div className="wg-head">{t("Widgets", "Виджеты")}</div>
        {Object.entries(KINDS).map(([id, k]) => (
          <button key={id} className={"wg-kind" + (sel === id ? " on" : "")} onClick={() => setSel(id)}>{k.title[lang]}</button>
        ))}
      </div>
      <div className="wg-main">
        <div className="wg-title">{kind.title[lang]}</div>
        <div className="wg-desc">{kind.desc[lang]}</div>
        <div className="wg-previews" key={sel}>
          {(["s", "m"] as const).map((size) => (
            <button key={size} className={"wg-preview widget " + size} style={{ width: WSIZE[size].w, height: WSIZE[size].h }} onClick={() => addWidget(sel, size)} title={t("Add", "Добавить")}>
              {kind.render(size)}
              <span className="wg-add">+</span>
            </button>
          ))}
        </div>
        <div className="wg-hint">{t("Click a widget to add it. Drag widgets on the desktop to arrange them.", "Щёлкните по виджету, чтобы добавить. Перетаскивайте виджеты на рабочем столе.")}</div>
      </div>
      <button className="set-btn primary wg-done" onClick={() => os.dismiss()}>{t("Done", "Готово")}</button>
    </div>
  );
}

// ---------- сами виджеты ----------

function ClockW({ size }: { size: "s" | "m" }) {
  const now = useNow();
  const fmt = useTimeFormat();
  const { lang } = useLang();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  if (size === "s") {
    // секундная дуга по кругу и крупное время — свой циферблат Kestrel
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    return (
      <div className="w-clock">
        <svg className="w-orbit" viewBox="0 0 100 100" width="150" height="150">
          <circle cx="50" cy="50" r="44" className="w-orbit-track" />
          <circle cx="50" cy="50" r="44" className="w-orbit-arc" style={{ strokeDashoffset: 276.5 * (1 - sec / 60) }} />
          <circle cx={50 + 44 * Math.sin((sec / 60) * 2 * Math.PI)} cy={50 - 44 * Math.cos((sec / 60) * 2 * Math.PI)} r="3" className="w-orbit-dot" />
          <text x="50" y="49" className="w-orbit-time">{fmt(now).replace(/\s?[AP]M$/i, "")}</text>
          <text x="50" y="66" className="w-orbit-day">{now.toLocaleDateString(locale, { weekday: "short" })}</text>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-clock m">
      <Dial d={now} size={140} />
      <div>
        <div className="w-big">{fmt(now)}</div>
        <div className="w-sub">{now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>
    </div>
  );
}

function CalendarW({ size }: { size: "s" | "m" }) {
  const { t, lang } = useLang();
  const events = useOs((s) => s.prefs.events);
  const now = useNow();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const today = events[dayKey(now)] ?? [];
  const head = (
    <div className="w-cal-head">
      <div className="w-cal-wd">{now.toLocaleDateString(locale, { weekday: "long" })}</div>
      <div className="w-cal-day">{now.getDate()}</div>
      <div className="w-sub">{today[0] ?? t("No events today", "Сегодня событий нет")}</div>
    </div>
  );
  if (size === "s") return <div className="w-cal">{head}</div>;
  const days = monthGrid(now.getFullYear(), now.getMonth()).slice(0, 35);
  return (
    <div className="w-cal m">
      {head}
      <div className="w-cal-grid">
        <div className="w-cal-month">{now.toLocaleDateString(locale, { month: "long" })}</div>
        {days.map((d) => (
          <span key={d.toISOString()} className={(d.getMonth() !== now.getMonth() ? "out" : "") + (dayKey(d) === dayKey(now) ? " today" : "") + (events[dayKey(d)] ? " ev" : "")}>{d.getDate()}</span>
        ))}
      </div>
    </div>
  );
}

function RemindersW({ size }: { size: "s" | "m" }) {
  const { t } = useLang();
  const list = useOs((s) => s.prefs.reminders).filter((r) => !r.done);
  return (
    <div className={"w-rem " + size}>
      <div className="w-rem-head"><span>{t("Reminders", "Напоминания")}</span><b>{list.length}</b></div>
      {list.slice(0, size === "s" ? 3 : 4).map((r) => (
        <div key={r.id} className="w-rem-item">
          <button className="rm-check" onClick={() => toggleReminder(r.id)} aria-label="Done" />
          <span>{r.text}</span>
        </div>
      ))}
      {!list.length && <div className="w-sub">{t("All done", "Всё сделано")} ✓</div>}
    </div>
  );
}

function SystemW({ size }: { size: "s" | "m" }) {
  const { t } = useLang();
  const s = useStore();
  const r = readings(s.saved, s.thermal, s);
  const pct = Math.min(1, Math.max(0, (r.temp - 25) / 75));
  const ring = (
    <svg className={"w-ring " + tempClass(r.temp)} viewBox="0 0 100 100" width="118" height="118">
      <circle cx="50" cy="50" r="42" className="w-ring-track" />
      <circle cx="50" cy="50" r="42" className="w-ring-arc" style={{ strokeDashoffset: 263.9 * (1 - pct) }} />
      <text x="50" y="50" className="w-ring-val">{Math.round(r.temp)}°</text>
      <text x="50" y="68" className="w-ring-cap">CPU</text>
    </svg>
  );
  if (size === "s") return <div className="w-sys">{ring}</div>;
  const rows: [string, string, string?][] = [
    [t("Clock", "Частота"), `${r.freq} GHz`],
    [t("CPU fan", "Вентилятор"), `${r.rpm} RPM`],
    [t("Network", "Сеть"), s.saved.lanController ? "Ethernet" : t("Off in BIOS", "Выкл. в BIOS"), s.saved.lanController ? "" : "warn"],
    [t("Sound", "Звук"), s.saved.hdAudio ? "HD Audio" : t("Off in BIOS", "Выкл. в BIOS"), s.saved.hdAudio ? "" : "warn"],
  ];
  return (
    <div className="w-sys m">
      {ring}
      <div className="w-sys-rows">
        {rows.map(([k, v, cls]) => <div key={k}><span>{k}</span><b className={cls}>{v}</b></div>)}
      </div>
    </div>
  );
}

function NotesW({ size }: { size: "s" | "m" }) {
  const { t } = useLang();
  const latest = useNoteFiles()[0];
  const text = useFs((s) => (latest ? s.read(latest) ?? "" : ""));
  return (
    <div className={"w-notes " + size}>
      <div className="w-notes-head">{t("Notes", "Заметки")}</div>
      <div className="w-notes-text">{text.trim() || t("No notes yet. Double-click to write one.", "Заметок пока нет. Дважды щёлкните, чтобы написать.")}</div>
    </div>
  );
}
