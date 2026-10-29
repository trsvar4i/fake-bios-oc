import { useEffect, useState } from "react";
import { useStore, useLang } from "../machine/store";
import { useOs } from "./osStore";
import { playOs } from "./power";
import { OsLogo } from "./AppIcon";
import { useNow } from "./util";

/** Логотип и спиннер. Чем быстрее процессор, тем быстрее загрузка. Нестабильный разгон роняет систему. */
export function Splash() {
  useEffect(() => {
    const s = useStore.getState();
    const ratio = s.saved.cpuRatio || 45;
    const ms = Math.max(1500, 3200 - (ratio - 45) * 120 - (s.saved.fastBoot ? 500 : 0));
    const id = window.setTimeout(() => useOs.getState().setStage(s.osUnstable ? "crash" : "lock"), s.osUnstable ? 1900 : ms);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="os-boot">
      <OsLogo size={150} />
      <div className="os-spinner" />
    </div>
  );
}

/** Экран блокировки: часы → по клику или клавише форма входа. */
export function LockScreen() {
  const { t, lang } = useLang();
  const prefs = useOs((s) => s.prefs);
  const [login, setLogin] = useState(false);
  const now = useNow();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";

  const signIn = () => {
    playOs("startup");
    useOs.getState().setStage("desktop");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!login) { setLogin(true); return; }
      if (e.key === "Enter") signIn();
      if (e.key === "Escape") setLogin(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [login]);

  return (
    <div className={"lock wp-" + prefs.wallpaper + (login ? " blur" : "")} onClick={() => !login && setLogin(true)}>
      {!login ? (
        <div className="lock-clock">
          <div className="lc-time">{now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="lc-date">{now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
      ) : (
        <div className="login">
          <div className="avatar big">{prefs.userName.slice(0, 1).toUpperCase()}</div>
          <div className="login-name">{prefs.userName}</div>
          <button className="login-btn" onClick={signIn}>{t("Sign in", "Войти")}</button>
        </div>
      )}
      <div className="lock-hint">{!login ? t("Click or press any key to unlock", "Щёлкните или нажмите любую клавишу") : t("Enter — sign in, Esc — back", "Enter — войти, Esc — назад")}</div>
    </div>
  );
}

/** Критическая ошибка: нестабильный разгон. Через пару секунд — перезагрузка. */
export function Crash() {
  const { t } = useLang();
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPct((p) => Math.min(100, p + 3 + Math.floor(Math.random() * 7))), 140);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (pct < 100) return;
    const id = window.setTimeout(() => useStore.getState().restart(), 1200);
    return () => clearTimeout(id);
  }, [pct]);
  return (
    <div className="crash">
      <div className="crash-mark">!</div>
      <h1>{t("Kestrel OS stopped to protect your data.", "Kestrel OS остановлена, чтобы защитить ваши данные.")}</h1>
      <p>{t("Collecting error info", "Сбор сведений об ошибке")}: {pct}% — {t("the PC will restart automatically.", "компьютер перезагрузится автоматически.")}</p>
      <p className="crash-code">STOP: CLOCK_WATCHDOG_TIMEOUT</p>
      <p className="crash-tip">
        {t("Hint: the CPU overclock is unstable. In BIOS raise CPU Core Voltage or lower CPU Ratio.",
          "Подсказка: разгон процессора нестабилен. В BIOS поднимите CPU Core Voltage или снизьте множитель.")}
      </p>
    </div>
  );
}

export function Leaving() {
  const { t } = useLang();
  const kind = useOs((s) => s.leaving);
  const text = kind === "shutdown" ? t("Shutting down", "Завершение работы") : t("Restarting", "Перезагрузка");
  return (
    <div className="os-boot">
      <div className="os-spinner" />
      <div className="os-leaving">{text}</div>
    </div>
  );
}
