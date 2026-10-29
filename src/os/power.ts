// Выключение, перезагрузка и системные звуки ОС.
import { useStore } from "../machine/store";
import { sound } from "../machine/audio";
import { useOs } from "./osStore";

/** Звук ОС слышен только при включённом HD Audio. */
export function playOs(kind: "startup" | "shutdown" | "notify" | "error") {
  if (useStore.getState().saved.hdAudio) sound.chime(kind);
}

function leave(kind: "shutdown" | "restart" | "firmware", then: () => void) {
  useOs.setState({ leaving: kind });
  useOs.getState().setStage("leaving");
  playOs("shutdown");
  window.setTimeout(then, 2400);
}

export const osPower = {
  shutdown: () => leave("shutdown", () => { sound.powerOff(); useStore.getState().shutdown(); }),
  restart: () => leave("restart", () => useStore.getState().restart()),
  restartToFirmware: () => leave("firmware", () => useStore.getState().restartToSetup()),
  lock: () => useOs.getState().setStage("lock"),
};
