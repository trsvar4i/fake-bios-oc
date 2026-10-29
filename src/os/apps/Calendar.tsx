import { useState } from "react";
import { useLang } from "../../machine/store";
import { useOs } from "../osStore";

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Сетка месяца с понедельника: 6 недель, соседние дни приглушены. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - shift + i));
}

/** Календарь: месяц, сегодня, события на выбранный день (сохраняются). */
export function Calendar() {
  const { t, lang } = useLang();
  const events = useOs((s) => s.prefs.events);
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(dayKey(today));
  const [draft, setDraft] = useState("");
  const locale = lang === "ru" ? "ru-RU" : "en-GB";

  const days = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const weekdays = days.slice(0, 7).map((d) => d.toLocaleDateString(locale, { weekday: "short" }));
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const setEvents = (key: string, list: string[]) => {
    const next = { ...events, [key]: list };
    if (!list.length) delete next[key];
    useOs.getState().setPref("events", next);
  };
  const add = () => {
    if (!draft.trim()) return;
    setEvents(sel, [...(events[sel] ?? []), draft.trim()]);
    setDraft("");
  };
  const selDate = new Date(sel + "T00:00");

  return (
    <div className="calendar">
      <div className="cal-main">
        <div className="cal-head">
          <div className="cal-title">
            <b>{cursor.toLocaleDateString(locale, { month: "long" })}</b> {cursor.getFullYear()}
          </div>
          <div className="seg">
            <button onClick={() => move(-1)} aria-label="Previous">‹</button>
            <button onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSel(dayKey(today)); }}>{t("Today", "Сегодня")}</button>
            <button onClick={() => move(1)} aria-label="Next">›</button>
          </div>
        </div>
        <div className="cal-grid" key={cursor.toISOString()}>
          {weekdays.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {days.map((d) => {
            const k = dayKey(d);
            const cls = ["cal-day", d.getMonth() !== cursor.getMonth() && "out", k === dayKey(today) && "today", k === sel && "sel"].filter(Boolean).join(" ");
            return (
              <button key={k} className={cls} onClick={() => setSel(k)} onDoubleClick={() => setSel(k)}>
                <span className="cal-num">{d.getDate()}</span>
                {(events[k] ?? []).slice(0, 2).map((e, i) => <span key={i} className="cal-ev">{e}</span>)}
                {(events[k]?.length ?? 0) > 2 && <span className="cal-more">+{events[k].length - 2}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <aside className="cal-side">
        <div className="cal-side-date">{selDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</div>
        <div className="cal-list">
          {(events[sel] ?? []).map((e, i) => (
            <div key={i} className="cal-item">
              <i />{e}
              <button title={t("Delete", "Удалить")} onClick={() => setEvents(sel, events[sel].filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {!(events[sel] ?? []).length && <div className="cal-none">{t("No events", "Нет событий")}</div>}
        </div>
        <form className="cal-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input value={draft} placeholder={t("New event", "Новое событие")} onChange={(e) => setDraft(e.target.value)} />
          <button className="set-btn primary" disabled={!draft.trim()}>{t("Add", "Добавить")}</button>
        </form>
      </aside>
    </div>
  );
}
