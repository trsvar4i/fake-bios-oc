// «Насест» (Perch) — единая парящая панель внизу: «Гнездо» (все программы), закреплённые и запущенные
// программы, Корзина, рабочие столы и статус. «Хаб» справа объединяет уведомления, быстрые настройки,
// музыку и таймер. Всплывающие уведомления — тосты в правом верхнем углу.
import { useEffect, useRef, useState } from "react";
import { useStore, useLang } from "../machine/store";
import { sound, useMuted, useVolume } from "../machine/audio";
import { useOs, type MenuItem, type Notice } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon, OsLogo } from "./AppIcon";
import { TRASH, isTrashed, useFs } from "./fs";
import { stageScale, useNow, usePresence, useTimeFormat } from "./util";
import { useDrop } from "./apps/Finder";
import { fmtTimer, timerLeft, useClockState } from "./apps/Clock";
import { TRACKS, music, useMusic } from "./music";
import { osPower } from "./power";
import { cmd } from "./commands";

type T = (en: string, ru?: string) => string;

/** Меню системы: правая кнопка по «Гнезду» и кнопка питания в «Хабе». */
export function systemMenu(t: T, userName: string): MenuItem[] {
  const os = useOs.getState();
  return [
    { label: t("About This PC", "Об этом компьютере"), run: () => os.open("thispc") },
    { label: t("Settings", "Настройки"), run: cmd.settings, shortcut: "Alt+," },
    "sep",
    { label: t("Lock", "Заблокировать"), run: osPower.lock },
    { label: t(`Sign out ${userName}`, `Выйти из «${userName}»`), run: osPower.logout },
    "sep",
    { label: t("Sleep", "Сон"), run: osPower.sleep },
    { label: t("Restart", "Перезагрузить"), run: osPower.restart },
    { label: t("Restart to UEFI (BIOS)", "Перезагрузить в UEFI (BIOS)"), run: osPower.restartToFirmware },
    { label: t("Shut Down", "Выключить"), run: osPower.shutdown, danger: true },
  ];
}

/** Открыть меню над элементом «Насеста». */
function menuAbove(e: React.MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  const { k, left, top } = stageScale();
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  useOs.getState().openCtx({ x: (r.left + r.width / 2 - left) / k, y: (r.top - top) / k - 12, items, above: true });
}

export function Perch() {
  const os = useOs();
  const { t, lang } = useLang();
  const trashFull = useFs((s) => Object.keys(s.nodes).some(isTrashed));
  const trashDrop = useDrop(TRASH);
  const [launch, setLaunch] = useState<Record<string, number>>({});
  const prev = useRef<Record<string, number> | null>(null);

  const alive = os.windows.filter((w) => w.phase !== "closing");
  const pinned = os.prefs.dock;
  const extra = [...new Set(alive.map((w) => w.app))].filter((a) => !pinned.includes(a) && !APP_META[a].hidden);
  const front = [...alive].filter((w) => !w.min && w.space === os.space).sort((a, b) => b.z - a.z)[0];
  const frontApp = !os.deskFocus && front ? front.app : null;

  // запуск программы: по иконке расходится кольцо
  useEffect(() => {
    const counts: Record<string, number> = {};
    os.windows.forEach((w) => { counts[w.app] = (counts[w.app] ?? 0) + 1; });
    const before = prev.current;
    if (before) {
      const grown = Object.keys(counts).filter((app) => counts[app] > (before[app] ?? 0));
      if (grown.length) setLaunch((b) => ({ ...b, ...Object.fromEntries(grown.map((a) => [a, (b[a] ?? 0) + 1])) }));
    }
    prev.current = counts;
  }, [os.windows.length]);

  const click = (app: string) => {
    const ws = alive.filter((w) => w.app === app);
    if (!ws.length) return os.open(app);
    const topWin = [...ws].sort((a, b) => b.z - a.z)[0];
    // программа уже впереди — щелчок сворачивает её окна, иначе выводит вперёд (свёрнутое — возвращает)
    if (frontApp === app && !topWin.min) return ws.filter((w) => !w.min).forEach((w) => os.minimize(w.id));
    os.focus((ws.find((w) => w.min && w.space === os.space) ?? topWin).id);
  };

  const appMenu = (app: string): MenuItem[] => {
    const keep = pinned.includes(app);
    const ws = alive.filter((w) => w.app === app);
    const name = APP_META[app].title[lang];
    const items: MenuItem[] = ws.map((w) => ({
      label: w.arg ? `${name} — ${w.arg === "~" ? os.prefs.userName : w.arg.split("/").pop()}` : name,
      run: () => os.focus(w.id),
      check: !w.min,
    }));
    if (ws.length) items.push("sep");
    if (!(APP_META[app].single && ws.length)) items.push({ label: ws.length ? t("New Window", "Новое окно") : t("Open", "Открыть"), run: () => os.open(app) });
    items.push({
      label: keep ? t("Unpin from Perch", "Открепить от «Насеста»") : t("Pin to Perch", "Закрепить на «Насесте»"),
      run: () => os.setPref("dock", keep ? pinned.filter((a) => a !== app) : [...pinned, app]),
    });
    if (ws.length) {
      items.push("sep",
        { label: t("Minimize All", "Свернуть все"), run: () => ws.filter((w) => !w.min).forEach((w) => os.minimize(w.id)) },
        { label: t("Quit", "Завершить"), run: () => os.quit(app), shortcut: "Alt+Q" });
    }
    return items;
  };

  const slot = (app: string) => {
    const running = alive.some((w) => w.app === app);
    const isFront = frontApp === app;
    const title = APP_META[app].title[lang];
    return (
      <div key={app} data-app={app} className={"pa" + (running ? " running" : "") + (isFront ? " front" : "") + (isFront && os.prefs.perchLabels ? " named" : "")}>
        <button className="pa-btn" onClick={() => click(app)} onContextMenu={(e) => menuAbove(e, appMenu(app))} aria-label={title}>
          <span key={launch[app] ?? 0} className={"pa-icon" + (launch[app] ? " launch" : "")}>
            <AppIcon name={APP_META[app].icon} size={46} />
          </span>
          <span className="pa-name">{title}</span>
        </button>
        <i className="pa-dot" />
        <span className="perch-tip">{title}</span>
      </div>
    );
  };

  return (
    <div className="perch-wrap" onPointerDown={(e) => e.stopPropagation()}>
      <nav className="perch">
        <button
          className={"perch-nest" + (os.panel === "nest" ? " on" : "")}
          onClick={() => os.setPanel("nest")}
          onContextMenu={(e) => menuAbove(e, systemMenu(t, os.prefs.userName))}
          aria-label={t("All apps", "Все программы")}
        >
          <OsLogo size={30} mono />
          <span className="perch-tip">{t("All apps · Alt+L", "Все программы · Alt+L")}</span>
        </button>
        <div className="perch-apps">
          {pinned.map(slot)}
          {extra.length > 0 && <i className="perch-sep" />}
          {extra.map(slot)}
          <i className="perch-sep" />
          <div data-app="trash" className={"pa" + (trashDrop.over ? " drop" : "")} {...trashDrop.props}>
            <button className="pa-btn" onClick={() => os.open("finder", TRASH)} aria-label={t("Trash", "Корзина")}
              onContextMenu={(e) => menuAbove(e, [
                { label: t("Open", "Открыть"), run: () => os.open("finder", TRASH) },
                { label: t("Empty Trash", "Очистить Корзину"), run: () => useFs.getState().emptyTrash(), disabled: !trashFull },
              ])}>
              <span className="pa-icon"><AppIcon name={trashFull ? "trashFull" : "trash"} size={46} /></span>
            </button>
            <span className="perch-tip">{t("Trash", "Корзина")}</span>
          </div>
        </div>
        <Spaces />
        <StatusButton />
      </nav>
    </div>
  );
}

/** Рабочие столы: цифры; щелчок — перейти, двойной — «Все окна». */
function Spaces() {
  const os = useOs();
  const { t } = useLang();
  return (
    <div className="perch-spaces">
      {Array.from({ length: os.spaces }, (_, i) => {
        const n = os.windows.filter((w) => w.space === i && w.phase !== "closing").length;
        return (
          <button key={i} className={"ps" + (i === os.space ? " on" : "") + (n ? " busy" : "")} onClick={() => os.goSpace(i)}
            onDoubleClick={() => os.setPanel("overview")} aria-label={t(`Desktop ${i + 1}`, `Рабочий стол ${i + 1}`)}>
            {i + 1}
          </button>
        );
      })}
      <button className={"ps ps-all" + (os.panel === "overview" ? " on" : "")} onClick={() => os.setPanel("overview")} aria-label={t("All windows", "Все окна")}>
        <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="7.5" height="6" rx="1.6" /><rect x="13" y="5" width="7.5" height="6" rx="1.6" /><rect x="3.5" y="13" width="7.5" height="6" rx="1.6" /><rect x="13" y="13" width="7.5" height="6" rx="1.6" /></svg>
      </button>
      <span className="perch-tip">{t("Desktops · Alt+←/→ · Alt+↑ all windows", "Рабочие столы · Alt+←/→ · Alt+↑ все окна")}</span>
    </div>
  );
}

/** Статус: музыка, таймер, сеть, звук, время. Щелчок — «Хаб». */
function StatusButton() {
  const os = useOs();
  const saved = useStore((s) => s.saved);
  const { lang, t } = useLang();
  const muted = useMuted();
  const volume = useVolume();
  const now = useNow();
  const fmt = useTimeFormat();
  const clock = useClockState();
  const mu = useMusic();
  const left = timerLeft(clock);
  const silent = !saved.hdAudio || muted || volume === 0;
  const unread = os.notices.length;
  return (
    <button className={"perch-status" + (os.panel === "hub" ? " on" : "")} onClick={() => os.setPanel("hub")} aria-label={t("Hub", "Хаб")}>
      {mu.playing && (
        <span className="st-chip music"><b className="mu-eq"><em /><em /><em /></b>{TRACKS[mu.track].title}</span>
      )}
      {clock.end !== null && left !== null && (
        <span className="st-chip timer">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
          {fmtTimer(left)}
        </span>
      )}
      <span className={"st-ico" + (saved.lanController ? "" : " off")} title={saved.lanController ? "Ethernet" : t("No network", "Нет сети")}>
        <svg viewBox="0 0 24 24"><path d="M12 4v5M7 13V9h10v4M4 20v-4h6v4zM14 20v-4h6v4z" />{!saved.lanController && <path d="M3 3l18 18" />}</svg>
      </span>
      <span className={"st-ico" + (silent ? " off" : "")}>
        <svg viewBox="0 0 24 24">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {silent ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <><path d="M16 9.5a3.5 3.5 0 0 1 0 5" />{volume > 0.5 && <path d="M18.5 7a7 7 0 0 1 0 10" />}</>}
        </svg>
      </span>
      <span className="st-time">
        <b>{fmt(now)}</b>
        <small>{now.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { weekday: "short", day: "numeric", month: "short" })}</small>
      </span>
      {unread > 0 && <span className="st-badge">{unread > 9 ? "9+" : unread}</span>}
    </button>
  );
}

/** Всплывающее уведомление в правом верхнем углу; щелчок открывает программу. */
export function Toasts() {
  const os = useOs();
  const { lang } = useLang();
  const current = os.notices.find((n) => n.id === os.banner) ?? null;
  const [shown, setShown] = useState<Notice | null>(current);
  useEffect(() => { if (current) setShown(current); }, [current?.id]);
  const { mounted, closing } = usePresence(!!current, 260);
  if (!mounted || !shown) return null;
  return (
    <div className={"toast" + (closing ? " closing" : "") + (shown.app === "quests" ? " trophy" : "")} key={shown.id}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => { useOs.setState({ banner: null }); os.open(shown.app); }}>
      <AppIcon name={APP_META[shown.app]?.icon ?? "pc"} size={44} />
      <span className="toast-text">
        <small>{APP_META[shown.app]?.title[lang] ?? "Kestrel"}</small>
        <b>{shown.title}</b>
        {shown.body && <span>{shown.body}</span>}
      </span>
      <i className="toast-timer" />
    </div>
  );
}

/** «Хаб»: дата, быстрые плитки, яркость и звук, режим питания, музыка, таймер, уведомления. */
export function Hub() {
  const os = useOs();
  const saved = useStore((s) => s.saved);
  const { lang, t } = useLang();
  const muted = useMuted();
  const volume = useVolume();
  const now = useNow();
  const fmt = useTimeFormat();
  const mu = useMusic();
  const clock = useClockState();
  const left = timerLeft(clock);
  const { mounted, closing } = usePresence(os.panel === "hub", 260);
  if (!mounted) return null;
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const light = os.prefs.theme === "light";
  const ago = (ms: number) => {
    const m = Math.floor((Date.now() - ms) / 60000);
    return m < 1 ? t("now", "сейчас") : m < 60 ? t(`${m} min`, `${m} мин`) : fmt(new Date(ms));
  };

  const tiles: { id: string; on: boolean; name: string; sub: string; icon: React.ReactNode; run?: () => void }[] = [
    { id: "net", on: !!saved.lanController, name: t("Network", "Сеть"), sub: saved.lanController ? "Ethernet · 1 Gbit/s" : t("Disabled in BIOS", "Выключена в BIOS"),
      icon: <path d="M12 4v5M7 13V9h10v4M4 20v-4h6v4zM14 20v-4h6v4z" /> },
    { id: "dnd", on: os.dnd, name: t("Do Not Disturb", "Не беспокоить"), sub: os.dnd ? t("On", "Вкл.") : t("Off", "Выкл."),
      icon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />, run: () => useOs.setState({ dnd: !os.dnd }) },
    { id: "night", on: os.prefs.nightLight, name: t("Night Light", "Ночной свет"), sub: os.prefs.nightLight ? t("Warm screen", "Тёплый экран") : t("Off", "Выкл."),
      icon: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>, run: () => os.setPref("nightLight", !os.prefs.nightLight) },
    { id: "theme", on: light, name: t("Light Theme", "Светлая тема"), sub: { dark: t("Dark", "Тёмная"), light: t("Light", "Светлая"), auto: t("Auto", "Авто") }[os.prefs.theme],
      icon: <path d="M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18" />, run: () => os.setPref("theme", light ? "dark" : "light") },
  ];

  return (
    <aside className={"hub" + (closing ? " closing" : "")} onPointerDown={(e) => e.stopPropagation()}>
      <header className="hub-head">
        <div>
          <div className="hub-time">{fmt(now)}</div>
          <div className="hub-date">{now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <div className="hub-user">
          <span className="avatar">{os.prefs.userName.slice(0, 1).toUpperCase()}</span>
          <button className="hub-round" title={t("Power", "Питание")} onClick={(e) => {
            const { k, left: l0, top } = stageScale();
            const r = e.currentTarget.getBoundingClientRect();
            os.openCtx({ x: (r.right - l0) / k - 300, y: (r.bottom - top) / k + 8, items: systemMenu(t, os.prefs.userName) });
          }}>
            <svg viewBox="0 0 24 24"><path d="M12 3v8M6.5 6.5a8 8 0 1 0 11 0" /></svg>
          </button>
        </div>
      </header>

      <div className="hub-tiles">
        {tiles.map((x, i) => (
          <button key={x.id} className={"hub-tile" + (x.on ? " on" : "") + (x.run ? "" : " static")} style={{ animationDelay: `${40 + i * 30}ms` }} onClick={x.run}>
            <span className="ht-ico"><svg viewBox="0 0 24 24">{x.icon}</svg></span>
            <span className="ht-text"><b>{x.name}</b><small>{x.sub}</small></span>
          </button>
        ))}
      </div>

      <div className="hub-card">
        <Slider label={t("Brightness", "Яркость")} value={(os.brightness - 0.3) / 0.7} onChange={(v) => useOs.setState({ brightness: 0.3 + v * 0.7 })}
          icon={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>} />
        {saved.hdAudio ? (
          <Slider label={t("Volume", "Громкость")} value={muted ? 0 : volume} onChange={(v) => { sound.setVolume(v); if (muted && v > 0) sound.setMuted(false); }}
            icon={<path d="M4 9h4l5-4v14l-5-4H4z" />} />
        ) : (
          <div className="hub-note">{t("No sound output: HD Audio is disabled in BIOS", "Нет вывода звука: HD Audio выключен в BIOS")}</div>
        )}
        <div className="hub-seg">
          {([["quiet", t("Quiet", "Тихий")], ["balanced", t("Balanced", "Баланс")], ["performance", t("Performance", "Мощность")]] as const).map(([id, name]) => (
            <button key={id} className={os.prefs.power === id ? "on" : ""} onClick={() => os.setPref("power", id)}>{name}</button>
          ))}
        </div>
        <div className="hub-note">{{
          quiet: t("Lower clock, cooler and quieter", "Ниже частота — холоднее и тише"),
          balanced: t("Clock set in BIOS", "Частота как в BIOS"),
          performance: t("+200 MHz boost, runs hotter", "+200 МГц, процессор горячее"),
        }[os.prefs.power]}</div>
      </div>

      {(mu.playing || clock.end !== null) && (
        <div className="hub-card hub-live">
          {mu.playing && (
            <div className="hub-media">
              <span className="hm-art"><b className="mu-eq"><em /><em /><em /></b></span>
              <span className="hm-text"><b>{TRACKS[mu.track].title}</b><small>{t("Now playing", "Сейчас играет")}</small></span>
              <button className="hub-round" onClick={() => music.pause()} title={t("Pause", "Пауза")}>
                <svg viewBox="0 0 24 24"><path d="M9 6v12M15 6v12" /></svg>
              </button>
            </div>
          )}
          {clock.end !== null && left !== null && (
            <button className="hub-media" onClick={() => os.open("clock")}>
              <span className="hm-art timer"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg></span>
              <span className="hm-text"><b>{fmtTimer(left)}</b><small>{t("Timer", "Таймер")}</small></span>
            </button>
          )}
        </div>
      )}

      <div className="hub-nhead">
        <span>{t("Notifications", "Уведомления")}</span>
        {os.notices.length > 0 && <button onClick={() => useOs.setState({ notices: [] })}>{t("Clear all", "Очистить")}</button>}
      </div>
      <div className="hub-list">
        {os.notices.map((n, i) => (
          <button key={n.id} className="hub-notice" style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }} onClick={() => { os.dismiss(); os.open(n.app); }}>
            <AppIcon name={APP_META[n.app]?.icon ?? "pc"} size={36} />
            <span className="hn-text"><b>{n.title}</b><span>{n.body}</span></span>
            <span className="hn-time">{ago(n.time)}</span>
          </button>
        ))}
        {!os.notices.length && <div className="hub-empty">{t("You're all caught up", "Новых уведомлений нет")}</div>}
      </div>

      <footer className="hub-foot">
        <button onClick={() => os.setPanel("widgets")}>{t("Edit widgets", "Виджеты")}</button>
        <button onClick={() => os.open("settings")}>{t("All settings", "Все настройки")}</button>
      </footer>
    </aside>
  );
}

function Slider({ value, onChange, icon, label }: { value: number; onChange: (v: number) => void; icon: React.ReactNode; label: string }) {
  const set = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  return (
    <div className="hub-slider" role="slider" aria-label={label} aria-valuenow={Math.round(value * 100)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => e.buttons && set(e)}>
      <div className="hs-fill" style={{ width: `calc(${value * 100}% + ${(1 - value) * 40}px)` }} />
      <span className="hs-ico"><svg viewBox="0 0 24 24">{icon}</svg></span>
      <span className="hs-label">{label}</span>
    </div>
  );
}
