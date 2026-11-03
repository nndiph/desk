import * as THREE from 'three';
import { HOME_VIEW } from '../config.js';

/**
 * Close-up camera pose that looks at `center` (world space) from `distance` away.
 * `elevation` is degrees above horizontal; `azimuth` (degrees, 0 = straight on from +Z)
 * defaults to leaning halfway toward where the seated viewer is.
 */
export function makeFocus(center, { distance = 0.45, elevation = 25, azimuth = null } = {}) {
  const c = center instanceof THREE.Vector3 ? center : new THREE.Vector3(...center);
  const az =
    azimuth !== null
      ? THREE.MathUtils.degToRad(azimuth)
      : Math.atan2(HOME_VIEW.position[0] - c.x, HOME_VIEW.position[2] - c.z) * 0.5;
  const el = THREE.MathUtils.degToRad(elevation);
  const offset = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return {
    position: offset.multiplyScalar(distance).add(c).toArray(),
    target: c.toArray(),
  };
}
