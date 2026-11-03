import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  OutlineEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import gsap from 'gsap';

const OUTLINE_COLOR = 0xffcf94;

/** Photographic finish: soft DOF, bulb bloom, warm hover outline, ACES, vignette and grain. */
export class PostFX {
  constructor({ renderer, scene, camera, focusTarget }) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: Math.min(4, renderer.capabilities.maxSamples),
    });
    this.composer.addPass(new RenderPass(scene, camera));

    this.dof = new DepthOfFieldEffect(camera, {
      focusRange: 1.4,
      bokehScale: 1.2,
      resolutionScale: 0.5,
    });
    this.dof.target = focusTarget;

    this.bloom = new BloomEffect({
      mipmapBlur: true,
      intensity: 0.6,
      luminanceThreshold: 0.95,
      luminanceSmoothing: 0.3,
      radius: 0.75,
    });

    this.outline = new OutlineEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      edgeStrength: 3,
      visibleEdgeColor: OUTLINE_COLOR,
      hiddenEdgeColor: 0x000000,
      blur: true,
      xRay: false,
    });

    const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.62 });
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    grain.blendMode.opacity.value = 0.06;

    this.composer.addPass(new EffectPass(camera, this.dof));
    this.composer.addPass(new EffectPass(camera, this.bloom, this.outline, toneMapping, vignette, grain));
  }

  /** Outline one object, several, or none (`null`), optionally in another color. */
  setOutline(objects, color = OUTLINE_COLOR) {
    const meshes = [];
    for (const object of [].concat(objects ?? [])) object.traverse((o) => o.isMesh && meshes.push(o));
    this.outline.selection.set(meshes);
    this.outline.visibleEdgeColor.set(color);
  }

  /** Shallower focus for close-ups, a gentle one for the seated view. */
  setFocusMode(closeUp) {
    gsap.to(this.dof.cocMaterial, { focusRange: closeUp ? 0.45 : 1.4, duration: 1.2, ease: 'power2.inOut' });
    gsap.to(this.dof, { bokehScale: closeUp ? 2.4 : 1.2, duration: 1.2, ease: 'power2.inOut' });
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
  }

  render(dt) {
    this.composer.render(dt);
  }
}
