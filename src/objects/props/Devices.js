import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LaptopScreen, SCREEN_SIZE } from '../../apps/LaptopScreen.js';
import { ambience, timer } from '../../apps/services.js';
import { enableShadows } from '../../utils/geometry.js';
import { ProjectedOverlay, planeCorners } from '../../utils/overlay.js';
import { clockFaceTexture, keyboardTexture, laptopScreenTexture } from '../../utils/paint.js';
import { load, save } from '../../utils/persist.js';

/**
 * Space-grey laptop. Its screen shows a dusk city (and the focus timer while
 * one runs); up close it wakes into a usable desktop with the timer and sounds.
 */
export class Laptop {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'laptop';
    const W = 0.31;
    const D = 0.215;
    const T = 0.012;
    const H = 0.205;
    const lidTilt = 0.3;

    const aluminium = new THREE.MeshStandardMaterial({ color: 0x8c8d92, roughness: 0.35, metalness: 0.75 });

    const base = new THREE.Mesh(new RoundedBoxGeometry(W, T, D, 3, 0.004), aluminium);
    base.position.y = T / 2;
    const keyboard = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.03, 0.105),
      new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.6, metalness: 0.3 })
    );
    keyboard.rotation.x = -Math.PI / 2;
    keyboard.position.set(0, T + 0.0002, -0.035);
    const trackpad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.066),
      new THREE.MeshStandardMaterial({ color: 0x9c9da3, roughness: 0.22, metalness: 0.6 })
    );
    trackpad.rotation.x = -Math.PI / 2;
    trackpad.position.set(0, T + 0.0002, 0.06);
    this.group.add(base, keyboard, trackpad);

    // lid pivots on the back edge
    const lid = new THREE.Group();
    lid.position.set(0, T, -D / 2 + 0.003);
    lid.rotation.x = -lidTilt;
    this.group.add(lid);

    const shell = new THREE.Mesh(new RoundedBoxGeometry(W, H, 0.005, 3, 0.002), aluminium);
    shell.position.set(0, H / 2, -0.0025);
    const bezel = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.008, H - 0.008),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.15 })
    );
    bezel.position.set(0, H / 2, 0.0002);
    this.screenTexture = laptopScreenTexture();
    this.screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: this.screenTexture,
      emissiveIntensity: 1.15,
      // matte-ish coating: a crisp lamp reflection read as a glitch on screen
      roughness: 0.45,
    });
    const displayW = W - 0.022;
    const displayH = H - 0.03;
    const display = new THREE.Mesh(new THREE.PlaneGeometry(displayW, displayH), this.screenMaterial);
    display.position.set(0, H / 2 + 0.003, 0.0004);
    lid.add(shell, bezel, display);
    this.displayCorners = planeCorners(display, displayW, displayH);

    // the screen's own soft spill on the keyboard and nearby things
    const spill = new THREE.PointLight(0xc9b6d6, 0.02, 0.55, 2);
    spill.position.set(0, H / 2, 0.06);
    lid.add(spill);

    enableShadows(this.group);
    display.castShadow = bezel.castShadow = false;

    this.interactable = {
      id: 'laptop',
      label: 'Laptop',
      sub: 'Focus timer & ambient sounds',
      hitObject: this.group,
      outline: true,
      showsTimer: true,
      onFocus: () => this.wake(),
      onBlur: () => this.overlay?.hide(),
    };
    const screenCenter = new THREE.Vector3(0, H / 2, 0).applyEuler(lid.rotation).add(lid.position);
    this.focusSpec = { center: screenCenter.toArray(), distance: 0.36, elevation: 8, azimuth: 0 };

    this.offTimer = timer.onChange(() => this.drawScreen());
    this.drawScreen();
  }

  drawScreen() {
    this.screenTexture.draw(timer.started ? timer : null);
  }

  /** Build the live desktop on first use, then fade it in over the screen. */
  wake() {
    if (!this.overlay) {
      this.desktop = new LaptopScreen({ wallpaperUrl: this.screenTexture.wallpaper.toDataURL('image/jpeg', 0.85) });
      this.overlay = new ProjectedOverlay(this.desktop.element, { ...SCREEN_SIZE, corners: this.displayCorners });
    }
    this.overlay.show(0.8);
  }

  update(dt, t, camera) {
    if (!this.overlay?.visible) return;
    this.overlay.update(camera);
    this.desktop.renderClock();
  }

  dispose() {
    this.offTimer();
    this.desktop?.dispose();
    this.overlay?.dispose();
    ambience.stopAll(); // its controls are gone with it
  }
}

/** Little digital alarm clock that shows the viewer's real time. */
export class DeskClock {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'clock';
    const w = 0.1;
    const h = 0.05;
    const d = 0.045;

    const body = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 3, 0.009),
      new THREE.MeshStandardMaterial({ color: 0xeee5d6, roughness: 0.5 })
    );
    body.position.y = h / 2;

    this.face = clockFaceTexture();
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.02, h - 0.016),
      new THREE.MeshStandardMaterial({
        color: 0x0b0b0d,
        emissive: 0xffffff,
        emissiveMap: this.face,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      })
    );
    face.position.set(0, h / 2, d / 2 + 0.0004);
    this.group.add(body, face);
    enableShadows(this.group);
    face.castShadow = false;

    this.hour12 = load('clock', { hour12: false }).hour12;
    this.shown = '';
    this.update();

    this.interactable = {
      id: 'clock',
      label: 'Clock',
      sub: 'Your local time — click it to switch 12 / 24-hour',
      hitObject: this.group,
      outline: true,
      onActivate: () => this.toggleFormat(),
      actionLabel: () => (this.hour12 ? 'switch to 24-hour' : 'switch to 12-hour'),
    };
    this.focusSpec = { center: [0, h / 2, 0], distance: 0.24, elevation: 14 };
  }

  toggleFormat() {
    this.hour12 = !this.hour12;
    save('clock', { hour12: this.hour12 });
    this.update();
  }

  update() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const text = this.hour12 ? `${hours % 12 || 12}:${minutes}` : `${hours}:${minutes}`;
    const suffix = this.hour12 ? (hours < 12 ? 'AM' : 'PM') : '';
    if (text + suffix !== this.shown) {
      this.shown = text + suffix;
      this.face.draw(text, suffix);
    }
  }
}

/** Ceramic cup full of pens and markers. */
export class PenCup {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'penCup';
    const s = 0.07;
    const h = 0.095;
    const t = 0.004;
    const ceramic = new THREE.MeshStandardMaterial({ color: 0xece2d0, roughness: 0.55 });

    const add = (geometry, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, ceramic);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
    };
    add(new RoundedBoxGeometry(s, t, s, 2, 0.0015), 0, t / 2, 0);
    const wallX = new RoundedBoxGeometry(t, h, s, 2, 0.0015);
    const wallZ = new RoundedBoxGeometry(s - t * 2, h, t, 2, 0.0015);
    add(wallX, s / 2 - t / 2, h / 2, 0);
    add(wallX, -s / 2 + t / 2, h / 2, 0);
    add(wallZ, 0, h / 2, s / 2 - t / 2);
    add(wallZ, 0, h / 2, -s / 2 + t / 2);

    const caps = [0x1f1f22, 0x2e2e33, 0xd9b3a4, 0x1f1f22, 0xa8ad8f, 0x1f1f22, 0xc9a882, 0x3a3a40, 0x1f1f22];
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.4 });
    const penLength = 0.145;
    caps.forEach((cap, i) => {
      const a = (i / caps.length) * Math.PI * 2 + 0.4;
      // kept close enough to the centre that the tilted pens stay inside the walls
      const r = 0.006 + (i % 3) * 0.006;
      const tool = new THREE.Group();
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, penLength, 12), bodyMat);
      barrel.position.y = penLength / 2;
      const capMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0048, 0.0048, 0.03, 12),
        new THREE.MeshStandardMaterial({ color: cap, roughness: 0.35 })
      );
      capMesh.position.y = penLength - 0.012;
      tool.add(barrel, capMesh);
      tool.position.set(Math.cos(a) * r, t, Math.sin(a) * r);
      tool.rotation.set(Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1);
      this.group.add(tool);
    });
    enableShadows(this.group);

    this.interactable = {
      id: 'pens',
      label: 'Pen cup',
      sub: 'Never enough black pens',
      hitObject: this.group,
      outline: true,
    };
    this.focusSpec = { center: [0, 0.09, 0], distance: 0.3, elevation: 24 };
  }
}
