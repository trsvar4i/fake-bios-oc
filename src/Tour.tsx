// Первый запуск: короткое знакомство на экране питания — что здесь можно делать и как «сломать» компьютер.
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
      text: t("Press the power button: the PC runs POST, starts the firmware and boots Kestrel OS.", "Нажмите кнопку питания: компьютер пройдёт POST, запустит прошивку и загрузит Kestrel OS.") },
    { icon: "⚙", title: t("BIOS is real here", "Здесь настоящий BIOS"),
      text: t("Press DEL while the logo is shown to open Setup, F11 for the Boot Menu. Settings are saved and change how the PC behaves.", "Пока виден логотип, нажмите DEL — откроется Setup, F11 — меню загрузки. Настройки сохраняются и меняют поведение компьютера.") },
    { icon: "°C", title: t("Overclock — and break it", "Разгоните — и сломайте"),
      text: t("Raise the CPU ratio without voltage and the OS will crash. Turn off the fans and it will overheat. Turn off the network card and the App Store goes offline.", "Поднимите множитель без напряжения — система упадёт. Выключите вентиляторы — перегреется. Отключите сетевую карту — Магазин останется без сети.") },
    { icon: "✦", title: t("Then explore the OS", "А потом — система"),
      text: t("Islands at the top, Dock with apps, widgets, desktops. Alt works as ⌘: Alt+` switches apps, Alt+↑ shows all windows.", "Островки сверху, Dock с программами, виджеты, рабочие столы. Alt работает как ⌘: Alt+` — переключение программ, Alt+↑ — все окна.") },
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
