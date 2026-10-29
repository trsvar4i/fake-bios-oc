// Выключение, перезагрузка и системные звуки ОС.
import { useStore } from "../machine/store";
import { sound } from "../machine/audio";
import { useOs } from "./osStore";
import { music } from "./music";

/** Звук ОС слышен только при включённом HD Audio. */
export function playOs(kind: "startup" | "shutdown" | "notify" | "error") {
  if (kind === "notify" && useOs.getState().dnd) return;
  if (useStore.getState().saved.hdAudio) sound.chime(kind);
}

function leave(kind: "shutdown" | "restart" | "firmware", then: () => void) {
  music.pause();
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
  /** перезагрузка с установкой новой прошивки: экран прошивки ведёт сам Leaving */
  updateFirmware: () => { useOs.setState({ leaving: "update" }); useOs.getState().setStage("leaving"); },
  /** сон: экран гаснет, пробуждение — на экран блокировки */
  sleep: () => { useOs.getState().dismiss(); useOs.setState({ sleeping: true }); },
  /** завершить сеанс: все программы закрываются, остаётся экран входа */
  logout: () => {
    music.pause();
    const os = useOs.getState();
    os.windows.forEach((w) => os.close(w.id));
    window.setTimeout(() => useOs.getState().setStage("lock"), 260);
  },
};
