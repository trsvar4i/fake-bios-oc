import { Fragment, useState } from "react";
import { useStore, useLang, isChanged, changedIds } from "../machine/store";
import { DEVICES, HW, type DeviceId } from "../machine/hardware";
import { deviceAvailable } from "../machine/boot";
import { readings, tempClass } from "../machine/sensors";
import { Icon } from "../ui/Icon";
import { SoundToggle } from "../ui/SoundToggle";
import { kf } from "./ezKeys";
import { confirmDefaults, confirmExit, confirmSave, editParam, toggleMode } from "./actions";

export function Header() {
  const s = useStore();
  const { t, lang } = useLang();
  const r = readings(s.pending, s.thermal);
  const now = new Date();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const kv = (pairs: [string, string][]) =>
    pairs.map(([k, v]) => (
      <Fragment key={k}><span>{k}:</span><span className="v">{v}</span></Fragment>
    ));

  return (
    <>
      <header className="titlebar">
        <div className="logo"><span className="logo-mark" />KESTREL <b>UEFI BIOS</b></div>
        <button className="mode-btn" onClick={toggleMode}>
          {s.mode === "ez" ? t("Advanced (F7)", "Расширенный (F7)") : "EZ Mode (F7)"}
        </button>
        <div className="tb-right">
          {changedIds(s).length > 0 && <span className="dirty">● {t("Unsaved changes", "Есть несохранённые изменения")}</span>}
          <button className="tb-btn" onClick={confirmDefaults}>F6 {t("Defaults", "По умолчанию")}</button>
          <button className="tb-btn" onClick={confirmSave}>F10 {t("Save", "Сохранить")}</button>
          <SoundToggle />
          <button className="tb-btn" onClick={() => editParam("language")}>{s.pending.language}</button>
          <button className="tb-btn x" onClick={confirmExit}>✕</button>
        </div>
      </header>

      <section className="infobar">
        <div className="clockbox">
          <div className="clock">{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="date">{now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
          <div className="temps">
            <div className="temp"><span className="tl">{t("CPU Temp", "Темп. CPU")}</span><span className={"tv " + tempClass(r.temp)}>{r.temp.toFixed(0)}°C</span></div>
            <div className="temp"><span className="tl">{t("Motherboard Temp", "Темп. платы")}</span><span className="tv small">{r.mbTemp.toFixed(0)}°C</span></div>
          </div>
        </div>
        <div className="sysbox">
          <div className="sys-top">
            <div>
              <div className="sp"><span>CPU Speed</span><b>{r.freq} GHz</b></div>
              <div className="sp"><span>DDR Speed</span><b>{r.dramFreq} MHz</b></div>
              <div className="kv">{kv([["BIOS Ver", HW.bios], ["BIOS Build Date", HW.buildDate], ["BIOS Mode", "UEFI"]])}</div>
            </div>
            <div className="kv">
              {kv([
                ["Product", HW.product],
                ["CPU", HW.cpu],
                ["Memory Size", `${HW.ramTotalMb}MB`],
                ["VCore", `${r.vcore.toFixed(3)}V`],
                ["DDR Voltage", `${r.dramV.toFixed(3)}V`],
              ])}
            </div>
          </div>
          <BootBar />
        </div>
      </section>
    </>
  );
}

function BootBar() {
  const s = useStore();
  const { t } = useLang();
  const [drag, setDrag] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ i: number; before: boolean } | null>(null);
  const order = s.pending.bootOrder as DeviceId[];
  const first = order.find((d) => deviceAvailable(s.pending, d));

  const side = (e: React.DragEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2;
  };

  return (
    <div className="bootprio">
      <div className="bp-head">
        <span className="bp-title">{t("Boot Priority", "Порядок загрузки")}</span>
        <span className="bp-hint">{t("drag icons to change the order", "перетащите иконки, чтобы изменить порядок")}</span>
      </div>
      <div className={"bootbar" + (isChanged(s, "bootOrder") ? " changed" : "")}>
        {order.map((id, i) => {
          const off = !deviceAvailable(s.pending, id);
          const cls = ["bdev", off && "off", id === first && "first", drag === i && "dragging",
            drop?.i === i && (drop.before ? "drop-before" : "drop-after")].filter(Boolean).join(" ") + kf(s, "boot", i);
          return (
            <Fragment key={id}>
              <div
                className={cls}
                draggable
                onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); }}
                onDragEnd={() => { setDrag(null); setDrop(null); }}
                onDragOver={(e) => { if (drag === null) return; e.preventDefault(); setDrop({ i, before: side(e) }); }}
                onDragLeave={() => setDrop(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag !== null) s.moveBoot(drag, side(e) ? i : i + 1);
                  setDrag(null);
                  setDrop(null);
                }}
                onMouseEnter={() => s.patch({ hint: `Boot #${i + 1}: ${DEVICES[id].name}${off ? t(" — not available", " — недоступно") : ""}` })}
              >
                <Icon name={DEVICES[id].icon} />
                <span className="badge">U</span>
                <span className="bnum">{i + 1}</span>
              </div>
              {i < order.length - 1 && <span className="bchev">›</span>}
            </Fragment>
          );
        })}
      </div>
      <div className="bp-first">
        {t("First boot device", "Первое загрузочное устройство")}: <b>{first ? DEVICES[first].name : t("None", "Нет")}</b>
      </div>
    </div>
  );
}
