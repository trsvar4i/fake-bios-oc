import { useState } from "react";
import { useLang } from "../../machine/store";
import { useOs } from "../osStore";

/** Блокнот. Текст сохраняется автоматически и переживает перезагрузку. */
export function Notes() {
  const { t } = useLang();
  const text = useOs((s) => s.prefs.notes);
  const [pos, setPos] = useState({ ln: 1, col: 1 });

  const track = (el: HTMLTextAreaElement) => {
    const before = el.value.slice(0, el.selectionStart);
    const lines = before.split("\n");
    setPos({ ln: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  return (
    <div className="notes">
      <div className="notes-bar">
        <button onClick={() => useOs.getState().setPref("notes", "")}>{t("New", "Новый")}</button>
        <span className="notes-saved">{t("Saved automatically", "Сохраняется автоматически")}</span>
      </div>
      <textarea
        value={text}
        spellCheck={false}
        placeholder={t("Start typing…", "Начните печатать…")}
        onChange={(e) => { useOs.getState().setPref("notes", e.target.value); track(e.target); }}
        onKeyUp={(e) => track(e.currentTarget)}
        onClick={(e) => track(e.currentTarget)}
      />
      <div className="notes-status">
        {t("Ln", "Стр")} {pos.ln}, {t("Col", "Стлб")} {pos.col} · {text.length} {t("characters", "символов")} · UTF-8
      </div>
    </div>
  );
}
