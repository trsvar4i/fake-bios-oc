// Тост «Испытание пройдено» — поверх любого экрана: на POST, в BIOS и в системе.
import { useEffect, useState } from "react";
import { useLang } from "./machine/store";
import { QUESTS, useQuests } from "./machine/quests";

export function QuestToast() {
  const fresh = useQuests((s) => s.fresh);
  const total = useQuests((s) => Object.keys(s.done).length);
  const { lang, t } = useLang();
  const [shown, setShown] = useState<string | null>(fresh);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (fresh) { setShown(fresh); setLeaving(false); return; }
    setLeaving(true);
    const id = window.setTimeout(() => setShown(null), 320);
    return () => clearTimeout(id);
  }, [fresh]);
  const q = QUESTS.find((x) => x.id === shown);
  if (!q) return null;
  return (
    <div className={"quest-toast" + (leaving ? " out" : "")} key={q.id} onClick={() => useQuests.setState({ fresh: null })}>
      <span className="qt-badge"><svg viewBox="0 0 24 24"><path d={q.glyph} /></svg></span>
      <span className="qt-text">
        <small>{t("Challenge complete", "Испытание пройдено")} · {total}/{QUESTS.length}</small>
        <b>{q.title[lang]}</b>
        <span>{q.desc[lang]}</span>
      </span>
    </div>
  );
}
