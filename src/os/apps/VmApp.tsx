import { useEffect, useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { osPower, playOs } from "../power";
import { unlock } from "../../machine/quests";
import "./VmApp.css";

interface Vm { name: string; os: string; cpus: number; ram: number; state: "off" | "starting" | "running" }

const BOOT_LOG = [
  "[    0.000000] Linux version 6.8.0-kestrel (gcc 13.2.0)",
  "[    0.120411] x86/fpu: Supporting XSAVE feature 0x001",
  "[    0.481023] Hypervisor detected: Kestrel VM",
  "[    1.002310] EXT4-fs (vda1): mounted filesystem",
  "[    1.773019] systemd[1]: Reached target Multi-User System.",
  "",
  "server login: _",
];

/** Виртуальные машины. Без SVM в BIOS не запускаются. */
export function VmApp() {
  const virtualization = useStore((s) => s.saved.virtualization);
  const { t } = useLang();
  const [vms, setVms] = useState<Vm[]>([
    { name: "Linux Server", os: "Linux 6.8", cpus: 2, ram: 4, state: "off" },
    { name: "Test Lab", os: "Kestrel OS 1.0", cpus: 4, ram: 8, state: "off" },
  ]);
  const [sel, setSel] = useState(0);
  const [error, setError] = useState(false);
  const [logLines, setLogLines] = useState(0);
  const vm = vms[sel];

  const setState = (state: Vm["state"]) => setVms((list) => list.map((v, i) => (i === sel ? { ...v, state } : v)));

  const start = () => {
    if (!virtualization) {
      setError(true);
      playOs("error");
      return;
    }
    setState("starting");
    setLogLines(0);
  };

  useEffect(() => {
    if (vm.state !== "starting") return;
    if (logLines >= BOOT_LOG.length) { setState("running"); unlock("vm"); return; }
    const id = window.setTimeout(() => setLogLines((n) => n + 1), 350);
    return () => clearTimeout(id);
  }, [vm.state, logLines]);

  const stateText = { off: t("Off", "Выключена"), starting: t("Starting", "Запуск"), running: t("Running", "Работает") };

  return (
    <div className="vmapp">
      <div className="vm-list">
        <div className="vm-list-title">{t("Virtual machines", "Виртуальные машины")}</div>
        {vms.map((v, i) => (
          <div key={v.name} className={"vm-item" + (i === sel ? " sel" : "")} onClick={() => { setSel(i); setError(false); }}>
            <b>{v.name}</b>
            <span className={"vm-state " + v.state}>{stateText[v.state]}</span>
          </div>
        ))}
      </div>
      <div className="vm-main">
        <h2>{vm.name}</h2>
        <div className="vm-specs">{vm.os} · {vm.cpus} vCPU · {vm.ram} GB RAM</div>
        <div className="vm-actions">
          <button className="primary" disabled={vm.state !== "off"} onClick={start}>{t("Start", "Запустить")}</button>
          <button disabled={vm.state === "off"} onClick={() => setState("off")}>{t("Turn off", "Выключить")}</button>
        </div>
        {error && (
          <div className="vm-error">
            <b>{t("The virtual machine could not be started.", "Не удалось запустить виртуальную машину.")}</b>
            <p>{t("Hardware virtualization (AMD-V / SVM) is disabled in the firmware. Enable SVM Mode in BIOS: Advanced → CPU Configuration.",
              "Аппаратная виртуализация (AMD-V / SVM) выключена в прошивке. Включите SVM Mode в BIOS: Advanced → CPU Configuration.")}</p>
            <button onClick={osPower.restartToFirmware}>{t("Restart to BIOS", "Перезагрузить в BIOS")}</button>
          </div>
        )}
        {vm.state !== "off" && (
          <pre className="vm-console">{(vm.state === "running" ? BOOT_LOG : BOOT_LOG.slice(0, logLines)).join("\n")}</pre>
        )}
      </div>
    </div>
  );
}
