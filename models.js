// Character & vehicle meshes, no gameplay. Conventions: metres, y up, feet/wheels at y=0, model faces +x.
// Builders return fresh objects and do NOT add them to the scene. Geometries, materials and textures are shared.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI, cache = {};
const once = (k, f) => cache[k] ||= f();
const M = (color, o = {}) => once(color + Object.entries(o).map(([k, v]) => k + (v?.uuid ?? v)), () => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
const G = (T, ...a) => once(T.name + a, () => new T(...a));
// unit spheres (big / small / tiny), scaled per mesh
const S = () => G(THREE.SphereGeometry, 1, 12, 10), s = () => G(THREE.SphereGeometry, 1, 8, 6), t = () => G(THREE.SphereGeometry, 1, 6, 4);
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
function add(parent, geo, mat, x = 0, y = 0, z = 0, sc) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z);
  if (sc) Array.isArray(sc) ? m.scale.set(...sc) : m.scale.setScalar(sc);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
const pivot = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
const tex = (k, w, h, draw) => once(k, () => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
});
// unit sphere pushed around by f(v); keeps sphere UVs, so u=0.5 is the front (+x) — handy for chest decals
const blob = (k, f) => once('blob' + k, () => {
  const geo = new THREE.SphereGeometry(1, 20, 14), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { f(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); return geo;
});
// knit top with a V opening at the front showing what's underneath (inner(c) paints the V)
const knit = (k, col, dark, inner) => tex(k, 512, 256, (c, w, h) => {
  c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = dark;
  for (let x = 0; x < w; x += 6) c.fillRect(x, 0, 2, h);
  c.fillRect(0, h - 14, w, 14); // ribbed hem
  c.save(); c.beginPath(); c.moveTo(w * 0.43, 0); c.lineTo(w * 0.57, 0); c.lineTo(w * 0.505, h * 0.55); c.lineTo(w * 0.495, h * 0.55); c.clip(); inner(c, w, h); c.restore();
});

// ───────────── people: { g, legs: [hipL, hipR], arms: [shoulderL, shoulderR] }; pivots swing on rotation.z (+ = forward)
function legs(g, { y, z, r, pants, shoe, sole = '#3a2a1c', foot = 0.25, cuff }) {
  return [-z, z].map(zz => {
    const hip = pivot(g, 0, y, zz), l = y - 0.08;
    add(hip, t(), pants, 0, 0, 0, r * 1.05);
    add(hip, G(THREE.CylinderGeometry, r, r * 0.82, l, 8), pants, 0, -l / 2, 0);
    if (cuff) add(hip, G(THREE.CylinderGeometry, r * 0.95, r * 0.95, 0.07, 8), cuff, 0, -l + 0.03, 0);
    add(hip, G(RoundedBoxGeometry, foot, 0.11, r * 1.9, 1, 0.045), shoe, foot * 0.22, -y + 0.075, 0);
    add(hip, G(THREE.BoxGeometry, foot + 0.005, 0.03, r * 1.9 + 0.005), sole, foot * 0.22, -y + 0.015, 0);
    return hip;
  });
}
function arms(parent, { y, z, len, r, sleeve, sleeveLen, arm, hand, splay = 0.14 }) {
  return [-z, z].map(zz => {
    const sh = pivot(parent, 0, y, zz), a = pivot(sh, 0, 0, 0); a.rotation.x = -Math.sign(zz) * splay;
    add(a, s(), sleeve, 0, 0, 0, r * 1.2);
    add(a, G(THREE.CylinderGeometry, r * 1.25, r * 1.15, sleeveLen, 8), sleeve, 0, -sleeveLen / 2, 0);
    add(a, G(THREE.CylinderGeometry, r, r * 0.8, len, 8), arm, 0, -len / 2, 0);
    add(a, t(), hand, 0.01, -len - r * 0.55, 0, [r * 0.85, r * 1.2, r * 0.7]);
    return sh;
  });
}
function head(parent, { x = 0, y, r, skin, nose = skin, noseR = 0.2 }) {
  const h = pivot(parent, x, y, 0);
  add(h, S(), skin, 0, 0, 0, [r, r * 1.08, r * 0.96]);
  add(h, s(), nose, r * 0.97, -r * 0.1, 0, r * noseR);
  for (const k of [-1, 1]) {
    add(h, t(), '#fbfbf8', r * 0.84, r * 0.14, k * r * 0.35, r * 0.13);
    add(h, t(), '#2e241e', r * 0.95, r * 0.14, k * r * 0.35, r * 0.075);
    add(h, t(), skin, -r * 0.05, -r * 0.02, k * r * 0.95, [r * 0.16, r * 0.26, r * 0.12]);
  }
  return h;
}
// hair/beard shell: partial sphere around the head; rot = [phiStart, phiLength, thetaStart, thetaLength] (phi = PI is the face)
const shell = (h, r, rot, sc, col, x = 0, y = 0) => add(h, G(THREE.SphereGeometry, 1, 14, 8, ...rot), col, x, y, 0, sc.map(v => v * r));

// Erika — the player (erika.png, camion.png): stocky 60-ish, huge belly, silver hair, grey beard, black glasses, "Australia" tee
export function buildErika() {
  const g = new THREE.Group(), skin = '#eaa98f', r = 0.145, jeans = '#4f7db4', olive = '#6f7d45';
  const lg = legs(g, { y: 0.66, z: 0.125, r: 0.1, pants: jeans, cuff: '#6892c4', shoe: '#7a4e2a' });
  add(g, s(), jeans, -0.02, 0.74, 0, [0.18, 0.15, 0.25]);
  add(g, G(THREE.CylinderGeometry, 1, 1, 1, 16), '#3b2a1e', -0.02, 0.83, 0, [0.19, 0.05, 0.26]); // belt, mostly under the belly
  const tee = M('#ffffff', { map: tex('aus', 1024, 512, (c, w, h) => {
    c.fillStyle = olive; c.fillRect(0, 0, w, h);
    c.fillStyle = '#414b32'; c.font = 'italic bold 60px "Brush Script MT", "Segoe Script", "URW Chancery L", cursive';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Australia', w / 2, h * 0.37);
  }) });
  add(g, blob('erika', v => {
    const b = bump(v.y, -0.3, 0.5), f = Math.max(0, v.x) ** 0.7;
    v.set(v.x * 0.21 * (1 + 1.25 * b * f), v.y * 0.35 - 0.07 * b * f, v.z * 0.26 * (1 + 0.2 * b + 0.75 * bump(v.y, 0.72, 0.28)));
  }), tee, 0, 1.05, 0);
  add(g, G(THREE.CylinderGeometry, 0.09, 0.11, 0.14, 12), skin, 0, 1.38, 0);
  add(g, G(THREE.TorusGeometry, 0.1, 0.018, 4, 12), '#5f6c3a', 0, 1.35, 0).rotation.x = PI / 2; // crew neck
  const am = arms(g, { y: 1.27, z: 0.29, len: 0.5, r: 0.078, sleeve: olive, sleeveLen: 0.19, arm: skin, hand: skin, splay: 0.2 });
  const h = head(g, { x: 0.02, y: 1.49, r, skin, nose: '#e59c86', noseR: 0.2 });
  const hair = '#d2d3cf', beard = '#d6d6d2';
  shell(h, r, [0, 2 * PI, 0, 1.35], [1.07, 1.12, 1.04], hair, -0.012, 0.012).rotation.z = 0.5;
  add(h, s(), hair, r * 0.45, r * 0.82, 0, [r * 0.55, r * 0.3, r * 0.8]).rotation.z = -0.35; // swept-back front
  shell(h, r, [PI / 2, PI, 1.82, 1.2], [1.07, 1.12, 1.03], beard);
  for (const k of [-1, 1]) add(h, t(), beard, r * 0.12, -r * 0.08, k * r * 0.9, [r * 0.25, r * 0.4, r * 0.12]); // sideburns
  add(h, s(), '#c4c4c0', r * 0.95, -r * 0.3, 0, [r * 0.14, r * 0.11, r * 0.36]); // moustache
  const rim = once('rim', () => new THREE.TorusGeometry(1, 0.25, 4, 4).rotateZ(PI / 4).rotateY(PI / 2));
  for (const k of [-1, 1]) {
    add(h, rim, '#121212', r * 1.06, r * 0.14, k * r * 0.4, [r * 0.1, r * 0.2, r * 0.32]);
    add(h, G(THREE.BoxGeometry, r * 1.05, r * 0.07, r * 0.06), '#121212', r * 0.5, r * 0.17, k * r * 0.8).rotation.y = k * 0.29;
    add(h, G(THREE.BoxGeometry, r * 0.12, r * 0.09, r * 0.3), '#8f8f8b', r * 0.98, r * 0.44, k * r * 0.4).rotation.x = -k * 0.15;
  }
  add(h, G(THREE.BoxGeometry, r * 0.06, r * 0.05, r * 0.18), '#121212', r * 1.06, r * 0.18, 0);
  g.scale.setScalar(1.3);
  return { g, legs: lg, arms: am };
}

// Red-haired neighbour who wheels bins back onto the sidewalk: big copper curls, teal cardigan, yellow rubber gloves
export function buildRedhead() {
  const g = new THREE.Group(), skin = '#f5cdb3', r = 0.118, jeans = '#27304a', teal = '#1e8f8a', glove = M('#f4c91c', { roughness: 0.35 });
  const lg = legs(g, { y: 0.74, z: 0.085, r: 0.074, pants: jeans, shoe: '#f4f4ef', sole: '#cfd2d2', foot: 0.22 });
  add(g, t(), jeans, 0, 0.8, 0, [0.14, 0.12, 0.185]);
  const cardi = M('#ffffff', { map: knit('cardi', teal, '#1a7f7a', (c, w, h) => { c.fillStyle = '#f3ead8'; c.fillRect(0, 0, w, h); }) });
  add(g, blob('redhead', v => {
    const f = Math.max(0, v.x);
    v.set(v.x * 0.13 * (1 + 0.45 * bump(v.y, 0.25, 0.3) * f), v.y * 0.3, v.z * 0.18 * (1 - 0.16 * bump(v.y, -0.35, 0.35) + 0.35 * bump(v.y, 0.75, 0.3)));
  }), cardi, 0, 1.1, 0);
  add(g, G(THREE.CylinderGeometry, 0.055, 0.065, 0.12, 10), skin, 0, 1.4, 0);
  const am = arms(g, { y: 1.33, z: 0.22, len: 0.52, r: 0.055, sleeve: teal, sleeveLen: 0.12, arm: teal, hand: glove, splay: 0.12 });
  for (const a of am) add(a.children[0], G(THREE.CylinderGeometry, 0.06, 0.052, 0.14, 8), glove, 0, -0.47, 0);
  const h = head(g, { y: 1.52, r, skin });
  add(h, t(), '#c9585a', r * 0.94, -r * 0.45, 0, [r * 0.08, r * 0.07, r * 0.24]);
  for (const k of [-1, 1]) add(h, G(THREE.BoxGeometry, r * 0.08, r * 0.05, r * 0.28), '#9c3a16', r * 0.9, r * 0.42, k * r * 0.38).rotation.x = -k * 0.2;
  const hair = '#d2521d', hi = '#e8702e';
  shell(h, r, [0, 2 * PI, 0, 1.5], [1.14, 1.16, 1.12], hair, -0.012, 0.012).rotation.z = 0.4;
  add(h, S(), hair, -0.08, -0.13, 0, [0.12, 0.25, 0.17]); // long mass down the back
  for (const [x, y, z, a, b, c, col] of [
    [-0.03, -0.1, 0.125, 0.075, 0.15, 0.07, hi], [-0.05, -0.26, 0.12, 0.08, 0.1, 0.08, hair], [-0.1, -0.37, 0, 0.09, 0.08, 0.13, hi], [0.07, 0.085, 0.03, 0.06, 0.05, 0.1, hair],
  ]) for (const k of z ? [-1, 1] : [1]) add(h, s(), col, x, y, k * z, [a, b, c]).rotation.set(k * 0.3, 0, 0.2);
  g.scale.setScalar(1.3);
  return { g, legs: lg, arms: am };
}

// Erika's wife: ash-blonde bob, lilac cardigan, pearl necklace
export function buildWife() {
  const g = new THREE.Group(), skin = '#f0c4a8', r = 0.115, slacks = '#3d3a45', lilac = '#a58cc4';
  const lg = legs(g, { y: 0.74, z: 0.085, r: 0.07, pants: slacks, shoe: '#6b3a2a', foot: 0.21 });
  add(g, t(), slacks, 0, 0.8, 0, [0.14, 0.12, 0.18]);
  const cardi = M('#ffffff', { map: knit('wifeCardi', lilac, '#8f76ad', (c, w, h) => { c.fillStyle = '#f6f1e8'; c.fillRect(0, 0, w, h); }) });
  add(g, blob('wife', v => v.set(v.x * 0.13 * (1 + 0.4 * bump(v.y, 0.25, 0.3) * Math.max(0, v.x)), v.y * 0.3, v.z * 0.18 * (1 + 0.3 * bump(v.y, 0.75, 0.3)))), cardi, 0, 1.1, 0);
  add(g, G(THREE.CylinderGeometry, 0.055, 0.065, 0.12, 10), skin, 0, 1.4, 0);
  add(g, G(THREE.TorusGeometry, 0.075, 0.012, 6, 16), '#f4efe4', 0.02, 1.36, 0).rotation.x = PI / 2; // pearls
  const am = arms(g, { y: 1.33, z: 0.22, len: 0.52, r: 0.055, sleeve: lilac, sleeveLen: 0.12, arm: lilac, hand: skin, splay: 0.12 });
  const h = head(g, { y: 1.52, r, skin });
  add(h, t(), '#b8545e', r * 0.94, -r * 0.45, 0, [r * 0.08, r * 0.07, r * 0.24]); // lips
  shell(h, r, [0, 2 * PI, 0, 1.6], [1.16, 1.14, 1.2], '#cdb68a', -0.012, 0.012).rotation.z = 0.45; // bob
  g.scale.setScalar(1.3);
  return { g, legs: lg, arms: am };
}

// « le père », Valérie's husband: grey hair and moustache, grey sweatshirt with a hood, jeans, always a cigarette.
// Returns tip too: an Object3D at the lit end of the cigarette, for the smoke.
export function buildFather() {
  const g = new THREE.Group(), skin = '#e9b49a', r = 0.12, sweat = '#6b727a', grey = '#b9b8b3', jeans = '#3d4f6e';
  const lg = legs(g, { y: 0.72, z: 0.09, r: 0.075, pants: jeans, shoe: '#e9e7e1', sole: '#9a9892', foot: 0.24 });
  add(g, s(), jeans, 0, 0.77, 0, [0.14, 0.12, 0.18]);
  add(g, blob('father', v => v.set(v.x * 0.15 * (1 + 0.5 * bump(v.y, -0.2, 0.4) * Math.max(0, v.x)), v.y * 0.3, v.z * 0.19)), sweat, 0, 1.08, 0);
  add(g, G(THREE.CylinderGeometry, 0.16, 0.15, 0.06, 12), '#5a6168', 0, 0.8, 0); // ribbed hem
  add(g, G(THREE.TorusGeometry, 0.1, 0.04, 6, 12), '#5a6168', -0.05, 1.38, 0).rotation.x = PI / 2; // hood bunched at the neck
  add(g, G(THREE.CylinderGeometry, 0.055, 0.065, 0.12, 10), skin, 0, 1.4, 0);
  const am = arms(g, { y: 1.32, z: 0.23, len: 0.5, r: 0.055, sleeve: sweat, sleeveLen: 0.4, arm: sweat, hand: skin, splay: 0.14 });
  const cig = add(am[1].children[0], G(THREE.CylinderGeometry, 0.009, 0.009, 0.09, 6), '#f4f2ea', 0.07, -0.56, 0); cig.rotation.z = PI / 2;
  add(cig, t(), M('#ff6a2a', { emissive: '#ff4010', emissiveIntensity: 1 }), 0, -0.047, 0, 0.012); // ember
  const tip = pivot(cig, 0, -0.05, 0);
  const h = head(g, { y: 1.52, r, skin, nose: '#dd9a84', noseR: 0.24 });
  shell(h, r, [0, 2 * PI, 0, 1.45], [1.08, 1.1, 1.07], grey, -0.012, 0.008).rotation.z = 0.45; // short grey hair
  add(h, s(), grey, r * 0.97, -r * 0.32, 0, [r * 0.14, r * 0.1, r * 0.4]); // moustache
  g.scale.setScalar(1.3);
  return { g, legs: lg, arms: am, tip };
}

// Stéphane the mechanic: navy work overalls with hi-vis stripes, black rectangular glasses, short dark hair, stubble
export function buildMechanic() {
  const g = new THREE.Group(), skin = '#e4b08f', r = 0.12, navy = '#23355a', hiviz = '#e8f03a';
  const lg = legs(g, { y: 0.74, z: 0.09, r: 0.078, pants: navy, shoe: '#2a2a2a', sole: '#111', foot: 0.26 });
  for (const k of [-1, 1]) add(lg[(k + 1) / 2], G(THREE.CylinderGeometry, 0.083, 0.083, 0.04, 8), hiviz, 0, -0.45, 0);
  add(g, s(), navy, 0, 0.8, 0, [0.15, 0.12, 0.19]);
  add(g, blob('mechanic', v => v.set(v.x * 0.15, v.y * 0.3, v.z * 0.2 * (1 + 0.25 * bump(v.y, 0.75, 0.3)))), navy, 0, 1.1, 0);
  add(g, G(THREE.CylinderGeometry, 0.2, 0.2, 0.04, 14), hiviz, 0, 0.98, 0, [0.78, 1, 1]); // hi-vis band
  add(g, G(THREE.BoxGeometry, 0.02, 0.12, 0.1), '#c9ccd0', 0.14, 1.18, 0.06); // pen/tools in the chest pocket
  add(g, G(THREE.CylinderGeometry, 0.058, 0.066, 0.12, 10), skin, 0, 1.42, 0);
  const am = arms(g, { y: 1.34, z: 0.24, len: 0.52, r: 0.058, sleeve: navy, sleeveLen: 0.42, arm: navy, hand: skin, splay: 0.14 });
  const wrench = add(am[1].children[0], G(THREE.BoxGeometry, 0.025, 0.24, 0.035), '#b8bcc2', 0.03, -0.62, 0); // spanner
  add(wrench, G(THREE.TorusGeometry, 0.03, 0.01, 4, 8), '#b8bcc2', 0, -0.13, 0);
  const h = head(g, { y: 1.55, r, skin, nose: '#d99a80', noseR: 0.22 });
  shell(h, r, [0, 2 * PI, 0, 1.3], [1.06, 1.08, 1.05], '#3a2c22', -0.01, 0.01).rotation.z = 0.5; // short dark hair
  shell(h, r, [PI / 2, PI, 1.9, 1.1], [1.02, 1.04, 1.02], '#6b5a4c'); // stubble
  for (const k of [-1, 1]) { // black rectangular glasses
    add(h, G(THREE.BoxGeometry, r * 0.06, r * 0.28, r * 0.42), '#111', r * 1.02, r * 0.14, k * r * 0.35);
    add(h, G(THREE.BoxGeometry, r * 0.8, r * 0.05, r * 0.05), '#111', r * 0.6, r * 0.2, k * r * 0.88);
  }
  add(h, G(THREE.BoxGeometry, r * 0.05, r * 0.05, r * 0.3), '#111', r * 1.04, r * 0.16, 0);
  g.scale.setScalar(1.3);
  return { g, legs: lg, arms: am };
}

// Jack, the kind old neighbour who helps Erika: 75, thin and stooped, tweed flat cap, white moustache, beige cardigan
export function buildJack() {
  const g = new THREE.Group(), skin = '#eec2a6', r = 0.115, cord = '#6d4f36', beige = '#cdb68c', white = '#f3f3f0';
  const lg = legs(g, { y: 0.72, z: 0.08, r: 0.066, pants: cord, shoe: '#3b2a1f', sole: '#1c1511', foot: 0.23 });
  add(g, s(), cord, 0, 0.77, 0, [0.12, 0.11, 0.16]);
  const up = pivot(g, 0, 0.77, 0); up.rotation.z = -0.24; // stoop
  const cardi = M('#ffffff', { map: knit('jackCardi', beige, '#bfa77c', (c, w, h) => {
    c.fillStyle = '#ece6d6'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(160,50,45,.6)';
    for (let i = 0; i < w; i += 14) { c.fillRect(i, 0, 5, h); c.fillRect(0, i, w, 5); }
  }) });
  add(up, blob('jack', v => {
    const f = Math.max(0, -v.x);
    v.set(v.x * 0.13 * (1 + 0.35 * bump(v.y, 0.45, 0.35) * f), v.y * 0.3, v.z * 0.17 * (1 + 0.35 * bump(v.y, 0.75, 0.3)));
  }), cardi, 0, 0.33, 0);
  for (const y of [0.1, 0.2, 0.3]) add(up, t(), '#5a4028', 0.128, y, 0, 0.012); // buttons
  add(up, G(THREE.CylinderGeometry, 0.05, 0.06, 0.14, 10), skin, 0.02, 0.64, 0).rotation.z = -0.2;
  const am = arms(up, { y: 0.57, z: 0.2, len: 0.5, r: 0.048, sleeve: beige, sleeveLen: 0.1, arm: beige, hand: skin, splay: 0.08 });
  const h = head(up, { x: 0.07, y: 0.77, r, skin, nose: '#e59e8a', noseR: 0.26 }); h.rotation.z = 0.2;
  shell(h, r, [-PI / 2 + 0.15, PI - 0.3, 1.2, 0.95], [1.05, 1.06, 1.05], white); // white hair round the back, under the cap
  add(h, s(), white, r * 0.96, -r * 0.33, 0, [r * 0.16, r * 0.12, r * 0.42]); // moustache
  for (const k of [-1, 1]) add(h, G(THREE.BoxGeometry, r * 0.14, r * 0.1, r * 0.3), white, r * 0.92, r * 0.43, k * r * 0.38).rotation.x = k * 0.2;
  const tweed = M('#ffffff', { map: tex('tweed', 64, 64, (c, w) => {
    c.fillStyle = '#7b5a3a'; c.fillRect(0, 0, w, w);
    for (let i = 0; i < 500; i++) { c.fillStyle = i % 2 ? '#5a4029' : '#a3825a'; c.fillRect(Math.random() * w, Math.random() * w, 2, 1); }
  }) });
  add(h, S(), tweed, r * 0.12, r * 0.62, 0, [r * 1.16, r * 0.5, r * 1.1]);
  add(h, G(THREE.CylinderGeometry, 1, 1, 1, 14, 1, false, 0, PI), tweed, r * 0.6, r * 0.6, 0, [r * 0.75, 0.012, r * 0.95]).rotation.z = -0.15; // peak
  g.scale.setScalar(1.3);
  return { g, legs: lg, arms: am };
}

// ───────────── Kévin's black BMW Z4 E89 roadster, hardtop closed. Contract: { g, body, len, w, exhaust } like buildTruck.
// Boxy like the other cars: carBase body with a long sloping bonnet, cab set far back, painted hardtop sail over the glass.
export function buildZ4(env) {
  const len = 4.24, w = 1.79, sill = 0.2, belt = 0.9, hood = 0.28, fx = 0.36, h = 0.32;
  const rim = rimTex('z4Rim', (c, r) => { // 18" double-spoke
    c.fillStyle = '#1c1d20'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill();
    c.strokeStyle = '#cfd3d7'; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { c.rotate(2 * PI / 5); c.lineWidth = 8; c.beginPath(); c.moveTo(-4, 12); c.lineTo(-12, r - 6); c.moveTo(4, 12); c.lineTo(12, r - 6); c.stroke(); }
    c.lineWidth = 5; c.beginPath(); c.arc(0, 0, r - 3, 0, 2 * PI); c.stroke();
    c.fillStyle = '#cfd3d7'; c.beginPath(); c.arc(0, 0, 15, 0, 2 * PI); c.fill(); c.fillStyle = '#26282b'; c.beginPath(); c.arc(0, 0, 7, 0, 2 * PI); c.fill();
  });
  const { g, body, p, E, L } = carBase(env, 'z4', { len, w, sill, belt, hood, cab: [-1.72, fx, -0.45, -1.1, h], paint: '#0a0b0f', wheelR: 0.32, tw: 0.24, axles: [1.29, -1.21], rim });
  const top = x => belt - hood * Math.min(1, Math.max(0, (x - fx) / (L - fx))), slope = Math.atan(hood / (L - fx)); // bonnet height at x
  const box = (m, sx, sy, sz, x, y, z) => add(body, G(THREE.BoxGeometry, sx, sy, sz), m, x, y, z);
  const rbox = (m, sx, sy, sz, r, x, y, z) => add(body, G(RoundedBoxGeometry, sx, sy, sz, 2, r), m, x, y, z);
  const chrome = M('#d9dee2', { roughness: 0.12, metalness: 1, ...E }), black = M('#111214', { roughness: 0.45 }), lens = M('#9aa6b2', { roughness: 0.08, metalness: 0.6, ...E });
  const led = M('#f2f7ff', { emissive: '#dfeaff', emissiveIntensity: 1.4 }), red = M('#9c0d10', { emissive: '#e01010', emissiveIntensity: 0.7 });
  const glass = M('#1b232c', { roughness: 0.06, metalness: 0.6, ...E });
  // hardtop: body-colour sail panels hide the rear of the glass cab, leaving a small raked rear window
  add(body, once('z4sail', () => {
    const d = w - 0.18, geo = new THREE.ExtrudeGeometry(new THREE.Shape([[-1.75, 0], [-0.95, 0], [-1.07, h + 0.01], [-1.12, h + 0.01]].map(([x, y]) => new THREE.Vector2(x, y))), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), v = geo.attributes.position;
    for (let i = 0; i < v.count; i++) v.setZ(i, v.getZ(i) * (1 - 0.14 * v.getY(i) / h));
    geo.computeVertexNormals(); return geo;
  }), p, 0, belt - 0.02, 0);
  box(glass, 0.36, 0.02, 0.9, -1.43, belt + 0.15, 0).rotation.z = Math.atan(h / 0.63);
  const slats = M('#ffffff', { roughness: 0.4, metalness: 0.5, map: tex('kidney', 64, 64, (c, s) => { c.fillStyle = '#0c0d0f'; c.fillRect(0, 0, s, s); c.fillStyle = '#5b6066'; for (let x = 3; x < s; x += 8) c.fillRect(x, 0, 3, s); }) });
  for (const k of [-1, 1]) {
    // wide flat kidneys low on the nose
    rbox(chrome, 0.05, 0.15, 0.28, 0.04, L - 0.01, 0.5, k * 0.17); box(slats, 0.03, 0.11, 0.23, L + 0.005, 0.5, k * 0.17);
    // long headlights swept back along the bonnet corners, LED eyebrow on the inner edge
    const hl = pivot(body, 1.8, top(1.8) - 0.012, k * 0.6); hl.rotation.set(0, -k * 0.18, -slope);
    add(hl, G(THREE.BoxGeometry, 0.5, 0.05, 0.2), lens); add(hl, G(THREE.BoxGeometry, 0.4, 0.055, 0.03), led, 0.05, 0.002, -k * 0.09);
    box(black, 0.04, 0.16, 0.1, L - 0.01, 0.34, k * 0.7); // air curtains
    // side gill behind the front wheel, door handle, window line, mirror
    box(black, 0.24, 0.07, 0.02, 0.82, 0.62, k * (w / 2 + 0.003)).rotation.z = 0.3; box(chrome, 0.26, 0.02, 0.025, 0.82, 0.66, k * (w / 2 + 0.005)).rotation.z = 0.3;
    box(chrome, 0.14, 0.025, 0.02, -0.55, 0.86, k * (w / 2 + 0.01));
    box(chrome, 1.3, 0.02, 0.02, -0.33, belt + 0.01, k * (w / 2 - 0.1)); // window line
    rbox(p, 0.17, 0.1, 0.14, 0.04, 0.12, belt + 0.07, k * (w / 2 - 0.02));
    // L-shaped tail lights wrapping round the rear corners
    box(red, 0.05, 0.07, 0.36, -L + 0.01, 0.77, k * 0.56); box(red, 0.05, 0.17, 0.08, -L + 0.01, 0.7, k * 0.7);
    box(red, 0.26, 0.07, 0.04, -L + 0.14, 0.77, k * (w / 2 - 0.005));
    add(body, once('z4pipe', () => new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10).rotateZ(PI / 2)), chrome, -L - 0.01, 0.27, k * 0.55); // tailpipes
  }
  box(black, 0.05, 0.12, 0.9, L - 0.01, 0.3, 0); box(black, 0.05, 0.1, 1.4, -L + 0.01, 0.27, 0); // lower intake, diffuser
  box(M('#f4f4f2'), 0.02, 0.11, 0.5, L + 0.02, 0.32, 0); box(M('#f4f4f2'), 0.02, 0.11, 0.5, -L - 0.01, 0.55, 0); // plates
  const roundel = M('#ffffff', { map: tex('bmwLogo', 64, 64, (c, s) => {
    c.fillStyle = '#111'; c.beginPath(); c.arc(32, 32, 31, 0, 2 * PI); c.fill();
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#fff' : '#1c69d4'; c.beginPath(); c.moveTo(32, 32); c.arc(32, 32, 19, i * PI / 2, (i + 1) * PI / 2); c.fill(); }
  }) });
  add(body, once('z4roundel', () => new THREE.CircleGeometry(0.045, 16).rotateX(-PI / 2).rotateZ(-slope)), roundel, 1.92, top(1.92) + 0.004, 0);
  add(body, once('z4roundelR', () => new THREE.CircleGeometry(0.04, 16).rotateY(-PI / 2)), roundel, -L - 0.005, 0.8, 0);
  return { g, body, len, w, exhaust: new THREE.Vector3(-L - 0.07, 0.27, -0.55) };
}

// ───────────── MAN TGS tipper with knuckle-boom crane (camion.png)
// Contract: { g, body, len, w, exhaust } — body is the sprung part (game bobs body.position.y), wheels stay in g,
// len/w are the footprint in metres, exhaust is a local-space Vector3 at the smoke outlet.
export function buildTruck(env) {
  const g = new THREE.Group(), body = new THREE.Group(), len = 9.6, w = 2.5, L = len / 2, F = L - 0.25; g.add(body);
  const E = { envMap: env }, paint = M('#0e4d51', { roughness: 0.22, metalness: 0.7, ...E }), band = M('#dce6e3', { roughness: 0.3, metalness: 0.3, ...E });
  const green = M('#1f5e4c', { roughness: 0.4, metalness: 0.5, ...E }), floor = M('#193f33'), blue = M('#2748c0', { roughness: 0.35, metalness: 0.45, ...E });
  const black = M('#17191c', { roughness: 0.6 }), chrome = M('#c9d0d6', { roughness: 0.22, metalness: 1, ...E }), glass = M('#2a4655', { roughness: 0.05, metalness: 0.7, ...E });
  const led = M('#0b3440', { emissive: '#3ad8ff', emissiveIntensity: 1.3 }), amber = M('#ffb020', { emissive: '#ff9500', emissiveIntensity: 2 });
  const box = (m, sx, sy, sz, x, y, z, p = body) => add(p, G(THREE.BoxGeometry, sx, sy, sz), m, x, y, z);
  const rbox = (m, sx, sy, sz, rad, x, y, z) => add(body, G(RoundedBoxGeometry, sx, sy, sz, 2, rad), m, x, y, z);
  const cyl = (m, r0, r1, h, seg, x, y, z) => add(body, G(THREE.CylinderGeometry, r0, r1, h, seg), m, x, y, z);
  const beam = (m, [ax, ay], [bx, by], t, z = 0) => { box(m, Math.hypot(bx - ax, by - ay), t, t, (ax + bx) / 2, (ay + by) / 2, z).rotation.z = Math.atan2(by - ay, bx - ax); };
  // cab
  rbox(paint, 2.0, 2.15, w - 0.06, 0.14, F - 1, 2.17, 0);
  rbox(band, 2.02, 0.34, w - 0.04, 0.12, F - 1, 3.0, 0);
  rbox(paint, 1.8, 0.2, w - 0.2, 0.08, F - 1.05, 3.3, 0);
  box(glass, 0.04, 0.95, w - 0.35, F + 0.005, 2.45, 0);
  const grille = M('#ffffff', { roughness: 0.35, metalness: 0.5, ...E, map: tex('man', 512, 204, (c, w, h) => {
    c.fillStyle = '#0c0e10'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e2226';
    for (let y = 10; y < h - 6; y += 16) c.fillRect(10, y, w - 20, 7);
    const gr = c.createLinearGradient(0, 55, 0, 160); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#8d979e'); gr.addColorStop(1, '#f6f8fa');
    c.fillStyle = c.strokeStyle = gr; c.lineWidth = 9; c.beginPath(); c.moveTo(w / 2 - 44, 44); c.lineTo(w / 2, 20); c.lineTo(w / 2 + 44, 44); c.stroke();
    c.font = 'bold 104px Arial, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MAN', w / 2, h * 0.6);
  }) });
  add(body, once('grilleGeo', () => new THREE.PlaneGeometry(1.75, 0.7).rotateY(PI / 2)), grille, F + 0.006, 1.58, 0);
  for (const k of [-1, 1]) {
    const z = k * (w / 2 - 0.02);
    box(glass, 1.0, 0.78, 0.02, F - 0.55, 2.45, k * 1.222);
    box(black, 0.02, 1.7, 0.01, F - 1.15, 2.05, k * 1.221);
    box(black, 0.22, 0.05, 0.03, F - 1.0, 1.95, k * 1.23);
    box(black, 0.05, 0.05, 0.26, F - 0.12, 2.75, k * 1.33);
    rbox(black, 0.12, 0.5, 0.2, 0.05, F - 0.08, 2.45, k * 1.44); // mirrors
    box(M('#dfe9f0', { emissive: '#fff4d6', emissiveIntensity: 0.5 }), 0.03, 0.12, 0.34, F + 0.235, 1.0, k * 0.85);
    box(led, 2.0, 0.035, 0.035, F - 1, 1.1, z); // cab underglow
    cyl(black, 0.12, 0.13, 0.06, 10, F - 0.35, 3.43, k * 0.8); cyl(amber, 0.09, 0.11, 0.17, 10, F - 0.35, 3.54, k * 0.8); // beacons
    add(body, once('arch', () => new THREE.CylinderGeometry(0.64, 0.64, 0.5, 14, 1, true, PI / 2, PI).rotateX(PI / 2)), M('#17191c', { side: THREE.DoubleSide }), F - 1.05, 0.53, k * (w / 2 - 0.2));
  }
  box(black, 0.36, 0.1, w - 0.08, F + 0.06, 3.08, 0).rotation.z = -0.12; // sun visor
  box(led, 0.03, 0.03, w - 0.1, F + 0.24, 3.04, 0);
  rbox(paint, 0.55, 0.62, w, 0.1, F - 0.05, 0.82, 0); // bumper
  box(black, 0.02, 0.2, 1.3, F + 0.23, 0.72, 0);
  box(black, 0.4, 0.05, w + 0.04, L - 0.2, 0.45, 0); box(led, 0.035, 0.035, w + 0.04, L - 0.015, 0.45, 0); // splitter
  box(black, 0.36, 0.62, w - 0.1, F - 1.8, 0.82, 0); box(black, 1.1, 0.5, 1.5, F - 1.05, 0.85, 0); // steps, under-cab
  // chassis, tank, skirts
  box(black, 7.3, 0.28, 0.95, -1.1, 0.92, 0);
  add(body, once('tank', () => new THREE.CylinderGeometry(0.28, 0.28, 1.3, 14).rotateZ(PI / 2)), M('#c9d0d4', { roughness: 0.3, metalness: 0.85, ...E }), 0.85, 0.78, -0.92);
  box(black, 1.3, 0.5, 0.5, 0.85, 0.8, 0.92);
  for (const k of [-1, 1]) { box(black, 3.9, 0.1, 0.06, 0.55, 0.52, k * (w / 2 - 0.12)); box(led, 3.9, 0.035, 0.035, 0.55, 0.47, k * (w / 2 - 0.08)); }
  // tipper body, high sides
  const tx = -1.7, tl = 6.1, th = 1.5, ty = 1.32 + th / 2;
  box(black, 6.0, 0.14, 1.2, tx, 1.13, 0); box(floor, tl, 0.12, w, tx, 1.26, 0);
  box(green, 0.1, th + 0.25, w, tx + tl / 2 - 0.05, ty + 0.125, 0); box(green, 0.1, th, w, tx - tl / 2 + 0.05, ty, 0);
  for (const k of [-1, 1]) {
    box(green, tl, th, 0.08, tx, ty, k * (w / 2 - 0.04)); box(green, tl + 0.04, 0.1, 0.16, tx, ty + th / 2, k * (w / 2 - 0.06));
    for (let x = -4.2; x < 1.2; x += 1) box(green, 0.08, th - 0.1, 0.07, x, ty - 0.05, k * (w / 2 + 0.01));
    box(led, tl, 0.035, 0.035, tx, 1.2, k * (w / 2 + 0.005));
    box(M('#ff2a1f', { emissive: '#d0150c', emissiveIntensity: 1 }), 0.04, 0.12, 0.3, -L + 0.03, 1.02, k * 0.95);
    box(black, 0.03, 0.5, 0.45, -4.0, 0.55, k * (w / 2 - 0.2)); box(black, 2.4, 0.05, 0.48, -2.68, 1.12, k * (w / 2 - 0.2)); // mud flaps, guards
    box(blue, 0.18, 0.72, 0.18, 1.95, 0.92, k * 1.12); box(black, 0.3, 0.05, 0.3, 1.95, 0.55, k * 1.12); // crane stabilisers
  }
  box(black, 0.1, 0.12, 2.2, -L + 0.1, 0.6, 0);
  // blue knuckle-boom crane, folded in transport position between cab and tipper
  box(blue, 0.55, 0.36, w - 0.1, 1.95, 1.2, 0); cyl(black, 0.34, 0.34, 0.1, 12, 1.95, 1.42, 0); cyl(blue, 0.26, 0.3, 1.55, 8, 1.95, 2.1, 0);
  rbox(blue, 0.55, 0.4, 0.55, 0.08, 1.95, 2.9, 0);
  beam(blue, [1.95, 2.95], [1.45, 3.75], 0.34); beam(blue, [1.45, 3.75], [-1.4, 3.1], 0.3); beam(M('#1d3290', { roughness: 0.4 }), [-1.4, 3.1], [-1.95, 2.98], 0.2);
  add(body, once('pin', () => new THREE.CylinderGeometry(0.16, 0.16, 0.42, 12).rotateX(PI / 2)), black, 1.45, 3.75, 0);
  beam(black, [1.35, 3.97], [0.75, 3.83], 0.12); beam(chrome, [0.75, 3.83], [0.05, 3.66], 0.06);
  for (const k of [-1, 1]) beam(chrome, [1.72, 2.2], [1.52, 3.45], 0.07, k * 0.21);
  box(black, 0.12, 0.26, 0.12, -1.95, 2.8, 0);
  // exhaust stack behind the cab (left side)
  const ex = new THREE.Vector3(F - 2.15, 3.72, -(w / 2 - 0.25));
  cyl(chrome, 0.075, 0.075, 2.45, 10, ex.x, 2.47, ex.z); cyl(black, 0.1, 0.1, 0.9, 10, ex.x, 2.9, ex.z); cyl(black, 0.085, 0.085, 0.06, 10, ex.x, ex.y - 0.03, ex.z);
  // wheels (unsprung): 1 front, 2 rear axles
  const tire = once('tire', () => new THREE.CylinderGeometry(0.53, 0.53, 0.42, 22).rotateX(PI / 2)), rim = once('rimT', () => new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18).rotateX(PI / 2));
  const hub = once('hub', () => new THREE.CylinderGeometry(0.1, 0.15, 0.08, 8).rotateX(PI / 2)), ring = once('ring', () => new THREE.TorusGeometry(0.22, 0.03, 4, 18));
  for (const x of [F - 1.05, -2.0, -3.35]) for (const k of [-1, 1]) {
    const z = k * (w / 2 - 0.21);
    add(g, tire, M('#1b1b1d', { roughness: 0.9 }), x, 0.53, z); add(g, rim, chrome, x, 0.53, z + k * 0.2);
    add(g, ring, '#3a3f44', x, 0.53, z + k * 0.225); add(g, hub, '#2a2d31', x, 0.53, z + k * 0.24);
  }
  // soft cyan glow on the ground under the LED strips
  const glow = add(g, G(THREE.PlaneGeometry, len + 1.2, w + 1.2), once('glowMat', () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, map: tex('glow', 256, 88, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.filter = 'blur(6px)'; c.strokeStyle = '#3ad8ff'; c.lineWidth = 9; c.strokeRect(16, 16, w - 32, h - 32);
  }) })), 0, 0.03, 0);
  glow.rotation.x = -PI / 2; glow.castShadow = glow.receiveShadow = false;
  return { g, body, len, w, exhaust: ex };
}

// ───────────── Ferrari F430 (2004-09), Erika's dream car: lofted superellipse sections, vertex-painted (paint / black / glass / lamps)
// 1-D Catmull-Rom through [x, y] knots (x ascending)
const knots = tab => x => {
  let i = 0; while (i < tab.length - 2 && x > tab[i + 1][0]) i++;
  const [x1, a] = tab[i], [x2, b] = tab[i + 1], p = tab[i - 1]?.[1] ?? a, q = tab[i + 2]?.[1] ?? b, u = Math.min(1, Math.max(0, (x - x1) / (x2 - x1)));
  return a + 0.5 * u * (b - p + u * (2 * p - 5 * a + 4 * b - q + u * (3 * (a - b) + q - p)));
};
// closed tube along x in [x0, x1]: sec(x) → [yb, yt, hw, n] superellipse section; fix(v, x, c, s, hw) may move a vertex; paint(v, colour) sets its colour
const loft = (k, x0, x1, nu, nv, sec, fix, paint) => once('loft' + k, () => {
  const pos = [], col = [], idx = [], v = new THREE.Vector3(), cl = new THREE.Color(), sg = (a, e) => Math.sign(a) * Math.abs(a) ** e;
  const rows = [0, 0.25, 0.5, 0.75].map(f => [x0, f]); // flat end caps: shrinking rings at x0 and x1
  for (let i = 0; i <= nu; i++) { const u = i / nu; rows.push([x0 + (x1 - x0) * (u + (1 - Math.cos(PI * u)) / 2) / 2, 1]); }
  rows.push(...[0.75, 0.5, 0.25, 0].map(f => [x1, f]));
  rows.forEach(([x, f], i) => {
    const [yb, yt, hw, n] = sec(x);
    for (let j = 0; j < nv; j++) {
      const a = -PI / 2 + 2 * PI * j / nv, c = Math.cos(a), s = Math.sin(a);
      v.set(x, (yb + yt) / 2 + f * (yt - yb) / 2 * sg(s, 2 / n), f * hw * sg(c, 2 / n)); fix?.(v, x, c, s, hw);
      pos.push(v.x, v.y, v.z); paint(v, cl); col.push(cl.r, cl.g, cl.b);
      if (i < rows.length - 1) { const a = i * nv + j, b = a + nv, c = i * nv + (j + 1) % nv, d = c + nv; idx.push(a, b, c, b, d, c); }
    }
  });
  const geo = new THREE.BufferGeometry(); geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals(); return geo;
});

export function buildF430(env) {
  const g = new THREE.Group(), body = new THREE.Group(), len = 4.51, w = 1.92, L = len / 2, E = { envMap: env }; g.add(body);
  const RED = '#c80b0b', p = M(RED, { roughness: 0.16, metalness: 0.55, ...E }), black = M('#0c0c0e', { roughness: 0.55 });
  const vp = M('#ffffff', { vertexColors: true, roughness: 0.14, metalness: 0.55, ...E }), C = c => new THREE.Color(c), cRed = C(RED), cBlack = C('#0b0b0c'), cGlass = C('#10161c'), cLamp = C('#e4eaee');
  const chrome = M('#d5dade', { roughness: 0.15, metalness: 1, ...E }), red = M('#8e0508', { emissive: '#ff1a10', emissiveIntensity: 0.9 });
  const st = (d, e = 0.04) => Math.min(1, Math.max(0, d / e + 0.5)); // soft step: 0 → 1 as d crosses 0 (decal edges)
  const axles = [[1.3, 0.32, 0.24], [-1.3, 0.34, 0.29]]; // x, wheel radius, tyre width (fat rears)
  // lower body: wedge nose, fenders standing above the bonnet, scooped side intakes, wheel arches cut out
  const bT = knots([[-L, 0.8], [-2.2, 0.92], [-2.0, 0.95], [-1.3, 0.96], [-0.6, 0.9], [0.2, 0.86], [0.8, 0.83], [1.3, 0.8], [1.8, 0.7], [2.1, 0.58], [L, 0.44]]);
  const bB = knots([[-L, 0.3], [-2.1, 0.17], [-1.8, 0.13], [1.9, 0.12], [2.15, 0.15], [L, 0.26]]);
  const bW = knots([[-L, 0.9], [-1.9, 0.95], [-1.3, 0.96], [-0.7, 0.9], [0, 0.86], [0.7, 0.9], [1.3, 0.95], [1.9, 0.9], [L, 0.8]]);
  const cap = (x, c, h, q) => Math.max(0, 1 - Math.abs((x - c) / h) ** q) ** (1 / q);
  const sec = x => [bB(x), bT(x), bW(x) * cap(x, 0, L + 0.01, x > 0 ? 5 : 12), x > 0 ? 3.8 : 3.8 + 2 * bump(x, -L, 0.5)];
  // x of the body surface at (y, z), scanning in from the nose (dir 1) or the tail (dir -1)
  const surfX = (y, z, dir) => { for (let x = dir * L; x * dir > 0; x -= dir * 0.005) { const [yb, yt, hw, n] = sec(x), f = Math.abs((2 * y - yb - yt) / (yt - yb)); if (f < 1 && hw * (1 - f ** n) ** (1 / n) >= Math.abs(z)) return x; } };
  const dip = x => 0.08 * bump(x, 1.6, 0.6), intake = x => Math.min(1, Math.max(0, (x + 1.05) / 0.5)) * Math.min(1, Math.max(0, (-0.4 - x) / 0.06));
  add(body, loft('f430body', -L, L, 220, 110, sec, (v, x, c, s, hw) => {
    if (s > 0) v.y -= dip(x) * (1 - (v.z / (hw || 1)) ** 2);
    v.z -= Math.sign(v.z) * 0.1 * bump(v.y, 0.56, 0.13) * intake(x) * Math.abs(c);
    for (const [ax, R] of axles) { const dx = x - ax, Ra = R + 0.04; if (Math.abs(dx) < Ra) v.y = Math.max(v.y, R + Math.sqrt(Ra * Ra - dx * dx)); }
  }, ({ x, y, z }, cl) => {
    const az = Math.abs(z), hx = 0.94 * (x - 1.72) + 0.34 * (az - 0.7), hz = 0.34 * (x - 1.72) - 0.94 * (az - 0.7);
    const dark = Math.max(
      st(x - 1.9) * st(1 - ((az - 0.56) / 0.24) ** 2 - ((y - 0.3) / 0.11) ** 2, 0.25), // two oval nose intakes
      st(-1.95 - x) * Math.max(st(0.33 - y), st(0.42 - az, 0.02) * st(y - 0.64, 0.02) * st(0.86 - y, 0.02)), // diffuser, grille between the tail lights
      st(az - 0.5) * st(intake(x) * bump(y, 0.56, 0.13) - 0.3, 0.12)); // side intakes behind the doors
    cl.copy(cRed).lerp(cBlack, dark).lerp(cLamp, st(y - bT(x) + 0.2) * st(1 - (hx / 0.3) ** 2 - (hz / 0.075) ** 2, 0.3)); // teardrop headlights on the fenders
  }), vp);
  // greenhouse: long raked windscreen, short painted roof, sail panels either side of the glass engine cover
  const cT = knots([[-2.02, 0.92], [-1.85, 0.98], [-1.3, 1.04], [-0.75, 1.14], [-0.3, 1.2], [0.05, 1.21], [0.4, 1.13], [0.75, 0.96], [1.0, 0.8]]);
  const cW = knots([[-2.02, 0.7], [-1.5, 0.8], [-0.8, 0.77], [-0.3, 0.7], [0.3, 0.7], [1.0, 0.86]]);
  add(body, loft('f430cab', -2.02, 1.0, 140, 80, x => [0.35, cT(x), cW(x) * cap(x, -0.51, 1.53, 6), 2.4], null, ({ x, y, z }, cl) =>
    cl.copy(cRed).lerp(cGlass, st(y - 0.87) * (1 - st(-0.55 - x) * st(Math.abs(z) - 0.4)) * (1 - st(y - 1.15, 0.02) * st(x + 0.6) * st(0.08 - x)))), vp);
  // wheels: 5 twin-spoke silver rims with the yellow centre badge, dark wells inside the arches
  const rim = rimTex('f430Rim', (c, r) => {
    c.fillStyle = '#1c1d20'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill();
    c.strokeStyle = c.fillStyle = '#cfd3d7'; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { c.rotate(2 * PI / 5); c.lineWidth = 7; c.beginPath(); c.moveTo(-4, 12); c.lineTo(-11, r - 8); c.moveTo(4, 12); c.lineTo(11, r - 8); c.stroke(); }
    c.lineWidth = 6; c.beginPath(); c.arc(0, 0, r - 4, 0, 2 * PI); c.stroke();
    c.beginPath(); c.arc(0, 0, 16, 0, 2 * PI); c.fill(); c.fillStyle = '#f5c400'; c.beginPath(); c.arc(0, 0, 9, 0, 2 * PI); c.fill();
  });
  for (const [x, R, tw] of axles) {
    add(body, G(THREE.BoxGeometry, 2 * R + 0.08, 2 * R - 0.02, w - 0.26), black, x, R + 0.02, 0);
    for (const k of [-1, 1]) {
      const z = k * (w / 2 - tw / 2 - 0.02);
      add(g, once('f430tire' + R, () => new THREE.CylinderGeometry(R, R, tw, 24).rotateX(PI / 2)), M('#141416', { roughness: 0.9 }), x, R, z);
      add(g, once('f430rim' + R, () => new THREE.CircleGeometry(R * 0.74, 24)), rim, x, R, z + k * (tw / 2 + 0.003)).rotation.y = k > 0 ? 0 : PI;
    }
  }
  const cyl = (m, r, l, x, y, z) => add(body, once('f430cyl' + r + l, () => new THREE.CylinderGeometry(r, r, l, 16).rotateZ(PI / 2)), m, x, y, z);
  for (const k of [-1, 1]) {
    for (const z of [0.5, 0.7]) { const x = surfX(0.78, z, -1); cyl(black, 0.085, 0.04, x, 0.78, k * z); cyl(red, 0.07, 0.06, x, 0.78, k * z); } // twin round tail lights
    for (const z of [0.5, 0.63]) { const x = surfX(0.26, z, -1); cyl(chrome, 0.05, 0.2, x + 0.02, 0.26, k * z); cyl(black, 0.038, 0.2, x + 0.01, 0.26, k * z); } // quad exhausts
    add(body, S(), p, 0.6, 0.97, k * 0.8, [0.07, 0.05, 0.1]); add(body, G(THREE.BoxGeometry, 0.04, 0.025, 0.14), black, 0.62, 0.94, k * 0.66); // mirrors on stalks
  }
  // prancing-horse shield on the bonnet
  const badge = M('#ffffff', { roughness: 0.3, map: tex('f430Badge', 48, 64, (c, w, h) => {
    c.fillStyle = '#f5c400'; c.beginPath(); c.moveTo(2, 2); c.lineTo(w - 2, 2); c.lineTo(w - 2, h * 0.7); c.quadraticCurveTo(w / 2, h, 2, h * 0.7); c.fill();
    ['#139a43', '#fff', '#da251d'].forEach((col, i) => { c.fillStyle = col; c.fillRect(2 + i * (w - 4) / 3, 2, (w - 4) / 3, 8); });
    c.fillStyle = '#111'; c.beginPath(); c.ellipse(w / 2, h * 0.5, 7, 13, 0.3, 0, 2 * PI); c.fill(); c.fillRect(w / 2 - 12, h * 0.3, 8, 5); c.fillRect(w / 2 + 3, h * 0.66, 4, 12);
  }) });
  add(body, once('f430BadgeGeo', () => new THREE.PlaneGeometry(0.07, 0.09).rotateX(-PI / 2).rotateY(-PI / 2).rotateZ(-0.35)), badge, 2.02, bT(2.02) - dip(2.02) + 0.01, 0);
  return { g, body, len, w, exhaust: new THREE.Vector3(-L - 0.1, 0.26, 0.56) };
}

// ───────────── Erika's cars: BMW X3 G01 LCI (bmw.jpeg) and a grey Dacia Spring
// Contract: { g, body, len, w, exhaust? } like buildTruck; the Spring is electric, so no exhaust.
// shared base: lower body whose top drops toward the nose, glass cab (tumblehome) + painted roof, dark wheel wells, wheels in g
function carBase(env, k, { len, w, sill, belt, hood, cab: [rx, fx, tx, trx, h], paint, wheelR, tw, axles, rim }) {
  const g = new THREE.Group(), body = new THREE.Group(), E = { envMap: env }; g.add(body);
  const p = M(paint, { roughness: 0.22, metalness: 0.65, ...E }), bh = belt - sill;
  add(body, once(k + 'body', () => {
    const geo = new RoundedBoxGeometry(len, bh, w, 3, 0.13), v = geo.attributes.position;
    for (let i = 0; i < v.count; i++) if (v.getY(i) > 0) v.setY(i, v.getY(i) - hood * Math.min(1, Math.max(0, (v.getX(i) - fx) / (len / 2 - fx))));
    geo.computeVertexNormals(); return geo;
  }), p, 0, sill + bh / 2, 0);
  add(body, once(k + 'cab', () => {
    const d = w - 0.2, geo = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(rx, 0), new THREE.Vector2(fx, 0), new THREE.Vector2(tx, h), new THREE.Vector2(trx, h * 0.96)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), v = geo.attributes.position;
    for (let i = 0; i < v.count; i++) v.setZ(i, v.getZ(i) * (1 - 0.14 * v.getY(i) / h));
    geo.computeVertexNormals(); return geo;
  }), M('#1b232c', { roughness: 0.06, metalness: 0.6, ...E }), 0, belt - 0.02, 0);
  add(body, G(RoundedBoxGeometry, tx - trx + 0.04, 0.07, (w - 0.2) * 0.86 + 0.03, 2, 0.03), p, (tx + trx) / 2 - 0.01, belt + h - 0.01, 0);
  const tire = once('tire' + wheelR + tw, () => new THREE.CylinderGeometry(wheelR, wheelR, tw, 22).rotateX(PI / 2));
  const well = once('well' + wheelR, () => new THREE.CircleGeometry(wheelR + 0.05, 16, 0, PI)), disc = once('disc' + wheelR, () => new THREE.CircleGeometry(wheelR * 0.68, 20));
  for (const x of axles) for (const s of [-1, 1]) {
    const z = s * (w / 2 - tw / 2 + 0.02);
    add(g, tire, M('#18181a', { roughness: 0.9 }), x, wheelR, z);
    add(g, disc, rim, x, wheelR, z + s * (tw / 2 + 0.003)).rotation.y = s > 0 ? 0 : PI;
    add(body, well, '#0d0d0e', x, wheelR, s * (w / 2 + 0.003)).rotation.y = s > 0 ? 0 : PI;
  }
  return { g, body, p, E, L: len / 2 };
}
const rimTex = (k, draw) => M('#ffffff', { roughness: 0.3, metalness: 0.8, map: tex(k, 128, 128, (c, w) => { c.translate(w / 2, w / 2); draw(c, w / 2); }) });

export function buildBMW(env) {
  const len = 4.71, w = 1.89, sill = 0.3, belt = 1.1;
  const rim = rimTex('bmwRim', (c, r) => { // 18" multi-spoke, dark brakes behind
    c.fillStyle = '#26282b'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill();
    c.strokeStyle = '#d4d8dc'; c.lineCap = 'round';
    for (let i = 0; i < 10; i++) { c.rotate(PI / 5); c.lineWidth = 7; c.beginPath(); c.moveTo(0, 12); c.lineTo(-7, r - 8); c.moveTo(0, 12); c.lineTo(7, r - 8); c.stroke(); }
    c.lineWidth = 6; c.beginPath(); c.arc(0, 0, r - 4, 0, 2 * PI); c.stroke();
    c.fillStyle = '#1d1f22'; c.beginPath(); c.arc(0, 0, 14, 0, 2 * PI); c.fill();
  });
  const { g, body, p, E, L } = carBase(env, 'bmw', { len, w, sill, belt, hood: 0.13, cab: [-2.2, 0.6, -0.4, -1.98, 0.56], paint: '#2b2f36', wheelR: 0.37, tw: 0.27, axles: [1.47, -1.39], rim });
  const box = (m, sx, sy, sz, x, y, z) => add(body, G(THREE.BoxGeometry, sx, sy, sz), m, x, y, z);
  const chrome = M('#d7dce0', { roughness: 0.15, metalness: 1, ...E }), black = M('#141518', { roughness: 0.5 }), trim = M('#8e949a', { roughness: 0.3, metalness: 0.9, ...E });
  const led = M('#eaf2ff', { emissive: '#d8e8ff', emissiveIntensity: 1.2 }), red = M('#9c0d10', { emissive: '#e01010', emissiveIntensity: 0.7 });
  // big kidney grille: chrome frames, black vertical slats
  const slats = M('#ffffff', { roughness: 0.4, metalness: 0.5, map: tex('kidney', 64, 64, (c, s) => { c.fillStyle = '#0c0d0f'; c.fillRect(0, 0, s, s); c.fillStyle = '#5b6066'; for (let x = 3; x < s; x += 8) c.fillRect(x, 0, 3, s); }) });
  for (const k of [-1, 1]) {
    add(body, G(RoundedBoxGeometry, 0.05, 0.44, 0.4, 2, 0.06), chrome, L - 0.02, 0.76, k * 0.22);
    box(slats, 0.03, 0.37, 0.33, L + 0.01, 0.76, k * 0.22);
    box(led, 0.04, 0.1, 0.44, L - 0.07, 0.93, k * 0.64).rotation.y = -k * 0.12; // slim LED headlights
    box(black, 0.04, 0.2, 0.08, L - 0.03, 0.5, k * 0.78); // air curtains
    add(body, G(RoundedBoxGeometry, 0.05, 0.1, 0.4, 2, 0.03), red, -L + 0.02, 0.9, k * 0.66); // L-shaped tail lights
    box(red, 0.05, 0.16, 0.1, -L + 0.03, 0.82, k * 0.83);
    box(chrome, 0.06, 0.07, 0.24, -L + 0.02, 0.38, k * 0.55); // twin tailpipes
    box(trim, 2.6, 0.05, 0.02, -0.1, 0.4, k * (w / 2 + 0.005)); // silver sill strip
    box(chrome, 2.7, 0.03, 0.02, -0.8, belt + 0.02, k * (w / 2 - 0.1)); // window line
    box(trim, 1.9, 0.05, 0.05, -1.2, belt + 0.6, k * 0.64); // roof rails
    for (const x of [-0.45, -1.2]) box(chrome, 0.16, 0.03, 0.03, x, 1.0, k * (w / 2 + 0.01)); // door handles
    add(body, G(RoundedBoxGeometry, 0.2, 0.13, 0.16, 2, 0.04), p, 0.42, belt + 0.1, k * (w / 2 + 0.06)); // mirrors
  }
  box(black, 0.05, 0.14, 1.2, L - 0.04, 0.46, 0); box(trim, 0.05, 0.05, 1.3, L - 0.05, 0.35, 0); // lower intake, skid plate
  box(M('#f4f4f2'), 0.02, 0.11, 0.5, L + 0.02, 0.56, 0); box(M('#f4f4f2'), 0.02, 0.11, 0.5, -L - 0.01, 0.62, 0); // plates
  box(trim, 0.05, 0.06, 1.3, -L + 0.03, 0.33, 0);
  const roundel = M('#ffffff', { map: tex('bmwLogo', 64, 64, (c, s) => {
    c.fillStyle = '#111'; c.beginPath(); c.arc(32, 32, 31, 0, 2 * PI); c.fill();
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#fff' : '#1c69d4'; c.beginPath(); c.moveTo(32, 32); c.arc(32, 32, 19, i * PI / 2, (i + 1) * PI / 2); c.fill(); }
  }) });
  add(body, once('roundelGeo', () => new THREE.CircleGeometry(0.06, 16).rotateX(-PI / 2).rotateZ(-0.1)), roundel, L - 0.2, belt - 0.1, 0);
  add(body, G(RoundedBoxGeometry, 0.3, 0.06, 1.35, 2, 0.03), p, -1.98, belt + 0.54, 0); // tailgate spoiler
  return { g, body, len, w, exhaust: new THREE.Vector3(-L - 0.05, 0.38, 0.55) };
}

// ───────────── Clément's grey VW Polo (6C, 2015, 5-door), battered: dents, primer door, taped headlight, hanging bumper, odd steel wheel
const vwLogo = () => M('#ffffff', { roughness: 0.3, metalness: 0.7, map: tex('vwLogo', 64, 64, c => {
  c.fillStyle = '#c9ced3'; c.beginPath(); c.arc(32, 32, 31, 0, 2 * PI); c.fill();
  c.strokeStyle = '#2d3136'; c.lineWidth = 4; c.beginPath(); c.arc(32, 32, 27, 0, 2 * PI);
  c.moveTo(19, 11); c.lineTo(32, 38); c.lineTo(45, 11); c.moveTo(9, 22); c.lineTo(21, 50); c.lineTo(32, 30); c.lineTo(43, 50); c.lineTo(55, 22); c.stroke();
}) });
const frPlate = () => M('#ffffff', { roughness: 0.5, map: tex('frPlate', 256, 56, (c, w, h) => {
  c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f3fa6'; c.fillRect(0, 0, 22, h); c.fillRect(w - 22, 0, 22, h);
  c.fillStyle = '#111'; c.font = 'bold 34px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DZ-815-CL', w / 2, h / 2 + 2);
}) });
export function buildPolo(env) {
  const len = 3.97, w = 1.68, sill = 0.26, belt = 0.95, bh = belt - sill, cy = sill + bh / 2, L = len / 2, fx = 1.0, hood = 0.13, rearX = -1.25;
  // dents [x, y, z, radius, depth, push direction] in car space
  const dents = [[0.3, 0.62, w / 2, 0.22, 0.08, 0, 0, -1], [1.55, 0.74, 0.81, 0.15, 0.05, 0, -0.3, -1], [1.2, 0.9, -0.3, 0.22, 0.05, 0, -1, 0],
    [-1.62, 0.72, w / 2, 0.18, 0.08, 0, 0, -1], [-0.62, 0.52, -w / 2, 0.22, 0.09, 0, 0, 1], [-L, 0.55, 0.35, 0.18, 0.05, 1, 0, 0], [1.7, 0.6, -0.8, 0.16, 0.06, -0.4, 0, 0.9]];
  once('polobody', () => { // rounded box by hand (dense grid so dents show), nose drops and narrows, shoulder crease, dents
    const r = 0.12, geo = new THREE.BoxGeometry(len, bh, w, 60, 10, 26), v = geo.attributes.position, p = new THREE.Vector3(), q = new THREE.Vector3(), cl = THREE.MathUtils.clamp;
    for (let i = 0; i < v.count; i++) {
      p.fromBufferAttribute(v, i);
      q.set(cl(p.x, r - L, L - r), cl(p.y, r - bh / 2, bh / 2 - r), cl(p.z, r - w / 2, w / 2 - r)); p.sub(q).setLength(r).add(q);
      const f = cl((p.x - fx) / (L - fx), 0, 1);
      p.y -= hood * f * (p.y / bh + 0.5); p.z *= 1 - 0.06 * f * f;
      if (p.y + cy > 0.8 && Math.abs(p.z) > w / 2 - 0.1) p.z += Math.sign(p.z) * 0.01;
      for (const [x, y, z, rad, d, nx, ny, nz] of dents) { const k = d * Math.exp(-((p.x - x) ** 2 + (p.y + cy - y) ** 2 + (p.z - z) ** 2) / rad ** 2); p.x += nx * k; p.y += ny * k; p.z += nz * k; }
      v.setXYZ(i, p.x, p.y, p.z);
    }
    geo.computeVertexNormals(); return geo;
  });
  const cap = rimTex('poloCap', (c, r) => { // Trendline plastic wheel cover
    c.fillStyle = '#b9bec3'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill(); c.fillStyle = '#2b2d30';
    for (let i = 0; i < 12; i++) { c.rotate(PI / 6); c.fillRect(-4, r * 0.4, 8, r * 0.45); }
    c.fillStyle = '#8d9297'; c.beginPath(); c.arc(0, 0, 14, 0, 2 * PI); c.fill();
  });
  const { g, body, p, E } = carBase(env, 'polo', { len, w, sill, belt, hood, cab: [-1.88, fx, 0.1, -1.65, 0.48], paint: '#50555b', wheelR: 0.3, tw: 0.19, axles: [1.22, rearX], rim: cap });
  body.children[0].material = M('#ffffff', { roughness: 0.25, metalness: 0.65, ...E, map: tex('poloScratch', 512, 256, (c, w, h) => {
    c.fillStyle = '#50555b'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { // key scratches, scuffs
      const x = Math.random() * w, y = Math.random() * h, a = (Math.random() - 0.5) * 0.6, l = 10 + Math.random() * 90;
      c.strokeStyle = Math.random() < 0.7 ? '#9ba0a6' : '#34383c'; c.lineWidth = Math.random() < 0.8 ? 1 : 2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    for (let i = 0; i < 6; i++) { // rust spots
      const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 6;
      c.fillStyle = '#7a5236'; c.beginPath(); c.arc(x, y, r, 0, 2 * PI); c.fill(); c.fillStyle = '#4a2e1c'; c.beginPath(); c.arc(x, y, r / 2, 0, 2 * PI); c.fill();
    }
  }) });
  g.children.find(m => m.material === cap && m.position.x === rearX && m.position.z > 0).material = rimTex('poloSteel', (c, r) => { // bare black steel wheel, lost its cover
    c.fillStyle = '#26272a'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill(); c.fillStyle = '#0b0b0c';
    for (let i = 0; i < 8; i++) { c.rotate(PI / 4); c.beginPath(); c.arc(0, r * 0.58, 8, 0, 2 * PI); c.fill(); }
    c.fillStyle = '#6b4a33'; c.beginPath(); c.arc(0, 0, 22, 0, 2 * PI); c.fill(); c.fillStyle = '#9a9ea2';
    for (let i = 0; i < 5; i++) { c.rotate(2 * PI / 5); c.beginPath(); c.arc(0, 15, 4, 0, 2 * PI); c.fill(); }
  });
  const box = (m, sx, sy, sz, x, y, z, par = body) => add(par, G(THREE.BoxGeometry, sx, sy, sz), m, x, y, z);
  const rbox = (m, sx, sy, sz, r, x, y, z, par = body) => add(par, G(RoundedBoxGeometry, sx, sy, sz, 2, r), m, x, y, z);
  const black = M('#16171a', { roughness: 0.6 }), chrome = M('#d2d6da', { roughness: 0.2, metalness: 1, ...E }), tape = M('#b4b7b2', { roughness: 0.55, metalness: 0.3 });
  const glass = M('#dfe6ee', { roughness: 0.1, metalness: 0.5, ...E }), red = M('#a3161a', { emissive: '#d01010', emissiveIntensity: 0.5, roughness: 0.3 });
  const cracked = M('#ffffff', { roughness: 0.15, metalness: 0.3, map: tex('poloCrack', 64, 32, (c, w, h) => {
    c.fillStyle = '#dde3ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a4048'; c.lineWidth = 1.2; c.beginPath();
    for (let i = 0; i < 9; i++) { const a = i * 0.7; c.moveTo(22, 14); c.lineTo(22 + Math.cos(a) * 30, 14 + Math.sin(a) * 18); } c.stroke();
  }) });
  const logo = once('vwLogoGeo', () => new THREE.CircleGeometry(0.065, 20));
  // front: horizontal grille bar with logo, straight-edged headlights (right one cracked and taped)
  box(black, 0.04, 0.08, 0.62, L - 0.01, 0.66, 0); box(chrome, 0.045, 0.014, 0.62, L - 0.005, 0.705, 0);
  add(body, logo, vwLogo(), L + 0.02, 0.66, 0).rotation.y = PI / 2;
  for (const k of [-1, 1]) {
    const hl = pivot(body, L - 0.04, 0.67, k * 0.57); hl.rotation.y = -k * 0.25;
    rbox(k > 0 ? cracked : glass, 0.1, 0.12, 0.38, 0.02, 0, 0, 0, hl);
    if (k > 0) for (const a of [-0.4, 0.4]) box(tape, 0.012, 0.04, 0.4, 0.05, 0, 0, hl).rotation.x = a;
  }
  // front bumper, torn off its right clip and hanging
  const bp = pivot(body, L - 0.01, 0.42, -0.72); bp.rotation.set(0.09, 0.06, 0);
  rbox(p, 0.18, 0.28, w - 0.06, 0.06, 0, 0, 0.72, bp); box(black, 0.04, 0.09, 0.9, 0.08, -0.07, 0.72, bp);
  add(bp, G(THREE.PlaneGeometry, 0.52, 0.11), frPlate(), 0.093, 0.05, 0.72).rotation.y = PI / 2;
  box(tape, 0.22, 0.04, 0.012, L - 0.08, 0.5, w / 2 - 0.1).rotation.z = 0.5;
  // rear: horizontal tail lights, logo, plate in the tailgate, bumper, exhaust, spoiler
  for (const k of [-1, 1]) rbox(red, 0.08, 0.14, 0.44, 0.02, -L + 0.05, 0.79, k * 0.58).rotation.y = k * 0.25;
  add(body, logo, vwLogo(), -L - 0.005, 0.72, 0).rotation.y = -PI / 2;
  add(body, G(THREE.PlaneGeometry, 0.52, 0.11), frPlate(), -L - 0.005, 0.56, 0).rotation.y = -PI / 2;
  rbox(p, 0.14, 0.22, w - 0.04, 0.05, -L + 0.02, 0.35, 0); box(black, 0.05, 0.05, 1.1, -L - 0.03, 0.27, 0);
  add(body, G(THREE.CylinderGeometry, 0.03, 0.03, 0.14, 8), '#3a3a3a', -L - 0.02, 0.24, -0.45).rotation.z = PI / 2;
  rbox(p, 0.22, 0.05, 1.3, 0.02, -1.7, belt + 0.47, 0);
  box(black, 0.02, 0.2, 0.02, -1.3, belt + 0.56, 0).rotation.z = 0.5; // antenna
  // sides: door seams & handles, black B-pillar, painted C-pillar, mirrors (right one dangling)
  for (const k of [-1, 1]) {
    for (const x of [0.86, -0.3, -0.95]) box(black, 0.008, 0.46, 0.006, x, 0.6, k * (w / 2 + 0.004));
    for (const x of [0.35, -0.75]) box(chrome, 0.13, 0.025, 0.025, x, 0.84, k * (w / 2 + 0.012));
    box(black, 0.09, 0.44, 0.02, -0.34, belt + 0.22, k * 0.7).rotation.x = -k * 0.21;
    box(p, 0.38, 0.4, 0.02, -1.58, belt + 0.2, k * 0.695).rotation.x = -k * 0.21;
  }
  rbox(p, 0.2, 0.12, 0.13, 0.04, 0.9, belt + 0.08, -(w / 2 + 0.06));
  const mr = pivot(body, 0.9, belt + 0.03, w / 2); mr.rotation.x = 0.9;
  rbox(p, 0.2, 0.12, 0.13, 0.04, 0, -0.02, 0.08, mr); box(tape, 0.05, 0.012, 0.12, 0, 0.045, 0.05, mr);
  // mismatched panels: primer rear door (right), wrong-silver front door (left)
  rbox(M('#8b8d86', { roughness: 0.95 }), 0.6, 0.46, 0.02, 0.008, -0.625, 0.59, w / 2 - 0.006);
  rbox(M('#6f7a88', { roughness: 0.25, metalness: 0.65, ...E }), 1.1, 0.46, 0.02, 0.008, 0.28, 0.59, -(w / 2 - 0.006));
  return { g, body, len, w, exhaust: new THREE.Vector3(-L - 0.1, 0.24, -0.45) };
}

// ───────────── a stranger's black Seat Leon Cupra, tuned: lowered, black wheels, twin big pipes, roof spoiler, dark tint,
// Portuguese flag sticker on the rear window and on a roof-antenna. flames: backfire cones at the pipes, hidden until game.js flashes them.
const ptFlag = () => M('#ffffff', { roughness: 0.6, side: THREE.DoubleSide, map: tex('ptFlag', 96, 64, (c, w, h) => {
  c.fillStyle = '#046a38'; c.fillRect(0, 0, w * 0.4, h); c.fillStyle = '#da291c'; c.fillRect(w * 0.4, 0, w * 0.6, h);
  c.strokeStyle = '#ffe000'; c.lineWidth = 3; c.beginPath(); c.arc(w * 0.4, h / 2, 15, 0, 2 * PI); c.stroke(); // armillary sphere
  c.lineWidth = 2; c.beginPath(); c.ellipse(w * 0.4, h / 2, 15, 5, -0.4, 0, 2 * PI); c.stroke();
  c.fillStyle = '#fff'; c.fillRect(w * 0.4 - 8, h / 2 - 9, 16, 18); c.fillStyle = '#da291c'; c.fillRect(w * 0.4 - 6, h / 2 - 7, 12, 14); // shield
  c.fillStyle = '#fff'; c.fillRect(w * 0.4 - 3, h / 2 - 4, 6, 8); c.fillStyle = '#1d3f9a'; c.fillRect(w * 0.4 - 2, h / 2 - 3, 4, 6);
}) });
export function buildSeat(env) {
  const len = 4.2, w = 1.8, sill = 0.16, belt = 0.86, hood = 0.17, fx = 0.72, h = 0.48, rx = -1.98, trx = -1.42;
  const rim = rimTex('seatRim', (c, r) => { // gloss black 5 twin-spoke, grey spoke edges
    c.fillStyle = '#050506'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill();
    c.fillStyle = '#c4121a'; c.beginPath(); c.arc(0, 0, r - 12, -PI * 0.72, -PI * 0.28); c.arc(0, 0, r - 34, -PI * 0.28, -PI * 0.72, true); c.fill(); // red caliper behind the spokes
    c.strokeStyle = '#3c3f45'; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { c.rotate(2 * PI / 5); c.lineWidth = 9; c.beginPath(); c.moveTo(-4, 12); c.lineTo(-11, r - 6); c.moveTo(4, 12); c.lineTo(11, r - 6); c.stroke(); }
    c.strokeStyle = '#8a8f96'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r - 2, 0, 2 * PI); c.stroke(); // machined lip
    c.fillStyle = '#b8bcc0'; c.beginPath(); c.arc(0, 0, 9, 0, 2 * PI); c.fill();
  });
  const { g, body, p, E, L } = carBase(env, 'seat', { len, w, sill, belt, hood, cab: [rx, fx, -0.02, trx, h], paint: '#0c0d10', wheelR: 0.33, tw: 0.25, axles: [1.33, -1.3], rim });
  body.children[1].material = M('#0f151c', { roughness: 0.03, metalness: 0.9, ...E }); // limo tint, still catching reflections
  const box = (m, sx, sy, sz, x, y, z, par = body) => add(par, G(THREE.BoxGeometry, sx, sy, sz), m, x, y, z);
  const rbox = (m, sx, sy, sz, r, x, y, z) => add(body, G(RoundedBoxGeometry, sx, sy, sz, 2, r), m, x, y, z);
  const black = M('#101113', { roughness: 0.55 }), chrome = M('#d5dade', { roughness: 0.12, metalness: 1, ...E });
  const led = M('#f2f7ff', { emissive: '#dfeaff', emissiveIntensity: 1.4 }), red = M('#9c0d10', { emissive: '#e01010', emissiveIntensity: 0.8 });
  const lens = M('#8f9aa6', { roughness: 0.08, metalness: 0.6, ...E }), mesh = M('#ffffff', { roughness: 0.5, map: tex('seatMesh', 64, 32, (c, s, t) => {
    c.fillStyle = '#040405'; c.fillRect(0, 0, s, t); c.fillStyle = '#2a2c30';
    for (let y = 2; y < t; y += 6) for (let x = (y % 12 ? 0 : 3); x < s; x += 6) c.fillRect(x, y, 3, 3); // honeycomb
  }) });
  const logo = M('#ffffff', { roughness: 0.25, metalness: 0.8, map: tex('seatLogo', 64, 64, c => { // chrome split "S"
    c.fillStyle = '#111'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#dfe3e7';
    c.beginPath(); c.moveTo(14, 12); c.lineTo(52, 12); c.lineTo(52, 22); c.lineTo(26, 30); c.lineTo(14, 30); c.fill();
    c.beginPath(); c.moveTo(50, 52); c.lineTo(12, 52); c.lineTo(12, 42); c.lineTo(38, 34); c.lineTo(50, 34); c.fill();
  }) });
  const plate = M('#ffffff', { roughness: 0.5, map: tex('ptPlate', 256, 56, (c, w, h) => {
    c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f3fa6'; c.fillRect(0, 0, 22, h); c.fillStyle = '#f2c500'; c.fillRect(w - 22, 0, 22, h);
    c.fillStyle = '#111'; c.font = 'bold 34px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('27-XT-91', w / 2, h / 2 + 2);
  }) });
  // nose: honeycomb grille with the logo, big lower intake, splitter, sharp LED headlights
  const nose = belt - hood;
  box(mesh, 0.04, 0.13, 0.7, L - 0.02, nose - 0.13, 0); box(chrome, 0.045, 0.012, 0.7, L - 0.01, nose - 0.06, 0);
  add(body, G(THREE.PlaneGeometry, 0.12, 0.12), logo, L + 0.005, nose - 0.13, 0).rotation.y = PI / 2;
  box(mesh, 0.04, 0.14, 1.1, L - 0.01, 0.3, 0); box(black, 0.2, 0.03, w - 0.1, L - 0.02, 0.17, 0); // lower intake, splitter
  add(body, G(THREE.PlaneGeometry, 0.52, 0.11), plate, L + 0.015, 0.3, 0).rotation.y = PI / 2;
  for (const k of [-1, 1]) {
    const hl = pivot(body, L - 0.07, nose - 0.08, k * 0.62); hl.rotation.set(0, -k * 0.35, -0.2);
    add(hl, G(THREE.BoxGeometry, 0.2, 0.08, 0.36), lens); add(hl, G(THREE.BoxGeometry, 0.2, 0.02, 0.3), led, 0.012, -0.03, 0);
    box(mesh, 0.04, 0.12, 0.2, L - 0.04, 0.33, k * 0.73); // side intakes
    // sides: black skirts, handles, belt line, mirrors
    box(black, 2.2, 0.08, 0.04, -0.05, sill + 0.03, k * (w / 2 + 0.005));
    for (const x of [0.15, -0.95]) box(chrome, 0.14, 0.025, 0.02, x, 0.76, k * (w / 2 + 0.01));
    box(chrome, 2.4, 0.02, 0.02, -0.66, belt + 0.01, k * (w / 2 - 0.1)); // chrome belt line so the tint reads against the paint
    rbox(p, 0.18, 0.1, 0.15, 0.04, 0.5, belt + 0.08, k * (w / 2 + 0.02));
    // rear: wide LED tail lights on the corners, twin big round pipes in a diffuser
    box(red, 0.05, 0.1, 0.44, -L + 0.03, 0.74, k * 0.6).rotation.y = k * 0.18;
    box(led, 0.052, 0.012, 0.36, -L + 0.03, 0.72, k * 0.6).rotation.y = k * 0.18;
    add(body, once('seatPipe', () => new THREE.CylinderGeometry(0.075, 0.075, 0.16, 16).rotateZ(PI / 2)), chrome, -L - 0.02, 0.24, k * 0.16);
    add(body, once('seatPipeIn', () => new THREE.CylinderGeometry(0.058, 0.058, 0.16, 16).rotateZ(PI / 2)), '#050505', -L - 0.03, 0.24, k * 0.16);
  }
  box(black, 0.06, 0.13, 1.3, -L + 0.01, 0.25, 0); for (const z of [-0.5, -0.36, 0.36, 0.5]) box(black, 0.14, 0.13, 0.02, -L - 0.03, 0.25, z); // diffuser fins
  add(body, G(THREE.PlaneGeometry, 0.52, 0.11), plate, -L - 0.005, 0.5, 0).rotation.y = -PI / 2;
  add(body, G(THREE.PlaneGeometry, 0.09, 0.09), logo, -L - 0.005, 0.72, 0).rotation.y = -PI / 2;
  rbox(p, 0.3, 0.04, w - 0.4, 0.02, trx - 0.1, belt + h - 0.01, 0).rotation.z = 0.12; // roof spoiler
  // rear-window sticker (on the slope of the hatch glass) and a small flag on the roof antenna
  const a = Math.atan2(trx - rx, h * 0.96), st = pivot(body, rx + (trx - rx) * 0.6 - 0.012 * Math.cos(a), belt - 0.02 + h * 0.96 * 0.6 + 0.012 * Math.sin(a), -0.35);
  st.rotation.z = -a; add(st, G(THREE.PlaneGeometry, 0.27, 0.18), ptFlag()).rotation.y = -PI / 2;
  box(black, 0.015, 0.5, 0.015, -1.45, belt + h + 0.25, 0.3); add(body, G(THREE.PlaneGeometry, 0.27, 0.18), ptFlag(), -1.59, belt + h + 0.4, 0.3);
  // backfire flames, pointing back out of both pipes
  const flames = pivot(body, -L - 0.1, 0.24, 0); flames.visible = false; flames.userData.flames = true;
  for (const k of [-1, 1]) for (const [r, l, col] of [[0.07, 0.42, '#ff3c00'], [0.04, 0.28, '#fff07a']]) {
    const f = add(flames, once('flame' + r, () => new THREE.ConeGeometry(r, l, 10).rotateZ(PI / 2).translate(-l / 2, 0, 0)), once('flameMat' + col, () => new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: r > 0.05 ? 0.8 : 1 })), 0, 0, k * 0.16);
    f.castShadow = false;
  }
  return { g, body, len, w, exhaust: new THREE.Vector3(-L - 0.1, 0.24, 0), flames };
}

export function buildSpring(env) {
  const len = 3.73, w = 1.58, sill = 0.34, belt = 0.94;
  const rim = rimTex('springRim', (c, r) => { // grey plastic wheel cover
    c.fillStyle = '#9ea3a8'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill(); c.fillStyle = '#2a2c2f';
    for (let i = 0; i < 5; i++) { c.rotate(2 * PI / 5); c.beginPath(); c.ellipse(0, r * 0.58, 9, 20, 0, 0, 2 * PI); c.fill(); }
    c.beginPath(); c.arc(0, 0, 12, 0, 2 * PI); c.fill();
  });
  const { g, body, E, L } = carBase(env, 'spring', { len, w, sill, belt, hood: 0.08, cab: [-1.78, 0.5, -0.35, -1.62, 0.58], paint: '#6d7379', wheelR: 0.3, tw: 0.2, axles: [1.2, -1.22], rim });
  const box = (m, sx, sy, sz, x, y, z) => add(body, G(THREE.BoxGeometry, sx, sy, sz), m, x, y, z);
  const clad = M('#1d1e20', { roughness: 0.85 }), chrome = M('#cfd4d8', { roughness: 0.2, metalness: 1, ...E });
  const led = M('#eef4ff', { emissive: '#e0ecff', emissiveIntensity: 1 }), red = M('#a10f12', { emissive: '#e01010', emissiveIntensity: 0.6 });
  add(body, G(RoundedBoxGeometry, len + 0.03, 0.2, w + 0.03, 2, 0.08), clad, 0, sill + 0.09, 0); // black plastic skirt all round
  for (const x of [1.2, -1.22]) for (const k of [-1, 1]) add(body, once('clad', () => new THREE.RingGeometry(0.34, 0.43, 16, 1, 0, PI)), clad, x, 0.3, k * (w / 2 + 0.006)).rotation.y = k > 0 ? 0 : PI;
  for (const k of [-1, 1]) {
    box(led, 0.04, 0.035, 0.34, L - 0.05, 0.84, k * 0.5); // DRL strip
    box(M('#dfe6ee', { roughness: 0.1, metalness: 0.5 }), 0.04, 0.12, 0.26, L - 0.03, 0.72, k * 0.56);
    box(red, 0.05, 0.22, 0.12, -L + 0.02, 0.8, k * 0.66);
    box(clad, 1.6, 0.05, 0.05, -0.75, belt + 0.62, k * 0.56); // roof rails
    add(body, G(RoundedBoxGeometry, 0.16, 0.12, 0.13, 2, 0.04), clad, 0.35, belt + 0.1, k * (w / 2 + 0.05)); // mirrors
    box(clad, 0.13, 0.03, 0.03, -0.35, 0.86, k * (w / 2 + 0.01));
  }
  box(clad, 0.04, 0.2, 0.9, L - 0.01, 0.62, 0); box(chrome, 0.045, 0.03, 0.9, L, 0.7, 0); // grille, chrome bar
  box(M('#3a3d40'), 0.045, 0.12, 0.2, L, 0.6, 0.22); // charging flap
  box(M('#f4f4f2'), 0.02, 0.1, 0.46, -L - 0.01, 0.6, 0);
  return { g, body, len, w };
}

// ───────────── Citroën Xsara Picasso (picasso.jpg): one-box MPV, grey-blue metallic. The shell is a loft of superellipse
// cross-sections along x (roof-line profile, flat-cut wheel arches, rounded nose and tail caps). Paint, glass, lights and
// trim are textures (colour, emissive, roughness/metalness) computed per texel from 3D rules on the surface point.
export function buildPicasso(env) {
  const len = 4.28, w = 1.75, L = len / 2, W = w / 2, wheelR = 0.315, tw = 0.2, axles = [1.33, -1.43], B0 = 0.22, NX = 160, NT = 64;
  const g = new THREE.Group(), body = new THREE.Group(), E = { envMap: env }; g.add(body);
  const cl = v => Math.min(1, Math.max(0, v));
  // roof line, nose → tail: short sloping bonnet, very long raked windscreen, flat roof, near-vertical tailgate
  const prof = once('picProf', () => new THREE.SplineCurve([[2.25, 0.7], [2.14, 0.73], [1.9, 0.81], [1.55, 0.9], [1.25, 0.985], [0.95, 1.14], [0.6, 1.34],
    [0.25, 1.52], [0, 1.6], [-0.4, 1.63], [-1.2, 1.635], [-1.7, 1.61], [-1.95, 1.55], [-2.1, 1.47], [-2.25, 1.4]].map(([x, y]) => new THREE.Vector2(x, y))).getSpacedPoints(600));
  const topAt = x => { const i = prof.findIndex(p => p.x <= x); if (i < 1) return prof.at(i).y; const a = prof[i - 1], b = prof[i]; return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x); };
  // cross-section at s ∈ [0,1]: centre c, half-height h, half-width hw, arch cut B. The last 28 cm (tail) and 40 cm (nose)
  // are caps where the section shrinks (scale f) along a quarter superellipse, spaced by angle so the end faces get texels too.
  const col = s => {
    let x = -L + 0.28 + (s - 0.12) / 0.74 * (len - 0.68), f = 1;
    if (s < 0.12 || s > 0.86) {
      const [q, d, m, dir] = s < 0.12 ? [1 - s / 0.12, 0.28, 3, -1] : [(s - 0.86) / 0.14, 0.4, 2.5, 1], a = q * PI / 2, r = (Math.cos(a) ** m + Math.sin(a) ** m) ** (-1 / m);
      x = dir * (L - d + d * r * Math.sin(a)); f = r * Math.cos(a);
    }
    const T = topAt(x), hw = W * f * (1 - 0.15 * cl((x - 1.2) / 0.94) ** 2 - 0.06 * cl((-1.75 - x) / 0.39) ** 2);
    const B = Math.max(B0, ...axles.map(a => Math.abs(x - a) < 0.375 ? wheelR + Math.sqrt(0.375 ** 2 - (x - a) ** 2) : 0));
    return { x, T, c: (T + B0) / 2, h: (T - B0) / 2 * f, hw, B };
  };
  // point at angle th (−π/2 = bottom, 0 = +z side, π/2 = roof); returns [x, y, z, |cz|] with cz the section's sideways-ness
  const pt = (k, th) => {
    const sn = Math.sin(th), cs = Math.cos(th), n = sn > 0 ? 5 : 4, r = (Math.abs(cs) ** n + Math.abs(sn) ** n) ** (-1 / n), cy = r * sn, cz = r * cs;
    const y = k.c + k.h * cy;
    return [k.x, Math.max(y, k.B), cz * k.hw * (1 - 0.15 * cl((y - 0.98) / 0.64)), Math.abs(cz)];
  };
  const shell = once('picShell', () => {
    const pos = [], uv = [], idx = [], geo = new THREE.BufferGeometry();
    for (let i = 0; i < NX; i++) { const k = col(i / (NX - 1)); for (let j = 0; j <= NT; j++) { pos.push(...pt(k, -PI / 2 + 2 * PI * j / NT).slice(0, 3)); uv.push(i / (NX - 1), j / NT); } }
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + NT + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    geo.computeVertexNormals(); return geo;
  });
  // skin: [colour, emissive, roughness, metalness]; null = paint
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [PAINT, GLASS, BLACK, GREY, CHROME, HEAD, TAIL, PLATE] = [['#48505a', '#000000', 0.3, 0.5], ['#141d25', '#000000', 0.05, 0.5], ['#141517', '#000000', 0.75, 0], ['#2b2d30', '#000000', 0.55, 0.1],
    ['#d9dee2', '#000000', 0.15, 1], ['#dfe7ee', '#50565e', 0.05, 0.5], ['#a3121a', '#6a0508', 0.1, 0.2], ['#f1f1ec', '#000000', 0.5, 0]].map(([c, e, r, m]) => [rgb(c), rgb(e), r * 255, m * 255]);
  const skin = (x, y, az, cz, T) => {
    const belt = 0.985 - 0.012 * x;
    if (x > 1.85) { // nose: black lower intake, fog lights, plate, slim grille with the double chevron
      if (y < 0.3 || (x > 1.95 && y < 0.46 && az < 0.52)) return BLACK;
      if (Math.hypot(az - 0.64, y - 0.4) < 0.05) return HEAD;
      if (x > 2.03 && az < 0.25 && y > 0.49 && y < 0.58) return PLATE;
      if (az < 0.3 && y > 0.63 && y < 0.73) return az < 0.1 && [0, 1].some(k => Math.abs(y - (0.68 + 0.035 * k - 0.28 * az)) < 0.008) ? CHROME : BLACK;
    }
    if (x > 1.6 && az > 0.3 && y > 0.6 + 0.5 * Math.max(0, 1.95 - x) && y < T - 0.035) return HEAD; // big headlights swept up the wings
    if (x < -1.97) { // tailgate
      if (y < 0.36) return BLACK;
      if (y > 1.07 && y < 1.5 && az < 0.58) return GLASS;
      if (y > 0.82 && y < 1.3 && az > 0.5) return TAIL;
      if (az < 0.24 && y > 0.84 && y < 0.96) return PLATE;
      return az < 0.05 && y > 1.0 && y < 1.04 ? CHROME : null;
    }
    if (y > belt && x > 0 && x < 1.32 && cz < 0.82) return cz > 0.74 || x < 0.08 || y < belt + 0.03 ? BLACK : GLASS; // windscreen
    if (y > belt && x > -1.95 && x < 1.32) { // side glass: quarter light, two doors, rear quarter
      if (cz < 0.9) return null;
      if (cz < 0.92 || y < belt + 0.015 || (x > 0.7 && x < 0.76) || (x > -0.42 && x < -0.3) || (x > -1.33 && x < -1.25)) return BLACK;
      return GLASS;
    }
    if (cz > 0.9 && y > 0.5 && y < 0.57 && x > -1.02 && x < 0.95) return GREY; // rubbing strip
    if (cz > 0.85 && y > 0.3 && [0.73, -0.36, -1.28].some(d => Math.abs(x - d) < 0.006)) return BLACK; // door shut lines
    if (cz > 0.9 && y > 0.88 && y < 0.925 && ((x > -0.2 && x < -0.06) || (x > -1.2 && x < -1.06))) return BLACK; // handles
    return null;
  };
  const [map, emi, rm] = once('picTex', () => {
    const TW = 1024, TH = 512, d = [0, 1, 2].map(() => new Uint8Array(TW * TH * 4));
    for (let px = 0; px < TW; px++) {
      const k = col((px + 0.5) / TW);
      for (let py = 0; py < TH; py++) {
        const [x, y, z, cz] = pt(k, -PI / 2 + 2 * PI * (py + 0.5) / TH), m = skin(x, y, Math.abs(z), cz, k.T) || PAINT, o = (py * TW + px) * 4; d[0].set([...m[0], 255], o); d[1].set([...m[1], 255], o); d[2].set([0, m[2], m[3], 255], o);
      }
    }
    return d.map((a, i) => {
      const t = new THREE.DataTexture(a, TW, TH); if (i < 2) t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; return t;
    });
  });
  const p = M('#48505a', { roughness: 0.3, metalness: 0.5, ...E }), black = M('#141517', { roughness: 0.7 });
  add(body, shell, M('#ffffff', { map, emissiveMap: emi, emissive: '#ffffff', roughnessMap: rm, metalnessMap: rm, roughness: 1, metalness: 1, ...E }));
  for (const k of [-1, 1]) {
    add(body, S(), p, 0.64, 1.1, k * 0.97, [0.09, 0.09, 0.13]); // body-colour mirrors on black stalks
    add(body, G(THREE.BoxGeometry, 0.1, 0.04, 0.14), black, 0.67, 1.05, k * 0.87);
    add(body, G(THREE.BoxGeometry, 0.02, 0.012, 0.5), black, 1.2, 1.02, k * 0.22).rotation.set(0, k * 0.15, -0.45); // wipers
  }
  // wheels (unsprung), dark arch liners
  const rim = rimTex('picRim', (c, r) => { // silver hubcap
    c.fillStyle = '#b9bec3'; c.beginPath(); c.arc(0, 0, r, 0, 2 * PI); c.fill(); c.fillStyle = '#34373b';
    for (let i = 0; i < 10; i++) { c.rotate(PI / 5); c.beginPath(); c.ellipse(0, r * 0.62, 5, 16, 0, 0, 2 * PI); c.fill(); }
    c.strokeStyle = '#7d8388'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, r - 5, 0, 2 * PI); c.stroke();
    c.fillStyle = '#8d9398'; c.beginPath(); c.arc(0, 0, 14, 0, 2 * PI); c.fill();
  });
  const tire = once('tire' + wheelR + tw, () => new THREE.CylinderGeometry(wheelR, wheelR, tw, 22).rotateX(PI / 2)), disc = once('disc' + wheelR, () => new THREE.CircleGeometry(wheelR * 0.68, 20));
  const liner = once('picLiner', () => new THREE.CylinderGeometry(0.37, 0.37, w - 0.12, 16, 1, true, PI / 2, PI).rotateX(PI / 2));
  for (const x of axles) {
    add(body, liner, M('#0d0d0e', { side: THREE.DoubleSide }), x, wheelR, 0);
    for (const s of [-1, 1]) {
      const z = s * (W - tw / 2 - 0.03);
      add(g, tire, M('#18181a', { roughness: 0.9 }), x, wheelR, z);
      add(g, disc, rim, x, wheelR, z + s * (tw / 2 + 0.003)).rotation.y = s > 0 ? 0 : PI;
    }
  }
  return { g, body, len, w };
}
