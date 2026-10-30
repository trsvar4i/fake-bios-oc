import { useEffect } from "react";
import { useStore, useLang } from "../../machine/store";
import { sound } from "../../machine/audio";
import { SoundToggle } from "../ui/SoundToggle";
import { useLearn } from "../../learn/store";

/** ПК выключен. Кнопка питания заодно разблокирует звук в браузере. */
export function PowerScreen() {
  const { t } = useLang();
  const press = () => {
    sound.powerOn();
    useStore.getState().powerOn();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // не включать компьютер, пока человек печатает (имя в задании) или выбирает урок
      if ((e.target as HTMLElement)?.closest?.("input, textarea, .learn-modal") || useLearn.getState().picker) return;
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
      <button className="power-learn" onClick={() => useLearn.setState({ picker: true })}>
        <svg viewBox="0 0 24 24"><path d="M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5M21 8v6" /></svg>
        {t("Lessons", "Обучение")}
      </button>
    </div>
  );
}
