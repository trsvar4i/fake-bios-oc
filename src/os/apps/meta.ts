import { l, type L } from "../../machine/i18n";

export interface AppMeta {
  id: string;
  title: L;
  icon: string;
  w: number;
  h: number;
  /** одно окно на приложение */
  single?: boolean;
}

export const APP_META: Record<string, AppMeta> = {
  thispc: { id: "thispc", title: l("This PC", "Этот компьютер"), icon: "pc", w: 820, h: 640, single: true },
  terminal: { id: "terminal", title: l("Terminal", "Терминал"), icon: "term", w: 880, h: 540 },
  notes: { id: "notes", title: l("Notes", "Заметки"), icon: "notes", w: 760, h: 540, single: true },
  taskmgr: { id: "taskmgr", title: l("Task Manager", "Диспетчер задач"), icon: "taskmgr", w: 860, h: 620, single: true },
  vm: { id: "vm", title: l("Kestrel VM", "Kestrel VM"), icon: "vm", w: 900, h: 600, single: true },
  settings: { id: "settings", title: l("Settings", "Параметры"), icon: "settings", w: 940, h: 640, single: true },
};
