import { useEffect, useRef, useState } from "react";
import { useLang } from "../machine/store";
import { useOs, topWindow } from "./osStore";
import { AppIcon } from "./AppIcon";
import { Window } from "./Window";
import { Hub, Perch, Toasts } from "./Perch";
import { AboutPanel, AppSwitcher, Nest, OverviewBackdrop, ShortcutsPanel, Swoop, WelcomePanel } from "./Overlays";
import { ContextMenuLayer } from "./Menus";
import { DesktopWidgets, WidgetGallery } from "./Widgets";
import { Wallpaper } from "./Wallpaper";
import { HOME, join, useFs } from "./fs";
import { FileItem, ctxAt, itemMenu, openPath, useDrop } from "./apps/Finder";
import { cmd, handleShortcut, switcherCommit } from "./commands";
import { useTimerService } from "./apps/Clock";
import { useLoadService } from "./load";
import { ensureNotes } from "./apps/Notes";
import { onQuest, unlock } from "../machine/quests";
import { useStore } from "../machine/store";
import { cpuGhz } from "../machine/sensors";

const DESK = `${HOME}/Desktop`;

/** «Авто»: светлое днём (7:00–19:00), тёмное вечером и ночью. */
const isLight = (theme: "dark" | "light" | "auto") => {
  if (theme !== "auto") return theme === "light";
  const h = new Date().getHours();
  return h >= 7 && h < 19;
};

/**
 * Рабочий стол Kestrel: обои, виджеты, значок диска и файлы справа, окна, «Насест» внизу, «Хаб» справа.
 * Сверху ничего нет — весь экран отдан окнам.
 * Правая кнопка мыши работает только там, где у неё есть смысл: пустой рабочий стол, файлы, виджеты, «Насест».
 */
export function Desktop() {
  const os = useOs();
  const { t } = useLang();
  const fs = useFs();
  const [sel, setSel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const top = topWindow(os.windows);
  const files = fs.list(DESK);
  const deskDrop = useDrop(DESK);
  // выделенный файл для обработчика клавиатуры, подписанного один раз
  const selRef = useRef<string | null>(null);
  selRef.current = sel === "disk" ? null : sel;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (handleShortcut(e)) { e.preventDefault(); return; }
      if (e.key === "Escape") { os.dismiss(); useOs.setState({ switcher: null }); return; }
      // файлы на рабочем столе: Enter — переименовать, Delete — в Корзину
      const s = selRef.current;
      if (!s || useOs.getState().deskFocus === false || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Enter") setRenaming(s);
      if (e.key === "Delete") { useFs.getState().trash(s); setSel(null); }
    };
    // переключатель приложений срабатывает, когда отпускают Alt
    const onUp = (e: KeyboardEvent) => { if (e.key === "Alt") { e.preventDefault(); switcherCommit(); } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }, []);
  useTimerService();
  // первый вход пользователя — приветствие (после того как выедут панели)
  useEffect(() => {
    if (useOs.getState().prefs.welcomed) return;
    const id = window.setTimeout(() => useOs.getState().setPanel("welcome"), 900);
    return () => clearTimeout(id);
  }, [os.prefs.userName]);
  useLoadService();
  // испытания: дошли до рабочего стола; разгон; без сети. Полученные испытания попадают в уведомления «Хаба»
  useEffect(() => {
    const m = useStore.getState();
    unlock("boot");
    ensureNotes(m.pending.language === "Русский");
    if (cpuGhz(m.saved) >= 5 && !m.osUnstable) unlock("oc5");
    if (!m.saved.lanController) unlock("offline");
    return onQuest((q) => {
      const ru = useStore.getState().pending.language === "Русский";
      const n = { id: Date.now() + Math.random(), app: "quests", title: ru ? "Испытание пройдено" : "Challenge complete", body: q.title[ru ? "ru" : "en"], time: Date.now() };
      useOs.setState((s) => ({ notices: [n, ...s.notices].slice(0, 30) }));
    });
  }, []);

  return (
    <div
      className={"desktop" + (os.panel === "overview" ? " overview" : "") + (isLight(os.prefs.theme) ? " light" : "") + (os.panel === "nest" ? " nesting" : "")}
      onPointerDown={() => { os.dismiss(); setSel(null); useOs.setState({ deskFocus: true }); }}
      onContextMenu={(e) => {
        // системное меню браузера не показываем нигде, кроме текстовых полей
        if ((e.target as HTMLElement).closest("input, textarea")) return;
        e.preventDefault();
      }}
    >
      <Wallpaper id={os.prefs.wallpaper} />
      <div
        className={"desk-surface" + (deskDrop.over ? " drop" : "")}
        {...deskDrop.props}
        onContextMenu={(e) => ctxAt(e, [
          { label: t("New Folder", "Новая папка"), run: () => { const n = fs.freeName(DESK, t("untitled folder", "новая папка")); fs.mkdir(join(DESK, n)); setSel(join(DESK, n)); setRenaming(join(DESK, n)); } },
          { label: t("New Text Document", "Новый текстовый документ"), run: () => cmd.newTextFile(DESK) },
          "sep",
          { label: t("Change Wallpaper…", "Изменить обои…"), run: () => os.open("settings") },
          { label: t("Edit Widgets…", "Изменить виджеты…"), run: () => os.setPanel("widgets") },
        ])}
      />

      <DesktopWidgets />

      <div className="desk-icons" {...deskDrop.props}>
        <div
          className={"fd-item desk" + (sel === "disk" ? " sel" : "")}
          onPointerDown={(e) => { e.stopPropagation(); os.dismiss(); setSel("disk"); useOs.setState({ deskFocus: true }); }}
          onDoubleClick={() => os.open("finder", "disk")}
          onContextMenu={(e) => { setSel("disk"); ctxAt(e, [{ label: t("Open", "Открыть"), run: () => os.open("finder", "disk") }, { label: t("About This PC", "Об этом компьютере"), run: () => os.open("thispc") }]); }}
        >
          <AppIcon name="disk" size={64} />
          <span className="fd-name">Kestrel HD</span>
        </div>
        {files.map((n) => {
          const p = join(DESK, n);
          return (
            <FileItem
              key={p} path={p} className="desk" selected={sel === p} renaming={renaming === p}
              onSelect={() => { os.dismiss(); setSel(p); useOs.setState({ deskFocus: true }); }}
              onOpen={() => openPath(p)}
              onRenamed={(to) => { setRenaming(null); if (to) setSel(to); }}
              onMenu={(e) => { setSel(p); ctxAt(e, itemMenu(p, t, () => setRenaming(p))); }}
            />
          );
        })}
      </div>

      <OverviewBackdrop />
      {os.windows.filter((w) => !w.min && w.space === os.space).map((w) => (
        <Window key={w.id} win={w} active={top?.id === w.id && !os.deskFocus} />
      ))}

      <Perch />
      <Hub />
      <Toasts />
      <WidgetGallery />
      <Nest />
      <Swoop />
      <AboutPanel />
      <ShortcutsPanel />
      <AppSwitcher />
      <WelcomePanel />
      <ContextMenuLayer />
      <div className={"night-light" + (os.prefs.nightLight ? " on" : "")} />
      <div className="brightness" style={{ opacity: 1 - os.brightness }} />
    </div>
  );
}
