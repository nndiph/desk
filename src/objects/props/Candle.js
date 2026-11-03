import * as THREE from 'three';
import gsap from 'gsap';
import { enableShadows } from '../../utils/geometry.js';
import { createGlowTexture } from '../../utils/textures.js';

/**
 * Glass-jar candle. The flame flickers every frame and drives a small warm light;
 * clicking it while in focus blows it out (or lights it again).
 */
export class Candle {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'candle';
    this.power = 1;
    this.isLit = true;

    const r = 0.038;
    const h = 0.085;
    const jarProfile = [
      [0, 0.001],
      [r - 0.004, 0],
      [r, 0.005],
      [r, h],
      [r - 0.002, h],
      [r - 0.002, 0.006],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const jarGeometry = new THREE.LatheGeometry(jarProfile, 48);
    const glass = (side, order) => {
      const mesh = new THREE.Mesh(
        jarGeometry,
        new THREE.MeshPhysicalMaterial({
          color: 0xf6ead6,
          roughness: 0.12,
          metalness: 0,
          clearcoat: 1,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          side,
        })
      );
      // back glass → flame → front glass, so the flame shows through the jar
      mesh.renderOrder = order;
      return mesh;
    };
    this.group.add(glass(THREE.BackSide, 1), glass(THREE.FrontSide, 3));

    this.waxMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3e3c6,
      roughness: 0.75,
      emissive: 0xff9a4a,
      emissiveIntensity: 0,
    });
    const waxHeight = 0.05;
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.003, r - 0.003, waxHeight, 40), this.waxMaterial);
    wax.position.y = 0.006 + waxHeight / 2;
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0011, 0.0011, 0.012, 6),
      new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 })
    );
    const waxTop = 0.006 + waxHeight;
    wick.position.y = waxTop + 0.005;
    this.group.add(wax, wick);
    enableShadows(this.group, false);
    wax.castShadow = true;

    // flame: an additive teardrop inside a brighter core, plus a soft halo
    this.flame = new THREE.Group();
    this.flame.position.y = waxTop + 0.008;
    const tear = [
      [0, 0],
      [0.0035, 0.002],
      [0.005, 0.006],
      [0.0044, 0.012],
      [0.0026, 0.018],
      [0, 0.025],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const tearGeometry = new THREE.LatheGeometry(tear, 20);
    const flameMat = (rgb, opacity) =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(...rgb),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    this.outerFlame = new THREE.Mesh(tearGeometry, flameMat([3.2, 1.3, 0.35], 0.7));
    this.innerFlame = new THREE.Mesh(tearGeometry, flameMat([4, 3.2, 2], 0.9));
    this.innerFlame.scale.set(0.5, 0.55, 0.5);
    this.innerFlame.position.y = 0.002;
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture(),
        color: 0xffa860,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      })
    );
    this.halo.scale.setScalar(0.09);
    this.halo.position.y = 0.01;
    for (const part of [this.outerFlame, this.innerFlame, this.halo]) part.renderOrder = 2;
    this.flame.add(this.outerFlame, this.innerFlame, this.halo);
    this.group.add(this.flame);

    this.light = new THREE.PointLight(0xff9d4d, 0, 0.9, 2);
    this.light.position.y = waxTop + 0.03;
    this.lightIntensity = 0.035;
    this.group.add(this.light);

    this.interactable = {
      id: 'candle',
      label: 'Candle',
      sub: 'Click it to blow it out — or light it again',
      hitObject: this.group,
      outline: true,
      onActivate: () => this.toggle(),
      actionLabel: () => (this.isLit ? 'blow it out' : 'light it'),
    };
    this.focusSpec = { center: [0, 0.06, 0], distance: 0.28, elevation: 22 };
  }

  toggle() {
    this.isLit = !this.isLit;
    gsap.to(this, { power: this.isLit ? 1 : 0, duration: this.isLit ? 0.8 : 0.25, ease: 'power2.out' });
  }

  update(dt, t) {
    // layered sines read as an organic flicker without a noise library
    const flicker = 1 + Math.sin(t * 13.1) * 0.06 + Math.sin(t * 23.7 + 1.3) * 0.04 + Math.sin(t * 5.3 + 0.4) * 0.05;
    const p = this.power;
    this.flame.visible = p > 0.01;
    this.flame.scale.set(p * (1 + (flicker - 1) * 0.5), p * flicker, p);
    this.flame.rotation.z = Math.sin(t * 3.7) * 0.06 + Math.sin(t * 11.3) * 0.03;
    this.light.intensity = this.lightIntensity * p * flicker;
    this.waxMaterial.emissiveIntensity = 0.12 * p * flicker;
    this.halo.material.opacity = 0.5 * p * flicker;
  }
}
