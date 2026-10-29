import { useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { useOs } from "../osStore";
import { osPower, playOs } from "../power";
import { WALLPAPERS } from "../wallpapers";
import { WallpaperArt } from "../Wallpaper";
import { DEFAULT_DOCK } from "../osStore";


export function Settings() {
  const { t } = useLang();
  const [page, setPage] = useState("appearance");
  const pages: [string, string][] = [
    ["appearance", t("Appearance", "Оформление")],
    ["personal", t("Wallpaper", "Обои")],
    ["dock", t("Desktop & Dock", "Рабочий стол и Dock")],
    ["account", t("Account", "Учётная запись")],
    ["sound", t("Sound", "Звук")],
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
        {page === "appearance" && <Appearance />}
        {page === "personal" && <Personal />}
        {page === "dock" && <DockPage />}
        {page === "account" && <Account />}
        {page === "sound" && <Sound />}
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

function Appearance() {
  const { t } = useLang();
  const theme = useOs((s) => s.prefs.theme);
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
    </>
  );
}

function DockPage() {
  const { t } = useLang();
  const prefs = useOs((s) => s.prefs);
  const set = useOs.getState().setPref;
  return (
    <>
      <h2>Dock</h2>
      <label className="set-switch">
        <span>{t("Magnification", "Увеличение")}<small>{t("Icons grow under the pointer", "Иконки растут под указателем")}</small></span>
        <input type="checkbox" checked={prefs.dockMagnify} onChange={(e) => set("dockMagnify", e.target.checked)} />
      </label>
      <div className="set-line">
        <span>{t("Apps in Dock", "Приложений в Dock")}: {prefs.dock.length}</span>
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
          <input value={name} maxLength={20} onChange={(e) => useOs.getState().setPref("userName", e.target.value || "User")} />
        </label>
      </div>
      <Password />
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
