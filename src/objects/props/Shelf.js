import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { enableShadows, heartProfile, leafGeometry } from '../../utils/geometry.js';
import { seeded, spineTexture } from '../../utils/paint.js';

const PAGES = new THREE.MeshStandardMaterial({ color: 0xefe5d1, roughness: 0.9 });

/** A row of upright books against the wall, held by a small metal bookend. */
export class BookRow {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'books';
    const rand = seeded(29);
    const titles = ['habits', 'slow days', 'poems', 'the quiet hours', 'journal', 'letters', 'still life'];

    let x = 0;
    titles.forEach((title, i) => {
      const t = 0.022 + rand() * 0.014;
      const h = 0.2 + rand() * 0.07;
      const d = 0.15 + rand() * 0.04;
      const { texture, color } = spineTexture(title, i);
      const cover = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
      const spine = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
      // BoxGeometry face order: +x, -x, +y, -y, +z (spine, facing the viewer), -z
      const book = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), [cover, cover, PAGES, cover, spine, PAGES]);
      book.position.set(x + t / 2, h / 2, -0.09 + d / 2);
      this.group.add(book);
      x += t + 0.001;
    });

    // centre the row on the group origin
    for (const book of this.group.children) book.position.x -= x / 2;

    const metal = new THREE.MeshStandardMaterial({ color: 0x2f2b28, roughness: 0.4, metalness: 0.7 });
    const end = new THREE.Group();
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.14, 0.11), metal);
    upright.position.y = 0.07;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.003, 0.11), metal);
    foot.position.set(-0.035, 0.0015, 0);
    end.add(upright, foot);
    end.position.set(x / 2 + 0.003, 0, -0.03);
    this.group.add(end);

    enableShadows(this.group);
    this.interactable = {
      id: 'books',
      label: 'Bookshelf',
      sub: 'Soon: your reading list',
      hitObject: this.group,
      outline: true,
    };
    this.focusSpec = { center: [0, 0.12, 0], distance: 0.5, elevation: 14 };
  }
}

/** Small wall shelf with a trailing pothos in a cream pot. */
export class PlantShelf {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'plantShelf';
    const rand = seeded(41);

    const wood = new THREE.MeshStandardMaterial({ color: 0xc29d74, roughness: 0.6 });
    const board = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.018, 0.13, 2, 0.003), wood);
    board.position.y = -0.009;
    this.group.add(board);
    for (const bx of [-0.12, 0.12]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.08), wood);
      bracket.position.set(bx, -0.048, -0.025);
      this.group.add(bracket);
    }

    // pot
    const potProfile = [
      [0, 0],
      [0.034, 0],
      [0.037, 0.004],
      [0.046, 0.058],
      [0.05, 0.062],
      [0.05, 0.07],
      [0.046, 0.07],
      [0.044, 0.062],
      [0, 0.062],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const pot = new THREE.Mesh(
      new THREE.LatheGeometry(potProfile, 40),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.55 })
    );
    const potX = 0.03;
    pot.position.x = potX;
    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(0.044, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 1 })
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(potX, 0.063, 0);
    this.group.add(pot, soil);

    const leafMats = [0x4f7a3a, 0x5d8a43, 0x6b9a4c, 0x557f3d].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, side: THREE.DoubleSide })
    );
    const leaf = leafGeometry({ length: 0.055, width: 0.045, bend: -0.25, cup: 0.18, profile: heartProfile });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5f7f3e, roughness: 0.6 });

    // crown of leaves arching out over the rim of the pot
    const crownLeaf = leafGeometry({ length: 0.055, width: 0.045, bend: -0.55, cup: 0.18, profile: heartProfile });
    for (let i = 0; i < 20; i++) {
      const holder = new THREE.Group();
      const a = (i / 20) * Math.PI * 2 + rand() * 0.4;
      const inner = i % 3 === 0;
      const r = inner ? 0.012 : 0.03;
      holder.position.set(potX + Math.cos(a) * r, 0.066 + (inner ? 0.025 : rand() * 0.012), Math.sin(a) * r);
      holder.rotation.y = Math.PI / 2 - a; // local +Z points radially outward
      const mesh = new THREE.Mesh(crownLeaf, leafMats[i % leafMats.length]);
      mesh.rotation.x = inner ? 0.7 + rand() * 0.4 : 1.15 + rand() * 0.5;
      mesh.scale.setScalar(0.75 + rand() * 0.45);
      holder.add(mesh);
      this.group.add(holder);
    }

    // vines trailing over the front edge of the shelf
    // the long vine trails down the left of the book row; the two above the
    // books stay short enough that their lowest leaves clear the tallest spine
    const vines = [
      { x: -0.15, drop: 0.3, sway: -0.02 },
      { x: 0.0, drop: 0.09, sway: 0.03 },
      { x: 0.1, drop: 0.11, sway: 0.05 },
    ];
    for (const { x, drop, sway } of vines) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(potX, 0.06, 0.01),
        new THREE.Vector3(x, 0.04, 0.06),
        new THREE.Vector3(x + sway * 0.3, -0.01, 0.075),
        new THREE.Vector3(x + sway * 0.7, -drop * 0.5, 0.08),
        new THREE.Vector3(x + sway, -drop, 0.075),
      ]);
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0017, 5), stemMat));
      const steps = Math.floor(drop / 0.032) + 2;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 0.3);
        const side = s % 2 ? 1 : -1;
        const mesh = new THREE.Mesh(leaf, leafMats[(s + vines.length) % leafMats.length]);
        mesh.position.copy(curve.getPoint(t));
        // hang downward, facing out into the room, alternating sides
        mesh.rotation.set(0.25 + rand() * 0.3, side * 0.35, Math.PI + side * (0.6 + rand() * 0.3));
        mesh.scale.setScalar(0.6 + (1 - t) * 0.35);
        this.group.add(mesh);
      }
    }

    enableShadows(this.group);
    this.interactable = {
      id: 'plant',
      label: 'Pothos',
      sub: 'Trailing a little further every week',
      hitObject: this.group,
      outline: true,
    };
    this.focusSpec = { center: [0.02, -0.03, 0.04], distance: 0.55, elevation: 4 };
  }
}
