// Команды системы: одни и те же для строки меню, горячих клавиш и Spotlight.
// ⌘ на клавиатуре ПК — это Alt (⌥): Alt+W, Alt+Q, Alt+M, Alt+N, Alt+H, Alt+, ; правка — обычные Ctrl+C/V/X/Z/A.
import { useOs, topWindow } from "./osStore";
import { APP_META } from "./apps/meta";
import { HOME, join, useFs } from "./fs";
import { useStore } from "../machine/store";

const ru = () => useStore.getState().pending.language === "Русский";

const top = () => topWindow(useOs.getState().windows);

/** Текстовое поле, в котором сейчас курсор (для меню «Правка»). */
export const editable = (): HTMLInputElement | HTMLTextAreaElement | null => {
  const el = document.activeElement;
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && /^(text|search|password|)$/.test(el.type)) ? el : null;
};

export const cmd = {
  closeWindow: () => { const w = top(); if (w) useOs.getState().close(w.id); },
  minimize: () => { const w = top(); if (w) useOs.getState().minimize(w.id); },
  zoom: () => { const w = top(); if (w) useOs.getState().toggleMax(w.id); },
  quitApp: () => { const w = top(); if (w) useOs.getState().quit(w.app); },
  hideApp: () => {
    const w = top();
    if (w) useOs.getState().windows.filter((x) => x.app === w.app && !x.min).forEach((x) => useOs.getState().minimize(x.id));
  },
  hideOthers: () => {
    const w = top();
    if (w) useOs.getState().windows.filter((x) => x.app !== w.app && !x.min).forEach((x) => useOs.getState().minimize(x.id));
  },
  showAll: () => useOs.getState().windows.filter((x) => x.min).forEach((x) => useOs.getState().focus(x.id)),
  bringAllToFront: () => {
    const w = top();
    if (!w) return;
    const os = useOs.getState();
    os.windows.filter((x) => x.app === w.app && x.id !== w.id).forEach((x) => os.focus(x.id));
    os.focus(w.id);
  },
  /** Новое окно активного приложения; без окон — новое окно Finder. */
  newWindow: () => {
    const w = top();
    if (w && !APP_META[w.app].single && w.app !== "textedit") useOs.getState().open(w.app, w.app === "finder" ? HOME : undefined);
    else useOs.getState().open("finder", HOME);
  },
  /** Новая папка: в открытой папке Finder или на рабочем столе. */
  newFolder: () => {
    const w = top();
    const fs = useFs.getState();
    const dir = w?.app === "finder" && w.arg && fs.isDir(w.arg) ? w.arg : `${HOME}/Desktop`;
    fs.mkdir(join(dir, fs.freeName(dir, ru() ? "новая папка" : "untitled folder")));
  },
  newTextFile: (dir = `${HOME}/Documents`) => {
    const fs = useFs.getState();
    const path = join(dir, fs.freeName(dir, ru() ? "без названия" : "untitled", ".txt"));
    fs.write(path, "");
    useOs.getState().open("textedit", path);
  },
  settings: () => useOs.getState().open("settings"),
  about: (app: string) => useOs.setState({ panel: "about", aboutApp: app, menu: null, ctx: null }),

  // правка: действует на текстовое поле с курсором
  undo: () => document.execCommand("undo"),
  redo: () => document.execCommand("redo"),
  cut: () => document.execCommand("cut"),
  copy: () => document.execCommand("copy"),
  paste: async () => {
    const el = editable();
    if (!el) return;
    try {
      const text = await navigator.clipboard.readText();
      el.focus();
      document.execCommand("insertText", false, text);
    } catch { /* браузер не дал доступ к буферу обмена */ }
  },
  selectAll: () => editable()?.select(),
};

/** Горячие клавиши в стиле macOS. Возвращает true, если клавиша обработана. */
export function handleShortcut(e: KeyboardEvent): boolean {
  if (e.ctrlKey && e.code === "Space") { useOs.getState().setPanel("spotlight"); return true; }
  if (!e.altKey || e.ctrlKey || e.metaKey) return false;
  const map: Record<string, () => void> = {
    KeyW: cmd.closeWindow, KeyQ: cmd.quitApp, KeyM: cmd.minimize, KeyH: e.shiftKey ? cmd.hideOthers : cmd.hideApp,
    KeyN: e.shiftKey ? cmd.newFolder : cmd.newWindow, Comma: cmd.settings, KeyL: () => useOs.getState().setPanel("launchpad"),
  };
  const fn = map[e.code];
  if (!fn) return false;
  fn();
  return true;
}
