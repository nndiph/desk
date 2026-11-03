import * as THREE from 'three';
import { enableShadows, heartGeometry } from '../../utils/geometry.js';
import { coasterTexture } from '../../utils/paint.js';

/** White ceramic mug with a tiny painted heart, on a rattan coaster. */
export class Mug {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'mug';

    const coaster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.006, 48),
      new THREE.MeshStandardMaterial({ map: coasterTexture(), roughness: 0.9 })
    );
    coaster.position.y = 0.003;
    this.group.add(coaster);

    const ceramic = new THREE.MeshPhysicalMaterial({
      color: 0xf4f1ec,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });

    const r = 0.037;
    const h = 0.088;
    const wall = 0.0035;
    const profile = [
      [0, 0],
      [r - 0.003, 0],
      [r, 0.004],
      [r, h - 0.002],
      [r - wall / 2, h],
      [r - wall, h - 0.002],
      [r - wall, 0.008],
      [0, 0.008],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), ceramic);
    body.position.y = 0.006;
    this.group.add(body);

    const coffee = new THREE.Mesh(
      new THREE.CircleGeometry(r - wall, 48),
      new THREE.MeshPhysicalMaterial({ color: 0x2b170c, roughness: 0.15, clearcoat: 1 })
    );
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.006 + h - 0.016;
    this.group.add(coffee);

    // half-torus handle on the right
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0058, 14, 28, Math.PI), ceramic);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(r - 0.002, 0.006 + h * 0.52, 0);
    this.group.add(handle);

    const heart = new THREE.Mesh(
      heartGeometry(0.012),
      new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.5 })
    );
    heart.position.set(0, 0.006 + h * 0.6, r + 0.0004);
    this.group.add(heart);

    enableShadows(this.group);
    heart.castShadow = false;

    this.interactable = {
      id: 'mug',
      label: 'Coffee mug',
      sub: 'Still warm. Probably.',
      hitObject: this.group,
      outline: true,
    };
    this.focusSpec = { center: [0, 0.05, 0], distance: 0.3, elevation: 24 };
  }
}
