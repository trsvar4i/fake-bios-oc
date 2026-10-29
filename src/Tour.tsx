// Первый запуск: знакомство на экране питания в две карточки — что здесь можно делать и как «сломать» компьютер.
import { useState } from "react";
import { useLang } from "./machine/store";

const TOUR_KEY = "kestrel.tour";
const seen = () => { try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return true; } };

export function Tour() {
  const { t } = useLang();
  const [step, setStep] = useState(seen() ? -1 : 0);
  if (step < 0) return null;
  const done = () => { try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* хранилище недоступно */ } setStep(-1); };

  const steps = [
    { icon: "⏻", title: t("A whole PC in your browser", "Целый компьютер в браузере"),
      text: t("Press the power button: POST, a real-feeling UEFI BIOS and Kestrel OS. Press DEL on the logo to enter Setup, F11 for the Boot Menu.",
        "Нажмите кнопку питания: POST, настоящий UEFI BIOS и Kestrel OS. DEL на логотипе — вход в Setup, F11 — меню загрузки.") },
    { icon: "°C", title: t("Settings really matter", "Настройки имеют значение"),
      text: t("Overclock without voltage — the OS crashes. Silent fans — it overheats. No LAN — no internet. Collect all the Challenges.",
        "Разгон без напряжения — система падает. Тихие вентиляторы — перегрев. Нет LAN — нет интернета. Соберите все испытания.") },
  ];
  const s = steps[step];
  return (
    <div className="tour" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tour-card" key={step}>
        <div className="tour-icon">{s.icon}</div>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="tour-dots">{steps.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}</div>
        <div className="tour-actions">
          <button className="tour-skip" onClick={done}>{t("Skip", "Пропустить")}</button>
          <button className="tour-next" onClick={() => (step === steps.length - 1 ? done() : setStep(step + 1))}>
            {step === steps.length - 1 ? t("Start", "Начать") : t("Next", "Далее")}
          </button>
        </div>
      </div>
    </div>
  );
}
