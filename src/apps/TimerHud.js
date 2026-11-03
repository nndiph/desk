import { timer } from './services.js';

const TITLE = 'Cozy Desk Studio';

/**
 * Little pill at the top of the page while a focus session is under way, so the
 * countdown stays visible after you leave the laptop. Clicking it opens the laptop.
 */
export class TimerHud {
  constructor({ element, label, onOpen, isSuppressed }) {
    this.element = element;
    this.label = label;
    this.isSuppressed = isSuppressed;
    element.addEventListener('click', onOpen);
    timer.onChange((event, _t, finished) => {
      if (event === 'complete') this.flash(finished === 'focus' ? 'time for a little break ☕' : 'break’s over — back to it');
      this.render();
    });
    this.render();
  }

  flash(message) {
    this.message = message;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.message = null;
      this.render();
    }, 6000);
  }

  render() {
    const show = Boolean(this.message) || (timer.started && !this.isSuppressed());
    this.element.classList.toggle('is-visible', show);
    this.element.classList.toggle('is-paused', !timer.running);
    this.label.textContent = this.message ?? `${timer.label} · ${timer.display}${timer.running ? '' : ' · paused'}`;
    document.title = timer.running ? `${timer.display} · ${timer.label} — ${TITLE}` : TITLE;
  }
}
