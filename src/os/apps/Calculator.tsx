import { useEffect, useRef, useState } from "react";

type Op = "+" | "−" | "×" | "÷";

const apply = (a: number, b: number, op: Op) =>
  op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;

/** Число для экрана: без хвостов плавающей точки, длинные — в экспоненте. */
function show(v: number) {
  if (!Number.isFinite(v)) return "Error";
  const r = Math.abs(Math.round(v * 1e10) / 1e10);
  const s = String(r).length > 10 ? r.toExponential(5) : String(r);
  return (v < 0 && r !== 0 ? "−" : "") + s;
}

/** Калькулятор в духе macOS: AC/C, ±, %, повтор «=», ввод с клавиатуры. */
export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  const [last, setLast] = useState<{ op: Op; b: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const value = () => parseFloat(display.replace("−", "-").replace(",", "."));

  const digit = (d: string) => {
    if (display === "Error") { setDisplay(d === "." ? "0." : d); setFresh(false); return; }
    if (fresh) { setDisplay(d === "." ? "0." : d); setFresh(false); return; }
    if (d === "." && display.includes(".")) return;
    if (display.replace(/[−.]/g, "").length >= 9) return;
    setDisplay(display === "0" && d !== "." ? d : display + d);
  };
  const operator = (o: Op) => {
    const v = value();
    if (acc !== null && op && !fresh) {
      const r = apply(acc, v, op);
      setAcc(r);
      setDisplay(show(r));
    } else setAcc(v);
    setOp(o);
    setFresh(true);
    setLast(null);
  };
  const equals = () => {
    if (op && acc !== null) {
      const b = fresh ? acc : value();
      const r = apply(acc, b, op);
      setDisplay(show(r));
      setLast({ op, b });
      setAcc(null); setOp(null); setFresh(true);
    } else if (last) {
      const r = apply(value(), last.b, last.op);
      setDisplay(show(r)); setFresh(true);
    }
  };
  const clear = () => {
    if (display !== "0" && !fresh) { setDisplay("0"); setFresh(true); return; }
    setDisplay("0"); setAcc(null); setOp(null); setFresh(true); setLast(null);
  };
  const negate = () => setDisplay(display.startsWith("−") ? display.slice(1) : display === "0" ? "0" : "−" + display);
  const percent = () => { setDisplay(show(value() / 100)); setFresh(true); };

  useEffect(() => { root.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (/^[0-9]$/.test(k)) digit(k);
    else if (k === "." || k === ",") digit(".");
    else if (k === "+") operator("+");
    else if (k === "-") operator("−");
    else if (k === "*") operator("×");
    else if (k === "/") { e.preventDefault(); operator("÷"); }
    else if (k === "Enter" || k === "=") { e.preventDefault(); equals(); }
    else if (k === "Escape" || k === "Delete") clear();
    else if (k === "%") percent();
    else if (k === "Backspace" && !fresh) setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
    else return;
    e.preventDefault();
  };

  const showAc = display === "0" || fresh;
  const keys: [string, string, () => void][] = [
    [showAc ? "AC" : "C", "fn", clear], ["±", "fn", negate], ["%", "fn", percent], ["÷", "op", () => operator("÷")],
    ["7", "", () => digit("7")], ["8", "", () => digit("8")], ["9", "", () => digit("9")], ["×", "op", () => operator("×")],
    ["4", "", () => digit("4")], ["5", "", () => digit("5")], ["6", "", () => digit("6")], ["−", "op", () => operator("−")],
    ["1", "", () => digit("1")], ["2", "", () => digit("2")], ["3", "", () => digit("3")], ["+", "op", () => operator("+")],
    ["0", "zero", () => digit("0")], [",", "", () => digit(".")], ["=", "op", equals],
  ];
  const size = display.length > 9 ? 44 : display.length > 7 ? 58 : 76;

  return (
    <div className="calc" ref={root} tabIndex={0} onKeyDown={onKey}>
      <div className="calc-display" style={{ fontSize: size }}>{display.replace(".", ",")}</div>
      <div className="calc-keys">
        {keys.map(([label, kind, fn]) => (
          <button
            key={label + kind}
            className={"calc-key " + kind + (kind === "op" && op === label && fresh ? " on" : "")}
            onClick={() => { fn(); root.current?.focus(); }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
