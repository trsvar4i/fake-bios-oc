// Строка меню сверху (как в macOS): меню системы, меню активного приложения, статус и часы.
// Все пункты рабочие; ⌥ — это Alt, ⌃ — Ctrl.
import { useState } from "react";
import { useStore, useLang } from "../machine/store";
import { sound, useMuted, useVolume } from "../machine/audio";
import { useOs, topWindow, type MenuItem } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon, OsLogo } from "./AppIcon";
import { fmtTimer, timerLeft, useClockState } from "./apps/Clock";
import { TRACKS, useMusic } from "./music";
import { osPower } from "./power";
import { cmd, editable } from "./commands";
import { MenuList } from "./Menus";
import { HOME, TRASH } from "./fs";
import { useNow, usePresence, useTimeFormat } from "./util";

interface Menu { id: string; title: React.ReactNode; bold?: boolean; items: MenuItem[] }

function useMenus(): Menu[] {
  const os = useOs();
  const { t, lang } = useLang();
  const top = topWindow(os.windows);
  const app = top ? APP_META[top.app] : null;
  const appName = app ? app.title[lang] : "Finder";
  const visible = os.windows.filter((w) => w.phase !== "closing");
  const text = editable();
  const hasSel = !!text && text.selectionStart !== text.selectionEnd;
  const winTitle = (w: (typeof visible)[number]) =>
    APP_META[w.app].title[lang] + (w.arg ? ` — ${w.arg === HOME ? os.prefs.userName : w.arg === TRASH ? t("Trash", "Корзина") : w.arg.split("/").pop()}` : "");

  return [
    {
      id: "system",
      title: <OsLogo size={20} />,
      items: [
        { label: t("About This PC", "Об этом компьютере"), run: () => os.open("thispc") },
        "sep",
        { label: t("System Settings…", "Системные настройки…"), run: cmd.settings, shortcut: "⌥," },
        { label: "Launchpad", run: () => os.setPanel("launchpad"), shortcut: "⌥L" },
        "sep",
        { label: t("Sleep", "Режим сна"), run: osPower.sleep },
        { label: t("Restart…", "Перезагрузить…"), run: osPower.restart },
        { label: t("Restart to UEFI (BIOS)…", "Перезагрузить в UEFI (BIOS)…"), run: osPower.restartToFirmware },
        { label: t("Shut Down…", "Выключить…"), run: osPower.shutdown },
        "sep",
        { label: t("Lock Screen", "Заблокировать экран"), run: osPower.lock },
        { label: t(`Log Out ${os.prefs.userName}…`, `Завершить сеанс «${os.prefs.userName}»…`), run: osPower.logout },
      ],
    },
    {
      id: "app",
      title: appName,
      bold: true,
      items: [
        { label: t(`About ${appName}`, `О программе «${appName}»`), run: () => cmd.about(top?.app ?? "finder") },
        "sep",
        { label: t("Settings…", "Настройки…"), run: cmd.settings, shortcut: "⌥," },
        "sep",
        { label: t(`Hide ${appName}`, `Скрыть «${appName}»`), run: cmd.hideApp, disabled: !top, shortcut: "⌥H" },
        { label: t("Hide Others", "Скрыть остальные"), run: cmd.hideOthers, disabled: !top, shortcut: "⇧⌥H" },
        { label: t("Show All", "Показать все"), run: cmd.showAll, disabled: !visible.some((w) => w.min) },
        "sep",
        { label: t(`Quit ${appName}`, `Завершить «${appName}»`), run: cmd.quitApp, disabled: !top, shortcut: "⌥Q" },
      ],
    },
    {
      id: "file",
      title: t("File", "Файл"),
      items: [
        { label: top && top.app !== "finder" ? t("New Window", "Новое окно") : t("New Finder Window", "Новое окно Finder"), run: cmd.newWindow, shortcut: "⌥N", disabled: !!app?.single },
        { label: t("New Folder", "Новая папка"), run: cmd.newFolder, shortcut: "⇧⌥N" },
        { label: t("New Text Document", "Новый текстовый документ"), run: () => cmd.newTextFile() },
        "sep",
        { label: t("Open Terminal", "Открыть Терминал"), run: () => os.open("terminal") },
        { label: t("Go to Trash", "Открыть Корзину"), run: () => os.open("finder", TRASH) },
        "sep",
        { label: t("Close Window", "Закрыть окно"), run: cmd.closeWindow, disabled: !top, shortcut: "⌥W" },
      ],
    },
    {
      id: "edit",
      title: t("Edit", "Правка"),
      items: [
        { label: t("Undo", "Отменить"), run: cmd.undo, disabled: !text, shortcut: "⌃Z" },
        { label: t("Redo", "Повторить"), run: cmd.redo, disabled: !text, shortcut: "⇧⌃Z" },
        "sep",
        { label: t("Cut", "Вырезать"), run: cmd.cut, disabled: !hasSel, shortcut: "⌃X" },
        { label: t("Copy", "Копировать"), run: cmd.copy, disabled: !hasSel, shortcut: "⌃C" },
        { label: t("Paste", "Вставить"), run: cmd.paste, disabled: !text, shortcut: "⌃V" },
        { label: t("Select All", "Выбрать все"), run: cmd.selectAll, disabled: !text, shortcut: "⌃A" },
      ],
    },
    {
      id: "view",
      title: t("View", "Вид"),
      items: [
        { label: top?.max ? t("Exit Full Size", "Обычный размер") : t("Enter Full Size", "На весь экран"), run: cmd.zoom, disabled: !top },
        "sep",
        { label: t("All Windows", "Все окна"), run: () => os.setPanel("overview"), shortcut: "⌥↑" },
        { label: t("New Desktop", "Новый рабочий стол"), run: os.addSpace, disabled: os.spaces >= 6 },
        { label: t("Next Desktop", "Следующий рабочий стол"), run: () => os.goSpace(os.space + 1), disabled: os.space >= os.spaces - 1, shortcut: "⌥→" },
        { label: t("Previous Desktop", "Предыдущий рабочий стол"), run: () => os.goSpace(os.space - 1), disabled: os.space === 0, shortcut: "⌥←" },
        { label: "Launchpad", run: () => os.setPanel("launchpad"), shortcut: "⌥L" },
        { label: "Spotlight", run: () => os.setPanel("spotlight"), shortcut: "⌃Space" },
        { label: t("Notifications", "Уведомления"), run: () => os.setPanel("notifications") },
        { label: t("Edit Widgets…", "Изменить виджеты…"), run: () => os.setPanel("widgets") },
        { label: t("Control Center", "Пункт управления"), run: () => os.setPanel("control") },
      ],
    },
    {
      id: "window",
      title: t("Window", "Окно"),
      items: [
        { label: t("Minimize", "Свернуть"), run: cmd.minimize, disabled: !top, shortcut: "⌥M" },
        { label: t("Zoom", "Изменить масштаб"), run: cmd.zoom, disabled: !top },
        { label: t("Move Window to Left Half", "Окно в левую половину"), run: () => top && os.snap(top.id, "left"), disabled: !top },
        { label: t("Move Window to Right Half", "Окно в правую половину"), run: () => top && os.snap(top.id, "right"), disabled: !top },
        "sep",
        { label: t("Bring All to Front", "Все окна — на передний план"), run: cmd.bringAllToFront, disabled: !top },
        "sep",
        ...Array.from({ length: os.spaces }, (_, i): MenuItem => ({
          label: t(`Move to Desktop ${i + 1}`, `Перенести на рабочий стол ${i + 1}`),
          run: () => top && os.moveToSpace(top.id, i),
          disabled: !top || top.space === i,
        })),
        ...(visible.length ? (["sep"] as MenuItem[]) : []),
        ...visible.map((w): MenuItem => ({ label: winTitle(w), run: () => os.focus(w.id), check: top?.id === w.id })),
      ],
    },
    {
      id: "help",
      title: t("Help", "Справка"),
      items: [
        { label: t("Keyboard Shortcuts", "Сочетания клавиш"), run: () => os.setPanel("shortcuts") },
        { label: t("Terminal Commands", "Команды Терминала"), run: () => os.open("terminal") },
      ],
    },
  ];
}

export function MenuBar() {
  const os = useOs();
  const saved = useStore((s) => s.saved);
  const { lang, t } = useLang();
  const muted = useMuted();
  const volume = useVolume();
  const menus = useMenus();
  const silent = !saved.hdAudio || muted || volume === 0;

  return (
    <div
      className="menubar"
      // меню не забирает фокус у текстового поля — иначе «Правка» не знала бы, с чем работать
      onPointerDown={(e) => { e.stopPropagation(); if (!(e.target as HTMLElement).closest("input")) e.preventDefault(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="island mb-left">
        {menus.map((m) => (
          <div key={m.id} className="mb-menu">
            <button
              className={"mb-title" + (m.bold ? " bold" : "") + (m.id === "system" ? " logo" : "") + (os.menu === m.id ? " on" : "")}
              onPointerDown={() => os.setMenu(os.menu === m.id ? null : m.id)}
              onPointerEnter={() => os.menu && os.menu !== m.id && os.setMenu(m.id)}
            >
              {m.title}
            </button>
            <Dropdown open={os.menu === m.id} items={m.items} help={m.id === "help" ? menus.filter((x) => x.id !== "help") : undefined} />
          </div>
        ))}
        <div className="spaces-dots" title={t("Desktops", "Рабочие столы")}>
          {Array.from({ length: os.spaces }, (_, i) => (
            <button key={i} className={i === os.space ? "on" : ""} onPointerDown={() => os.goSpace(i)} aria-label={`Desktop ${i + 1}`} />
          ))}
        </div>
      </div>
      <CenterIsland />
      <div className="island mb-right">
        <button className={"mb-ico" + (os.panel === "overview" ? " on" : "")} onPointerDown={() => os.setPanel("overview")} title={t("All Windows", "Все окна")}>
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="8" height="6" rx="1.5" /><rect x="13" y="5" width="8" height="6" rx="1.5" /><rect x="3" y="13" width="8" height="6" rx="1.5" /><rect x="13" y="13" width="8" height="6" rx="1.5" /></svg>
        </button>
        <button className={"mb-ico" + (saved.lanController ? "" : " off")} onPointerDown={() => os.setPanel("control")} title={saved.lanController ? "Ethernet" : t("No network", "Нет сети")}>
          <svg viewBox="0 0 24 24"><path d="M12 4v5M7 13V9h10v4M4 20v-4h6v4zM14 20v-4h6v4z" />{!saved.lanController && <path d="M3 3l18 18" />}</svg>
        </button>
        <button className="mb-ico" onPointerDown={() => os.setPanel("control")} title={t("Sound", "Звук")}>
          <svg viewBox="0 0 24 24">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {silent ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <>
              <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
              {volume > 0.5 && <path d="M18.5 7a7 7 0 0 1 0 10" />}
            </>}
          </svg>
        </button>
        <button className={"mb-ico" + (os.panel === "spotlight" ? " on" : "")} onPointerDown={() => os.setPanel("spotlight")} title="Spotlight">
          <svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>
        </button>
        <button className={"mb-ico" + (os.panel === "control" ? " on" : "")} onPointerDown={() => os.setPanel("control")} title={t("Control Center", "Пункт управления")}>
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="6" rx="3" /><circle cx="15" cy="8" r="1.6" className="fill" /><rect x="3" y="13" width="18" height="6" rx="3" /><circle cx="9" cy="16" r="1.6" className="fill" /></svg>
        </button>
      </div>
      <ControlCenter />
      <NotificationCenter />
    </div>
  );
}

/**
 * Центральный островок (как «динамический остров» из os-design.md): время и дата;
 * плавно расширяется, когда идёт таймер или пришло уведомление. Щелчок — центр уведомлений.
 */
function CenterIsland() {
  const os = useOs();
  const { lang, t } = useLang();
  const now = useNow();
  const clock = useClockState();
  const fmt = useTimeFormat();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const banner = os.notices.find((n) => n.id === os.banner);
  const left = timerLeft(clock);
  const timing = clock.end !== null;
  const mu = useMusic();
  const width = banner ? 560 : 250 + (timing ? 80 : 0) + (mu.playing ? 190 : 0);
  return (
    <button
      className={"island mb-center" + (banner ? " expanded" : "") + (os.panel === "notifications" ? " on" : "")}
      style={{ width }}
      onPointerDown={() => (banner ? (useOs.setState({ banner: null }), os.open(banner.app)) : os.setPanel("notifications"))}
    >
      {banner ? (
        <span key={banner.id} className="isl-banner">
          <AppIcon name={APP_META[banner.app]?.icon ?? "pc"} size={26} />
          <b>{banner.title}</b>
          <span>{banner.body}</span>
        </span>
      ) : (
        <span key="clock" className="isl-clock">
          <span className="isl-date">{now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}</span>
          <b>{fmt(now)}</b>
          {mu.playing && (
            <span className="isl-music" title={t("Now Playing", "Сейчас играет")} onPointerDown={(e) => { e.stopPropagation(); os.open("music"); }}>
              <b className="mu-eq"><em /><em /><em /></b>{TRACKS[mu.track].title}
            </span>
          )}
          {timing && left !== null && (
            <span className="isl-timer" title={t("Timer", "Таймер")}>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
              {fmtTimer(left)}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** Центр уведомлений: история уведомлений и календарь на сегодня. */
function NotificationCenter() {
  const os = useOs();
  const { lang, t } = useLang();
  const { mounted, closing } = usePresence(os.panel === "notifications", 220);
  const now = useNow();
  const fmt = useTimeFormat();
  if (!mounted) return null;
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const ago = (ms: number) => {
    const m = Math.floor((Date.now() - ms) / 60000);
    return m < 1 ? t("now", "сейчас") : m < 60 ? t(`${m} min ago`, `${m} мин назад`) : fmt(new Date(ms));
  };
  return (
    <div className={"ncenter" + (closing ? " closing" : "")} onPointerDown={(e) => e.stopPropagation()}>
      <div className="nc-today">
        <div className="nc-day">{now.toLocaleDateString(locale, { weekday: "long" })}</div>
        <div className="nc-date">{now.toLocaleDateString(locale, { day: "numeric", month: "long" })}</div>
      </div>
      <div className="nc-head">
        <span>{t("Notifications", "Уведомления")}</span>
        {os.notices.length > 0 && <button onClick={() => useOs.setState({ notices: [] })}>{t("Clear", "Очистить")}</button>}
      </div>
      <div className="nc-list">
        {os.notices.map((n) => (
          <button key={n.id} className="nc-item" onClick={() => { os.dismiss(); os.open(n.app); }}>
            <AppIcon name={APP_META[n.app]?.icon ?? "pc"} size={34} />
            <span className="nc-text"><b>{n.title}</b><span>{n.body}</span></span>
            <span className="nc-time">{ago(n.time)}</span>
          </button>
        ))}
        {!os.notices.length && <div className="nc-empty">{t("No notifications", "Нет уведомлений")}</div>}
      </div>
    </div>
  );
}

/** Выпадающее меню. У «Справки» сверху поиск по всем пунктам меню, как в macOS. */
function Dropdown({ open, items, help }: { open: boolean; items: MenuItem[]; help?: Menu[] }) {
  const { t } = useLang();
  const { mounted, closing } = usePresence(open, 160);
  const [q, setQ] = useState("");
  if (!mounted) return null;
  const query = q.trim().toLowerCase();
  const found: MenuItem[] = help && query
    ? help.flatMap((m) => m.items.filter((it) => it !== "sep" && !it.disabled && it.label.toLowerCase().includes(query)))
    : [];
  return (
    <div className={"dropdown" + (closing ? " closing" : "")}>
      {help && (
        <div className="dd-search">
          <input autoFocus value={q} placeholder={t("Search menus", "Поиск по меню")} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {help && query && (found.length
        ? <><MenuList items={found} onPick={() => setQ("")} /><div className="dd-sep" /></>
        : <div className="dd-none">{t("No results", "Ничего не найдено")}</div>)}
      <MenuList items={items} />
    </div>
  );
}

/** Пункт управления: сеть, «Не беспокоить», яркость, звук. */
function ControlCenter() {
  const os = useOs();
  const saved = useStore((s) => s.saved);
  const { t } = useLang();
  const muted = useMuted();
  const volume = useVolume();
  const { mounted, closing } = usePresence(os.panel === "control", 200);
  if (!mounted) return null;

  return (
    <div className={"cc" + (closing ? " closing" : "")} onPointerDown={(e) => e.stopPropagation()}>
      <div className="cc-row">
        <div className="cc-tile cc-net">
          <div className={"cc-toggle" + (saved.lanController ? " on" : "")}>
            <svg viewBox="0 0 24 24"><path d="M12 4v5M7 13V9h10v4M4 20v-4h6v4zM14 20v-4h6v4z" /></svg>
          </div>
          <div>
            <div className="cc-name">{t("Network", "Сеть")}</div>
            <div className="cc-sub">{saved.lanController ? t("Ethernet connected", "Ethernet подключён") : t("Network card disabled in BIOS", "Сетевая карта выключена в BIOS")}</div>
          </div>
        </div>
        <button className="cc-tile cc-focus" onClick={() => useOs.setState({ dnd: !os.dnd })}>
          <div className={"cc-toggle" + (os.dnd ? " on" : "")}>
            <svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
          </div>
          <div>
            <div className="cc-name">{t("Do Not Disturb", "Не беспокоить")}</div>
            <div className="cc-sub">{os.dnd ? t("On", "Вкл.") : t("Off", "Выкл.")}</div>
          </div>
        </button>
      </div>
      <div className="cc-tile cc-wide">
        <div className="cc-name">{t("Display", "Дисплей")}</div>
        <Slider value={(os.brightness - 0.3) / 0.7} onChange={(v) => useOs.setState({ brightness: 0.3 + v * 0.7 })}
          icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></svg>} />
      </div>
      <div className="cc-tile cc-wide">
        <div className="cc-name">{t("Sound", "Звук")}</div>
        {saved.hdAudio ? (
          <Slider value={muted ? 0 : volume} onChange={(v) => { sound.setVolume(v); if (muted && v > 0) sound.setMuted(false); }}
            icon={<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" /></svg>} />
        ) : (
          <div className="cc-sub">{t("No output device: HD Audio is disabled in BIOS", "Нет устройства вывода: HD Audio выключен в BIOS")}</div>
        )}
      </div>
      <div className="cc-tile cc-wide">
        <div className="cc-name">{t("Power mode", "Режим питания")}</div>
        <div className="cc-seg">
          {([["quiet", t("Quiet", "Тихий")], ["balanced", t("Balanced", "Баланс")], ["performance", t("Performance", "Мощность")]] as const).map(([id, name]) => (
            <button key={id} className={os.prefs.power === id ? "on" : ""} onClick={() => os.setPref("power", id)}>{name}</button>
          ))}
        </div>
        <div className="cc-sub">{{
          quiet: t("Lower clock, cooler and quieter", "Ниже частота — холоднее и тише"),
          balanced: t("Clock set in BIOS", "Частота как в BIOS"),
          performance: t("+200 MHz boost, runs hotter", "+200 МГц, процессор горячее"),
        }[os.prefs.power]}</div>
      </div>
      <button className="cc-tile cc-wide cc-link" onClick={() => os.setPanel("widgets")}>
        <div className="cc-name">{t("Edit Widgets…", "Изменить виджеты…")}</div>
      </button>
    </div>
  );
}

function Slider({ value, onChange, icon }: { value: number; onChange: (v: number) => void; icon: React.ReactNode }) {
  const set = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  return (
    <div
      className="cc-slider"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => e.buttons && set(e)}
    >
      <div className="cc-fill" style={{ width: `calc(${value * 100}% + ${(1 - value) * 30}px)` }} />
      <span className="cc-slider-ico">{icon}</span>
    </div>
  );
}
