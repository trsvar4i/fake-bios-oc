import { useEffect, useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { FW_LATEST, HW } from "../../machine/hardware";
import { useOs } from "../osStore";
import { osPower, playOs } from "../power";
import { WALLPAPERS } from "../wallpapers";
import { WallpaperArt } from "../Wallpaper";
import { DEFAULT_DOCK, createUserPrefs } from "../osStore";
import { currentUser, listUsers, removeUserData, saveUsers } from "../users";
import "./Settings.css";


export function Settings() {
  const { t } = useLang();
  const [page, setPage] = useState("general");
  const pages: [string, string][] = [
    ["general", t("General", "Основные")],
    ["appearance", t("Appearance", "Оформление")],
    ["personal", t("Wallpaper", "Обои")],
    ["dock", t("Desktop & Perch", "Рабочий стол и «Насест»")],
    ["account", t("Account", "Учётная запись")],
    ["sound", t("Sound", "Звук")],
    ["update", t("Software Update", "Обновление ПО")],
    ["recovery", t("Recovery", "Восстановление")],
    ["about", t("About", "О системе")],
  ];
  return (
    <div className="settings">
      <nav className="set-nav">
        {pages.map(([id, name]) => (
          <button key={id} className={page === id ? "on" : ""} onClick={() => setPage(id)}>{name}</button>
        ))}
      </nav>
      <div className="set-page" key={page}>
        {page === "general" && <General />}
        {page === "appearance" && <Appearance />}
        {page === "personal" && <Personal />}
        {page === "dock" && <DockPage />}
        {page === "account" && <Account />}
        {page === "sound" && <Sound />}
        {page === "update" && <Update />}
        {page === "recovery" && <Recovery />}
        {page === "about" && <About />}
      </div>
    </div>
  );
}

function Personal() {
  const { t, lang } = useLang();
  const wp = useOs((s) => s.prefs.wallpaper);
  return (
    <>
      <h2>{t("Wallpaper", "Обои")}</h2>
      <p className="set-note">{t("The accent color of buttons and highlights follows the wallpaper.", "Цвет кнопок и выделения подстраивается под обои.")}</p>
      <div className="wp-grid">
        {Object.entries(WALLPAPERS).map(([id, w]) => (
          <button key={id} className={"wp-thumb" + (wp === id ? " on" : "")} onClick={() => useOs.getState().setPref("wallpaper", id)}>
            <WallpaperArt id={id} />
            <span>{w.name[lang]}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function General() {
  const { t, lang } = useLang();
  const prefs = useOs((s) => s.prefs);
  const set = useOs.getState().setPref;
  return (
    <>
      <h2>{t("General", "Основные")}</h2>
      <div className="set-line">
        <span>{t("Computer name", "Имя компьютера")}<small className="set-hint">{t("Shown in Terminal and About This PC", "Видно в Терминале и «Об этом компьютере»")}</small></span>
        <input className="set-input" value={prefs.hostName} maxLength={24} onChange={(e) => set("hostName", e.target.value)} onBlur={(e) => !e.target.value.trim() && set("hostName", "Kestrel")} />
      </div>
      <div className="set-line">
        <span>{t("Language", "Язык")}<small className="set-hint">{t("Same setting as in BIOS — saved to CMOS", "Та же настройка, что в BIOS — сохраняется в CMOS")}</small></span>
        <div className="seg">
          <button className={lang === "en" ? "on" : ""} onClick={() => useStore.getState().setLanguage("English")}>English</button>
          <button className={lang === "ru" ? "on" : ""} onClick={() => useStore.getState().setLanguage("Русский")}>Русский</button>
        </div>
      </div>
      <label className="set-switch">
        <span>{t("24-hour time", "24-часовой формат")}<small>{t("Off — 12-hour with AM/PM", "Выкл. — 12-часовой с AM/PM")}</small></span>
        <input type="checkbox" checked={!prefs.hour12} onChange={(e) => set("hour12", !e.target.checked)} />
      </label>
    </>
  );
}

function Appearance() {
  const { t } = useLang();
  const theme = useOs((s) => s.prefs.theme);
  const nightLight = useOs((s) => s.prefs.nightLight);
  const lite = useOs((s) => s.prefs.lite);
  const opts: ["light" | "dark" | "auto", string][] = [["light", t("Light", "Светлое")], ["dark", t("Dark", "Тёмное")], ["auto", t("Auto", "Авто")]];
  return (
    <>
      <h2>{t("Appearance", "Оформление")}</h2>
      <div className="theme-pick">
        {opts.map(([id, name]) => (
          <button key={id} className={"theme-opt " + id + (theme === id ? " on" : "")} onClick={() => useOs.getState().setPref("theme", id)}>
            <span className="theme-prev"><i /><b /></span>
            {name}
          </button>
        ))}
      </div>
      <p className="set-note">{t("Auto is light from 7:00 to 19:00 and dark in the evening.", "«Авто» — светлое с 7:00 до 19:00, вечером тёмное.")}</p>
      <label className="set-switch">
        <span>{t("Night Light", "Ночной свет")}<small>{t("Warmer colors for the evening", "Тёплые цвета для вечера")}</small></span>
        <input type="checkbox" checked={nightLight} onChange={(e) => useOs.getState().setPref("nightLight", e.target.checked)} />
      </label>
      <h2 className="set-sub">{t("Performance", "Быстродействие")}</h2>
      <div className="set-line">
        <span>{t("Lite mode", "Облегчённый режим")}<small className="set-hint">{t("No blur behind panels and windows. Auto turns it on for phones and weak devices.", "Без размытия под панелями и окнами. «Авто» включает его на телефонах и слабых устройствах.")}</small></span>
        <div className="seg">
          {([["auto", t("Auto", "Авто")], ["on", t("On", "Вкл.")], ["off", t("Off", "Выкл.")]] as const).map(([id, name]) => (
            <button key={id} className={lite === id ? "on" : ""} onClick={() => useOs.getState().setPref("lite", id)}>{name}</button>
          ))}
        </div>
      </div>
      <p className="set-note">{t("Animations follow the system “Reduce motion” setting.", "Анимации подчиняются системной настройке «Уменьшить движение».")}</p>
    </>
  );
}

function DockPage() {
  const { t } = useLang();
  const prefs = useOs((s) => s.prefs);
  const set = useOs.getState().setPref;
  return (
    <>
      <h2>{t("Perch", "«Насест»")}</h2>
      <label className="set-switch">
        <span>{t("Show the name of the active app", "Подпись у активной программы")}<small>{t("The front app expands into a labelled pill", "Программа впереди раскрывается в «пилюлю» с названием")}</small></span>
        <input type="checkbox" checked={prefs.perchLabels} onChange={(e) => set("perchLabels", e.target.checked)} />
      </label>
      <div className="set-line">
        <span>{t("Pinned apps", "Закреплённых программ")}: {prefs.dock.length}</span>
        <button className="set-btn" onClick={() => set("dock", DEFAULT_DOCK)}>{t("Restore Defaults", "Вернуть по умолчанию")}</button>
      </div>
      <h2 className="set-sub">{t("Widgets", "Виджеты")}</h2>
      <div className="set-line">
        <span>{t("On desktop", "На рабочем столе")}: {prefs.widgets.length}</span>
        <button className="set-btn primary" onClick={() => useOs.getState().setPanel("widgets")}>{t("Edit Widgets…", "Изменить виджеты…")}</button>
      </div>
    </>
  );
}

function Account() {
  const { t } = useLang();
  const name = useOs((s) => s.prefs.userName);
  return (
    <>
      <h2>{t("Your account", "Ваша учётная запись")}</h2>
      <div className="set-row">
        <span className="avatar big">{name.slice(0, 1).toUpperCase()}</span>
        <label>
          {t("User name", "Имя пользователя")}
          <input value={name} maxLength={20} onChange={(e) => {
            const v = e.target.value || "User";
            useOs.getState().setPref("userName", v);
            saveUsers(listUsers().map((u) => (u.id === currentUser() ? { ...u, name: v } : u)));
          }} />
        </label>
      </div>
      <Password />
      <Users />
    </>
  );
}

/** Учётные записи компьютера: добавить, удалить, войти под другим пользователем. */
function Users() {
  const { t } = useLang();
  const [list, setList] = useState(listUsers());
  const [draft, setDraft] = useState("");
  const cur = currentUser();
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    const id = "u" + Date.now().toString(36);
    createUserPrefs(id, name);
    const next = [...list, { id, name }];
    saveUsers(next);
    setList(next);
    setDraft("");
  };
  const remove = (id: string) => {
    removeUserData(id);
    const next = list.filter((u) => u.id !== id);
    saveUsers(next);
    setList(next);
  };
  return (
    <>
      <h2 className="set-sub">{t("Users", "Пользователи")}</h2>
      <div className="users-list">
        {list.map((u) => (
          <div key={u.id} className="users-row">
            <span className="avatar">{u.name.slice(0, 1).toUpperCase()}</span>
            <span className="users-name">{u.name}{u.id === cur && <small> · {t("signed in", "вы")}</small>}</span>
            {u.id !== cur && (
              <>
                <button className="set-btn" onClick={() => { useOs.getState().switchUser(u.id); useOs.getState().setStage("lock"); }}>{t("Switch", "Войти")}</button>
                <button className="set-btn" onClick={() => remove(u.id)}>{t("Delete", "Удалить")}</button>
              </>
            )}
          </div>
        ))}
      </div>
      <form className="users-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="set-input" value={draft} maxLength={20} placeholder={t("New user name", "Имя нового пользователя")} onChange={(e) => setDraft(e.target.value)} />
        <button className="set-btn primary" disabled={!draft.trim() || list.length >= 5}>{t("Add User", "Добавить")}</button>
      </form>
      <p className="set-note">{t("Each user has their own wallpaper, password, widgets, Perch and files.", "У каждого пользователя свои обои, пароль, виджеты, «Насест» и файлы.")}</p>
    </>
  );
}

/** Пароль для экрана блокировки. Чтобы сменить или убрать, нужен текущий. */
function Password() {
  const { t } = useLang();
  const prefs = useOs((s) => s.prefs);
  const has = prefs.password !== "";
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [hint, setHint] = useState(prefs.passwordHint);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (password: string) => {
    if (has && cur !== prefs.password) return setMsg({ ok: false, text: t("Current password is wrong.", "Текущий пароль неверный.") });
    if (password && hint && password.toLowerCase().includes(hint.toLowerCase()))
      return setMsg({ ok: false, text: t("The hint must not contain the password.", "Подсказка не должна содержать пароль.") });
    const os = useOs.getState();
    os.setPref("password", password);
    os.setPref("passwordHint", password ? hint : "");
    setCur(""); setNext("");
    if (!password) setHint("");
    setMsg({ ok: true, text: password ? t("Password saved.", "Пароль сохранён.") : t("Password removed.", "Пароль удалён.") });
  };

  return (
    <>
      <h2 className="set-sub">{t("Password", "Пароль")}</h2>
      <p className="set-note">
        {has ? t("The lock screen asks for this password.", "Экран блокировки запрашивает этот пароль.")
          : t("No password: anyone can sign in with one click.", "Пароля нет: войти можно одним щелчком.")}
      </p>
      <form className="set-form" onSubmit={(e) => { e.preventDefault(); if (next) apply(next); }}>
        {has && (
          <label>{t("Current password", "Текущий пароль")}
            <input type="password" value={cur} onChange={(e) => { setCur(e.target.value); setMsg(null); }} />
          </label>
        )}
        <label>{has ? t("New password", "Новый пароль") : t("Password", "Пароль")}
          <input type="password" value={next} maxLength={32} onChange={(e) => { setNext(e.target.value); setMsg(null); }} />
        </label>
        <label>{t("Hint (optional)", "Подсказка (необязательно)")}
          <input value={hint} maxLength={40} onChange={(e) => { setHint(e.target.value); setMsg(null); }} />
        </label>
        <div className="set-actions">
          <button type="submit" className="set-btn primary" disabled={!next}>{has ? t("Change password", "Сменить пароль") : t("Set password", "Задать пароль")}</button>
          {has && <button type="button" className="set-btn" onClick={() => apply("")}>{t("Remove password", "Убрать пароль")}</button>}
        </div>
        {msg && <p className={msg.ok ? "ok" : "crit"}>{msg.text}</p>}
      </form>
    </>
  );
}

function Sound() {
  const { t } = useLang();
  const hdAudio = useStore((s) => s.saved.hdAudio);
  return (
    <>
      <h2>{t("Output", "Вывод")}</h2>
      {hdAudio ? (
        <>
          <p>{t("Output device", "Устройство вывода")}: <b>Kestrel HD Audio — Speakers</b></p>
          <button className="set-btn" onClick={() => playOs("notify")}>{t("Test sound", "Проверить звук")}</button>
        </>
      ) : (
        <div className="set-warn">
          {t("No output devices found. The HD Audio Controller is disabled in BIOS.", "Устройства вывода не найдены. Звуковой контроллер HD Audio выключен в BIOS.")}
        </div>
      )}
    </>
  );
}

/** Обновление прошивки материнской платы прямо из ОС. */
function Update() {
  const { t } = useLang();
  const [state, setState] = useState<"idle" | "checking" | "ready" | "downloading" | "downloaded">("idle");
  const [pct, setPct] = useState(0);
  const current = HW.bios;
  const fresh = current === FW_LATEST.bios;
  useEffect(() => {
    if (state === "checking") { const id = window.setTimeout(() => setState("ready"), 1200); return () => clearTimeout(id); }
    if (state !== "downloading") return;
    const id = window.setInterval(() => setPct((p) => {
      if (p >= 100) { setState("downloaded"); return 100; }
      return Math.min(100, p + 4 + Math.random() * 6);
    }), 120);
    return () => clearInterval(id);
  }, [state]);
  return (
    <>
      <h2>{t("Software Update", "Обновление ПО")}</h2>
      <div className="upd-card">
        <div><b>Kestrel OS 1.0</b><div className="set-note">{t("Your system is up to date.", "Система обновлена.")}</div></div>
      </div>
      <div className="upd-card">
        <div>
          <b>{t("Motherboard firmware", "Прошивка материнской платы")}</b>
          <div className="set-note">UEFI {current} ({HW.buildDate})</div>
          {!fresh && state !== "idle" && state !== "checking" && (
            <div className="upd-new">
              {t("Available", "Доступна")}: <b>{FW_LATEST.bios}</b> ({FW_LATEST.buildDate}) —{" "}
              {t("better memory compatibility, quieter fan curve at idle.", "лучше совместимость памяти, тише вентиляторы в простое.")}
            </div>
          )}
          {state === "downloading" && <div className="bar upd-bar"><i style={{ width: `${pct}%` }} /></div>}
        </div>
        {fresh ? <span className="ok">{t("Up to date", "Актуальна")}</span>
          : state === "idle" ? <button className="set-btn" onClick={() => setState("checking")}>{t("Check for Updates", "Проверить обновления")}</button>
          : state === "checking" ? <span className="set-note">{t("Checking…", "Проверка…")}</span>
          : state === "ready" ? <button className="set-btn primary" onClick={() => setState("downloading")}>{t("Download", "Загрузить")}</button>
          : state === "downloading" ? <span className="set-note">{Math.floor(pct)}%</span>
          : <button className="set-btn primary" onClick={osPower.updateFirmware}>{t("Restart and Install", "Перезагрузить и установить")}</button>}
      </div>
    </>
  );
}

function Recovery() {
  const { t } = useLang();
  return (
    <>
      <h2>{t("Advanced startup", "Особые варианты загрузки")}</h2>
      <p>{t("Restart the PC directly into the UEFI firmware settings (BIOS).", "Перезагрузить компьютер сразу в настройки прошивки UEFI (BIOS).")}</p>
      <button className="set-btn" onClick={osPower.restartToFirmware}>{t("Restart to UEFI", "Перезагрузить в UEFI")}</button>
    </>
  );
}

function About() {
  const { t } = useLang();
  return (
    <>
      <h2>Kestrel OS</h2>
      <p>{t("Version", "Версия")} 1.0 (build 2611)</p>
      <p>{HW.cpu}</p>
      <p>32 GB RAM · {HW.product}</p>
      <p className="set-note">{t("More details: This PC.", "Подробнее: «Этот компьютер».")}</p>
    </>
  );
}
