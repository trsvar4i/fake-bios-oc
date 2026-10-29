import { l, type L } from "../../machine/i18n";

export interface AppMeta {
  id: string;
  title: L;
  icon: string;
  w: number;
  h: number;
  /** одно окно на приложение */
  single?: boolean;
  /** не показывать в Launchpad (системные окна) */
  hidden?: boolean;
  /** постоянный размер: без растягивания, развёртывания и прилипания */
  fixed?: boolean;
}

export const APP_META: Record<string, AppMeta> = {
  finder: { id: "finder", title: l("Finder", "Finder"), icon: "finder", w: 980, h: 600 },
  notes: { id: "notes", title: l("Notes", "Заметки"), icon: "notes", w: 760, h: 540, single: true },
  reminders: { id: "reminders", title: l("Reminders", "Напоминания"), icon: "reminders", w: 560, h: 600, single: true },
  calendar: { id: "calendar", title: l("Calendar", "Календарь"), icon: "calendar", w: 940, h: 680, single: true },
  calculator: { id: "calculator", title: l("Calculator", "Калькулятор"), icon: "calculator", w: 340, h: 540, single: true, fixed: true },
  clock: { id: "clock", title: l("Clock", "Часы"), icon: "clock", w: 720, h: 520, single: true },
  textedit: { id: "textedit", title: l("TextEdit", "TextEdit"), icon: "textedit", w: 760, h: 560 },
  terminal: { id: "terminal", title: l("Terminal", "Терминал"), icon: "term", w: 880, h: 540 },
  taskmgr: { id: "taskmgr", title: l("Activity Monitor", "Мониторинг системы"), icon: "taskmgr", w: 860, h: 620, single: true },
  vm: { id: "vm", title: l("Kestrel VM", "Kestrel VM"), icon: "vm", w: 900, h: 600, single: true },
  settings: { id: "settings", title: l("System Settings", "Системные настройки"), icon: "settings", w: 980, h: 660, single: true },
  thispc: { id: "thispc", title: l("About This PC", "Об этом компьютере"), icon: "pc", w: 620, h: 720, single: true, hidden: true, fixed: true },
};
