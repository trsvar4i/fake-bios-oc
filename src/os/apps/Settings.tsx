import { useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { useOs } from "../osStore";
import { osPower, playOs } from "../power";

const WALLPAPERS = ["aurora", "ember", "forest", "graphite"];

export function Settings() {
  const { t } = useLang();
  const [page, setPage] = useState("personal");
  const pages: [string, string][] = [
    ["personal", t("Personalization", "Персонализация")],
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
        {page === "personal" && <Personal />}
        {page === "account" && <Account />}
        {page === "sound" && <Sound />}
        {page === "recovery" && <Recovery />}
        {page === "about" && <About />}
      </div>
    </div>
  );
}

function Personal() {
  const { t } = useLang();
  const wp = useOs((s) => s.prefs.wallpaper);
  return (
    <>
      <h2>{t("Background", "Фон")}</h2>
      <div className="wp-grid">
        {WALLPAPERS.map((w) => (
          <button key={w} className={"wp-thumb wp-" + w + (wp === w ? " on" : "")} onClick={() => useOs.getState().setPref("wallpaper", w)} />
        ))}
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
