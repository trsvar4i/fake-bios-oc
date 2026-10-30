// Отдельные страницы вне симулятора: #teacher — кабинет учителя (класс, живые экраны учеников, удалённое
// управление, задания и результаты), #admin — владелец сайта создаёт учителей и задаёт лимит учеников.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLang } from "../machine/store";
import { LESSONS, lessonOf } from "../learn/lessons";
import { FAULTS, GOALS } from "../learn/tasks";
import { DRILL } from "../learn/drill";
import { APP_META } from "../os/apps/meta";
import { api, errorText } from "./api";
import { login, logout, refreshMe, useClass, type Snapshot } from "./store";
import "./portal.css";

const mmss = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

interface Student { id: number; login: string; name: string; state: Snapshot | null; seen_at: string | null; online: boolean | null; lessons: Record<string, number>; drill_best: number }
interface AssignmentRow { id: number; title: string; descr: string; goal: string; cfg: Record<string, unknown>; archived: boolean; created_at: string }
interface ClassData { teacher: { name: string; classCode: string; maxStudents: number }; students: Student[]; assignments: AssignmentRow[]; submissions: { assignment_id: number; student_id: number; ms: number }[] }

function Shell({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="portal">
      <header className="pt-top">
        <a className="pt-brand" href="./">
          <svg viewBox="0 0 24 24"><path d="M4 12 20 4l-5 16-3-7z" /></svg>
          Kestrel PC
        </a>
        <span className="pt-title">{title}</span>
        <div className="pt-right">{right}</div>
      </header>
      <main className="pt-main">{children}</main>
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

function screenText(s: Snapshot | null, online: boolean, t: (en: string, ru: string) => string, lang: "en" | "ru") {
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

function activityText(s: Snapshot | null, t: (en: string, ru: string) => string, lang: "en" | "ru") {
  const a = s?.activity;
  if (!a) return "";
  if (a.kind === "lesson") { const l = lessonOf(a.id); return l ? `${t("Lesson", "Урок")}: ${l.title[lang]} · ${t("step", "шаг")} ${a.step + 1}/${l.steps.length}` : ""; }
  if (a.kind === "drill") return `${t("Random breakdowns", "Случайные поломки")} · ${a.i}/${a.of} · ${a.score}`;
  return `${t("Task", "Задание")}: ${a.title}${a.done ? " ✓" : ""}`;
}

function Dashboard() {
  const { t, lang } = useLang();
  const me = useClass((s) => s.me)!;
  const [data, setData] = useState<ClassData | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [note, setNote] = useState("");
  const a = useAction();

  const load = useCallback(async () => {
    try { setData(await api<ClassData>("teacher/class")); } catch (e) { a.setError(errorText(e, lang)); }
  }, [lang]);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [load]);

  const flash = (text: string) => { setNote(text); window.setTimeout(() => setNote(""), 2600); };
  const students = data?.students ?? [];
  const targets = sel.size ? [...sel] : "all";
  const targetLabel = sel.size ? t(`${sel.size} selected`, `выбрано: ${sel.size}`) : t("whole class", "весь класс");

  const command = async (kind: string, payload: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    const ok = await a.run(() => api("teacher/command", { students: targets, kind, payload }));
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
    <Shell title={t("Teacher", "Кабинет учителя")} right={<><span className="pt-muted">{me.name}</span><a className="pt-btn" href="./">{t("Simulator", "Симулятор")}</a><button className="pt-btn" onClick={() => void logout()}>{t("Sign out", "Выйти")}</button></>}>
      {a.error && <div className="pt-error pt-sticky">{a.error}</div>}
      {note && <div className="pt-note">{note}</div>}

      <section className="pt-class">
        <div className="pt-card pt-code-card">
          <span className="pt-label">{t("Class code", "Код класса")}</span>
          <div className="pt-code">{data?.teacher.classCode ?? "······"}</div>
          <span className="pt-muted">{t("Students enter it when they register in the simulator: Learn → My class.", "Ученики вводят его при регистрации в симуляторе: «Обучение» → «Мой класс».")}</span>
          <div className="pt-row">
            <button className="pt-btn" onClick={() => navigator.clipboard?.writeText(data?.teacher.classCode ?? "")}>{t("Copy", "Скопировать")}</button>
            <button className="pt-btn" onClick={() => { if (confirm(t("Make a new code? The old one stops working (students already in the class stay).", "Сделать новый код? Старый перестанет работать (ученики, которые уже в классе, останутся)."))) void a.run(async () => { await api("teacher/code", {}); await load(); }); }}>{t("New code", "Новый код")}</button>
          </div>
        </div>
        <div className="pt-card pt-stats">
          <div><b>{students.length}<small>/{data?.teacher.maxStudents ?? "–"}</small></b><span>{t("students", "учеников")}</span></div>
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
        <h2 className="pt-h2">{t("Students", "Ученики")}</h2>
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
                  <StudentMenu s={s} reload={load} />
                </div>
                <div className="pt-screen">{screenText(s.state, on, t, lang)}</div>
                {on && s.state && s.state.phase !== "off" && <div className="pt-hw">CPU {s.state.ghz.toFixed(2)} GHz · <span className={s.state.temp >= 90 ? "pt-hot" : ""}>{s.state.temp}°C</span></div>}
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

      <Assignments data={data} reload={load} doneBy={doneBy} onAssign={(id) => void command("assign", { id })} />
      <Results data={data} doneBy={doneBy} />
      <ChangePassword />
    </Shell>
  );
}

function StudentMenu({ s, reload }: { s: Student; reload: () => Promise<void> }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const a = useAction();
  return (
    <div className="pt-menu" onClick={(e) => e.stopPropagation()}>
      <button className="pt-icon" onClick={() => setOpen(!open)} aria-label="Menu">⋯</button>
      {open && (
        <div className="pt-pop" onMouseLeave={() => setOpen(false)}>
          <span className="pt-muted">{t("Login", "Логин")}: {s.login}</span>
          <button onClick={() => { const p = prompt(t(`New password for ${s.name} (6+ characters):`, `Новый пароль для ${s.name} (от 6 символов):`)); if (p) void a.run(() => api("teacher/student/password", { id: s.id, password: p })).then((ok) => ok && alert(t("Password changed.", "Пароль изменён."))); setOpen(false); }}>{t("Set new password", "Задать новый пароль")}</button>
          <button className="danger" onClick={() => { if (confirm(t(`Remove ${s.name} from the class?`, `Убрать ${s.name} из класса?`))) void a.run(async () => { await api("teacher/student/remove", { id: s.id }); await reload(); }); setOpen(false); }}>{t("Remove from class", "Убрать из класса")}</button>
          {a.error && <div className="pt-error">{a.error}</div>}
        </div>
      )}
    </div>
  );
}

function Assignments({ data, reload, doneBy, onAssign }: { data: ClassData | null; reload: () => Promise<void>; doneBy: Map<string, number>; onAssign: (id: number) => void }) {
  const { t, lang } = useLang();
  const [fault, setFault] = useState(FAULTS[0].id);
  const preset = FAULTS.find((f) => f.id === fault)!;
  const [title, setTitle] = useState(preset.title[lang]);
  const [descr, setDescr] = useState(preset.desc[lang]);
  const [goal, setGoal] = useState(preset.goal);
  const [showArchived, setShowArchived] = useState(false);
  const a = useAction();
  const pick = (id: string) => { const f = FAULTS.find((x) => x.id === id)!; setFault(id); setTitle(f.title[lang]); setDescr(f.desc[lang]); setGoal(f.goal); };
  const create = (e: FormEvent) => {
    e.preventDefault();
    void a.run(async () => { await api("teacher/assignments", { title, descr, goal, cfg: preset.cfg }); await reload(); });
  };
  const list = (data?.assignments ?? []).filter((x) => showArchived || !x.archived);
  const total = data?.students.length ?? 0;
  return (
    <section className="pt-two">
      <form className="pt-card pt-form" onSubmit={create}>
        <h2>{t("New task", "Новое задание")}</h2>
        <label>{t("What is broken", "Что сломано")}
          <select value={fault} onChange={(e) => pick(e.target.value)}>
            {FAULTS.map((f) => <option key={f.id} value={f.id}>{f.title[lang]}</option>)}
          </select>
        </label>
        <label>{t("Title", "Название")}<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>{t("Instructions", "Пояснение")}<textarea rows={3} value={descr} maxLength={600} onChange={(e) => setDescr(e.target.value)} /></label>
        <label>{t("Goal (checked automatically)", "Цель (проверяется автоматически)")}
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>{Object.entries(GOALS).map(([id, g]) => <option key={id} value={id}>{g.title[lang]}</option>)}</select>
        </label>
        {a.error && <div className="pt-error">{a.error}</div>}
        <button className="pt-btn primary" disabled={a.busy}>{t("Create task", "Создать задание")}</button>
        <p className="pt-muted">{t("Students see it in “My class”. To start it on their PCs right away, press “Give to class”.", "Ученики увидят его в «Моём классе». Чтобы сразу запустить на их компьютерах, нажмите «Выдать классу».")}</p>
      </form>
      <div className="pt-card">
        <div className="pt-control-head">
          <h2>{t("Tasks", "Задания")}</h2>
          <label className="pt-check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{t("show archived", "показать архив")}</label>
        </div>
        {list.length === 0 && <p className="pt-muted">{t("No tasks yet.", "Заданий пока нет.")}</p>}
        <div className="pt-tasks">
          {list.map((x) => {
            const done = (data?.students ?? []).filter((s) => doneBy.has(`${x.id}:${s.id}`)).length;
            return (
              <div key={x.id} className={"pt-task" + (x.archived ? " archived" : "")}>
                <div className="pt-task-info">
                  <b>{x.title}</b>
                  <span>{GOALS[x.goal]?.title[lang]}</span>
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
      </div>
    </section>
  );
}

function Results({ data, doneBy }: { data: ClassData | null; doneBy: Map<string, number> }) {
  const { t, lang } = useLang();
  if (!data || !data.students.length) return null;
  const tasks = data.assignments.filter((x) => !x.archived);
  return (
    <section className="pt-card pt-results">
      <h2>{t("Results", "Результаты")}</h2>
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

interface TeacherRow { id: number; login: string; name: string; class_code: string; max_students: number; students: number; created_at: string }
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
    if (!ok) { setRows(null); }
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
          <p className="pt-muted">{t("Enter the ADMIN_KEY from the Vercel project settings (Environment Variables). It is kept only in this browser tab.",
            "Введите ADMIN_KEY из настроек проекта Vercel (Environment Variables). Ключ хранится только в этой вкладке браузера.")}</p>
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
          <table className="pt-table pt-admin-table">
            <thead><tr><th>{t("Name", "Имя")}</th><th>{t("Login", "Логин")}</th><th>{t("Code", "Код")}</th><th>{t("Students", "Учеников")}</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.login}</td>
                  <td className="pt-mono">{r.class_code}</td>
                  <td>
                    {r.students} / <button className="pt-link" onClick={() => { const v = prompt(t("Student limit:", "Лимит учеников:"), String(r.max_students)); if (v) void a.run(async () => { await call("admin/teachers/update", { id: r.id, maxStudents: Number(v) }); await load(); }); }}>{r.max_students}</button>
                  </td>
                  <td className="pt-actions">
                    <button className="pt-link" onClick={() => { const p = prompt(t(`New password for ${r.name}:`, `Новый пароль для ${r.name}:`)); if (p) void a.run(() => call("admin/teachers/update", { id: r.id, password: p })).then((ok) => ok && alert(t("Password changed.", "Пароль изменён."))); }}>{t("password", "пароль")}</button>
                    <button className="pt-link danger" onClick={() => { if (confirm(t(`Delete ${r.name}? Their tasks are deleted, students stay without a class.`, `Удалить ${r.name}? Его задания удалятся, ученики останутся без класса.`))) void a.run(async () => { await call("admin/teachers/delete", { id: r.id }); await load(); }); }}>{t("delete", "удалить")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      <label>{t("Student limit", "Сколько учеников можно подключить")}<input type="number" min={1} max={500} value={f.maxStudents} onChange={set("maxStudents")} /></label>
      {a.error && <div className="pt-error">{a.error}</div>}
      {created && <div className="pt-ok">{t(`Created: ${created.login}, class code ${created.code}. Give the teacher the login and password; they can change it in the dashboard.`, `Создан: ${created.login}, код класса ${created.code}. Передайте учителю логин и пароль — сменить его можно в кабинете.`)}</div>}
      <button className="pt-btn primary" disabled={a.busy}>{t("Create teacher", "Создать учителя")}</button>
      <p className="pt-muted">{t("Teacher dashboard address:", "Адрес кабинета учителя:")} <span className="pt-mono">{location.origin + location.pathname}#teacher</span></p>
    </form>
  );
}
