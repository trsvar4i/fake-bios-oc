// «Испытания»: список целей, прогресс и подсказки, как их выполнить.
import { useLang } from "../../machine/store";
import { QUESTS, resetQuests, useQuests } from "../../machine/quests";
import "./Quests.css";

export function Quests() {
  const { lang, t } = useLang();
  const done = useQuests((s) => s.done);
  const n = QUESTS.filter((q) => done[q.id]).length;
  const pct = n / QUESTS.length;
  const date = (ms: number) => new Date(ms).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short" });
  return (
    <div className="quests">
      <header className="qs-head">
        <svg className="qs-ring" viewBox="0 0 100 100" width="96" height="96">
          <circle cx="50" cy="50" r="42" className="qs-track" />
          <circle cx="50" cy="50" r="42" className="qs-arc" style={{ strokeDashoffset: 263.9 * (1 - pct) }} />
          <text x="50" y="50" className="qs-num">{n}</text>
          <text x="50" y="68" className="qs-of">{t(`of ${QUESTS.length}`, `из ${QUESTS.length}`)}</text>
        </svg>
        <div>
          <h2>{t("Challenges", "Испытания")}</h2>
          <p>{t("Break the PC in every possible way — and bring it back. Progress is kept in this browser.",
            "Сломайте компьютер всеми способами — и почините. Прогресс хранится в этом браузере.")}</p>
        </div>
        {n > 0 && <button className="set-btn" onClick={resetQuests}>{t("Reset", "Сбросить")}</button>}
      </header>
      <div className="qs-grid">
        {QUESTS.map((q, i) => {
          const at = done[q.id];
          return (
            <div key={q.id} className={"qs-card" + (at ? " done" : "")} style={{ animationDelay: `${i * 22}ms` }}>
              <span className="qs-badge"><svg viewBox="0 0 24 24"><path d={q.glyph} /></svg></span>
              <span className="qs-text">
                <b>{q.title[lang]}</b>
                <span>{q.desc[lang]}</span>
                <small>{at ? t(`Done · ${date(at)}`, `Готово · ${date(at)}`) : q.hint[lang]}</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
