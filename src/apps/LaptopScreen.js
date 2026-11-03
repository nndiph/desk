import { MODES } from './FocusTimer.js';
import { ambience, timer } from './services.js';

// The laptop's "desktop": a focus timer and an ambient sound mixer, laid out
// at a fixed 1152×700 and projected onto the 3D screen while it's in focus.

export const SCREEN_SIZE = { width: 1152, height: 700 };

const ICONS = {
  rain: '<path d="M7 15a4 4 0 1 1 .9-7.9A5 5 0 0 1 17.5 9 3.5 3.5 0 0 1 17 16H7"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
  fire: '<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>',
};

function greeting(hour) {
  if (hour < 5) return 'still up?';
  if (hour < 12) return 'good morning.';
  if (hour < 18) return 'good afternoon.';
  return 'good evening.';
}

export class LaptopScreen {
  constructor({ wallpaperUrl }) {
    const el = document.createElement('div');
    el.className = 'lap';
    el.innerHTML = `
      <div class="lap__bg" style="background-image:url(${wallpaperUrl})"></div>
      <div class="lap__shade"></div>
      <header class="lap__bar">
        <span>☾&nbsp; desk</span>
        <span data-ref="clock"></span>
      </header>
      <div class="lap__hello">
        <h2 data-ref="greeting"></h2>
        <p>what are we working on tonight?</p>
      </div>
      <div class="lap__cards">
        <section class="lap__card">
          <div class="lap__modes">
            ${Object.entries(MODES)
              .map(([mode, { label }]) => `<button type="button" class="lap__chip" data-mode="${mode}">${label}</button>`)
              .join('')}
          </div>
          <div class="lap__time" data-ref="time"></div>
          <div class="lap__controls">
            <button type="button" class="lap__primary" data-ref="start"></button>
            <button type="button" class="lap__ghost" data-ref="reset">reset</button>
          </div>
          <div class="lap__sessions"><span class="lap__dots" data-ref="dots"></span><span data-ref="sessions"></span></div>
        </section>
        <section class="lap__card">
          <h3>sounds</h3>
          <p class="lap__muted">a little background for the late hours</p>
          ${Object.entries(ambience.channels)
            .map(
              ([name, { label }]) => `
            <div class="lap__sound" data-sound="${name}">
              <svg class="lap__icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>
              <span class="lap__name">${label}</span>
              <input type="range" min="0" max="100" aria-label="${label} volume" />
              <button type="button" class="lap__switch" role="switch" aria-label="${label}"><span></span></button>
            </div>`
            )
            .join('')}
        </section>
      </div>`;
    this.element = el;
    this.refs = Object.fromEntries([...el.querySelectorAll('[data-ref]')].map((n) => [n.dataset.ref, n]));

    el.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      if (target.dataset.mode) timer.setMode(target.dataset.mode);
      else if (target === this.refs.start) {
        ambience.ensure(); // unlock audio now, so the end-of-session chime can play
        timer.toggle();
      } else if (target === this.refs.reset) timer.reset();
      else if (target.classList.contains('lap__switch')) ambience.toggle(target.closest('[data-sound]').dataset.sound);
    });
    el.addEventListener('input', (e) => {
      const row = e.target.closest('[data-sound]');
      if (row) ambience.setVolume(row.dataset.sound, e.target.value / 100);
    });

    this.unsubscribe = [timer.onChange(() => this.renderTimer()), ambience.onChange(() => this.renderSounds())];
    this.renderTimer();
    this.renderSounds();
    this.renderClock();
  }

  renderTimer() {
    const { time, start, dots, sessions } = this.refs;
    time.textContent = timer.display;
    start.textContent = timer.running ? 'pause' : timer.started ? 'resume' : 'start';
    start.classList.toggle('is-running', timer.running);
    for (const chip of this.element.querySelectorAll('[data-mode]')) {
      chip.classList.toggle('is-active', chip.dataset.mode === timer.mode);
    }
    const filled = timer.sessions % 4 || (timer.sessions > 0 ? 4 : 0);
    dots.innerHTML = Array.from({ length: 4 }, (_, i) => `<i class="${i < filled ? 'is-on' : ''}"></i>`).join('');
    sessions.textContent = `${timer.sessions} focus ${timer.sessions === 1 ? 'session' : 'sessions'} today`;
  }

  renderSounds() {
    for (const row of this.element.querySelectorAll('[data-sound]')) {
      const channel = ambience.channels[row.dataset.sound];
      const toggle = row.querySelector('.lap__switch');
      toggle.setAttribute('aria-checked', String(channel.on));
      row.classList.toggle('is-on', channel.on);
      const range = row.querySelector('input');
      if (document.activeElement !== range) range.value = Math.round(channel.volume * 100);
    }
  }

  /** Clock and greeting in the menu bar; cheap enough to call every frame. */
  renderClock() {
    const now = new Date();
    const text = `${now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase()}  ·  ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (text !== this.clockText) {
      this.clockText = text;
      this.refs.clock.textContent = text;
      this.refs.greeting.textContent = greeting(now.getHours());
    }
  }

  dispose() {
    for (const off of this.unsubscribe) off();
  }
}
