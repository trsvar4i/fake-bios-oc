import { useState } from "react";
import { useLang } from "../../machine/store";
import { useOs, type Reminder } from "../osStore";
import "./Reminders.css";

export function setReminders(list: Reminder[]) {
  useOs.getState().setPref("reminders", list);
}
export function toggleReminder(id: number) {
  setReminders(useOs.getState().prefs.reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
}

/** Список дел: добавить, отметить, удалить, показать выполненные. */
export function Reminders() {
  const { t } = useLang();
  const list = useOs((s) => s.prefs.reminders);
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = list.filter((r) => !r.done);
  const visible = showDone ? list : open;

  const add = () => {
    if (!draft.trim()) return;
    setReminders([...list, { id: Date.now(), text: draft.trim(), done: false }]);
    setDraft("");
  };

  return (
    <div className="reminders">
      <div className="rm-head">
        <h1>{t("Reminders", "Напоминания")}</h1>
        <div className="rm-count">{open.length}</div>
      </div>
      <button className="rm-toggle" onClick={() => setShowDone(!showDone)}>
        {showDone ? t("Hide Completed", "Скрыть выполненные") : t(`Show Completed (${list.length - open.length})`, `Показать выполненные (${list.length - open.length})`)}
      </button>
      <div className="rm-list">
        {visible.map((r) => (
          <div key={r.id} className={"rm-item" + (r.done ? " done" : "")}>
            <button className="rm-check" onClick={() => toggleReminder(r.id)} aria-label="Done" />
            <span>{r.text}</span>
            <button className="rm-del" onClick={() => setReminders(list.filter((x) => x.id !== r.id))} title={t("Delete", "Удалить")}>×</button>
          </div>
        ))}
        <form className="rm-new" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <span className="rm-plus">+</span>
          <input value={draft} placeholder={t("New Reminder", "Новое напоминание")} onChange={(e) => setDraft(e.target.value)} />
        </form>
      </div>
    </div>
  );
}
