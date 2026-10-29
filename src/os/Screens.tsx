import { useEffect, useState } from "react";
import { useStore, useLang } from "../machine/store";
import type { Config } from "../machine/params";
import { useOs } from "./osStore";
import { playOs } from "./power";
import { OsLogo } from "./AppIcon";
import { useNow } from "./util";

// Настройки BIOS, которые ОС «замечает» при загрузке.
const HW_KEYS = ["virtualization", "hdAudio", "lanController", "usbStorage", "xmp", "cpuRatio", "smt", "secureBoot", "ftpm", "sataMode"];
const fingerprint = (c: Config) => HW_KEYS.map((k) => `${k}=${JSON.stringify(c[k])}`).join(";");

/** Дружелюбные статусы вместо логов: при первом запуске и после изменений в BIOS. */
function bootStatuses(c: Config, last: string, t: (en: string, ru: string) => string): string[] {
  if (!last) {
    return [
      t("Preparing your workspace…", "Готовим рабочее пространство…"),
      t("Checking devices…", "Проверяем устройства…"),
      t("Setting up sound and network…", "Настраиваем звук и сеть…"),
      t("Almost ready…", "Почти готово…"),
    ];
  }
  const prev = Object.fromEntries(last.split(";").map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]));
  const changed = HW_KEYS.filter((k) => prev[k] !== JSON.stringify(c[k]));
  if (!changed.length) return [];
  const msg: Record<string, string> = {
    virtualization: c.virtualization ? t("Turning on virtualization…", "Включаем виртуализацию…") : t("Turning off virtualization…", "Отключаем виртуализацию…"),
    hdAudio: c.hdAudio ? t("Setting up sound…", "Настраиваем звук…") : t("Sound card not found — turning sound off…", "Звуковая карта не найдена — отключаем звук…"),
    lanController: c.lanController ? t("Setting up the network…", "Настраиваем сеть…") : t("Network card not found…", "Сетевая карта не найдена…"),
    usbStorage: t("Checking USB drives…", "Проверяем USB-накопители…"),
    xmp: t("Adapting to the new CPU and memory speed…", "Подстраиваемся под новую частоту процессора и памяти…"),
    cpuRatio: t("Adapting to the new CPU and memory speed…", "Подстраиваемся под новую частоту процессора и памяти…"),
    smt: t("Adapting to the new CPU and memory speed…", "Подстраиваемся под новую частоту процессора и памяти…"),
    secureBoot: t("Updating security settings…", "Обновляем параметры безопасности…"),
    ftpm: t("Updating security settings…", "Обновляем параметры безопасности…"),
    sataMode: t("Checking disks…", "Проверяем диски…"),
  };
  const steps = [...new Set(changed.map((k) => msg[k]))];
  return [t("Hardware settings have changed…", "Настройки оборудования изменились…"), ...steps, t("Almost ready…", "Почти готово…")];
}

const STATUS_MS = 1100;

/** Экран старта: логотип со свечением, кольцо загрузки, статусы. Нестабильный разгон роняет систему. */
export function Splash() {
  const { t } = useLang();
  const [statuses] = useState(() => {
    const s = useStore.getState();
    return s.osUnstable ? [] : bootStatuses(s.saved, useOs.getState().prefs.lastHardware, t);
  });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const s = useStore.getState();
    const ratio = s.saved.cpuRatio || 45;
    const base = Math.max(1600, 3200 - (ratio - 45) * 120 - (s.saved.fastBoot ? 500 : 0));
    const ms = s.osUnstable ? 1900 : Math.max(base, statuses.length * STATUS_MS + 300);
    const step = window.setInterval(() => setIdx((i) => Math.min(statuses.length - 1, i + 1)), STATUS_MS);
    const done = window.setTimeout(() => {
      if (s.osUnstable) return useOs.getState().setStage("crash");
      useOs.getState().setPref("lastHardware", fingerprint(s.saved));
      useOs.getState().setStage("lock");
    }, ms);
    return () => { clearInterval(step); clearTimeout(done); };
  }, [statuses]);

  return (
    <div className="os-boot fade-in">
      <div className="boot-glow"><OsLogo size={150} /></div>
      <svg className="ring" viewBox="0 0 48 48" width="48" height="48">
        <circle cx="24" cy="24" r="20" className="ring-track" />
        <circle cx="24" cy="24" r="20" className="ring-arc" />
      </svg>
      <div className="boot-status">{statuses.length > 0 && <span key={idx}>{statuses[idx]}</span>}</div>
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
    <div className="os-boot fade-in">
      <svg className="ring" viewBox="0 0 48 48" width="48" height="48">
        <circle cx="24" cy="24" r="20" className="ring-track" />
        <circle cx="24" cy="24" r="20" className="ring-arc" />
      </svg>
      <div className="os-leaving">{text}</div>
    </div>
  );
}
