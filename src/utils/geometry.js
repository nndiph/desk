import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder spanning two points. */
export function rod(a, b, radius, material, radialSegments = 16) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), radialSegments), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}

/**
 * A bendable leaf/petal: grows along +Y from the origin, faces +Z.
 * `profile(t)` gives the half-width multiplier along the length (t = 0 base → 1 tip),
 * `bend` curls the tip toward -Z (inward for petals, downward for leaves once rotated),
 * `cup` lifts the edges toward +Z so the blade isn't a flat card.
 */
export function leafGeometry({
  length = 0.1,
  width = 0.03,
  bend = 0.2,
  cup = 0.15,
  profile = (t) => Math.sin(Math.PI * Math.pow(t, 0.75)),
  segments = 10,
} = {}) {
  const geometry = new THREE.PlaneGeometry(1, 1, 4, segments);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) + 0.5;
    const side = pos.getX(i) * 2; // -1..1 across the blade
    const half = (width / 2) * Math.max(0.04, profile(t));
    const x = side * half;
    const y = t * length;
    const z = -bend * length * t * t + cup * width * side * side;
    pos.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Pothos-style heart leaf profile: widest low down, pointed tip. */
export const heartProfile = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.8);

/** Flat heart shape (for little decals), centered on the origin, facing +Z. */
export function heartGeometry(size = 0.01) {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, -s);
  shape.bezierCurveTo(-s * 0.3, -s * 0.6, -s * 1.1, -s * 0.1, -s * 1.0, s * 0.35);
  shape.bezierCurveTo(-s * 0.9, s * 0.95, -s * 0.15, s * 1.0, 0, s * 0.45);
  shape.bezierCurveTo(s * 0.15, s * 1.0, s * 0.9, s * 0.95, s * 1.0, s * 0.35);
  shape.bezierCurveTo(s * 1.1, -s * 0.1, s * 0.3, -s * 0.6, 0, -s);
  return new THREE.ShapeGeometry(shape, 12);
}

/** Row of wire rings for spiral-bound notebooks, running along local X. */
export function spiralBinding({ count, spacing, radius = 0.006, tube = 0.0011, material }) {
  const group = new THREE.Group();
  const geometry = new THREE.TorusGeometry(radius, tube, 6, 18);
  const start = (-(count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = start + i * spacing;
    group.add(ring);
  }
  return group;
}

/** A simple ballpoint pen lying along local X. */
export function pen({ length = 0.135, radius = 0.0045, body = 0x2b2a2e, trim = 0xc8c2b8 } = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: body, roughness: 0.35, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.25, metalness: 0.85 });

  const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length * 0.78, 6, 16), bodyMat);
  barrel.rotation.z = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.9, length * 0.12, 16), trimMat);
  tip.rotation.z = Math.PI / 2;
  tip.position.x = length * 0.5;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(length * 0.32, radius * 0.4, radius * 0.5), trimMat);
  clip.position.set(-length * 0.22, radius * 1.05, 0);
  group.add(barrel, tip, clip);
  group.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return group;
}

/** Mark every mesh under `object` as casting and receiving shadows. */
export function enableShadows(object, cast = true) {
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
    }
  });
  return object;
}
