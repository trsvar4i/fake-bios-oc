import { useEffect, useState } from "react";
import { create } from "zustand";
import { useLang } from "../../machine/store";
import { playOs } from "../power";
import { useOs } from "../osStore";
import { useNow, useTimeFormat } from "../util";
import "./Clock.css";

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
  const fmt = useTimeFormat();
  const list: [string | undefined, string][] = [[undefined, t("Local time", "Местное время") + " · " + here.split("/").pop()!.replace("_", " ")], ...CITIES.map(([tz, en, ru]) => [tz, lang === "ru" ? ru : en] as [string, string])];
  return (
    <div className="cl-world page">
      {list.map(([tz, name]) => (
        <div key={name} className="cl-city">
          <Dial d={now} tz={tz} size={110} />
          <div className="cl-name">{name}</div>
          <div className="cl-time">{fmt(now, tz)}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Секундомер и таймер живут вне окна: идут, даже если закрыть «Часы».
 * Таймер по окончании присылает уведомление (см. useTimerService).
 */
interface ClockState {
  swStart: number | null;
  swBase: number;
  laps: number[];
  /** длительность таймера, с */
  total: number;
  /** когда таймер закончится (идёт) */
  end: number | null;
  /** сколько осталось, мс: на паузе или 0 по окончании; null — таймер не запущен */
  left: number | null;
}
export const useClockState = create<ClockState>(() => ({ swStart: null, swBase: 0, laps: [], total: 5 * 60, end: null, left: null }));
const setClock = useClockState.setState;

/** Остаток таймера сейчас, мс (null — не запущен). */
export const timerLeft = (c: ClockState) => (c.end !== null ? Math.max(0, c.end - Date.now()) : c.left);

/** Следит за таймером во всей системе: по окончании — звук и уведомление. */
export function useTimerService() {
  const end = useClockState((c) => c.end);
  const { t } = useLang();
  useEffect(() => {
    if (end === null) return;
    const id = window.setTimeout(() => {
      setClock({ end: null, left: 0 });
      playOs("notify");
      useOs.getState().notify("clock", t("Timer", "Таймер"), t("Time is up", "Время вышло"));
    }, Math.max(0, end - Date.now()));
    return () => clearTimeout(id);
  }, [end]);
}

/** Перерисовка с частотой `ms`, пока `on`. */
function useTicker(on: boolean, ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [on, ms]);
}

function Stopwatch() {
  const { t } = useLang();
  const { swStart: start, swBase: base, laps } = useClockState();
  useTicker(start !== null, 31);
  const elapsed = base + (start !== null ? Date.now() - start : 0);
  return (
    <div className="cl-stop page">
      <div className="cl-big">{fmt(elapsed)}</div>
      <div className="cl-btns">
        <button className="cl-round" disabled={start === null && !elapsed} onClick={() => (start !== null ? setClock({ laps: [elapsed, ...laps] }) : setClock({ swBase: 0, laps: [] }))}>
          {start !== null || !elapsed ? t("Lap", "Круг") : t("Reset", "Сброс")}
        </button>
        <button className={"cl-round " + (start !== null ? "stop" : "go")} onClick={() => (start !== null ? setClock({ swBase: elapsed, swStart: null }) : setClock({ swStart: Date.now() }))}>
          {start !== null ? t("Stop", "Стоп") : t("Start", "Старт")}
        </button>
      </div>
      <div className="cl-laps">
        {laps.map((l, i) => <div key={i}><span>{t("Lap", "Круг")} {laps.length - i}</span><span>{fmt(l - (laps[i + 1] ?? 0))}</span></div>)}
      </div>
    </div>
  );
}

export const fmtTimer = (ms: number) => {
  const sec = Math.ceil(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
};

function Timer() {
  const { t } = useLang();
  const c = useClockState();
  const running = c.end !== null;
  useTicker(running, 100);
  const left = timerLeft(c);
  const shown = left ?? c.total * 1000;
  const progress = left === null ? 1 : shown / (c.total * 1000);
  return (
    <div className="cl-timer page">
      {left === null ? (
        <div className="cl-presets">
          {[1, 3, 5, 10, 15, 30].map((m) => (
            <button key={m} className={"cl-preset" + (c.total === m * 60 ? " on" : "")} onClick={() => setClock({ total: m * 60 })}>{m} {t("min", "мин")}</button>
          ))}
        </div>
      ) : (
        <svg className="cl-ring" viewBox="0 0 120 120" width="230" height="230">
          <circle cx="60" cy="60" r="54" className="cl-ring-track" />
          <circle cx="60" cy="60" r="54" className="cl-ring-arc" style={{ strokeDashoffset: 339.3 * (1 - progress) }} />
        </svg>
      )}
      <div className={"cl-big" + (left === 0 ? " done" : "")}>{left === 0 ? t("Done", "Готово") : fmtTimer(shown)}</div>
      <div className="cl-btns">
        <button className="cl-round" disabled={left === null} onClick={() => setClock({ end: null, left: null })}>{t("Cancel", "Отмена")}</button>
        <button
          className={"cl-round " + (running ? "pause" : "go")}
          disabled={left === 0}
          onClick={() => (running ? setClock({ end: null, left }) : setClock({ end: Date.now() + (left ?? c.total * 1000), left: null }))}
        >
          {running ? t("Pause", "Пауза") : left === null ? t("Start", "Старт") : t("Resume", "Продолжить")}
        </button>
      </div>
    </div>
  );
}
