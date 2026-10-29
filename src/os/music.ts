// Музыкальный плеер: синтезатор на Web Audio играет свои треки (аккорды, бас, мелодия).
// Громкость — общая системная; без звуковой карты (HD Audio выключен в BIOS) играть нечем.
import { create } from "zustand";
import { sound } from "../machine/audio";
import { useStore } from "../machine/store";

export interface Track { title: string; artist: string; bpm: number; color: string; chords: number[][]; melody: (number | null)[] }

const C = (root: number, minor = false) => [root, root + (minor ? 3 : 4), root + 7];
export const TRACKS: Track[] = [
  { title: "Glass Islands", artist: "Kestrel", bpm: 96, color: "#5e5ce6",
    chords: [C(57, true), C(53), C(48), C(55)],
    melody: [69, null, 72, 74, 76, null, 74, 72, 69, null, 67, 69, 72, null, null, null] },
  { title: "POST Beep Blues", artist: "Nightfall", bpm: 112, color: "#ff9f0a",
    chords: [C(48), C(53), C(55), C(53)],
    melody: [72, 75, 76, null, 79, null, 76, 75, 72, null, 70, 72, null, 67, null, null] },
  { title: "Fan Curve", artist: "Kestrel", bpm: 84, color: "#30d158",
    chords: [C(50, true), C(46), C(53), C(48)],
    melody: [74, null, null, 77, 76, null, 74, null, 72, null, 74, null, 69, null, null, null] },
];

interface MusicState { track: number; playing: boolean; startedAt: number; elapsed: number }
export const useMusic = create<MusicState>(() => ({ track: 0, playing: false, startedAt: 0, elapsed: 0 }));

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let nextAt = 0;

/** Уровень громкости плеера: системная громкость, без звука — тишина. */
function level() {
  const on = useStore.getState().saved.hdAudio && !sound.muted;
  return on ? 0.22 * sound.volume : 0;
}
sound.subscribe(() => { if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05); });

function note(freq: number, at: number, dur: number, type: OscillatorType, gain: number) {
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** Планировщик: шестнадцатые доли с запасом в 0.2 с, чтобы звук не заикался. */
function schedule() {
  const tr = TRACKS[useMusic.getState().track];
  const sixteenth = 60 / tr.bpm / 4;
  while (nextAt < ctx!.currentTime + 0.2) {
    const bar = Math.floor(step / 16) % tr.chords.length;
    const s = step % 16;
    if (s === 0) tr.chords[bar].forEach((n) => note(midi(n), nextAt, sixteenth * 15, "triangle", 0.09));
    if (s % 4 === 0) note(midi(tr.chords[bar][0] - 12), nextAt, sixteenth * 3, "sine", 0.22);
    const m = tr.melody[s];
    if (m !== null && m !== undefined) note(midi(m), nextAt, sixteenth * 1.8, "square", 0.045);
    if (s % 2 === 1) note(6000, nextAt, 0.03, "square", 0.008);
    nextAt += sixteenth;
    step++;
  }
}

export const music = {
  play() {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    void ctx!.resume();
    master!.gain.value = level();
    nextAt = ctx!.currentTime + 0.05;
    if (timer === null) timer = window.setInterval(schedule, 50);
    useMusic.setState({ playing: true, startedAt: Date.now() - useMusic.getState().elapsed });
  },
  pause() {
    if (timer !== null) { clearInterval(timer); timer = null; }
    const s = useMusic.getState();
    useMusic.setState({ playing: false, elapsed: Date.now() - s.startedAt });
  },
  select(i: number) {
    const was = useMusic.getState().playing;
    if (was) this.pause();
    step = 0;
    useMusic.setState({ track: (i + TRACKS.length) % TRACKS.length, elapsed: 0 });
    if (was) this.play();
  },
};
