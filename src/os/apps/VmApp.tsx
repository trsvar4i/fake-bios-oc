import { useEffect, useRef, useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { osPower, playOs } from "../power";
import { unlock } from "../../machine/quests";
import { WallpaperArt } from "../Wallpaper";
import { AppIcon, OsLogo } from "../AppIcon";
import { useNow } from "../util";
import "./VmApp.css";

type VmState = "off" | "post" | "booting" | "running";
interface Vm { name: string; os: string; kind: "linux" | "kestrel"; cpus: number; ram: number; state: VmState }

const POST_MS = 1600;

const BOOT_LOG: Record<Vm["kind"], string[]> = {
  linux: [
    "[    0.000000] Linux version 6.8.0-kestrel (gcc 13.2.0)",
    "[    0.120411] x86/fpu: Supporting XSAVE feature 0x001",
    "[    0.481023] Hypervisor detected: Kestrel VM (AMD-V)",
    "[    0.702115] virtio_blk virtio1: [vda] 41943040 512-byte logical blocks",
    "[    1.002310] EXT4-fs (vda1): mounted filesystem",
    "[    1.773019] systemd[1]: Reached target Multi-User System.",
  ],
  kestrel: [
    "Kestrel OS 1.0 (guest)",
    "Loading kernel…",
    "Starting display server…",
    "Preparing your workspace…",
  ],
};

/** Виртуальные машины: внутри окна загружается гостевая система. Без SVM в BIOS не запускаются. */
export function VmApp() {
  const virtualization = useStore((s) => s.saved.virtualization);
  const { t } = useLang();
  const [vms, setVms] = useState<Vm[]>([
    { name: "Linux Server", os: "Linux 6.8", kind: "linux", cpus: 2, ram: 4, state: "off" },
    { name: "Test Lab", os: "Kestrel OS 1.0", kind: "kestrel", cpus: 4, ram: 8, state: "off" },
  ]);
  const [sel, setSel] = useState(0);
  const [error, setError] = useState(false);
  const [logLines, setLogLines] = useState(0);
  const vm = vms[sel];

  const setState = (i: number, state: VmState) => setVms((list) => list.map((v, j) => (j === i ? { ...v, state } : v)));

  const start = () => {
    if (!virtualization) {
      setError(true);
      playOs("error");
      return;
    }
    setError(false);
    setState(sel, "post");
    setLogLines(0);
  };

  // мини-POST гостя, затем журнал загрузки построчно, затем система
  useEffect(() => {
    if (vm.state === "post") {
      const id = window.setTimeout(() => setState(sel, "booting"), POST_MS);
      return () => clearTimeout(id);
    }
    if (vm.state !== "booting") return;
    if (logLines >= BOOT_LOG[vm.kind].length) {
      const id = window.setTimeout(() => { setState(sel, "running"); unlock("vm"); }, 500);
      return () => clearTimeout(id);
    }
    const id = window.setTimeout(() => setLogLines((n) => n + 1), 280);
    return () => clearTimeout(id);
  }, [vm.state, logLines, sel]);

  const stateText: Record<VmState, string> = { off: t("Off", "Выключена"), post: t("Starting", "Запуск"), booting: t("Booting", "Загрузка"), running: t("Running", "Работает") };

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
        <div className={"vm-hw" + (virtualization ? " ok" : "")}>
          AMD-V (SVM): <b>{virtualization ? t("enabled", "включено") : t("disabled in BIOS", "выключено в BIOS")}</b>
        </div>
      </div>
      <div className="vm-main">
        <div className="vm-top">
          <div>
            <h2>{vm.name}</h2>
            <div className="vm-specs">{vm.os} · {vm.cpus} vCPU · {vm.ram} GB RAM · virtio-blk 20 GB</div>
          </div>
          <div className="vm-actions">
            <button className="primary" disabled={vm.state !== "off"} onClick={start}>{t("Start", "Запустить")}</button>
            <button disabled={vm.state === "off"} onClick={() => setState(sel, "off")}>{t("Turn off", "Выключить")}</button>
          </div>
        </div>
        {error && (
          <div className="vm-error">
            <b>{t("The virtual machine could not be started.", "Не удалось запустить виртуальную машину.")}</b>
            <p>{t("Hardware virtualization (AMD-V / SVM) is disabled in the firmware. Enable SVM Mode in BIOS: Advanced → CPU Configuration.",
              "Аппаратная виртуализация (AMD-V / SVM) выключена в прошивке. Включите SVM Mode в BIOS: Advanced → CPU Configuration.")}</p>
            <button onClick={osPower.restartToFirmware}>{t("Restart to BIOS", "Перезагрузить в BIOS")}</button>
          </div>
        )}
        <div className={"vm-screen " + vm.state}>
          {vm.state === "off" && <div className="vm-off">{t("Powered off", "Выключена")}</div>}
          {vm.state === "post" && (
            <div className="vm-post">
              <div className="vm-post-logo">KESTREL<span>VM</span></div>
              <pre>{`Kestrel Virtual BIOS 2.0  (host: ${HW.product})
vCPU: ${vm.cpus} x ${HW.cpu.split(" ").slice(0, 4).join(" ")}
Memory: ${vm.ram * 1024} MB OK
Booting from virtio disk...`}</pre>
            </div>
          )}
          {vm.state === "booting" && (
            vm.kind === "linux"
              ? <pre className="vm-console">{BOOT_LOG.linux.slice(0, logLines).join("\n")}</pre>
              : <div className="vm-kboot"><OsLogo size={70} /><span key={logLines}>{BOOT_LOG.kestrel[Math.max(0, logLines - 1)]}</span></div>
          )}
          {vm.state === "running" && (vm.kind === "linux"
            ? <GuestShell cpus={vm.cpus} ram={vm.ram} onPowerOff={() => setState(sel, "off")} />
            : <GuestDesktop />)}
        </div>
      </div>
    </div>
  );
}

/** Консоль гостевого Linux: несколько настоящих команд. */
function GuestShell({ cpus, ram, onPowerOff }: { cpus: number; ram: number; onPowerOff: () => void }) {
  const [lines, setLines] = useState<string[]>(() => [...BOOT_LOG.linux, "", "Ubuntu-like 24.04 LTS server tty1", "", "server login: guest (automatic login)", "Type `help` for commands.", ""]);
  const [input, setInput] = useState("");
  const started = useRef(Date.now());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [lines]);

  const run = (cmd: string) => {
    const [name, ...args] = cmd.trim().split(/\s+/);
    const up = Math.floor((Date.now() - started.current) / 1000);
    const out: Record<string, () => string[]> = {
      help: () => ["help  uname -a  uptime  free -h  nproc  lscpu  whoami  ls  echo  clear  poweroff"],
      uname: () => [args[0] === "-a" ? "Linux server 6.8.0-kestrel #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" : "Linux"],
      uptime: () => [` ${new Date().toLocaleTimeString("en-GB")} up ${Math.floor(up / 60)} min, ${up % 60} s,  1 user,  load average: 0.08, 0.03, 0.01`],
      free: () => ["               total        used        free", `Mem:          ${ram}.0Gi       312Mi       ${(ram - 0.4).toFixed(1)}Gi`, "Swap:         1.0Gi          0B       1.0Gi"],
      nproc: () => [String(cpus)],
      lscpu: () => ["Architecture:        x86_64", `CPU(s):              ${cpus}`, `Model name:          ${HW.cpu}`, "Hypervisor vendor:   Kestrel", "Virtualization type: full"],
      whoami: () => ["guest"],
      ls: () => ["notes.txt  projects  server.log"],
      echo: () => [args.join(" ")],
    };
    if (name === "clear") return setLines([]);
    if (name === "poweroff" || name === "shutdown") { setLines((l) => [...l, `guest@server:~$ ${cmd}`, "Powering off..."]); window.setTimeout(onPowerOff, 700); return; }
    const res = !name ? [] : out[name] ? out[name]() : [`${name}: command not found`];
    setLines((l) => [...l, `guest@server:~$ ${cmd}`, ...res]);
  };

  return (
    <div className="vm-console live" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
      {lines.map((l, i) => <div key={i}>{l || " "}</div>)}
      <form className="vm-prompt" onSubmit={(e) => { e.preventDefault(); run(input); setInput(""); }}>
        <span>guest@server:~$</span>
        <input value={input} onChange={(e) => setInput(e.target.value)} autoFocus spellCheck={false} />
      </form>
      <div ref={end} />
    </div>
  );
}

/** Гостевой рабочий стол Kestrel OS 1.0 — маленькая система внутри системы. */
function GuestDesktop() {
  const now = useNow();
  const { t } = useLang();
  const [open, setOpen] = useState(true);
  return (
    <div className="vm-desk">
      <WallpaperArt id="forest" />
      {open && (
        <div className="vm-win">
          <div className="vm-win-title"><span>{t("Welcome", "Привет")}</span><button onClick={() => setOpen(false)}>×</button></div>
          <p>{t("This is Kestrel OS running inside Kestrel OS. Hardware virtualization (SVM) makes it possible.", "Это Kestrel OS внутри Kestrel OS. Так можно благодаря аппаратной виртуализации (SVM).")}</p>
        </div>
      )}
      <div className="vm-perch">
        <span className="vm-nest"><OsLogo size={16} mono /></span>
        {["finder", "notes", "term", "settings"].map((i) => <span key={i} onClick={() => setOpen(true)}><AppIcon name={i} size={26} /></span>)}
        <b>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</b>
      </div>
    </div>
  );
}
