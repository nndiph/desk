import * as THREE from 'three';
import { DESK } from '../config.js';

// Each desk object occupies a rectangle on the desktop (its footprint, in local XZ).
// Placement checks rotate that rectangle into desk space and test it against the
// desk edges and every other footprint with a separating-axis test.

const EDGE_MARGIN = 0.006;
const TOUCH_SLACK = 0.004; // footprints may kiss without counting as overlap

/**
 * Local footprint `{ cx, cz, hw, hd }` measured from the object's geometry at rest.
 * `override` = [width, depth] for things whose leaves or arms overhang a small base.
 */
export function measureFootprint(group, override) {
  if (override) return { cx: 0, cz: 0, hw: override[0] / 2, hd: override[1] / 2 };

  const position = group.position.clone();
  const rotation = group.rotation.y;
  group.position.set(0, 0, 0);
  group.rotation.y = 0;
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  group.position.copy(position);
  group.rotation.y = rotation;
  group.updateMatrixWorld(true);

  return {
    cx: (box.min.x + box.max.x) / 2,
    cz: (box.min.z + box.max.z) / 2,
    hw: (box.max.x - box.min.x) / 2,
    hd: (box.max.z - box.min.z) / 2,
  };
}

/** The footprint as a rotated rectangle in desk space for a candidate placement. */
export function footprintAt(footprint, { x, z, rotY }) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  // three.js Y rotation: x' = x·cos + z·sin, z' = −x·sin + z·cos
  return {
    x: x + footprint.cx * cos + footprint.cz * sin,
    z: z - footprint.cx * sin + footprint.cz * cos,
    hw: footprint.hw,
    hd: footprint.hd,
    axes: [
      [cos, -sin],
      [sin, cos],
    ],
  };
}

function corners(rect) {
  const [[ax, az], [bx, bz]] = rect.axes;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) => [rect.x + ax * sx * rect.hw + bx * sz * rect.hd, rect.z + az * sx * rect.hw + bz * sz * rect.hd]);
}

export function overlaps(a, b) {
  const ca = corners(a);
  const cb = corners(b);
  for (const [nx, nz] of [...a.axes, ...b.axes]) {
    const project = (pts) => pts.map(([px, pz]) => px * nx + pz * nz);
    const pa = project(ca);
    const pb = project(cb);
    if (Math.max(...pa) - TOUCH_SLACK <= Math.min(...pb) || Math.max(...pb) - TOUCH_SLACK <= Math.min(...pa)) {
      return false;
    }
  }
  return true;
}

/** Shift a placement so its footprint stays on the desktop. */
export function clampToDesk(footprint, placement) {
  const pts = corners(footprintAt(footprint, placement));
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const maxX = DESK.width / 2 - EDGE_MARGIN;
  const maxZ = DESK.depth / 2 - EDGE_MARGIN;
  let { x, z } = placement;
  if (Math.max(...xs) > maxX) x -= Math.max(...xs) - maxX;
  if (Math.min(...xs) < -maxX) x += -maxX - Math.min(...xs);
  if (Math.max(...zs) > maxZ) z -= Math.max(...zs) - maxZ;
  if (Math.min(...zs) < -maxZ) z += -maxZ - Math.min(...zs);
  return { ...placement, x, z };
}

/** Is `placement` free of every other object (`others` = [{ footprint, placement }])? */
export function isFree(footprint, placement, others) {
  const rect = footprintAt(footprint, placement);
  return others.every((o) => !overlaps(rect, footprintAt(o.footprint, o.placement)));
}

/** Nearest free spot to the front-centre of the desk, or null when the desk is full. */
export function findFreeSpot(footprint, others, rotY = 0) {
  const candidates = [];
  for (let x = -0.6; x <= 0.6001; x += 0.04) {
    for (let z = -0.3; z <= 0.3001; z += 0.04) {
      candidates.push({ x, z, rotY, d: Math.hypot(x, z - 0.12) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const { x, z } of candidates) {
    const placement = clampToDesk(footprint, { x, z, rotY });
    if (isFree(footprint, placement, others)) return placement;
  }
  return null;
}
