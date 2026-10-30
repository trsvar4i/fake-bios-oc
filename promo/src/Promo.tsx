// Промо-ролик Kestrel PC, 1920×1080, ≤30 с. Семь сцен; длина каждой — по длине её фразы озвучки (public/vo).
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Manrope";
import durations from "../public/vo/durations.json";

const { fontFamily } = loadFont("normal", { weights: ["500", "700", "800"], subsets: ["cyrillic", "latin"] });

export const FPS = 30;
const LEAD = 9; // пауза перед первой фразой
const GAP = 4; // воздух после каждой фразы
const LEN = (durations as number[]).map((d) => Math.round(d * FPS) + GAP);
const START = LEN.map((_, i) => LEAD + LEN.slice(0, i).reduce((a, b) => a + b, 0));
export const TOTAL_FRAMES = LEAD + LEN.reduce((a, b) => a + b, 0);

const ACC = "#5b8cff";
const VIO = "#9b6bff";
const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Фон: тёмное поле, два медленно плывущих световых пятна и тонкая сетка. */
function Backdrop() {
  const f = useCurrentFrame();
  const a = Math.sin(f / 70) * 120;
  const b = Math.cos(f / 90) * 140;
  return (
    <AbsoluteFill style={{ background: "#06080e", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1300, height: 1300, left: 900 + a, top: -500 + b, borderRadius: "50%", background: `radial-gradient(circle, ${ACC}55, transparent 62%)`, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", width: 1200, height: 1200, left: -420 - b, top: 300 + a / 2, borderRadius: "50%", background: `radial-gradient(circle, ${VIO}44, transparent 60%)`, filter: "blur(40px)" }} />
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)", backgroundSize: "64px 64px", backgroundPosition: `0 ${f * 0.6}px`, maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }} />
    </AbsoluteFill>
  );
}

/** Заголовок: слова «выпрыгивают» по очереди. */
function Headline({ text, size = 62, delay = 6, color = "#fff" }: { text: string; size?: number; delay?: number; color?: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1.5, color }}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: f - delay - i * 3, fps, config: { damping: 14, mass: 0.6 } });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.24, transform: `translateY(${(1 - s) * 50}px)`, opacity: s }}>{w}</span>
        );
      })}
    </div>
  );
}

function Label({ n, text }: { n: string; text: string }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: o, transform: `translateX(${(1 - o) * -30}px)`, marginBottom: 22 }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#06080e", background: ACC, borderRadius: 10, padding: "4px 12px" }}>{n}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,.65)", letterSpacing: 3, textTransform: "uppercase" }}>{text}</span>
    </div>
  );
}

function Chips({ items, delay = 18 }: { items: string[]; delay?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
      {items.map((x, i) => {
        const s = spring({ frame: f - delay - i * 4, fps, config: { damping: 16 } });
        return (
          <span key={x} style={{ fontSize: 24, fontWeight: 700, color: "#e9edff", padding: "10px 18px", borderRadius: 14, background: "rgba(91,140,255,.16)", boxShadow: "inset 0 0 0 1.5px rgba(91,140,255,.45)", opacity: s, transform: `scale(${0.8 + s * 0.2})` }}>{x}</span>
        );
      })}
    </div>
  );
}

/** Подсветка области на кадре (координаты в пикселях исходного кадра 1920×1080). */
interface Ring { x: number; y: number; w: number; h: number; from: number; color?: string; /** на каком кадре из shots (по умолчанию первом) */ shot?: number }

/**
 * «Монитор» с кадром сайта: въезжает в 3D, внутри медленно наезжает камера к точке фокуса.
 * Несколько кадров сменяются с вспышкой; glitch — дрожание и цветовое расслоение на смене.
 */
function Screen({ shots, switchAt = [], focus = [0.5, 0.5], zoom = 1.1, rings = [], glitch = false, len }: {
  shots: string[]; switchAt?: number[]; focus?: [number, number]; zoom?: number; rings?: Ring[]; glitch?: boolean; len: number;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 18, mass: 0.9 } });
  const W = 1280, H = 720;
  const idx = switchAt.filter((s) => f >= s).length;
  const since = f - (switchAt[idx - 1] ?? 0);
  const kb = interpolate(f, [0, len], [1, zoom], { easing: ease, extrapolateRight: "clamp" });
  const shake = glitch && idx > 0 && since < 12 ? Math.sin(since * 2.7) * (12 - since) * 1.6 : 0;
  const flash = idx > 0 ? interpolate(since, [0, 6], [glitch ? 0.85 : 0.55, 0], { extrapolateRight: "clamp" }) : 0;
  const img = (src: string, extra: CSSProperties = {}) => (
    <Img src={staticFile(`shots/${src}.png`)} style={{ position: "absolute", inset: 0, width: W, height: H, objectFit: "cover", transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`, transform: `scale(${kb})`, ...extra }} />
  );
  return (
    <div style={{ position: "absolute", left: 560, top: 170, width: W, height: H, perspective: 1800 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: 26, overflow: "hidden",
        transform: `translateX(${(1 - enter) * 260 + shake}px) translateY(${shake * 0.4}px) rotateY(${-22 * (1 - enter) - 7}deg) rotateX(${3 * (1 - enter) + 2}deg) scale(${0.86 + 0.14 * enter})`,
        opacity: enter, boxShadow: `0 0 0 2px rgba(255,255,255,.12), 0 40px 120px rgba(0,0,0,.7), 0 0 120px ${ACC}33`,
      }}>
        {img(shots[idx])}
        {glitch && idx > 0 && since < 10 && (
          <>
            {img(shots[idx], { mixBlendMode: "screen", opacity: 0.5, filter: "sepia(1) hue-rotate(-50deg) saturate(6)", translate: `${(10 - since) * 2.2}px 0` })}
            {img(shots[idx], { mixBlendMode: "screen", opacity: 0.5, filter: "sepia(1) hue-rotate(170deg) saturate(6)", translate: `${-(10 - since) * 2.2}px 0` })}
          </>
        )}
        {rings.filter((r) => f >= r.from && (r.shot ?? 0) === idx).map((r, i) => {
          const s = spring({ frame: f - r.from, fps, config: { damping: 12 } });
          const pulse = 0.6 + 0.4 * Math.sin((f - r.from) / 5);
          const k = W / 1920;
          // кольцо следует за наездом камеры
          const cx = (v: number, o: number) => o + (v * k - o) * kb;
          const ox = focus[0] * W, oy = focus[1] * H;
          return (
            <div key={i} style={{ position: "absolute", left: cx(r.x, ox) - 8, top: cx(r.y, oy) - 8, width: r.w * k * kb + 16, height: r.h * k * kb + 16, borderRadius: 14,
              boxShadow: `0 0 0 ${3 + 2 * pulse}px ${r.color ?? ACC}, 0 0 40px ${r.color ?? ACC}`, opacity: s, transform: `scale(${1.25 - 0.25 * s})` }} />
          );
        })}
        <AbsoluteFill style={{ background: glitch ? "#ff3b30" : "#fff", opacity: flash, mixBlendMode: "screen" }} />
        <AbsoluteFill style={{ background: "linear-gradient(120deg, rgba(255,255,255,.10), transparent 35%)" }} />
      </div>
    </div>
  );
}

/** Сцена: подпись слева, «монитор» справа, мягкий вход и выход. */
function Scene({ len, children }: { len: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const out = interpolate(f, [len - 7, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: out, transform: `scale(${1 + (1 - out) * 0.04})`, filter: `blur(${(1 - out) * 8}px)` }}>{children}</AbsoluteFill>;
}

const Caption = ({ children }: { children: ReactNode }) => (
  <div style={{ position: "absolute", left: 90, top: 0, bottom: 0, width: 440, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
);

function Logo({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"><path d="M4 12 20 4l-5 16-3-7z" fill={ACC} /></svg>
  );
}

/** 0 — вступление: кнопка питания вспыхивает, появляется название. */
function Intro({ len }: { len: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 13 } });
  const glow = interpolate(f, [0, 10, 30], [0, 1, 0.35], { extrapolateRight: "clamp" });
  const letters = "KESTREL PC".split("");
  return (
    <Scene len={len}>
      <AbsoluteFill style={{ opacity: 0.35 * glow + 0.1 }}>
        <Img src={staticFile("shots/01-power.png")} style={{ width: "100%", height: "100%", filter: "blur(6px) brightness(1.4)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ transform: `scale(${0.4 + s * 0.6}) rotate(${(1 - s) * -40}deg)`, filter: `drop-shadow(0 0 ${40 * glow}px ${ACC})` }}><Logo size={150} /></div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 132, fontWeight: 800, letterSpacing: 10, color: "#fff" }}>
          {letters.map((ch, i) => {
            const k = spring({ frame: f - 10 - i * 2, fps, config: { damping: 14 } });
            return <span key={i} style={{ display: "inline-block", width: ch === " " ? 40 : undefined, opacity: k, transform: `translateY(${(1 - k) * 60}px)`, color: i > 7 ? ACC : "#fff" }}>{ch}</span>;
          })}
        </div>
        <div style={{ marginTop: 18 }}><Headline text="Целый компьютер в браузере" size={52} delay={26} color="rgba(255,255,255,.8)" /></div>
      </AbsoluteFill>
    </Scene>
  );
}

/** 6 — финал: логотип, адрес, что внутри. */
function Outro({ len }: { len: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 15 } });
  const url = spring({ frame: f - 16, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, transform: `scale(${0.7 + 0.3 * s})`, opacity: s }}>
        <Logo size={110} />
        <span style={{ fontSize: 120, fontWeight: 800, color: "#fff", letterSpacing: 4 }}>Kestrel <span style={{ color: ACC }}>PC</span></span>
      </div>
      <div style={{ marginTop: 22 }}><Headline text="Ломайте смело — это не ваш компьютер" size={46} delay={8} color="rgba(255,255,255,.75)" /></div>
      <div style={{ marginTop: 40, fontSize: 54, fontWeight: 800, color: "#fff", padding: "18px 40px", borderRadius: 22, background: `linear-gradient(90deg, ${ACC}, ${VIO})`, opacity: url, transform: `translateY(${(1 - url) * 40}px)`, boxShadow: `0 20px 80px ${ACC}66` }}>
        kestrel-pc.vercel.app
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Chips items={["UEFI BIOS", "Kestrel OS", "8 уроков", "30 заданий", "Класс онлайн"]} delay={26} />
      </div>
    </AbsoluteFill>
  );
}

/** Прогресс по сценам внизу. */
function Progress() {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 90, right: 90, bottom: 52, display: "flex", gap: 10 }}>
      {LEN.map((len, i) => {
        const p = interpolate(f, [START[i], START[i] + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={i} style={{ flex: len, height: 5, borderRadius: 3, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
          <div style={{ width: `${p * 100}%`, height: "100%", background: `linear-gradient(90deg, ${ACC}, ${VIO})` }} />
        </div>;
      })}
    </div>
  );
}

export function Promo() {
  const f = useCurrentFrame();
  const music = (fr: number) => interpolate(fr, [0, 12, TOTAL_FRAMES - 40, TOTAL_FRAMES], [0, 0.32, 0.32, 0], { extrapolateRight: "clamp" });
  const scenes: ReactNode[] = [
    <Intro len={LEN[0]} />,
    <Scene len={LEN[1]}>
      <Caption><Label n="01" text="Включение" /><Headline text="POST и настоящий UEFI BIOS" /><Chips items={["EZ Mode", "Advanced", "F7"]} /></Caption>
      <Screen shots={["02-post", "03-bios-ez"]} switchAt={[Math.round(LEN[1] * 0.38)]} focus={[0.3, 0.45]} zoom={1.12} len={LEN[1]} />
    </Scene>,
    <Scene len={LEN[2]}>
      <Caption><Label n="02" text="Разгон" /><Headline text="Разгон с последствиями" /><Chips items={["5,2 ГГц", "Vcore", "Сбой ОС"]} /></Caption>
      <Screen shots={["04-bios-tweaker", "05-crash"]} switchAt={[Math.round(LEN[2] * 0.55)]} focus={[0.4, 0.3]} zoom={1.18} glitch len={LEN[2]}
        rings={[{ x: 740, y: 312, w: 150, h: 38, from: 10, color: "#ffb340" }]} />
    </Scene>,
    <Scene len={LEN[3]}>
      <Caption><Label n="03" text="Kestrel OS" /><Headline text="Своя операционная система" /><Chips items={["Окна", "20 программ", "Виртуальные машины"]} /></Caption>
      <Screen shots={["06-desktop"]} focus={[0.55, 0.4]} zoom={1.14} len={LEN[3]} />
    </Scene>,
    <Scene len={LEN[4]}>
      <Caption><Label n="04" text="Обучение" /><Headline text="Уроки и поломки на время" /><Chips items={["Автопроверка", "Очки", "Подсказки"]} /></Caption>
      <Screen shots={["07-learn"]} focus={[0.15, 0.75]} zoom={1.25} len={LEN[4]} rings={[{ x: 28, y: 540, w: 420, h: 455, from: 12 }]} />
    </Scene>,
    <Scene len={LEN[5]}>
      <Caption><Label n="05" text="Кабинет учителя" /><Headline text="Весь класс на одном экране" /><Chips items={["Живые экраны", "Удалённое управление", "30 заданий", "Excel"]} /></Caption>
      <Screen shots={["08-teacher", "09-library"]} switchAt={[Math.round(LEN[5] * 0.55)]} focus={[0.5, 0.62]} zoom={1.12} len={LEN[5]}
        rings={[{ x: 363, y: 707, w: 291, h: 187, from: 14, color: "#ff5a52" }, { x: 965, y: 707, w: 291, h: 187, from: 18, color: "#ff5a52" }]} />
    </Scene>,
    <Scene len={LEN[6] + 30}><Outro len={LEN[6]} /></Scene>,
  ];
  return (
    <AbsoluteFill style={{ fontFamily, background: "#06080e" }}>
      <Backdrop />
      <Audio src={staticFile("music.wav")} volume={music} />
      {scenes.map((node, i) => (
        <Sequence key={i} from={START[i]} durationInFrames={i === 6 ? TOTAL_FRAMES - START[i] : LEN[i]}>
          {node}
          <Audio src={staticFile(`vo/${i}.mp3`)} volume={1} />
        </Sequence>
      ))}
      {f < START[6] && <Progress />}
    </AbsoluteFill>
  );
}
