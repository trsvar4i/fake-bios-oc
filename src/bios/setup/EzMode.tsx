import type { ReactNode } from "react";
import { useStore, useLang, isChanged } from "../../machine/store";
import { FAN_PRESETS, HW, STORAGE, XMP } from "../../machine/hardware";
import { PARAMS, formatValue } from "../../machine/params";
import { readings, tempClass, noiseClass, vcoreClass } from "../../machine/sensors";
import { Icon } from "../ui/Icon";
import { FanCurve } from "./FanCurve";
import { EZ_TABS, TOOLS, kf, toggleTile } from "./ezKeys";

const TABS: { id: string; en: string; ru: string }[] = [
  { id: "cpu", en: "CPU", ru: "Процессор" },
  { id: "memory", en: "Memory", ru: "Память" },
  { id: "storage", en: "Storage", ru: "Накопители" },
  { id: "fan", en: "Fan Info", ru: "Вентиляторы" },
  { id: "help", en: "Help", ru: "Справка" },
];

const TILES: { id: string; ico: string }[] = [
  { id: "lanRom", ico: "LAN" },
  { id: "hdAudio", ico: "HDA" },
  { id: "fanFailWarn", ico: "FAN" },
  { id: "fastBoot", ico: "FAST" },
  { id: "sataMode", ico: "SATA" },
  { id: "biosLog", ico: "LOG" },
  { id: "secureBoot", ico: "SEC" },
  { id: "virtualization", ico: "SVM" },
  { id: "erp", ico: "ErP" },
];

type Row = [string, ReactNode, string?];
const Spec = ({ rows }: { rows: Row[] }) => (
  <div className="spec">
    {rows.map(([k, v, cls], i) => (
      <div className="spec-row" key={i}><span className="k">{k}</span><span className={"v " + (cls ?? "")}>{v}</span></div>
    ))}
  </div>
);

export function EzMode() {
  const s = useStore();
  const { t } = useLang();
  const views: Record<string, () => ReactNode> = { cpu: CpuTab, memory: MemoryTab, storage: StorageTab, fan: FanTab, help: HelpTab };
  const View = views[s.ezTab];
  const lang = langOf(s);

  return (
    <section className="ez">
      <div className="ez-label">EZ Mode</div>
      <div className="ez-main">
        <nav className="ez-nav">
          {TABS.map((tab) => (
            <button key={tab.id} className={"nav-item" + (s.ezTab === tab.id ? " active" : "") + kf(s, "nav", EZ_TABS.indexOf(tab.id))} onClick={() => s.patch({ ezTab: tab.id })}>
              <Icon name={tab.id} />
              <span>{t(tab.en, tab.ru)}</span>
            </button>
          ))}
        </nav>
        <div className="ez-content"><View /></div>
      </div>
      <div className="ez-bottom">
        <div className="ez-tools">
          <ToolButton icon="flash" label="Flash BIOS" focus={kf(s, "tools", 0)} hint={t("Update the BIOS firmware from a USB drive.", "Обновление прошивки BIOS с USB-накопителя.")} onClick={TOOLS[0]} />
          <ToolButton icon="star" label={t("Favorites (F3)", "Избранное (F3)")} focus={kf(s, "tools", 1)} hint={t("Quick access to frequently used settings.", "Быстрый доступ к часто используемым настройкам.")} onClick={TOOLS[1]} />
          <ToolButton icon="monitor" label="Hardware Monitor" focus={kf(s, "tools", 2)} hint={t("Temperatures, voltages and fans in Advanced → Monitor.", "Температуры, напряжения и вентиляторы в Advanced → Monitor.")}
            onClick={TOOLS[2]} />
        </div>
        <div className="ez-tiles">
          {TILES.map(({ id, ico }, i) => {
            const v = s.pending[id];
            const on = id === "sataMode" ? v === "RAID" : !!v;
            const cls = "tile" + (on ? " on" : "") + (isChanged(s, id) ? " changed" : "") + kf(s, "tiles", i);
            return (
              <button
                key={id}
                className={cls}
                onClick={() => toggleTile(id)}
                onMouseEnter={() => s.patch({ hint: PARAMS[id].help[lang] })}
              >
                <span className="tico">{ico}</span>
                <span className="tlabel">{id === "sataMode" ? "AHCI / RAID" : PARAMS[id].label[lang]}</span>
                <span className="sw">{id === "sataMode" ? v : on ? "ON" : "OFF"}<i /></span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hintbar">{s.hint || t("Tab: next area   ↑↓←→: move   Enter: select   F7: Advanced Mode   F10: Save & Exit", "Tab: следующая область   ↑↓←→: перемещение   Enter: выбрать   F7: расширенный режим   F10: сохранить и выйти")}</div>
    </section>
  );
}

const langOf = (s: { pending: Record<string, any> }) => (s.pending.language === "Русский" ? "ru" : "en");

function ToolButton({ icon, label, hint, focus, onClick }: { icon: string; label: string; hint: string; focus: string; onClick: () => void }) {
  const patch = useStore((s) => s.patch);
  return (
    <button className={"tool" + focus} onClick={onClick} onMouseEnter={() => patch({ hint })}>
      <Icon name={icon} />
      {label}
    </button>
  );
}

function CpuTab() {
  const s = useStore();
  const { t, lang } = useLang();
  const r = readings(s.pending, s.thermal);
  const ch = (id: string) => (isChanged(s, id) ? "changed" : "");
  return (
    <div className="ez-split">
      <div>
        <div className="big-label">{t("CPU Frequency", "Частота процессора")}</div>
        <div className="big-value">{r.freq}<small>GHz</small></div>
        <div className="ez-note">{t("Ratio, core voltage and boost: Advanced Mode (F7) → Advanced → CPU Configuration.", "Множитель, напряжение ядра и буст: Advanced Mode (F7) → Advanced → CPU Configuration.")}</div>
      </div>
      <Spec rows={[
        ["CPU Base Clock", `${HW.bclk.toFixed(2)} MHz`],
        ["CPU Ratio", s.pending.cpuRatio ? `${s.pending.cpuRatio}` : `Auto (${HW.baseRatio})`, ch("cpuRatio")],
        ["Core Number", HW.cores],
        ["Thread Number", s.pending.smt ? HW.threads : HW.cores, ch("smt")],
        ["CPU Core Voltage", `${r.vcore.toFixed(3)} V ${s.pending.cpuVcore ? "(Manual)" : "(Auto)"}`, isChanged(s, "cpuVcore") ? "changed" : vcoreClass(r.vcore)],
        ["CPU Temperature", `${r.temp.toFixed(1)} °C`, tempClass(r.temp)],
        ["Core Performance Boost", s.pending.cpb, ch("cpb")],
        ["AMD Virtualization (SVM)", formatValue("virtualization", s.pending.virtualization, lang), ch("virtualization")],
        ["Execute Disable Bit", "Enabled"],
        ["L2 / L3 Cache", `${HW.l2} / ${HW.l3}`],
        ["Instruction Set", "MMX, SSE, SSE2, SSE3, SSE4.1/4.2, AVX, AVX2, AVX-512, AES"],
      ]} />
    </div>
  );
}

function MemoryTab() {
  const s = useStore();
  const { t } = useLang();
  const r = readings(s.pending, s.thermal);
  const ch = isChanged(s, "xmp") ? "changed" : "";
  return (
    <div className="ez-split">
      <div>
        <div className="big-label">{t("DRAM Frequency", "Частота памяти")}</div>
        <div className="big-value">{r.dramFreq}<small>MHz</small></div>
        <div className="seg">
          {Object.keys(XMP).map((p, i) => (
            <button key={p} className={(s.pending.xmp === p ? "on " + ch : "") + kf(s, "seg", i)} onClick={() => s.setParam("xmp", p)}>
              {p === "Disabled" ? "XMP Off" : p}
            </button>
          ))}
        </div>
        <div className="ez-note">{t("XMP raises frequency and DRAM voltage, adding a little heat.", "XMP повышает частоту и напряжение памяти и немного добавляет нагрева.")}</div>
      </div>
      <div>
        <Spec rows={[
          ["Total Size", `${HW.ramTotalMb} MB`],
          ["Channel Mode", "Dual"],
          ["Memory Type", "DDR5"],
          ["XMP Profile", s.pending.xmp, ch],
          ["Timings (CL-tRCD-tRP-tRAS)", r.timings, ch],
          ["DRAM Voltage", `${r.dramV.toFixed(3)} V ${s.pending.dramVoltage ? "(Manual)" : "(Auto)"}`, isChanged(s, "dramVoltage") ? "changed" : ch],
        ]} />
        <div className="sub-title">DIMM Slots</div>
        <div className="dimms">
          {["A1", "A2", "B1", "B2"].map((slot) => (
            <div key={slot} className={"dimm" + (HW.dimms[slot] ? " filled" : "")}>
              <span className="slot">DIMM{slot}</span>
              <span>{HW.dimms[slot] ?? "Empty"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StorageTab() {
  const s = useStore();
  const { t } = useLang();
  return (
    <div>
      <Spec rows={[
        ["SATA Mode", s.pending.sataMode, isChanged(s, "sataMode") ? "changed" : ""],
        ["USB Mass Storage", s.pending.usbStorage ? "Enabled" : "Disabled", isChanged(s, "usbStorage") ? "changed" : ""],
      ]} />
      <table className="ports">
        <thead><tr><th>Port</th><th>Device</th><th>Capacity</th><th>{t("Contents", "Содержимое")}</th></tr></thead>
        <tbody>
          {STORAGE.map((d) => {
            const hidden = d.port === "USB" && !s.pending.usbStorage;
            return d.device && !hidden ? (
              <tr key={d.port}><td className="port">{d.port}</td><td>{d.device}</td><td>{d.size}</td><td>{d.note}</td></tr>
            ) : (
              <tr key={d.port}><td className="port">{d.port}</td><td className="none">None</td><td className="none">—</td><td /></tr>
            );
          })}
        </tbody>
      </table>
      {s.pending.sataMode === "RAID" && (
        <div className="ez-note crit">{t("Warning: the OS is installed in AHCI mode and will not boot in RAID.", "Внимание: ОС установлена в режиме AHCI и не загрузится в режиме RAID.")}</div>
      )}
    </div>
  );
}

function FanTab() {
  const s = useStore();
  const { t, lang } = useLang();
  const r = readings(s.pending, s.thermal);
  const ch = isChanged(s, "fanProfile") || isChanged(s, "fanCurve") ? "changed" : "";
  return (
    <div className="fan-wrap">
      <div>
        <div className="fan-chart"><FanCurve /></div>
        <div className="seg">
          {[...Object.keys(FAN_PRESETS), "Custom"].map((p, i) => (
            <button key={p} className={(s.pending.fanProfile === p ? "on " + ch : "") + kf(s, "seg", i)} onClick={() => s.setParam("fanProfile", p)}>{p}</button>
          ))}
        </div>
      </div>
      <div>
        <Spec rows={[
          ["CPU Temperature", `${r.temp.toFixed(1)} °C`, tempClass(r.temp)],
          ["Fan Duty", `${r.duty.toFixed(0)} %`],
          ["CPU_FAN1", `${r.rpm} RPM`],
          ["SYS_FAN1", `${r.sysRpm} RPM`],
          ["SYS_FAN2", "N/A"],
          ["PUMP_FAN1", "N/A"],
          [t("Estimated Noise", "Уровень шума"), `${r.noise.toFixed(1)} dB`, noiseClass(r.noise)],
          ["Fan Fail Warning", formatValue("fanFailWarn", s.pending.fanFailWarn, lang), isChanged(s, "fanFailWarn") ? "changed" : ""],
        ]} />
        <div className="ez-note">
          {t("Drag the red points to create your own curve. The white dot is the current temperature and fan duty; the fan and temperature settle over a few seconds.",
            "Перетаскивайте красные точки, чтобы сделать свою кривую. Белая точка — текущая температура и скорость вентилятора; они выравниваются за несколько секунд.")}
        </div>
      </div>
    </div>
  );
}

function HelpTab() {
  const { t } = useLang();
  const keys: [string, string][] = [
    ["F1", t("General help", "Общая справка")],
    ["F3", t("Favorites", "Избранное")],
    ["F6", t("Load optimized defaults", "Загрузить заводские настройки")],
    ["F7", t("Switch EZ / Advanced Mode", "Переключить EZ / расширенный режим")],
    ["F10", t("Save changes and reset", "Сохранить изменения и перезагрузить")],
    ["Esc", t("Exit / close window / back", "Выход / закрыть окно / назад")],
    ["↑ ↓ ← →", t("Navigate in Advanced Mode", "Навигация в расширенном режиме")],
    ["Enter", t("Change selected item / open submenu", "Изменить пункт / открыть подменю")],
    ["+ / −", t("Change value without a window", "Изменить значение без окна")],
    ["DEL", t("Enter Setup during POST", "Вход в Setup во время POST")],
    ["F11", t("Boot Menu during POST", "Меню загрузки во время POST")],
  ];
  return (
    <div>
      <div className="sub-title first">{t("Hot keys", "Горячие клавиши")}</div>
      <div className="hotkeys">
        {keys.map(([k, v]) => (
          <div className="hk" key={k}><span className="key">{k}</span><span>{v}</span></div>
        ))}
      </div>
      <div className="ez-note">
        {t("Changes take effect only after saving (F10). Unsaved values are highlighted in yellow. Saved settings are kept in CMOS and survive a restart.",
          "Изменения вступают в силу только после сохранения (F10). Несохранённые значения подсвечены жёлтым. Сохранённые настройки хранятся в CMOS и переживают перезагрузку.")}
      </div>
    </div>
  );
}
