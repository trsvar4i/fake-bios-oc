import { useEffect } from "react";
import { useStore, useLang } from "../../machine/store";
import { sound } from "../../machine/audio";
import { SoundToggle } from "../ui/SoundToggle";

/** ПК выключен. Кнопка питания заодно разблокирует звук в браузере. */
export function PowerScreen() {
  const { t } = useLang();
  const press = () => {
    sound.powerOn();
    useStore.getState().powerOn();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="power">
      <button className="power-btn" onClick={press} aria-label="Power">
        <svg viewBox="0 0 32 32"><path d="M16 4v11M9.5 8.5a10 10 0 1 0 13 0" /></svg>
      </button>
      <div className="power-label">{t("Press the power button", "Нажмите кнопку питания")}</div>
      <div className="power-note">Enter / Space</div>
      <div className="power-sound"><SoundToggle /></div>
    </div>
  );
}
