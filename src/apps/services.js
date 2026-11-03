import { Ambience } from './Ambience.js';
import { FocusTimer } from './FocusTimer.js';

// Shared across the whole desk: the timer keeps running and the sounds keep
// playing no matter which object is in focus (or whether the laptop is moved).

export const timer = new FocusTimer();
export const ambience = new Ambience();

timer.onChange((event) => {
  if (event === 'complete') ambience.chime();
});
