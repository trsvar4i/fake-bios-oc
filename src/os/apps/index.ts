import type { ComponentType } from "react";
import { ThisPc } from "./ThisPc";
import { Terminal } from "./Terminal";
import { Notes } from "./Notes";
import { TaskManager } from "./TaskManager";
import { VmApp } from "./VmApp";
import { Settings } from "./Settings";

export const APP_COMPONENTS: Record<string, ComponentType<{ winId: number }>> = {
  thispc: ThisPc,
  terminal: Terminal,
  notes: Notes,
  taskmgr: TaskManager,
  vm: VmApp,
  settings: Settings,
};
