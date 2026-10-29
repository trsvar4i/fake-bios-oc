import { useStore, useLang } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { readings } from "../../machine/sensors";
import { useOs } from "../osStore";
import { OsLogo } from "../AppIcon";
import "./ThisPc.css";

/** «Об этом компьютере»: всё из сохранённой конфигурации BIOS. */
export function ThisPc() {
  const s = useStore();
  const c = s.saved;
  const r = readings(c, s.thermal, s);
  const { t } = useLang();

  const rows: [string, string][] = [
    [t("Name", "Имя"), useOs.getState().prefs.hostName],
    [t("Processor", "Процессор"), `${HW.cpu.replace(" Processor", "")} @ ${r.freq} GHz`],
    [t("Memory", "Память"), `32 GB DDR5 ${r.dramFreq} MT/s`],
    [t("Board", "Плата"), HW.product],
    [t("Startup disk", "Загрузочный диск"), "Kestrel HD"],
    [t("Firmware", "Прошивка"), `UEFI ${HW.bios} (${HW.buildDate})`],
    ["Secure Boot", c.secureBoot ? t("On", "Вкл.") : t("Off", "Выкл.")],
    [t("Virtualization", "Виртуализация"), c.virtualization ? t("Enabled", "Включена") : t("Disabled in firmware", "Выключена в прошивке")],
    [t("Network", "Сеть"), c.lanController ? "Kestrel 2.5G Ethernet" : t("Not found", "Не найдена")],
    [t("Sound", "Звук"), c.hdAudio ? "Kestrel HD Audio" : t("Not found", "Не найдено")],
    [t("Serial number", "Серийный номер"), "KS7E26-0X41F9"],
  ];

  return (
    <div className="about">
      <div className="about-logo"><OsLogo size={128} /></div>
      <h1>Kestrel OS</h1>
      <div className="about-ver">{t("Version", "Версия")} 1.0 (2611)</div>
      <table className="about-table">
        <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
      </table>
      <div className="about-actions">
        <button className="set-btn" onClick={() => useOs.getState().open("settings")}>{t("More Info…", "Подробнее…")}</button>
        <button className="set-btn" onClick={() => useOs.getState().open("finder", "disk")}>{t("Storage…", "Хранилище…")}</button>
      </div>
      <div className="about-foot">™ {t("and", "и")} © 2026 Kestrel Systems</div>
    </div>
  );
}
