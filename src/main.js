import './apps/apps.css';
import { Experience } from './Experience.js';
import { FONTS } from './utils/paint.js';

const $ = (id) => document.getElementById(id);

const ui = {
  loader: $('loader'),
  hint: $('hint'),
  focus: $('focus'),
  focusTitle: $('focusTitle'),
  focusSub: $('focusSub'),
  backBtn: $('backBtn'),
  tooltip: $('tooltip'),
  arrangeBtn: $('arrangeBtn'),
  resetBtn: $('resetBtn'),
  setupChips: $('setupChips'),
  selbar: $('selbar'),
  selName: $('selName'),
  selRemove: $('selRemove'),
  toast: $('toast'),
  focusActions: $('focusActions'),
  timerChip: $('timerChip'),
  timerChipText: $('timerChipText'),
  photoInput: $('photoInput'),
  lightbox: $('lightbox'),
};

/** Notes and book spines are painted onto canvases, so their fonts must be ready first. */
function fontsReady() {
  const loads = [`600 40px ${FONTS.hand}`, `400 40px ${FONTS.serif}`, `300 40px ${FONTS.sans}`].map((font) =>
    document.fonts.load(font)
  );
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  return Promise.race([Promise.all(loads), timeout]).catch(() => {});
}

// setTimeout rather than rAF (which stalls in background tabs) so the loader
// paints before the procedural textures block the main thread
fontsReady().then(() =>
  setTimeout(() => {
    const experience = new Experience({ canvas: $('scene'), ui });
    experience.start();
    if (import.meta.env.DEV) window.experience = experience;
  }, 30)
);
