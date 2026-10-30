// Интерфейс обучения поверх любого экрана (POST, BIOS, ОС): карточка текущего урока/задания,
// список уроков (открывается и с экрана питания), окно «задание от преподавателя» по ссылке #task=.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../machine/store";
import type { Lang } from "../machine/i18n";
import { LESSONS, lessonOf } from "./lessons";
import { GOALS, parseTask, type Task } from "./tasks";
import { attachLearning, drillGiveUp, drillHint, drillNext, leave, skipStep, startDrill, startLesson, startTask, useLearn, type Drill } from "./store";
import { DRILL, HINT_COST, SHIFT, drillFault } from "./drill";
import "./learn.css";

const LEVEL = { 1: ["Beginner", "Новичок"], 2: ["Intermediate", "Средний"], 3: ["Advanced", "Продвинутый"] } as const;

/** Список уроков с прогрессом — в окне выбора и в программе «Обучение». */
export function LessonList({ onStart }: { onStart?: () => void }) {
  const { t, lang } = useLang();
  const s = useLearn();
  const total = LESSONS.length;
  const done = LESSONS.filter((x) => s.done[x.id]).length;
  return (
    <div className="ls-list">
      <div className={"ls-drill" + (s.drill ? " active" : "")}>
        <div className="ls-drill-ico" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>
        </div>
        <div className="ls-info">
          <div className="ls-title">{t("Random breakdowns", "Случайные поломки")}</div>
          <div className="ls-sum">{t(`A shift of ${SHIFT} random faults from ${DRILL.length}. You only hear the customer’s complaint — find the cause yourself. Points for speed, hints cost ${HINT_COST}.`,
            `Смена из ${SHIFT} случайных неисправностей (всего ${DRILL.length}). Вы знаете только жалобу клиента — причину ищите сами. Очки за скорость, подсказка стоит ${HINT_COST}.`)}</div>
          <div className="ls-meta">{s.drillBest ? t(`Best shift: ${s.drillBest} points`, `Лучшая смена: ${pts(s.drillBest)}`) : t("No shifts yet", "Ещё ни одной смены")}</div>
        </div>
        <button className="ls-go" onClick={() => { startDrill(); onStart?.(); }}>{s.drill ? t("New shift", "Новая смена") : t("Start shift", "Начать смену")}</button>
      </div>
      <div className="ls-progress">
        <div className="ls-bar"><i style={{ width: `${(done / total) * 100}%` }} /></div>
        <span>{t(`${done} of ${total} lessons done`, `Пройдено ${done} из ${total}`)}</span>
      </div>
      {LESSONS.map((x, i) => (
        <div key={x.id} className={"ls-item" + (s.done[x.id] ? " done" : "") + (s.lesson === x.id ? " active" : "")}>
          <div className="ls-num">{s.done[x.id] ? "✓" : i + 1}</div>
          <div className="ls-info">
            <div className="ls-title">{x.title[lang]}</div>
            <div className="ls-sum">{x.summary[lang]}</div>
            <div className="ls-meta">{LEVEL[x.level][lang === "ru" ? 1 : 0]} · {t(`${x.minutes} min`, `${x.minutes} мин`)} · {t(`${x.steps.length} steps`, `${x.steps.length} шагов`)}</div>
          </div>
          <button className="ls-go" onClick={() => { startLesson(x.id); onStart?.(); }}>
            {s.lesson === x.id ? t("Restart", "Заново") : s.done[x.id] ? t("Again", "Ещё раз") : t("Start", "Начать")}
          </button>
        </div>
      ))}
      <p className="ls-note">{t("A lesson starts from factory BIOS settings; your own settings are saved and can be restored at the end.",
        "Урок начинается с заводских настроек BIOS; ваши настройки сохраняются, и в конце их можно вернуть.")}</p>
    </div>
  );
}

/** Плавающая карточка: шаг урока или цель задания. Перетаскивается за заголовок, сворачивается. */
function LessonCard() {
  const { t, lang } = useLang();
  const s = useLearn();
  const [hint, setHint] = useState(false);
  const [mini, setMini] = useState(false);
  // слева внизу, но выше строки подсказок BIOS; карточку можно перетащить за заголовок
  const [pos, setPos] = useState({ x: 28, y: 540 });
  const drag = useRef<{ px: number; py: number; x: number; y: number; k: number } | null>(null);
  useEffect(() => setHint(false), [s.step, s.lesson]);

  const lesson = lessonOf(s.lesson);
  const finished = lessonOf(s.finished);
  if (!lesson && !finished && !s.task && !s.drill) return null;

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const stage = document.querySelector(".stage")!.getBoundingClientRect();
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, k: stage.width / 1920 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPos({ x: Math.max(0, Math.min(1920 - 420, d.x + (e.clientX - d.px) / d.k)), y: Math.max(0, Math.min(1000, d.y + (e.clientY - d.py) / d.k)) });
  };

  let body: JSX.Element;
  let kind: string;
  let title: string;
  if (s.drill) {
    [kind, title, body] = drillCard(s.drill, s.drillBest, t, lang);
  } else if (finished) {
    kind = t("Lesson complete", "Урок пройден");
    title = finished.title[lang];
    const next = LESSONS[LESSONS.indexOf(finished) + 1];
    body = (
      <>
        <div className="lc-learned">{t("What you learned", "Что вы узнали")}</div>
        <ul className="lc-take">{finished.takeaways.map((x, i) => <li key={i}>{x[lang]}</li>)}</ul>
        <div className="lc-actions">
          {next && <button className="lc-primary" onClick={() => startLesson(next.id)}>{t("Next lesson", "Следующий урок")}</button>}
          {s.backup && <button onClick={() => leave(true)}>{t("Restore my BIOS settings", "Вернуть мои настройки BIOS")}</button>}
          <button onClick={() => leave(false)}>{t("Close", "Закрыть")}</button>
        </div>
      </>
    );
  } else if (s.task) {
    kind = t("Task from your teacher", "Задание преподавателя");
    title = s.task.t;
    const goal = GOALS[s.task.g];
    body = s.code ? (
      <>
        <div className="lc-done-big">{t("Done!", "Готово!")}</div>
        <div className="lc-code-label">{t(`Completion code for ${s.student}:`, `Код выполнения для ${s.student}:`)}</div>
        <div className="lc-code">{s.code}</div>
        <div className="lc-small">{t("Send this code to your teacher.", "Отправьте этот код преподавателю.")}</div>
        <div className="lc-actions">
          <button onClick={() => navigator.clipboard?.writeText(`${s.task!.t} — ${s.student}: ${s.code}`)}>{t("Copy", "Скопировать")}</button>
          {s.backup && <button onClick={() => leave(true)}>{t("Restore my BIOS settings", "Вернуть мои настройки BIOS")}</button>}
          <button onClick={() => leave(false)}>{t("Close", "Закрыть")}</button>
        </div>
      </>
    ) : (
      <>
        {s.task.d && <p className="lc-text">{s.task.d}</p>}
        <div className="lc-goal"><span>{t("Goal", "Цель")}</span>{goal.title[lang]}</div>
        <div className="lc-small">{t("The check is automatic. When the goal is reached you get a code for your teacher.", "Проверка автоматическая. Когда цель будет достигнута, появится код для преподавателя.")}</div>
        <div className="lc-actions"><button onClick={() => leave(true)}>{t("Give up and restore BIOS", "Сдаться и вернуть BIOS")}</button></div>
      </>
    );
  } else {
    const step = lesson!.steps[s.step];
    kind = t(`Lesson · step ${s.step + 1} of ${lesson!.steps.length}`, `Урок · шаг ${s.step + 1} из ${lesson!.steps.length}`);
    title = lesson!.title[lang];
    body = (
      <>
        <div className="lc-dots">{lesson!.steps.map((_, i) => <i key={i} className={i < s.step ? "done" : i === s.step ? "now" : ""} />)}</div>
        <p className="lc-text" key={s.step}>{step.text[lang]}</p>
        {hint && step.hint && <p className="lc-hint">{step.hint[lang]}</p>}
        <div className="lc-actions">
          {step.hint && !hint && <button onClick={() => setHint(true)}>{t("Hint", "Подсказка")}</button>}
          <button onClick={skipStep}>{t("Skip step", "Пропустить шаг")}</button>
          <button onClick={() => leave(true)}>{t("Quit lesson", "Выйти из урока")}</button>
        </div>
      </>
    );
  }

  return (
    <div className={"lesson-card" + (mini ? " mini" : "") + (finished || s.code || (s.drill?.solved && !s.drill.solved.gaveUp) || s.drill?.over ? " win" : "")} style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="lc-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }}>
        <span className="lc-kind">{kind}</span>
        <button className="lc-min" onClick={() => setMini(!mini)} aria-label="Collapse">{mini ? "▴" : "▾"}</button>
      </div>
      <div className="lc-title">{title}</div>
      {!mini && body}
    </div>
  );
}

/** 1 очко, 2 очка, 5 очков */
const pts = (n: number) => { const a = n % 10, b = n % 100; return `${n} ${a === 1 && b !== 11 ? "очко" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "очка" : "очков"}`; };

const mmss = (ms: number) => { const sec = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };

/** Секундомер текущей поломки. */
function Clock({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);
  return <span className="dr-clock">{mmss(now - since)}</span>;
}

type T = ReturnType<typeof useLang>["t"];

/** Карточка тренировки: жалоба клиента, разбор после починки, итоги смены. */
function drillCard(d: Drill, best: number, t: T, lang: Lang): [string, string, JSX.Element] {
  const score = d.results.reduce((a, r) => a + r.points, 0);
  const restore = <button onClick={() => leave(true)}>{t("Finish and restore my BIOS", "Закончить и вернуть мой BIOS")}</button>;
  if (d.over) {
    const record = score >= best && score > 0;
    return [t("Shift complete", "Смена окончена"), t(`${score} points`, pts(score)), (
      <>
        {record && <div className="dr-record">{t("New personal best!", "Новый личный рекорд!")}</div>}
        <ol className="dr-results">
          {d.results.map((r) => {
            const f = drillFault(r.id)!;
            return (
              <li key={r.id} className={r.gaveUp ? "gave" : ""}>
                <span>{f.name[lang]}<b>{r.gaveUp ? t("gave up", "сдался") : `${mmss(r.ms)} · +${r.points}`}</b></span>
              </li>
            );
          })}
        </ol>
        <div className="lc-small">{t(`Best shift: ${Math.max(best, score)} points`, `Лучшая смена: ${pts(Math.max(best, score))}`)}</div>
        <div className="lc-actions">
          <button className="lc-primary" onClick={startDrill}>{t("New shift", "Новая смена")}</button>
          {restore}
        </div>
      </>
    )];
  }
  const f = drillFault(d.queue[d.i])!;
  const kind = t(`Breakdown ${d.i + 1} of ${d.queue.length}`, `Поломка ${d.i + 1} из ${d.queue.length}`);
  const stars = "●".repeat(f.level) + "○".repeat(3 - f.level);
  if (d.solved) {
    const r = d.solved;
    return [kind, r.gaveUp ? t("Here’s what it was", "Вот в чём было дело") : t("Fixed!", "Починено!"), (
      <>
        {!r.gaveUp && <div className="dr-gain">+{r.points} <small>{t(`in ${mmss(r.ms)}${r.hints ? `, ${r.hints} hint(s)` : ""}`, `за ${mmss(r.ms)}${r.hints ? `, подсказок: ${r.hints}` : ""}`)}</small></div>}
        <p className="lc-text">{f.cause[lang]}</p>
        <div className="lc-actions">
          <button className="lc-primary" onClick={drillNext}>{d.i + 1 >= d.queue.length ? t("Shift results", "Итоги смены") : t("Next breakdown", "Следующая поломка")}</button>
          {restore}
        </div>
      </>
    )];
  }
  return [kind, t("A customer brought a PC", "Клиент принёс компьютер"), (
    <>
      <div className="dr-bar">
        <span className="dr-level" title={t("Difficulty", "Сложность")}>{stars}</span>
        <Clock since={d.started} key={d.started} />
        <span className="dr-score">{t(`${score} pts`, `${score} очк.`)}</span>
      </div>
      <p className="lc-text" key={f.id}>{f.symptom[lang]}</p>
      <div className="lc-goal"><span>{t("Done when", "Готово, когда")}</span>{GOALS[f.goal].title[lang]}{f.keep && <em>{f.keep.text[lang]}</em>}</div>
      {f.hints.slice(0, d.hints).map((h, i) => <p className="lc-hint" key={i}>{h[lang]}</p>)}
      <div className="lc-actions">
        {d.hints < 2 && <button onClick={drillHint}>{t(`Hint (−${HINT_COST})`, `Подсказка (−${HINT_COST})`)}</button>}
        <button onClick={drillGiveUp}>{t("Give up", "Сдаться")}</button>
        {restore}
      </div>
    </>
  )];
}

/** Окно выбора урока поверх экрана (с экрана питания, до загрузки ОС). */
function LessonPicker() {
  const { t } = useLang();
  const open = useLearn((s) => s.picker);
  if (!open) return null;
  return (
    <div className="learn-modal" onPointerDown={() => useLearn.setState({ picker: false })}>
      <div className="learn-sheet" onPointerDown={(e) => e.stopPropagation()}>
        <div className="lm-head">
          <h2>{t("Learn how a PC works", "Как устроен компьютер — уроки")}</h2>
          <button className="lm-x" onClick={() => useLearn.setState({ picker: false })} aria-label="Close">×</button>
        </div>
        <LessonList />
      </div>
    </div>
  );
}

/** Ссылка #task=…: предложить ученику начать задание преподавателя. */
function TaskOffer() {
  const { t, lang } = useLang();
  const [task, setTask] = useState<Task | null>(null);
  const [name, setName] = useState(useLearn.getState().student);
  useEffect(() => {
    const parsed = parseTask(location.hash);
    if (parsed) setTask(parsed);
  }, []);
  if (!task) return null;
  const close = () => { history.replaceState(null, "", location.pathname + location.search); setTask(null); };
  return (
    <div className="learn-modal">
      <div className="learn-sheet task" onPointerDown={(e) => e.stopPropagation()}>
        <div className="lc-kind">{t("Task from your teacher", "Задание преподавателя")}</div>
        <h2>{task.t}</h2>
        {task.d && <p className="lc-text">{task.d}</p>}
        <div className="lc-goal"><span>{t("Goal", "Цель")}</span>{GOALS[task.g].title[lang]}</div>
        <p className="lc-small">{t("The PC will be set up for the task. Your current BIOS settings are saved and can be restored afterwards.",
          "Компьютер будет настроен под задание. Ваши текущие настройки BIOS сохранятся, потом их можно вернуть.")}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { startTask(task, name); close(); } }}>
          <label className="lm-label">{t("Your name (the code depends on it)", "Ваше имя (от него зависит код)")}</label>
          <input className="lm-input" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t("First and last name", "Имя и фамилия")} />
          <div className="lc-actions">
            <button type="submit" className="lc-primary" disabled={!name.trim()}>{t("Start", "Начать")}</button>
            <button type="button" onClick={close}>{t("Not now", "Не сейчас")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Всё обучение целиком — подключается один раз в App. */
export function Learning() {
  useEffect(() => attachLearning(), []);
  return (
    <>
      <LessonCard />
      <LessonPicker />
      <TaskOffer />
    </>
  );
}
