// Рисует обои: слои плавных волн с мягкой тенью и светлым краем — как стеклянные ленты.
import { memo, useEffect, useState } from "react";
import { wallpaperOf } from "./wallpapers";

const W = 1920;
const H = 1080;

/** Форма волн одна на все цветовые варианты: [высота края, амплитуды, частоты, фазы]. */
const SHAPES: [number, number, number, number, number, number, number][] = [
  [0.34, 120, 60, 0.7, 1.9, 0.4, 2.1],
  [0.46, 140, 50, 0.9, 2.3, 2.2, 0.6],
  [0.58, 110, 70, 0.6, 1.7, 4.0, 1.3],
  [0.70, 130, 45, 1.0, 2.6, 1.1, 3.4],
  [0.83, 90, 40, 0.8, 2.0, 3.1, 0.2],
];

/** Верхний край волны: гладкая кривая через точки (Catmull-Rom → кубические Безье). */
function edge([base, a1, a2, f1, f2, p1, p2]: (typeof SHAPES)[number]) {
  const pts: [number, number][] = [];
  for (let x = -200; x <= W + 200; x += 80) {
    const t = (x / W) * Math.PI * 2;
    pts.push([x, base * H + a1 * Math.sin(t * f1 + p1) + a2 * Math.sin(t * f2 + p2)]);
  }
  let d = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1_, p2_, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1_[0] + (p2_[0] - p0[0]) / 6, p1_[1] + (p2_[1] - p0[1]) / 6];
    const c2 = [p2_[0] - (p3[0] - p1_[0]) / 6, p2_[1] - (p3[1] - p1_[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2_[0]},${p2_[1].toFixed(1)}`;
  }
  return d;
}

const EDGES = SHAPES.map(edge);
const FILLS = EDGES.map((d) => `${d} L${W + 200},${H + 40} L-200,${H + 40} Z`);

export const WallpaperArt = memo(function WallpaperArt({ id }: { id: string }) {
  const wp = wallpaperOf(id);
  const k = `wp-${id}`;
  return (
    <svg className="wallpaper-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${k}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={wp.sky[0]} />
          <stop offset="1" stopColor={wp.sky[1]} />
        </linearGradient>
        <radialGradient id={`${k}-glow`} cx="0.5" cy="0.1" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {wp.waves.map(([light, deep], i) => (
          <linearGradient key={i} id={`${k}-w${i}`} x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="0.55" stopColor={deep} />
            <stop offset="1" stopColor={deep} stopOpacity="0.95" />
          </linearGradient>
        ))}
        <filter id={`${k}-shadow`} x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <filter id={`${k}-soft`}>
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${k}-sky)`} />
      <rect width={W} height={H} fill={`url(#${k}-glow)`} />
      {FILLS.map((d, i) => (
        <g key={i}>
          {/* тень ложится на волну позади */}
          <path d={d} fill="#000" opacity="0.38" transform="translate(0,-14)" filter={`url(#${k}-shadow)`} />
          <path d={d} fill={`url(#${k}-w${i})`} />
          <path d={EDGES[i]} fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="2.5" filter={`url(#${k}-soft)`} />
        </g>
      ))}
    </svg>
  );
});

/** Обои с плавной сменой: новый слой проявляется поверх старого. */
export function Wallpaper({ id }: { id: string }) {
  const [layers, setLayers] = useState([id]);
  useEffect(() => {
    if (layers[layers.length - 1] === id) return;
    setLayers((l) => [l[l.length - 1], id]);
    const t = window.setTimeout(() => setLayers([id]), 750);
    return () => clearTimeout(t);
  }, [id]);
  return (
    <>
      {layers.map((w, i) => (
        <div key={w} className={"wallpaper" + (i > 0 ? " next" : "")}><WallpaperArt id={w} /></div>
      ))}
    </>
  );
}
