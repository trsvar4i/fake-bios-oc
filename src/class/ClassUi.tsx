// Класс в симуляторе: панель «Мой класс» (вход, регистрация по коду класса, задания учителя)
// и то, что учитель делает удалённо: сообщение и блокировка экрана.
import { useEffect, useState, type FormEvent } from "react";
import { useLang } from "../machine/store";
import { GOALS } from "../learn/tasks";
import { errorText } from "./api";
import { attachClass, joinClass, leaveClass, login, logout, register, startAssignment, useClass } from "./store";
import "./class.css";

const mmss = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** Адрес полной версии (с сервером класса) — для статической копии на GitHub Pages. */
export const FULL_SITE = "https://kestrel-pc.vercel.app/";

function useSubmit(fn: () => Promise<unknown>) {
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try { await fn(); } catch (err) { setError(errorText(err, lang)); } finally { setBusy(false); }
  };
  return { busy, error, submit };
}

function Auth() {
  const { t } = useLang();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ login: "", name: "", password: "", code: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const { busy, error, submit } = useSubmit(() => (mode === "login" ? login(f.login, f.password) : register(f)));
  return (
    <form className="cl-auth" onSubmit={submit}>
      <div className="cl-seg">
        <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>{t("Sign in", "Вход")}</button>
        <button type="button" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>{t("I’m new", "Регистрация")}</button>
      </div>
      {mode === "register" && (
        <>
          <label>{t("Class code from your teacher", "Код класса от учителя")}<input className="cl-code-in" value={f.code} onChange={set("code")} maxLength={6} placeholder="ABC123" autoComplete="off" /></label>
          <label>{t("First and last name", "Имя и фамилия")}<input value={f.name} onChange={set("name")} maxLength={60} autoComplete="name" /></label>
        </>
      )}
      <label>{t("Login", "Логин")}<input value={f.login} onChange={set("login")} maxLength={32} autoComplete="username" placeholder="ivan.petrov" /></label>
      <label>{t("Password", "Пароль")}<input type="password" value={f.password} onChange={set("password")} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
      {error && <div className="cl-error">{error}</div>}
      <button className="cl-primary" disabled={busy}>{mode === "login" ? t("Sign in", "Войти") : t("Create account and join", "Создать аккаунт и войти в класс")}</button>
    </form>
  );
}

function Join() {
  const { t } = useLang();
  const [code, setCode] = useState("");
  const { busy, error, submit } = useSubmit(() => joinClass(code));
  return (
    <form className="cl-join" onSubmit={submit}>
      <p>{t("You are not in a class. Enter the code from your teacher:", "Вы не в классе. Введите код от учителя:")}</p>
      <div className="cl-row">
        <input className="cl-code-in" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="ABC123" />
        <button className="cl-primary" disabled={busy || code.trim().length !== 6}>{t("Join", "Войти в класс")}</button>
      </div>
      {error && <div className="cl-error">{error}</div>}
    </form>
  );
}

/** «Мой класс»: в программе «Обучение» и в окне с экрана питания. */
export function ClassPanel({ onStart }: { onStart?: () => void }) {
  const { t, lang } = useLang();
  const s = useClass();
  if (s.status === "unknown") return <div className="cl-panel"><p className="cl-note">{t("Connecting…", "Подключение…")}</p></div>;
  if (s.status === "offline") {
    return (
      <div className="cl-panel">
        <p>{t("Classes with a teacher work on the full version of the site.", "Занятия с учителем работают на полной версии сайта.")}</p>
        <a className="cl-primary cl-link" href={FULL_SITE}>{t("Open the full version", "Открыть полную версию")}</a>
      </div>
    );
  }
  if (!s.me) {
    return (
      <div className="cl-panel">
        <p className="cl-note">{t("Sign in to get tasks from your teacher. Your teacher sees your progress and can help remotely.",
          "Войдите, чтобы получать задания учителя. Учитель видит ваш прогресс и может помочь удалённо.")}</p>
        <Auth />
        <a className="cl-teacher-link" href="#teacher">{t("I’m a teacher →", "Я учитель →")}</a>
      </div>
    );
  }
  if (s.me.role === "teacher") {
    return (
      <div className="cl-panel">
        <p>{t(`Signed in as teacher ${s.me.name}.`, `Вы вошли как учитель: ${s.me.name}.`)}</p>
        <div className="cl-row">
          <a className="cl-primary cl-link" href="#teacher">{t("Open the teacher dashboard", "Открыть кабинет учителя")}</a>
          <button className="cl-ghost" onClick={() => void logout()}>{t("Sign out", "Выйти")}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="cl-panel">
      <div className="cl-who">
        <div className="cl-avatar">{s.me.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <b>{s.me.name}</b>
          <span>{s.teacher ? t(`Class of ${s.teacher.name}`, `Класс: ${s.teacher.name}`) : t("No class", "Без класса")} · {s.me.login}</span>
        </div>
        <button className="cl-ghost" onClick={() => void logout()}>{t("Sign out", "Выйти")}</button>
      </div>
      {!s.teacher ? <Join /> : (
        <>
          <h3>{t("Tasks", "Задания")}</h3>
          {s.assignments.length === 0 && <p className="cl-note">{t("No tasks yet. Your teacher will add them.", "Заданий пока нет — их добавит учитель.")}</p>}
          <div className="cl-tasks">
            {s.assignments.map((a) => (
              <div key={a.id} className={"cl-task" + (a.done_ms !== null ? " done" : "") + (s.active?.id === a.id ? " active" : "")}>
                <div className="cl-task-info">
                  <b>{a.title}</b>
                  {a.descr && <span>{a.descr}</span>}
                  <small>{GOALS[a.goal]?.title[lang]}</small>
                </div>
                {a.done_ms !== null && <div className="cl-done">✓ {mmss(a.done_ms)}</div>}
                <button className="cl-primary" onClick={() => { startAssignment(a); onStart?.(); }}>
                  {s.active?.id === a.id ? t("Restart", "Заново") : a.done_ms !== null ? t("Again", "Ещё раз") : t("Start", "Начать")}
                </button>
              </div>
            ))}
          </div>
          <button className="cl-ghost cl-leave" onClick={() => { if (confirm(t("Leave the class?", "Выйти из класса?"))) void leaveClass(); }}>{t("Leave class", "Выйти из класса")}</button>
        </>
      )}
    </div>
  );
}

/** Сообщение и блокировка экрана от учителя — поверх всего. */
function Overlays() {
  const { t } = useLang();
  const { message, lock } = useClass();
  // блокировка: клавиатура не доходит ни до BIOS, ни до ОС
  useEffect(() => {
    if (lock === null) return;
    const stop = (e: KeyboardEvent) => { e.stopImmediatePropagation(); e.preventDefault(); };
    window.addEventListener("keydown", stop, true);
    window.addEventListener("keyup", stop, true);
    return () => { window.removeEventListener("keydown", stop, true); window.removeEventListener("keyup", stop, true); };
  }, [lock]);
  return (
    <>
      {lock !== null && (
        <div className="cl-lock" onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <h2>{t("Your teacher paused this screen", "Учитель приостановил экран")}</h2>
          <p>{lock || t("Eyes on the board, please.", "Внимание на доску.")}</p>
        </div>
      )}
      {message && lock === null && (
        <div className="learn-modal cl-msg-wrap">
          <div className="learn-sheet cl-msg" onPointerDown={(e) => e.stopPropagation()}>
            <div className="lc-kind">{t("Message from your teacher", "Сообщение от учителя")}</div>
            <p>{message.text}</p>
            <div className="lc-actions"><button className="lc-primary" autoFocus onClick={() => useClass.setState({ message: null })}>OK</button></div>
          </div>
        </div>
      )}
    </>
  );
}

/** Подключается один раз в App. */
export function ClassLayer() {
  useEffect(() => attachClass(), []);
  return <Overlays />;
}
