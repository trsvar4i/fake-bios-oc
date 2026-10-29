// Звуки ПК, синтезированные через Web Audio (без записанных сэмплов):
// вентиляторы, гул БП, мотор и головки HDD, DVD-привод, PC speaker (POST-бип и сирена перегрева).
import { useSyncExternalStore } from "react";

const MUTE_KEY = "kestrel.muted";

function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private fanGain!: GainNode;
  private fanFilter!: BiquadFilterNode;
  private bladeOsc!: OscillatorNode;
  private bladeGain!: GainNode;
  private humGain!: GainNode;
  private hddOsc!: OscillatorNode;
  private hddGain!: GainNode;
  private powered = false;
  private spinupUntil = 0;
  private sirenTimer: number | null = null;
  private listeners = new Set<() => void>();
  muted = loadMuted();

  /** AudioContext можно создать только после действия пользователя — поэтому ПК включается кнопкой. */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // поток воздуха от вентиляторов
    this.fanFilter = ctx.createBiquadFilter();
    this.fanFilter.type = "bandpass";
    this.fanFilter.Q.value = 0.5;
    this.fanFilter.frequency.value = 300;
    const fanLow = ctx.createBiquadFilter();
    fanLow.type = "lowpass";
    fanLow.frequency.value = 3500;
    this.fanGain = ctx.createGain();
    this.fanGain.gain.value = 0;
    this.loopNoise().connect(this.fanFilter).connect(fanLow).connect(this.fanGain).connect(this.master);

    // тон лопастей: частота = обороты / 60 × 7 лопастей
    this.bladeOsc = ctx.createOscillator();
    this.bladeOsc.type = "triangle";
    this.bladeOsc.frequency.value = 5;
    this.bladeGain = ctx.createGain();
    this.bladeGain.gain.value = 0;
    this.bladeOsc.connect(this.bladeGain).connect(this.master);
    this.bladeOsc.start();

    // низкий гул блока питания и корпуса
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 140;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    this.loopNoise().connect(humFilter).connect(this.humGain).connect(this.master);

    // мотор HDD: 7200 об/мин = 120 Гц
    this.hddOsc = ctx.createOscillator();
    this.hddOsc.type = "sine";
    this.hddOsc.frequency.value = 5;
    this.hddGain = ctx.createGain();
    this.hddGain.gain.value = 0;
    this.hddOsc.connect(this.hddGain).connect(this.master);
    this.hddOsc.start();
    return ctx;
  }

  private loopNoise() {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(0, Math.random() * 1.9);
    return src;
  }

  /** Короткий щелчок: отфильтрованный шум с быстрым затуханием. */
  private burst(t: number, dur: number, freq: number, gain: number, type: BiquadFilterType = "bandpass") {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }

  /** Глухой удар (реле, механика). */
  private thump(t: number, freq: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  powerOn() {
    const ctx = this.ensure();
    if (!ctx) return;
    void ctx.resume();
    const t = ctx.currentTime;
    this.powered = true;
    this.spinupUntil = performance.now() + 1800; // при включении вентиляторы на миг выходят на максимум
    this.burst(t, 0.015, 2500, 0.5, "highpass");
    this.thump(t, 70, 0.12, 0.35);
    this.humGain.gain.setTargetAtTime(0.05, t, 0.2);
    this.hddOsc.frequency.cancelScheduledValues(t);
    this.hddOsc.frequency.setValueAtTime(5, t);
    this.hddOsc.frequency.exponentialRampToValueAtTime(120, t + 4);
    this.hddGain.gain.setTargetAtTime(0.012, t, 0.8);
  }

  powerOff() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.powered = false;
    this.sirenStop();
    this.burst(t, 0.012, 2500, 0.3, "highpass");
    this.fanGain.gain.setTargetAtTime(0, t, 0.8);
    this.bladeGain.gain.setTargetAtTime(0, t, 0.6);
    this.bladeOsc.frequency.setTargetAtTime(5, t, 0.8);
    this.humGain.gain.setTargetAtTime(0, t, 0.15);
    this.hddOsc.frequency.cancelScheduledValues(t);
    this.hddOsc.frequency.setTargetAtTime(5, t, 1.5);
    this.hddGain.gain.setTargetAtTime(0, t, 1.2);
  }

  /** Обновляется каждые 200 мс из тепловой модели. */
  setFan(rpm: number) {
    if (!this.ctx || !this.powered) return;
    const eff = performance.now() < this.spinupUntil ? 2300 : rpm;
    const x = Math.min(1, eff / 2400);
    const t = this.ctx.currentTime;
    this.fanGain.gain.setTargetAtTime(0.03 + 0.5 * x ** 1.7, t, 0.5);
    this.fanFilter.frequency.setTargetAtTime(250 + 1500 * x, t, 0.5);
    this.bladeOsc.frequency.setTargetAtTime(Math.max(5, (eff / 60) * 7), t, 0.5);
    this.bladeGain.gain.setTargetAtTime(0.004 + 0.02 * x, t, 0.5);
  }

  /** PC speaker: прямоугольная волна. */
  beep(freq = 1000, dur = 0.2, at = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.powered) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.003);
    g.gain.setValueAtTime(0.08, t + dur - 0.01);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Сирена перегрева: чередование высокого и низкого тона. */
  sirenStart() {
    this.sirenStop();
    const run = () => {
      for (let i = 0; i < 4; i++) {
        this.beep(1250, 0.24, i * 0.5);
        this.beep(750, 0.24, i * 0.5 + 0.25);
      }
    };
    run();
    this.sirenTimer = window.setInterval(run, 3000);
  }
  sirenStop() {
    if (this.sirenTimer !== null) clearInterval(this.sirenTimer);
    this.sirenTimer = null;
  }

  /** Позиционирование головок HDD: серия сухих щелчков. */
  hddSeek(n = 5) {
    const ctx = this.ctx;
    if (!ctx || !this.powered) return;
    let at = ctx.currentTime;
    for (let i = 0; i < n; i++) {
      at += 0.04 + Math.random() * 0.09;
      this.burst(at, 0.006, 2800 + Math.random() * 800, 0.22);
      this.burst(at + 0.002, 0.004, 1200, 0.1);
    }
  }

  /** DVD-привод: щелчки лазера, разгон и остановка диска. */
  dvdSpin() {
    const ctx = this.ctx;
    if (!ctx || !this.powered) return;
    const t = ctx.currentTime;
    this.burst(t, 0.01, 1800, 0.25);
    this.burst(t + 0.15, 0.01, 1800, 0.2);
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(40, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(260, t + 1.6);
    o.frequency.exponentialRampToValueAtTime(60, t + 3);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + 0.2);
    g.gain.linearRampToValueAtTime(0.05, t + 0.6);
    g.gain.setValueAtTime(0.05, t + 2.2);
    g.gain.linearRampToValueAtTime(0, t + 3);
    o.connect(f).connect(g).connect(this.master);
    o.start(t + 0.2);
    o.stop(t + 3.1);
  }

  /** Системные звуки ОС (через звуковую карту, а не PC speaker). */
  chime(kind: "startup" | "shutdown" | "notify" | "error") {
    const ctx = this.ctx;
    if (!ctx || !this.powered) return;
    const notes: Record<string, [number, number, number][]> = {
      startup: [[523.25, 0, 1.4], [659.25, 0.14, 1.3], [783.99, 0.28, 1.2], [1046.5, 0.42, 1.8]],
      shutdown: [[783.99, 0, 1.0], [659.25, 0.16, 1.0], [523.25, 0.32, 1.2], [392, 0.48, 1.6]],
      notify: [[880, 0, 0.35], [1318.5, 0.09, 0.6]],
      error: [[330, 0, 0.3], [262, 0.16, 0.5]],
    };
    const t0 = ctx.currentTime + 0.02;
    for (const [freq, at, dur] of notes[kind]) {
      const t = t0 + at;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(this.master);
      for (const [type, mul, vol] of [["sine", 1, 1], ["triangle", 0.5, 0.35]] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq * mul;
        const og = ctx.createGain();
        og.gain.value = vol;
        o.connect(og).connect(g);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* хранилище недоступно */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}

export const sound = new SoundEngine();

export const useMuted = () => useSyncExternalStore((cb) => sound.subscribe(cb), () => sound.muted);
