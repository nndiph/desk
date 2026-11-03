import { load, remove, save } from '../utils/persist.js';

// The viewer's own desk arrangement, remembered in this browser only.

const KEY = 'layout-v1';

const isPlacement = (p) => p && [p.x, p.z, p.rotY].every(Number.isFinite);

/** Returns `{ lamp, items }` or null when nothing valid is stored. */
export function loadLayout(knownTypes) {
  const data = load(KEY, null);
  if (!data || !isPlacement(data.lamp) || !Array.isArray(data.items)) return null;
  // layouts saved before objects had ids: the first of each type keeps the default id
  const seen = new Set();
  const items = data.items
    .filter((item) => knownTypes.includes(item.type) && isPlacement(item))
    .map(({ type, uid, x, z, rotY }) => {
      const fallback = seen.has(type) ? undefined : `${type}-default`;
      seen.add(type);
      return { type, uid: typeof uid === 'string' ? uid : fallback, x, z, rotY };
    });
  return { lamp: data.lamp, items };
}

export function saveLayout(layout) {
  save(KEY, layout);
}

export function clearLayout() {
  remove(KEY);
}
