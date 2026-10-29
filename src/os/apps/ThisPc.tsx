import { useStore, useLang } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { readings } from "../../machine/sensors";

/** Диски и сведения о системе — всё из сохранённой конфигурации BIOS. */
export function ThisPc() {
  const s = useStore();
  const c = s.saved;
  const r = readings(c, s.thermal);
  const { t } = useLang();
  const on = (v: boolean) => (v ? t("Enabled", "Включено") : t("Disabled", "Выключено"));

  const drives = [
    { letter: "C:", name: "Kestrel NV2 1TB (NVMe)", total: 931, used: 412 },
    { letter: "D:", name: "DataVault HDD 2TB", total: 1863, used: 1204 },
    ...(c.usbStorage ? [{ letter: "F:", name: "USB Flash Drive", total: 29, used: 4 }] : []),
  ];

  const rows: [string, string][] = [
    [t("Device name", "Имя устройства"), "KESTREL-PC"],
    [t("Processor", "Процессор"), `${HW.cpu} @ ${r.freq} GHz`],
    [t("Installed RAM", "Оперативная память"), `32,0 GB DDR5 @ ${r.dramFreq} MT/s`],
    [t("System type", "Тип системы"), t("64-bit operating system", "64-разрядная операционная система")],
    [t("Motherboard", "Материнская плата"), HW.product],
    ["BIOS", `${HW.bios} (${HW.buildDate}), UEFI`],
    ["Secure Boot", on(c.secureBoot)],
    ["TPM", c.ftpm === "Disabled" ? t("Not available", "Недоступен") : `${c.ftpm} 2.0`],
    [t("Virtualization", "Виртуализация"), c.virtualization ? t("Enabled in firmware", "Включена в прошивке") : t("Disabled in firmware", "Выключена в прошивке")],
    [t("Network adapter", "Сетевой адаптер"), c.lanController ? "Kestrel 2.5G Ethernet" : t("Not found", "Не найден")],
    [t("Audio device", "Звуковое устройство"), c.hdAudio ? "Kestrel HD Audio" : t("Not found", "Не найдено")],
  ];

  return (
    <div className="app-pad thispc">
      <h2>{t("Devices and drives", "Устройства и диски")}</h2>
      <div className="drives">
        {drives.map((d) => (
          <div className="drive" key={d.letter}>
            <div className="drive-name"><b>{d.letter}</b> {d.name}</div>
            <div className="bar"><i style={{ width: `${(d.used / d.total) * 100}%` }} /></div>
            <div className="drive-free">{d.total - d.used} GB {t("free of", "свободно из")} {d.total} GB</div>
          </div>
        ))}
        <div className="drive">
          <div className="drive-name"><b>E:</b> DVD-RW</div>
          <div className="drive-free">{t("No disc", "Нет диска")}</div>
        </div>
      </div>
      <h2>{t("Device specifications", "Характеристики устройства")}</h2>
      <table className="kv-table">
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
