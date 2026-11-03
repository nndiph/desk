import * as THREE from 'three';
import gsap from 'gsap';
import { DESK, PALETTE } from '../config.js';
import { createGlowTexture, createShadeGlowTexture } from '../utils/textures.js';

import { rod } from '../utils/geometry.js';

const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Warm-white architect lamp. It owns the main spot light and a soft glow light;
 * `power` (0..1) drives every emissive and light together so on/off can be animated.
 */
export class DeskLamp {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'deskLamp';
    this.group.position.set(-0.5, DESK.height, -0.2);

    this.power = 0;
    this.isOn = true;

    const body = new THREE.MeshStandardMaterial({
      color: PALETTE.lampBody,
      roughness: 0.38,
      metalness: 0.15,
    });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9b2a8, roughness: 0.3, metalness: 0.8 });

    // base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.024, 48), body);
    base.position.y = 0.012;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 24), body);
    collar.position.y = 0.038;
    this.group.add(base, collar);

    // arm joints (local space)
    const p0 = new THREE.Vector3(0, 0.05, 0);
    const p1 = new THREE.Vector3(-0.035, 0.42, -0.035);
    const p2 = new THREE.Vector3(0.17, 0.55, 0.085);

    const side = new THREE.Vector3(0.011, 0, -0.011);
    this.group.add(
      rod(p0, p1, 0.0075, body),
      rod(p0.clone().add(side), p1.clone().add(side), 0.0035, steel),
      rod(p1, p2, 0.0075, body),
      rod(p1.clone().add(side), p2.clone().add(side), 0.0035, steel)
    );
    for (const p of [p0, p1, p2]) {
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 16), body);
      knuckle.position.copy(p);
      this.group.add(knuckle);
    }

    // head: shade hangs from p2 and aims at a point on the desk
    // tilted toward the viewer so the glowing mouth of the shade is visible
    this.aim = new THREE.Vector3(0.28, 0, 0.34);
    const head = new THREE.Group();
    head.position.copy(p2);
    head.quaternion.setFromUnitVectors(DOWN, new THREE.Vector3().subVectors(this.aim, p2).normalize());
    this.group.add(head);

    const profile = [
      [0.017, 0.0],
      [0.019, -0.045],
      [0.026, -0.06],
      [0.05, -0.1],
      [0.072, -0.145],
      [0.075, -0.152],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const shadeGeometry = new THREE.LatheGeometry(profile, 64);

    const shadeOuter = new THREE.Mesh(shadeGeometry, body);
    shadeOuter.material = body.clone();
    shadeOuter.material.side = THREE.DoubleSide;
    // a little warmth so the shade doesn't read cold grey against the night
    shadeOuter.material.emissive = new THREE.Color(0x4a3828);
    this.shadeMaterial = shadeOuter.material;

    // the inside of the shade is what actually reads as "the light":
    // HDR emissive (blooms) with a falloff that peaks around the bulb
    this.innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff1dc,
      roughness: 0.6,
      emissive: 0xffc98c,
      emissiveMap: createShadeGlowTexture(),
      emissiveIntensity: 0,
      side: THREE.BackSide,
    });
    const shadeInner = new THREE.Mesh(shadeGeometry, this.innerMaterial);
    shadeInner.scale.setScalar(0.96);
    shadeInner.position.y = -0.004;
    head.add(shadeOuter, shadeInner);

    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.016, 0.04, 20),
      new THREE.MeshStandardMaterial({ color: 0x5a524a, roughness: 0.5, metalness: 0.4 })
    );
    socket.position.y = -0.065;
    head.add(socket);

    // frosted bulb sitting low enough to peek out of the mouth
    this.bulbMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe6c0,
      emissiveIntensity: 0,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 20), this.bulbMaterial);
    bulb.scale.set(1, 1.15, 1);
    bulb.position.y = -0.112;
    head.add(bulb);

    // soft halo around the bulb; the shade occludes it from above, so it only
    // spills out of the mouth like light hazing out of the lamp
    this.haloMaterial = new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: PALETTE.lampLight,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const halo = new THREE.Sprite(this.haloMaterial);
    halo.position.y = -0.12;
    halo.scale.setScalar(0.26);
    head.add(halo);

    // lights
    this.spot = new THREE.SpotLight(PALETTE.lampLight, 0, 0, Math.PI / 3.4, 0.7, 2);
    this.spot.position.set(0, -0.11, 0);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(2048, 2048);
    this.spot.shadow.camera.near = 0.03;
    this.spot.shadow.camera.far = 4;
    this.spot.shadow.bias = -0.0004;
    this.spot.shadow.normalBias = 0.015;
    this.spot.target.position.set(0, -1, 0);
    head.add(this.spot, this.spot.target);
    this.spotIntensity = 1.6;

    // soft spill that lights the shade itself and leaks onto the wall
    this.glow = new THREE.PointLight(0xffc98a, 0, 1.6, 2);
    this.glow.position.set(0, -0.02, 0);
    head.add(this.glow);
    this.glowIntensity = 0.22;

    this.group.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = obj !== bulb && obj !== shadeInner && obj !== shadeOuter;
        obj.receiveShadow = true;
      }
    });

    this.interactable = {
      id: 'lamp',
      label: 'Desk lamp',
      sub: 'Click the lamp to switch it on or off',
      hitObject: this.group,
      outline: true,
      onActivate: () => this.toggle(),
      actionLabel: () => (this.isOn ? 'switch off' : 'switch on'),
    };
    // close-up framed on the middle of the arm, relative to wherever the lamp stands
    this.focusSpec = { center: [0.1, 0.28, 0.08], distance: 0.89, elevation: 13 };
    this.type = 'lamp';
    // only the base sits on the desk; the arm and head overhang freely
    this.footprintSize = [0.17, 0.17];

    this.applyPower();
  }

  /** World-space point where the lamp's beam lands on the desk. */
  aimWorld(target = new THREE.Vector3()) {
    return this.group.localToWorld(target.copy(this.aim));
  }

  applyPower() {
    const p = this.power;
    this.spot.intensity = this.spotIntensity * p;
    this.glow.intensity = this.glowIntensity * p;
    this.bulbMaterial.emissiveIntensity = 24 * p;
    this.innerMaterial.emissiveIntensity = 3.2 * p;
    this.haloMaterial.opacity = 0.55 * p;
    this.shadeMaterial.emissiveIntensity = p;
  }

  /** The warm flicker of an old bulb catching. */
  switchOn() {
    this.isOn = true;
    gsap.killTweensOf(this);
    return gsap
      .timeline({ onUpdate: () => this.applyPower() })
      .to(this, { power: 0.55, duration: 0.06 })
      .to(this, { power: 0.08, duration: 0.08 })
      .to(this, { power: 0.8, duration: 0.05 })
      .to(this, { power: 0.35, duration: 0.1 })
      .to(this, { power: 1, duration: 0.9, ease: 'power2.out' });
  }

  switchOff() {
    this.isOn = false;
    gsap.killTweensOf(this);
    return gsap.to(this, {
      power: 0,
      duration: 0.35,
      ease: 'power2.in',
      onUpdate: () => this.applyPower(),
    });
  }

  toggle() {
    return this.isOn ? this.switchOff() : this.switchOn();
  }
}
