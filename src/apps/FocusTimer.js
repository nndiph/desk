import { load, save } from '../utils/persist.js';

export const MODES = {
  focus: { label: 'focus', minutes: 25 },
  short: { label: 'short break', minutes: 5 },
  long: { label: 'long break', minutes: 15 },
};

const today = () => new Date().toDateString();

/**
 * Pomodoro-style timer. Time is kept as an absolute end timestamp, so it stays
 * accurate in background tabs and survives a reload while running.
 * Listeners get ('change' | 'tick' | 'complete', timer, finishedMode?).
 */
export class FocusTimer {
  constructor() {
    const saved = load('timer', null);
    this.mode = MODES[saved?.mode] ? saved.mode : 'focus';
    this.endAt = saved?.running && saved.endAt > Date.now() ? saved.endAt : null;
    this.remaining = Number.isFinite(saved?.remaining) && saved.remaining > 0 ? saved.remaining : this.duration;
    this.sessions = saved?.day === today() ? saved.sessions ?? 0 : 0;
    this.listeners = new Set();
    this.shown = '';
  }

  get duration() {
    return MODES[this.mode].minutes * 60_000;
  }

  get running() {
    return this.endAt !== null;
  }

  get timeLeft() {
    return this.running ? Math.max(0, this.endAt - Date.now()) : this.remaining;
  }

  /** Running, or paused part-way through. */
  get started() {
    return this.running || this.remaining < this.duration;
  }

  get label() {
    return MODES[this.mode].label;
  }

  get display() {
    const total = Math.ceil(this.timeLeft / 1000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event, extra) {
    for (const fn of this.listeners) fn(event, this, extra);
  }

  start() {
    if (this.running) return;
    this.endAt = Date.now() + this.remaining;
    this.commit();
  }

  pause() {
    if (!this.running) return;
    this.remaining = this.timeLeft;
    this.endAt = null;
    this.commit();
  }

  toggle() {
    this.running ? this.pause() : this.start();
  }

  reset() {
    this.endAt = null;
    this.remaining = this.duration;
    this.commit();
  }

  setMode(mode) {
    this.mode = mode;
    this.reset();
  }

  /** Call every frame; cheap when idle. */
  tick() {
    if (!this.running) return;
    if (Date.now() >= this.endAt) {
      this.complete();
      return;
    }
    const shown = this.display;
    if (shown !== this.shown) {
      this.shown = shown;
      this.emit('tick');
    }
  }

  complete() {
    const finished = this.mode;
    this.endAt = null;
    if (finished === 'focus') {
      this.sessions += 1;
      this.mode = this.sessions % 4 === 0 ? 'long' : 'short';
    } else {
      this.mode = 'focus';
    }
    this.remaining = this.duration;
    this.persist();
    this.emit('complete', finished);
  }

  commit() {
    this.persist();
    this.emit('change');
  }

  persist() {
    save('timer', {
      mode: this.mode,
      remaining: this.remaining,
      running: this.running,
      endAt: this.endAt,
      sessions: this.sessions,
      day: today(),
    });
  }
}
