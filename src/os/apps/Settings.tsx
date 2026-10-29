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
      <div className="set-page">
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
      <p className="set-note">{t("Local account, no password.", "Локальная учётная запись без пароля.")}</p>
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
