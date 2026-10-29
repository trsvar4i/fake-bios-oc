import { useEffect, useState } from "react";
import { useStore, useLang } from "../../machine/store";

/** Единое BIOS-окно: список вариантов, числовое поле или кнопки Yes/No. */
export function Dialog() {
  const d = useStore((s) => s.dialog);
  const { t } = useLang();
  const [focus, setFocus] = useState(0);
  const [num, setNum] = useState("");

  useEffect(() => {
    if (!d) return;
    setFocus(d.list ? Math.max(0, d.list.findIndex((o) => o.value === d.current)) : 0);
    if (d.number) setNum(String(d.number.value));
  }, [d]);

  // Закрыть окно после действия, если действие не открыло новое окно.
  const finish = (fn: () => void) => {
    const cur = useStore.getState().dialog;
    fn();
    if (useStore.getState().dialog === cur) useStore.getState().closeDialog();
  };
  const close = () => useStore.getState().closeDialog();

  const buttons = d?.number
    ? [{ label: "OK", run: () => applyNum() }, { label: t("Cancel", "Отмена"), run: () => {} }]
    : d?.buttons ?? [];

  const pick = (i: number) => finish(() => d!.onPick?.(d!.list![i].value));
  const press = (i: number) => finish(() => buttons[i].run());
  const stepNum = (dir: number) => {
    const n = d!.number!;
    const v = parseInt(num, 10) || 0;
    setNum(String(Math.min(n.max, Math.max(n.min, v + dir * n.step))));
  };
  function applyNum() {
    const n = d!.number!;
    const v = parseInt(num, 10);
    n.onApply(Math.min(n.max, Math.max(n.min, isNaN(v) ? n.value : v)));
  }

  useEffect(() => {
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      const k = e.key;
      const handled = ["Escape", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "Tab"].includes(k);
      if (!handled) return;
      e.preventDefault();
      if (k === "Escape") return close();
      if (d.list) {
        if (k === "ArrowDown") setFocus((f) => (f + 1) % d.list!.length);
        if (k === "ArrowUp") setFocus((f) => (f - 1 + d.list!.length) % d.list!.length);
        if (k === "Enter") pick(focus);
        return;
      }
      if (d.number) {
        if (k === "ArrowUp" || k === "+") stepNum(1);
        if (k === "ArrowDown" || k === "-") stepNum(-1);
        if (k === "Enter") press(0);
        return;
      }
      if (k === "ArrowRight" || k === "Tab") setFocus((f) => (f + 1) % buttons.length);
      if (k === "ArrowLeft") setFocus((f) => (f - 1 + buttons.length) % buttons.length);
      if (k === "Enter") press(focus);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!d) return null;

  return (
    <div className="dlg-wrap" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dlg">
        <div className="dlg-title">{d.title}</div>
        {d.body && <div className="dlg-body">{d.body}</div>}
        {d.list && (
          <div className="dlg-list">
            {d.list.map((o, i) => (
              <div
                key={i}
                className={"dlg-opt" + (i === focus ? " focus" : "") + (o.value === d.current ? " current" : "")}
                onMouseEnter={() => setFocus(i)}
                onClick={() => pick(i)}
              >
                {o.label}
              </div>
            ))}
          </div>
        )}
        {d.number && (
          <div className="dlg-num">
            <div className="dlg-num-row">
              <button onClick={() => stepNum(-1)}>−</button>
              <input value={num} autoFocus onChange={(e) => setNum(e.target.value.replace(/[^0-9]/g, ""))} />
              <button onClick={() => stepNum(1)}>+</button>
            </div>
            <div className="dlg-hint">{d.number.hint}</div>
          </div>
        )}
        {buttons.length > 0 && (
          <div className="dlg-btns">
            {buttons.map((b, i) => (
              <button
                key={i}
                className={"dlg-btn" + (!d.number && i === focus ? " focus" : "")}
                onMouseEnter={() => !d.number && setFocus(i)}
                onClick={() => press(i)}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
