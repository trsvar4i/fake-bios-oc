import type { ComponentType } from "react";
import { ThisPc } from "./ThisPc";
import { Terminal } from "./Terminal";
import { Notes } from "./Notes";
import { TaskManager } from "./TaskManager";
import { VmApp } from "./VmApp";
import { Settings } from "./Settings";
import { Finder } from "./Finder";
import { TextEdit } from "./TextEdit";
import { Calculator } from "./Calculator";
import { Calendar } from "./Calendar";
import { Reminders } from "./Reminders";
import { Clock } from "./Clock";
import { AppStore } from "./AppStore";
import { Care } from "./Care";
import { Paint } from "./Paint";
import { Preview } from "./Preview";
import { Music } from "./Music";
import { Browser } from "./Browser";
import { Quests } from "./Quests";

export const APP_COMPONENTS: Record<string, ComponentType<{ winId: number }>> = {
  thispc: ThisPc,
  terminal: Terminal,
  notes: Notes,
  taskmgr: TaskManager,
  vm: VmApp,
  settings: Settings,
  finder: Finder,
  textedit: TextEdit,
  calculator: Calculator,
  calendar: Calendar,
  reminders: Reminders,
  clock: Clock,
  appstore: AppStore,
  care: Care,
  paint: Paint,
  preview: Preview,
  music: Music,
  browser: Browser,
  quests: Quests,
};
