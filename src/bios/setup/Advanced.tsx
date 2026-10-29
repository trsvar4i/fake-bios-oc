import { useEffect, useRef } from "react";
import { useStore, useLang, isChanged } from "../../machine/store";
import { DEVICES, type DeviceId } from "../../machine/hardware";
import { PARAMS, formatValue, isDisabled } from "../../machine/params";
import { deviceAvailable } from "../../machine/boot";
import { readings } from "../../machine/sensors";
import { ACTIONS, confirmOverride, cycleParam, editParam, pickBootSlot } from "./actions";
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

  // выбранный с клавиатуры пункт всегда в поле зрения
  useEffect(() => {
    listRef.current?.querySelector(".row.selected")?.scrollIntoView({ block: "nearest" });
  }, [sel, s.advTab, s.advPath.length]);

  const rowFor = (it: Item, i: number) => {
    if (it.kind === "header") return <div key={i} className="row header">{it.label[lang]}</div>;
    if (it.kind === "fan") return <div key={i} className="row fanrow"><FanCurve width={760} height={300} /></div>;

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
    if (it.kind === "sub") label = "▸ " + it.label[lang];
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
              <button className="back" onClick={() => s.patch({ advPath: s.advPath.slice(0, -1) })}>↶</button>
            )}
            {crumbs.join(" \\ ")}
          </div>
          <div className="items" ref={listRef}>{items.map(rowFor)}</div>
        </div>
        <aside className="adv-side">
          <div className="side-title">{t("Help Info", "Справка")}</div>
          <div className="help-text"><HelpFor it={cur} /></div>
          <div className="side-keys">
            <div><b>↑↓</b> {t("Select Item", "Выбор пункта")}</div>
            <div><b>←→</b> {t("Select Menu", "Выбор раздела")}</div>
            <div><b>Enter</b> {t("Select / Open", "Изменить / открыть")}</div>
            <div><b>+/−</b> {t("Change Value", "Изменить значение")}</div>
            <div><b>F6</b> {t("Optimized Defaults", "Заводские настройки")}</div>
            <div><b>F7</b> EZ Mode</div>
            <div><b>F10</b> {t("Save & Reset", "Сохранить и перезагрузить")}</div>
            <div><b>Esc</b> {t("Back / Exit", "Назад / выход")}</div>
          </div>
        </aside>
      </div>
    </section>
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
            {t("Saved", "Сохранено")}: {formatValue(it.id, s.saved[it.id], lang)}<br />
            {t("New", "Новое")}: {formatValue(it.id, s.pending[it.id], lang)}
          </div>
        )}
      </>
    );
  }
  if (it.kind === "sub") return <>{t("Opens submenu", "Открывает подменю")}: {it.label[lang]}</>;
  if (it.kind === "boot")
    return <>{PARAMS.bootOrder.help[lang]} {t("Choosing a device swaps it with the current one. You can also drag icons in the Boot Priority bar.", "Выбор устройства меняет его местами с текущим. Порядок также можно перетаскивать в полосе Boot Priority.")}</>;
  if (it.kind === "action") return <>{it.help[lang]}</>;
  if (it.kind === "override")
    return <>{t("Boot once from this device without changing Boot Priority.", "Загрузиться один раз с этого устройства, не меняя порядок загрузки.")}</>;
  return null;
}
