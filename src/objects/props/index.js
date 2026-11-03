import * as THREE from 'three';
import { DESK, ROOM } from '../../config.js';
import { measureFootprint } from '../../setup/footprint.js';
import { makeFocus } from '../../utils/focus.js';
import { Candle } from './Candle.js';
import { DeskClock, Laptop, PenCup } from './Devices.js';
import { Mug } from './Mug.js';
import { Notebook, OpenBook, Planner } from './Paper.js';
import { BookRow, PlantShelf } from './Shelf.js';
import { Tulips } from './Tulips.js';
import { PhotoWall } from './PhotoWall.js';

/**
 * Everything that can stand on the desk. `limit` caps how many copies the setup
 * tray allows; `footprint` overrides the measured one ([width, depth] in meters)
 * for things whose leaves overhang a small base.
 */
export const CATALOG = {
  book: { label: 'Open book', make: () => new OpenBook(), limit: 1 },
  notebook: { label: 'Notebook', make: (uid) => new Notebook({ uid }), limit: 3 },
  planner: { label: 'Planner', make: () => new Planner(), limit: 2 },
  laptop: { label: 'Laptop', make: () => new Laptop(), limit: 1 },
  mug: { label: 'Mug', make: () => new Mug(), limit: 3 },
  candle: { label: 'Candle', make: () => new Candle(), limit: 3 },
  tulips: { label: 'Tulips', make: () => new Tulips(), limit: 2, footprint: [0.085, 0.085] },
  pens: { label: 'Pen cup', make: () => new PenCup(), limit: 2 },
  clock: { label: 'Clock', make: () => new DeskClock(), limit: 1 },
  books: { label: 'Book row', make: () => new BookRow(), limit: 1 },
};

/**
 * The set-up from the reference photo. Desk coordinates: x across the desk
 * (-0.7..0.7), z toward the viewer (-0.35 at the wall..0.35 at the edge).
 */
export const DEFAULT_LAYOUT = {
  lamp: { x: -0.5, z: -0.2, rotY: 0 },
  items: [
    { type: 'notebook', x: -0.43, z: 0.13, rotY: 0.12 },
    { type: 'book', x: 0.0, z: 0.12, rotY: -0.05 },
    { type: 'planner', x: 0.48, z: 0.19, rotY: -0.2 },
    { type: 'mug', x: 0.33, z: -0.01, rotY: 0.3 },
    { type: 'laptop', x: 0.1, z: -0.13, rotY: -0.06 },
    { type: 'pens', x: -0.1, z: -0.25, rotY: 0.15 },
    { type: 'clock', x: -0.23, z: -0.25, rotY: 0.1 },
    { type: 'candle', x: -0.32, z: -0.1, rotY: 0 },
    { type: 'tulips', x: -0.37, z: -0.27, rotY: 0.4 },
    { type: 'books', x: 0.53, z: -0.25, rotY: 0 },
  ].map((item) => ({ ...item, uid: `${item.type}-default` })),
};

let instanceCount = 0;

/**
 * A fresh desk object of `type`, not yet placed or added to the scene.
 * `uid` is its lasting identity (it keys saved content such as a notebook's to-dos).
 */
export function createDeskProp(type, uid = `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`) {
  const entry = CATALOG[type];
  const prop = entry.make(uid);
  prop.type = type;
  prop.uid = uid;
  prop.interactable.id = `${type}-${++instanceCount}`;
  prop.footprint = measureFootprint(prop.group, entry.footprint);
  return prop;
}

/** Recompute the close-up camera pose after the object moved. */
export function refreshFocus(prop) {
  prop.group.updateMatrixWorld(true);
  const { center, ...options } = prop.focusSpec;
  const worldCenter = prop.group.localToWorld(new THREE.Vector3(...center));
  prop.interactable.focus = makeFocus(worldCenter, options);
}

/** Stand a prop on the desk at `{ x, z, rotY }`. */
export function placeOnDesk(prop, placement) {
  prop.placement = { x: placement.x, z: placement.z, rotY: placement.rotY };
  prop.group.position.set(placement.x, DESK.height, placement.z);
  prop.group.rotation.y = placement.rotY;
  refreshFocus(prop);
}

/** Wall-mounted pieces; these stay put. */
export function createWallProps() {
  const shelf = new PlantShelf();
  // high enough that the trailing pothos clears the book row beneath it
  shelf.group.position.set(0.53, 1.2, ROOM.backWallZ + 0.065);
  const photos = new PhotoWall();
  photos.group.position.set(0, 0, ROOM.backWallZ);
  for (const prop of [shelf, photos]) refreshFocus(prop);
  return [shelf, photos];
}

/** Free GPU resources of an object that is leaving the scene for good. */
export function disposeProp(prop) {
  prop.dispose?.();
  prop.group.traverse((o) => {
    o.geometry?.dispose();
    for (const material of [].concat(o.material ?? [])) {
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}
