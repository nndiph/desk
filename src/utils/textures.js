import * as THREE from 'three';

// --- tiny value-noise toolkit (seeded, optionally periodic for seamless tiling) ---

function createNoise(seed = 1) {
  const hash = (x, y) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const wrap = (v, p) => (p ? ((v % p) + p) % p : v);

  return (x, y, period = 0) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const x0 = wrap(xi, period);
    const x1 = wrap(xi + 1, period);
    const y0 = wrap(yi, period);
    const y1 = wrap(yi + 1, period);
    const a = hash(x0, y0);
    const b = hash(x1, y0);
    const c = hash(x0, y1);
    const d = hash(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise, x, y, octaves = 4, period = 0) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, period * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx, image: ctx.createImageData(width, height) };
}

const lerp = (a, b, t) => a + (b - a) * t;

function finishTexture(canvas, { srgb = false, anisotropy = 1, repeat } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/**
 * Light oak grain running along the texture's X axis.
 * Returns a color map plus a matching bump map.
 */
export function createWoodTextures({
  width = 2048,
  height = 1024,
  light = [214, 184, 150],
  dark = [170, 130, 94],
  seed = 7,
  anisotropy = 1,
} = {}) {
  const noise = createNoise(seed);
  const color = makeCanvas(width, height);
  const bump = makeCanvas(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // long, gently wandering growth rings
      const warp = fbm(noise, x * 0.0012, y * 0.01, 4);
      const rings = Math.sin((y * 0.03 + warp * 9) * Math.PI) * 0.5 + 0.5;
      const ringLine = Math.pow(rings, 10);
      // fine fibres and pores
      const fibre = noise(x * 0.04, y * 0.9);
      const pores = noise(x * 0.35, y * 1.6) > 0.82 ? 1 : 0;
      // broad tonal variation across the board
      const tone = fbm(noise, x * 0.0009 + 50, y * 0.004, 3);

      let t = ringLine * 0.32 + fibre * 0.16 + tone * 0.45 + pores * 0.08;
      t = Math.min(1, Math.max(0, t));

      const i = (y * width + x) * 4;
      color.image.data[i] = lerp(light[0], dark[0], t);
      color.image.data[i + 1] = lerp(light[1], dark[1], t);
      color.image.data[i + 2] = lerp(light[2], dark[2], t);
      color.image.data[i + 3] = 255;

      const b = 255 * (1 - (ringLine * 0.5 + fibre * 0.35 + pores * 0.4));
      bump.image.data[i] = bump.image.data[i + 1] = bump.image.data[i + 2] = b;
      bump.image.data[i + 3] = 255;
    }
  }

  color.ctx.putImageData(color.image, 0, 0);
  bump.ctx.putImageData(bump.image, 0, 0);

  return {
    map: finishTexture(color.canvas, { srgb: true, anisotropy }),
    bumpMap: finishTexture(bump.canvas, { anisotropy }),
  };
}

/** Soft radial falloff (white center → transparent edge) for additive glow sprites. */
export function createGlowTexture(size = 128) {
  const { canvas, ctx } = makeCanvas(size, size);
  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finishTexture(canvas, { srgb: true });
}

/**
 * Emissive falloff for the inside of a lamp shade, along the lathe's V axis
 * (v = 0 at the neck, v = 1 at the rim): hottest around the bulb, softer at the lip.
 */
export function createShadeGlowTexture(height = 128) {
  const { canvas, ctx } = makeCanvas(4, height);
  // canvas rows run top → bottom, while v runs bottom → top after flipY
  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, 'rgb(150,150,150)');
  gradient.addColorStop(0.45, 'rgb(255,255,255)');
  gradient.addColorStop(0.75, 'rgb(220,220,220)');
  gradient.addColorStop(1, 'rgb(120,120,120)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, height);
  return finishTexture(canvas, { srgb: true });
}

/** Seamless soft plaster grain, used as a bump map on the walls. */
export function createPlasterTexture({ size = 512, seed = 3, repeat = [4, 3] } = {}) {
  const noise = createNoise(seed);
  const { canvas, ctx, image } = makeCanvas(size, size);
  const period = 16;
  const scale = period / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(noise, x * scale, y * scale, 5, period);
      const v = 128 + (n - 0.5) * 180;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return finishTexture(canvas, { repeat });
}
