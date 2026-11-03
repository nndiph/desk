// Small JSON store in this browser's localStorage. Every access is guarded:
// storage can be missing or blocked (private mode, cleared site data), and the
// desk must still work — it just won't remember anything.

const PREFIX = 'cozy-desk/';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // not persisted this time
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // nothing to remove
  }
}
