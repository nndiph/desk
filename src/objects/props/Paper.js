import * as THREE from 'three';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TodoPage, todoId } from '../../apps/TodoPage.js';
import { enableShadows, pen, spiralBinding } from '../../utils/geometry.js';
import { ProjectedOverlay, planeCorners } from '../../utils/overlay.js';
import { TODO_PAGE, bookPageTexture, ginghamTexture, todoPageTexture } from '../../utils/paint.js';
import { load, save } from '../../utils/persist.js';

const PAGE_EDGE = new THREE.MeshStandardMaterial({ color: 0xece2cf, roughness: 0.9 });
const WIRE = new THREE.MeshStandardMaterial({ color: 0xc9c4bb, roughness: 0.3, metalness: 0.9 });

/** Height of an open book's page surface, `u` = 0 at the spine → 1 at the outer edge. */
function pageHeight(u, lift) {
  return lift * Math.pow(Math.sin((Math.min(1, u * 2.4) * Math.PI) / 2), 0.6) * (1 - 0.3 * u);
}

/** Curved page surface plus its visible front/back/outer edges, for one side of the spine. */
function openPageBlock({ width, depth, lift, side, map, base }) {
  const group = new THREE.Group();
  const segments = 28;

  const surface = new THREE.PlaneGeometry(width, depth, segments, 1);
  surface.rotateX(-Math.PI / 2);
  surface.translate((side * width) / 2, 0, 0);
  const pos = surface.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.abs(pos.getX(i)) / width;
    pos.setY(i, base + pageHeight(u, lift));
  }
  surface.computeVertexNormals();
  group.add(new THREE.Mesh(surface, new THREE.MeshStandardMaterial({ map, roughness: 0.85 })));

  // edges: a strip from the cover up to the page surface along z = ±depth/2 and the outer edge
  const verts = [];
  const quad = (a, b, c, d) => verts.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let s = 0; s < segments; s++) {
    const x0 = (side * width * s) / segments;
    const x1 = (side * width * (s + 1)) / segments;
    const y0 = base + pageHeight(s / segments, lift);
    const y1 = base + pageHeight((s + 1) / segments, lift);
    for (const z of [depth / 2, -depth / 2]) {
      quad([x0, base, z], [x1, base, z], [x1, y1, z], [x0, y0, z]);
    }
  }
  const outerY = base + pageHeight(1, lift);
  quad([side * width, base, -depth / 2], [side * width, base, depth / 2], [side * width, outerY, depth / 2], [side * width, outerY, -depth / 2]);
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  edges.computeVertexNormals();
  const edgeMat = PAGE_EDGE.clone();
  edgeMat.side = THREE.DoubleSide;
  group.add(new THREE.Mesh(edges, edgeMat));
  return group;
}

/** A paperback lying open in the middle of the desk. */
export class OpenBook {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'openBook';
    const width = 0.2;
    const depth = 0.28;
    const coverT = 0.003;

    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(width * 2 + 0.012, coverT, depth + 0.012),
      new THREE.MeshStandardMaterial({ color: 0xd6c3a6, roughness: 0.8 })
    );
    cover.position.y = coverT / 2;
    this.group.add(cover);

    this.group.add(
      openPageBlock({ width, depth, lift: 0.022, side: -1, map: bookPageTexture(21), base: coverT }),
      openPageBlock({ width, depth, lift: 0.022, side: 1, map: bookPageTexture(34, { heading: true }), base: coverT })
    );
    enableShadows(this.group);

    this.interactable = {
      id: 'book',
      label: 'Open book',
      sub: 'Currently reading — chapter three',
      hitObject: this.group,
      outline: true,
    };
    this.focusSpec = { center: [0, 0.02, 0], distance: 0.42, elevation: 62 };
  }
}

const STARTER_TODOS = ['finish chapter 3', 'water the pothos', 'call home ♡', 'sleep before 12'];

/**
 * Spiral notebook holding a real to-do list. Up close, an HTML editor is laid
 * over the page; the page texture shows the list in handwriting otherwise.
 */
export class Notebook {
  constructor({ uid = 'notebook' } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'notebook';
    const w = 0.19;
    const d = 0.26;
    const t = 0.01;

    this.storageKey = `notebook/${uid}`;
    const starter = uid === 'notebook-default' ? STARTER_TODOS : [];
    this.items = load(this.storageKey, starter.map((text) => ({ id: todoId(), text, done: false })));

    const block = new THREE.Mesh(new RoundedBoxGeometry(w, t, d, 2, 0.002), PAGE_EDGE);
    block.position.y = t / 2;
    this.pageTexture = todoPageTexture();
    const pageW = w - 0.004;
    const pageD = d - 0.004;
    this.page = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageD),
      new THREE.MeshStandardMaterial({ map: this.pageTexture, roughness: 0.85 })
    );
    this.page.rotation.x = -Math.PI / 2;
    this.page.position.y = t + 0.0003;
    this.pageCorners = planeCorners(this.page, pageW, pageD);
    this.drawPage();

    const binding = spiralBinding({ count: 17, spacing: 0.0145, radius: 0.0068, material: WIRE });
    binding.rotation.y = Math.PI / 2;
    binding.position.set(-w / 2 + 0.004, t / 2, 0);

    this.pen = pen({ body: 0x34343a });
    this.penRest = { x: 0.02, y: t + 0.0045, z: 0.02, rot: 0.75 };
    this.penAside = { x: w / 2 + 0.024, y: 0.0045, z: 0.03, rot: 1.5 };
    this.placePen(this.penRest);

    this.group.add(block, this.page, binding, this.pen);
    enableShadows(this.group);

    this.interactable = {
      id: 'notebook',
      label: 'Notebook',
      sub: 'Your to-do list — click a line to write, ○ to tick it off',
      hitObject: this.group,
      outline: true,
      onFocus: () => this.open(),
      onBlur: () => this.close(),
    };
    this.focusSpec = { center: [0, 0.01, 0], distance: 0.36, elevation: 64 };
  }

  get title() {
    return `${new Date().toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase()} — to do`;
  }

  drawPage(blank = false) {
    this.pageTexture.draw({ title: this.title, items: this.items, blank });
  }

  placePen({ x, y, z, rot }, animate = false) {
    if (!animate) {
      this.pen.position.set(x, y, z);
      this.pen.rotation.y = rot;
      return;
    }
    gsap.to(this.pen.position, { x, y, z, duration: 0.6, ease: 'power2.inOut' });
    gsap.to(this.pen.rotation, { y: rot, duration: 0.6, ease: 'power2.inOut' });
  }

  open() {
    if (!this.overlay) {
      this.editor = new TodoPage({
        title: this.title,
        items: this.items,
        onChange: () => save(this.storageKey, this.items),
      });
      this.overlay = new ProjectedOverlay(this.editor.element, {
        width: TODO_PAGE.width,
        height: TODO_PAGE.height,
        corners: this.pageCorners,
      });
    }
    this.editor.render();
    this.placePen(this.penAside, true);
    // swap the painted handwriting for the live editor once the camera has arrived
    this.overlay.show(0.9, () => this.drawPage(true));
  }

  close() {
    this.overlay?.hide();
    this.placePen(this.penRest, true);
    this.drawPage();
  }

  update(dt, t, camera) {
    this.overlay?.update(camera);
  }

  dispose() {
    this.overlay?.dispose();
  }
}

/** Gingham-covered planner with a silver pen. */
export class Planner {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'planner';
    const w = 0.18;
    const d = 0.24;
    const t = 0.014;

    const block = new THREE.Mesh(new RoundedBoxGeometry(w, t, d, 2, 0.003), PAGE_EDGE);
    block.position.y = t / 2;
    const cover = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: ginghamTexture(), roughness: 0.9 })
    );
    cover.rotation.x = -Math.PI / 2;
    cover.position.y = t + 0.0004;

    const binding = spiralBinding({ count: 14, spacing: 0.0125, radius: 0.0085, material: WIRE });
    binding.position.set(0, t / 2, -d / 2 + 0.005);

    const plannerPen = pen({ body: 0xe9e4dc, trim: 0xd8c7a2 });
    plannerPen.position.set(0.012, t + 0.0045, 0.035);
    plannerPen.rotation.y = 0.95;

    this.group.add(block, cover, binding, plannerPen);
    enableShadows(this.group);

    this.interactable = {
      id: 'planner',
      label: 'Planner',
      sub: 'Soon: plans for the week',
      hitObject: this.group,
      outline: true,
    };
    this.focusSpec = { center: [0, 0.01, 0], distance: 0.36, elevation: 62 };
  }
}
