// Строка меню сверху (как в macOS): меню системы, меню активного приложения, статус и часы.
// Все пункты рабочие; ⌥ — это Alt, ⌃ — Ctrl.
import { useState } from "react";
import { useStore, useLang } from "../machine/store";
import { sound, useMuted, useVolume } from "../machine/audio";
import { useOs, topWindow, type MenuItem } from "./osStore";
import { APP_META } from "./apps/meta";
import { OsLogo } from "./AppIcon";
import { osPower } from "./power";
import { cmd, editable } from "./commands";
import { MenuList } from "./Menus";
import { HOME, TRASH } from "./fs";
import { useNow, usePresence } from "./util";

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
        { label: "Launchpad", run: () => os.setPanel("launchpad"), shortcut: "⌥L" },
        { label: "Spotlight", run: () => os.setPanel("spotlight"), shortcut: "⌃Space" },
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
  const now = useNow();
  const menus = useMenus();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const clock = now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) + "  " +
    now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const silent = !saved.hdAudio || muted || volume === 0;

  return (
    <div
      className="menubar"
      // меню не забирает фокус у текстового поля — иначе «Правка» не знала бы, с чем работать
      onPointerDown={(e) => { e.stopPropagation(); if (!(e.target as HTMLElement).closest("input")) e.preventDefault(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="mb-left">
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
      </div>
      <div className="mb-right">
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
        <button className="mb-clock" onPointerDown={() => os.open("calendar")}>{clock}</button>
      </div>
      <ControlCenter />
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
