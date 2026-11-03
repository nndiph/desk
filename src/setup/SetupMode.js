import * as THREE from 'three';
import gsap from 'gsap';
import { DESK, SETUP_VIEW } from '../config.js';
import { CATALOG, DEFAULT_LAYOUT, createDeskProp, disposeProp, placeOnDesk } from '../objects/props/index.js';
import { clampToDesk, findFreeSpot, isFree } from './footprint.js';
import { clearLayout } from './storage.js';

const ROTATE_STEP = Math.PI / 12; // 15°
const LIFT = 0.012; // how far a picked-up object floats above the desk
const DRAG_THRESHOLD = 0.002;
const OK_COLOR = 0xffcf94;
const BLOCKED_COLOR = 0xff6b5a;

/**
 * "Arrange" mode: the camera stands over the desk and objects can be dragged,
 * rotated, removed and added from a tray. Every change is saved to this browser.
 */
export class SetupMode {
  constructor({ experience, ui }) {
    this.xp = experience;
    this.ui = ui;
    this.active = false;
    this.selected = null;
    this.hovered = null;
    this.drag = null;
    this.wheelAccum = 0;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DESK.height);
    this.hit = new THREE.Vector3();
    this.screen = new THREE.Vector3();

    const dom = experience.canvas;
    dom.addEventListener('pointerdown', (e) => this.onDown(e));
    dom.addEventListener('pointermove', (e) => this.onMove(e));
    dom.addEventListener('pointerup', (e) => this.onUp(e));
    dom.addEventListener('pointercancel', (e) => this.onUp(e));
    dom.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.onKey(e));

    ui.arrangeBtn.addEventListener('click', () => (this.active ? this.exit() : this.enter()));
    ui.resetBtn.addEventListener('click', () => this.reset());
    ui.setupChips.addEventListener('click', (e) => {
      const type = e.target.closest('[data-type]')?.dataset.type;
      if (type) this.add(type);
    });
    ui.selbar.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ccw') this.rotate(this.selected, 1);
      if (act === 'cw') this.rotate(this.selected, -1);
      if (act === 'remove') this.remove(this.selected);
    });

    this.renderTray();
  }

  /** Everything that stands on the desk and can be moved; the lamp can't be removed. */
  get placeables() {
    return [this.xp.lamp, ...this.xp.props];
  }

  obstaclesFor(prop) {
    return this.placeables.filter((p) => p !== prop).map((p) => ({ footprint: p.footprint, placement: p.placement }));
  }

  // ---------- mode ----------

  enter() {
    if (this.active) return;
    this.active = true;
    const { interaction, rig, post } = this.xp;
    interaction.back();
    interaction.setHovered(null);
    interaction.enabled = false;
    rig.moveTo(this.setupView(), { parallax: 0, duration: 1.4 });
    post.setFocusMode(false);
    document.body.classList.add('is-arranging');
    this.ui.arrangeBtn.textContent = 'done';
    this.renderTray();
  }

  /** Overhead view; portrait screens step further back so the whole desk fits. */
  setupView() {
    const aspect = window.innerWidth / window.innerHeight;
    const back = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
    const target = new THREE.Vector3(...SETUP_VIEW.target);
    const position = new THREE.Vector3(...SETUP_VIEW.position).sub(target).multiplyScalar(back).add(target);
    return { position, target };
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.select(null);
    this.hovered = null;
    this.xp.canvas.style.cursor = '';
    this.xp.post.setOutline(null);
    this.xp.rig.goHome({ duration: 1.4 });
    this.xp.interaction.enabled = true;
    document.body.classList.remove('is-arranging');
    this.ui.arrangeBtn.textContent = 'arrange';
  }

  // ---------- picking ----------

  aim(e) {
    const rect = this.xp.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.xp.camera);
  }

  pick(e) {
    this.aim(e);
    const groups = this.placeables.map((p) => p.group);
    const hit = this.raycaster.intersectObjects(groups, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !groups.includes(o)) o = o.parent;
    return this.placeables.find((p) => p.group === o) ?? null;
  }

  deskPoint(e) {
    this.aim(e);
    return this.raycaster.ray.intersectPlane(this.deskPlane, this.hit);
  }

  // ---------- pointer ----------

  onDown(e) {
    if (!this.active || e.button !== 0) return;
    const prop = this.pick(e);
    this.select(prop);
    const point = prop && this.deskPoint(e);
    if (!point) return;

    this.drag = {
      prop,
      dx: point.x - prop.placement.x,
      dz: point.z - prop.placement.z,
      candidate: { ...prop.placement },
      valid: true,
      moved: false,
    };
    this.xp.canvas.setPointerCapture(e.pointerId);
    this.xp.canvas.style.cursor = 'grabbing';
    this.stopTweens(prop);
    gsap.to(prop.group.position, { y: DESK.height + LIFT, duration: 0.15, ease: 'power2.out' });
  }

  onMove(e) {
    if (!this.active) return;
    const { drag } = this;
    if (!drag) {
      this.hovered = this.pick(e);
      this.xp.canvas.style.cursor = this.hovered ? 'grab' : '';
      this.refreshOutline();
      return;
    }

    const point = this.deskPoint(e);
    if (!point) return;
    const { prop } = drag;
    const candidate = clampToDesk(prop.footprint, {
      x: point.x - drag.dx,
      z: point.z - drag.dz,
      rotY: prop.placement.rotY,
    });
    drag.moved ||= Math.hypot(candidate.x - prop.placement.x, candidate.z - prop.placement.z) > DRAG_THRESHOLD;
    drag.candidate = candidate;
    drag.valid = isFree(prop.footprint, candidate, this.obstaclesFor(prop));
    prop.group.position.x = candidate.x;
    prop.group.position.z = candidate.z;
    this.refreshOutline();
  }

  onUp(e) {
    const { drag } = this;
    if (!this.active || !drag) return;
    this.drag = null;
    if (this.xp.canvas.hasPointerCapture(e.pointerId)) this.xp.canvas.releasePointerCapture(e.pointerId);
    this.xp.canvas.style.cursor = 'grab';

    const { prop } = drag;
    this.stopTweens(prop);
    if (drag.moved && drag.valid) {
      prop.placement = { ...drag.candidate };
      gsap.to(prop.group.position, { y: DESK.height, duration: 0.18, ease: 'power2.in', onComplete: () => this.settle(prop) });
      this.xp.saveLayout();
    } else {
      // blocked (or just a click): settle back where it was
      gsap.to(prop.group.position, {
        x: prop.placement.x,
        y: DESK.height,
        z: prop.placement.z,
        duration: drag.moved ? 0.35 : 0.15,
        ease: 'power2.out',
        onComplete: () => this.settle(prop),
      });
      if (drag.moved) this.toast('no room there');
    }
    this.refreshOutline();
  }

  onWheel(e) {
    const target = this.active && !this.drag && (this.hovered ?? this.selected);
    if (!target) return;
    e.preventDefault();
    this.wheelAccum += e.deltaY;
    if (Math.abs(this.wheelAccum) < 60) return;
    this.rotate(target, this.wheelAccum > 0 ? -1 : 1);
    this.wheelAccum = 0;
  }

  onKey(e) {
    if (!this.active || this.drag) return;
    const key = e.key.toLowerCase();
    if (key === 'q') this.rotate(this.selected, 1);
    else if (key === 'e') this.rotate(this.selected, -1);
    else if (key === 'delete' || key === 'backspace') this.remove(this.selected);
    else if (key === 'escape') this.selected ? this.select(null) : this.exit();
  }

  // ---------- actions ----------

  select(prop) {
    this.selected = prop;
    const { selbar, selName, selRemove } = this.ui;
    selbar.classList.toggle('is-visible', Boolean(prop));
    if (prop) {
      selName.textContent = prop.interactable.label;
      selRemove.disabled = prop === this.xp.lamp;
      prop.topHeight ??= Math.min(0.3, new THREE.Box3().setFromObject(prop.group).max.y - DESK.height);
    }
    this.refreshOutline();
  }

  /** dir: +1 counter-clockwise, -1 clockwise (seen from above). */
  rotate(prop, dir) {
    if (!prop) return;
    const { rotY } = prop.placement;
    const target = clampToDesk(prop.footprint, { ...prop.placement, rotY: rotY + dir * ROTATE_STEP });
    if (!isFree(prop.footprint, target, this.obstaclesFor(prop))) {
      gsap.fromTo(prop.group.rotation, { y: rotY + dir * 0.08 }, { y: rotY, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
      this.toast('not enough room to turn it');
      return;
    }
    prop.placement = target;
    this.stopTweens(prop);
    gsap.to(prop.group.rotation, { y: target.rotY, duration: 0.25, ease: 'power2.out' });
    gsap.to(prop.group.position, {
      x: target.x,
      y: DESK.height,
      z: target.z,
      duration: 0.25,
      ease: 'power2.out',
      onComplete: () => this.settle(prop),
    });
    this.xp.saveLayout();
  }

  /** Snap an object exactly onto its current placement (and refresh its close-up). */
  settle(prop) {
    placeOnDesk(prop, prop.placement);
  }

  /** Cancel in-flight moves so a stale animation can't land after a newer action. */
  stopTweens(prop) {
    gsap.killTweensOf([prop.group.position, prop.group.rotation]);
  }

  remove(prop) {
    if (!prop) return;
    if (prop === this.xp.lamp) {
      this.toast('the lamp stays — it lights everything');
      return;
    }
    this.select(null);
    if (this.hovered === prop) this.hovered = null;
    gsap.to(prop.group.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: 0.25,
      ease: 'back.in(2)',
      onComplete: () => {
        this.xp.removeProp(prop);
        this.xp.saveLayout();
        this.renderTray();
      },
    });
  }

  add(type) {
    if (this.count(type) >= CATALOG[type].limit) return;
    const prop = createDeskProp(type);
    const spot = findFreeSpot(prop.footprint, this.obstaclesFor(prop));
    if (!spot) {
      disposeProp(prop);
      this.toast('the desk is full — remove something first');
      return;
    }
    this.xp.addProp(prop, spot);
    // drop in from just above the desk
    prop.group.position.y = DESK.height + 0.12;
    prop.group.scale.setScalar(0.7);
    gsap.to(prop.group.position, { y: DESK.height, duration: 0.5, ease: 'bounce.out' });
    gsap.to(prop.group.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2)' });
    this.select(prop);
    this.xp.saveLayout();
    this.renderTray();
  }

  /** Two taps: the first arms it, the second puts the reference set-up back. */
  reset() {
    const { resetBtn } = this.ui;
    if (!this.resetArmed) {
      this.resetArmed = true;
      resetBtn.textContent = 'tap again to reset';
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.resetArmed = false;
        resetBtn.textContent = 'reset';
      }, 3000);
      return;
    }
    this.resetArmed = false;
    resetBtn.textContent = 'reset';
    this.select(null);
    this.hovered = null;
    for (const prop of [...this.xp.props]) this.xp.removeProp(prop);
    placeOnDesk(this.xp.lamp, DEFAULT_LAYOUT.lamp);
    for (const { type, uid, ...placement } of DEFAULT_LAYOUT.items) this.xp.addProp(createDeskProp(type, uid), placement);
    clearLayout();
    this.renderTray();
    this.toast('back to the original desk');
  }

  // ---------- ui ----------

  count(type) {
    return this.xp.props.filter((p) => p.type === type).length;
  }

  renderTray() {
    this.ui.setupChips.innerHTML = Object.entries(CATALOG)
      .map(([type, { label, limit }]) => {
        const full = this.count(type) >= limit;
        return `<button class="chip" type="button" data-type="${type}" ${full ? 'disabled' : ''}><span aria-hidden="true">+</span> ${label}</button>`;
      })
      .join('');
  }

  refreshOutline() {
    if (!this.active) return;
    const { post } = this.xp;
    if (this.drag) {
      post.setOutline(this.drag.prop.group, this.drag.valid ? OK_COLOR : BLOCKED_COLOR);
      return;
    }
    const objects = [this.selected, this.hovered].filter(Boolean).map((p) => p.group);
    post.setOutline([...new Set(objects)], OK_COLOR);
  }

  toast(message) {
    const { toast } = this.ui;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  /** Keeps the selection toolbar floating above the selected object. */
  update() {
    if (!this.active || !this.selected) return;
    const { group, topHeight } = this.selected;
    this.screen.set(group.position.x, DESK.height + topHeight, group.position.z).project(this.xp.camera);
    const { selbar } = this.ui;
    const half = selbar.offsetWidth / 2;
    const pad = 8;
    // keep the toolbar fully on screen near the edges
    const x = THREE.MathUtils.clamp(((this.screen.x + 1) / 2) * window.innerWidth, half + pad, window.innerWidth - half - pad);
    const y = Math.max(selbar.offsetHeight + 20, ((1 - this.screen.y) / 2) * window.innerHeight);
    selbar.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 14px))`;
  }
}
