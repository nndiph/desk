import { load, save } from '../utils/persist.js';

// Ambient sounds synthesised with the Web Audio API — no audio files needed.
// Each channel is a small graph of looping noise and filters, built when it's
// switched on and torn down (after a fade) when it's switched off.

const CHANNELS = {
  rain: { label: 'rain', level: 0.5, volume: 0.6 },
  fire: { label: 'fireplace', level: 0.75, volume: 0.5 },
  wind: { label: 'night breeze', level: 0.7, volume: 0.45 },
};

function noiseBuffer(ctx, kind) {
  const length = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

export class Ambience {
  constructor() {
    const volumes = load('sounds', {});
    this.channels = Object.fromEntries(
      Object.entries(CHANNELS).map(([name, c]) => [
        name,
        { ...c, on: false, volume: Number.isFinite(volumes[name]) ? volumes[name] : c.volume, graph: null },
      ])
    );
    this.ctx = null;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }

  /** Create/resume the audio context. Must first run inside a user gesture. */
  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.white = noiseBuffer(this.ctx, 'white');
      this.brown = noiseBuffer(this.ctx, 'brown');
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggle(name) {
    this.set(name, !this.channels[name].on);
  }

  set(name, on) {
    const channel = this.channels[name];
    if (channel.on === on || !this.ensure()) return;
    channel.on = on;
    on ? this.startChannel(name) : this.stopChannel(name);
    this.emit();
  }

  setVolume(name, volume) {
    const channel = this.channels[name];
    channel.volume = volume;
    if (channel.graph) channel.graph.out.gain.setTargetAtTime(volume * channel.level, this.ctx.currentTime, 0.1);
    save('sounds', Object.fromEntries(Object.entries(this.channels).map(([n, c]) => [n, c.volume])));
    this.emit();
  }

  stopAll() {
    for (const name of Object.keys(this.channels)) this.set(name, false);
  }

  loop(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0, Math.random() * buffer.duration);
    return src;
  }

  filter(type, frequency, Q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = Q;
    return f;
  }

  startChannel(name) {
    const { ctx } = this;
    const channel = this.channels[name];
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    out.gain.setTargetAtTime(channel.volume * channel.level, ctx.currentTime, 0.6);
    const sources = [];
    let interval = null;

    if (name === 'rain') {
      // hiss of the rain plus a soft low rumble
      const hiss = this.loop(this.white);
      hiss.connect(this.filter('highpass', 500)).connect(this.filter('lowpass', 6500)).connect(out);
      const rumble = this.loop(this.brown);
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.5;
      rumble.connect(this.filter('lowpass', 400)).connect(rumbleGain).connect(out);
      sources.push(hiss, rumble);
    } else if (name === 'fire') {
      const roar = this.loop(this.brown);
      roar.connect(this.filter('lowpass', 900)).connect(out);
      sources.push(roar);
      // random crackles: tiny bursts of bright noise
      interval = setInterval(() => {
        if (Math.random() > 0.55) return;
        const t = ctx.currentTime + Math.random() * 0.08;
        const pop = ctx.createBufferSource();
        pop.buffer = this.white;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.6, t + 0.002);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.015 + Math.random() * 0.04);
        pop.connect(this.filter('highpass', 1600 + Math.random() * 2000)).connect(env).connect(out);
        pop.start(t, Math.random() * 2, 0.08);
      }, 90);
    } else {
      // breeze: band-passed brown noise whose pitch and loudness drift slowly
      const air = this.loop(this.brown);
      const band = this.filter('bandpass', 450, 0.8);
      const swell = ctx.createGain();
      swell.gain.value = 0.75;
      air.connect(band).connect(swell).connect(out);
      const pitchLfo = ctx.createOscillator();
      pitchLfo.frequency.value = 0.07;
      const pitchDepth = ctx.createGain();
      pitchDepth.gain.value = 260;
      pitchLfo.connect(pitchDepth).connect(band.frequency);
      const swellLfo = ctx.createOscillator();
      swellLfo.frequency.value = 0.11;
      const swellDepth = ctx.createGain();
      swellDepth.gain.value = 0.25;
      swellLfo.connect(swellDepth).connect(swell.gain);
      pitchLfo.start();
      swellLfo.start();
      sources.push(air, pitchLfo, swellLfo);
    }

    channel.graph = { out, sources, interval };
  }

  stopChannel(name) {
    const channel = this.channels[name];
    const graph = channel.graph;
    if (!graph) return;
    channel.graph = null;
    clearInterval(graph.interval);
    graph.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    setTimeout(() => {
      for (const src of graph.sources) src.stop();
      graph.out.disconnect();
    }, 800);
  }

  /** Soft two-note bell for the end of a timer. */
  chime() {
    const ctx = this.ensure();
    if (!ctx) return;
    [659.25, 987.77].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.18, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      osc.connect(env).connect(this.master);
      osc.start(t);
      osc.stop(t + 2.5);
    });
  }
}
