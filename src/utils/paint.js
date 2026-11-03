import * as THREE from 'three';

// Canvas illustrations for paper, screens and printed things on the desk.

export const FONTS = {
  hand: '"Caveat", "Segoe Print", cursive',
  serif: '"Fraunces", Georgia, serif',
  sans: '"Inter", system-ui, sans-serif',
};

/** Deterministic PRNG so the scene looks the same on every load. */
export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function paintTexture(width, height, draw, { srgb = true, anisotropy = 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------- paper ----------

const PROSE = [
  'The evening came in slowly, the way it always did in late autumn, first as a softening of the light on the far rooftops and then as a hush that settled over the street below.',
  'She lit the candle on the corner of the desk and watched the flame lean, steady itself, and lean again. There was nothing urgent left to do, and for once that felt like enough.',
  'Somewhere a kettle clicked off. Somewhere a window closed. The city kept its quiet promises: a bus at a quarter past, a dog that barked twice, the neighbour who always played the same three songs.',
  'She opened the notebook to a clean page and wrote the date at the top, then nothing else for a while. Some evenings are for doing, she thought, and some are only for noticing.',
  'The lamp made a small warm island of the desk, and everything outside of it seemed to wait politely, as if the rest of the world had agreed to hold its breath until she was ready.',
];

/** Justified-ish serif prose, wrapped to the page. */
function prose(ctx, { x, y, width, bottom, size, lineHeight, start = 0 }) {
  ctx.font = `400 ${size}px ${FONTS.serif}`;
  ctx.textAlign = 'left';
  let ly = y;
  for (let p = 0; ly < bottom; p++) {
    const words = PROSE[(start + p) % PROSE.length].split(' ');
    let line = '    ';
    for (const word of words) {
      const next = line + word + ' ';
      if (ctx.measureText(next).width > width) {
        ctx.fillText(line.trimEnd(), x, ly);
        ly += lineHeight;
        line = word + ' ';
        if (ly >= bottom) return;
      } else {
        line = next;
      }
    }
    ctx.fillText(line.trimEnd(), x, ly);
    ly += lineHeight;
  }
}

export function bookPageTexture(seed, { heading = false } = {}) {
  return paintTexture(768, 1080, (ctx, w, h) => {
    ctx.fillStyle = '#f4ecdc';
    ctx.fillRect(0, 0, w, h);
    let top = 110;
    ctx.fillStyle = '#4e443c';
    if (heading) {
      ctx.font = `300 50px ${FONTS.serif}`;
      ctx.textAlign = 'center';
      ctx.fillText('chapter three', w / 2, 180);
      ctx.font = `italic 300 28px ${FONTS.serif}`;
      ctx.fillText('— on slow evenings —', w / 2, 230);
      top = 320;
    }
    prose(ctx, { x: 80, y: top, width: w - 160, bottom: h - 110, size: 21, lineHeight: 33, start: seed });
    ctx.font = `400 18px ${FONTS.serif}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(40 + (seed % 9)), w / 2, h - 50);
  });
}

/** Ruled notebook page geometry, shared with the HTML editor laid over it. */
export const TODO_PAGE = { width: 512, height: 700, firstLine: 100, pitch: 44, left: 84, maxItems: 12 };

/**
 * Lined notebook page holding a to-do list. `draw({ title, items, blank })`
 * repaints it; `blank` leaves only the ruling for while the HTML editor is on top.
 */
export function todoPageTexture() {
  const { width, height, firstLine, pitch, left } = TODO_PAGE;
  const texture = paintTexture(width, height, () => {});
  texture.draw = ({ title, items, blank = false }) => {
    const ctx = texture.image.getContext('2d');
    ctx.fillStyle = '#f8f5ef';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(120, 150, 185, 0.45)';
    ctx.lineWidth = 1.5;
    for (let y = firstLine; y < height - 10; y += pitch) {
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(width - 12, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(214, 120, 120, 0.45)';
    ctx.beginPath();
    ctx.moveTo(70, 0);
    ctx.lineTo(70, height);
    ctx.stroke();

    if (!blank) {
      ctx.fillStyle = 'rgba(52, 52, 64, 0.85)';
      ctx.font = `600 34px ${FONTS.hand}`;
      ctx.fillText(title, left, firstLine - 8);
      ctx.font = `600 31px ${FONTS.hand}`;
      items.slice(0, TODO_PAGE.maxItems).forEach((item, i) => {
        const y = firstLine + pitch * (i + 1) - 8;
        const text = `· ${item.text}`;
        ctx.globalAlpha = item.done ? 0.4 : 1;
        ctx.fillText(text, left, y);
        if (item.done) ctx.fillRect(left + 14, y - 10, ctx.measureText(text).width - 14, 2);
        ctx.globalAlpha = 1;
      });
    }
    texture.needsUpdate = true;
  };
  return texture;
}

export function ginghamTexture() {
  return paintTexture(512, 680, (ctx, w, h) => {
    ctx.fillStyle = '#f6ebe4';
    ctx.fillRect(0, 0, w, h);
    const cell = 26;
    ctx.fillStyle = 'rgba(205, 150, 135, 0.32)';
    for (let x = 0; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
    for (let y = 0; y < h; y += cell * 2) ctx.fillRect(0, y, w, cell);

    // label
    const lw = 190;
    const lh = 64;
    const lx = w / 2 - lw / 2;
    const ly = 150;
    ctx.fillStyle = '#fbf8f3';
    roundRect(ctx, lx, ly, lw, lh, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 120, 110, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7a645a';
    ctx.font = `400 28px ${FONTS.serif}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P L A N', w / 2, ly + lh / 2 + 2);
  });
}

// ---------- devices ----------

export function keyboardTexture() {
  return paintTexture(1024, 420, (ctx, w, h) => {
    ctx.fillStyle = '#9a9ba0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#26262a';
    roundRect(ctx, 40, 24, w - 80, h - 48, 10);
    ctx.fill();
    const rows = [14, 14, 13, 12, 11];
    const top = 40;
    const keyH = 58;
    rows.forEach((count, r) => {
      const y = top + r * (keyH + 12);
      const keyW = (w - 120 - (count - 1) * 10) / count;
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = '#121214';
        roundRect(ctx, 60 + i * (keyW + 10), y, keyW, keyH, 8);
        ctx.fill();
      }
    });
    // space bar row
    ctx.fillStyle = '#121214';
    roundRect(ctx, 60, top + 5 * (keyH + 12), 120, 40, 8);
    ctx.fill();
    roundRect(ctx, 320, top + 5 * (keyH + 12), 380, 40, 8);
    ctx.fill();
    roundRect(ctx, w - 180, top + 5 * (keyH + 12), 120, 40, 8);
    ctx.fill();
  });
}

/** Cozy evening window view: dusk sky, city lights, a dim room in front. */
export function citySceneTexture(seed = 11, { width = 1024, height = 640, frame = true } = {}) {
  const rand = seeded(seed);
  return paintTexture(width, height, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
    sky.addColorStop(0, '#1d2340');
    sky.addColorStop(0.55, '#5a4a6a');
    sky.addColorStop(1, '#e79a68');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // distant then near skyline
    for (const [layer, base, color, lit] of [
      [0, 0.72, '#3a3550', 0.25],
      [1, 0.8, '#1d1b2b', 0.55],
    ]) {
      let x = 0;
      while (x < w) {
        const bw = w * (0.03 + rand() * 0.06);
        const bh = h * (0.12 + rand() * (layer ? 0.42 : 0.3));
        const top = h * base - bh;
        ctx.fillStyle = color;
        ctx.fillRect(x, top, bw, h - top);
        for (let wy = top + 8; wy < h * base; wy += 11) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
            if (rand() < lit * 0.5) {
              ctx.fillStyle = rand() < 0.8 ? 'rgba(255, 205, 130, 0.9)' : 'rgba(200, 220, 255, 0.8)';
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        }
        x += bw + rand() * 3;
      }
    }

    if (!frame) return;
    // room silhouette: window mullions, sill, sofa, a lamp's warm pool
    ctx.fillStyle = '#16110f';
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
    for (const fx of [0, w * 0.33, w * 0.66, w - 14]) ctx.fillRect(fx, 0, 14, h);
    ctx.fillRect(0, 0, w, 12);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.86, 4, w * 0.5, h * 0.86, w * 0.35);
    glow.addColorStop(0, 'rgba(255, 170, 90, 0.55)');
    glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.fillStyle = '#2a201b';
    roundRect(ctx, w * 0.18, h * 0.82, w * 0.5, h * 0.12, 18);
    ctx.fill();
    ctx.fillStyle = '#ffd89a';
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.85, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * The laptop's screen: the city wallpaper, plus a big countdown while a focus
 * timer runs. `draw(timer | null)` repaints; `wallpaper` is the plain canvas.
 */
export function laptopScreenTexture() {
  const wallpaper = citySceneTexture().image;
  const { width: w, height: h } = wallpaper;
  const texture = paintTexture(w, h, () => {});
  texture.wallpaper = wallpaper;
  texture.draw = (timer) => {
    const ctx = texture.image.getContext('2d');
    ctx.drawImage(wallpaper, 0, 0);
    if (timer) {
      ctx.fillStyle = 'rgba(12, 9, 16, 0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fbf3e6';
      ctx.textAlign = 'center';
      ctx.font = `300 200px ${FONTS.serif}`;
      ctx.fillText(timer.display, w / 2, h * 0.56);
      ctx.font = `italic 300 36px ${FONTS.serif}`;
      ctx.fillStyle = 'rgba(251, 243, 230, 0.75)';
      ctx.fillText(timer.running ? timer.label : `${timer.label} · paused`, w / 2, h * 0.56 + 70);
    }
    texture.needsUpdate = true;
  };
  texture.draw(null);
  return texture;
}

export function clockFaceTexture() {
  const texture = paintTexture(256, 112, () => {}, { anisotropy: 4 });
  texture.draw = (text, suffix = '') => {
    const ctx = texture.image.getContext('2d');
    const { width: w, height: h } = texture.image;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8ecff';
    ctx.shadowColor = 'rgba(160, 205, 255, 0.9)';
    ctx.shadowBlur = 10;
    ctx.font = `300 66px ${FONTS.sans}`;
    ctx.textAlign = 'center';
    const cx = w / 2 - (suffix ? 14 : 0);
    ctx.fillText(text, cx, h / 2 + 3);
    if (suffix) {
      const right = cx + ctx.measureText(text).width / 2;
      ctx.font = `500 18px ${FONTS.sans}`;
      ctx.textAlign = 'left';
      ctx.fillText(suffix, right + 6, h / 2 - 16);
    }
    texture.needsUpdate = true;
  };
  return texture;
}

// ---------- wall papers ----------

export const NOTE_INK = '#3d3530';
export const NOTE_PAD_X = 36;

/**
 * Handwritten note paper, 360 px wide. `draw({ text, blank })` repaints it;
 * a `titled` note sets its first line in a heavier hand.
 */
export function noteTexture({ paper = '#f1e9dc', size = 50, align = 'left', top = 140, height = 480, titled = false, seed = 3 }) {
  const width = 360;
  const texture = paintTexture(width, height, () => {});
  texture.draw = ({ text, blank = false }) => {
    const ctx = texture.image.getContext('2d');
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    // faint paper tooth
    const rand = seeded(seed);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(120, 100, 80, ${rand() * 0.05})`;
      ctx.fillRect(rand() * width, rand() * height, 2, 2);
    }
    if (!blank) {
      ctx.fillStyle = NOTE_INK;
      ctx.textAlign = align;
      const x = align === 'center' ? width / 2 : NOTE_PAD_X;
      text.split('\n').forEach((line, i) => {
        ctx.font = `${titled && i === 0 ? 700 : 500} ${size}px ${FONTS.hand}`;
        ctx.fillText(line, x, top + i * size * 1.2); // `top` leaves room for the pin
      });
    }
    texture.needsUpdate = true;
  };
  return texture;
}

/** Painted stand-in pictures for empty polaroids, `size`×`size` px. */
export function placeholderPicture(kind, seed = 5, size = 448) {
  const rand = seeded(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const s = size / 288; // shapes were designed at 288 px
  const gradient = (stops) => {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };

  if (kind === 'path') {
    // tree-lined garden path, soft daylight
    gradient([[0, '#dfe6d6'], [1, '#a9b88e']]);
    for (let i = 0; i < 140; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const depth = rand();
      const x = size / 2 + side * (size * 0.08 + depth * size * 0.45 + rand() * 20 * s);
      const y = size * (0.15 + rand() * 0.55);
      ctx.fillStyle = `rgba(${60 + rand() * 50}, ${90 + rand() * 50}, ${50 + rand() * 30}, 0.75)`;
      ctx.beginPath();
      ctx.arc(x, y, (10 + depth * 26) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#d9c9aa';
    ctx.beginPath();
    ctx.moveTo(size * 0.47, size * 0.45);
    ctx.lineTo(size * 0.53, size * 0.45);
    ctx.lineTo(size * 0.95, size);
    ctx.lineTo(size * 0.05, size);
    ctx.fill();
  } else if (kind === 'street') {
    // pink dusk street with glowing lamps
    gradient([[0, '#6d6a8f'], [0.6, '#e2a49a'], [1, '#3a2f36']]);
    ctx.fillStyle = '#2e2632';
    for (const [x, w, top] of [[0, 0.3, 0.2], [0.72, 0.28, 0.12], [0.28, 0.12, 0.42], [0.6, 0.14, 0.38]]) {
      ctx.fillRect(x * size, top * size, w * size, size);
    }
    for (const [x, y] of [[0.36, 0.55], [0.52, 0.5], [0.62, 0.58]]) {
      const g = ctx.createRadialGradient(x * size, y * size, 1, x * size, y * size, 26 * s);
      g.addColorStop(0, 'rgba(255, 220, 150, 1)');
      g.addColorStop(1, 'rgba(255, 220, 150, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x * size - 30 * s, y * size - 30 * s, 60 * s, 60 * s);
    }
  } else if (kind === 'sea') {
    // warm sunset over a calm sea
    gradient([[0, '#7f8fb5'], [0.45, '#f2b38c'], [0.56, '#f7d3a1'], [0.57, '#6f86a3'], [1, '#334760']]);
    ctx.fillStyle = 'rgba(255, 230, 180, 0.95)';
    ctx.beginPath();
    ctx.arc(size * 0.62, size * 0.52, 22 * s, Math.PI, 0);
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(255, 215, 170, ${0.2 + rand() * 0.4})`;
      ctx.fillRect(size * (0.5 + rand() * 0.25), size * (0.58 + rand() * 0.3), (6 + rand() * 30) * s, 2 * s);
    }
  } else if (kind === 'sky') {
    // soft pastel clouds
    gradient([[0, '#a9b8d9'], [1, '#f0cdd0']]);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255, 245, 240, ${0.25 + rand() * 0.35})`;
      ctx.beginPath();
      ctx.arc(size * rand(), size * (0.3 + rand() * 0.6), (16 + rand() * 40) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // night city window
    ctx.drawImage(citySceneTexture(seed, { width: size, height: size, frame: false }).image, 0, 0);
  }
  return canvas;
}

/** Polaroid layout in texture px; the caption editor lines up with it. */
export const POLAROID = { width: 512, height: 620, pad: 32, captionY: 556, captionSize: 46 };

/**
 * A polaroid print. `draw({ picture, caption, hideCaption })` repaints it with any
 * image source (a user photo or a placeholder canvas), cover-cropped to a square.
 */
export function polaroidTexture() {
  const { width, height, pad, captionY, captionSize } = POLAROID;
  const texture = paintTexture(width, height, () => {});
  texture.draw = ({ picture, caption = '', hideCaption = false }) => {
    const ctx = texture.image.getContext('2d');
    ctx.fillStyle = '#f7f3ec';
    ctx.fillRect(0, 0, width, height);
    const side = width - pad * 2;
    const sw = picture.width;
    const sh = picture.height;
    const crop = Math.min(sw, sh);
    ctx.drawImage(picture, (sw - crop) / 2, (sh - crop) / 2, crop, crop, pad, pad, side, side);
    // a whisper of print gloss and an inner edge so it reads as a photo, not a screen
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, side, side);
    if (caption && !hideCaption) {
      ctx.fillStyle = '#3d3530';
      ctx.font = `600 ${captionSize}px ${FONTS.hand}`;
      ctx.textAlign = 'center';
      ctx.fillText(caption, width / 2, captionY, side);
    }
    texture.needsUpdate = true;
  };
  return texture;
}

// ---------- objects ----------

const SPINE_STYLES = [
  { bg: '#efe6d6', ink: '#5c4b3e' },
  { bg: '#f6f2ea', ink: '#6b5a4c' },
  { bg: '#c9a882', ink: '#fbf5ea' },
  { bg: '#7a5a42', ink: '#f3e6d2' },
  { bg: '#a8ad8f', ink: '#fbf8f0' },
  { bg: '#d9b3a4', ink: '#5a3f37' },
  { bg: '#4a3b33', ink: '#ead9c3' },
];

export function spineTexture(title, styleIndex) {
  const style = SPINE_STYLES[styleIndex % SPINE_STYLES.length];
  const tex = paintTexture(96, 768, (ctx, w, h) => {
    ctx.fillStyle = style.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = style.ink;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 60, w, 3);
    ctx.fillRect(0, h - 64, w, 3);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = `400 40px ${FONTS.serif}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 0, 0);
    ctx.restore();
  });
  return { texture: tex, color: style.bg };
}

export function coasterTexture() {
  const rand = seeded(9);
  return paintTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a6440';
    ctx.fillRect(0, 0, w, h);
    for (let r = 4; r < w / 2; r += 5) {
      ctx.strokeStyle = `rgba(${150 + rand() * 50}, ${110 + rand() * 40}, ${70 + rand() * 20}, 0.9)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}
