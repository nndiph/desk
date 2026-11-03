import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DESK } from '../config.js';
import { createWoodTextures } from '../utils/textures.js';

/** Light-oak writing desk: rounded top, slim apron and four tapered legs. */
export class Desk {
  constructor({ anisotropy = 1 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'desk';

    const { width: W, depth: D, height: H, thickness: T } = DESK;
    const wood = createWoodTextures({ anisotropy });

    // varnished top: a whisper of clearcoat catches the lamp's hot spot
    const topMaterial = new THREE.MeshPhysicalMaterial({
      map: wood.map,
      bumpMap: wood.bumpMap,
      bumpScale: 0.35,
      roughness: 0.58,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
    });
    const frameMaterial = new THREE.MeshStandardMaterial({
      map: wood.map,
      roughness: 0.65,
      color: 0xe6d6c4,
    });

    this.top = new THREE.Mesh(new RoundedBoxGeometry(W, T, D, 4, 0.008), topMaterial);
    this.top.position.y = H - T / 2;
    this.top.castShadow = true;
    this.top.receiveShadow = true;
    this.top.name = 'deskTop';
    this.group.add(this.top);

    const apronHeight = 0.075;
    const apronY = H - T - apronHeight / 2;
    const inset = 0.06;
    const addPart = (geometry, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, frameMaterial);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };

    // apron frame under the top
    const longApron = new THREE.BoxGeometry(W - inset * 2, apronHeight, 0.02);
    const shortApron = new THREE.BoxGeometry(0.02, apronHeight, D - inset * 2);
    addPart(longApron, 0, apronY, D / 2 - inset);
    addPart(longApron, 0, apronY, -D / 2 + inset);
    addPart(shortApron, W / 2 - inset, apronY, 0);
    addPart(shortApron, -W / 2 + inset, apronY, 0);

    // slightly tapered legs
    const legHeight = H - T;
    const legGeometry = new THREE.CylinderGeometry(0.022, 0.016, legHeight, 4, 1);
    legGeometry.rotateY(Math.PI / 4);
    const legX = W / 2 - inset;
    const legZ = D / 2 - inset;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      addPart(legGeometry, sx * legX, legHeight / 2, sz * legZ);
    }

    this.interactable = {
      id: 'desk',
      label: 'The desk',
      sub: 'Light oak, ready to be set up',
      hitObject: this.group,
      outline: true,
      focus: {
        position: [0.05, H + 0.78, 0.48],
        target: [0, H, -0.06],
      },
    };
  }
}
