import * as THREE from 'three';

// Pins a real HTML element onto a flat quad in the 3D scene (a laptop screen,
// a page, a sticky note): the quad's four corners are projected to the screen
// every frame and the element gets the CSS matrix3d that maps onto them.

// --- 3×3 helpers for the four-point projective transform ---

function adj(m) {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}

function multmm(a, b) {
  const c = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      c[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
    }
  }
  return c;
}

function multmv(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
  const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const v = multmv(adj(m), [x4, y4, 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

/** CSS matrix3d mapping a w×h box (TL, TR, BL, BR) onto four screen points. */
function projectiveMatrix(w, h, dst) {
  const t = multmm(basisToPoints(...dst), adj(basisToPoints(0, 0, w, 0, 0, h, w, h)));
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}

const _v = new THREE.Vector3();

export class ProjectedOverlay {
  /**
   * @param element  the HTML to pin; laid out at `width`×`height` CSS pixels
   * @param corners  () => [topLeft, topRight, bottomRight, bottomLeft] in world space
   */
  constructor(element, { width, height, corners }) {
    this.element = element;
    this.width = width;
    this.height = height;
    this.corners = corners;
    this.visible = false;
    element.classList.add('overlay');
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    document.getElementById('overlays').append(element);
  }

  /** Fade in after `delay` seconds (once the camera has nearly arrived). */
  show(delay = 0, onShown) {
    this.visible = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.element.classList.add('is-visible');
      onShown?.();
    }, delay * 1000);
  }

  hide() {
    this.visible = false;
    clearTimeout(this.timer);
    if (this.element.contains(document.activeElement)) document.activeElement.blur();
    this.element.classList.remove('is-visible');
  }

  update(camera) {
    if (!this.visible) return;
    const pts = [];
    for (const corner of this.corners()) {
      // a corner behind the camera can't be projected sensibly
      if (_v.copy(corner).applyMatrix4(camera.matrixWorldInverse).z > -camera.near) {
        this.element.style.visibility = 'hidden';
        return;
      }
      _v.copy(corner).project(camera);
      pts.push([((_v.x + 1) / 2) * window.innerWidth, ((1 - _v.y) / 2) * window.innerHeight]);
    }
    const [tl, tr, br, bl] = pts;
    this.element.style.visibility = '';
    this.element.style.transform = projectiveMatrix(this.width, this.height, [...tl, ...tr, ...bl, ...br]);
  }

  dispose() {
    clearTimeout(this.timer);
    this.element.remove();
  }
}

/** World-space corners of a PlaneGeometry mesh of size w×h: TL, TR, BR, BL. */
export function planeCorners(mesh, w, h) {
  const local = [
    [-w / 2, h / 2],
    [w / 2, h / 2],
    [w / 2, -h / 2],
    [-w / 2, -h / 2],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0));
  return () => local.map((p) => mesh.localToWorld(p.clone()));
}
