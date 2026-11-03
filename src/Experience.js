import * as THREE from 'three';
import gsap from 'gsap';
import { CameraRig } from './camera/CameraRig.js';
import { Interaction } from './interaction/Interaction.js';
import { Lighting } from './lighting/Lighting.js';
import { Desk } from './objects/Desk.js';
import { DeskLamp } from './objects/DeskLamp.js';
import { Room } from './objects/Room.js';
import {
  CATALOG,
  DEFAULT_LAYOUT,
  createDeskProp,
  createWallProps,
  disposeProp,
  placeOnDesk,
} from './objects/props/index.js';
import { Lightbox } from './apps/Lightbox.js';
import { TimerHud } from './apps/TimerHud.js';
import { timer } from './apps/services.js';
import { PostFX } from './post/PostFX.js';
import { measureFootprint } from './setup/footprint.js';
import { SetupMode } from './setup/SetupMode.js';
import { loadLayout, saveLayout } from './setup/storage.js';

/** Wires renderer, scene objects, camera, interaction and the render loop together. */
export class Experience {
  constructor({ canvas, ui }) {
    this.canvas = canvas;
    this.ui = ui;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // the composer multisamples instead
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping; // handled in PostFX

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 20);
    this.rig = new CameraRig(this.camera);

    this.lighting = new Lighting({ scene: this.scene, renderer: this.renderer });
    this.room = new Room();
    this.desk = new Desk({ anisotropy: this.renderer.capabilities.getMaxAnisotropy() });
    this.lamp = new DeskLamp();
    this.lamp.footprint = measureFootprint(this.lamp.group, this.lamp.footprintSize);
    this.scene.add(this.lighting.group, this.room.group, this.desk.group, this.lamp.group);

    this.post = new PostFX({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      focusTarget: this.rig.target,
    });

    this.interaction = new Interaction({
      camera: this.camera,
      dom: canvas,
      rig: this.rig,
      onHover: (item, px) => this.handleHover(item, px),
      onFocusChange: (item) => this.handleFocusChange(item),
    });
    // raycasting picks the nearest hit, so props on the desk win over the desk itself
    this.interaction.register(this.desk.interactable);

    // the viewer's saved arrangement, or the one from the reference photo
    const saved = loadLayout(Object.keys(CATALOG));
    const layout = saved ?? DEFAULT_LAYOUT;
    placeOnDesk(this.lamp, layout.lamp);
    this.interaction.register(this.lamp.interactable);
    this.props = [];
    for (const { type, uid, ...placement } of layout.items) this.addProp(createDeskProp(type, uid), placement);
    if (saved) this.saveLayout(); // keeps any ids handed out just now

    this.lightbox = new Lightbox(ui.lightbox);
    this.wallProps = createWallProps();
    for (const prop of this.wallProps) {
      this.scene.add(prop.group);
      this.interaction.register(prop.interactable);
      prop.connect?.(this);
    }

    this.setup = new SetupMode({ experience: this, ui });
    ui.backBtn.addEventListener('click', () => this.interaction.back());

    this.focused = null;
    this.timerHud = new TimerHud({
      element: ui.timerChip,
      label: ui.timerChipText,
      isSuppressed: () => Boolean(this.focused?.showsTimer),
      onOpen: () => {
        const laptop = this.props.find((p) => p.type === 'laptop');
        if (laptop && !this.setup.active) this.interaction.focus(laptop.interactable);
      },
    });

    this.clock = new THREE.Clock();
    this.lampAim = new THREE.Vector3();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Put a desk object into the scene at `placement` and make it clickable. */
  addProp(prop, placement) {
    placeOnDesk(prop, placement);
    this.props.push(prop);
    this.scene.add(prop.group);
    this.interaction.register(prop.interactable);
    return prop;
  }

  removeProp(prop) {
    this.props = this.props.filter((p) => p !== prop);
    this.interaction.unregister(prop.interactable);
    this.scene.remove(prop.group);
    disposeProp(prop);
  }

  saveLayout() {
    saveLayout({
      lamp: this.lamp.placement,
      items: this.props.map((p) => ({ type: p.type, uid: p.uid, ...p.placement })),
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.rig.resize(w / h);
  }

  handleHover(item, px) {
    this.post.setOutline(item?.outline ? item.hitObject : null);
    const { tooltip } = this.ui;
    if (!item) {
      tooltip.classList.remove('is-visible');
      return;
    }
    const text = item === this.interaction.active && item.actionLabel ? item.actionLabel() : item.label;
    tooltip.textContent = text;
    tooltip.style.transform = `translate(${px.x + 16}px, ${px.y + 14}px)`;
    tooltip.classList.add('is-visible');
  }

  handleFocusChange(item) {
    const { focus, focusTitle, focusSub, hint } = this.ui;
    // let the object we're leaving tidy up (save, hide its editor) before the next one opens
    if (this.focused !== item) {
      this.focused?.onBlur?.();
      this.focused = item;
      item?.onFocus?.();
    }
    this.post.setFocusMode(Boolean(item));
    if (item) {
      focusTitle.textContent = item.label;
      focusSub.textContent = item.sub;
    }
    focus.classList.toggle('is-visible', Boolean(item));
    hint.style.opacity = item ? 0 : 1;
    this.renderFocusActions();
    this.timerHud.render();
  }

  /** Extra buttons an object offers while in focus (e.g. "+ new sticky note"). */
  renderFocusActions() {
    const buttons = (this.focused?.actions ?? []).map((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'focus__action';
      button.textContent = action.label;
      button.disabled = action.disabled?.() ?? false;
      button.addEventListener('click', () => {
        action.run();
        this.renderFocusActions();
      });
      return button;
    });
    this.ui.focusActions.replaceChildren(...buttons);
  }

  /** Compile shaders behind the loader, then fade in and flick the lamp on. */
  async start() {
    this.rig.update(0);
    // don't let a slow driver keep the loader up forever
    await Promise.race([
      this.renderer.compileAsync(this.scene, this.camera),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    this.renderer.setAnimationLoop(() => this.tick());

    gsap.to(this.ui.loader, {
      opacity: 0,
      duration: 1.2,
      delay: 0.3,
      ease: 'power2.out',
      onComplete: () => this.ui.loader.remove(),
    });
    gsap.delayedCall(0.9, () => {
      this.lamp.switchOn();
      this.interaction.enabled = true;
      this.ui.arrangeBtn.classList.add('is-visible');
    });
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;
    this.rig.update(dt);
    this.camera.updateMatrixWorld(); // overlays project with this frame's camera
    this.lighting.update(this.lamp.power, this.lamp.aimWorld(this.lampAim));
    timer.tick();
    for (const prop of this.props) prop.update?.(dt, elapsed, this.camera);
    for (const prop of this.wallProps) prop.update?.(dt, elapsed, this.camera);
    this.setup.update();
    this.post.render(dt);
  }
}
