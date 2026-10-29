import { useEffect, useRef } from "react";
import { useStore, useLang, isChanged } from "../../machine/store";
import { DEVICES, HW, type DeviceId } from "../../machine/hardware";
import { PARAMS, formatValue, isDisabled } from "../../machine/params";
import { deviceAvailable } from "../../machine/boot";
import { readings, tempClass, throttleAt, vcoreClass } from "../../machine/sensors";
import { loadProfiles } from "../../machine/profiles";
import { ACTIONS, confirmOverride, cycleParam, editParam, openProfile, pickBootSlot, toggleMode } from "./actions";
import { FanCurve } from "./FanCurve";
import { PAGE_TITLES, TABS, isSelectable, pageItems, type Item } from "./menus";

type S = ReturnType<typeof useStore.getState>;

const currentPage = (s: S) => (s.advPath.length ? s.advPath[s.advPath.length - 1] : TABS[s.advTab].id);
const selKey = (s: S) => [s.advTab, ...s.advPath].join("/");
const itemsOf = (s: S) => pageItems(currentPage(s), s.pending, readings(s.pending, s.thermal));

function selectedIndex(s: S, items: Item[]) {
  const i = s.advSel[selKey(s)];
  if (i !== undefined && items[i] && isSelectable(items[i])) return i;
  return items.findIndex(isSelectable);
}

function activate(it: Item) {
  const s = useStore.getState();
  if (it.kind === "param") editParam(it.id);
  if (it.kind === "sub") s.patch({ advPath: [...s.advPath, it.page] });
  if (it.kind === "boot") pickBootSlot(it.index);
  if (it.kind === "action") ACTIONS[it.id]();
  if (it.kind === "override") confirmOverride(it.dev);
  if (it.kind === "profile") openProfile(it.slot);
}

/** Клавиатура Advanced Mode. Возвращает true, если клавиша обработана. */
export function advKey(e: KeyboardEvent): boolean {
  const s = useStore.getState();
  const items = itemsOf(s);
  const sel = items.map((it, i) => (isSelectable(it) ? i : -1)).filter((i) => i >= 0);
  const pos = sel.indexOf(selectedIndex(s, items));
  const select = (i: number) => s.patch({ advSel: { ...s.advSel, [selKey(s)]: i } });
  const cur = items[selectedIndex(s, items)];

  switch (e.key) {
    case "ArrowLeft":
    case "ArrowRight": {
      const n = TABS.length;
      s.patch({ advTab: (s.advTab + (e.key === "ArrowRight" ? 1 : n - 1)) % n, advPath: [] });
      return true;
    }
    case "ArrowDown": if (sel.length) select(sel[(pos + 1) % sel.length]); return true;
    case "ArrowUp": if (sel.length) select(sel[(pos - 1 + sel.length) % sel.length]); return true;
    case "PageDown": case "End": if (sel.length) select(sel[sel.length - 1]); return true;
    case "PageUp": case "Home": if (sel.length) select(sel[0]); return true;
    case "Enter": if (cur) activate(cur); return true;
    case "+": case "-":
      if (cur?.kind === "param") cycleParam(cur.id, e.key === "+" ? 1 : -1);
      return true;
    case "Escape":
      if (s.advPath.length) { s.patch({ advPath: s.advPath.slice(0, -1) }); return true; }
      return false;
  }
  return false;
}

export function Advanced() {
  const s = useStore();
  const { t, lang } = useLang();
  const items = itemsOf(s);
  const sel = selectedIndex(s, items);
  const cur = items[sel];
  const crumbs = [TABS[s.advTab].title, ...s.advPath.map((p) => PAGE_TITLES[p])].map((x) => x[lang]);
  const listRef = useRef<HTMLDivElement>(null);
  const profiles = loadProfiles();

  // выбранный с клавиатуры пункт всегда в поле зрения
  useEffect(() => {
    listRef.current?.querySelector(".row.selected")?.scrollIntoView({ block: "nearest" });
  }, [sel, s.advTab, s.advPath.length]);

  const rowFor = (it: Item, i: number) => {
    if (it.kind === "header") return <div key={i} className="row header">{it.label[lang]}</div>;
    if (it.kind === "fan") return <div key={i} className="row fanrow"><FanCurve width={860} height={300} /></div>;
    if (it.kind === "graph") return <div key={i} className="row graphrow"><MonitorGraphs /></div>;

    let label = "", val = "", valCls = "", cls = "row " + it.kind;
    if (it.kind === "info") {
      label = it.label[lang]; val = it.value; valCls = it.cls ?? "";
      if (it.grey) cls += " grey";
    }
    if (it.kind === "param") {
      label = PARAMS[it.id].label[lang];
      val = formatValue(it.id, s.pending[it.id], lang);
      valCls = "bracket";
      if (isChanged(s, it.id)) cls += " changed";
      if (isDisabled(it.id, s.pending)) cls += " disabled";
    }
    if (it.kind === "sub") label = it.label[lang];
    if (it.kind === "boot") {
      const dev = s.pending.bootOrder[it.index] as DeviceId;
      label = `Boot Option #${it.index + 1}`;
      val = DEVICES[dev].name;
      valCls = "bracket";
      if (dev !== s.saved.bootOrder[it.index]) cls += " changed";
      if (!deviceAvailable(s.pending, dev)) cls += " disabled";
    }
    if (it.kind === "action") label = it.label[lang];
    if (it.kind === "override") {
      label = DEVICES[it.dev].name;
      if (!deviceAvailable(s.pending, it.dev)) cls += " disabled";
    }
    if (it.kind === "profile") {
      const pr = profiles[it.slot];
      label = `${t("Profile", "Профиль")} ${it.slot + 1}`;
      val = pr ? pr.name : t("Empty", "Пусто");
      valCls = pr ? "" : "dim";
    }
    if (isSelectable(it)) {
      cls += " selectable";
      if (i === sel) cls += " selected";
    }
    return (
      <div
        key={i}
        className={cls}
        onClick={isSelectable(it) ? () => { s.patch({ advSel: { ...s.advSel, [selKey(s)]: i } }); activate(it); } : undefined}
      >
        <span className="label">{label}</span>
        <span className={"val " + valCls}>{val}</span>
      </div>
    );
  };

  return (
    <section className="adv">
      <nav className="tabs">
        {TABS.map((tab, i) => (
          <button key={tab.id} className={"tab" + (i === s.advTab ? " active" : "")} onClick={() => s.patch({ advTab: i, advPath: [] })}>
            {tab.title[lang]}
          </button>
        ))}
      </nav>
      <div className="adv-main">
        <div className="adv-list">
          <div className="crumbs">
            {s.advPath.length > 0 && (
              <button className="back" onClick={() => s.patch({ advPath: s.advPath.slice(0, -1) })} aria-label="Back">
                <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
            )}
            {crumbs.join("  \\  ")}
          </div>
          <div className="items" ref={listRef} key={selKey(s)}>{items.map(rowFor)}</div>
          <div className="adv-help">
            <span className="help-i">i</span>
            <div className="help-text"><HelpFor it={cur} /></div>
          </div>
        </div>
        <HwMonitor />
      </div>
      <footer className="adv-foot">
        <span className="af-item">{t("Last Modified", "Последнее изменение")}: {HW.buildDate}</span>
        <span className="af-keys">
          <span><b>←→</b> {t("Select Screen", "Раздел")}</span>
          <span><b>↑↓</b> {t("Select Item", "Пункт")}</span>
          <span><b>Enter</b> {t("Select", "Выбор")}</span>
          <span><b>+/−</b> {t("Change Opt.", "Значение")}</span>
          <span><b>F6</b> {t("Defaults", "Заводские")}</span>
          <span><b>F10</b> {t("Save & Exit", "Сохранить")}</span>
          <span><b>Esc</b> {t("Back", "Назад")}</span>
        </span>
        <button className="af-btn" onClick={toggleMode}>EZ Mode (F7) <svg viewBox="0 0 24 24"><path d="M14 5h5v5M19 5l-7 7M10 19H5v-5" /></svg></button>
      </footer>
    </section>
  );
}

/** Панель Hardware Monitor справа: процессор, память, напряжения, вентиляторы и живой график температуры. */
export function HwMonitor() {
  const s = useStore();
  const { t } = useLang();
  const r = readings(s.pending, s.thermal);
  const temps = s.hist.temp;
  const Cell = ({ k, v, cls }: { k: string; v: string; cls?: string }) => <div className="hm-cell"><span>{k}</span><b className={cls}>{v}</b></div>;
  return (
    <aside className="hwmon">
      <div className="hm-title"><svg viewBox="0 0 24 24"><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>Hardware Monitor</div>
      <div className="hm-sec">
        <div className="hm-head">CPU</div>
        <div className="hm-grid">
          <Cell k={t("Frequency", "Частота")} v={`${Math.round(Number(r.freq) * 1000)} MHz`} />
          <Cell k={t("Temperature", "Температура")} v={`${r.temp.toFixed(0)} °C`} cls={tempClass(r.temp)} />
          <Cell k="BCLK" v={`${r.bclk.toFixed(2)} MHz`} />
          <Cell k={t("Core Voltage", "Напряжение")} v={`${r.vcore.toFixed(3)} V`} cls={vcoreClass(r.vcore)} />
          <Cell k={t("Ratio", "Множитель")} v={`${r.multiplier}x`} />
          <Cell k={t("Throttle at", "Троттлинг")} v={`${throttleAt(s.pending)} °C`} />
        </div>
        <Spark data={temps} min={30} max={100} mark={throttleAt(s.pending)} />
      </div>
      <div className="hm-sec">
        <div className="hm-head">{t("Memory", "Память")}</div>
        <div className="hm-grid">
          <Cell k={t("Frequency", "Частота")} v={`${r.dramFreq} MT/s`} />
          <Cell k={t("Voltage", "Напряжение")} v={`${r.dramV.toFixed(3)} V`} />
          <Cell k={t("Capacity", "Объём")} v={`${HW.ramTotalMb} MB`} />
          <Cell k={t("Timings", "Тайминги")} v={r.timings.split("-").slice(0, 3).join("-")} />
        </div>
      </div>
      <div className="hm-sec">
        <div className="hm-head">{t("Voltage", "Напряжения")}</div>
        <div className="hm-grid">
          <Cell k="+12V" v={`${r.v12.toFixed(3)} V`} />
          <Cell k="+5V" v={`${r.v5.toFixed(3)} V`} />
          <Cell k="+3.3V" v={`${r.v33.toFixed(3)} V`} />
        </div>
      </div>
      <div className="hm-sec">
        <div className="hm-head">{t("Fans", "Вентиляторы")}</div>
        <div className="hm-grid">
          <Cell k="CPU_FAN" v={`${r.rpm} RPM`} />
          <Cell k="SYS_FAN1" v={`${r.sysRpm} RPM`} />
        </div>
      </div>
    </aside>
  );
}

/** Мини-график: история датчика за последние секунды. */
function Spark({ data, min, max, mark }: { data: number[]; min: number; max: number; mark?: number }) {
  const W = 360, H = 64;
  const y = (v: number) => H - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * H;
  const pts = data.map((v, i) => `${(W * (i + 90 - data.length)) / 89},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {mark !== undefined && <line x1="0" x2={W} y1={y(mark)} y2={y(mark)} className="spark-mark" />}
      {data.length > 1 && <polyline points={`${(W * (90 - data.length)) / 89},${H} ${pts} ${W},${H}`} className="spark-area" />}
      {data.length > 1 && <polyline points={pts} className="spark-line" />}
    </svg>
  );
}

/** Графики на вкладке Monitor: температура CPU и обороты вентилятора за последние полторы минуты. */
function MonitorGraphs() {
  const s = useStore();
  const { t } = useLang();
  const limit = throttleAt(s.pending);
  const chart = (title: string, data: number[], min: number, max: number, unit: string, cls: string, mark?: number) => {
    const W = 420, H = 150;
    const y = (v: number) => H - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * H;
    const pts = data.map((v, i) => `${(W * (i + 90 - data.length)) / 89},${y(v).toFixed(1)}`).join(" ");
    const last = data[data.length - 1];
    return (
      <div className={"mgraph " + cls}>
        <div className="mg-head"><span>{title}</span><b>{last === undefined ? "—" : `${unit === "°C" ? last.toFixed(1) : Math.round(last)} ${unit}`}</b></div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="mg-grid" />)}
          {mark !== undefined && <line x1="0" x2={W} y1={y(mark)} y2={y(mark)} className="spark-mark" />}
          {data.length > 1 && <polyline points={`${(W * (90 - data.length)) / 89},${H} ${pts} ${W},${H}`} className="spark-area" />}
          {data.length > 1 && <polyline points={pts} className="spark-line" />}
        </svg>
        <div className="mg-axis"><span>−90 s</span><span>{min}–{max} {unit}</span><span>{t("now", "сейчас")}</span></div>
      </div>
    );
  };
  return (
    <div className="mgraphs">
      {chart(t("CPU Temperature", "Температура CPU"), s.hist.temp, 30, 100, "°C", "mg-temp", limit)}
      {chart("CPU_FAN", s.hist.rpm, 0, 2600, "RPM", "mg-fan")}
    </div>
  );
}

function HelpFor({ it }: { it?: Item }) {
  const s = useStore();
  const { t, lang } = useLang();
  if (!it) return <>{t("Information page.", "Информационная страница.")}</>;
  if (it.kind === "param") {
    const p = PARAMS[it.id];
    return (
      <>
        {p.help[lang]}
        {isDisabled(it.id, s.pending) && <div className="help-note">{t("Unavailable with current settings.", "Недоступно при текущих настройках.")}</div>}
        {isChanged(s, it.id) && (
          <div className="diff">
            {t("Saved", "Сохранено")}: {formatValue(it.id, s.saved[it.id], lang)} → {t("New", "Новое")}: {formatValue(it.id, s.pending[it.id], lang)}
          </div>
        )}
      </>
    );
  }
  if (it.kind === "sub") return <>{t("Opens submenu", "Открывает подменю")}: {it.label[lang]}</>;
  if (it.kind === "boot")
    return <>{PARAMS.bootOrder.help[lang]} {t("Choosing a device swaps it with the current one. In EZ Mode you can drag the icons.", "Выбор устройства меняет его местами с текущим. В EZ Mode иконки можно перетаскивать.")}</>;
  if (it.kind === "action") return <>{it.help[lang]}</>;
  if (it.kind === "override")
    return <>{t("Boot once from this device without changing Boot Priority.", "Загрузиться один раз с этого устройства, не меняя порядок загрузки.")}</>;
  if (it.kind === "profile")
    return <>{t("Save the current CPU, memory, voltage and fan settings to this slot, or load them back. Loaded values apply after F10.", "Сохранить текущие настройки процессора, памяти, напряжений и вентиляторов в этот слот или загрузить их обратно. Загруженное вступит в силу после F10.")}</>;
  return null;
}
