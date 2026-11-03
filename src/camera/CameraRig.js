import * as THREE from 'three';
import gsap from 'gsap';
import { HOME_VIEW } from '../config.js';

const BASE_FOV = 40;
const DESIGN_ASPECT = 1.5;

/**
 * Seated point of view with a gentle mouse parallax.
 * `position`/`target` are the resting pose; GSAP tweens them for close-ups.
 */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.home = {
      position: new THREE.Vector3(...HOME_VIEW.position),
      target: new THREE.Vector3(...HOME_VIEW.target),
    };
    this.position = this.home.position.clone();
    this.target = this.home.target.clone();

    this.pointer = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.parallaxStrength = 1;

    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    });
  }

  /** Narrow screens widen the vertical FOV so the whole desk stays in frame. */
  resize(aspect) {
    let fov = BASE_FOV;
    if (aspect < DESIGN_ASPECT) {
      const halfV = THREE.MathUtils.degToRad(BASE_FOV / 2);
      fov = THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(halfV) * DESIGN_ASPECT) / aspect));
    }
    this.camera.fov = Math.min(fov, 78);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  moveTo({ position, target }, { duration = 1.3, parallax = 0.3 } = {}) {
    const ease = 'power3.inOut';
    gsap.killTweensOf([this.position, this.target, this]);
    const [px, py, pz] = position instanceof THREE.Vector3 ? position.toArray() : position;
    const [tx, ty, tz] = target instanceof THREE.Vector3 ? target.toArray() : target;
    gsap.to(this.position, { x: px, y: py, z: pz, duration, ease });
    gsap.to(this, { parallaxStrength: parallax, duration, ease });
    return gsap.to(this.target, { x: tx, y: ty, z: tz, duration, ease });
  }

  goHome(options) {
    return this.moveTo(this.home, { parallax: 1, ...options });
  }

  update(dt) {
    this.parallax.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));
    const s = 0.045 * this.parallaxStrength;
    this.camera.position.set(
      this.position.x + this.parallax.x * s,
      this.position.y + this.parallax.y * s * 0.6,
      this.position.z
    );
    this.camera.lookAt(
      this.target.x + this.parallax.x * s * 0.25,
      this.target.y + this.parallax.y * s * 0.15,
      this.target.z
    );
  }
}
