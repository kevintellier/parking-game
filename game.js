import * as THREE from 'three';
import { buildTruck, buildBMW, buildSpring, buildPicasso, buildZ4 } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildErika } from './models.js';
import * as dedeHouse from './houses/dede.js';
import * as erikaHouse from './houses/erika.js';
import * as jackHouse from './houses/jack.js';
import * as cornerHouse from './houses/corner.js';
import * as marionHouse from './houses/marion.js';
import * as valerieHouse from './houses/valerie.js';
import * as marieclaudeHouse from './houses/marieclaude.js';

// ───────────────────────── helpers
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);

// ───────────────────────── street layout (street runs along X, sides are z>0 (s=1) and z<0 (s=-1))
// one-way street: a single lane at z=0, traffic always flows toward +x (enters at -END_X, exits at +END_X)
const LANE_Z = 0, SLOT_Z = 3.95, CURB_Z = 5.1, WALL_Z = 7.5, STREET_X = 52, END_X = 70, SLOT_LEN = 5.4;
// real layout (aguesseau_haut.png): +x = north, Rue du Centre just past -x; west side s=-1: Dédé, Erika, Jack; east side s=1: Marion, Valérie, Marie-Claude
const SLOT_XS = { 1: [-44.2, -38.8, -33.4, -23.7, -18.3, -8.1, -2.7, 2.7], [-1]: [-41, -35.6, -30.2, -20, -14.6, -3.5, 1.9, 7.3] };
const GATES = { 1: [-28.6, -13, 20, 38], [-1]: [-46.5, -25, -8.5, 25] };
const STRANGER_FINE = 10, NEIGHBOUR_FINE = 100;
const CAR_R = 0.95, MY_R = 0.95, P_R = 0.35, BIN_R = 0.45;

// ───────────────────────── renderer / scene / camera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd3e6');
scene.fog = new THREE.Fog('#bcd3e6', 95, 190);
const ENV = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; // reflections for cars only

let viewH = 16;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
const CAM_OFF = new THREE.Vector3(35, 60, 35);
const camTarget = new THREE.Vector3();
function resize() {
  const a = innerWidth / innerHeight;
  Object.assign(camera, { left: -viewH * a, right: viewH * a, top: viewH, bottom: -viewH });
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
addEventListener('wheel', e => { viewH = clamp(viewH * (e.deltaY > 0 ? 1.1 : 0.9), 8, 34); resize(); }, { passive: true });
resize();

scene.add(new THREE.HemisphereLight('#e4edf8', '#98896a', 1.5));
const sun = new THREE.DirectionalLight('#fff0da', 2.1);
const SUN_OFF = new THREE.Vector3(-25, 50, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 200 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ───────────────────────── materials, geometry, textures
const matCache = {};
const M = (color, o = {}) => matCache[color + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
const geoCache = {};
const boxGeo = (w, h, d) => geoCache[`${w}|${h}|${d}`] ||= new THREE.BoxGeometry(w, h, d);
const GLASS = new THREE.MeshStandardMaterial({ color: '#3a5068', roughness: 0.08, metalness: 0.6, envMap: ENV, envMapIntensity: 0.8 });
const HEAD = new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: '#fff1c0', emissiveIntensity: 0.8 });
const TAIL = new THREE.MeshStandardMaterial({ color: '#b01818', emissive: '#ff2020', emissiveIntensity: 0.5 });
const LAMP = new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#ffe7a8', emissiveIntensity: 0.7 });

function box(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), color.isMaterial ? color : M(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function mesh(parent, geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, color.isMaterial ? color : M(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

function canvasTex(size, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// world generation uses a seeded PRNG so the street is identical on every load
let seed = 1789;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const sr = (a, b) => a + rnd() * (b - a), sp = a => a[(rnd() * a.length) | 0];
const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function speckle(g, s, n, alpha) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * alpha})`;
    const r = 1 + rnd() * 2;
    g.fillRect(rnd() * s, rnd() * s, r, r);
  }
}
const asphalt = (rx, ry) => canvasTex(256, (g, s) => {
  g.fillStyle = '#5a5b5e'; g.fillRect(0, 0, s, s);
  speckle(g, s, 9000, 0.13);
}, rx, ry);
const walkTex = canvasTex(256, (g, s) => { g.fillStyle = '#7b7a75'; g.fillRect(0, 0, s, s); speckle(g, s, 9000, 0.15); });
const cobbleTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#58554f'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 16) for (let x = (y & 16) / 2 - 8; x < s; x += 16) { g.fillStyle = `hsl(35,${sr(4, 9)}%,${sr(50, 68)}%)`; g.fillRect(x + 1.5, y + 1.5, 13, 13); }
  speckle(g, s, 3000, 0.12);
});
const tileTex = canvasTex(256, (g, s) => {
  g.setTransform(0, 1, 1, 0, 0, 0); // courses run along the ridge (texture v)
  const c = s / 6;
  g.fillStyle = '#4a2014'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += c) for (let x = 0; x < s; x += 32) {
    const l = sr(37, 43);
    g.fillStyle = `hsl(${sr(9, 14)},${sr(44, 52)}%,${l}%)`; g.fillRect(x + 1, y, 30, c - 2);
    g.fillStyle = `hsla(16,55%,${l + 9}%,.35)`; g.fillRect(x + 12, y, 6, c - 9);
    g.fillStyle = 'rgba(50,12,0,.35)'; g.fillRect(x + 1, y + c - 9, 30, 7);
  }
});
const grassTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#7b9d55'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `hsla(${sr(70, 110)},40%,${sr(25, 50)}%,.25)`; g.fillRect(rnd() * s, rnd() * s, 2, 3); }
}, 110, 110);
const tmat = (map, color = '#fff', o = {}) => new THREE.MeshStandardMaterial({ map, color, roughness: 0.9, flatShading: true, ...o });
const ROOFS = ['#ffffff', '#f4ddd2', '#e6cbbd', '#dcc6bb'].map(c => tmat(tileTex, c, { roughness: 0.75 }));
const WALK = tmat(walkTex), COBBLE = tmat(cobbleTex);

// soft drifting cloud shadows: a multiply overlay drawn over the opaque scene, before the other transparents
const cloudTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 16; i++) {
    const x = rnd() * s, y = rnd() * s, r = sr(24, 60);
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, 'rgba(110,122,145,.3)'); gr.addColorStop(1, 'rgba(110,122,145,0)');
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    }
  }
}, 7, 7);
{
  const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = -1; scene.add(m);
}
function updateWorld(dt) { cloudTex.offset.x -= dt * 0.01; cloudTex.offset.y += dt * 0.004; }

// ───────────────────────── static world (built into S, then merged per material for speed)
const S = new THREE.Group();
const INST = new Map(); // repeated small bits (railing bars, slats, flowers) → one InstancedMesh per geometry+material
function inst(geo, mat, x, y, z, sy = 1, sxz = 1) {
  const k = geo.uuid + mat.uuid;
  if (!INST.has(k)) INST.set(k, { geo, mat, list: [] });
  INST.get(k).list.push(new THREE.Matrix4().makeScale(sxz, sy, sxz).setPosition(x, y, z));
}
function tbox(P, w, h, d, mat, x = 0, y = 0, z = 0) { // box with world-scaled UVs (one texture = 2 m)
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2, uv.getY(i) * d / 2);
  return mesh(P, g, mat, x, y, z);
}
const BAR = boxGeo(0.045, 0.72, 0.045), SLAT = boxGeo(0.11, 1, 0.03), TRUNK = new THREE.CylinderGeometry(0.12, 0.2, 1, 6);
const FLOWER = new THREE.IcosahedronGeometry(0.07, 0), TUFT = new THREE.IcosahedronGeometry(1, 0), CONE = new THREE.ConeGeometry(1, 1, 7), BALL = new THREE.SphereGeometry(0.15, 10, 8);
const WAVE = new THREE.ExtrudeGeometry(new THREE.Shape([...Array(9)].map((_, i) => V2(0.05 * Math.sin(i * Math.PI / 4), -0.36 + i * 0.09))
  .concat([...Array(9)].map((_, i) => V2(0.05 * Math.sin((8 - i) * Math.PI / 4) + 0.035, 0.36 - i * 0.09)))), { depth: 0.03, bevelEnabled: false }).translate(-0.02, 0, -0.015);
const BLOB = [0, 1, 2, 3].map(i => { // lumpy foliage
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let j = 0; j < p.count; j++) { const x = p.getX(j), y = p.getY(j), z = p.getZ(j), k = 1 + 0.16 * Math.sin(x * 4.1 + y * 3.3 + i * 2) * Math.cos(z * 3.7 - y * 2.1 + i); p.setXYZ(j, x * k, y * k, z * k); }
  return g;
});
const WALLS = ['#efe4cc', '#f3f0e8', '#e9d7b9', '#f1e6d0', '#e8e5de', '#f0dcc0', '#ecd9c9', '#f5efe0'];
const SHUTTERS = ['#5b3626', '#6b4230', '#4a2e22', '#7d8a94', '#3f5a4a', '#f4f1ea', null, null]; // null: roller shutters
const GREENS = ['#5f8f3e', '#4f7a35', '#6fa04a', '#3f6b30', '#79a652', '#557f3a'];
const REDS = ['#6e2233', '#7b2a3c', '#8a3345', '#5e1f2e'];
const HEDGES = { privet: ['#5d8c3c', '#6a9844', '#557f36'], thuja: ['#3d5e3a', '#46683f', '#36553a'], photinia: ['#4f7a35', '#5f8f3e', '#557f3a', '#84503a'], laurel: ['#355f27', '#3f6e2c', '#4b7d33', '#2f5523'] };
const STYLES = { // front boundaries: low rendered wall + capped pillars + railing / slats / hedge
  green: { wall: '#f2efe8', cap: '#cdc9c0', pil: '#f2efe8', bar: '#2d4b3b', gate: '#2d5a43' },
  anth: { wall: '#f0ede6', cap: '#c3c0b9', pil: '#e2dfd8', bar: '#2d3034', gate: '#34383c' },
  black: { wall: '#ebe7de', cap: '#bdb9b1', pil: '#ebe7de', bar: '#1f2123', gate: '#1f2123' },
  hedge: { wall: '#ece6d8', cap: '#d6d0c4', pil: '#ece6d8', hedge: 'privet', gate: '#2d4b3b' },
  thuja: { wall: '#f1eee6', cap: '#c9c5bc', pil: '#f1eee6', hedge: 'thuja', gate: '#26292d' },
  photinia: { wall: '#e9e3d4', cap: '#cfc9bb', pil: '#e9e3d4', bar: '#5d666d', hedge: 'photinia', gate: '#5d666d' },
  pink: { wall: '#e39e88', cap: '#efe4da', pil: '#e39e88', bar: '#b8dccd', wave: true, gate: '#a9cfc0', ball: '#8fa6bf' },
  laurel: { wall: '#efece5', cap: '#b4633f', pil: '#a65a3b', ph: 2.3, slat: '#8b2c36', hedge: 'laurel', gate: '#8b2c36' },
};
const FRONTS = []; // far-side facade points for the overhead service wires

function win(P, x, y, z, rotY, shut, k = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(k); P.add(g);
  box(g, 1.05, 1.3, 0.06, '#f6f5f0');
  box(g, 0.85, 1.1, 0.06, GLASS, 0, 0, 0.02);
  box(g, 0.05, 1.1, 0.08, '#f6f5f0', 0, 0, 0.04);
  box(g, 1.25, 0.07, 0.22, '#dcd8ce', 0, -0.68, 0.08);
  if (shut) for (const q of [-1, 1]) box(g, 0.52, 1.32, 0.05, shut, q * 0.8, 0, 0.02);
  else box(g, 1.1, 0.22, 0.14, '#e4e2dc', 0, 0.76, 0.05);
}
function oeil(P, x, y, z, rotY = 0) { // oval "œil-de-bœuf" facing +x (rotY -π/2: facing +z)
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; P.add(g);
  for (const [r, t, c] of [[0.5, 0.08, '#a9cfc0'], [0.38, 0.1, GLASS]]) { const m = mesh(g, new THREE.CylinderGeometry(r, r, t, 20), c); m.rotation.z = Math.PI / 2; m.scale.z = 1.35; }
}
function door(P, x, z, rotY, color, porch, rm) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; P.add(g);
  box(g, 1.25, 2.35, 0.06, '#f4f2ec', 0, 1.37, 0);
  box(g, 1.0, 2.15, 0.08, color, 0, 1.3, 0.02);
  box(g, 0.4, 0.5, 0.09, GLASS, 0, 1.85, 0.03);
  box(g, 1.6, 0.2, 0.55, '#cfcac0', 0, 0.1, 0.28);
  if (!porch) return;
  tbox(g, 2.0, 0.08, 1.1, rm, 0, 2.95, 0.55).rotation.x = 0.35; // tiled porch awning on brackets
  for (const q of [-1, 1]) box(g, 0.06, 0.06, 1.0, '#3a2a22', q * 0.8, 2.6, 0.45).rotation.x = -0.6;
}
function house(P, cx, s, zf, o = {}) {
  const w = o.w ?? sr(7.5, 10), d = o.d ?? sr(7.5, 9), h = o.h ?? sp([3.5, 3.8, 5.6, 5.8, 6.1]), up = h > 5;
  const wc = o.wall ?? sp(WALLS), sc = o.shut !== undefined ? o.shut : sp(SHUTTERS), rm = o.roof ? tmat(tileTex, o.roof, { roughness: 0.75 }) : sp(ROOFS);
  const g = new THREE.Group(); g.position.set(cx, 0, s * (zf + d / 2)); P.add(g);
  box(g, w, h, d, wc, 0, h / 2, 0);
  box(g, w + 0.1, 0.5, d + 0.1, '#bcb4a6', 0, 0.25, 0);
  box(g, w + 0.08, 0.14, d + 0.08, '#f7f5ef', 0, h - 0.07, 0);
  // gable roof: wall-coloured prism + two tiled slabs with overhang, velux on the slab facing the camera
  const along = o.along ?? rnd() < 0.6, span = along ? d : w, len = along ? w : d, half = span / 2, rh = half * sr(0.8, 0.95);
  const ov = 0.45, a = Math.atan2(rh, half), sl = Math.hypot(half, rh) + ov;
  const r = new THREE.Group(); r.position.y = h; r.rotation.y = along ? Math.PI / 2 : 0; g.add(r);
  mesh(r, new THREE.ExtrudeGeometry(new THREE.Shape([V2(-half, 0), V2(half, 0), V2(0, rh)]), { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2), wc);
  for (const k of [-1, 1]) {
    const m = tbox(r, sl, 0.2, len + 2 * ov, rm, k * (sl * Math.cos(a) / 2 + Math.sin(a) * 0.1), rh - sl * Math.sin(a) / 2 + Math.cos(a) * 0.1, 0);
    m.rotation.z = -k * a;
    if (k === (along ? -1 : 1) && (o.velux ?? rnd() < 0.5)) for (const v of len > 9 ? [-2, 2] : [sr(-1.5, 1.5)]) {
      box(m, 1.0, 0.05, 0.8, '#e6e4de', 0, 0.12, v); box(m, 0.84, 0.06, 0.64, GLASS, 0, 0.13, v);
    }
  }
  box(r, 0.3, 0.2, len + 2 * ov, '#8b3b27', 0, rh + 0.1, 0);
  const chx = half * sr(0.3, 0.55) * sp([-1, 1]), chz = sr(-len / 3, len / 3), ct = rh + 0.9;
  box(r, 0.65, ct, 0.65, sp([wc, wc, '#a4573b', '#cfcac2']), chx, ct / 2, chz);
  box(r, 0.8, 0.1, 0.8, '#8d8a85', chx, ct + 0.05, chz);
  if (rnd() < 0.6) { // TV antenna
    box(r, 0.04, 1.6, 0.04, '#55585c', chx + 0.38, ct + 0.5, chz);
    box(r, 0.03, 0.03, 1.3, '#55585c', chx + 0.38, ct + 1.25, chz);
    for (let i = -2; i <= 2; i++) box(r, 0.55 - Math.abs(i) * 0.08, 0.02, 0.02, '#55585c', chx + 0.38, ct + 1.25, chz + i * 0.28);
  }
  // facades: street + back (windows, door), +x side and gables (the camera sees +x/+z faces)
  const fz = d / 2 + 0.03, n = Math.max(2, Math.round(w / 2.7)), xs = [...Array(n)].map((_, i) => -w / 2 + (i + 0.5) * w / n);
  const di = o.doorX !== undefined ? xs.reduce((b, x, i) => Math.abs(x + cx - o.doorX) < Math.abs(xs[b] + cx - o.doorX) ? i : b, 0) : (rnd() * n) | 0;
  const dc = sc && sc !== '#f4f1ea' ? sc : sp(['#6b4230', '#f4f2ec', '#5d666d']), porch = o.porch ?? rnd() < 0.5;
  for (const q of [-s, s]) {
    const z = q * fz, rot = q > 0 ? 0 : Math.PI;
    xs.forEach((x, i) => {
      if (q === -s && Math.abs(x - o.gdoor) < 1.6) { /* garage door below */ } else if (q === -s && i === di) door(g, x, z, rot, dc, porch, rm); else win(g, x, 1.5, z, rot, sc);
      if (up) win(g, x, h - 1.5, z, rot, sc);
    });
    if (!along && rh > 1.7) o.oeil ? oeil(g, 0, h + rh * 0.3, z + q * 0.01, -q * Math.PI / 2) : win(g, 0, h + rh * 0.3, z, rot, o.gshut ?? sc, 0.75);
  }
  if (o.gdoor !== undefined) { // ground-floor garage door: dark grid
    const z = -s * (fz + 0.01);
    box(g, 2.5, 2.2, 0.06, '#2d3034', o.gdoor, 1.1, z);
    for (let i = 1; i < 5; i++) { box(g, 2.5, 0.04, 0.09, '#5d6166', o.gdoor, i * 0.44, z); box(g, 0.04, 2.2, 0.09, '#5d6166', o.gdoor - 1.25 + i * 0.5, 1.1, z); }
  }
  if (o.dormer) { // wide shed dormer on the street slope, two roller-shuttered windows
    const dw = w * 0.6, dh = 1.9, dd = d / 2 - 0.4, rot = s < 0 ? 0 : Math.PI;
    box(g, dw, dh, dd, wc, 0, h + dh / 2, -s * (d / 2 - 0.2 - dd / 2));
    box(g, dw + 0.3, 0.12, dd + 0.3, '#e9e7e2', 0, h + dh + 0.06, -s * (d / 2 - 0.2 - dd / 2));
    for (const x of [-dw / 4, dw / 4]) win(g, x, h + 0.95, -s * (d / 2 - 0.17), rot, null, 0.9);
  }
  for (let i = 0, m = Math.max(1, Math.round(d / 3.2)); i < m; i++) for (const y of up ? [1.5, h - 1.5] : [1.5]) win(g, w / 2 + 0.03, y, -d / 2 + (i + 0.5) * d / m, Math.PI / 2, sc);
  if (along && rh > 1.7) o.oeil ? oeil(g, w / 2 + 0.04, h + rh * 0.35, 0) : win(g, w / 2 + 0.03, h + rh * 0.3, 0, Math.PI / 2, sc, 0.75);
  if (o.balcony !== undefined && up) { // first-floor balcony (centred at x = o.balcony) with a dark X-pattern railing
    const bw = Math.min(3.6, w - 1.2), bx = o.balcony, z1 = -s * (fz + 1.1), zc = -s * (fz + 0.55), rc = '#4a4e52';
    box(g, bw, 0.14, 1.1, '#e4e2dc', bx, 3.0, zc);
    box(g, bw, 0.05, 0.05, rc, bx, 4.02, z1);
    for (const x of [bx - bw / 2, bx + bw / 2]) { box(g, 0.05, 1.0, 0.05, rc, x, 3.55, z1); box(g, 0.05, 0.05, 1.1, rc, x, 4.02, zc); }
    for (let x = bx - bw / 2 + 0.45; x < bx + bw / 2; x += 0.9) for (const t of [-1, 1]) box(g, 0.03, 1.2, 0.03, rc, x, 3.52, z1).rotation.z = t * 0.72;
  }
  if (o.garage) { // flat-roofed garage annex on the +x side
    const gx = w / 2 + 1.7, gz = -s * (d / 2 - 2.6);
    box(g, 3.4, 2.7, 5.2, wc, gx, 1.35, gz);
    box(g, 3.6, 0.2, 5.4, '#8d8a85', gx, 2.8, gz);
    box(g, 2.6, 2.1, 0.08, sp(['#e9e6de', '#8d9296', '#6b4230']), gx, 1.05, gz - s * 2.62);
  }
  return h;
}
function blob(P, x, y, z, r, col, sy = 1) { const m = mesh(P, sp(BLOB), col, x, y, z); m.scale.set(r, r * sy, r); m.rotation.y = rnd() * 6; return m; }
function tree(P, x, z, h, kind = 'green') {
  if (kind === 'cone') return mesh(P, CONE, sp(HEDGES.thuja), x, h / 2, z).scale.set(h * 0.2, h, h * 0.2);
  mesh(P, TRUNK, '#6b4a33', x, h * 0.3, z).scale.y = h * 0.6;
  const cols = kind === 'red' ? REDS : GREENS;
  for (let i = 0; i < 4; i++) blob(P, x + sr(-0.7, 0.7), h * sr(0.62, 0.82), z + sr(-0.7, 0.7), h * sr(0.17, 0.24), sp(cols));
}
function shrub(P, x, z, r, flowers = rnd() < 0.5) {
  blob(P, x, r * 0.7, z, r, sp(GREENS), 0.85);
  const c = M(sp(['#f28c28', '#f2c230', '#f4f0f4', '#d6456b', '#b784d6']));
  if (flowers) for (let i = 0; i < 6; i++) inst(FLOWER, c, x + sr(-r, r) * 0.7, r * sr(0.9, 1.35), z + sr(-r, r) * 0.7);
}
function banana(P, x, z) {
  mesh(P, TRUNK, '#7d7c4c', x, 0.9, z).scale.set(1.4, 1.8, 1.4);
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Group(); p.position.set(x, sr(1.5, 2.1), z); p.rotation.set(0, i * 0.7 + sr(0, 0.4), sr(0.35, 1.2)); P.add(p);
    box(p, 0.03, 1.9, 0.5, sp(['#6f9b3a', '#86ad48', '#5c8a30']), 0, 0.95, 0);
  }
}
function hedge(P, a, b, z, h, cols, dz) {
  const n = Math.ceil((b - a) / (dz * 0.65)), step = (b - a) / n;
  box(P, b - a - dz * 0.4, h * 0.75, dz * 0.9, cols[0], (a + b) / 2, h * 0.375, z);
  for (let y = h - dz * 0.45; y > dz * 0.4; y -= dz * 0.8) for (let i = 0; i < n; i++) blob(P, a + (i + 0.5) * step + sr(-0.1, 0.1), y, z + sr(-0.12, 0.12) * dz, dz * sr(0.55, 0.68), sp(cols));
}
function zhedge(x, z0, z1, h, cols, dz) { // same hedge running along z
  const g = new THREE.Group(), l = Math.abs(z1 - z0) / 2; g.position.set(x, 0, (z0 + z1) / 2); g.rotation.y = Math.PI / 2; S.add(g);
  hedge(g, -l, l, 0, h, cols, dz);
}
function poppies(a, b, z, gate) { // California poppies at the foot of the wall
  for (let x = a; x < b; x += sr(0.2, 0.45)) {
    if (gate !== undefined && Math.abs(x - gate) < 2) continue;
    inst(TUFT, M('#86a55c'), x, 0.22, z + sr(-0.08, 0.08), 0.16, 0.2);
    if (rnd() < 0.7) inst(FLOWER, M('#f5891f'), x + sr(-0.1, 0.1), sr(0.34, 0.46), z + sr(-0.1, 0.1));
  }
}
function pillar(x, z, st) {
  const ph = st.ph ?? 1.8;
  box(S, 0.44, ph, 0.44, st.pil, x, ph / 2, z);
  box(S, 0.54, 0.09, 0.54, st.cap, x, ph + 0.04, z);
  if (st.ball) mesh(S, BALL, st.ball, x, ph + 0.22, z);
}
function fence(a, b, s, st, endPillar) {
  const z = s * WALL_Z, m = (a + b) / 2, len = b - a, n = Math.max(1, Math.round(len / 2.6)), pw = len / n;
  box(S, len, 0.9, 0.3, st.wall, m, 0.45, z);
  box(S, len, 0.07, 0.4, st.cap, m, 0.93, z);
  for (let i = 0; i < n + (endPillar ? 1 : 0); i++) pillar(a + i * pw, z, st);
  if (st.bar) {
    const mat = M(st.bar, { metalness: 0.4, roughness: 0.5 });
    for (let x = a + 0.3; x < b - 0.2; x += 0.14) { const t = (x - a) % pw; if (t > 0.3 && t < pw - 0.3) inst(st.wave ? WAVE : BAR, mat, x, 1.34, z); }
    for (const y of [1.0, 1.7]) box(S, len, 0.05, 0.05, mat, m, y, z);
  }
  if (st.slat) for (let i = 0; i < n; i++) for (let x = a + i * pw + 0.3; x < a + (i + 1) * pw - 0.28; x += 0.13) {
    const hh = 0.95 + 0.22 * Math.sin(Math.PI * (x - a - i * pw) / pw);
    inst(SLAT, M(st.slat), x, 0.96 + hh / 2, z, hh);
  }
  if (st.hedge === 'laurel') hedge(S, a, b, z + s * 1.6, 4, HEDGES.laurel, 1.8);
  else if (st.hedge) hedge(S, a, b, z + s * 0.75, 1.7, HEDGES[st.hedge], 0.9);
}
function plate(x, y, z, txt) { // blue enamel house-number plate
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTex(64, g => {
    g.fillStyle = '#1d4c9a'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(5, 8, 54, 48);
    g.fillStyle = '#fff'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 34);
  }) }));
  m.position.set(x, y, z); m.rotation.y = z > 0 ? Math.PI : 0; S.add(m);
}
function wicket(x, s, st) { // pedestrian gate: a railed leaf in the gate colour over a low threshold
  const z = s * WALL_Z, mat = M(st.gate, { metalness: 0.4, roughness: 0.5 });
  box(S, 1.2, 0.08, 0.3, st.cap, x, 0.04, z);
  box(S, 1.1, 0.7, 0.05, mat, x, 0.5, z);
  for (const y of [0.9, 1.55]) box(S, 1.1, 0.06, 0.07, mat, x, y, z);
  for (let t = x - 0.48; t < x + 0.5; t += 0.12) inst(BAR, mat, t, 1.22, z, 0.9);
}
function gate(g, s, lot) {
  const st = lot.st, z = s * WALL_Z, gz = z + s * 0.32, gx = g + 2.5, mat = M(st.gate, { metalness: 0.4, roughness: 0.5 });
  box(S, 3.6, 0.85, 0.05, mat, gx, 0.55, gz); // sliding leaf, pulled mostly open behind the wall
  for (const y of [0.98, 1.72]) box(S, 3.6, 0.06, 0.07, mat, gx, y, gz);
  for (let x = gx - 1.7; x < gx + 1.75; x += 0.14) inst(st.wave ? WAVE : BAR, mat, x, 1.35, gz);
  box(S, 5.6, 0.03, 0.08, '#6d6f71', g + 1, 0.015, gz);
  tbox(S, 3.6, 0.02, WALL_Z - CURB_Z - 0.3, COBBLE, g, 0.16, s * (CURB_Z + WALL_Z) / 2); // pavés on the sidewalk
  const dl = (s > 0 ? 13.2 : 11.5) - WALL_Z - 0.3;
  tbox(S, 3.2, 0.03, dl, COBBLE, g, 0.015, s * (WALL_Z + 0.15 + dl / 2));
  const fz = s * (WALL_Z - 0.27);
  box(S, 0.34, 0.42, 0.1, lot.mail ?? sp(['#3a3d40', '#2d4b3b', '#6b4a33', '#f1efe9']), g + (lot.mailDx ?? -1.8), 1.2, fz); // letterbox (mailDx: offset from the gate)
  box(S, 0.5, 0.64, 0.08, '#f4f3ef', g - 2.6, 0.44, s * (WALL_Z - 0.18)); // electric meter box
  box(S, 0.36, 0.05, 0.09, '#b9b6af', g - 2.6, 0.62, s * (WALL_Z - 0.18));
  if (lot.num) plate(g + 1.8, 1.4, fz, lot.num);
}
// lot boundaries per side; heroes pin a house/boundary to the lot containing x
const CUTS = { 1: [-52, -43, -31, -19, -6, 7, 19, 30, 41, 52], [-1]: [-52, -37, -23, -6, 7, 19, 31, 42, 52] };
const LOT_STYLES = ['green', 'anth', 'hedge', 'black', 'thuja', 'photinia', 'green'];
// real houses: one module per lot in houses/ (lot data + builder)
const HEROES = [
  { s: -1, x: -44, mod: dedeHouse }, // Dédé (89)
  { s: -1, x: -30, mod: erikaHouse }, // Erika (the player)
  { s: -1, x: -15, mod: jackHouse }, // Jack, behind his tall laurel hedge
  { s: 1, x: -48, mod: cornerHouse }, // corner house on Rue du Centre
  { s: 1, x: -37, mod: marionHouse }, // Marion (88)
  { s: 1, x: -25, mod: valerieHouse }, // Valérie, the red-haired neighbour, and her husband « le père »
  { s: 1, x: -12, mod: marieclaudeHouse }, // Marie-Claude
].map(h => ({ ...h, ...h.mod.hero, build: h.mod.default }));
// front garden: only low stuff on the camera side (s>0) so the street stays visible
function garden(l) {
  const s = l.s, free = x => l.gate === undefined || Math.abs(x - l.gate) > 2.6;
  for (let i = 0; i < 3; i++) {
    const x = sr(l.x0 + 1, l.x1 - 1);
    if (!free(x)) continue;
    if (s < 0 && !l.house && rnd() < 0.55) tree(S, x, s * sr(9, 10.3), sr(4, 6.5), sp(['green', 'cone', Math.abs(x) > 20 ? 'red' : 'green']));
    else shrub(S, x, s * sr(8.4, 10.3), sr(0.5, 0.85));
  }
  if (l.banana) banana(S, l.x1 - 2.5, s * 8.8);
  if (l.maple) tree(S, l.cx - 1.5, s * 9.6, 3.6, 'red'); // Japanese maple
  if (l.poppies || (s < 0 && rnd() < 0.3)) poppies(l.x0 + 0.4, l.x1 - 0.4, s * (WALL_Z - 0.33), l.gate);
}
// everything a houses/*.js builder may use. l (the lot): { x0, x1, cx, s, zf, gate, st, ...hero } (hero may also set wicket: x of a
// pedestrian gate in the front wall, mailDx: letterbox offset from the gate); street facade line z = s*zf,
// front wall z = s*WALL_Z; the game camera looks from +x/+z. Keep to x0..x1 and |z| > WALL_Z + 0.3; S is merged per material.
const KIT = { THREE, S, box, tbox, mesh, M, tmat, canvasTex, inst, GLASS, LAMP, tileTex, ROOFS, WALLS, SHUTTERS, GREENS, REDS, HEDGES, STYLES, BLOB, FLOWER, TUFT, CONE, TRUNK, BALL, BAR, SLAT, WAVE, COBBLE, WALK,
  win, door, oeil, house, garden, blob, tree, shrub, hedge, zhedge, banana, poppies, pillar, plate, rnd, sr, sp, V2, V3, WALL_Z, CURB_Z, SLOT_Z, GATES };
function row(s, cuts, gates = [], main = true) {
  const zf = s > 0 ? 13.2 : 11.5, lots = cuts.slice(0, -1).map((x0, i) => {
    const x1 = cuts[i + 1], hero = (main && HEROES.find(h => h.s === s && h.x > x0 && h.x < x1)) || {};
    return { x0, x1, s, zf, cx: (x0 + x1) / 2, ...hero, st: typeof hero.style === 'object' ? hero.style : STYLES[hero.style ?? sp(LOT_STYLES)], gate: gates.find(g => g > x0 && g < x1) };
  });
  const wk = lots.flatMap(l => l.wicket ?? []); // pedestrian gates in the front wall
  const xs = [...new Set([...cuts, ...gates.flatMap(g => [g - 1.8, g + 1.8]), ...wk.flatMap(w => [w - 0.6, w + 0.6])])].sort((p, q) => p - q);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2, lot = lots.find(l => m > l.x0 && m < l.x1), g = gates.find(g => Math.abs(g - m) < 0.1);
    if (g !== undefined) gate(g, s, lot);
    else if (wk.some(w => Math.abs(w - m) < 0.1)) wicket(m, s, lot.st);
    else fence(a, b, s, lot.st, i === xs.length - 2 || gates.some(g => Math.abs(g - 1.8 - b) < 0.01) || wk.some(w => Math.abs(w - 0.6 - b) < 0.01));
  }
  for (const l of lots) {
    const lw = l.x1 - l.x0, cx = l.cx;
    if (l.build) { // real house: its module draws the lot; the seed is restored so the rest of the street doesn't depend on it
      const s0 = seed, h = l.build(KIT, l);
      seed = s0;
      if (s < 0) FRONTS.push(V3(cx, h - 0.5, s * zf + 0.05));
    } else {
      if (lw > 9) {
        const o = { doorX: l.gate };
        o.w = Math.min(sr(7.5, 10), lw - 3); o.garage = lw - o.w > 7.2 && rnd() < 0.6;
        const h = house(S, cx + sr(-0.5, 0.5), s, zf, o);
        if (main && s < 0) FRONTS.push(V3(cx + sr(-2, 2), h - 0.5, s * zf + 0.05));
      }
      garden(l);
    }
    if (l.x1 < cuts.at(-1)) zhedge(l.x1, s * (WALL_Z + 0.4), s * (zf - 0.3), 1.2, sp(Object.values(HEDGES).slice(0, 3)), 0.7); // between front gardens
    if (!l.build) tree(S, sr(l.x0 + 1, l.x1 - 1), s * sr(22, 26), sr(4.5, 7.5), sp(['green', 'green', 'red', 'cone'])); // real houses plant their own
  }
}
function roadSign(x, z, rotY, draw) {
  box(S, 0.08, 2.9, 0.08, '#9aa0a4', x, 1.45, z);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshStandardMaterial({ map: canvasTex(128, draw), alphaTest: 0.5, roughness: 0.5 }));
  m.position.set(x + Math.sin(rotY) * 0.05, 2.5, z + Math.cos(rotY) * 0.05); m.rotation.y = rotY; S.add(m);
}
const binBody = new THREE.CylinderGeometry(0.46, 0.38, 1.0, 4);
function buildBin(P, body, lid) {
  const g = new THREE.Group(); P.add(g);
  mesh(g, binBody, body, 0, 0.62, 0).rotation.y = Math.PI / 4;
  box(g, 0.74, 0.09, 0.74, lid, 0, 1.16, 0);
  box(g, 0.1, 0.1, 0.6, '#222', -0.38, 1.05, 0);
  for (const z of [-0.24, 0.24]) mesh(g, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), '#1c1c1c', -0.3, 0.12, z).rotation.x = Math.PI / 2;
  return g;
}

function buildWorld() {
  const ground = (w, d, map, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m);
  };
  ground(600, 600, grassTex, 0, -0.02, 0);
  ground(200, 2 * CURB_Z, asphalt(48, 3), 0, 0, 0);
  for (const x of [-58, 58]) ground(10, 400, asphalt(3, 100), x, 0.004, 0);

  for (const s of [1, -1]) {
    // asphalt sidewalks, granite kerbs, paved gutters
    for (const [a, b] of [[-STREET_X, STREET_X], [63, 100], [-100, -63]]) {
      tbox(S, b - a, 0.15, WALL_Z - CURB_Z, WALK, (a + b) / 2, 0.075, s * (CURB_Z + WALL_Z) / 2);
      box(S, b - a, 0.2, 0.25, '#bdbab2', (a + b) / 2, 0.1, s * CURB_Z);
      box(S, b - a, 0.012, 0.35, '#7b7872', (a + b) / 2, 0.004, s * (CURB_Z - 0.3));
    }
    // parking markings: dashed lane edge, short ticks between bays, slanted lines at both ends of each group
    const xs = SLOT_XS[s], groups = [[xs[0]]], edge = s * (SLOT_Z - 1.15), W = '#efefe9';
    for (let i = 1; i < xs.length; i++) (xs[i] - xs[i - 1] > SLOT_LEN + 0.1 ? groups[groups.push([]) - 1] : groups.at(-1)).push(xs[i]);
    for (const gp of groups) {
      const a = gp[0] - SLOT_LEN / 2, b = gp.at(-1) + SLOT_LEN / 2;
      for (let x = a + 0.3; x < b; x += 1.2) box(S, 0.6, 0.01, 0.12, W, x, 0.006, edge);
      for (const [x, k] of [[a, -1], [b, 1]]) box(S, 2.54, 0.01, 0.12, W, x + k * 0.75, 0.006, edge + s * 1.02).rotation.y = -k * s * 0.94;
      for (let i = 1; i < gp.length; i++) box(S, 0.1, 0.01, 0.5, W, gp[i] - SLOT_LEN / 2, 0.006, edge + s * 0.25);
    }
    // lots (walls, gates, houses, gardens), a few beyond the cross streets, then a back row
    row(s, CUTS[s], GATES[s]);
    row(s, [63, 76, 88], [], false); row(s, [-88, -76, -63], [], false);
    for (const [x, k] of [[-52, 1], [52, -1], [-63, -1], [63, 1]]) {
      box(S, 0.3, 0.9, 20, '#ece6d8', x, 0.45, s * (WALL_Z + 10));
      zhedge(x + k * 0.6, s * (WALL_Z + 0.3), s * (WALL_Z + 20), 1.7, HEDGES.privet, 0.9);
    }
    for (let x = -84; x < 86; x += sr(12, 16)) if (Math.abs(Math.abs(x) - 58) > 9) house(S, x, s, 30, { porch: false, velux: false });
    // road signs: "sens interdit" facing drivers at the +x end, blue "sens unique" at the -x entrance
    roadSign(50, s * 5.75, Math.PI / 2, g => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
      g.fillStyle = '#c8102e'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.fillRect(24, 54, 80, 20);
    });
    roadSign(-50.5, s * 5.75, 0, g => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1f5fbf'; g.fillRect(6, 6, 116, 116);
      g.fillStyle = '#fff'; g.fillRect(24, 56, 54, 16); g.beginPath(); g.moveTo(72, 36); g.lineTo(106, 64); g.lineTo(72, 92); g.fill();
    });
  }
  // zebra crossings near both ends, one-way arrows painted in the lane
  for (const x of [-49, 49]) for (let k = -4; k <= 4; k++) box(S, 3, 0.01, 0.55, '#efefe9', x, 0.006, k * 1.05);
  const arrow = new THREE.ShapeGeometry(new THREE.Shape([V2(-1.6, -0.12), V2(0.5, -0.12), V2(0.5, -0.42), V2(1.6, 0), V2(0.5, 0.42), V2(0.5, 0.12), V2(-1.6, 0.12)])).rotateX(-Math.PI / 2);
  for (const x of [-40, 0, 40]) mesh(S, arrow, '#efefe9', x, 0.008, 0);

  // wooden utility poles with arm-mounted lamps, droopy overhead wires and service drops (far side, like the photos)
  const poleXs = [-38, -22.5, -2, 18, 38], pz = -6.85, WIRE = new THREE.LineBasicMaterial({ color: '#2a2a2a' });
  const wire = (p, q, sag) => scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...Array(13)].map((_, k) => V3().lerpVectors(p, q, k / 12).setY(p.y + (q.y - p.y) * k / 12 - Math.sin(Math.PI * k / 12) * sag))), WIRE));
  for (const x of poleXs) {
    mesh(S, new THREE.CylinderGeometry(0.11, 0.16, 8.8, 7), '#6f5238', x, 4.4, pz);
    box(S, 0.12, 0.12, 1.7, '#5e4530', x, 8.2, pz);
    for (const oz of [-0.65, 0, 0.65]) box(S, 0.07, 0.14, 0.07, '#e8e6e0', x, 8.33, pz + oz);
    box(S, 0.07, 0.07, 2.3, '#44474a', x, 6.6, pz + 1.1).rotation.x = -0.12;
    box(S, 0.62, 0.14, 0.42, '#44474a', x, 6.78, pz + 2.25);
    box(S, 0.5, 0.05, 0.32, LAMP, x, 6.69, pz + 2.25);
    const f = FRONTS.reduce((b, p) => Math.abs(p.x - x) < Math.abs(b.x - x) ? p : b);
    if (Math.abs(f.x - x) < 9) wire(V3(x, 7.9, pz), f, 0.35);
  }
  const wx = [-80, ...poleXs, 80];
  for (let i = 0; i < wx.length - 1; i++) for (const oz of [-0.65, 0, 0.65]) wire(V3(wx[i], 8.4, pz + oz), V3(wx[i + 1], 8.4, pz + oz), 0.9);

  // blue Paris-style street sign on the far wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: canvasTex(512, (g) => {
    g.canvas.height = 160;
    g.fillStyle = '#2e7d4f'; g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#1d3f7a'; g.fillRect(10, 10, 492, 140);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(20, 20, 472, 120);
    g.fillStyle = '#fff'; g.font = '700 30px Fredoka, sans-serif'; g.textAlign = 'center';
    g.fillText('RUE', 256, 60); g.font = '700 50px Fredoka, sans-serif'; g.fillText("D'AGUESSEAU", 256, 115);
  }), roughness: 0.5 }));
  sign.position.set(-50.45, 1.45, -WALL_Z + 0.21);
  scene.add(sign);

  // merge static meshes by material; repeated bits become instanced meshes
  S.updateMatrixWorld(true);
  const buckets = new Map();
  S.traverse(o => {
    if (!o.isMesh) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  for (const [m, list] of buckets) {
    const merged = new THREE.Mesh(mergeGeometries(list), m);
    merged.castShadow = merged.receiveShadow = true;
    scene.add(merged);
  }
  for (const { geo, mat, list } of INST.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = im.receiveShadow = true;
    scene.add(im);
  }
}
buildWorld();

// ───────────────────────── markers, floating text, puffs
function markerMat(bg, draw) {
  const map = canvasTex(128, g => {
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
    g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; draw(g);
  });
  return new THREE.SpriteMaterial({ map, depthTest: false });
}
const MARK = {
  foreign: markerMat('#ef476f', g => { g.font = '900 78px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 68); }),
  neighbour: markerMat('#2ec4b6', g => { g.beginPath(); g.moveTo(64, 30); g.lineTo(98, 62); g.lineTo(88, 62); g.lineTo(88, 94); g.lineTo(40, 94); g.lineTo(40, 62); g.lineTo(30, 62); g.closePath(); g.fill(); }),
  mine: markerMat('#f4a261', g => { g.font = '700 70px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', 64, 68); }),
};

const floats = [];
function floatText(text, x, y, z, color = '#fff') {
  const c = document.createElement('canvas'), g = c.getContext('2d'), font = '700 60px Fredoka, system-ui, sans-serif';
  g.font = font; c.width = Math.max(512, Math.ceil(g.measureText(text).width) + 40); c.height = 128;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = 'rgba(18,22,30,.85)'; g.strokeText(text, c.width / 2, 64);
  g.fillStyle = color; g.fillText(text, c.width / 2, 64);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  sp.scale.set(4.4 * c.width / 512, 1.1, 1); sp.position.set(x, y, z); sp.renderOrder = 10;
  scene.add(sp); floats.push({ sp, t: 0 });
}
const puffs = [], puffGeo = new THREE.IcosahedronGeometry(0.28, 0);
function puff(x, z, n = 6, color = '#e9e9e9') {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.8, flatShading: true }));
    m.position.set(x + rand(-0.5, 0.5), 0.3, z + rand(-0.5, 0.5));
    scene.add(m);
    puffs.push({ m, v: new THREE.Vector3(rand(-1, 1), rand(0.8, 1.8), rand(-1, 1)), t: 0 });
  }
}
function updateFx(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt;
    f.sp.position.y += dt * 1.4;
    f.sp.material.opacity = clamp(1.8 - f.t, 0, 1);
    if (f.t > 1.8) { scene.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); floats.splice(i, 1); }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.t += dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.scale.setScalar(1 + p.t * 2.2);
    p.m.material.opacity = 0.8 * (1 - p.t / 0.9);
    if (p.t > 0.9) { scene.remove(p.m); p.m.material.dispose(); puffs.splice(i, 1); }
  }
  for (const s of smoke) if (s.m.visible) {
    s.t += dt; s.m.position.addScaledVector(s.v, dt); s.v.y *= 1 - dt * 0.6;
    s.m.scale.setScalar((0.7 + s.t * 1.9) * s.k);
    s.m.material = (s.cig ? CIG : SMOKE)[Math.min(7, (s.t / s.life * 8) | 0)];
    s.m.visible = s.t < s.life;
  }
}
// diesel smoke: ring buffer of ≤150 meshes sharing puffGeo and 8 fade-step materials (no per-particle allocation)
const SMOKE = Array.from({ length: 8 }, (_, i) => new THREE.MeshStandardMaterial({ color: '#1b1b1b', transparent: true, opacity: 0.8 * (1 - i / 8), depthWrite: false, flatShading: true }));
const CIG = SMOKE.map(m => Object.assign(m.clone(), { color: new THREE.Color('#d8d8d4') })); // cigarette smoke
const smoke = [];
let smokeI = 0;
function smokePuff(p, cig = false) {
  let s = smoke[smokeI];
  if (!s) { s = smoke[smokeI] = { m: new THREE.Mesh(puffGeo, SMOKE[0]), v: new THREE.Vector3() }; scene.add(s.m); }
  smokeI = (smokeI + 1) % 150;
  s.m.position.set(p.x + rand(-0.1, 0.1), p.y, p.z + rand(-0.1, 0.1)); s.m.rotation.set(rand(0, 3), rand(0, 3), 0);
  s.v.set(rand(-0.5, 0.5), rand(1.4, 2.4), rand(-0.5, 0.5)).multiplyScalar(cig ? 0.3 : 1); s.t = 0; s.life = rand(1.6, 2.6); s.m.visible = true;
  s.cig = cig; s.k = cig ? 0.25 : 1;
}
// tiny WebAudio synth: no audio files needed
let actx = null, muted = false;
function beep(freqs, dur, type, vol) {
  if (!actx || muted) return;
  const t0 = actx.currentTime;
  freqs.forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t0 + i * dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur);
    o.connect(g).connect(actx.destination);
    o.start(t0 + i * dur); o.stop(t0 + (i + 1) * dur);
  });
}
const SFX = {
  honk: () => beep([392, 370], 0.15, 'sawtooth', 0.03),
  buy: () => beep([660, 880, 1320], 0.07, 'triangle', 0.08),
  block: () => beep([520, 780], 0.08, 'triangle', 0.07),
  fine: () => beep([300, 190], 0.13, 'square', 0.035),
  free: () => beep([880, 1175], 0.07, 'sine', 0.07),
  door: () => beep([160], 0.07, 'square', 0.04),
  crank: () => beep([55, 62, 50, 95], 0.11, 'sawtooth', 0.05),
  fart: () => beep([95, 80, 88, 66, 72, 52], 0.08, 'sawtooth', 0.07),
  boing: () => { // spring: pitch jumps then wobbles down
    if (!actx || muted) return;
    const t0 = actx.currentTime, o = actx.createOscillator(), lfo = actx.createOscillator(), lg = actx.createGain(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(360, t0 + 0.06); o.frequency.exponentialRampToValueAtTime(190, t0 + 0.45);
    lfo.frequency.value = 22; lg.gain.setValueAtTime(70, t0); lg.gain.exponentialRampToValueAtTime(1, t0 + 0.45);
    g.gain.setValueAtTime(0.14, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    lfo.connect(lg).connect(o.frequency); o.connect(g).connect(actx.destination);
    o.start(t0); lfo.start(t0); o.stop(t0 + 0.5); lfo.stop(t0 + 0.5);
  },
};
const nearPlayer = (x, z, r = 28) => { const w = driving || player; return Math.hypot(x - w.x, z - w.z) < r; };
let toastT;
function toast(msg) { $('toast').textContent = msg; $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 2600); }

// ───────────────────────── cars
const CAR_TYPES = {
  hatch: { len: 4.0, w: 1.75, body: 0.62, cab: 2.5, cabH: 0.6, cabX: -0.2, fr: 0.7, rr: 0.35 },
  mpv: { len: 4.5, w: 1.85, body: 0.7, cab: 3.5, cabH: 0.74, cabX: 0, fr: 1.1, rr: 0.25 },
  suv: { len: 4.7, w: 1.9, body: 0.85, cab: 3.1, cabH: 0.68, cabX: -0.25, fr: 0.6, rr: 0.3 },
  mini: { len: 3.8, w: 1.75, body: 0.6, cab: 2.2, cabH: 0.58, cabX: -0.2, fr: 0.45, rr: 0.2, roof: '#f2f2f2' },
};
const AI_COLORS = ['#8c939b', '#d9dcde', '#5b7391', '#7d8288', '#f0f0f0', '#a83c3c', '#56657a', '#b9a98a', '#3f6a8f', '#33373d', '#c8ccd0'];
const MINE_COLORS = ['#f2b134', '#2ec4b6', '#e76f51', '#9b5de5', '#00bbf9'];
const NEIGHBOURS = [ // home: x of their house (they prefer bays near it)
  { name: 'Marion', color: '#2f3e5c', type: 'mpv', home: -37 },
  { name: 'Thierry', color: '#5b6470', type: 'mpv' },
  { name: 'Marie-Claude', color: '#6b7075', type: 'mini', home: -12 },
  { name: 'Dédé', color: '#3c3f44', type: 'suv', home: -44 },
  { name: 'Florence', color: '#eeeeee', type: 'hatch' },
  { name: 'Le père', color: '#8a8f94', type: 'hatch', home: -25 },
  // Erika's household
  { name: 'Clément', color: '#8c9196', type: 'hatch', home: -30, dented: true }, // battered grey VW Polo: breaks down every time he parks
  { name: 'Léa', color: '#b7d3e8', type: 'mini', home: -30 },
  { name: 'Kévin', model: buildZ4, home: -30 }, // black BMW Z4 E89
];
const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
function buildCar(color, type) {
  const t = CAR_TYPES[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const paint = M(color, { roughness: 0.35, metalness: 0.35, flatShading: false });
  paint.envMap = ENV; paint.envMapIntensity = 0.5;
  const y0 = 0.34;
  box(body, t.len, 0.28, t.w + 0.04, '#26282c', 0, y0, 0);
  box(body, t.len - 0.1, t.body, t.w, paint, 0, y0 + t.body / 2 + 0.05, 0);
  const cy = y0 + t.body + 0.05 + t.cabH / 2;
  t.cabGeo ||= new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-t.cab / 2, 0), new THREE.Vector2(t.cab / 2, 0), new THREE.Vector2(t.cab / 2 - t.fr, t.cabH), new THREE.Vector2(-t.cab / 2 + t.rr, t.cabH)]), { depth: t.w - 0.2, bevelEnabled: false }).translate(0, 0, -(t.w - 0.2) / 2);
  mesh(body, t.cabGeo, GLASS, t.cabX, cy - t.cabH / 2, 0);
  box(body, t.cab - t.fr - t.rr + 0.1, 0.09, t.w - 0.12, t.roof ? M(t.roof) : paint, t.cabX + (t.rr - t.fr) / 2, cy + t.cabH / 2 + 0.03, 0);
  for (const sz of [-1, 1]) {
    box(body, 0.06, 0.14, 0.38, HEAD, t.len / 2 - 0.02, y0 + t.body * 0.62, sz * (t.w / 2 - 0.3));
    box(body, 0.06, 0.14, 0.3, TAIL, -t.len / 2 + 0.02, y0 + t.body * 0.62, sz * (t.w / 2 - 0.28));
    box(body, 0.2, 0.1, 0.12, paint, t.cabX + t.cab / 2 - 0.2, cy - 0.1, sz * (t.w / 2 + 0.02)); // mirrors
    for (const sx of [-1, 1]) mesh(g, wheelGeo, '#1b1b1d', sx * (t.len / 2 - 0.78), 0.34, sz * (t.w / 2 - 0.08)).rotation.x = Math.PI / 2;
  }
  return { g, body, len: t.len };
}

const cars = [], bins = [];
let carId = 0;
// m: a { g, body, len, w? } model (buildCar or buildTruck); collision = round(len/2) circles of radius w/2 along the length
function addCar(kind, color, type, m = buildCar(color, type)) {
  const { g, body, len } = m, r = m.w ? m.w / 2 : CAR_R, n = Math.max(2, Math.round(len / 2)), e = len / 2 - r;
  scene.add(g);
  const c = { id: carId++, kind, mesh: g, body, len, r, circ: Array.from({ length: n }, (_, i) => e - 2 * e * i / (n - 1)), x: 0, z: 0, ang: 0, speed: 0, dir: 1,
    state: kind === 'mine' ? 'mine' : 'drive', blocker: kind === 'mine', slot: null, timer: 0, scan: 0, honkT: 0, cruise: rand(6.5, 9), wantsSlot: true,
    acc: 9, top: 13, turn: 0.55, pivot: 0, markY: 2.9 };
  c.marker = new THREE.Sprite(MARK[kind]);
  c.marker.scale.setScalar(kind === 'neighbour' ? 0.9 : 1.1); c.marker.renderOrder = 5;
  g.add(c.marker);
  cars.push(c);
  return c;
}
// collision circles [x, z, r] of vehicle c, optionally at a hypothetical pose
const circles = (c, x = c.x, z = c.z, ang = c.ang) => { const cs = Math.cos(ang), sn = Math.sin(ang); return c.circ.map(o => [x + cs * o, z - sn * o, c.r]); };

// ───────────────────────── slots
const slotGeo = new THREE.PlaneGeometry(SLOT_LEN - 0.35, 2.0);
const slots = [];
for (const s of [-1, 1]) for (const x of SLOT_XS[s]) {
  const ov = new THREE.Mesh(slotGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false }));
  ov.rotation.x = -Math.PI / 2; ov.position.set(x, 0.012, s * SLOT_Z);
  scene.add(ov);
  slots.push({ x, z: s * SLOT_Z, side: s, ai: null, block: null, ov });
}
// top-of-screen strip: far side (s=-1) on top, near side below, both left→right along X
{
  const strip = $('strip');
  for (const s of [-1, 1]) {
    const row = document.createElement('div'); row.className = 'row';
    let prev = null;
    for (const sl of slots.filter(q => q.side === s).sort((p, q) => p.x - q.x)) {
      if (prev !== null && sl.x - prev > SLOT_LEN + 0.1) row.append(Object.assign(document.createElement('div'), { className: 'gap' }));
      sl.el = Object.assign(document.createElement('div'), { className: 's' });
      row.append(sl.el); prev = sl.x;
    }
    strip.append(row);
  }
}
const inSlot = (o, s) => Math.abs(o.x - s.x) < SLOT_LEN / 2 && Math.abs(o.z - s.z) < 1.4; // pedestrians
// vehicles block every bay their length overlaps by ≥1.2 m while in that side's parking lane: parked across a line = 2 bays
const covers = (c, s) => Math.abs(c.z - s.z) < 1.4 && (SLOT_LEN + c.len) / 2 - Math.abs(c.x - s.x) >= 1.2;
// E-snap targets per side: bay centres + boundaries between adjacent bays
const SNAP_XS = Object.fromEntries([1, -1].map(s => [s, SLOT_XS[s].flatMap((x, i, a) => a[i + 1] - x < SLOT_LEN + 0.1 ? [x, x + SLOT_LEN / 2] : [x])]));
const parkZ = (c, side) => side * Math.min(SLOT_Z, CURB_Z - c.r - 0.15); // wide vehicles keep off the curb so they can pull out
const snapX = (side, x) => SNAP_XS[side].reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
const parkedAng = () => 0; // one-way: everyone parks facing +x

// ───────────────────────── player (pedestrian)
const person = buildErika(); // the player
scene.add(person.g);
const player = { x: 0, z: -6.2, ang: 0, moving: false, phase: 0 };
const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; scene.add(ring);

// ───────────────────────── game state
const keys = {};
let belly = 0, driving = null, score = 50, elapsed = 0, streak = 0, rate = 0, mult = 1, spawnT = 8;
let boostT = 0, slowT = 0, chatT = rand(30, 50); // speed boost (baguette), slowdown (father's fart), cooldown before a driver stops to chat
let binsInHand = null, carsOwned = 1, started = false, paused = false, foreignN = 0;
let best = 0;
try { best = +localStorage.getItem('parkingGuardBest') || 0; } catch {}
const carPrice = () => 200 * 2 ** (carsOwned - 1);

// ───────────────────────── AI (strangers + neighbours)
const laneZ = c => c.dir * LANE_Z;
function bez(p, t, k) { const u = 1 - t; return u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]; }
function bezD(p, t, k) { const u = 1 - t; return 3 * u * u * (p[1][k] - p[0][k]) + 6 * u * t * (p[2][k] - p[1][k]) + 3 * t * t * (p[3][k] - p[2][k]); }
function followPath(c, dt, ease) {
  c.t = Math.min(1, c.t + dt / c.dur);
  const u = ease(c.t), x = bez(c.path, u, 0), z = bez(c.path, u, 1), dx = bezD(c.path, u, 0), dz = bezD(c.path, u, 1);
  c.speed = Math.hypot(x - c.x, z - c.z) / dt;
  c.x = x; c.z = z;
  if (dx * dx + dz * dz > 1e-6) c.ang = Math.atan2(-dz, dx);
  return c.t >= 1;
}
function findSlot(c) {
  let best = null, bs = Infinity;
  for (const s of slots) {
    if (s.ai || s.block) continue;
    const rem = (s.x - c.x) * c.dir;
    if (rem < 10 || rem > 45) continue;
    const sc = c.kind === 'neighbour' ? Math.abs(s.x - c.home) : rem;
    if (sc < bs) { bs = sc; best = s; }
  }
  return best;
}
function obstacleAhead(c) {
  let gap = Infinity, who = null;
  const test = (o, x, z, clear, lat = 1.9) => {
    const along = (x - c.x) * c.dir;
    if (along > 0 && Math.abs(z - c.z) < lat && along - clear < gap) { gap = along - clear; who = o; }
  };
  // only cars whose centre is ahead: two overlapping cars would otherwise each wait for the other forever
  for (const o of cars) if (o !== c && o.state !== 'away' && o.state !== 'parked' && (o.x - c.x) * c.dir > 0) for (const [x, z, r] of circles(o)) test(o, x, z, c.len / 2 + r + 1.2, CAR_R + r);
  if (!driving) test(player, player.x, player.z, c.len / 2 + 1.2);
  for (const b of bins) test(b, b.x, b.z, c.len / 2 + 1);
  for (const w of walkers) if (w.g.visible) test(w, w.x, w.z, c.len / 2 + 1.2);
  return [gap, who];
}
function laneClear(c) {
  const s = c.slot, lz = laneZ(c);
  for (const o of cars) {
    if (o === c || o.state === 'away' || o.state === 'parked') continue;
    const along = (o.x - s.x) * c.dir;
    if (Math.abs(o.z - lz) < 2.2 && along > -16 && along < 11) return false;
  }
  const along = (player.x - s.x) * c.dir;
  return driving || !(Math.abs(player.z - lz) < 2.2 && along > -2 && along < 11);
}
function placeParked(c, s, stay) {
  Object.assign(c, { dir: 1, x: s.x, z: s.z, ang: parkedAng(s), state: 'parked', slot: s, timer: stay, speed: 0 });
  s.ai = c;
}
function enterStreet(c) {
  const d = 1, x = -END_X, lz = LANE_Z;
  if (cars.some(o => o !== c && o.state !== 'away' && Math.abs(o.x - x) < 9 && Math.abs(o.z - lz) < 1.2)) return false;
  Object.assign(c, { dir: d, x, z: lz, ang: d > 0 ? 0 : Math.PI, state: 'drive', speed: c.cruise, scan: 0, slot: null,
    wantsSlot: c.kind === 'neighbour' || Math.random() < 0.35 + 0.4 * traffic() });
  c.mesh.visible = true;
  return true;
}
function leaveStreet(c) {
  if (c.slot) { c.slot.ai = null; c.slot = null; }
  if (c.kind === 'foreign') { scene.remove(c.mesh); cars.splice(cars.indexOf(c), 1); return; }
  if (c.kind === 'neighbour' && c.wantsSlot) { // drove the whole street without finding a bay
    score = Math.max(0, score - NEIGHBOUR_FINE); SFX.fine();
    toast(`${c.name} couldn't park in the street! −${NEIGHBOUR_FINE}`);
  }
  c.state = 'away'; c.timer = c.kind === 'neighbour' ? rand(90, 180) : rand(15, 60); c.mesh.visible = false;
}
function startPark(c) {
  const s = c.slot, lz = laneZ(c), d = c.dir;
  c.path = [[c.x, c.z], [c.x + d * 3, lz], [s.x - d * 3, s.z], [s.x, s.z]];
  c.dur = clamp((2 * (s.x - c.x) * d) / Math.max(c.speed, 2), 2, 4.5);
  c.t = 0; c.state = 'park';
}
function finishPark(c) {
  const s = c.slot;
  Object.assign(c, { state: 'parked', x: s.x, z: s.z, ang: parkedAng(s), speed: 0, timer: c.kind === 'foreign' ? rand(45, 110) : rand(40, 150) });
  puff(s.x - Math.cos(c.ang) * c.len / 2, s.z, 4, '#cfcfcf');
  if (c.kind === 'foreign') { SFX.fine(); score = Math.max(0, score - STRANGER_FINE); floatText(`Stranger parked! −${STRANGER_FINE}`, s.x, 3.4, s.z, '#ff8fa3'); }
  else floatText(`${c.name} is home`, s.x, 3.4, s.z, '#7ff0e4');
  if (c.dented) { c.broken = true; floatText('Clément : Encore en panne !', s.x, 4.2, s.z, '#7ff0e4'); callMechanic(c); } // fixed, then broken again next time
}
function startLeave(c) {
  const lz = laneZ(c), d = c.dir; // from the actual pose: a truck may have shoved it off the bay centre
  c.path = [[c.x, c.z], [c.x + d * 3, c.z], [c.x + d * 6, lz], [c.x + d * 9, lz]];
  c.dur = 3; c.t = 0; c.state = 'leave'; c.shoved = 0;
  puff(c.x - d * c.len / 2, c.z, 5, '#bdbdbd');
}
const PATIENCE = 8; // s a car waits behind Erika (on foot or in one of her cars) before shoving her aside
const touchesBelly = c => !driving && pedPush({ x: player.x, z: player.z }, c, P_R + 0.12);
function bellyBounce(c) { // a car pulling in bumps into Erika: it bounces off her belly and gives up the bay
  const dx = c.x - player.x, dz = c.z - player.z, d = Math.hypot(dx, dz) || 1;
  c.slot.ai = null; c.slot = null; c.state = 'drive'; c.speed = 0;
  c.kick = 1; c.kx = dx / d * 3.5; c.kz = dz / d * 3.5; belly = 1;
  SFX.boing(); floatText('Boing!', player.x, 3, player.z, '#ffd166');
}
// nudge the blocker sideways (either side), else along the lane; the player on foot always gives way
function shoveAside(c, o, dt) {
  if (c.stuckT - dt <= PATIENCE) { floatText('Pousse-toi !', c.x, 3, c.z, '#ff8fa3'); if (nearPlayer(c.x, c.z)) SFX.honk(); }
  const side = Math.sign(o.z) || 1, v = 2.5 * dt;
  if (o === player) { player.z += side * v; return pushOut(player); }
  const pen = carPen(o, o.x, o.z, o.ang);
  for (const [dx, dz] of [[0, side], [0, -side], [c.dir, 0]]) if (carPen(o, o.x + dx * v, o.z + dz * v, o.ang) <= pen + 1e-4) { o.x += dx * v; o.z += dz * v; return; }
}
function updateAI(c, dt) {
  c.honkT -= dt;
  if (c.kick > 0) { c.x += c.kx * c.kick * dt; c.z += c.kz * c.kick * dt; c.kick -= dt * 4; }
  switch (c.state) {
    case 'away':
      if ((c.timer -= dt) <= 0 && !enterStreet(c)) c.timer = 1;
      return;
    case 'parked':
      c.speed = 0;
      if ((c.timer -= dt) <= 0 && !c.broken && laneClear(c)) startLeave(c);
      return;
    case 'park':
      if (touchesBelly(c)) return bellyBounce(c);
      if (followPath(c, dt, t => 1 - (1 - t) ** 2)) finishPark(c);
      return;
    case 'leave':
      if (followPath(c, dt, t => t * t)) {
        if (c.kind === 'foreign') { floatText('Spot free!', c.slot.x, 3.2, c.slot.z, '#8ef0a8'); SFX.free(); }
        c.slot.ai = null; c.slot = null; c.state = 'drive'; c.wantsSlot = false; c.speed = 4;
      }
      return;
  }
  // drive
  if (c.chat > 0) { // stopped to chat with Erika: the traffic behind has to wait
    c.speed = Math.max(0, c.speed - 14 * dt); c.x += c.speed * c.dir * dt;
    if ((c.chat -= dt) <= 0) floatText('Allez, à plus Erika !', c.x, 3, c.z, '#cdb4ff');
    return;
  }
  if (chatT <= 0 && !driving && Math.abs(player.x - c.x) < 3 && Math.abs(player.z - c.z) < 5.5) {
    c.chat = rand(5, 8); chatT = rand(45, 75);
    floatText(pick(['Salut Erika ! Ça va ?', 'Oh Erika ! Tu connais la nouvelle ?', 'Erika ! Ça fait longtemps !']), c.x, 3.2, c.z, '#cdb4ff');
    floatText(pick(['Ah salut !', 'Ben dis donc !', 'Oh bah ça alors !']), player.x, 3.8, player.z, '#ffd166');
  }
  if (c.wantsSlot && !c.slot && (c.scan -= dt) <= 0) {
    c.scan = 0.3;
    const s = findSlot(c);
    if (s) { s.ai = c; c.slot = s; }
  }
  const [gap, who] = obstacleAhead(c);
  let target = gap < 0 ? 0 : Math.min(c.cruise, gap * 1.6);
  if (c.slot) {
    const rem = (c.slot.x - c.x) * c.dir;
    if (rem < 4) { c.slot.ai = null; c.slot = null; }
    else {
      target = Math.min(target, 2.5 + rem * 0.35);
      if (rem <= 9 && gap > 1) return startPark(c);
    }
  }
  c.stuckT = gap < 0.5 && (who === player || who?.kind === 'mine') ? (c.stuckT || 0) + dt : 0;
  if (c.stuckT > PATIENCE) shoveAside(c, who, dt);
  c.speed += clamp(target - c.speed, -14 * dt, 5 * dt);
  c.x += c.speed * c.dir * dt;
  c.z += (laneZ(c) - c.z) * Math.min(1, dt * 3);
  c.ang = c.dir > 0 ? 0 : Math.PI;
  if (gap < 0.3 && c.honkT <= 0 && (who === player || who?.kind === 'mine' || who?.chat > 0 || bins.includes(who))) {
    c.honkT = rand(3, 5);
    if (nearPlayer(c.x, c.z)) SFX.honk();
    floatText(pick(['BEEP!', 'Pouet!', 'HONK!']), c.x, 3, c.z, '#ffd166');
  }
  if (c.x * c.dir > END_X) leaveStreet(c);
}
// 0 = calm, 1 = rush hour: ~2.5 min waves (short rushes, longer calm spells) that grow stronger over the first minutes
const traffic = () => clamp((elapsed - 45) / 300, 0, 1) * (0.25 + 0.75 * (0.5 - 0.5 * Math.cos(elapsed * 2 * Math.PI / 150)) ** 2);
function spawner(dt) {
  if ((spawnT -= dt) > 0) return;
  spawnT = (14 - 11.5 * traffic()) * rand(0.7, 1.3);
  if (cars.filter(c => c.kind === 'foreign').length > 24) return;
  const c = addCar('foreign', pick(AI_COLORS), pick(['hatch', 'hatch', 'mpv', 'suv', 'mini']));
  if (!enterStreet(c)) { scene.remove(c.mesh); cars.pop(); }
}

// ───────────────────────── player movement & actions
function carPen(c, x, z, ang, skip = []) {
  let pen = 0;
  for (const [ax, az, ar] of circles(c, x, z, ang)) {
    pen += Math.max(0, Math.abs(az) + ar - CURB_Z) + Math.max(0, Math.abs(ax) - 62);
    for (const o of cars) {
      if (o === c || o.state === 'away' || skip.includes(o)) continue;
      for (const [bx, bz, br] of circles(o)) pen += Math.max(0, ar + br - Math.hypot(ax - bx, az - bz));
    }
    for (const b of bins) pen += Math.max(0, ar + BIN_R - Math.hypot(ax - b.x, az - b.z));
  }
  return pen;
}
// E "tidy into spot": straight, in the parking lane, x on the nearest bay centre/boundary (keeps a deliberate straddle); null if it would collide
function tidy(c) {
  if (!slots.some(s => covers(c, s))) return null;
  const side = Math.sign(c.z), sx = snapX(side, c.x);
  const t = { x: Math.abs(sx - c.x) < SLOT_LEN / 2 ? sx : c.x, z: parkZ(c, side), ang: Math.cos(c.ang) >= 0 ? 0 : Math.PI };
  return carPen(c, t.x, t.z, t.ang) <= carPen(c, c.x, c.z, c.ang) + 1e-4 ? t : null;
}
function drive(c, dt) {
  const acc = keys.up ? c.acc : keys.down ? (c.speed > 0.5 ? -1.8 : -0.67) * c.acc : 0;
  c.speed += acc * dt;
  if (!acc) c.speed *= Math.pow(0.3, dt);
  if (keys.brake) c.speed *= Math.pow(0.01, dt);
  c.speed = clamp(c.speed, -0.4 * c.top, c.top);
  const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const ang = c.ang + steer * clamp(c.speed, -4, 4) * c.turn * dt, k = c.pivot, d = c.speed * dt; // turns about a point k m behind the centre (rear axle)
  const x = c.x - Math.cos(c.ang) * k + Math.cos(ang) * (k + d), z = c.z + Math.sin(c.ang) * k - Math.sin(ang) * (k + d);
  const before = carPen(c, c.x, c.z, c.ang), after = carPen(c, x, z, ang);
  if (after > before + 1e-4 && c.truck && truckShove(c, x, z, ang)) Object.assign(c, { x, z, ang });
  else if (after <= before + 1e-4) Object.assign(c, { x, z, ang });
  else {
    if (Math.abs(c.speed) > 3) { puff(x, z, 3, '#ddd'); floatText('Bump!', c.x, 2.8, c.z, '#ffd166'); }
    c.speed *= -0.2;
  }
  if (c.exhaust) exhaustFx(c, dt);
}
// the truck shoves parked strangers/neighbours along with it; after ~1 m they give up the bay and drive off
function truckShove(c, x, z, ang) {
  const tc = circles(c, x, z, ang);
  const hit = cars.filter(o => o.state === 'parked' && (o.kind === 'foreign' || o.kind === 'neighbour') && circles(o).some(([bx, bz, br]) => tc.some(([ax, az, ar]) => Math.hypot(ax - bx, az - bz) < ar + br)));
  if (!hit.length || carPen(c, x, z, ang, hit) > carPen(c, c.x, c.z, c.ang, hit) + 1e-4) return false;
  const dx = x - c.x, dz = z - c.z;
  for (const o of hit) {
    o.x += dx; o.z += dz;
    if ((o.shoved = (o.shoved || 0) + Math.hypot(dx, dz)) > 1) { startLeave(o); floatText('Shoved out!', o.x, 3.2, o.z, '#ffd166'); SFX.honk(); }
  }
  return true;
}
// black smoke: the truck's diesel (idle trickle, more with speed, lots on the throttle) + low rumble; the BMW coughs a cloud at start-up
function exhaustFx(c, dt) {
  const v = Math.abs(c.speed);
  if (c.truck) c.smokeT += dt * (v > 0.3 ? 12 + v * 3 + (keys.up ? 30 : 0) : 3);
  if (c.cough > 0) { c.cough -= dt; c.smokeT += dt * 45; }
  if (c.smokeT >= 1) {
    c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.ang; c.mesh.updateMatrixWorld();
    const p = c.mesh.localToWorld(c.exhaust.clone());
    for (; c.smokeT >= 1; c.smokeT--) smokePuff(p);
  }
  if (c.truck && (c.rumbleT -= dt) <= 0) { c.rumbleT = 0.16; beep([36 + v * 5], 0.18, 'sawtooth', keys.up ? 0.035 : 0.02); }
}
const pedBounds = p => { p.x = clamp(p.x, -60, 60); p.z = clamp(p.z, -WALL_Z + 0.45, WALL_Z - 0.45); };
// pedestrian vs vehicle: the footprint is a len × 2r box (the collision circles leave gaps along the sides of long cars)
function pedPush(p, o, m = P_R) {
  const cs = Math.cos(o.ang), sn = Math.sin(o.ang), dx = p.x - o.x, dz = p.z - o.z, L = o.len / 2, R = o.r;
  let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  const qx = clamp(lx, -L, L), qz = clamp(lz, -R, R), d = Math.hypot(lx - qx, lz - qz);
  if (d >= m) return false;
  if (d > 1e-6) { lx = qx + (lx - qx) / d * m; lz = qz + (lz - qz) / d * m; }
  else if (R - Math.abs(lz) < L - Math.abs(lx)) lz = (Math.sign(lz) || 1) * (R + m);
  else lx = (Math.sign(lx) || 1) * (L + m);
  p.x = o.x + lx * cs + lz * sn; p.z = o.z - lx * sn + lz * cs;
  return true;
}
function pushOut(p) {
  for (const o of cars) if (o.state !== 'away') pedPush(p, o);
  for (const b of bins) {
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), m = BIN_R + P_R;
    if (d < m && d > 1e-4) { p.x = b.x + (dx / d) * m; p.z = b.z + (dz / d) * m; }
  }
  pedBounds(p);
}
function walk(dt) {
  const f = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), r = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  // screen-relative: camera looks along (-1,0,-1)
  let vx = r - f, vz = -f - r;
  const len = Math.hypot(vx, vz);
  player.moving = len > 0;
  if (len) {
    vx /= len; vz /= len;
    const v = (binsInHand ? 4.3 : 6.2) * (boostT > 0 ? 1.6 : 1) * (slowT > 0 ? 0.45 : 1);
    player.x += vx * v * dt; player.z += vz * v * dt;
    player.ang = Math.atan2(-vz, vx);
  }
  pushOut(player);
}
const pedFree = (x, z) => Math.abs(z) < WALL_Z - 0.45 && Math.abs(x) < 60 && !cars.some(o => o.state !== 'away' && pedPush({ x, z }, o));
const nearestMine = () => { // measured to the nearest collision circle, so the long truck works from either end
  let best = null, bd = 2.2;
  for (const c of cars) if (c.kind === 'mine' && !c.taken) for (const [x, z, r] of circles(c)) { const d = Math.hypot(x - player.x, z - player.z) - r; if (d < bd) { bd = d; best = c; } }
  return best;
};
const nearBin = () => bins.find(b => Math.hypot(b.x - player.x, b.z - player.z) < 1.8);
const slotFree = s => !(s.ai && s.ai.state !== 'drive') && (!s.block || s.block === player);
const binSlot = () => {
  const o = binsInHand || player;
  let best = null, bd = 3.2;
  for (const s of slots) { const d = Math.hypot(s.x - o.x, s.z - o.z); if (d < bd && slotFree(s)) { bd = d; best = s; } }
  return best;
};

function actionE() {
  if (!driving) {
    const c = nearestMine();
    if (c && binsInHand) return toast('Put the bin down first (B)');
    if (c?.broken) {
      SFX.crank(); floatText('Rrr… rrr… elle démarre pas !', c.x, 3, c.z, '#ffd166');
      const msg = ST.car === c ? 'Stéphane the mechanic is on it' : ST.car ? 'Stéphane is busy, he comes right after' : "It won't start! Stéphane the mechanic is coming";
      callMechanic(c); return toast(msg);
    }
    if (c) {
      driving = c; c.speed = 0; c.rest = { x: c.x, z: c.z, ang: c.ang }; person.g.visible = false; SFX.door();
      if (c.truck) c.smokeT = 8;
      if (c.smoky) { c.cough = 1.4; c.smokeT = 0; SFX.crank(); }
    }
    return;
  }
  const c = driving;
  if (Math.abs(c.speed) > 2) return toast('Slow down before getting out!');
  const t = tidy(c);
  if (t) Object.assign(c, t);
  // exits: beside each collision circle front→back (driver door first), then behind / ahead, then further out
  const cs = Math.cos(c.ang), sn = Math.sin(c.ang), w = c.r + 0.85;
  for (const [a, l] of [...c.circ.flatMap(a => [[a, w], [a, -w]]), [-c.len / 2 - 0.8, 0], [c.len / 2 + 0.8, 0], [0, w + 1], [0, -w - 1]]) {
    const x = c.x + cs * a - sn * l, z = c.z - sn * a - cs * l;
    if (!pedFree(x, z)) continue;
    player.x = x; player.z = z; c.speed = 0; driving = null; person.g.visible = true; SFX.door();
    if (!slots.some(s => covers(c, s))) return sendHome(c);
    const n = slots.filter(s => covers(c, s) && (!s.ai || s.ai.state === 'drive')).length;
    if (n) { floatText(n > 1 ? `${n} spots blocked!` : 'Spot secured!', c.x, c.markY + 0.4, c.z, '#ffd166'); puff(c.x, c.z, 4 + n, '#fff3c4'); SFX.block(); }
    return;
  }
  toast('No room to get out here');
}
// a car left on the road goes back to where it was parked (or the nearest free spot if that's been taken)
function sendHome(c) {
  const ok = t => carPen(c, t.x, t.z, t.ang) === 0 && !slots.some(s => covers({ ...c, ...t }, s) && s.ai && s.ai.state !== 'drive');
  const spots = slots.flatMap(s => [s.x, s.x + SLOT_LEN / 2].map(x => ({ x, z: parkZ(c, s.side), ang: 0 })))
    .sort((a, b) => Math.hypot(a.x - c.rest.x, a.z - c.rest.z) - Math.hypot(b.x - c.rest.x, b.z - c.rest.z));
  const t = [c.rest, ...spots].find(t => (t === c.rest || slots.some(s => covers({ ...c, ...t }, s))) && ok(t));
  if (!t) return toast('Your car is blocking the road!');
  puff(c.x, c.z, 8, '#fff3c4');
  Object.assign(c, t);
  puff(c.x, c.z, 8, '#fff3c4');
  floatText('Back to its spot', c.x, c.markY + 0.4, c.z, '#ffd166');
  pushOut(player);
}
function actionB() {
  if (driving) return;
  const b = binsInHand;
  if (!b) {
    const n = nearBin();
    if (!n) return toast('Walk up to a bin to grab it');
    bins.splice(bins.indexOf(n), 1); n.slot = null; binsInHand = n; SFX.door();
    return;
  }
  const side = Math.sign(b.z), walkway = Math.abs(b.z) > CURB_Z, s = walkway ? null : binSlot(), x = s ? s.x : walkway ? sidewalkSpot(b.x, side) : null;
  if (x === null) return toast(walkway ? 'No room for the bin here' : 'Push the bin into a free spot or onto the sidewalk');
  binsInHand = null;
  putBin(b, x, s ? s.z + s.side * 0.35 : side * BIN_Z, s);
  puff(b.x, b.z, 5, '#fff3c4');
  if (s) { floatText('Spot blocked!', b.x, 2.8, b.z, '#ffd166'); SFX.block(); }
  pushOut(player);
}
// Erika's driveway gate: no bay in front of it, new cars are delivered there and she parks them herself
const GARAGE_X = GATES[-1][1];
const garageBusy = me => cars.some(o => o !== me && o.state !== 'away' && Math.abs(o.x - GARAGE_X) < 4.5 && o.z < -2.5);
function buyCar() {
  const price = carPrice();
  if (score < price) return toast(`A car costs ${price} credits`);
  if (garageBusy()) return toast('Move the car in front of your garage first');
  score -= price; carsOwned++;
  const m = [buildBMW, buildSpring, buildPicasso][carsOwned - 2]?.(ENV);
  const c = addCar('mine', MINE_COLORS[(carsOwned - 1) % MINE_COLORS.length], pick(['hatch', 'mini', 'mpv']), m);
  Object.assign(c, { x: GARAGE_X, z: parkZ(c, -1), ang: 0, broken: Math.random() < 0.35 }); // some won't start: Stéphane comes
  if (m?.exhaust) Object.assign(c, { exhaust: m.exhaust, smoky: true, smokeT: 0 });
  puff(c.x, c.z, 10, '#fff3c4');
  floatText('New car delivered!', c.x, 3.4, c.z, '#ffd166');
  toast('Your new car is waiting in front of your garage — go and park it');
  SFX.buy();
  pushOut(player);
}
const TRUCK_PRICE = 5000;
let truckOwned = false;
function buyTruck() {
  if (truckOwned) return toast('You already own the truck');
  if (score < TRUCK_PRICE) return toast(`The truck costs ${TRUCK_PRICE} credits`);
  // delivered across two adjacent free bays (same group), nearest the player
  const from = driving || player, free = s => s && !s.ai && (!s.block || s.block === player);
  let best = null, bd = Infinity;
  for (const s of slots) {
    const x = s.x + SLOT_LEN / 2, d = Math.hypot(x - from.x, s.z - from.z);
    if (d < bd && free(s) && free(slots.find(q => q.side === s.side && Math.abs(q.x - s.x - SLOT_LEN) < 0.1))) { bd = d; best = s; }
  }
  if (!best) return toast('The truck needs two free spots in a row');
  score -= TRUCK_PRICE; truckOwned = true;
  const m = buildTruck(ENV), c = addCar('mine', null, null, m);
  Object.assign(c, { x: best.x + SLOT_LEN / 2, z: parkZ(c, best.side), ang: 0, truck: true, exhaust: m.exhaust,
    acc: 3.5, top: 9, turn: 0.3, pivot: 2.8, smokeT: 0, rumbleT: 0, markY: 4.6 });
  c.marker.scale.setScalar(1.4);
  puff(c.x, c.z, 14, '#fff3c4');
  floatText('Truck delivered!', c.x, 5, c.z, '#ffd166');
  SFX.buy();
  pushOut(player);
}

const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyZ: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyQ: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'brake' };
addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.repeat || !started) return;
  if (e.code === 'KeyP') { paused = !paused; $('paused').classList.toggle('hidden', !paused); }
  if (paused) return;
  if (e.code === 'KeyE') actionE();
  if (e.code === 'KeyB') actionB();
  if (e.code === 'KeyM') { muted = !muted; toast(muted ? 'Sound off' : 'Sound on'); }
  if (e.code === 'Digit1' || e.code === 'Numpad1') buyCar();
  if (e.code === 'Digit2' || e.code === 'Numpad2') buyTruck();
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
$('buyCar').onclick = e => { buyCar(); e.currentTarget.blur(); };
$('buyTruck').onclick = e => { buyTruck(); e.currentTarget.blur(); };

// ───────────────────────── per-frame bookkeeping
function computeBlocks() {
  for (const s of slots) {
    s.block = null;
    for (const c of cars) if (c.blocker && covers(c, s)) s.block = c;
    for (const b of bins) if (b.slot === s) s.block = b;
    if (!driving && !s.block && inSlot(player, s)) s.block = player;
    // a blocker cancels a reservation, even mid-manoeuvre: the car rejoins traffic instead of parking through it
    if (s.block && (s.ai?.state === 'drive' || s.ai?.state === 'park')) { s.ai.state = 'drive'; s.ai.slot = null; s.ai = null; }
  }
}
const SLOT_COLORS = { foreign: '#ef476f', neighbour: '#2ec4b6', mine: '#f4a261', incoming: '#ffb703' };
function paintSlots() {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5);
  for (const s of slots) {
    const ai = s.ai && s.ai.state !== 'drive' ? s.ai.kind : null;
    const kind = ai || (s.block && s.block !== player ? 'mine' : s.ai?.kind === 'foreign' ? 'incoming' : null);
    s.ov.material.color.set(kind ? SLOT_COLORS[kind] : '#ffffff');
    s.ov.material.opacity = kind === 'foreign' || kind === 'incoming' ? 0.25 + 0.2 * pulse : kind ? 0.3 : 0.07 + 0.08 * pulse;
    s.el.style.background = kind ? SLOT_COLORS[kind] : 'rgba(255,255,255,.18)';
    s.el.style.opacity = kind === 'incoming' ? 0.5 + 0.5 * pulse : 1;
  }
}
function scoring(dt) {
  foreignN = slots.filter(s => s.ai?.kind === 'foreign' && (s.ai.state === 'park' || s.ai.state === 'parked')).length;
  const safe = slots.length - foreignN;
  if (foreignN === 0) { streak += dt; mult = 3 + Math.min(1.5, Math.floor(streak / 15) * 0.25); }
  else { streak = 0; mult = 1; }
  rate = (1 + 0.3 * safe) * mult;
  score += rate * dt;
  if (score > best) { best = score; }
}
let hudT = 0, wasProtected = false, trafficLevel = 0;
function hud(dt) {
  if ((hudT -= dt) > 0) return;
  hudT = 0.1;
  $('score').textContent = Math.floor(score);
  $('rate').textContent = `+${rate.toFixed(1)} /s`;
  $('foreign').textContent = foreignN;
  $('neigh').textContent = cars.filter(c => c.kind === 'neighbour' && c.state === 'parked').length;
  $('held').textContent = slots.filter(s => s.block && s.block !== player).length;
  $('banner').classList.toggle('on', foreignN === 0);
  $('bmult').textContent = `×${+mult.toFixed(2)}`;
  if (foreignN === 0 && !wasProtected) toast('No strangers left — credits ×3!');
  wasProtected = foreignN === 0;
  $('carPrice').textContent = carPrice();
  $('buyCar').disabled = score < carPrice();
  $('truckPrice').textContent = truckOwned ? 'Owned' : TRUCK_PRICE;
  $('buyTruck').disabled = truckOwned || score < TRUCK_PRICE;
  $('inv').textContent = (binsInHand ? '🗑️ Bin in hand · B to put it down' : `${carsOwned} car${carsOwned > 1 ? 's' : ''}${truckOwned ? ' · 1 truck' : ''} owned`)
    + (boostT > 0 ? ' · 🥖 fast!' : '') + (slowT > 0 ? ' · 💨 slowed' : '');
  const tr = traffic(), tl = tr < 0.3 ? 0 : tr < 0.7 ? 1 : 2;
  if (tl !== trafficLevel) { if (tl === 2) toast('Rush hour! Cars everywhere'); else if (tl === 0 && trafficLevel > 0) toast('Traffic is calming down'); trafficLevel = tl; }
  $('traffic').textContent = ['calm', 'busy', 'rush hour'][tl];
  $('trafficDot').style.background = ['#06d6a0', '#ffd166', '#ef476f'][tl];
  let p = '';
  const mine = !driving && nearestMine();
  if (driving) { // count what the E-snap will actually block
    const n = slots.filter(s => covers({ ...driving, ...tidy(driving) }, s)).length;
    p = n ? `E — leave the ${driving.truck ? 'truck' : 'car'} here (${n} spot${n > 1 ? 's' : ''} blocked)` : 'E — get out (it goes back to its spot)';
  }
  else if (binsInHand) p = Math.abs(binsInHand.z) > CURB_Z ? 'B — leave the bin on the sidewalk' : binSlot() ? 'B — block this spot with the bin' : 'Push the bin into a free spot or onto the sidewalk';
  else if (mine) p = `E — drive ${mine.truck ? 'the truck' : 'this car'}`;
  else if (nearBin()) p = 'B — pick up bin';
  $('prompt').textContent = started ? p : '';
  try { if (Math.floor(best) > (+localStorage.getItem('parkingGuardBest') || 0)) localStorage.setItem('parkingGuardBest', Math.floor(best)); } catch {}
}
function sync(dt) {
  for (const c of cars) {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.ang;
    c.body.position.y = Math.abs(c.speed) > 0.3 ? Math.sin(elapsed * 17 + c.id) * 0.02 : 0;
    c.marker.visible = c.kind !== 'foreign' || c.state === 'park' || c.state === 'parked';
    c.marker.position.y = c.markY + Math.sin(elapsed * 3 + c.id) * 0.12;
  }
  person.g.position.set(player.x, 0, player.z);
  belly = Math.max(0, belly - dt * 2.5);
  person.g.scale.set(1.3 * (1 + 0.07 * belly * Math.sin(elapsed * 40)), 1.3, 1.3); // belly wobble after a boing
  let da = player.ang - person.g.rotation.y;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  person.g.rotation.y += da * Math.min(1, dt * 12);
  player.phase += player.moving ? dt * 11 : 0;
  const sw = player.moving ? Math.sin(player.phase) * 0.6 : 0;
  person.legs[0].rotation.z = sw; person.legs[1].rotation.z = -sw;
  person.arms[0].rotation.z = binsInHand ? ARMS_CARRY : -sw * 0.8; person.arms[1].rotation.z = binsInHand ? ARMS_CARRY : sw * 0.8;
  const who = driving || player;
  ring.position.x = who.x; ring.position.z = who.z;
  ring.scale.setScalar((driving ? 3 : 1) * (1 + Math.sin(elapsed * 4) * 0.06));
}

function update(dt) {
  elapsed += dt;
  if (driving) drive(driving, dt); else walk(dt);
  computeBlocks();
  for (const c of [...cars]) if (c.kind !== 'mine' && c.kind !== 'jack') updateAI(c, dt);
  spawner(dt);
  neighbours(dt);
  scoring(dt);
}

// ───────────────────────── neighbours on foot: Jack & the red-haired lady
import { buildRedhead, buildJack, buildWife, buildFather, buildMechanic } from './models.js';
const SW = 5.9, BIN_Z = WALL_Z - 0.6, CROSS_XS = [-49, -27, -11.4, 30], RED_GATE = GATES[1][0], JACK_GATE = GATES[-1][2], ARMS_CARRY = 1.2; // arms forward (+rotation.z swings a hanging arm toward +x)
const CD = Array.from({ length: 11 }, (_, i) => markerMat('#f77f00', g => { g.font = '900 70px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i, 64, 68); }));
MARK.jack = markerMat('#06d6a0', g => { g.beginPath(); g.moveTo(64, 98); g.bezierCurveTo(18, 66, 32, 22, 64, 46); g.bezierCurveTo(96, 22, 110, 66, 64, 98); g.fill(); });
const tolerance = () => rand(40, 70) * (1 - 0.45 * traffic());
function newBin(body, lid) {
  const mesh = buildBin(scene, body, lid), tag = new THREE.Sprite(MARK.mine);
  tag.position.y = 2.1; tag.scale.setScalar(0.8); tag.renderOrder = 5; tag.visible = false; mesh.add(tag);
  return { mesh, tag, x: 0, z: 0, slot: null, t: 0 };
}
function putBin(b, x, z, slot = null) {
  Object.assign(b, { x, z, slot, t: slot ? tolerance() : 0 });
  b.mesh.position.set(x, slot ? 0 : 0.15, z);
  b.mesh.rotation.y = slot ? rand(-0.3, 0.3) : -Math.sign(z) * Math.PI / 2 + rand(-0.2, 0.2);
  bins.push(b);
}
function carryBin(b, x, z, a) {
  b.x = x + Math.cos(a) * 0.95; b.z = clamp(z - Math.sin(a) * 0.95, 0.5 - WALL_Z, WALL_Z - 0.5);
  b.mesh.position.set(b.x, Math.abs(b.z) > CURB_Z ? 0.15 : 0, b.z); b.mesh.rotation.y = a; b.tag.visible = false;
}
// free sidewalk x near x on side s: clear of gates and of other sidewalk bins
function sidewalkSpot(x, s) {
  for (let k = 0; k < 25; k++) {
    const t = x + (k & 1 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
    if (Math.abs(t) < STREET_X - 1 && GATES[s].every(g => Math.abs(t - g) > 2.2) && bins.every(b => b.slot || Math.sign(b.z) !== s || Math.abs(b.x - t) > 1)) return t;
  }
  return null;
}
const walkers = [];
function walker(build) {
  const w = Object.assign(build(), { x: 0, z: 0, ang: 0, pts: [], then: null, carry: null, phase: 0 });
  w.g.visible = false; scene.add(w.g); walkers.push(w);
  return w;
}
const go = (w, pts, then) => { w.g.visible = true; w.pts = pts; w.then = then; };
// sidewalk waypoints from a to b, crossing the road at the crossing point nearest to the middle of the trip
function route(ax, az, bx, bz) {
  const sa = Math.sign(az), sb = Math.sign(bz), pts = [[ax, sa * SW]], m = (ax + bx) / 2;
  if (sa !== sb) { const cx = CROSS_XS.reduce((p, q) => Math.abs(q - m) < Math.abs(p - m) ? q : p); pts.push([cx, sa * SW], [cx, sb * SW]); }
  return [...pts, [bx, sb * SW], [bx, bz]];
}
function stepWalkers(dt) {
  for (const w of walkers) {
    if (!w.g.visible) continue;
    const p = w.pts[0], moving = !!p;
    if (p) {
      const dx = p[0] - w.x, dz = p[1] - w.z, d = Math.hypot(dx, dz), v = 3 * dt;
      if (d > 0.05) w.ang = Math.atan2(-dz, dx);
      if (d > v) { w.x += dx / d * v; w.z += dz / d * v; }
      else { w.x = p[0]; w.z = p[1]; w.pts.shift(); if (!w.pts.length) { const f = w.then; w.then = null; f?.(); } }
    }
    let da = w.ang - w.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    w.g.rotation.y += da * Math.min(1, dt * 10);
    w.phase += moving ? dt * 10 : 0;
    const sw = moving ? Math.sin(w.phase) * 0.6 : 0;
    w.legs[0].rotation.z = sw; w.legs[1].rotation.z = -sw;
    w.arms[0].rotation.z = w.carry ? ARMS_CARRY : -sw * 0.8; w.arms[1].rotation.z = w.carry ? ARMS_CARRY : sw * 0.8;
    w.g.position.set(w.x, 0, w.z);
    if (w.carry) carryBin(w.carry, w.x, w.z, w.g.rotation.y);
  }
}

// the red-haired lady: fetches the most overdue bin in a bay and wheels it back onto the sidewalk, one at a time
const red = walker(buildRedhead), RED_HOME = WALL_Z + 1.6;
const redGoHome = () => go(red, route(red.x, red.z, RED_GATE, RED_HOME), () => { red.g.visible = false; });
function redhead() {
  if (red.g.visible) return;
  const b = bins.filter(q => q.slot && q.t <= 0).sort((p, q) => p.t - q.t)[0];
  if (!b) return;
  const s = b.slot.side;
  Object.assign(red, { x: RED_GATE, z: RED_HOME, carry: null });
  go(red, [...route(RED_GATE, RED_HOME, b.x - 1.9, s * SW), [b.x - 1, b.z]], () => {
    if (!bins.includes(b) || !b.slot || b.t > 0) { floatText('Hmpf !', red.x, 2.6, red.z, '#ffb4a2'); return redGoHome(); }
    bins.splice(bins.indexOf(b), 1); b.slot = null; red.carry = b; // the bay is free again right now
    red.ang = red.g.rotation.y = Math.atan2(-(b.z - red.z), b.x - red.x);
    floatText(pick(['Ces poubelles !', 'Pas sur la place !', 'Oh là là…']), red.x, 2.8, red.z, '#ffb4a2');
    if (nearPlayer(red.x, red.z, 20)) { const w = driving || player; floatText('Pta***, Sal**pe de Valérie', w.x, 3.6, w.z, '#ff8fa3'); }
    const sx = sidewalkSpot(b.x + 2, s) ?? b.x + 2;
    go(red, [[sx - 0.95, s * SW]], () => {
      red.carry = null;
      putBin(b, sidewalkSpot(b.x, s) ?? b.x, s * BIN_Z);
      puff(b.x, b.z, 4, '#e9e9e9');
      redGoHome();
    });
  });
}

// Jack: old beige hatch in his driveway; drives out (one-way, lane clear), parks across two free bays for Erika, walks home, later leaves
const jw = walker(buildJack), J = addCar('jack', '#c9b48a', 'hatch');
const jackHome = () => Object.assign(J, { x: JACK_GATE, z: -WALL_Z - 2.6, ang: -Math.PI / 2, state: 'parked', speed: 0, blocker: false, phase: 'home', wait: rand(60, 100), goal: null, leaving: false });
jackHome(); Object.assign(J, { name: 'Jack', wait: 22 });
const bayFree = s => !s.ai && !s.block;
const laneFree = (x, back, fwd, me = J) => !cars.some(o => o !== me && o.state !== 'away' && o.state !== 'parked' && Math.abs(o.z) < 2.2 && o.x > x - back && o.x < x + fwd);
function jackGoal() { // nearest reachable pair of adjacent free bays (straddle the line), else a single free bay
  let best = null, bs = Infinity;
  for (const a of slots) {
    if (!bayFree(a)) continue;
    const b = slots.find(q => q.side === a.side && Math.abs(q.x - a.x - SLOT_LEN) < 0.1 && bayFree(q));
    const x = b ? (a.x + b.x) / 2 : a.x, sc = x - J.x + (b ? 0 : 1000);
    if (x - J.x >= 10 && sc < bs) { bs = sc; best = { x, z: a.z, side: a.side, bays: b ? [a, b] : [a] }; }
  }
  return best;
}
function jack(dt) {
  switch (J.phase) {
    case 'home': case 'visit': case 'gone': case 'round':
      if ((J.wait -= dt) > 0) return;
      if (J.phase === 'home') {
        J.phase = 'walk'; Object.assign(jw, { x: JACK_GATE - 1.3, z: -WALL_Z - 5 });
        go(jw, [[JACK_GATE - 1.3, -WALL_Z - 3]], () => { jw.g.visible = false; J.phase = 'wait'; if (nearPlayer(J.x, J.z)) SFX.door(); });
      } else if (J.phase === 'visit') {
        J.phase = 'walk'; Object.assign(jw, { x: JACK_GATE, z: -WALL_Z - 1.6 });
        go(jw, route(JACK_GATE, -WALL_Z - 1.6, J.x - 0.6, J.goal.side * 5.3), () => { jw.g.visible = false; J.phase = 'unpark'; if (nearPlayer(J.x, J.z)) SFX.door(); });
      } else if (J.phase === 'gone') { jackHome(); J.mesh.visible = true; }
      else if (enterStreet(J)) J.phase = 'drive';
      return;
    case 'wait':
      if (!laneFree(JACK_GATE, 28, 8)) return;
      Object.assign(J, { path: [[JACK_GATE, J.z], [JACK_GATE, -2.5], [JACK_GATE + 2, 0], [JACK_GATE + 6, 0]], dur: 3.2, t: 0, state: 'out', phase: 'out' });
      return;
    case 'unpark':
      if (!laneFree(J.x, 16, 11)) return;
      Object.assign(J, { path: [[J.x, J.z], [J.x + 3, J.z], [J.x + 6, 0], [J.x + 9, 0]], dur: 3, t: 0, state: 'leave', phase: 'leave', blocker: false });
      puff(J.x - J.len / 2, J.z, 5, '#bdbdbd');
      return;
    case 'out': case 'leave':
      if (followPath(J, dt, t => t * t * (3 - 2 * t))) Object.assign(J, { state: 'drive', phase: 'drive', leaving: J.phase === 'leave', goal: null });
      return;
    case 'park': {
      if (!followPath(J, dt, t => 1 - (1 - t) ** 2)) return;
      const g = J.goal;
      Object.assign(J, { state: 'parked', phase: 'walk', x: g.x, z: g.z, ang: 0, speed: 0, blocker: true });
      puff(J.x - J.len / 2, J.z, 4, '#cfcfcf'); SFX.block();
      Object.assign(jw, { x: J.x - 0.6, z: g.side * 5.3 });
      floatText('Jack : Je te garde la place, Erika !', J.x, 3.4, J.z, '#b8f28a');
      go(jw, route(jw.x, jw.z, JACK_GATE, -WALL_Z - 1.6), () => { jw.g.visible = false; J.phase = 'visit'; J.wait = rand(60, 90); });
      return;
    }
    case 'drive': {
      if (!J.leaving && !(J.goal && J.goal.x - J.x > 3 && J.goal.bays.every(bayFree))) J.goal = jackGoal();
      const [gap] = obstacleAhead(J), g = J.goal;
      let v = gap < 0 ? 0 : Math.min(J.cruise, gap * 1.6);
      if (g) {
        const rem = g.x - J.x;
        v = Math.min(v, 2.5 + rem * 0.35);
        if (rem <= 9 && gap > 1) {
          Object.assign(J, { path: [[J.x, J.z], [J.x + 3, 0], [g.x - 3, g.z], [g.x, g.z]], dur: clamp(2 * rem / Math.max(J.speed, 2), 2, 4.5), t: 0, state: 'park', phase: 'park' });
          return;
        }
      }
      J.speed += clamp(v - J.speed, -14 * dt, 5 * dt);
      J.x += J.speed * dt; J.z -= J.z * Math.min(1, dt * 3); J.ang = 0;
      if (J.x > END_X) Object.assign(J, { state: 'away', phase: J.leaving ? 'gone' : 'round', wait: J.leaving ? rand(10, 25) : 4 }).mesh.visible = false;
    }
  }
}

// Erika's wife: now and then borrows one of his cars (never the truck) for a drive, then leaves it in front of the garage
const ww = walker(buildWife), W = { car: null, phase: 'home', wait: rand(120, 180), back: false }, WIFE_HOME = -WALL_Z - 1.6;
function wife(dt) {
  const c = W.car;
  switch (W.phase) {
    case 'home': case 'away': {
      if ((W.wait -= dt) > 0) return;
      if (W.phase === 'away') { W.back = true; if (enterStreet(c)) W.phase = 'drive'; else W.wait = 1; return; }
      const free = cars.filter(o => o.kind === 'mine' && !o.truck && !o.broken && o !== driving);
      if (!free.length) { W.wait = 10; return; }
      const k = W.car = pick(free); k.taken = true;
      Object.assign(W, { phase: 'walk', back: false }); Object.assign(ww, { x: GARAGE_X, z: WIFE_HOME });
      go(ww, route(GARAGE_X, WIFE_HOME, k.x - 0.6, Math.sign(k.z) * 5.3), () => {
        ww.g.visible = false; W.phase = 'unpark';
        floatText('Je prends la voiture, chéri !', k.x, 3.4, k.z, '#f1c0e8'); if (nearPlayer(k.x, k.z)) SFX.door();
      });
      return;
    }
    case 'unpark':
      if (!laneFree(c.x, 16, 11, c)) return;
      startLeave(c); c.blocker = false; W.phase = 'out';
      return;
    case 'out':
      if (followPath(c, dt, t => t * t)) { c.state = 'drive'; W.phase = 'drive'; }
      return;
    case 'park':
      if (!followPath(c, dt, t => 1 - (1 - t) ** 2)) return;
      Object.assign(c, { state: 'mine', x: GARAGE_X, z: parkZ(c, -1), ang: 0, speed: 0, blocker: true, taken: false });
      puff(c.x - c.len / 2, c.z, 4, '#cfcfcf'); floatText('Je suis rentrée !', c.x, 3.4, c.z, '#f1c0e8');
      W.car = null; W.phase = 'walk'; Object.assign(ww, { x: c.x - 0.6, z: -5.3 });
      go(ww, route(ww.x, ww.z, GARAGE_X, WIFE_HOME), () => { ww.g.visible = false; W.phase = 'home'; W.wait = rand(180, 240); });
      return;
    case 'drive': {
      const [gap] = obstacleAhead(c), rem = W.back && !garageBusy(c) ? GARAGE_X - c.x : -1;
      let v = gap < 0 ? 0 : Math.min(c.cruise, gap * 1.6);
      if (rem > 3) {
        v = Math.min(v, 2.5 + rem * 0.35);
        if (rem <= 9 && gap > 1) {
          const z = parkZ(c, -1);
          Object.assign(c, { path: [[c.x, c.z], [c.x + 3, 0], [GARAGE_X - 3, z], [GARAGE_X, z]], dur: clamp(2 * rem / Math.max(c.speed, 2), 2, 4.5), t: 0, state: 'park' });
          W.phase = 'park';
          return;
        }
      }
      c.speed += clamp(v - c.speed, -14 * dt, 5 * dt);
      c.x += c.speed * dt; c.z -= c.z * Math.min(1, dt * 3); c.ang = 0;
      if (c.x > END_X) { c.state = 'away'; c.mesh.visible = false; W.phase = 'away'; W.wait = W.back ? 4 : rand(25, 50); } // garage blocked: another lap
    }
  }
}

// little events: a baguette on the sidewalk (speed boost), « le père » (Valérie's husband, opposite) coming out to fart next to Erika (slowdown)
const baguette = new THREE.Group(), BAG = { t: rand(20, 35), life: 0 };
mesh(baguette, new THREE.CapsuleGeometry(0.1, 0.8, 4, 8), '#d99a4e').rotation.z = Math.PI / 2;
for (const x of [-0.26, 0, 0.26]) box(baguette, 0.08, 0.02, 0.15, '#f3dfb3', x, 0.09, 0).rotation.y = 0.6;
baguette.scale.setScalar(1.4); baguette.visible = false; scene.add(baguette);
const pa = walker(buildFather), PA = { t: rand(50, 80), phase: 'home', give: 0, reroute: 0, smokeT: 0 }, PA_HOME = [RED_GATE + 1.2, RED_HOME], TIP = new THREE.Vector3(); // « le père », Valérie's husband
const paGoHome = () => { PA.phase = 'back'; go(pa, route(pa.x, pa.z, ...PA_HOME), () => { pa.g.visible = false; PA.phase = 'home'; PA.t = rand(60, 100); }); };
function events(dt) {
  boostT -= dt; slowT -= dt; chatT -= dt;
  if (pa.g.visible && (PA.smokeT -= dt) <= 0) { PA.smokeT = 0.3; smokePuff(pa.tip.getWorldPosition(TIP), true); }
  mechanic(dt);
  const b = baguette.position;
  if (baguette.visible) {
    baguette.rotation.y += dt * 2; b.y = 0.6 + Math.sin(elapsed * 4) * 0.12;
    if (!driving && Math.hypot(player.x - b.x, player.z - b.z) < 1.2) {
      baguette.visible = false; boostT = 8; BAG.t = rand(25, 45); SFX.buy();
      floatText('Baguette ! Erika file !', player.x, 3.4, player.z, '#ffd166');
    } else if ((BAG.life -= dt) <= 0) { baguette.visible = false; BAG.t = rand(25, 45); }
  } else if ((BAG.t -= dt) <= 0) {
    const s = pick([-1, 1]), x = sidewalkSpot(rand(-45, 45), s);
    if (x === null) BAG.t = 2;
    else { b.set(x, 0.6, s * (CURB_Z + WALL_Z) / 2); baguette.visible = true; BAG.life = 30; puff(b.x, b.z, 4, '#fff3c4'); }
  }
  if (PA.phase === 'home') {
    if ((PA.t -= dt) > 0 || driving) return;
    [pa.x, pa.z] = PA_HOME; Object.assign(PA, { phase: 'chase', give: 45, reroute: 0 });
  } else if (PA.phase === 'chase') {
    if ((PA.give -= dt) <= 0 || driving) { floatText('Bon…', pa.x, 2.8, pa.z, '#c7e8a0'); return paGoHome(); }
    if (Math.hypot(player.x - pa.x, player.z - pa.z) < 1.3) {
      slowT = 6; SFX.fart(); puff(pa.x, pa.z, 12, '#9ccf5a');
      floatText('Prrrrout !', pa.x, 2.8, pa.z, '#9ccf5a'); floatText('Oh non, le père !', player.x, 3.8, player.z, '#ffd166');
      return paGoHome();
    }
    const close = Math.hypot(player.x - pa.x, player.z - pa.z) < 10;
    if ((PA.reroute -= dt) <= 0 && (close || !pa.pts.length)) { // straight at her when close, else a full sidewalk route (re-planning mid-crossing would turn him back)
      PA.reroute = 0.8;
      go(pa, close ? [[player.x, player.z]] : route(pa.x, pa.z, player.x, player.z));
    }
  }
}

// Stéphane the mechanic: some deliveries won't start; he walks in from Rue du Centre, fixes the car and leaves
const mech = walker(buildMechanic), ST = { car: null, fixT: 0, clank: 0, queue: [] }, ST_FROM = [-51, -SW];
function callMechanic(c) {
  if (ST.car) { if (ST.car !== c && !ST.queue.includes(c)) ST.queue.push(c); return; }
  ST.car = c; [mech.x, mech.z] = ST_FROM;
  go(mech, route(mech.x, mech.z, c.x + 0.8, (Math.sign(c.z) || -1) * 5.3), () => {
    mech.ang = Math.atan2(-(c.z - mech.z), c.x - mech.x); ST.fixT = 6;
    floatText('Stéphane : Bouge pas, je regarde ça !', mech.x, 3, mech.z, '#9ad0ff');
  });
}
function mechanic(dt) {
  if (ST.fixT <= 0) return;
  const c = ST.car;
  if ((ST.clank -= dt) <= 0) { ST.clank = 1.4; floatText(pick(['Clang !', 'Tac tac…', 'Bzzz…', 'Clonk !']), c.x, 2.4, c.z, '#cfd8e3'); puff(c.x + c.len / 2, c.z, 2, '#bdbdbd'); }
  if ((ST.fixT -= dt) > 0) return;
  c.broken = false; SFX.free();
  floatText(`C'est réparé, ${c.name ?? 'Erika'} !`, mech.x, 3, mech.z, '#9ad0ff');
  go(mech, route(mech.x, mech.z, ...ST_FROM), () => { mech.g.visible = false; ST.car = null; const n = ST.queue.shift(); if (n?.broken) callMechanic(n); });
}

function neighbours(dt) {
  for (const b of bins) {
    b.tag.visible = !!b.slot;
    if (b.slot) { b.t -= dt; b.tag.material = b.t <= 0 ? MARK.foreign : b.t <= 10 ? CD[Math.ceil(b.t)] : MARK.mine; }
  }
  if (binsInHand) carryBin(binsInHand, player.x, player.z, person.g.rotation.y);
  redhead(); jack(dt); wife(dt); events(dt); stepWalkers(dt);
}
// self-check: grab a sidewalk bin, block a bay, let the lady take it back, then run one Jack visit. Returns 'ok' or throws.
function selfTestNeighbours() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestNeighbours: ' + m); };
  const until = (sec, f) => { for (let t = 0; t < sec && !f(); t += 0.5) window.__game.step(0.5); return f(); };
  ok(!driving, 'be on foot');
  if (binsInHand) actionB();
  const b = bins.find(q => !q.slot);
  Object.assign(player, { x: b.x, z: Math.sign(b.z) * SW }); actionB();
  ok(binsInHand === b && !bins.includes(b), 'pick up a sidewalk bin');
  const s = slots.find(q => bayFree(q) && !cars.some(c => c.state !== 'away' && Math.hypot(c.x - q.x, c.z - q.z) < 5));
  ok(s, 'a free bay');
  Object.assign(player, { x: s.x - 0.9, z: s.z, ang: 0 }); person.g.rotation.y = 0; window.__game.step(0.1); actionB();
  window.__game.step(0.1);
  ok(b.slot === s && s.block === b, 'bin blocks the bay');
  player.x = s.x - 8; b.t = 0.01;
  ok(until(90, () => red.carry === b), 'redhead grabs the bin'); window.__game.step(0.1);
  ok(s.block !== b, 'bay freed on grab');
  ok(until(60, () => bins.includes(b) && !b.slot && Math.abs(b.z) > CURB_Z), 'bin back on the sidewalk');
  ok(until(90, () => !red.g.visible), 'redhead home');
  if (['home', 'gone', 'round'].includes(J.phase)) J.wait = 0;
  ok(until(150, () => J.blocker && J.state === 'parked'), 'jack parks');
  ok(J.goal.bays[0].block === J, 'jack blocks a bay');
  ok(until(60, () => J.phase === 'visit'), 'jack walks home'); J.wait = 0;
  ok(until(90, () => J.leaving && !J.mesh.visible), 'jack drives off');
  return 'ok';
}
// self-check: the wife takes a car (its bay frees up), drives off, comes back and leaves it in front of the garage. Returns 'ok' or throws.
function selfTestWife() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestWife: ' + m); };
  const until = (sec, f) => { for (let t = 0; t < sec && !f(); t += 0.5) window.__game.step(0.5); return f(); };
  if (driving) { driving.speed = 0; actionE(); }
  ok(W.phase === 'home', 'wife at home'); W.wait = 0;
  ok(until(90, () => W.phase === 'away'), 'wife drives off');
  const c = W.car;
  ok(!slots.some(s => s.block === c) && c.taken, 'her car holds no bay and is not drivable');
  W.wait = 0;
  ok(until(90, () => !c.taken), 'wife comes back');
  ok(c.x === GARAGE_X && c.state === 'mine' && c.blocker, 'car left in front of the garage');
  return 'ok';
}
// self-check: no walking through the middle of an SUV, baguette boost, father's fart, a driver stopping to chat, the neighbour fine. Returns 'ok' or throws.
function selfTestEvents() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestEvents: ' + m); };
  const until = (sec, f) => { for (let t = 0; t < sec && !f(); t += 0.1) window.__game.step(0.1); return f(); };
  if (driving) { driving.speed = 0; actionE(); }
  const v = addCar('foreign', '#888', 'suv'), q = { x: 40, z: 0.6 };
  Object.assign(v, { x: 40, z: 0, ang: 0 });
  ok(pedPush(q, v) && Math.abs(q.z - (v.r + P_R)) < 1e-9, 'no gap in the middle of an SUV');
  scene.remove(v.mesh); cars.splice(cars.indexOf(v), 1);
  BAG.t = 0; window.__game.step(0.1); ok(baguette.visible, 'baguette appears');
  Object.assign(player, { x: baguette.position.x, z: baguette.position.z }); window.__game.step(0.1);
  ok(boostT > 0 && !baguette.visible, 'baguette picked up: speed boost');
  PA.t = 0; ok(until(60, () => slowT > 0), 'father farts next to Erika: slowdown');
  Object.assign(player, { x: -40, z: -5.3 }); chatT = 0;
  ok(until(120, () => cars.some(c => c.chat > 0)), 'a driver stops to chat');
  const n = cars.find(c => c.kind === 'neighbour');
  if (n.slot) n.slot.ai = null;
  Object.assign(n, { state: 'drive', x: END_X - 0.01, z: 0, speed: 5, wantsSlot: true, slot: null, chat: 0 }); n.mesh.visible = true;
  score = 1000; window.__game.step(0.1);
  ok(score < 1000 - NEIGHBOUR_FINE + 5 && n.state === 'away', 'neighbour who found no spot is fined');
  return 'ok';
}
// self-check: a delivered car that won't start gets fixed by Stéphane; Clément's Polo breaks down each time he parks. Returns 'ok' or throws.
function selfTestMechanic() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestMechanic: ' + m); };
  const until = (sec, f) => { for (let t = 0; t < sec && !f(); t += 0.2) window.__game.step(0.2); return f(); };
  if (driving) { driving.speed = 0; actionE(); }
  W.wait = PA.t = chatT = BAG.t = 1e9; score = 1e5;
  buyCar(); const c = cars.at(-1); c.broken = true;
  Object.assign(player, { x: c.x, z: c.z - 1.5 }); actionE();
  ok(!driving && ST.car === c, "a broken car won't start: Stéphane is called");
  ok(until(60, () => !c.broken), 'Stéphane fixes it');
  actionE(); ok(driving === c, 'fixed car starts'); c.speed = 0; actionE();
  const cl = cars.find(o => o.name === 'Clément'), q = slots.find(s => !s.ai && !s.block && Math.abs(s.x) < 40 && s.side === 1);
  if (cl.slot) { cl.slot.ai = null; cl.slot = null; }
  Object.assign(player, { x: 40, z: -6 });
  Object.assign(cl, { x: q.x - 8, z: 0, speed: 4, slot: q, state: 'drive', timer: 0 }); cl.mesh.visible = true; q.ai = cl; startPark(cl);
  ok(until(10, () => cl.state === 'parked') && cl.broken, "Clément's car is broken when he parks");
  ok(until(120, () => !cl.broken), "Stéphane fixes Clément's car");
  return 'ok';
}
queueMicrotask(() => Object.assign(window.__game, { selfTestMechanic, jack: J, jw, red, W, PA, pa, mech, walkers, held: () => binsInHand, selfTestNeighbours, selfTestWife, selfTestEvents })); // after __game exists

// ───────────────────────── setup
function setup() {
  const start = slots.find(s => s.side === -1 && s.x === -30.2);
  const mine = addCar('mine', MINE_COLORS[0], 'hatch');
  Object.assign(mine, { x: start.x, z: start.z, ang: parkedAng(start) });
  player.x = start.x + 1.2; player.z = -6.2;
  computeBlocks();
  const freeSlot = () => pick(slots.filter(s => !s.ai && !s.block));
  NEIGHBOURS.forEach((n, i) => {
    const c = addCar('neighbour', n.color, n.type, n.model?.(ENV));
    Object.assign(c, { name: n.name, home: n.home ?? rand(-25, 25), dented: n.dented });
    if (i < 3) placeParked(c, freeSlot(), rand(30, 120));
    else { c.state = 'away'; c.timer = rand(30, 150); c.mesh.visible = false; }
  });
  for (const s of [1, -1]) for (const g of GATES[s]) for (const dx of Math.random() < 0.25 ? [2.4, 3.5] : [2.4])
    putBin(newBin('#4b4f55', pick(['#7a2b35', '#3d5a44', '#e0c53a'])), g + dx, s * BIN_Z);
  for (let i = 0; i < 2; i++) placeParked(addCar('foreign', pick(AI_COLORS), pick(['hatch', 'mpv', 'suv', 'mini'])), freeSlot(), rand(20, 90));
  camTarget.set(player.x, 0, player.z);
  scoring(0); // initialise HUD counters before the first tick
}
setup();
$('best').textContent = best ? `Best score: ${Math.floor(best)}` : '';
$('start').onclick = () => { started = true; try { actx = new AudioContext(); } catch {} $('title').classList.add('hidden'); toast('Walk to your yellow car and press E'); };

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (started && !paused) update(dt);
  if (!paused) { sync(dt); updateFx(dt); updateWorld(dt); paintSlots(); }
  hud(dt);
  const who = driving || player;
  camTarget.lerp(new THREE.Vector3(who.x, 0, who.z), 1 - Math.exp(-4 * dt));
  camera.position.copy(camTarget).add(CAM_OFF);
  camera.lookAt(camTarget);
  sun.position.copy(camTarget).add(SUN_OFF);
  sun.target.position.copy(camTarget);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// debug/test hook: __game.step(seconds) runs the simulation without rendering
window.__game = { cars, slots, bins, player, keys, actionE, actionB, buyCar, start: () => $('start').click(), get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; },
  get score() { return score; }, set score(v) { score = v; }, get driving() { return driving; }, get rate() { return rate; }, get binsInHand() { return binsInHand; },
  zoom(v) { viewH = v; resize(); }, cam: { CAM_OFF, camTarget }, // screenshots: pause (P), then aim/tilt via CAM_OFF + player.x/z
  step(sec, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { update(dt); sync(dt); updateFx(dt); } } };
// vehicles: selfTest() checks the straddle rule (a car on a bay line blocks 2, the truck 2 or 3) and the E-snap targets
Object.assign(window.__game, { buyTruck, circles, smoke, selfTest() {
  const s = slots.find(q => q.side === -1 && q.x === -41), n = (dx, len = 4, dz = 0) => slots.filter(q => covers({ x: s.x + dx, z: s.z + dz, len }, q)).length;
  const got = [n(0), n(SLOT_LEN / 2), n(1.5), n(2), n(0, 4, -s.z), n(SLOT_LEN / 2, 9.6), n(SLOT_LEN, 9.6), n(SLOT_LEN + 1.5, 9.6)].join();
  if (got !== '1,2,1,2,0,2,3,2') throw new Error(`straddle rule: ${got}`);
  if (Math.abs(snapX(-1, -39.1) + 38.3) > 1e-9 || snapX(-1, -40) !== -41) throw new Error('E-snap targets');
  return 'ok';
} });
// Erika's rules: BMW coughs at start-up, a car left on the road goes home, road hogs get shoved aside,
// the truck evicts parked cars, a car pulling in bounces off her belly. Returns 'ok' or throws.
Object.assign(window.__game, { selfTestRules() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestRules: ' + m); };
  const until = (sec, f) => { for (let t = 0; t < sec && !f(); t += 0.1) window.__game.step(0.1); return f(); };
  const getIn = c => { Object.assign(player, { x: c.x, z: c.z - Math.sign(c.z) * (c.r + 0.5) }); actionE(); ok(driving === c, 'get in'); };
  if (driving) { driving.speed = 0; actionE(); }
  score = 1e5;
  W.wait = PA.t = chatT = BAG.t = 1e9; // no random events in the way
  buyCar(); const bmw = cars.at(-1);
  ok(bmw.x === GARAGE_X && !slots.some(s => covers(bmw, s)), 'new car waits in front of the garage');
  buyCar(); ok(cars.at(-1) === bmw, 'no second delivery while the garage spot is taken');
  getIn(bmw); window.__game.step(0.5);
  ok(smoke.some(s => s.m.visible), 'BMW smokes at start-up');
  const home = { x: bmw.x, z: bmw.z };
  bmw.z = 0.3; actionE();
  ok(!driving && Math.hypot(bmw.x - home.x, bmw.z - home.z) < 1e-6, 'car left on the road goes home');
  bmw.x = -60; buyCar(); const spring = cars.at(-1);
  ok(bmw.smoky && spring.len === 3.73 && !spring.exhaust, 'BMW then Dacia Spring');
  spring.x = -66;
  Object.assign(player, { x: -20, z: 0 });
  ok(until(150, () => cars.some(c => c.stuckT > PATIENCE)), 'traffic waits behind Erika');
  ok(until(3, () => Math.abs(player.z) > 1.9), 'Erika shoved aside');
  for (const c of cars.filter(c => c.kind === 'foreign')) leaveStreet(c); // clear the street
  buyTruck(); const tr = cars.at(-1), f = addCar('foreign', '#888', 'hatch');
  const s = slots.find(s => !s.ai && !s.block && carPen(tr, s.x - (tr.len + f.len) / 2 - 0.1, parkZ(tr, s.side), 0) === 0);
  placeParked(f, s, 999); Object.assign(tr, { x: s.x - (tr.len + f.len) / 2 - 0.1, z: parkZ(tr, s.side), ang: 0 });
  getIn(tr); keys.up = true;
  ok(until(6, () => f.state === 'leave'), 'truck shoves a parked car out'); keys.up = false;
  tr.speed = 0; actionE(); ok(!driving, 'out of the truck');
  const p = addCar('foreign', '#888', 'hatch'), q = slots.find(s => !s.ai && !s.block && Math.abs(s.x) < 40);
  Object.assign(p, { x: q.x - 8, z: 0, speed: 4, slot: q, state: 'drive' }); q.ai = p; startPark(p);
  Object.assign(player, { x: bez(p.path, 0.3, 0), z: bez(p.path, 0.3, 1) });
  ok(until(5, () => p.state === 'drive') && p.slot !== q && belly > 0, 'parking car bounces off her belly'); // gives up the bay (may reserve another)
  return 'ok';
} });
