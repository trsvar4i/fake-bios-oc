import { useEffect, useRef, useState } from "react";
import { useLang } from "../../machine/store";
import { playOs } from "../power";
import { useNow } from "../util";

const CITIES: [string, string, string][] = [
  ["Europe/London", "London", "Лондон"],
  ["America/New_York", "New York", "Нью-Йорк"],
  ["Asia/Tokyo", "Tokyo", "Токио"],
  ["Asia/Dubai", "Dubai", "Дубай"],
];

/** Аналоговый циферблат: стрелки по времени `d` (в часовом поясе `tz`). */
export function Dial({ d, tz, size = 120 }: { d: Date; tz?: string; size?: number }) {
  const [h, m, s] = d.toLocaleTimeString("en-GB", { timeZone: tz, hour12: false }).split(":").map(Number);
  const night = h < 6 || h >= 19;
  const hand = (deg: number, len: number, w: number, cls: string) => (
    <line className={cls} x1="50" y1="50" x2={50 + len * Math.sin((deg * Math.PI) / 180)} y2={50 - len * Math.cos((deg * Math.PI) / 180)} strokeWidth={w} />
  );
  return (
    <svg className={"dial" + (night ? " night" : "")} viewBox="0 0 100 100" width={size} height={size}>
      <circle cx="50" cy="50" r="48" className="dial-face" />
      {Array.from({ length: 12 }, (_, i) => (
        <text key={i} x={50 + 37 * Math.sin((i + 1) * Math.PI / 6)} y={50 - 37 * Math.cos((i + 1) * Math.PI / 6) + 4} className="dial-num">{i + 1}</text>
      ))}
      {hand(((h % 12) + m / 60) * 30, 22, 4, "dial-h")}
      {hand((m + s / 60) * 6, 33, 3, "dial-m")}
      {hand(s * 6, 38, 1.2, "dial-s")}
      <circle cx="50" cy="50" r="2.6" className="dial-pin" />
    </svg>
  );
}

const fmt = (ms: number) => {
  const cs = Math.floor(ms / 10) % 100, sec = Math.floor(ms / 1000) % 60, min = Math.floor(ms / 60000);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(cs).padStart(2, "0")}`;
};

/** Часы: мировое время, секундомер, таймер. */
export function Clock() {
  const { t } = useLang();
  const [tab, setTab] = useState<"world" | "stopwatch" | "timer">("world");
  return (
    <div className="clockapp">
      <div className="tm-tabs">
        <button className={tab === "world" ? "on" : ""} onClick={() => setTab("world")}>{t("World Clock", "Мировые часы")}</button>
        <button className={tab === "stopwatch" ? "on" : ""} onClick={() => setTab("stopwatch")}>{t("Stopwatch", "Секундомер")}</button>
        <button className={tab === "timer" ? "on" : ""} onClick={() => setTab("timer")}>{t("Timer", "Таймер")}</button>
      </div>
      {tab === "world" && <World />}
      {tab === "stopwatch" && <Stopwatch />}
      {tab === "timer" && <Timer />}
    </div>
  );
}

function World() {
  const { t, lang } = useLang();
  const now = useNow();
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const list: [string | undefined, string][] = [[undefined, t("Local time", "Местное время") + " · " + here.split("/").pop()!.replace("_", " ")], ...CITIES.map(([tz, en, ru]) => [tz, lang === "ru" ? ru : en] as [string, string])];
  return (
    <div className="cl-world page">
      {list.map(([tz, name]) => (
        <div key={name} className="cl-city">
          <Dial d={now} tz={tz} size={110} />
          <div className="cl-name">{name}</div>
          <div className="cl-time">{now.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      ))}
    </div>
  );
}

function Stopwatch() {
  const { t } = useLang();
  const [start, setStart] = useState<number | null>(null);
  const [base, setBase] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (start === null) return;
    const id = window.setInterval(() => tick((n) => n + 1), 31);
    return () => clearInterval(id);
  }, [start]);
  const elapsed = base + (start !== null ? Date.now() - start : 0);
  return (
    <div className="cl-stop page">
      <div className="cl-big">{fmt(elapsed)}</div>
      <div className="cl-btns">
        <button className="cl-round" disabled={start === null && !elapsed} onClick={() => (start !== null ? setLaps([elapsed, ...laps]) : (setBase(0), setLaps([])))}>
          {start !== null || !elapsed ? t("Lap", "Круг") : t("Reset", "Сброс")}
        </button>
        <button className={"cl-round " + (start !== null ? "stop" : "go")} onClick={() => (start !== null ? (setBase(elapsed), setStart(null)) : setStart(Date.now()))}>
          {start !== null ? t("Stop", "Стоп") : t("Start", "Старт")}
        </button>
      </div>
      <div className="cl-laps">
        {laps.map((l, i) => <div key={i}><span>{t("Lap", "Круг")} {laps.length - i}</span><span>{fmt(l - (laps[i + 1] ?? 0))}</span></div>)}
      </div>
    </div>
  );
}

function Timer() {
  const { t } = useLang();
  const [total, setTotal] = useState(5 * 60);
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const end = useRef(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const ms = Math.max(0, end.current - Date.now());
      setLeft(ms);
      if (ms === 0) { setRunning(false); playOs("notify"); }
    }, 100);
    return () => clearInterval(id);
  }, [running]);
  const shown = left ?? total * 1000;
  const sec = Math.ceil(shown / 1000);
  const label = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  const progress = left === null ? 1 : shown / (total * 1000);
  return (
    <div className="cl-timer page">
      {left === null ? (
        <div className="cl-presets">
          {[1, 3, 5, 10, 15, 30].map((m) => (
            <button key={m} className={"cl-preset" + (total === m * 60 ? " on" : "")} onClick={() => setTotal(m * 60)}>{m} {t("min", "мин")}</button>
          ))}
        </div>
      ) : (
        <svg className="cl-ring" viewBox="0 0 120 120" width="230" height="230">
          <circle cx="60" cy="60" r="54" className="cl-ring-track" />
          <circle cx="60" cy="60" r="54" className="cl-ring-arc" style={{ strokeDashoffset: 339.3 * (1 - progress) }} />
        </svg>
      )}
      <div className={"cl-big" + (left === 0 ? " done" : "")}>{left === 0 ? t("Done", "Готово") : label}</div>
      <div className="cl-btns">
        <button className="cl-round" disabled={left === null} onClick={() => { setRunning(false); setLeft(null); }}>{t("Cancel", "Отмена")}</button>
        <button
          className={"cl-round " + (running ? "pause" : "go")}
          disabled={left === 0}
          onClick={() => {
            if (running) { setRunning(false); return; }
            end.current = Date.now() + (left ?? total * 1000);
            if (left === null) setLeft(total * 1000);
            setRunning(true);
          }}
        >
          {running ? t("Pause", "Пауза") : left === null ? t("Start", "Старт") : t("Resume", "Продолжить")}
        </button>
      </div>
    </div>
  );
}
