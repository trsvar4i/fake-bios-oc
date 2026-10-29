import { useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { readings } from "../../machine/sensors";
import { useOs } from "../osStore";
import { isTrashed, useFs } from "../fs";
import "./Care.css";

interface Report { trash: number; cache: number; notices: number }

/** «Обслуживание»: одна кнопка вместо скриптов — очищает Корзину, кэш, уведомления и даёт советы по BIOS. */
export function Care() {
  const { t } = useLang();
  const s = useStore();
  const r = readings(s.saved, s.thermal, s);
  const [step, setStep] = useState<"idle" | "scan" | "done">("idle");
  const [stage, setStage] = useState(0);
  const [report, setReport] = useState<Report | null>(null);

  const stages = [t("Looking for junk…", "Ищем мусор…"), t("Emptying Trash…", "Очищаем Корзину…"), t("Clearing caches…", "Чистим кэш…"), t("Checking cooling…", "Проверяем охлаждение…")];
  const run = () => {
    setStep("scan");
    setStage(0);
    stages.forEach((_, i) => window.setTimeout(() => setStage(i), i * 700));
    window.setTimeout(() => {
      const fs = useFs.getState();
      const trash = Object.keys(fs.nodes).filter(isTrashed).length;
      fs.emptyTrash();
      const notices = useOs.getState().notices.length;
      useOs.setState({ notices: [], stressUntil: 0 });
      setReport({ trash, cache: 120 + Math.round(Math.random() * 380), notices });
      setStep("done");
    }, stages.length * 700 + 300);
  };

  // советы по настройкам BIOS — то, что реально влияет на скорость и шум
  const tips: string[] = [];
  if (r.throttled) tips.push(t("The CPU is throttling from heat. In BIOS pick a stronger fan profile or lower the CPU ratio.", "Процессор перегревается и сбрасывает частоту. В BIOS выберите профиль вентиляторов посильнее или снизьте множитель."));
  if (s.saved.xmp === "Disabled") tips.push(t("Memory runs at base speed. Turn on XMP in BIOS for faster RAM.", "Память работает на базовой частоте. Включите XMP в BIOS — будет быстрее."));
  if (!s.saved.virtualization) tips.push(t("Virtualization is off — Kestrel VM can't start. Enable SVM Mode in BIOS.", "Виртуализация выключена — Kestrel VM не запустится. Включите SVM Mode в BIOS."));
  if (s.power === "quiet") tips.push(t("Quiet power mode lowers the clock. Switch to Balanced in Control Center for full speed.", "Режим «Тихий» снижает частоту. Для полной скорости переключитесь на «Баланс» в пункте управления."));

  return (
    <div className="care">
      <div className={"care-orb " + step}>
        <svg viewBox="0 0 120 120" width="190" height="190">
          <circle cx="60" cy="60" r="52" className="care-track" />
          <circle cx="60" cy="60" r="52" className="care-arc" style={{ strokeDashoffset: step === "scan" ? 326.7 * (1 - (stage + 1) / stages.length) : step === "done" ? 0 : 326.7 }} />
        </svg>
        <div className="care-center">
          {step === "done" ? <span className="care-check">✓</span> : step === "scan" ? <span className="care-pct">{Math.round(((stage + 1) / stages.length) * 100)}%</span> : <span className="care-spark">✦</span>}
        </div>
      </div>
      {step === "idle" && (
        <>
          <h2>{t("Keep your PC fast", "Компьютер — как новый")}</h2>
          <p className="care-sub">{t("One click cleans junk and checks your hardware settings.", "Один щелчок — и мусор убран, а настройки железа проверены.")}</p>
          <button className="set-btn primary care-go" onClick={run}>{t("Clean and Speed Up", "Очистить и ускорить")}</button>
        </>
      )}
      {step === "scan" && <p className="care-sub" key={stage}>{stages[stage]}</p>}
      {step === "done" && report && (
        <div className="care-report">
          <h2>{t("All clean", "Всё чисто")}</h2>
          <div className="care-stats">
            <div><b>{report.cache} {t("MB", "МБ")}</b><span>{t("cache freed", "кэша освобождено")}</span></div>
            <div><b>{report.trash}</b><span>{t("items removed from Trash", "объектов удалено из Корзины")}</span></div>
            <div><b>{report.notices}</b><span>{t("notifications cleared", "уведомлений убрано")}</span></div>
          </div>
          <button className="set-btn" onClick={() => setStep("idle")}>{t("Done", "Готово")}</button>
        </div>
      )}
      <div className="care-tips">
        <div className="care-tips-head">{t("Hardware advice", "Советы по железу")}</div>
        {tips.length ? tips.map((tip) => <div key={tip} className="care-tip">{tip}</div>)
          : <div className="care-tip ok">{t("BIOS settings look good: memory, cooling and virtualization are fine.", "Настройки BIOS в порядке: память, охлаждение и виртуализация.")}</div>}
      </div>
    </div>
  );
}
