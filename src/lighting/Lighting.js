import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DESK, ROOM, PALETTE } from '../config.js';

/**
 * Everything that isn't the lamp: cool night ambience, a faint moonlit window
 * on the left, and a warm bounce from the desk surface that follows lamp power.
 */
export class Lighting {
  constructor({ scene, renderer }) {
    this.group = new THREE.Group();
    this.group.name = 'lighting';

    // very low image-based fill so materials never go fully flat
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.025;
    pmrem.dispose();

    scene.background = new THREE.Color(PALETTE.night);
    scene.fog = new THREE.Fog(PALETTE.night, 3.2, 7);

    this.hemi = new THREE.HemisphereLight(0x3a3a48, PALETTE.shadowTint, 0.3);
    this.group.add(this.hemi);

    // moonlight through an (unseen) window on the left
    this.moon = new THREE.DirectionalLight(PALETTE.moon, 0.18);
    this.moon.position.set(ROOM.leftWallX + 0.2, 2.2, 1.6);
    this.moon.target.position.set(0.2, DESK.height, -0.2);
    this.group.add(this.moon, this.moon.target);

    // warm light bouncing off the lit desktop onto the wall and underside of things
    this.bounce = new THREE.PointLight(0xffb878, 0, 1.4, 2);
    this.bounce.position.set(-0.15, DESK.height + 0.06, 0.0);
    this.bounceIntensity = 0.1;
    this.group.add(this.bounce);

    // hemisphere dims a touch when the lamp is on so the warm pool reads stronger
    this.hemiOff = 0.3;
    this.hemiOn = 0.16;
  }

  /** Keep secondary lights in step with the lamp: its power (0..1) and where its beam lands. */
  update(lampPower, lampAim) {
    this.bounce.intensity = this.bounceIntensity * lampPower;
    if (lampAim) this.bounce.position.set(lampAim.x, DESK.height + 0.06, lampAim.z);
    this.hemi.intensity = THREE.MathUtils.lerp(this.hemiOff, this.hemiOn, lampPower);
  }
}
