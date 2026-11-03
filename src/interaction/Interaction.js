import * as THREE from 'three';

const CLICK_TOLERANCE = 6; // px a pointer may travel and still count as a click

/**
 * Registry of clickable objects. Handles hover (outline + tooltip),
 * click-to-focus and Esc/back to return to the seated view.
 *
 * An interactable is `{ id, label, sub, hitObject, outline, focus, onActivate? }`.
 * `onActivate` runs on a click while that object is already in focus;
 * `actionLabel()` is the tooltip shown for that click.
 */
export class Interaction {
  constructor({ camera, dom, rig, onHover, onFocusChange }) {
    this.camera = camera;
    this.dom = dom;
    this.rig = rig;
    this.onHover = onHover;
    this.onFocusChange = onFocusChange;

    this.items = [];
    this.hovered = null;
    this.active = null;
    this.enabled = false;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointerPx = { x: 0, y: 0 };
    this.downAt = null;

    dom.addEventListener('pointermove', (e) => this.handleMove(e));
    dom.addEventListener('pointerdown', (e) => (this.downAt = { x: e.clientX, y: e.clientY }));
    dom.addEventListener('pointerup', (e) => this.handleUp(e));
    dom.addEventListener('pointerleave', () => this.setHovered(null));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.back();
    });
  }

  register(item) {
    item.hitObject.traverse((o) => (o.userData.interactableId = item.id));
    this.items.push(item);
  }

  unregister(item) {
    this.items = this.items.filter((i) => i !== item);
    if (this.hovered === item) this.setHovered(null);
    if (this.active === item) this.back();
  }

  pick(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(
      this.items.map((i) => i.hitObject),
      true
    )[0];
    if (!hit) return null;
    return this.items.find((i) => i.id === hit.object.userData.interactableId) ?? null;
  }

  handleMove(e) {
    this.pointerPx = { x: e.clientX, y: e.clientY };
    if (!this.enabled) return;
    this.setHovered(this.pick(e.clientX, e.clientY));
  }

  setHovered(item) {
    // an object you're already looking at only stays "hoverable" if it does something
    if (item && item === this.active && !item.onActivate) item = null;
    if (item === this.hovered) {
      this.onHover?.(item, this.pointerPx);
      return;
    }
    this.hovered = item;
    this.dom.style.cursor = item ? 'pointer' : '';
    this.onHover?.(item, this.pointerPx);
  }

  handleUp(e) {
    if (!this.enabled || !this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > CLICK_TOLERANCE) return;

    const item = this.pick(e.clientX, e.clientY);
    if (!item) return;
    if (item === this.active) item.onActivate?.();
    else this.focus(item);
  }

  focus(item) {
    this.active = item;
    this.rig.moveTo(item.focus);
    this.setHovered(null);
    this.onFocusChange?.(item);
  }

  back() {
    if (!this.active) return;
    this.active = null;
    this.rig.goHome();
    this.onFocusChange?.(null);
  }
}
