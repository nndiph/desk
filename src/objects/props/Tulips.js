import * as THREE from 'three';
import { leafGeometry } from '../../utils/geometry.js';
import { seeded } from '../../utils/paint.js';

const UP = new THREE.Vector3(0, 1, 0);

/** A tulip head: two rings of three cupped petals around the stem tip. */
function tulipHead(material, rand) {
  const head = new THREE.Group();
  const petal = leafGeometry({ length: 0.05, width: 0.036, bend: 0.32, cup: -0.22, segments: 12 });
  for (let i = 0; i < 6; i++) {
    const inner = i >= 3;
    const holder = new THREE.Group();
    holder.rotation.y = (i % 3) * ((Math.PI * 2) / 3) + (inner ? Math.PI / 3 : 0) + rand() * 0.2;
    const mesh = new THREE.Mesh(petal, material);
    mesh.position.z = inner ? 0.0025 : 0.0045;
    mesh.rotation.x = inner ? 0.18 : 0.32 + rand() * 0.1;
    mesh.scale.setScalar(inner ? 0.93 : 1);
    holder.add(mesh);
    head.add(holder);
  }
  return head;
}

/** Glass vase of coral tulips. */
export class Tulips {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'tulips';
    const rand = seeded(17);

    const vaseProfile = [
      [0, 0.001],
      [0.03, 0],
      [0.035, 0.008],
      [0.037, 0.05],
      [0.031, 0.095],
      [0.023, 0.118],
      [0.026, 0.13],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const vaseGeometry = new THREE.LatheGeometry(vaseProfile, 48);
    const glass = (side, order) => {
      const mesh = new THREE.Mesh(
        vaseGeometry,
        new THREE.MeshPhysicalMaterial({
          color: 0xeef4f0,
          roughness: 0.05,
          clearcoat: 1,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side,
        })
      );
      mesh.renderOrder = order;
      return mesh;
    };
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.03, 0.07, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xcfe2d8,
        roughness: 0.05,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    water.position.y = 0.04;
    water.renderOrder = 2;
    this.group.add(glass(THREE.BackSide, 1), water, glass(THREE.FrontSide, 3));

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x6f8f4a, roughness: 0.6 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x7a9a55, roughness: 0.55, side: THREE.DoubleSide });
    const petalMats = [0xf2846b, 0xe9735e, 0xf59a7a, 0xee8a74].map(
      (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, sheen: 0.6, sheenColor: 0xffd0bc, side: THREE.DoubleSide })
    );

    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.5;
      const spread = 0.04 + rand() * 0.05;
      const height = 0.26 + rand() * 0.09;
      const tip = new THREE.Vector3(Math.cos(a) * spread, height, Math.sin(a) * spread);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.01, 0.006, Math.sin(a) * 0.01),
        new THREE.Vector3(Math.cos(a) * 0.012, 0.12, Math.sin(a) * 0.012),
        new THREE.Vector3(Math.cos(a) * spread * 0.6, height * 0.75, Math.sin(a) * spread * 0.6),
        tip,
      ]);
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0032, 6), stemMat));

      const head = tulipHead(petalMats[i % petalMats.length], rand);
      head.position.copy(tip);
      head.quaternion.setFromUnitVectors(UP, curve.getTangent(1));
      this.group.add(head);
    }

    // long leaves arching out of the neck
    const leaf = leafGeometry({ length: 0.17, width: 0.03, bend: -0.45, cup: 0.25, segments: 14 });
    for (let i = 0; i < 4; i++) {
      const holder = new THREE.Group();
      holder.position.y = 0.11;
      holder.rotation.y = i * (Math.PI / 2) + 0.6;
      const mesh = new THREE.Mesh(leaf, leafMat);
      mesh.position.z = 0.012;
      mesh.rotation.x = 0.35 + rand() * 0.2;
      holder.add(mesh);
      this.group.add(holder);
    }

    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !o.material.transparent;
        o.receiveShadow = true;
      }
    });

    this.interactable = {
      id: 'tulips',
      label: 'Tulips',
      sub: 'Fresh from the Saturday market',
      hitObject: this.group,
      outline: true,
    };
    this.focusSpec = { center: [0, 0.2, 0], distance: 0.55, elevation: 10 };
  }
}
