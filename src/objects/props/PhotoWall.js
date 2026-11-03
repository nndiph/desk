import * as THREE from 'three';
import gsap from 'gsap';
import { makeFocus } from '../../utils/focus.js';
import { ProjectedOverlay, planeCorners } from '../../utils/overlay.js';
import { NOTE_PAD_X, POLAROID, noteTexture, placeholderPicture, polaroidTexture } from '../../utils/paint.js';
import { load, save } from '../../utils/persist.js';
import { importImage, loadPhotos, savePhoto } from '../../utils/photoStore.js';

const PIN_COLORS = [0xd98f6b, 0xe8d9c3, 0x8f9f86, 0xd9b3a4];
const TAPE_COLORS = [0xe9c9b8, 0xc9d3bd, 0xe8dcb5, 0xd7cbe0];
const STICKY_COLORS = ['#f3e6c4', '#e3e8d2'];

// Positions are wall-space: x across the wall, y = height from the floor.

const POLAROID_W = 0.095;
const POLAROID_H = POLAROID_W * (POLAROID.height / POLAROID.width);

/**
 * The collage: two loose rows of four polaroids, pinned or taped, slightly
 * askew, with roughly 2.5–3 cm of wall between neighbours.
 */
const FRAMES = [
  { x: -0.2, y: 1.325, scale: 1.05, rot: 0.04, tape: true, kind: 'street', caption: 'late nights' },
  { x: -0.075, y: 1.335, scale: 1, rot: -0.05, tape: false, kind: 'sky', caption: 'slow sundays' },
  { x: 0.05, y: 1.32, scale: 1.1, rot: 0.03, tape: true, kind: 'sea', caption: 'somewhere warm' },
  { x: 0.175, y: 1.335, scale: 1, rot: 0.05, tape: false, kind: 'path', caption: 'the long way' },
  { x: -0.14, y: 1.165, scale: 1, rot: -0.03, tape: false, kind: 'city', caption: 'city lights' },
  { x: -0.015, y: 1.155, scale: 1.05, rot: 0.04, tape: true, kind: 'path', caption: 'home' },
  { x: 0.11, y: 1.17, scale: 1, rot: -0.04, tape: false, kind: 'sky', caption: 'little things' },
  { x: 0.235, y: 1.16, scale: 1.05, rot: 0.03, tape: true, kind: 'sea', caption: 'golden hour' },
];

/** The one hand-written note kept from before, at the top-right of the collage. */
const NOTE_TO_SELF = {
  x: 0.295, y: 1.33, w: 0.08, h: 0.1, rot: -0.03, label: 'Note to self', size: 40, titled: true,
  text: 'Note to self\n• keep going\n• everything\n   takes time\n• you got this ♡',
};

/** Room for a couple of sticky notes in the top corners (clear of the lamp head and plant). */
const SLOTS = [
  { x: 0.37, y: 1.44, rot: -0.04 },
  { x: -0.27, y: 1.44, rot: 0.03 },
];

/** Paper slightly curling away from the wall at the bottom. */
function paperGeometry(w, h, curl = 0.006) {
  const geometry = new THREE.PlaneGeometry(w, h, 1, 6);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const fromTop = 0.5 - pos.getY(i) / h; // 0 at top → 1 at bottom
    pos.setZ(i, curl * fromTop * fromTop);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const pinGeometry = new THREE.SphereGeometry(0.0045, 16, 12);
const tapeGeometry = new THREE.PlaneGeometry(0.036, 0.012);

/**
 * The wall above the desk as a photo wall. Every polaroid can hold one of the
 * viewer's own photos with a hand-written caption; a note-to-self and a couple
 * of sticky notes sit at the edges.
 */
export class PhotoWall {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'photoWall';
    this.layer = 0;
    this.photos = FRAMES.map((frame, slot) => this.createPolaroid(frame, slot));

    const noteData = load('notes', { texts: {}, stickies: [] });
    this.noteData = {
      texts: noteData.texts ?? {},
      stickies: (noteData.stickies ?? []).filter((s) => s.slot < SLOTS.length),
    };
    this.notes = [];
    this.createNote('self', NOTE_TO_SELF, this.noteData.texts.self ?? NOTE_TO_SELF.text);
    for (const sticky of this.noteData.stickies) this.createSticky(sticky);

    this.interactable = {
      id: 'board',
      label: 'Photo wall',
      sub: 'Your favourite moments — click a photo to change it or write its caption',
      hitObject: this.group,
      outline: true,
      actions: [
        { label: '+ add photos', run: () => this.pickPhotos() },
        { label: '+ sticky note', run: () => this.addSticky(), disabled: () => this.freeSlot() === undefined },
      ],
    };
    this.focusSpec = { center: [0.05, 1.25, 0], distance: 0.72, elevation: 0, azimuth: 0 };

    this.restore();
  }

  /** Called once the wall is in the scene: hook up clicks, the file picker and the lightbox. */
  connect(experience) {
    this.xp = experience;
    this.input = experience.ui.photoInput;
    this.input.addEventListener('change', () => this.onFilesPicked());
    for (const item of [...this.photos, ...this.notes]) this.register(item);
  }

  // ---------- building ----------

  paper({ x, y, w, h, rot }, material, curl) {
    const mesh = new THREE.Mesh(paperGeometry(w, h, curl), material);
    mesh.position.set(x, y, 0.002 + this.layer++ * 0.0004);
    mesh.rotation.z = rot;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  pin(mesh, h) {
    const pin = new THREE.Mesh(
      pinGeometry,
      new THREE.MeshStandardMaterial({ color: PIN_COLORS[this.layer % PIN_COLORS.length], roughness: 0.3 })
    );
    pin.position.set(0, h / 2 - 0.011, 0.004);
    pin.castShadow = true;
    mesh.add(pin);
  }

  tape(mesh, h) {
    const strip = new THREE.Mesh(
      tapeGeometry,
      new THREE.MeshStandardMaterial({
        color: TAPE_COLORS[this.layer % TAPE_COLORS.length],
        roughness: 0.8,
        transparent: true,
        opacity: 0.82,
      })
    );
    strip.position.set(0, h / 2 - 0.002, 0.0012);
    strip.rotation.z = (this.layer % 2 ? 1 : -1) * 0.12;
    mesh.add(strip);
  }

  createPolaroid(frame, slot) {
    const w = POLAROID_W * frame.scale;
    const h = POLAROID_H * frame.scale;
    const texture = polaroidTexture();
    const mesh = this.paper({ ...frame, w, h }, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }), 0.004);
    mesh.castShadow = false;
    frame.tape ? this.tape(mesh, h) : this.pin(mesh, h);

    const photo = {
      slot,
      w,
      h,
      mesh,
      texture,
      placeholder: placeholderPicture(frame.kind, slot * 7 + 3),
      picture: null, // the viewer's own image (canvas/bitmap), when there is one
      blob: null,
      caption: frame.caption,
    };
    photo.corners = planeCorners(mesh, w, h);
    photo.interactable = {
      id: `photo-${slot}`,
      label: 'Photo',
      sub: 'Write a caption on the white strip · click the photo to see it bigger',
      hitObject: mesh,
      outline: true,
      onFocus: () => this.openCaption(photo),
      onBlur: () => this.closeCaption(photo),
      onActivate: () => this.view(photo),
      actionLabel: () => 'view larger',
      actions: [
        { label: photo.picture ? 'change photo' : 'choose photo', run: () => this.pickPhotos(photo) },
        { label: 'view larger', run: () => this.view(photo) },
        { label: 'remove photo', run: () => this.removePhoto(photo), disabled: () => !photo.picture },
      ],
    };
    this.drawPolaroid(photo);
    return photo;
  }

  drawPolaroid(photo, hideCaption = false) {
    photo.texture.draw({ picture: photo.picture ?? photo.placeholder, caption: photo.caption, hideCaption });
  }

  createNote(key, spec, text, { sticky = null } = {}) {
    const height = spec.height ?? 480;
    const texture = noteTexture({ ...spec, height, seed: key.length * 7 + 3 });
    const mesh = this.paper(spec, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    this.pin(mesh, spec.h);

    const note = { key, spec, height, mesh, texture, text, sticky };
    note.corners = planeCorners(mesh, spec.w, spec.h);
    note.interactable = {
      id: `note-${key}`,
      label: spec.label,
      sub: 'Click on the paper and write — it saves itself',
      hitObject: mesh,
      outline: true,
      onFocus: () => this.openNote(note),
      onBlur: () => this.closeNote(note),
      actions: sticky ? [{ label: 'remove note', run: () => this.removeSticky(note) }] : [],
    };
    texture.draw({ text });
    this.notes.push(note);
    return note;
  }

  createSticky(sticky) {
    const spec = {
      ...SLOTS[sticky.slot],
      w: 0.07,
      h: 0.07,
      label: 'Sticky note',
      paper: sticky.color,
      size: 46,
      top: 120,
      height: 360,
    };
    return this.createNote(`sticky-${sticky.slot}`, spec, sticky.text, { sticky });
  }

  /** Close-up pose straight in front of a photo or note, then make it clickable. */
  register(item) {
    item.mesh.updateMatrixWorld(true);
    const center = item.mesh.getWorldPosition(new THREE.Vector3());
    const { w, h } = item.spec ?? item;
    item.interactable.focus = makeFocus(center, { distance: Math.max(h, w * 1.25) * 2.15, elevation: 0, azimuth: 0 });
    // registered after the wall itself, so each piece's own id wins on its meshes
    this.xp.interaction.register(item.interactable);
  }

  // ---------- photos ----------

  async restore() {
    for (const record of await loadPhotos()) {
      const photo = this.photos[record.slot];
      if (!photo) continue;
      photo.caption = record.caption ?? photo.caption;
      if (record.blob) {
        try {
          photo.picture = await createImageBitmap(record.blob);
          photo.blob = record.blob;
        } catch {
          // unreadable image: keep the placeholder
        }
      }
      this.drawPolaroid(photo);
      this.refreshPhotoActions(photo);
    }
  }

  persistPhoto(photo) {
    savePhoto({ slot: photo.slot, blob: photo.blob, caption: photo.caption });
  }

  /** Open the file picker for one photo, or (no argument) to fill the wall. */
  pickPhotos(photo = null) {
    this.pickTarget = photo;
    this.input.multiple = !photo;
    this.input.value = '';
    this.input.click();
  }

  async onFilesPicked() {
    const files = [...this.input.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    // fill frames that still show a stand-in first, in collage order
    const targets = this.pickTarget ? [this.pickTarget] : this.photos.filter((p) => !p.picture);
    if (!targets.length) {
      this.xp.setup.toast('every frame has a photo — click one to change it');
      return;
    }
    const used = files.slice(0, targets.length);
    for (const [i, file] of used.entries()) {
      try {
        const { blob, canvas } = await importImage(file);
        this.setPhoto(targets[i], canvas, blob);
      } catch {
        this.xp.setup.toast('that image couldn’t be opened');
      }
    }
    if (files.length > used.length) this.xp.setup.toast(`the wall is full — ${files.length - used.length} photo(s) left out`);
    this.xp.renderFocusActions();
  }

  setPhoto(photo, picture, blob) {
    photo.picture = picture;
    photo.blob = blob;
    const editing = photo.overlay?.element.classList.contains('is-visible');
    this.drawPolaroid(photo, editing);
    this.persistPhoto(photo);
    this.refreshPhotoActions(photo);
    // a little "fresh print" pop
    gsap.fromTo(photo.mesh.scale, { x: 0.85, y: 0.85 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2.5)' });
  }

  removePhoto(photo) {
    photo.picture = null;
    photo.blob = null;
    this.drawPolaroid(photo, photo.overlay?.element.classList.contains('is-visible'));
    this.persistPhoto(photo);
    this.refreshPhotoActions(photo);
  }

  refreshPhotoActions(photo) {
    photo.interactable.actions[0].label = photo.picture ? 'change photo' : 'choose photo';
  }

  view(photo) {
    this.xp.lightbox.open(photo.blob ?? photo.placeholder, photo.caption);
  }

  /** Caption editor laid over the polaroid's white strip. */
  openCaption(photo) {
    if (!photo.overlay) {
      const el = document.createElement('div');
      el.className = 'polaroid-edit';
      const input = document.createElement('input');
      input.maxLength = 28;
      input.placeholder = 'write a caption…';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Photo caption');
      Object.assign(input.style, {
        top: `${POLAROID.captionY - POLAROID.captionSize * 1.05}px`,
        left: `${POLAROID.pad}px`,
        width: `${POLAROID.width - POLAROID.pad * 2}px`,
        height: `${POLAROID.captionSize * 1.4}px`,
        fontSize: `${POLAROID.captionSize}px`,
      });
      input.addEventListener('input', () => {
        photo.caption = input.value;
        this.persistPhoto(photo);
      });
      input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
      el.append(input);
      photo.input = input;
      photo.overlay = new ProjectedOverlay(el, { width: POLAROID.width, height: POLAROID.height, corners: photo.corners });
    }
    photo.input.value = photo.caption;
    photo.overlay.show(0.9, () => this.drawPolaroid(photo, true));
  }

  closeCaption(photo) {
    photo.overlay?.hide();
    this.drawPolaroid(photo);
  }

  // ---------- notes ----------

  openNote(note) {
    if (!note.overlay) {
      const el = document.createElement('div');
      el.className = 'note-edit';
      const area = document.createElement('textarea');
      const { size = 50, top = 140, align = 'left' } = note.spec;
      Object.assign(area.style, {
        fontSize: `${size}px`,
        lineHeight: `${size * 1.2}px`,
        padding: `${top - size * 0.95}px ${NOTE_PAD_X}px 0`,
        textAlign: align,
      });
      area.maxLength = 140;
      area.spellcheck = false;
      area.setAttribute('aria-label', note.spec.label);
      area.addEventListener('input', () => {
        note.text = area.value;
        this.persistNote(note);
      });
      el.append(area);
      note.area = area;
      note.overlay = new ProjectedOverlay(el, { width: 360, height: note.height, corners: note.corners });
    }
    note.area.value = note.text;
    note.overlay.show(0.9, () => {
      note.texture.draw({ text: note.text, blank: true });
      note.area.focus({ preventScroll: true });
      note.area.setSelectionRange(note.text.length, note.text.length);
    });
  }

  closeNote(note) {
    note.overlay?.hide();
    note.texture.draw({ text: note.text });
  }

  persistNote(note) {
    if (note.sticky) note.sticky.text = note.text;
    else this.noteData.texts[note.key] = note.text;
    save('notes', this.noteData);
  }

  freeSlot() {
    const used = new Set(this.noteData.stickies.map((s) => s.slot));
    const slot = SLOTS.findIndex((_, i) => !used.has(i));
    return slot === -1 ? undefined : slot;
  }

  addSticky() {
    const slot = this.freeSlot();
    if (slot === undefined) return;
    const sticky = { slot, text: '', color: STICKY_COLORS[slot % STICKY_COLORS.length] };
    this.noteData.stickies.push(sticky);
    save('notes', this.noteData);

    const note = this.createSticky(sticky);
    this.register(note);
    // pinned on with a little flutter, then straight into writing
    gsap.from(note.mesh.scale, { x: 0.4, y: 0.4, z: 0.4, duration: 0.5, ease: 'back.out(2)' });
    gsap.from(note.mesh.rotation, { z: note.spec.rot + 0.4, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    this.xp.interaction.focus(note.interactable);
  }

  removeSticky(note) {
    const { interaction } = this.xp;
    interaction.focus(this.interactable); // step back to the whole wall first
    interaction.unregister(note.interactable);
    note.overlay?.dispose();
    gsap.to(note.mesh.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: 0.3,
      ease: 'back.in(2)',
      onComplete: () => {
        this.group.remove(note.mesh);
        note.mesh.geometry.dispose();
        note.mesh.material.dispose();
        note.texture.dispose();
      },
    });
    this.notes = this.notes.filter((n) => n !== note);
    this.noteData.stickies = this.noteData.stickies.filter((s) => s !== note.sticky);
    save('notes', this.noteData);
  }

  update(dt, t, camera) {
    for (const item of this.photos) item.overlay?.update(camera);
    for (const item of this.notes) item.overlay?.update(camera);
  }
}
