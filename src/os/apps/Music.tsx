import { useEffect, useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { TRACKS, music, useMusic } from "../music";
import "./Music.css";

const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** Музыка: обложка, play/pause, список треков. Играет и при закрытом окне. */
export function Music() {
  const { t } = useLang();
  const m = useMusic();
  const hdAudio = useStore((s) => s.saved.hdAudio);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!m.playing) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [m.playing]);
  const tr = TRACKS[m.track];
  const elapsed = m.playing ? Date.now() - m.startedAt : m.elapsed;

  return (
    <div className="music">
      <div className="mu-now">
        <div className={"mu-cover" + (m.playing ? " spin" : "")} style={{ background: `radial-gradient(circle at 30% 30%, ${tr.color}, #111 75%)` }}>
          <div className="mu-hole" />
        </div>
        <div className="mu-title">{tr.title}</div>
        <div className="mu-artist">{tr.artist} · {tr.bpm} BPM</div>
        <div className="mu-time">{fmt(elapsed)}</div>
        <div className="mu-ctrl">
          <button onClick={() => music.select(m.track - 1)} aria-label="Previous">⏮</button>
          <button className="mu-play" disabled={!hdAudio} onClick={() => (m.playing ? music.pause() : music.play())} aria-label="Play">{m.playing ? "❚❚" : "▶"}</button>
          <button onClick={() => music.select(m.track + 1)} aria-label="Next">⏭</button>
        </div>
        {!hdAudio && <div className="set-warn mu-warn">{t("No sound card: HD Audio is disabled in BIOS.", "Нет звуковой карты: HD Audio выключен в BIOS.")}</div>}
      </div>
      <div className="mu-list">
        <div className="mu-head">{t("Library", "Медиатека")}</div>
        {TRACKS.map((x, i) => (
          <button key={x.title} className={"mu-row" + (i === m.track ? " on" : "")} onClick={() => music.select(i)} onDoubleClick={() => { music.select(i); music.play(); }}>
            <i style={{ background: x.color }} />
            <span>{x.title}<small>{x.artist}</small></span>
            {i === m.track && m.playing && <b className="mu-eq"><em /><em /><em /></b>}
          </button>
        ))}
      </div>
    </div>
  );
}
