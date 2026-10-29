import { sound, useMuted } from "../../machine/audio";
import { useLang } from "../../machine/store";

export function SoundToggle({ className = "tb-btn" }: { className?: string }) {
  const muted = useMuted();
  const { t } = useLang();
  return (
    <button className={className + " sound-btn"} onClick={() => sound.setMuted(!muted)}>
      <svg className="icon" viewBox="0 0 32 32">
        <path d="M5 12h5l7-6v20l-7-6H5z" />
        {muted ? <path d="M21 12l7 8M28 12l-7 8" /> : <path d="M21 11a6 6 0 0 1 0 10M24 7a11 11 0 0 1 0 18" />}
      </svg>
      {muted ? t("Sound off", "Звук выкл") : t("Sound on", "Звук вкл")}
    </button>
  );
}
