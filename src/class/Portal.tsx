// Отдельные страницы вне симулятора: #teacher — кабинет учителя (классы, живые экраны учеников, удалённое
// управление, библиотека заданий, результаты и выгрузка в Excel), #admin — владелец сайта создаёт учителей.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLang, useStore } from "../machine/store";
import { defaults } from "../machine/params";
import { LESSONS, lessonOf } from "../learn/lessons";
import { DRILL } from "../learn/drill";
import { LEVELS, LIBRARY, type LibraryTask } from "../learn/library";
import { GOAL_PRESETS, goalTitle } from "../learn/goals";
import { APP_META } from "../os/apps/meta";
import { api, errorText } from "./api";
import { login, logout, refreshMe, useClass, type Snapshot } from "./store";
import "./portal.css";

const mmss = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
type T = (en: string, ru: string) => string;
type Lang = "en" | "ru";

interface Student { id: number; login: string; name: string; state: Snapshot | null; seen_at: string | null; online: boolean | null; lessons: Record<string, number>; drill_best: number }
interface AssignmentRow { id: number; title: string; descr: string; goal: string; cfg: Record<string, unknown>; minutes: number | null; level: number | null; archived: boolean; created_at: string }
interface ClassRow { id: number; name: string; code: string; open: boolean; students: number }
interface ClassData {
  teacher: { name: string; maxStudents: number; used: number };
  classes: ClassRow[];
  current: ClassRow | null;
  students: Student[];
  assignments: AssignmentRow[];
  submissions: { assignment_id: number; student_id: number; ms: number }[];
}

function Shell({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="portal">
      <header className="pt-top">
        <a className="pt-brand" href="./">
          <svg viewBox="0 0 24 24"><path d="M4 12 20 4l-5 16-3-7z" /></svg>
          Kestrel PC
        </a>
        <span className="pt-title">{title}</span>
        <div className="pt-right">{right}<LangSwitch /></div>
      </header>
      <main className="pt-main">{children}</main>
    </div>
  );
}

/** RU / EN — тот же язык, что в BIOS и ОС симулятора. */
function LangSwitch() {
  const { lang } = useLang();
  return (
    <div className="pt-lang" role="group" aria-label="Language">
      {(["ru", "en"] as const).map((x) => (
        <button key={x} className={lang === x ? "on" : ""} onClick={() => useStore.getState().setLanguage(x === "ru" ? "Русский" : "English")}>{x.toUpperCase()}</button>
      ))}
    </div>
  );
}

function useAction() {
  const { lang } = useLang();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try { await fn(); return true; } catch (e) { setError(errorText(e, lang)); return false; } finally { setBusy(false); }
  };
  return { error, busy, run, setError };
}

const LevelChip = ({ level, lang }: { level: number | null; lang: Lang }) =>
  level ? <span className={`pt-lvl l${level}`}>{LEVELS[level as 1 | 2 | 3][lang]}</span> : null;

// ——————————————— кабинет учителя ———————————————

export function TeacherPortal() {
  const { t } = useLang();
  const { status, me } = useClass();
  useEffect(() => { void refreshMe(); }, []);
  if (status === "unknown") return <Shell title={t("Teacher", "Кабинет учителя")}><p className="pt-muted">{t("Connecting…", "Подключение…")}</p></Shell>;
  if (status === "offline") return <Shell title={t("Teacher", "Кабинет учителя")}><p>{t("The teacher dashboard works on the full version of the site.", "Кабинет учителя работает на полной версии сайта.")}</p></Shell>;
  if (!me || me.role !== "teacher") return <TeacherLogin wrongRole={!!me} />;
  return <Dashboard />;
}

function TeacherLogin({ wrongRole }: { wrongRole: boolean }) {
  const { t } = useLang();
  const [f, setF] = useState({ login: "", password: "" });
  const a = useAction();
  return (
    <Shell title={t("Teacher", "Кабинет учителя")}>
      <form className="pt-card pt-login" onSubmit={(e) => { e.preventDefault(); void a.run(() => login(f.login, f.password)); }}>
        <h1>{t("Teacher sign-in", "Вход для учителя")}</h1>
        {wrongRole && <p className="pt-warn">{t("You are signed in as a student. Sign in with a teacher account.", "Вы вошли как ученик. Войдите с учётной записью учителя.")}</p>}
        <label>{t("Login", "Логин")}<input value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} autoComplete="username" /></label>
        <label>{t("Password", "Пароль")}<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></label>
        {a.error && <div className="pt-error">{a.error}</div>}
        <button className="pt-btn primary" disabled={a.busy}>{t("Sign in", "Войти")}</button>
        <p className="pt-muted">{t("Teacher accounts are created by the site administrator.", "Учётные записи учителей создаёт администратор сайта.")}</p>
      </form>
    </Shell>
  );
}

function screenText(s: Snapshot | null, online: boolean, t: T, lang: Lang) {
  if (!s || !online) return t("Offline", "Не в сети");
  if (s.phase === "off") return t("PC is off", "Компьютер выключен");
  if (s.phase === "post") return "POST";
  if (s.phase === "boot") return s.error ? `${t("Error", "Ошибка")}: ${s.error}` : t("Booting", "Загрузка");
  if (s.phase === "setup") return s.screen === "adv" ? "BIOS · Advanced" : "BIOS · EZ Mode";
  if (s.screen === "crash") return t("OS crashed!", "Сбой ОС!");
  if (s.screen === "lock") return t("Login screen", "Экран входа");
  if (s.screen === "desktop") return s.app && APP_META[s.app] ? `${t("Desktop", "Рабочий стол")} · ${APP_META[s.app].title[lang]}` : t("Desktop", "Рабочий стол");
  return t("Starting the OS", "Запуск ОС");
}

function activityText(s: Snapshot | null, t: T, lang: Lang) {
  const a = s?.activity;
  if (!a) return "";
  if (a.kind === "lesson") { const l = lessonOf(a.id); return l ? `${t("Lesson", "Урок")}: ${l.title[lang]} · ${t("step", "шаг")} ${a.step + 1}/${l.steps.length}` : ""; }
  if (a.kind === "drill") return `${t("Random breakdowns", "Случайные поломки")} · ${a.i}/${a.of} · ${a.score}`;
  return `${t("Task", "Задание")}: ${a.title}${a.done ? " ✓" : ""}`;
}

const CLASS_KEY = "kestrel.teacher.class";

function Dashboard() {
  const { t, lang } = useLang();
  const me = useClass((s) => s.me)!;
  const [classId, setClassId] = useState<number | null>(() => { try { return Number(localStorage.getItem(CLASS_KEY)) || null; } catch { return null; } });
  const [data, setData] = useState<ClassData | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [note, setNote] = useState("");
  const a = useAction();

  const load = useCallback(async () => {
    try { setData(await api<ClassData>(`teacher/class${classId ? `?class=${classId}` : ""}`)); } catch (e) { a.setError(errorText(e, lang)); }
  }, [lang, classId]);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [load]);
  const pick = (id: number) => {
    setClassId(id);
    setSel(new Set());
    try { localStorage.setItem(CLASS_KEY, String(id)); } catch { /* только на эту сессию */ }
  };

  const flash = (text: string) => { setNote(text); window.setTimeout(() => setNote(""), 2600); };
  const current = data?.current ?? null;
  const students = data?.students ?? [];
  const targets = sel.size ? [...sel] : "all";
  const targetLabel = sel.size ? t(`${sel.size} selected`, `выбрано: ${sel.size}`) : t("whole class", "весь класс");

  const command = async (kind: string, payload: Record<string, unknown> = {}, confirmText?: string) => {
    if (!current || (confirmText && !confirm(confirmText))) return;
    const ok = await a.run(() => api("teacher/command", { class: current.id, students: targets, kind, payload }));
    if (ok) flash(t("Sent. Students’ PCs will react within a few seconds.", "Отправлено. Компьютеры учеников отреагируют через несколько секунд."));
  };

  const online = students.filter((s) => s.online).length;
  const active = (data?.assignments ?? []).filter((x) => !x.archived);
  const doneBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data?.submissions ?? []) m.set(`${s.assignment_id}:${s.student_id}`, s.ms);
    return m;
  }, [data]);

  return (
    <Shell title={t("Teacher", "Кабинет учителя")} right={<><span className="pt-muted pt-hide-sm">{me.name}</span><a className="pt-btn" href="./">{t("Simulator", "Симулятор")}</a><button className="pt-btn" onClick={() => void logout()}>{t("Sign out", "Выйти")}</button></>}>
      {a.error && <div className="pt-error pt-sticky">{a.error}</div>}
      {note && <div className="pt-note">{note}</div>}

      {data && <ClassTabs data={data} onPick={pick} reload={load} />}
      {data && !current && <p className="pt-muted">{t("Create your first class.", "Создайте первый класс.")}</p>}

      {current && data && (
        <>
          <section className="pt-class">
            <ClassCard k={current} reload={load} />
            <div className="pt-card pt-stats">
              <div><b>{data.teacher.used}<small>/{data.teacher.maxStudents}</small></b><span>{t("students (all classes)", "учеников (все классы)")}</span></div>
              <div><b className="pt-green">{online}</b><span>{t("online now", "сейчас в сети")}</span></div>
              <div><b>{active.length}</b><span>{t("active tasks", "активных заданий")}</span></div>
            </div>
          </section>

          <section className="pt-card pt-control">
            <div className="pt-control-head">
              <h2>{t("Remote control", "Удалённое управление")}</h2>
              <span className="pt-muted">{t("Applies to", "Кому")}: <b>{targetLabel}</b>{sel.size > 0 && <button className="pt-link" onClick={() => setSel(new Set())}>{t("clear", "сбросить")}</button>}</span>
            </div>
            <div className="pt-row pt-wrap">
              <button className="pt-btn" onClick={() => { const text = prompt(t("Message to students:", "Сообщение ученикам:")); if (text?.trim()) void command("message", { text }); }}>{t("Message…", "Сообщение…")}</button>
              <button className="pt-btn" onClick={() => void command("lock", { text: "" })}>{t("Pause screens", "Заблокировать экраны")}</button>
              <button className="pt-btn" onClick={() => void command("unlock")}>{t("Unpause", "Разблокировать")}</button>
              <select className="pt-select" value="" onChange={(e) => { const id = Number(e.target.value); if (id) void command("assign", { id }); }}>
                <option value="">{t("Give a task…", "Выдать задание…")}</option>
                {active.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </select>
              <button className="pt-btn" onClick={() => void command("restart", {}, t("Restart the selected PCs?", "Перезагрузить выбранные компьютеры?"))}>{t("Restart", "Перезагрузить")}</button>
              <button className="pt-btn" onClick={() => void command("shutdown", {}, t("Turn off the selected PCs?", "Выключить выбранные компьютеры?"))}>{t("Turn off", "Выключить")}</button>
              <button className="pt-btn danger" onClick={() => void command("reset", {}, t("Reset BIOS to factory settings on the selected PCs?", "Сбросить BIOS к заводским настройкам на выбранных компьютерах?"))}>{t("Reset BIOS", "Сбросить BIOS")}</button>
            </div>
          </section>

          <section>
            <h2 className="pt-h2">{t("Students", "Ученики")} · {students.length}</h2>
            {students.length === 0 && <p className="pt-muted">{t("No students yet. Give them the class code.", "Учеников пока нет. Дайте им код класса.")}</p>}
            <div className="pt-grid">
              {students.map((s) => {
                const on = !!s.online;
                const doneTasks = active.filter((x) => doneBy.has(`${x.id}:${s.id}`)).length;
                const crashed = on && (s.state?.screen === "crash" || !!s.state?.error);
                return (
                  <div key={s.id} className={"pt-student" + (sel.has(s.id) ? " sel" : "") + (on ? " on" : "") + (crashed ? " alert" : "")}
                    onClick={() => setSel((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}>
                    <div className="pt-st-head">
                      <i className="pt-dot" />
                      <b>{s.name}</b>
                      {s.state?.locked && on && <span className="pt-tag">{t("paused", "пауза")}</span>}
                      <StudentMenu s={s} classes={data.classes} current={current.id} reload={load} />
                    </div>
                    <div className="pt-screen">{screenText(s.state, on, t, lang)}</div>
                    {on && s.state && s.state.phase !== "off" && <div className="pt-hw">CPU {(Number(s.state.ghz) || 0).toFixed(2)} GHz · <span className={Number(s.state.temp) >= 90 ? "pt-hot" : ""}>{Number(s.state.temp) || 0}°C</span></div>}
                    {on && <div className="pt-act">{activityText(s.state, t, lang)}</div>}
                    <div className="pt-st-foot">
                      <span>{t("Lessons", "Уроки")} {Object.keys(s.lessons).length}/{LESSONS.length}</span>
                      <span>{t("Tasks", "Задания")} {doneTasks}/{active.length}</span>
                      {s.drill_best > 0 && <span>{t("Drill", "Поломки")} {s.drill_best}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Assignments data={data} classId={current.id} reload={load} doneBy={doneBy} onAssign={(id) => void command("assign", { id })} />
          <Library classId={current.id} reload={load} onAssign={(id) => void command("assign", { id })} />
          <CustomTask classId={current.id} reload={load} />
          <Results data={data} doneBy={doneBy} />
        </>
      )}
      <ChangePassword />
    </Shell>
  );
}

/** Вкладки классов и «+ Новый класс». */
function ClassTabs({ data, onPick, reload }: { data: ClassData; onPick: (id: number) => void; reload: () => Promise<void> }) {
  const { t } = useLang();
  const a = useAction();
  const add = () => {
    const name = prompt(t("Class name, e.g. 7A:", "Название класса, например 7А:"));
    if (!name?.trim()) return;
    void a.run(async () => { const r = await api<{ id: number }>("teacher/classes", { name }); onPick(r.id); await reload(); });
  };
  return (
    <nav className="pt-tabs">
      {data.classes.map((k) => (
        <button key={k.id} className={data.current?.id === k.id ? "on" : ""} onClick={() => onPick(k.id)}>
          {k.name}<small>{k.students}</small>
        </button>
      ))}
      <button className="pt-tab-add" onClick={add}>+ {t("New class", "Новый класс")}</button>
      {a.error && <span className="pt-error">{a.error}</span>}
    </nav>
  );
}

/** Код класса, набор учеников, переименование и удаление. */
function ClassCard({ k, reload }: { k: ClassRow; reload: () => Promise<void> }) {
  const { t } = useLang();
  const a = useAction();
  const update = (body: Record<string, unknown>) => void a.run(async () => { await api("teacher/classes/update", { id: k.id, ...body }); await reload(); });
  return (
    <div className="pt-card pt-code-card">
      <span className="pt-label">{t("Class code", "Код класса")} · {k.name}</span>
      <div className={"pt-code" + (k.open ? "" : " closed")}>{k.code}</div>
      <label className="pt-switch">
        <input type="checkbox" checked={k.open} onChange={(e) => update({ open: e.target.checked })} />
        <span>{k.open ? t("Enrollment is open: students can join with the code", "Набор открыт: по коду можно зарегистрироваться")
          : t("Enrollment is closed: the code doesn’t work", "Набор закрыт: код не действует")}</span>
      </label>
      <div className="pt-row pt-wrap">
        <button className="pt-btn" onClick={() => navigator.clipboard?.writeText(k.code)}>{t("Copy", "Скопировать")}</button>
        <button className="pt-btn" onClick={() => { if (confirm(t("Make a new code? The old one stops working (students already in the class stay).", "Сделать новый код? Старый перестанет работать (ученики, которые уже в классе, останутся)."))) update({ newCode: true }); }}>{t("New code", "Новый код")}</button>
        <button className="pt-btn" onClick={() => { const name = prompt(t("Class name:", "Название класса:"), k.name); if (name?.trim()) update({ name }); }}>{t("Rename", "Переименовать")}</button>
        <button className="pt-btn danger" onClick={() => {
          if (confirm(t(`Delete class “${k.name}”? Its tasks and results are deleted; students stay without a class.`, `Удалить класс «${k.name}»? Его задания и результаты удалятся, ученики останутся без класса.`)))
            void a.run(async () => { await api("teacher/classes/delete", { id: k.id }); await reload(); });
        }}>{t("Delete class", "Удалить класс")}</button>
      </div>
      {a.error && <div className="pt-error">{a.error}</div>}
    </div>
  );
}

function StudentMenu({ s, classes, current, reload }: { s: Student; classes: ClassRow[]; current: number; reload: () => Promise<void> }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const a = useAction();
  const others = classes.filter((k) => k.id !== current);
  return (
    <div className="pt-menu" onClick={(e) => e.stopPropagation()}>
      <button className="pt-icon" onClick={() => setOpen(!open)} aria-label="Menu">⋯</button>
      {open && (
        <div className="pt-pop" onMouseLeave={() => setOpen(false)}>
          <span className="pt-muted">{t("Login", "Логин")}: {s.login}</span>
          <button onClick={() => { const p = prompt(t(`New password for ${s.name} (6+ characters):`, `Новый пароль для ${s.name} (от 6 символов):`)); if (p) void a.run(() => api("teacher/student/password", { id: s.id, password: p })).then((ok) => ok && alert(t("Password changed.", "Пароль изменён."))); setOpen(false); }}>{t("Set new password", "Задать новый пароль")}</button>
          {others.map((k) => (
            <button key={k.id} onClick={() => { void a.run(async () => { await api("teacher/student/move", { id: s.id, class: k.id }); await reload(); }); setOpen(false); }}>{t(`Move to ${k.name}`, `Перевести в ${k.name}`)}</button>
          ))}
          <button className="danger" onClick={() => { if (confirm(t(`Remove ${s.name} from the class?`, `Убрать ${s.name} из класса?`))) void a.run(async () => { await api("teacher/student/remove", { id: s.id }); await reload(); }); setOpen(false); }}>{t("Remove from class", "Убрать из класса")}</button>
          {a.error && <div className="pt-error">{a.error}</div>}
        </div>
      )}
    </div>
  );
}

function Assignments({ data, classId, reload, doneBy, onAssign }: { data: ClassData; classId: number; reload: () => Promise<void>; doneBy: Map<string, number>; onAssign: (id: number) => void }) {
  const { t, lang } = useLang();
  const [showArchived, setShowArchived] = useState(false);
  const a = useAction();
  const list = data.assignments.filter((x) => showArchived || !x.archived);
  const total = data.students.length;
  return (
    <section className="pt-card" id="tasks">
      <div className="pt-control-head">
        <h2>{t("Tasks of this class", "Задания класса")}</h2>
        <label className="pt-check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{t("show archived", "показать архив")}</label>
      </div>
      {list.length === 0 && <p className="pt-muted">{t("No tasks yet — add some from the library below.", "Заданий пока нет — добавьте из библиотеки ниже.")}</p>}
      <div className="pt-tasks">
        {list.map((x) => {
          const done = data.students.filter((s) => doneBy.has(`${x.id}:${s.id}`)).length;
          return (
            <div key={x.id} className={"pt-task" + (x.archived ? " archived" : "")}>
              <div className="pt-task-info">
                <b><LevelChip level={x.level} lang={lang} />{x.title}</b>
                <span>{goalTitle(x.goal, lang)}{x.minutes ? ` · ${t(`${x.minutes} min`, `${x.minutes} мин`)}` : ""}</span>
                <div className="pt-bar"><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
                <small>{t(`Done: ${done} of ${total}`, `Выполнили: ${done} из ${total}`)}</small>
              </div>
              <div className="pt-task-btns">
                {!x.archived && <button className="pt-btn" onClick={() => onAssign(x.id)}>{t("Give to class", "Выдать классу")}</button>}
                <button className="pt-btn" onClick={() => void a.run(async () => { await api("teacher/assignments/archive", { id: x.id, archived: !x.archived }); await reload(); })}>{x.archived ? t("Restore", "Вернуть") : t("Archive", "В архив")}</button>
              </div>
            </div>
          );
        })}
      </div>
      {a.error && <div className="pt-error">{a.error}</div>}
      <p className="pt-muted">{t("The student’s PC checks the goal, then the server re-checks the BIOS settings against the PC model and the time limit — guessing doesn’t work.",
        "Цель проверяет компьютер ученика, а затем сервер перепроверяет его настройки BIOS по модели компьютера и лимит времени — «угадать» не получится.")}</p>
    </section>
  );
}

/** 30 готовых заданий трёх уровней с ответами для учителя. */
function Library({ classId, reload, onAssign }: { classId: number; reload: () => Promise<void>; onAssign: (id: number) => void }) {
  const { t, lang } = useLang();
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [answers, setAnswers] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const a = useAction();
  const list = LIBRARY.filter((x) => !level || x.level === level);
  const add = (x: LibraryTask, give: boolean) => void a.run(async () => {
    const r = await api<{ id: number }>("teacher/assignments", { class: classId, title: x.title[lang], descr: x.descr[lang], goal: x.goal, cfg: x.cfg, minutes: x.minutes, level: x.level });
    setAdded((p) => ({ ...p, [x.id]: true }));
    await reload();
    if (give) onAssign(r.id);
  });
  return (
    <section className="pt-card">
      <div className="pt-control-head">
        <h2>{t("Task library", "Библиотека заданий")} · {LIBRARY.length}</h2>
        <label className="pt-check"><input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />{t("show answers", "показать ответы")}</label>
      </div>
      <div className="pt-seg">
        {([0, 1, 2, 3] as const).map((n) => (
          <button key={n} className={level === n ? "on" : ""} onClick={() => setLevel(n)}>
            {n ? LEVELS[n][lang] : t("All", "Все")} <small>{n ? LIBRARY.filter((x) => x.level === n).length : LIBRARY.length}</small>
          </button>
        ))}
      </div>
      {a.error && <div className="pt-error">{a.error}</div>}
      <div className="pt-lib">
        {list.map((x) => (
          <div key={x.id} className="pt-lib-item">
            <div className="pt-lib-top"><LevelChip level={x.level} lang={lang} /><span className="pt-muted">{t(`${x.minutes} min`, `${x.minutes} мин`)}</span></div>
            <b>{x.title[lang]}</b>
            <p>{x.descr[lang]}</p>
            <small className="pt-muted">{t("Goal", "Цель")}: {goalTitle(x.goal, lang)}</small>
            {answers && <div className="pt-answer">{x.answer[lang]}</div>}
            <div className="pt-row">
              <button className="pt-btn" disabled={a.busy} onClick={() => add(x, false)}>{added[x.id] ? t("Added ✓", "Добавлено ✓") : t("Add", "Добавить")}</button>
              <button className="pt-btn primary" disabled={a.busy} onClick={() => add(x, true)}>{t("Add and give", "Добавить и выдать")}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Своё задание: поломка — текущие настройки BIOS в симуляторе этого браузера. */
function CustomTask({ classId, reload }: { classId: number; reload: () => Promise<void> }) {
  const { t, lang } = useLang();
  const saved = useStore((s) => s.saved);
  const [title, setTitle] = useState("");
  const [descr, setDescr] = useState("");
  const [goal, setGoal] = useState("boot");
  const [minutes, setMinutes] = useState("10");
  const [level, setLevel] = useState("2");
  const [ok, setOk] = useState(false);
  const a = useAction();
  const cfg = useMemo(() => {
    const d = defaults();
    return Object.fromEntries(Object.keys(d).filter((k) => k !== "setupPassword" && k !== "language" && JSON.stringify(saved[k]) !== JSON.stringify(d[k])).map((k) => [k, saved[k]]));
  }, [saved]);
  const changed = Object.keys(cfg).length;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void a.run(async () => {
      await api("teacher/assignments", { class: classId, title, descr, goal, cfg, minutes: Number(minutes) || null, level: Number(level) || null });
      setOk(true); setTitle(""); setDescr("");
      await reload();
    });
  };
  return (
    <details className="pt-card pt-details">
      <summary>{t("My own task (from the simulator’s BIOS)", "Своё задание (поломка из BIOS симулятора)")}</summary>
      <form className="pt-form pt-custom" onSubmit={submit}>
        <p className="pt-muted">{t("Open the simulator in this browser, “break” the PC in BIOS and save (F10). The changed settings become the task.",
          "Откройте симулятор в этом браузере, «сломайте» компьютер в BIOS и сохраните (F10). Изменённые настройки станут поломкой задания.")}</p>
        <div className={"pt-diff" + (changed ? "" : " empty")}>{changed ? t(`Changed in BIOS: ${changed} — ${Object.keys(cfg).join(", ")}`, `Изменено в BIOS: ${changed} — ${Object.keys(cfg).join(", ")}`)
          : t("BIOS here is at factory settings — the task will have no breakdown, only a goal.", "BIOS здесь заводской — у задания будет только цель, без поломки.")}</div>
        <label>{t("Title", "Название")}<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>{t("What the student sees", "Что видит ученик")}<textarea rows={2} value={descr} maxLength={600} onChange={(e) => setDescr(e.target.value)} /></label>
        <label>{t("Goal (checked automatically)", "Цель (проверяется автоматически)")}
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>{GOAL_PRESETS.map((id) => <option key={id} value={id}>{goalTitle(id, lang)}</option>)}</select>
        </label>
        <div className="pt-row">
          <label>{t("Time limit, min", "Лимит, мин")}<input type="number" min={1} max={180} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={t("none", "без лимита")} /></label>
          <label>{t("Level", "Уровень")}
            <select value={level} onChange={(e) => setLevel(e.target.value)}>{([1, 2, 3] as const).map((n) => <option key={n} value={n}>{LEVELS[n][lang]}</option>)}</select>
          </label>
        </div>
        {a.error && <div className="pt-error">{a.error}</div>}
        {ok && <div className="pt-ok">{t("Task created.", "Задание создано.")}</div>}
        <button className="pt-btn primary" disabled={a.busy}>{t("Create task", "Создать задание")}</button>
      </form>
    </details>
  );
}

/** Таблица результатов и выгрузка для Excel (CSV: «;», UTF-8 с BOM — так его правильно открывает русский Excel). */
function Results({ data, doneBy }: { data: ClassData; doneBy: Map<string, number> }) {
  const { t, lang } = useLang();
  if (!data.students.length) return null;
  const tasks = data.assignments.filter((x) => !x.archived);
  const exportCsv = () => {
    const cell = (v: string | number) => { const s = String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = [t("Student", "Ученик"), t("Login", "Логин"), t("Lessons done", "Уроков пройдено"), ...LESSONS.map((l) => l.title[lang]),
      t("Breakdowns record", "Рекорд «Поломок»"), t("Tasks done", "Заданий выполнено"), ...tasks.map((x) => `${x.title} (${t("min:sec", "мин:сек")})`)];
    const rows = data.students.map((s) => [s.name, s.login, `${Object.keys(s.lessons).length}/${LESSONS.length}`,
      ...LESSONS.map((l) => (s.lessons[l.id] ? "✓" : "")), s.drill_best || "",
      `${tasks.filter((x) => doneBy.has(`${x.id}:${s.id}`)).length}/${tasks.length}`,
      ...tasks.map((x) => { const ms = doneBy.get(`${x.id}:${s.id}`); return ms === undefined ? "" : mmss(ms); })]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Kestrel — ${data.current?.name ?? "class"} — ${new Date().toLocaleDateString("ru-RU")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="pt-card pt-results">
      <div className="pt-control-head">
        <h2>{t("Results", "Результаты")}</h2>
        <button className="pt-btn" onClick={exportCsv}>{t("Download for Excel", "Скачать для Excel")}</button>
      </div>
      <div className="pt-table-wrap">
        <table className="pt-table">
          <thead>
            <tr>
              <th>{t("Student", "Ученик")}</th>
              {LESSONS.map((l, i) => <th key={l.id} title={l.title[lang]}>{t("L", "У")}{i + 1}</th>)}
              <th title={`${t("Random breakdowns", "Случайные поломки")}: ${DRILL.length}`}>{t("Drill", "Поломки")}</th>
              {tasks.map((x) => <th key={x.id} title={x.title}>{x.title.length > 14 ? x.title.slice(0, 13) + "…" : x.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                {LESSONS.map((l) => <td key={l.id} className={s.lessons[l.id] ? "ok" : ""}>{s.lessons[l.id] ? "✓" : "·"}</td>)}
                <td>{s.drill_best || "·"}</td>
                {tasks.map((x) => { const ms = doneBy.get(`${x.id}:${s.id}`); return <td key={x.id} className={ms !== undefined ? "ok" : ""}>{ms !== undefined ? mmss(ms) : "·"}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChangePassword() {
  const { t } = useLang();
  const [f, setF] = useState({ old: "", password: "" });
  const [done, setDone] = useState(false);
  const a = useAction();
  return (
    <details className="pt-card pt-details">
      <summary>{t("Change my password", "Сменить мой пароль")}</summary>
      <form className="pt-form" onSubmit={(e) => { e.preventDefault(); void a.run(() => api("me/password", f)).then((ok) => { if (ok) { setDone(true); setF({ old: "", password: "" }); } }); }}>
        <label>{t("Current password", "Текущий пароль")}<input type="password" value={f.old} onChange={(e) => setF({ ...f, old: e.target.value })} autoComplete="current-password" /></label>
        <label>{t("New password (6+ characters)", "Новый пароль (от 6 символов)")}<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></label>
        {a.error && <div className="pt-error">{a.error}</div>}
        {done && <div className="pt-ok">{t("Password changed.", "Пароль изменён.")}</div>}
        <button className="pt-btn primary" disabled={a.busy}>{t("Change", "Сменить")}</button>
      </form>
    </details>
  );
}

// ——————————————— администратор ———————————————

interface TeacherRow { id: number; login: string; name: string; codes: string | null; max_students: number; students: number; created_at: string }
const ADMIN_KEY = "kestrel.admin";

export function AdminPortal() {
  const { t } = useLang();
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem(ADMIN_KEY) ?? ""; } catch { return ""; } });
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<TeacherRow[] | null>(null);
  const a = useAction();
  const call = (route: string, body?: unknown) => api(route, body, { "x-admin-key": key });

  const load = useCallback(async () => {
    if (!key) return;
    const ok = await a.run(async () => setRows((await api<{ teachers: TeacherRow[] }>("admin/teachers", undefined, { "x-admin-key": key })).teachers));
    if (!ok) setRows(null);
  }, [key]);
  useEffect(() => { void load(); }, [load]);

  const enter = (e: FormEvent) => {
    e.preventDefault();
    try { sessionStorage.setItem(ADMIN_KEY, input.trim()); } catch { /* только на эту вкладку */ }
    setKey(input.trim());
    setInput("");
  };
  const exit = () => { try { sessionStorage.removeItem(ADMIN_KEY); } catch { /* */ } setKey(""); setRows(null); };

  if (!key || !rows) {
    return (
      <Shell title={t("Administrator", "Администратор")}>
        <form className="pt-card pt-login" onSubmit={enter}>
          <h1>{t("Administrator", "Администратор")}</h1>
          <p className="pt-muted">{t("Enter the ADMIN_KEY (the .env.admin file of the project). It is kept only in this browser tab.",
            "Введите ADMIN_KEY (файл .env.admin в папке проекта). Ключ хранится только в этой вкладке браузера.")}</p>
          <label>{t("Admin key", "Ключ администратора")}<input type="password" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" /></label>
          {a.error && <div className="pt-error">{a.error}</div>}
          <button className="pt-btn primary" disabled={!input.trim() || a.busy}>{t("Enter", "Войти")}</button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title={t("Administrator", "Администратор")} right={<button className="pt-btn" onClick={exit}>{t("Lock", "Выйти")}</button>}>
      {a.error && <div className="pt-error pt-sticky">{a.error}</div>}
      <section className="pt-two">
        <NewTeacher call={call} reload={load} />
        <div className="pt-card">
          <h2>{t("Teachers", "Учителя")} · {rows.length}</h2>
          {rows.length === 0 && <p className="pt-muted">{t("No teachers yet.", "Учителей пока нет.")}</p>}
          <div className="pt-table-wrap">
            <table className="pt-table pt-admin-table">
              <thead><tr><th>{t("Name", "Имя")}</th><th>{t("Login", "Логин")}</th><th>{t("Class codes", "Коды классов")}</th><th>{t("Students", "Учеников")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.login}</td>
                    <td className="pt-mono">{r.codes ?? "—"}</td>
                    <td>
                      {r.students} / <button className="pt-link" onClick={() => { const v = prompt(t("Student limit:", "Лимит учеников:"), String(r.max_students)); if (v) void a.run(async () => { await call("admin/teachers/update", { id: r.id, maxStudents: Number(v) }); await load(); }); }}>{r.max_students}</button>
                    </td>
                    <td className="pt-actions">
                      <button className="pt-link" onClick={() => { const p = prompt(t(`New password for ${r.name}:`, `Новый пароль для ${r.name}:`)); if (p) void a.run(() => call("admin/teachers/update", { id: r.id, password: p })).then((ok) => ok && alert(t("Password changed.", "Пароль изменён."))); }}>{t("password", "пароль")}</button>
                      <button className="pt-link danger" onClick={() => { if (confirm(t(`Delete ${r.name}? Their classes and tasks are deleted, students stay without a class.`, `Удалить ${r.name}? Его классы и задания удалятся, ученики останутся без класса.`))) void a.run(async () => { await call("admin/teachers/delete", { id: r.id }); await load(); }); }}>{t("delete", "удалить")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function NewTeacher({ call, reload }: { call: (route: string, body?: unknown) => Promise<any>; reload: () => Promise<void> }) {
  const { t } = useLang();
  const [f, setF] = useState({ name: "", login: "", password: "", maxStudents: "30" });
  const [created, setCreated] = useState<{ login: string; code: string } | null>(null);
  const a = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void a.run(async () => {
      const r = await call("admin/teachers", { ...f, login: f.login.trim().toLowerCase(), maxStudents: Number(f.maxStudents) });
      setCreated({ login: f.login.trim().toLowerCase(), code: r.classCode });
      setF({ name: "", login: "", password: "", maxStudents: f.maxStudents });
      await reload();
    });
  };
  return (
    <form className="pt-card pt-form" onSubmit={submit}>
      <h2>{t("New teacher", "Новый учитель")}</h2>
      <label>{t("Name", "Имя")}<input value={f.name} onChange={set("name")} maxLength={60} placeholder={t("Anna Smith", "Ирина Петровна Иванова")} /></label>
      <label>{t("Login", "Логин")}<input value={f.login} onChange={set("login")} maxLength={32} placeholder="i.ivanova" autoComplete="off" /></label>
      <label>{t("Initial password (6+ characters)", "Начальный пароль (от 6 символов)")}<input value={f.password} onChange={set("password")} maxLength={128} autoComplete="new-password" /></label>
      <label>{t("Student limit (all classes)", "Сколько учеников можно подключить (во всех классах)")}<input type="number" min={1} max={500} value={f.maxStudents} onChange={set("maxStudents")} /></label>
      {a.error && <div className="pt-error">{a.error}</div>}
      {created && <div className="pt-ok">{t(`Created: ${created.login}, first class code ${created.code}. Give the teacher the login and password; they can change it in the dashboard.`, `Создан: ${created.login}, код первого класса ${created.code}. Передайте учителю логин и пароль — сменить пароль можно в кабинете.`)}</div>}
      <button className="pt-btn primary" disabled={a.busy}>{t("Create teacher", "Создать учителя")}</button>
      <p className="pt-muted">{t("Teacher dashboard address:", "Адрес кабинета учителя:")} <span className="pt-mono">{location.origin + location.pathname}#teacher</span></p>
    </form>
  );
}
