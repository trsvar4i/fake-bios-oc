import { useEffect, useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { readings, tempClass } from "../../machine/sensors";
import { useOs } from "../osStore";
import { APP_META } from "./meta";

interface Proc { key: string; name: string; cpu: number; mem: number; winId?: number }

/** Процессы и производительность. Частота, температура и вентилятор — живые данные модели. */
export function TaskManager() {
  const s = useStore();
  const os = useOs();
  const { t, lang } = useLang();
  const r = readings(s.saved, s.thermal);
  const [tab, setTab] = useState<"proc" | "perf">("proc");
  const [hist, setHist] = useState<number[]>(() => Array(60).fill(6));
  const [jit, setJit] = useState(0);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHist((h) => [...h.slice(1), Math.max(2, Math.min(70, h[h.length - 1] + (Math.random() - 0.5) * 14))]);
      setJit(Math.random());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cpuNow = hist[hist.length - 1];
  const sys: Proc[] = [
    { key: "kernel", name: "kernel_task", cpu: 0.4, mem: 12 },
    { key: "ws", name: "WindowServer", cpu: 1.2, mem: 88 },
    { key: "dock", name: "Dock", cpu: 0.6, mem: 142 },
    { key: "spot", name: t("Spotlight", "Spotlight"), cpu: 0.9, mem: 196 },
    ...(s.saved.hdAudio ? [{ key: "aud", name: "coreaudiod", cpu: 0.1, mem: 18 }] : []),
    ...(s.saved.lanController ? [{ key: "net", name: "networkd", cpu: 0.2, mem: 24 }] : []),
  ];
  const apps: Proc[] = os.windows.map((w, i) => ({
    key: "w" + w.id, name: APP_META[w.app].title[lang], cpu: 0.5 + ((jit * 7 + i * 3) % 5), mem: 60 + i * 37, winId: w.id,
  }));
  const procs = [...apps, ...sys];
  const selected = procs.find((p) => p.key === sel);

  const W = 520, H = 180;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * W},${H - (v / 100) * H}`).join(" ");

  return (
    <div className="taskmgr">
      <div className="tm-tabs">
        <button className={tab === "proc" ? "on" : ""} onClick={() => setTab("proc")}>{t("Processes", "Процессы")}</button>
        <button className={tab === "perf" ? "on" : ""} onClick={() => setTab("perf")}>{t("Performance", "Производительность")}</button>
      </div>
      {tab === "proc" ? (
        <div className="tm-proc">
          <table>
            <thead><tr><th>{t("Name", "Имя")}</th><th>CPU</th><th>{t("Memory", "Память")}</th></tr></thead>
            <tbody>
              {procs.map((p) => (
                <tr key={p.key} className={sel === p.key ? "sel" : ""} onClick={() => setSel(p.key)}>
                  <td>{p.name}</td><td>{p.cpu.toFixed(1)}%</td><td>{p.mem} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tm-foot">
            <button disabled={!selected?.winId} onClick={() => { if (selected?.winId) { os.close(selected.winId); setSel(null); } }}>
              {t("Quit Process", "Завершить процесс")}
            </button>
          </div>
        </div>
      ) : (
        <div className="tm-perf">
          <div className="tm-graph">
            <div className="tm-graph-title">CPU — {cpuNow.toFixed(0)}%</div>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
              <polyline points={`0,${H} ${pts} ${W},${H}`} className="tm-area" />
              <polyline points={pts} className="tm-line" />
            </svg>
            <div className="tm-cpu-name">{HW.cpu}</div>
          </div>
          <table className="kv-table">
            <tbody>
              <tr><td>{t("Speed", "Частота")}</td><td>{r.freq} GHz</td></tr>
              <tr><td>{t("Temperature", "Температура")}</td><td className={tempClass(r.temp)}>{r.temp.toFixed(1)} °C</td></tr>
              <tr><td>{t("CPU fan", "Вентилятор CPU")}</td><td>{r.rpm} RPM</td></tr>
              <tr><td>{t("Cores / logical processors", "Ядра / логические процессоры")}</td><td>{HW.cores} / {s.saved.smt ? HW.threads : HW.cores}</td></tr>
              <tr><td>{t("Virtualization", "Виртуализация")}</td><td>{s.saved.virtualization ? t("Enabled", "Включено") : t("Disabled", "Выключено")}</td></tr>
              <tr><td>{t("Memory in use", "Используется памяти")}</td><td>{(5.8 + os.windows.length * 0.3).toFixed(1)} / 32,0 GB</td></tr>
              <tr><td>{t("Memory speed", "Скорость памяти")}</td><td>{r.dramFreq} MT/s</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
