import { l, type L } from "../../machine/i18n";

export interface AppMeta {
  id: string;
  title: L;
  icon: string;
  w: number;
  h: number;
  /** одно окно на приложение */
  single?: boolean;
  /** не показывать в «Гнезде» (системные окна) */
  hidden?: boolean;
  /** постоянный размер: без растягивания, развёртывания и прилипания */
  fixed?: boolean;
  /** сколько окно добавляет к загрузке процессора (0…1), по умолчанию 0.03 */
  load?: number;
  /** ставится из Магазина: до установки его нет в «Гнезде», «Броске» и Терминале */
  store?: { desc: L; size: string };
  /** раздел в «Гнезде» */
  group?: "work" | "create" | "system";
}

export const APP_META: Record<string, AppMeta> = {
  finder: { id: "finder", title: l("Files", "Файлы"), icon: "finder", w: 980, h: 600, group: "work" },
  notes: { id: "notes", title: l("Notes", "Заметки"), icon: "notes", w: 760, h: 540, single: true, group: "work" },
  reminders: { id: "reminders", title: l("Reminders", "Напоминания"), icon: "reminders", w: 560, h: 600, single: true, group: "work" },
  calendar: { id: "calendar", title: l("Calendar", "Календарь"), icon: "calendar", w: 940, h: 680, single: true, group: "work" },
  calculator: { id: "calculator", title: l("Calculator", "Калькулятор"), icon: "calculator", w: 340, h: 540, single: true, fixed: true, group: "work" },
  clock: { id: "clock", title: l("Clock", "Часы"), icon: "clock", w: 720, h: 520, single: true, group: "work" },
  textedit: { id: "textedit", title: l("Text Editor", "Редактор"), icon: "textedit", w: 760, h: 560, group: "work" },
  terminal: { id: "terminal", title: l("Terminal", "Терминал"), icon: "term", w: 880, h: 540, group: "system" },
  taskmgr: { id: "taskmgr", title: l("System Monitor", "Мониторинг"), icon: "taskmgr", w: 860, h: 620, single: true, load: 0.05, group: "system" },
  vm: { id: "vm", title: l("Kestrel VM", "Kestrel VM"), icon: "vm", w: 900, h: 600, single: true, load: 0.22, group: "system" },
  settings: { id: "settings", title: l("Settings", "Настройки"), icon: "settings", w: 980, h: 660, single: true, group: "system" },
  appstore: { id: "appstore", title: l("Store", "Магазин"), icon: "appstore", w: 960, h: 640, single: true, group: "system" },
  care: { id: "care", title: l("System Care", "Обслуживание"), icon: "care", w: 640, h: 560, single: true, group: "system" },
  paint: { id: "paint", title: l("Paint", "Рисовалка"), icon: "paint", w: 980, h: 680, single: true, load: 0.06, group: "create",
    store: { desc: l("Draw with brushes and save pictures to your files.", "Рисуйте кистями и сохраняйте картинки в файлы."), size: "4,2 MB" } },
  preview: { id: "preview", title: l("Preview", "Просмотр"), icon: "preview", w: 900, h: 640, group: "create",
    store: { desc: l("Open pictures from Files and flip through a folder.", "Открывает картинки из «Файлов» и листает папку."), size: "2,8 MB" } },
  music: { id: "music", title: l("Music", "Музыка"), icon: "music", w: 820, h: 560, single: true, load: 0.04, group: "create",
    store: { desc: l("A built-in synthesizer plays original tracks. Now Playing shows on the Perch.", "Встроенный синтезатор играет свои треки. Что играет — видно на «Насесте»."), size: "6,1 MB" } },
  browser: { id: "browser", title: l("Browser", "Браузер"), icon: "browser", w: 1080, h: 700, load: 0.05, group: "work" },
  learn: { id: "learn", title: l("Lessons", "Обучение"), icon: "learn", w: 980, h: 700, single: true, group: "work" },
  quests: { id: "quests", title: l("Challenges", "Испытания"), icon: "quests", w: 820, h: 640, single: true, group: "system" },
  thispc: { id: "thispc", title: l("About This PC", "Об этом компьютере"), icon: "pc", w: 620, h: 720, single: true, hidden: true, fixed: true },
};
