import { useEffect, useRef, useState } from "react";
import { useStore, useLang } from "../machine/store";
import type { Config } from "../machine/params";
import { readings, tempClass } from "../machine/sensors";
import { useOs } from "./osStore";
import { osPower, playOs } from "./power";
import { OsLogo } from "./AppIcon";
import { useNow, useTimeFormat } from "./util";
import { WallpaperArt } from "./Wallpaper";
import { currentUser, listUsers, peekPrefs } from "./users";
import { FW_LATEST, flashFirmware } from "../machine/hardware";
import { unlock } from "../machine/quests";

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

/** Экран старта: логотип рисуется линией, крыло «взлетает», под ним бегущая полоса и статусы. Нестабильный разгон роняет систему. */
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
      <div className="boot-logo"><OsLogo size={150} /></div>
      <div className="boot-line"><i /></div>
      <div className="boot-status">{statuses.length > 0 && <span key={idx}>{statuses[idx]}</span>}</div>
    </div>
  );
}

/** Капсулы под часами: короткий статус системы по настройкам BIOS и живой температуре. */
function LockWidgets() {
  const { t } = useLang();
  const saved = useStore((s) => s.saved);
  const temp = useStore((s) => readings(s.saved, s.thermal, s).temp);
  const issues = [
    !saved.lanController && t("No network", "Нет сети"),
    !saved.hdAudio && t("No sound", "Нет звука"),
    temp >= 85 && t("CPU is running hot", "Процессор перегревается"),
  ].filter(Boolean) as string[];
  return (
    <div className="lock-widgets">
      <div className={"capsule glass" + (issues.length ? " warn" : "")}>
        <i className="cap-dot" />
        {issues.length ? issues.join(" · ") : t("All systems running fine", "Все системы работают отлично")}
      </div>
      <div className="capsule glass">
        <svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></svg>
        {t("CPU", "Процессор")} <b className={tempClass(temp)}>{Math.round(temp)}°C</b>
      </div>
    </div>
  );
}

/** Другие пользователи: смена учётной записи прямо на экране входа. */
function LockUsers({ onPick }: { onPick: () => void }) {
  const { t } = useLang();
  const users = listUsers();
  const cur = currentUser();
  if (users.length < 2) return null;
  return (
    <div className="lock-users" onClick={(e) => e.stopPropagation()}>
      {users.map((u) => {
        const name = (u.id === cur ? useOs.getState().prefs.userName : peekPrefs(u.id).userName) ?? u.name;
        return (
          <button key={u.id} className={"lock-user" + (u.id === cur ? " on" : "")} title={t("Switch user", "Сменить пользователя")}
            onClick={() => { if (u.id !== cur) useOs.getState().switchUser(u.id); onPick(); }}>
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Меню питания в углу экрана блокировки. */
function LockPower({ onSleep }: { onSleep: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="lock-power" onClick={(e) => e.stopPropagation()}>
      {open && (
        <div className="lock-power-menu glass">
          <button onClick={onSleep}>{t("Sleep", "Сон")}</button>
          <button onClick={osPower.restart}>{t("Restart", "Перезагрузка")}</button>
          <button onClick={osPower.shutdown}>{t("Shut down", "Выключение")}</button>
        </div>
      )}
      <button className={"lock-round glass" + (open ? " on" : "")} onClick={() => setOpen(!open)} title={t("Power", "Питание")}>
        <svg viewBox="0 0 24 24"><path d="M12 3v8M6.5 6.5a8 8 0 1 0 11 0" /></svg>
      </button>
    </div>
  );
}

const UNLOCK_MS = 520;

/**
 * Экран блокировки: крупные часы и капсулы состояния слева, карточка входа справа, питание в углу.
 * Неверный пароль — покачивание поля и подсказка; верный — элементы растворяются.
 */
export function LockScreen() {
  const { t, lang } = useLang();
  const prefs = useOs((s) => s.prefs);
  const [login, setLogin] = useState(false);
  const [pw, setPw] = useState("");
  const [wrong, setWrong] = useState(0);
  const [shake, setShake] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const now = useNow();
  const fmt = useTimeFormat();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const hasPw = prefs.password !== "";

  const unlock = () => {
    setUnlocking(true);
    playOs("startup");
    window.setTimeout(() => useOs.getState().setStage("desktop"), UNLOCK_MS);
  };

  const submit = () => {
    if (unlocking) return;
    if (!hasPw || pw === prefs.password) return unlock();
    playOs("error");
    setWrong((n) => n + 1);
    setShake(true);
    setPw("");
  };

  const back = () => { setLogin(false); setPw(""); };
  const sleep = () => { back(); osPower.sleep(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (unlocking || useOs.getState().sleeping) return;
      if (!login) {
        setLogin(true);
        // первая буква не теряется: она сразу попадает в поле пароля
        if (hasPw && e.key.length === 1) { setPw(e.key); e.preventDefault(); }
        return;
      }
      if (e.key === "Escape") back();
      else if (e.key === "Enter" && !hasPw) submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [login, unlocking, hasPw, pw]);

  useEffect(() => { if (login) input.current?.focus(); }, [login]);

  return (
    <div
      className={"lock" + (login ? " blur" : "") + (unlocking ? " unlocking" : "")}
      onClick={() => !login && !useOs.getState().sleeping && setLogin(true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="lock-wall"><WallpaperArt id={prefs.wallpaper} /></div>
      <div className="lock-top">
        <div className="lc-date">{now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</div>
        <div className="lc-time">{fmt(now).replace(/\s?[AP]M$/i, "")}</div>
        <LockWidgets />
      </div>

      <div className={"lock-bottom" + (login ? " open" : "")} onClick={(e) => login && e.stopPropagation()}>
        <div className="avatar big">{prefs.userName.slice(0, 1).toUpperCase()}</div>
        <div className="login-name">{prefs.userName}</div>
        {!login ? (
          <div className="lock-hint">{t("Click or press any key to unlock", "Щёлкните или нажмите любую клавишу")}</div>
        ) : hasPw ? (
          <>
            <form
              className={"pw-field glass" + (shake ? " shake" : "")}
              onAnimationEnd={() => setShake(false)}
              onSubmit={(e) => { e.preventDefault(); submit(); }}
            >
              <input
                ref={input}
                type="password"
                value={pw}
                placeholder={t("Password", "Пароль")}
                onChange={(e) => setPw(e.target.value)}
              />
              <button type="submit" className="pw-go" disabled={!pw} title={t("Sign in", "Войти")}>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </form>
            <div className="pw-hint">
              {wrong > 0 && (
                <span key={wrong}>
                  {t("Wrong password.", "Неверный пароль.")}
                  {prefs.passwordHint && <> {t("Hint", "Подсказка")}: «{prefs.passwordHint}»</>}
                </span>
              )}
            </div>
          </>
        ) : (
          <button className="login-btn" onClick={submit}>{t("Sign in", "Войти")}</button>
        )}
      </div>

      <LockUsers onPick={() => { setLogin(true); setPw(""); setWrong(0); }} />
      <LockPower onSleep={sleep} />
    </div>
  );
}

/** Сбой ядра из-за нестабильного разгона: тёмный экран, причина, восстановление и перезагрузка. */
const CRASH_RESTART_S = 12;

export function Crash() {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(CRASH_RESTART_S);
  useEffect(() => {
    unlock("crash");
    const a = window.setTimeout(() => setShow(true), 400);
    const b = window.setInterval(() => setLeft((n) => n - 1), 1000);
    return () => { clearTimeout(a); clearInterval(b); };
  }, []);
  useEffect(() => { if (left <= 0) useStore.getState().restart(); }, [left]);
  // восстановление: вернуть множитель и напряжение в Auto и перезагрузиться уже без разгона
  const recover = () => { useStore.getState().resetOverclock(); useStore.getState().restart(); };
  return (
    <div className="crash" onContextMenu={(e) => e.preventDefault()}>
      <div className={"crash-box" + (show ? " in" : "")}>
        <OsLogo size={84} />
        <p>{t("Your computer restarted because of a problem.", "Компьютер перезагружается из-за ошибки.")}</p>
        <p className="crash-sub">{t("The processor overclock is unstable. In BIOS, raise CPU Core Voltage or lower the CPU Ratio.", "Разгон процессора нестабилен. В BIOS поднимите CPU Core Voltage или снизьте множитель.")}</p>
        <div className="crash-actions">
          <button className="crash-btn primary" onClick={recover}>{t("Reset overclock and restart", "Сбросить разгон и перезагрузить")}</button>
          <button className="crash-btn" onClick={() => useStore.getState().restart()}>{t("Restart", "Перезагрузить")} ({Math.max(0, left)})</button>
        </div>
        <p className="crash-code">panic(cpu 3): CLOCK_WATCHDOG_TIMEOUT</p>
      </div>
    </div>
  );
}

/** Установка прошивки: прогресс по этапам, затем перезагрузка уже с новой версией. */
function FirmwareFlash() {
  const { t } = useLang();
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPct((p) => Math.min(100, p + 1 + Math.random() * 2.2)), 90);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (pct < 100) return;
    flashFirmware(FW_LATEST);
    unlock("flash");
    const id = window.setTimeout(() => useStore.getState().restart(), 900);
    return () => clearTimeout(id);
  }, [pct]);
  const stage = pct < 20 ? t("Verifying update…", "Проверка обновления…") : pct < 85 ? t("Writing firmware…", "Запись прошивки…") : t("Finishing…", "Завершение…");
  return (
    <div className="os-boot fade-in">
      <OsLogo size={110} />
      <div className="fw-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="os-leaving">{stage} {Math.floor(pct)}%</div>
      <div className="fw-warn">{t("Do not turn off your computer.", "Не выключайте компьютер.")}</div>
    </div>
  );
}

export function Leaving() {
  const { t } = useLang();
  const kind = useOs((s) => s.leaving);
  if (kind === "update") return <FirmwareFlash />;
  const text = kind === "shutdown" ? t("Shutting down", "Завершение работы") : t("Restarting", "Перезагрузка");
  return (
    <div className="os-boot fade-in">
      <OsLogo size={96} />
      <div className="boot-line"><i /></div>
      <div className="os-leaving">{text}</div>
    </div>
  );
}
