import { useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { defaults } from "../../machine/params";
import { LessonList } from "../../learn/Learn";
import { ClassPanel } from "../../class/ClassUi";
import { FAULTS, GOALS, newNonce, parseTask, taskLink, verifyCode, type Task } from "../../learn/tasks";
import "./Learn.css";

const TEACHER_KEY = "kestrel.teacher";
const loadMine = (): { task: Task; at: number }[] => {
  try { return JSON.parse(localStorage.getItem(TEACHER_KEY) ?? "[]"); } catch { return []; }
};

/** «Обучение»: курс уроков и режим преподавателя (задания-поломки и проверка кодов). */
export function Learn() {
  const { t } = useLang();
  const [tab, setTab] = useState<"course" | "class" | "teacher">("course");
  return (
    <div className="learnapp">
      <div className="tm-tabs">
        <button className={tab === "course" ? "on" : ""} onClick={() => setTab("course")}>{t("Lessons", "Уроки")}</button>
        <button className={tab === "class" ? "on" : ""} onClick={() => setTab("class")}>{t("My class", "Мой класс")}</button>
        <button className={tab === "teacher" ? "on" : ""} onClick={() => setTab("teacher")}>{t("For teachers", "Преподавателю")}</button>
      </div>
      <div className="la-page" key={tab}>{tab === "course" ? <LessonList /> : tab === "class" ? <ClassPanel /> : <Teacher />}</div>
    </div>
  );
}

function Teacher() {
  const { t, lang } = useLang();
  const saved = useStore((s) => s.saved);
  const [fault, setFault] = useState<string>(FAULTS[0].id);
  const preset = FAULTS.find((f) => f.id === fault);
  const [title, setTitle] = useState(FAULTS[0].title[lang]);
  const [desc, setDesc] = useState(FAULTS[0].desc[lang]);
  const [goal, setGoal] = useState(FAULTS[0].goal);
  const [link, setLink] = useState("");
  const [mine, setMine] = useState(loadMine);

  const pick = (id: string) => {
    setFault(id);
    setLink("");
    const f = FAULTS.find((x) => x.id === id);
    if (f) { setTitle(f.title[lang]); setDesc(f.desc[lang]); setGoal(f.goal); }
    else { setTitle(t("Fix the PC", "Почините компьютер")); setDesc(""); setGoal("boot"); }
  };

  /** «Своя поломка» — отличия текущих настроек BIOS от заводских (без пароля и языка). */
  const customCfg = () => {
    const d = defaults();
    return Object.fromEntries(Object.keys(d).filter((k) => k !== "setupPassword" && k !== "language" && JSON.stringify(saved[k]) !== JSON.stringify(d[k])).map((k) => [k, saved[k]]));
  };

  const create = () => {
    const task: Task = { t: title.trim() || t("Fix the PC", "Почините компьютер"), d: desc.trim(), g: goal, c: preset ? preset.cfg : customCfg(), n: newNonce() };
    const url = taskLink(task);
    setLink(url);
    void navigator.clipboard?.writeText(url);
    const next = [{ task, at: Date.now() }, ...mine].slice(0, 30);
    setMine(next);
    try { localStorage.setItem(TEACHER_KEY, JSON.stringify(next)); } catch { /* хранилище недоступно */ }
  };

  return (
    <div className="la-teacher">
      <section>
        <h2>{t("1. Create a task", "1. Создать задание")}</h2>
        <p className="set-note">{t("Pick what is broken. The student gets a link, fixes the PC and receives a completion code.",
          "Выберите, что сломано. Ученик получит ссылку, починит компьютер и получит код выполнения.")}</p>
        <div className="la-faults">
          {FAULTS.map((f) => (
            <button key={f.id} className={"la-fault" + (fault === f.id ? " on" : "")} onClick={() => pick(f.id)}>
              <b>{f.title[lang]}</b><span>{f.desc[lang]}</span>
            </button>
          ))}
          <button className={"la-fault" + (fault === "custom" ? " on" : "")} onClick={() => pick("custom")}>
            <b>{t("My own breakdown", "Своя поломка")}</b>
            <span>{t(`Current BIOS settings of this PC (${Object.keys(customCfg()).length} changed). Break it in BIOS first, then create the task here.`,
              `Текущие настройки BIOS этого компьютера (изменено: ${Object.keys(customCfg()).length}). Сначала «сломайте» его в BIOS, потом создайте задание здесь.`)}</span>
          </button>
        </div>
        <div className="la-form">
          <label>{t("Title", "Название")}<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>{t("Instructions for the student", "Пояснение для ученика")}<textarea value={desc} maxLength={600} rows={3} onChange={(e) => setDesc(e.target.value)} /></label>
          <label>{t("Goal (checked automatically)", "Цель (проверяется автоматически)")}
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {Object.entries(GOALS).map(([id, g]) => <option key={id} value={id}>{g.title[lang]}</option>)}
            </select>
          </label>
          <button className="set-btn primary" onClick={create}>{t("Create link", "Создать ссылку")}</button>
          {link && (
            <div className="la-link">
              <span>{t("Link copied — send it to your students:", "Ссылка скопирована — отправьте её ученикам:")}</span>
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
            </div>
          )}
        </div>
      </section>
      <Verify mine={mine} />
    </div>
  );
}

function Verify({ mine }: { mine: { task: Task; at: number }[] }) {
  const { t, lang } = useLang();
  const [which, setWhich] = useState(mine[0] ? "0" : "paste");
  const [pasted, setPasted] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const task = which === "paste" ? parseTask(pasted) : mine[Number(which)]?.task ?? null;

  return (
    <section>
      <h2>{t("2. Check a student’s code", "2. Проверить код ученика")}</h2>
      <div className="la-form">
        <label>{t("Task", "Задание")}
          <select value={which} onChange={(e) => { setWhich(e.target.value); setResult(null); }}>
            {mine.map((m, i) => <option key={i} value={String(i)}>{m.task.t} · {new Date(m.at).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB")}</option>)}
            <option value="paste">{t("Paste a task link…", "Вставить ссылку на задание…")}</option>
          </select>
        </label>
        {which === "paste" && <label>{t("Task link", "Ссылка на задание")}<input value={pasted} onChange={(e) => { setPasted(e.target.value); setResult(null); }} placeholder="…#task=…" /></label>}
        <label>{t("Student’s name — exactly as they typed it", "Имя ученика — как он его ввёл")}<input value={name} onChange={(e) => { setName(e.target.value); setResult(null); }} /></label>
        <label>{t("Completion code", "Код выполнения")}<input className="la-code-in" value={code} maxLength={7} onChange={(e) => { setCode(e.target.value); setResult(null); }} placeholder="ABC-123" /></label>
        <button className="set-btn primary" disabled={!task || !name.trim() || !code.trim()} onClick={() => task && setResult(verifyCode(task, name, code))}>{t("Check", "Проверить")}</button>
        {which === "paste" && pasted && !task && <p className="crit">{t("This does not look like a task link.", "Это не похоже на ссылку на задание.")}</p>}
        {result !== null && (
          <div className={"la-result " + (result ? "ok" : "bad")}>
            {result ? t(`✓ Correct: ${name.trim()} completed “${task!.t}”.`, `✓ Верно: ${name.trim()} выполнил(а) «${task!.t}».`)
              : t("✗ The code does not match this task and name.", "✗ Код не подходит к этому заданию и имени.")}
          </div>
        )}
      </div>
    </section>
  );
}
