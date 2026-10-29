import { useRef, useState } from "react";
import { useStore } from "../machine/store";
import { activeCurve, readings } from "../machine/sensors";

/** График кривой вентилятора. Точки перетаскиваются мышью → профиль становится Custom. */
export function FanCurve({ width = 620, height = 320 }: { width?: number; height?: number }) {
  const s = useStore();
  const curve = activeCurve(s.pending);
  const r = readings(s.pending, s.thermal);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragI, setDragI] = useState<number | null>(null);

  const W = width, H = height, L = 56, R = 20, T = 20, B = 40;
  const x = (t: number) => L + ((t - 20) / 80) * (W - L - R);
  const y = (d: number) => T + (1 - d / 100) * (H - T - B);

  // экранные координаты → °C / % с учётом масштаба сцены
  const toData = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [20 + ((p.x - L) / (W - L - R)) * 80, (1 - (p.y - T) / (H - T - B)) * 100];
  };

  const pts: [number, number][] = [[20, curve[0][1]], ...curve, [100, curve[curve.length - 1][1]]];
  const path = pts.map(([t, d], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(d).toFixed(1)}`).join(" ");
  const nowT = Math.min(100, Math.max(20, s.thermal.temp));

  const grid = [];
  for (let t = 20; t <= 100; t += 10) {
    grid.push(<line key={"vt" + t} className="grid" x1={x(t)} y1={T} x2={x(t)} y2={H - B} />);
    grid.push(<text key={"lt" + t} className="axis" x={x(t)} y={H - 14} textAnchor="middle">{t}°C</text>);
  }
  for (let d = 0; d <= 100; d += 25) {
    grid.push(<line key={"hd" + d} className="grid" x1={L} y1={y(d)} x2={W - R} y2={y(d)} />);
    grid.push(<text key={"ld" + d} className="axis" x={L - 8} y={y(d) + 5} textAnchor="end">{d}%</text>);
  }

  return (
    <svg
      ref={svgRef}
      className="fan-svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      onPointerMove={(e) => {
        if (dragI === null) return;
        const [t, d] = toData(e);
        s.setCurvePoint(dragI, t, d);
      }}
      onPointerUp={() => setDragI(null)}
    >
      {grid}
      <path className="area" d={`${path} L${x(100)},${y(0)} L${x(20)},${y(0)} Z`} />
      <path className="curve" d={path} />
      <line className="nowline" x1={x(nowT)} y1={T} x2={x(nowT)} y2={H - B} />
      <circle className="now" cx={x(nowT)} cy={y(r.duty)} r={6} />
      {curve.map(([t, d], i) => (
        <g key={i}>
          <circle
            className={"pt" + (dragI === i ? " active" : "")}
            cx={x(t)}
            cy={y(d)}
            r={9}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragI(i); }}
          />
          {dragI === i && (
            <text className="pt-label" x={x(t)} y={y(d) - 16} textAnchor="middle">{t}°C / {d}%</text>
          )}
        </g>
      ))}
    </svg>
  );
}
