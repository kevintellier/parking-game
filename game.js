import * as THREE from 'three';
import { buildTruck, buildBMW, buildSpring, buildPicasso, buildZ4, buildPolo, buildF430, buildSeat } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildErika } from './models.js';
import * as bugnotHouse from './houses/bugnot.js';
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
const nb = t => t.replace(/ ([!?;»])/g, '\u202f$1').replace(/« /g, '«\u202f').replace(/ :/g, '\u00a0:'); // French typography: no line break before ! ? ; : »
const fr = (v, d = 0) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }); // 12 345,6

// ───────────────────────── street layout (street runs along X, sides are z>0 (s=1) and z<0 (s=-1))
// one-way street: a single lane at z=0, traffic always flows toward +x (cars turn in from Rue du Centre at x=-XS, out onto the cross street at +XS)
const POLE_XS = [-38, -22.5, -2, 18, 38], POLE_Z = -6.85; // wooden utility poles on the far sidewalk
const LANE_Z = 0, SLOT_Z = 3.95, CURB_Z = 5.1, WALL_Z = 7.5, STREET_X = 52, END_X = 70, SLOT_LEN = 5.4;
// real layout (aguesseau_haut.png): +x = north, Rue du Centre just past -x; west side s=-1: Bugnot (corner), Dédé, Erika, Jack; east side s=1: Marion, Valérie, Marie-Claude
const SLOT_XS = { 1: [-44.2, -38.8, -33.4, -23.7, -18.3, -8.1, -2.7, 2.7], [-1]: [-41, -35.6, -30.2, -20, -14.6, -3.5, 1.9, 7.3] };
const GATES = { 1: [-28.6, -13, 20, 38], [-1]: [-46.5, -25, -8.5, 25] };
const STRANGER_FINE = 10, NEIGHBOUR_FINE = 100;
const PITS = [[-44.2, -4.55], [-47.2, 4.55]], PIT_R = 0.55; // entrance tree pits in the parking lane: clear of the zebra, Dédé's driveway and the first bays
const CAR_R = 0.95, MY_R = 0.95, P_R = 0.35, BIN_R = 0.45;

// ───────────────────────── renderer / scene / camera
const TOUCH = matchMedia('(pointer: coarse)').matches; // phones/tablets: on-screen stick and buttons (index.html), lighter rendering
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.5 : 2));
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
  const a = innerWidth / innerHeight, h = Math.max(viewH, 12 / a); // portrait: keep at least 24 m across
  Object.assign(camera, { left: -h * a, right: h * a, top: h, bottom: -h });
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
const BLINK = new THREE.MeshStandardMaterial({ color: '#ffae00', emissive: '#ff9500', emissiveIntensity: 1.6 }); // turn signals
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
function poppies(a, b, z, gate, wk) { // California poppies at the foot of the wall, not in front of the gates
  for (let x = a; x < b; x += sr(0.2, 0.45)) {
    if (gate !== undefined && Math.abs(x - gate) < 2 || wk !== undefined && Math.abs(x - wk) < 0.9) continue;
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
function fence(a, b, s, st, endPillar, ha = a, hb = b) { // ha..hb: hedge extent (kept clear of a wicket)
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
  if (st.hedge === 'laurel') hedge(S, ha, hb, z + s * 1.6, 4, HEDGES.laurel, 1.8);
  else if (st.hedge) hedge(S, ha, hb, z + s * 0.75, 1.7, HEDGES[st.hedge], 0.9);
}
function plate(x, y, z, txt) { // blue enamel house-number plate
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTex(64, g => {
    g.fillStyle = '#1d4c9a'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(5, 8, 54, 48);
    g.fillStyle = '#fff'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 34);
  }) }));
  m.position.set(x, y, z); m.rotation.y = z > 0 ? Math.PI : 0; S.add(m);
}
function wicket(x, s, lot) { // pedestrian gate: a railed leaf in the gate colour over a low threshold
  const st = lot.st, z = s * WALL_Z, mat = M(st.gate, { metalness: 0.4, roughness: 0.5 });
  if (lot.gate === undefined) { // no driveway gate: the number plate and letterbox go on the wicket's pillars
    const fz = s * (WALL_Z - 0.27);
    if (lot.num) plate(x + 0.95, 1.4, fz, lot.num);
    box(S, 0.34, 0.42, 0.1, lot.mail ?? '#3a3d40', x - 0.95, 1.2, fz);
  }
  box(S, 1.2, 0.08, 0.3, st.cap, x, 0.04, z);
  box(S, 1.1, 0.7, 0.05, mat, x, 0.5, z);
  for (const y of [0.9, 1.55]) box(S, 1.1, 0.06, 0.07, mat, x, y, z);
  for (let t = x - 0.48; t < x + 0.5; t += 0.12) inst(BAR, mat, t, 1.22, z, 0.9);
}
function gate(g, s, lot) {
  const st = lot.st, z = s * WALL_Z, gz = z + s * 0.32, gx = g + 2.5, mat = M(st.gate, { metalness: 0.4, roughness: 0.5 });
  tbox(S, 3.6, 0.02, WALL_Z - CURB_Z - 0.3, COBBLE, g, 0.16, s * (CURB_Z + WALL_Z) / 2); // pavés on the sidewalk
  if (!lot.streetGarage) { // a garage right on the street (lot.streetGarage) has no leaf and no driveway behind the wall
    box(S, 3.6, 0.85, 0.05, mat, gx, 0.55, gz); // sliding leaf, pulled mostly open behind the wall
    for (const y of [0.98, 1.72]) box(S, 3.6, 0.06, 0.07, mat, gx, y, gz);
    for (let x = gx - 1.7; x < gx + 1.75; x += 0.14) inst(st.wave ? WAVE : BAR, mat, x, 1.35, gz);
    box(S, 5.6, 0.03, 0.08, '#6d6f71', g + 1, 0.015, gz);
    const dl = (s > 0 ? 13.2 : 11.5) - WALL_Z - 0.3;
    tbox(S, 3.2, 0.03, dl, COBBLE, g, 0.015, s * (WALL_Z + 0.15 + dl / 2));
  }
  const fz = s * (WALL_Z - 0.27);
  box(S, 0.34, 0.42, 0.1, lot.mail ?? sp(['#3a3d40', '#2d4b3b', '#6b4a33', '#f1efe9']), g + (lot.mailDx ?? -1.8), 1.2, fz); // letterbox (mailDx: offset from the gate)
  box(S, 0.5, 0.64, 0.08, '#f4f3ef', g - 2.6, 0.44, s * (WALL_Z - 0.18)); // electric meter box
  box(S, 0.36, 0.05, 0.09, '#b9b6af', g - 2.6, 0.62, s * (WALL_Z - 0.18));
  if (lot.num) plate(g + 1.8, 1.4, fz, lot.num);
}
// lot boundaries per side; heroes pin a house/boundary to the lot containing x
const BACK_Z = 29.6; // rendered wall along the bottom of the gardens (clear of the pool, trees and wings of houses/*.js)
const CUTS = { 1: [-52, -43, -31, -19, -6, 7, 19, 30, 41, 52], [-1]: [-52, -48.7, -37, -21, -6, 7, 19, 31, 42, 52] };
const LOT_STYLES = ['green', 'anth', 'hedge', 'black', 'thuja', 'photinia', 'green'];
// real houses: one module per lot in houses/ (lot data + builder)
const HEROES = [
  { s: -1, x: -50, mod: bugnotHouse }, // Bugnot, on the corner of Rue du Centre, garage on Rue d'Aguesseau
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
  const s = l.s, free = x => (l.gate === undefined || Math.abs(x - l.gate) > 2.6) && (l.wicket === undefined || Math.abs(x - l.wicket) > 1.5);
  for (let i = 0; i < 3; i++) {
    const x = sr(l.x0 + 1, l.x1 - 1);
    if (!free(x)) continue;
    if (s < 0 && !l.house && rnd() < 0.55) tree(S, x, s * sr(9, 10.3), sr(4, 6.5), sp(['green', 'cone', Math.abs(x) > 20 ? 'red' : 'green']));
    else shrub(S, x, s * sr(8.4, 10.3), sr(0.5, 0.85));
  }
  if (l.banana) banana(S, l.x1 - 2.5, s * 8.8);
  if (l.maple) tree(S, l.cx - 1.5, s * 9.6, 3.6, 'red'); // Japanese maple
  if (l.poppies || (s < 0 && rnd() < 0.3)) poppies(l.x0 + 0.4, l.x1 - 0.4, s * (WALL_Z - 0.33), l.gate, l.wicket);
}
// everything a houses/*.js builder may use. l (the lot): { x0, x1, cx, s, zf, gate, st, ...hero } (hero may also set wicket: x of a
// pedestrian gate in the front wall, mailDx: letterbox offset from the gate, noWall: the house itself stands on the frontage,
// streetGarage: the gate is a garage door on the street, no leaf); street facade line z = s*zf,
// front wall z = s*WALL_Z; the game camera looks from +x/+z. Keep to x0..x1 and |z| > WALL_Z + 0.3; S is merged per material.
const KIT = { THREE, S, box, tbox, mesh, M, tmat, canvasTex, inst, GLASS, LAMP, tileTex, ROOFS, WALLS, SHUTTERS, GREENS, REDS, HEDGES, STYLES, BLOB, FLOWER, TUFT, CONE, TRUNK, BALL, BAR, SLAT, WAVE, COBBLE, WALK,
  win, door, oeil, house, garden, blob, tree, shrub, hedge, zhedge, banana, poppies, pillar, plate, rnd, sr, sp, V2, V3, WALL_Z, CURB_Z, SLOT_Z, GATES };
function row(s, cuts, gates = [], main = true) {
  const zf = s > 0 ? 13.2 : 11.5, lots = cuts.slice(0, -1).map((x0, i) => {
    const x1 = cuts[i + 1], hero = (main && HEROES.find(h => h.s === s && h.x > x0 && h.x < x1)) || {}, gate = gates.find(g => g > x0 && g < x1);
    // generated houses get a wicket mid-lot, or ≥ 1.6 m clear of the driveway on the side away from the sliding leaf (g+0.7..g+4.3)
    const wicket = hero.wicket ?? (hero.build || x1 - x0 <= 9 ? undefined : gate === undefined ? (x0 + x1) / 2 : gate - 4.6 > x0 + 0.3 ? gate - 4 : gate + 5);
    return { x0, x1, s, zf, cx: (x0 + x1) / 2, ...hero, st: typeof hero.style === 'object' ? hero.style : STYLES[hero.style ?? sp(LOT_STYLES)], gate, wicket };
  });
  const wk = lots.flatMap(l => l.wicket ?? []); // pedestrian gates in the front wall
  const xs = [...new Set([...cuts, ...gates.flatMap(g => [g - 1.8, g + 1.8]), ...wk.flatMap(w => [w - 0.6, w + 0.6])])].sort((p, q) => p - q);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2, lot = lots.find(l => m > l.x0 && m < l.x1), g = gates.find(g => Math.abs(g - m) < 0.1);
    if (g !== undefined) gate(g, s, lot);
    else if (wk.some(w => Math.abs(w - m) < 0.1)) wicket(m, s, lot);
    else if (!lot.noWall) {
      const wa = wk.some(w => Math.abs(w + 0.6 - a) < 0.01), wb = wk.some(w => Math.abs(w - 0.6 - b) < 0.01);
      fence(a, b, s, lot.st, i === xs.length - 2 || gates.some(g => Math.abs(g - 1.8 - b) < 0.01) || wb, wa ? a + 0.6 : a, wb ? b - 0.6 : b);
    }
  }
  for (const l of lots) {
    const lw = l.x1 - l.x0, cx = l.cx;
    if (l.build) { // real house: its module draws the lot; the seed is restored so the rest of the street doesn't depend on it
      const s0 = seed, h = l.build(KIT, l);
      seed = s0;
      if (s < 0) FRONTS.push(V3(cx, h - 0.5, s * zf + 0.05));
    } else {
      if (lw > 9) {
        const o = { doorX: l.wicket };
        o.w = Math.min(sr(7.5, 10), lw - 3); o.garage = lw - o.w > 7.2 && rnd() < 0.6;
        const h = house(S, cx + sr(-0.5, 0.5), s, zf, o);
        if (main && s < 0) FRONTS.push(V3(cx + sr(-2, 2), h - 0.5, s * zf + 0.05));
      }
      garden(l);
    }
    if (!l.build) tree(S, sr(l.x0 + 1, l.x1 - 1), s * sr(22, 26), sr(4.5, 7.5), sp(['green', 'green', 'red', 'cone'])); // real houses plant their own
  }
  // rendered walls: party walls on every lot line (low along the front garden, full height behind the houses; the cross streets
  // at |x| 52 / 63 have their own), and one along the bottom of the gardens
  const fl = zf - WALL_Z - 0.15, bl = BACK_Z - zf, len = cuts.at(-1) - cuts[0], mx = (cuts[0] + cuts.at(-1)) / 2;
  for (const x of cuts) if (![52, 63].includes(Math.abs(x))) {
    box(S, 0.24, 1.1, fl, '#e8e2d4', x, 0.55, s * (WALL_Z + 0.15 + fl / 2)); box(S, 0.34, 0.07, fl, '#cfc9bd', x, 1.13, s * (WALL_Z + 0.15 + fl / 2));
    box(S, 0.24, 1.8, bl, '#e8e2d4', x, 0.9, s * (zf + bl / 2)); box(S, 0.34, 0.07, bl, '#cfc9bd', x, 1.83, s * (zf + bl / 2));
  }
  box(S, len, 1.8, 0.24, '#e8e2d4', mx, 0.9, s * BACK_Z); box(S, len + 0.1, 0.07, 0.34, '#cfc9bd', mx, 1.83, s * BACK_Z);
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

// contiguous bays (sorted x) → groups, as drawn by the parking markings
const bayGroups = xs => xs.reduce((gs, x, i) => (i && x - xs[i - 1] < SLOT_LEN + 0.1 ? gs.at(-1).push(x) : gs.push([x]), gs), []);
// parking markings of one group: dashed lane edge, short ticks between bays, slanted lines at both ends
function markings(P, s, gp) {
  const a = gp[0] - SLOT_LEN / 2, b = gp.at(-1) + SLOT_LEN / 2, edge = s * (SLOT_Z - 1.15), W = '#efefe9';
  for (let x = a + 0.3; x < b; x += 1.2) box(P, 0.6, 0.01, 0.12, W, x, 0.006, edge);
  for (const [x, k] of [[a, -1], [b, 1]]) box(P, 2.54, 0.01, 0.12, W, x + k * 0.75, 0.006, edge + s * 1.02).rotation.y = -k * s * 0.94;
  for (let i = 1; i < gp.length; i++) box(P, 0.1, 0.01, 0.5, W, gp[i] - SLOT_LEN / 2, 0.006, edge + s * 0.25);
}
// all bay markings live in one group, redrawn when bays are bought (new bays next to old ones merge into one group)
const MARKS = new THREE.Group();
scene.add(MARKS);
function drawMarkings() { MARKS.clear(); for (const s of [1, -1]) for (const gp of bayGroups(SLOT_XS[s])) markings(MARKS, s, gp); }
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
    for (const [a, b] of [[-STREET_X - 1, STREET_X], [63, 100], [-100, -63]]) { // -x end reaches the Rue du Centre kerb
      tbox(S, b - a, 0.15, WALL_Z - CURB_Z, WALK, (a + b) / 2, 0.075, s * (CURB_Z + WALL_Z) / 2);
      box(S, b - a, 0.2, 0.25, '#bdbab2', (a + b) / 2, 0.1, s * CURB_Z);
      box(S, b - a, 0.012, 0.35, '#7b7872', (a + b) / 2, 0.004, s * (CURB_Z - 0.3));
    }
    // Rue du Centre (x=-58) sidewalks, 1 m each side, open across the crossroads (|z| < CURB_Z); k points at the road
    for (const [x, k] of [[-52.5, -1], [-63.5, 1]]) {
      const L = 100 - WALL_Z, l = 100 - CURB_Z;
      tbox(S, 1, 0.15, L, WALK, x, 0.075, s * (WALL_Z + L / 2));
      box(S, 0.25, 0.2, l, '#bdbab2', x + k * 0.5, 0.1, s * (CURB_Z + l / 2));
      box(S, 0.35, 0.012, l, '#7b7872', x + k * 0.8, 0.004, s * (CURB_Z + l / 2));
    }
    // lots (walls, gates, houses, gardens), a few beyond the cross streets, then a back row
    row(s, CUTS[s], GATES[s]);
    row(s, [63, 76, 88], [], false); row(s, [-88, -76, -64], [], false);
    for (const [x, k] of [[-52, 1], [52, -1], [-64, -1], [63, 1]]) {
      box(S, 0.3, 0.9, BACK_Z - WALL_Z, '#ece6d8', x, 0.45, s * (WALL_Z + BACK_Z) / 2);
      if (x !== -52 || s > 0) zhedge(x + k * 0.6, s * (WALL_Z + 0.3), s * BACK_Z, 1.7, HEDGES.privet, 0.9); // Bugnot (west corner) plants its own
    }
    for (let x = -84; x < 86; x += sr(12, 16)) if (Math.abs(Math.abs(x) - 58) > 9) house(S, x, s, 32, { porch: false, velux: false }); // back row, beyond the garden wall
    // road signs: "sens interdit" facing drivers at the +x end, blue "sens unique" at the -x entrance;
    // across Rue du Centre the street is one-way toward -x: blue arrow pointing away, "sens interdit" facing anyone coming out of it
    const noEntry = g => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
      g.fillStyle = '#c8102e'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.fillRect(24, 54, 80, 20);
    };
    const oneWay = k => g => {
      if (k < 0) { g.translate(128, 0); g.scale(-1, 1); }
      g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1f5fbf'; g.fillRect(6, 6, 116, 116);
      g.fillStyle = '#fff'; g.fillRect(24, 56, 54, 16); g.beginPath(); g.moveTo(72, 36); g.lineTo(106, 64); g.lineTo(72, 92); g.fill();
    };
    roadSign(50, s * 5.75, Math.PI / 2, noEntry);
    roadSign(-50.5, s * 5.75, 0, oneWay(1));
    roadSign(-64.5, s * 5.75, 0, oneWay(-1));
    roadSign(-64.5, s * 5.75, -Math.PI / 2, noEntry);
  }
  // zebra crossings near both ends, one-way arrows painted in the lane
  for (const x of [-49, 49]) for (let k = -4; k <= 4; k++) box(S, 3, 0.01, 0.55, '#efefe9', x, 0.006, k * 1.05);
  const arrow = new THREE.ShapeGeometry(new THREE.Shape([V2(-1.6, -0.12), V2(0.5, -0.12), V2(0.5, -0.42), V2(1.6, 0), V2(0.5, 0.42), V2(0.5, 0.12), V2(-1.6, 0.12)])).rotateX(-Math.PI / 2);
  for (const x of [-40, 0, 40]) mesh(S, arrow, '#efefe9', x, 0.008, 0);
  for (const x of [-72, -90]) mesh(S, arrow, '#efefe9', x, 0.008, 0).rotation.y = Math.PI; // one-way street beyond Rue du Centre
  for (const x of [-58, 58]) for (let z = 6.5; z < 120; z += 4) for (const s of [1, -1]) box(S, 0.14, 0.01, 2, '#efefe9', x, 0.006, s * z); // cross streets: two-way

  // wooden utility poles with arm-mounted lamps, droopy overhead wires and service drops (far side, like the photos)
  const poleXs = POLE_XS, pz = POLE_Z, WIRE = new THREE.LineBasicMaterial({ color: '#2a2a2a' });
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

  // entrance of Rue d'Aguesseau (photo): purple-leaf plums in chestnut-paling pits past the zebra, black white-topped bollards, green lamp post, corner chevron
  const s0 = seed, BOL = new THREE.CylinderGeometry(0.07, 0.07, 0.85, 8);
  for (const s of [1, -1]) {
    const [tx, tz] = PITS.find(p => Math.sign(p[1]) === s), e = 0.45; // kerbed pit jutting into the parking lane, off the sidewalk and driveways
    tree(S, tx, tz, 4.6, 'red');
    box(S, 2 * e + 0.2, 0.15, 2 * e + 0.2, '#bdbab2', tx, 0.075, tz); box(S, 2 * e, 0.02, 2 * e, '#5a4636', tx, 0.16, tz);
    for (const [a, b, c, d] of [[-e, -e, e, -e], [-e, e, e, e], [-e, -e, -e, e], [e, -e, e, e]]) {
      const n = Math.round(Math.hypot(c - a, d - b) / 0.1);
      for (let i = 0; i <= n; i++) { const h = sr(0.42, 0.52); box(S, 0.05, h, 0.04, sp(['#8a6a48', '#7a5c3e', '#9a7a56']), tx + a + (c - a) * i / n, 0.15 + h / 2, tz + b + (d - b) * i / n); }
      for (const y of [0.3, 0.5]) box(S, Math.abs(c - a) + 0.04, 0.015, Math.abs(d - b) + 0.04, '#5b5b58', tx + (a + c) / 2, y, tz + (b + d) / 2);
    }
    for (const x of s > 0 ? [-51.1, -46.9] : [-51.1]) { mesh(S, BOL, '#1d1d1f', x, 0.575, s * (CURB_Z + 0.3)); mesh(S, BALL, '#f2f2ee', x, 1.0, s * (CURB_Z + 0.3)).scale.set(0.5, 0.35, 0.5); }
  }
  mesh(S, new THREE.CylinderGeometry(0.18, 0.2, 0.9, 10), '#1f3d2e', -52.5, 0.6, -10);
  mesh(S, new THREE.CylinderGeometry(0.06, 0.1, 6.6, 8), '#1f3d2e', -52.5, 3.45, -10);
  box(S, 0.9, 0.06, 0.06, '#1f3d2e', -52.95, 6.7, -10);
  box(S, 0.4, 0.14, 0.3, '#1f3d2e', -53.35, 6.7, -10); box(S, 0.34, 0.04, 0.24, LAMP, -53.35, 6.62, -10);
  box(S, 0.06, 1.0, 0.06, '#9aa0a4', -52.6, 0.65, -5.5);
  const chev = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshStandardMaterial({ map: canvasTex(128, g => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1f5fbf';
    g.beginPath(); g.moveTo(40, 64); g.lineTo(84, 20); g.lineTo(104, 20); g.lineTo(60, 64); g.lineTo(104, 108); g.lineTo(84, 108); g.fill();
  }), roughness: 0.5 }));
  chev.position.set(-52.65, 1.3, -5.5); chev.rotation.y = -Math.PI / 2; S.add(chev);
  seed = s0;

  // blue Paris-style street sign on the far wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: canvasTex(512, (g) => {
    g.canvas.height = 160;
    g.fillStyle = '#2e7d4f'; g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#1d3f7a'; g.fillRect(10, 10, 492, 140);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(20, 20, 472, 120);
    g.fillStyle = '#fff'; g.font = '700 30px Fredoka, sans-serif'; g.textAlign = 'center';
    g.fillText('RUE', 256, 60); g.font = '700 50px Fredoka, sans-serif'; g.fillText("D'AGUESSEAU", 256, 115);
  }), roughness: 0.5 }));
  sign.position.set(-50.35, 2.55, -WALL_Z + 0.08); // over Bugnot's garage door
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
drawMarkings();

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
  family: markerMat('#9b5de5', g => { g.beginPath(); g.moveTo(64, 30); g.lineTo(98, 62); g.lineTo(88, 62); g.lineTo(88, 94); g.lineTo(40, 94); g.lineTo(40, 62); g.lineTo(30, 62); g.closePath(); g.fill(); }),
  seek: markerMat('#2ec4b6', g => { g.font = '900 64px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P?', 64, 68); }),
  famSeek: markerMat('#9b5de5', g => { g.font = '900 64px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P?', 64, 68); }),
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
  pop: () => beep([rand(110, 170), rand(55, 80)], 0.035, 'square', 0.09), // exhaust backfire
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
function toast(msg) { $('toast').textContent = nb(msg); $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 2600); }

// ───────────────────────── cars
const CAR_TYPES = {
  hatch: { len: 4.0, w: 1.75, body: 0.62, cab: 2.5, cabH: 0.6, cabX: -0.2, fr: 0.7, rr: 0.35 },
  mpv: { len: 4.5, w: 1.85, body: 0.7, cab: 3.5, cabH: 0.74, cabX: 0, fr: 1.1, rr: 0.25 },
  suv: { len: 4.7, w: 1.9, body: 0.85, cab: 3.1, cabH: 0.68, cabX: -0.25, fr: 0.6, rr: 0.3 },
  mini: { len: 3.8, w: 1.75, body: 0.6, cab: 2.2, cabH: 0.58, cabX: -0.2, fr: 0.45, rr: 0.2, roof: '#f2f2f2' },
};
const AI_COLORS = ['#8c939b', '#d9dcde', '#5b7391', '#7d8288', '#f0f0f0', '#a83c3c', '#56657a', '#b9a98a', '#3f6a8f', '#33373d', '#c8ccd0'];
const MINE_COLORS = ['#f2b134', '#2ec4b6', '#e76f51', '#9b5de5', '#00bbf9'];
const NEIGHBOURS = [
  { name: 'Marion', color: '#2f3e5c', type: 'mpv' },
  { name: 'Thierry', color: '#5b6470', type: 'mpv' },
  { name: 'Marie-Claude', color: '#6b7075', type: 'mini' },
  { name: 'Dédé', color: '#3c3f44', type: 'suv' },
  { name: 'Florence', color: '#eeeeee', type: 'hatch' },
  { name: 'Le père', color: '#8a8f94', type: 'hatch' },
  // Erika's household
  { name: 'Clément', model: buildPolo, dented: true, family: true }, // battered grey VW Polo 2015: breaks down every time he parks
  { name: 'Léa', color: '#b7d3e8', type: 'mini', family: true },
  { name: 'Kévin', model: buildZ4, family: true }, // black BMW Z4 E89
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
  const bw = (m.w ?? CAR_TYPES[type]?.w ?? 1.8) / 2, bl = len / 2; // turn signals at the four corners (local -z = left)
  c.blink = { [-1]: [], [1]: [] }; c.bw = bw;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const b = box(g, 0.16, 0.1, 0.16, BLINK, sx * (bl - 0.05), 0.72, sz * (bw - 0.05)); b.visible = b.castShadow = false; c.blink[sz].push(b); }
  cars.push(c);
  return c;
}
// collision circles [x, z, r] of vehicle c, optionally at a hypothetical pose
const circles = (c, x = c.x, z = c.z, ang = c.ang) => { const cs = Math.cos(ang), sn = Math.sin(ang); return c.circ.map(o => [x + cs * o, z - sn * o, c.r]); };

// ───────────────────────── slots
const slotGeo = new THREE.PlaneGeometry(SLOT_LEN - 0.35, 2.0);
const slots = [];
function addSlot(x, s) {
  const ov = new THREE.Mesh(slotGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false }));
  ov.rotation.x = -Math.PI / 2; ov.position.set(x, 0.012, s * SLOT_Z);
  scene.add(ov);
  slots.push({ x, z: s * SLOT_Z, side: s, ai: null, block: null, ov });
}
for (const s of [-1, 1]) for (const x of SLOT_XS[s]) addSlot(x, s);
// top-of-screen strip: far side (s=-1) on top, near side below, both left→right along X; rebuilt when bays/meters are bought
function buildStrip() {
  const strip = $('strip');
  strip.replaceChildren();
  for (const s of [-1, 1]) {
    const row = document.createElement('div'); row.className = 'row';
    let prev = null;
    for (const sl of slots.filter(q => q.side === s).sort((p, q) => p.x - q.x)) {
      if (prev !== null && sl.x - prev > SLOT_LEN + 0.1) row.append(Object.assign(document.createElement('div'), { className: 'gap' }));
      sl.el = Object.assign(document.createElement('div'), { className: sl.meter ? 's m' : 's' });
      row.append(sl.el); prev = sl.x;
    }
    strip.append(row);
  }
}
buildStrip();
const inSlot = (o, s) => Math.abs(o.x - s.x) < SLOT_LEN / 2 && Math.abs(o.z - s.z) < 1.4; // pedestrians
// vehicles block every bay their length overlaps by ≥1.2 m while in that side's parking lane: parked across a line = 2 bays
const covers = (c, s) => Math.abs(c.z - s.z) < 1.4 && (SLOT_LEN + c.len) / 2 - Math.abs(c.x - s.x) >= 1.2;
// E-snap targets per side: bay centres + boundaries between adjacent bays
const SNAP_XS = {}, resnap = () => { for (const s of [1, -1]) SNAP_XS[s] = SLOT_XS[s].flatMap((x, i, a) => a[i + 1] - x < SLOT_LEN + 0.1 ? [x, x + SLOT_LEN / 2] : [x]); };
resnap();
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
const keys = {}; // keyboard booleans, plus sx/sy: analog stick (touch or gamepad), -1..1, screen axes (y down); th: gamepad triggers
const axX = () => clamp((keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (keys.sx || 0), -1, 1);
const axY = () => clamp((keys.up ? 1 : 0) - (keys.down ? 1 : 0) - (keys.sy || 0) + (keys.th || 0), -1, 1); // forward +
const dz = v => { const a = Math.abs(v); return a < 0.15 ? 0 : a > 0.9 ? Math.sign(v) : Math.sign(v) * (a - 0.15) / 0.75; }; // dead zone, full at the rim
let belly = 0, driving = null, score = 50, elapsed = 0, streak = 0, rate = 0, mult = 1, spawnT = 8;
let boostT = 0, slowT = 0, chatT = rand(30, 50); // speed boost (baguette), slowdown (father's fart), cooldown before a driver stops to chat
let binsInHand = null, carsOwned = 1, started = false, paused = false, foreignN = 0;
let best = 0;
const EV = { valerie: 0, fart: 0, pere: 0, chat: 0, jack: 0, wife: 0, baguette: 0, wash: 0 }; // special events so far (the tutorial waits for them)
// special interaction: the game freezes, the camera goes to it and the rest of the screen is blurred (tutoOnly: only during the tutorial)
let focus = null;
function spotlight(x, z, title, text, tutoOnly = false) {
  if (!started || focus || tutoOnly && tutoI < 0) return;
  focus = { x, z, t: clamp(text.length / 14, 4, 9) };
  $('focusTitle').textContent = nb(title); $('focusText').textContent = nb(text);
  $('focus').classList.remove('hidden'); $('focusCard').classList.remove('hidden');
}
function unfocus() { focus = null; $('focus').classList.add('hidden'); $('focusCard').classList.add('hidden'); }
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
    if (s.ai || s.block && s.block !== player || s === c.snub) continue; // Erika on foot doesn't put them off: they try, and bounce
    const rem = (s.x - c.x) * c.dir;
    if (rem < 10 || rem > 45) continue;
    if (rem < bs) { bs = rem; best = s; } // first free bay ahead, either side
  }
  return best;
}
function obstacleAhead(c) { // along the car's heading (lane or cross street)
  let gap = Infinity, who = null;
  const hx = Math.cos(c.ang), hz = -Math.sin(c.ang);
  const test = (o, x, z, clear, lat = 1.9) => {
    const along = (x - c.x) * hx + (z - c.z) * hz;
    if (along > 0 && Math.abs((x - c.x) * hz - (z - c.z) * hx) < lat && along - clear < gap) { gap = along - clear; who = o; }
  };
  // only cars whose centre is ahead: two overlapping cars would otherwise each wait for the other forever
  for (const o of cars) if (o !== c && o.state !== 'away' && o.state !== 'parked' && (o.x - c.x) * hx + (o.z - c.z) * hz > 0) for (const [x, z, r] of circles(o)) test(o, x, z, c.len / 2 + r + 1.2, CAR_R + r);
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
// cross streets at x=±XS (two-way, keep right): cars come down Rue du Centre (-XS) from either end, wait at the stop line, turn in;
// at the far end they turn onto the other cross street (+XS) and drive off. The street facing us across Rue du Centre is one-way toward -x.
const XS = 58, XL = 2.5, EXIT_X = 50, TURN_V = 4.5;
const crossX = (x0, s) => x0 - s * XL; // lane of heading s (±z) on the cross street at x0
// Bezier from the stop line on cross street x0 (heading s) into the x-street heading d (1: Aguesseau, -1: one-way street), d=0: straight on
const turnPath = (x0, s, d) => { const lx = crossX(x0, s); return d ? [[lx, -7 * s], [lx, -s], [lx + 3 * d, 0], [x0 + 8 * d, 0]] : [[lx, -7 * s], [lx, -2 * s], [lx, 2 * s], [lx, 7 * s]]; };
const outPath = s => { const lx = crossX(XS, s); return [[EXIT_X, 0], [lx - 3, 0], [lx, s], [lx, 7 * s]]; };
const pathNear = (P, Q) => { for (let a = 0; a <= 1; a += 0.1) for (let b = 0; b <= 1; b += 0.1) if (Math.hypot(bez(P, a, 0) - bez(Q, b, 0), bez(P, a, 1) - bez(Q, b, 1)) < 2.6) return true; return false; };
// a turn may start when no crossing turn is under way (same turn: once the one ahead is halfway) and its end is clear; Erika's cars get shoved instead
const canTurn = (c, P) => !cars.some(o => o !== c && o.state !== 'away' && o.state !== 'parked' && (o.state === 'turn'
  ? pathNear(o.path, P) && !(o.t > 0.5 && o.path[2] + '' + o.path[3] === P[2] + '' + P[3])
  : o.state !== 'mine' && circles(o).some(([x, z, r]) => Math.hypot(x - P[3][0], z - P[3][1]) < c.len / 2 + r + 1)));
function startTurn(c, P) {
  const p = c.path = [[c.x, c.z], ...P.slice(1)], d = (i, j) => Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]);
  Object.assign(c, { t: 0, L: (d(0, 3) + d(0, 1) + d(1, 2) + d(2, 3)) / 2, state: 'turn', route: null, exitS: 0 });
}
// arrive (queue down the cross street), turn (Bezier at walking pace, pauses behind obstacles), depart (off down the cross street, then gone)
function crossStreet(c, dt) {
  if (c.state !== 'arrive' && c.state !== 'turn' && c.state !== 'depart') return false;
  if (c.state === 'depart' && (Math.abs(c.z) > END_X || Math.abs(c.x) > 98)) { (c.gone || leaveStreet)(c); return true; }
  const [gap, who] = obstacleAhead(c), hx = Math.cos(c.ang), hz = -Math.sin(c.ang);
  let v = gap < 0 ? 0 : Math.min(c.state === 'turn' ? TURN_V : c.cruise, gap * 1.6);
  if (c.state === 'arrive') {
    const P = c.route, rem = (P[0][0] - c.x) * hx + (P[0][1] - c.z) * hz, go = rem > 15 || canTurn(c, P);
    if (go && rem < 0.3) startTurn(c, P);
    else v = Math.min(v, go ? TURN_V + rem * 0.5 : Math.max(0, rem) * 1.6);
  }
  stuck(c, gap, who, dt);
  c.speed += clamp(v - c.speed, -14 * dt, 5 * dt);
  if (c.state !== 'turn') { c.x += hx * c.speed * dt; c.z += hz * c.speed * dt; return true; }
  const p = c.path, u = c.t = Math.min(1, c.t + c.speed * dt / c.L);
  c.x = bez(p, u, 0); c.z = bez(p, u, 1); c.ang = Math.atan2(-bezD(p, u, 1), bezD(p, u, 0));
  if (u === 1) c.state = Math.abs(c.z) < 1 && Math.abs(c.x) < XS ? 'drive' : 'depart';
  return true;
}
// near the far end: hold at EXIT_X until the turn onto the cross street is free, then take it (either way); -1 once turning
function exitGate(c, v, gone = leaveStreet) {
  if (c.x < EXIT_X - 10) return v;
  c.gone = gone;
  if (c.x > EXIT_X + 3) { gone(c); return -1; } // already past the turn (shoved, placed by a test)
  const P = outPath(c.exitS ||= pick([1, -1]));
  if (!canTurn(c, P)) return Math.min(v, Math.max(0, EXIT_X - c.x) * 1.6);
  if (c.x < EXIT_X - 0.3) return Math.min(v, TURN_V + (EXIT_X - c.x) * 0.5);
  startTurn(c, P); return -1;
}
// enter from either end of Rue du Centre (false if both ends are busy); d as in turnPath: 0/-1 = through traffic that never enters
function enterStreet(c, d = 1) {
  const s0 = pick([1, -1]);
  for (const s of [s0, -s0]) {
    const x = crossX(-XS, s), z = -s * END_X;
    if (cars.some(o => o !== c && o.state !== 'away' && Math.abs(o.x - x) < 1.5 && Math.abs(o.z - z) < 9)) continue;
    Object.assign(c, { dir: 1, x, z, ang: -s * Math.PI / 2, state: 'arrive', speed: c.cruise, scan: 0, slot: null, route: turnPath(-XS, s, d), exitS: 0, gone: null,
      wantsSlot: d > 0 && (c.kind === 'neighbour' || Math.random() < 0.35 + 0.4 * traffic()) });
    c.mesh.visible = true;
    return true;
  }
  return false;
}
function leaveStreet(c) {
  if (c.slot) { c.slot.ai = null; c.slot = null; }
  if (c.kind === 'foreign') { scene.remove(c.mesh); cars.splice(cars.indexOf(c), 1); return; }
  if (c.kind === 'neighbour' && c.wantsSlot) { // drove the whole street without finding a bay
    score = Math.max(0, score - NEIGHBOUR_FINE); SFX.fine();
    toast(`${c.name} n’a pas trouvé de place dans la rue ! −${NEIGHBOUR_FINE}`);
  }
  if (c.kind === 'neighbour') c.back = elapsed + rand(40, 90); // away for a while, then the spawner may call them home
  c.state = 'away'; c.timer = c.kind === 'neighbour' ? Infinity : rand(15, 60); c.mesh.visible = false;
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
  if (c.kind === 'foreign') { SFX.fine(); score = Math.max(0, score - STRANGER_FINE); floatText(`Un inconnu s’est garé ! −${STRANGER_FINE}`, s.x, 3.4, s.z, '#ff8fa3'); }
  else floatText(`${c.name} est de retour`, s.x, 3.4, s.z, '#7ff0e4');
  if (c.kind === 'neighbour' && !c.dirty && Math.random() < 0.4) setDirty(c, true);
  if (c.dented) { c.broken = true; floatText('Clément : Encore en panne !', s.x, 4.2, s.z, '#7ff0e4'); callMechanic(c); } // fixed, then broken again next time
}
function startLeave(c) {
  const lz = laneZ(c), d = c.dir; // from the actual pose: a truck may have shoved it off the bay centre
  c.path = [[c.x, c.z], [c.x + d * 3, c.z], [c.x + d * 6, lz], [c.x + d * 9, lz]];
  c.dur = 3; c.t = 0; c.state = 'leave'; c.shoved = 0;
  puff(c.x - d * c.len / 2, c.z, 5, '#bdbdbd');
}
const PATIENCE = 8, PATIENCE_ON_FOOT = 2; // s a car waits behind one of Erika's cars / Erika on foot before shoving it aside
const patience = who => who === player ? PATIENCE_ON_FOOT : PATIENCE;
const touchesBelly = c => !driving && pedPush({ x: player.x, z: player.z }, c, P_R + 0.12);
function bellyBounce(c) { // a car pulling in bumps into Erika: it bounces off her belly and gives up the bay
  const dx = c.x - player.x, dz = c.z - player.z, d = Math.hypot(dx, dz) || 1;
  c.snub = c.slot; c.slot.ai = null; c.slot = null; c.state = 'drive'; c.speed = 0; // snub: never retry that bay
  if (c.kind === 'foreign') c.wantsSlot = false; // a stranger turned away drives on out of the street
  c.kick = 1; c.kx = dx / d * 3.5; c.kz = dz / d * 3.5; belly = 1;
  SFX.boing(); floatText('Boing !', player.x, 3, player.z, '#ffd166');
}
// nudge the blocker sideways (either side), else along the lane; the player on foot always gives way
function shoveAside(c, o, dt) {
  if (c.stuckT - dt <= patience(o)) { floatText('Pousse-toi !', c.x, 3, c.z, '#ff8fa3'); if (nearPlayer(c.x, c.z)) SFX.honk(); }
  const side = Math.sign(o.z) || 1, v = 2.5 * dt;
  if (o === player) { player.z += side * v; return pushOut(player); }
  const pen = carPen(o, o.x, o.z, o.ang);
  for (const [dx, dz] of [[0, side], [0, -side], [c.dir, 0]]) if (carPen(o, o.x + dx * v, o.z + dz * v, o.ang) <= pen + 1e-4) { o.x += dx * v; o.z += dz * v; return; }
}
function stuck(c, gap, who, dt) { // blocked by Erika or one of her cars: shove it aside after a while
  c.stuckT = gap < 0.5 && (who === player || who?.state === 'mine') ? (c.stuckT || 0) + dt : 0; // not the wife driving one
  if (c.stuckT > patience(who)) shoveAside(c, who, dt);
}
function updateAI(c, dt) {
  c.honkT -= dt;
  if (c.kick > 0) { c.x += c.kx * c.kick * dt; c.z += c.kz * c.kick * dt; c.kick -= dt * 4; }
  if (crossStreet(c, dt)) return;
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
        if (c.kind === 'foreign') { floatText('Place libérée !', c.slot.x, 3.2, c.slot.z, '#8ef0a8'); SFX.free(); }
        if (c.slot) { c.slot.ai = null; c.slot = null; } c.state = 'drive'; c.wantsSlot = false; c.speed = 4;
      }
      return;
  }
  // drive
  if (c.chat > 0) { // stopped to chat with Erika: the traffic behind has to wait
    c.speed = Math.max(0, c.speed - 14 * dt); c.x += c.speed * c.dir * dt;
    if ((c.chat -= dt) <= 0) floatText('Allez, à plus Erika !', c.x, 3, c.z, '#cdb4ff');
    return;
  }
  if (chatT <= 0 && !driving && !WASH.c && Math.abs(player.x - c.x) < 4 && Math.abs(player.z - c.z) < 7) {
    c.chat = rand(5, 8); chatT = rand(45, 75); EV.chat++;
    const who = c.name ?? pick(TOWN);
    floatText(pick(['Salut Erika ! Ça va ?', 'Oh Erika ! Tu connais la nouvelle ?', 'Erika ! Ça fait longtemps !']), c.x, 3.2, c.z, '#cdb4ff');
    floatText(pick(['Ah salut !', 'Ben dis donc !', 'Oh bah ça alors !']), player.x, 3.8, player.z, '#ffd166');
    spotlight(c.x, c.z, `${who} s’arrête pour papoter`, `« ${pick(GOSSIP.filter(l => !l.includes(who)))} »`);
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
  stuck(c, gap, who, dt);
  if ((target = exitGate(c, target)) < 0) return;
  if (c.seat) seatFx(c, dt, target);
  c.speed += clamp(target - c.speed, -14 * dt, (c.seat ? 16 : 5) * dt);
  c.x += c.speed * c.dir * dt;
  c.z += (laneZ(c) - c.z) * Math.min(1, dt * 3);
  c.ang = c.dir > 0 ? 0 : Math.PI;
  if (gap < 0.3 && c.honkT <= 0 && (who === player || who?.kind === 'mine' || who?.chat > 0 || bins.includes(who))) {
    c.honkT = rand(3, 5);
    if (nearPlayer(c.x, c.z)) SFX.honk();
    floatText(pick(['Tût tût !', 'Pouet pouet !', 'Tuuut !']), c.x, 3, c.z, '#ffd166');
  }
}
// what drivers stopping for a chat talk about: the town's characters and the neighbours (never a line about the speaker)
const TOWN = ['Jean-Marie', 'Raymonde', 'Jean-Claude', 'Dalila']; // strangers who stop are these
const GOSSIP = [
  'Jean-Marie, ton patron, a encore garé sa Mercedes sur trois places devant le bureau !',
  'Jean-Marie veut te voir lundi. Augmentation ou engueulade, on parie ?',
  'Jean-Marie s’est mis au vélo électrique. Il est tombé dans le rond-point.',
  'Raymonde, la sœur de Jean-Marie, dit partout que c’est elle qui dirige vraiment la boîte.',
  'Raymonde a encore engueulé le fromager au marché. Pour un comté trop jeune !',
  'Raymonde a gagné au loto. Trois numéros. Elle a payé le champagne à tout le monde, ça lui a coûté plus cher.',
  'Jean-Claude cherche quelqu’un pour l’aider à déménager. Encore ! C’est la quatrième fois.',
  'Jean-Claude a repeint son portail en orange. Tout le quartier en parle.',
  'Jean-Claude demande si tu viens à la pétanque samedi. Il a acheté des boules en titane.',
  'Dalila est passée voir ta femme : elles ont parlé de toi pendant deux heures !',
  'Dalila fait un couscous dimanche, ta femme est invitée. Toi aussi, paraît-il.',
  'Dalila a vu Raymonde et Jean-Marie se disputer devant la boulangerie !',
  'Dédé a 89 ans et il tond encore sa pelouse à 7 h du matin.',
  'Marion a fêté ses 88 ans : elle a dansé jusqu’à minuit !',
  'Valérie compte les poubelles de la rue tous les soirs. Elle a un carnet.',
  'Le père a mangé des flageolets à midi. Méfie-toi !',
  'Jack taille sa haie de laurier au centimètre près. Il a sorti le mètre ruban.',
  'Marie-Claude a vu la Seat noire passer à 90 dans la rue, avec des flammes !',
  'Clément a encore appelé Stéphane pour sa Polo. Troisième fois cette semaine.',
  'Kévin lave sa Z4 tous les dimanches, même quand il pleut.',
  'Florence a adopté un troisième chat. Il s’appelle Stationnement.',
  'Thierry veut mettre une barrière devant chez lui. Sur la rue !',
  'Léa a raté son créneau trois fois devant tout le monde ce matin.',
  'Bugnot a refait son garage, mais il gare toujours sa voiture devant.',
];
// 0 = calm, 1 = rush hour: some traffic from the start (0.12), then ~2.5 min waves (short rushes, longer calm spells) growing over the first minutes
let trafficForced = null; // debug.trafic(v) pins it
const traffic = () => trafficForced ?? 0.12 + 0.88 * clamp((elapsed - 30) / 240, 0, 1) * (0.25 + 0.75 * (0.5 - 0.5 * Math.cos(elapsed * 2 * Math.PI / 150)) ** 2);
// the black Portuguese Seat: a stranger who floors it, blows black smoke and pops and bangs when lifting off
function addSeat() {
  const m = buildSeat(ENV), c = addCar('foreign', null, null, m);
  return Object.assign(c, { seat: true, exhaust: m.exhaust, flames: m.flames, cruise: rand(11, 13), smokeT: 0, flameT: 0, popN: 0, popT: 0 });
}
function seatFx(c, dt, target) {
  c.smokeT += dt * (target > c.speed + 0.5 ? 40 : 1.5); // floored: a black cloud, idling: a trickle
  if (!c.popN && target < c.speed - 2 && Math.random() < dt * 4) c.popN = 2 + (Math.random() * 4 | 0); // lift-off: a burst of bangs
  if (c.popN && (c.popT -= dt) <= 0) {
    c.popN--; c.popT = rand(0.05, 0.16); c.flameT = 0.07; c.smokeT += 2;
    if (nearPlayer(c.x, c.z)) { SFX.pop(); if (Math.random() < 0.3) floatText(pick(['PAN !', 'BANG !', 'Pop pop !']), c.x - 2, 2, c.z, '#ff9f1c'); }
  }
  if (c.smokeT >= 1) {
    c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.ang; c.mesh.updateMatrixWorld();
    const p = c.mesh.localToWorld(c.exhaust.clone());
    for (; c.smokeT >= 1; c.smokeT--) smokePuff(p);
  }
}
function spawner(dt) { // arrivals: 70% strangers (some just pass by on Rue du Centre), 20% neighbours, 10% Erika's household
  if ((spawnT -= dt) > 0) return;
  spawnT = (9 - 8.1 * traffic()) * rand(0.8, 1.2); // ~9 s apart when calm, a continuous stream at rush hour
  const r = Math.random();
  if (r >= 0.7) {
    const fam = r >= 0.9, due = cars.filter(c => c.kind === 'neighbour' && c.state === 'away' && !!c.family === fam && elapsed > c.back);
    if (due.length) { pick(due).timer = 0; return; } // updateAI brings them in
  }
  if (cars.filter(c => c.kind === 'foreign').length > 45) return;
  const c = !cars.some(o => o.seat) && Math.random() < 0.15 ? addSeat() : addCar('foreign', pick(AI_COLORS), pick(['hatch', 'hatch', 'mpv', 'suv', 'mini']));
  if (!enterStreet(c, Math.random() < 0.3 ? pick([0, -1]) : 1)) { scene.remove(c.mesh); cars.pop(); } // 30%: just passing on Rue du Centre
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
    for (const [px, pz] of PITS) pen += Math.max(0, ar + PIT_R - Math.hypot(ax - px, az - pz));
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
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// stick alone (no triggers): the car heads where the stick points on screen, reversing when it points behind a slow car;
// returns [throttle, steer], or null for car-relative keys (and triggers + stick x)
function stickDrive(c) {
  const sx = keys.sx || 0, sy = keys.sy || 0, m = Math.min(1, Math.hypot(sx, sy));
  if (!m || keys.th || keys.up || keys.down || keys.left || keys.right) return null;
  const t = Math.atan2(sx - sy, sx + sy), dF = wrap(t - c.ang), dB = wrap(t - c.ang - Math.PI); // same screen→street map as walk()
  const back = c.speed < -0.5 || c.speed <= 0.5 && Math.abs(dF) > 1.9; // ~110°: pointing behind a slow car backs it up
  if (!back) return Math.abs(dF) > 2.1 && c.speed > 0.5 ? [-m, 0] : [m * Math.max(0.35, Math.cos(dF)), clamp(2 * dF, -1, 1)]; // way behind while rolling: brake first
  return Math.abs(dB) > 2.1 && c.speed < -0.5 ? [m, 0] : [-m * Math.max(0.35, Math.cos(dB)), clamp(-2 * dB, -1, 1)];
}
function drive(c, dt) {
  const st = stickDrive(c), f = c.thr = st ? st[0] : axY(); // a half-pushed stick cruises at half the top speed (full forward/back reverse like the keys)
  const acc = f > 0 ? (f === 1 || c.speed < f * c.top ? c.acc : 0)
    : f < 0 ? (c.speed > 0.5 ? -1.8 * c.acc : f === -1 || c.speed > 0.4 * f * c.top ? -0.67 * c.acc : 0) : 0;
  c.speed += acc * dt;
  if (!acc) c.speed *= Math.pow(0.3, dt);
  if (keys.brake) c.speed *= Math.pow(0.01, dt);
  c.speed = clamp(c.speed, -0.4 * c.top, c.top);
  const steer = st ? st[1] : -axX(); // proportional with the triggers + stick: small nudges to line up in a bay
  const ang = c.ang + steer * clamp(c.speed, -4, 4) * c.turn * dt, k = c.pivot, d = c.speed * dt; // turns about a point k m behind the centre (rear axle)
  const pose = (a, d) => ({ x: c.x - Math.cos(c.ang) * k + Math.cos(a) * (k + d), z: c.z + Math.sin(c.ang) * k - Math.sin(a) * (k + d), ang: a });
  const m = pose(ang, d), before = carPen(c, c.x, c.z, c.ang), fits = p => carPen(c, p.x, p.z, p.ang) <= before + 1e-4;
  if (fits(m) || c.truck && truckShove(c, m.x, m.z, m.ang)) Object.assign(c, m);
  else { // blocked: slide out of whatever it hit (full move, pure turn, straight on, stay put pushed out); the speed lost is the impact
    const p = [m, pose(ang, 0), pose(c.ang, d), pose(c.ang, 0)].map(p => unstick(c, p)).find(fits) || pose(c.ang, 0);
    const v = ((p.x - c.x) * Math.cos(p.ang) - (p.z - c.z) * Math.sin(p.ang)) / dt * Math.sign(c.speed);
    if (Math.abs(c.speed) - Math.max(0, v) > 3) { puff(m.x, m.z, 3, '#ddd'); floatText('Boum !', c.x, 2.8, c.z, '#ffd166'); c.speed *= -0.2; }
    else c.speed = Math.sign(c.speed) * Math.min(Math.abs(c.speed), Math.max(v, 1.5)); // keeps ~1.5 m/s of wheel speed so it can still steer off
    Object.assign(c, p);
  }
  if (c.exhaust) exhaustFx(c, dt);
}
// pose p pushed (translation only, a few relaxation passes) out of the curb, the street ends, other cars and bins
function unstick(c, { x, z, ang }) {
  const cs = Math.cos(ang), sn = Math.sin(ang), obs = [...cars.filter(o => o !== c && o.state !== 'away').flatMap(o => circles(o)), ...bins.map(b => [b.x, b.z, BIN_R])];
  for (let i = 0; i < 4; i++) for (const o of c.circ) {
    const ax = x + cs * o, az = z - sn * o;
    z -= Math.sign(az) * Math.max(0, Math.abs(az) + c.r - CURB_Z);
    x -= Math.sign(ax) * Math.max(0, Math.abs(ax) - 62);
    for (const [bx, bz, br] of obs) {
      const dx = x + cs * o - bx, dz = z - sn * o - bz, dd = Math.hypot(dx, dz), e = c.r + br - dd;
      if (e > 0 && dd > 1e-6) { x += dx / dd * e; z += dz / dd * e; }
    }
  }
  return { x, z, ang };
}
// the truck shoves parked strangers/neighbours along with it; after ~1 m they give up the bay and drive off
function truckShove(c, x, z, ang) {
  const tc = circles(c, x, z, ang);
  const hit = cars.filter(o => o.state === 'parked' && (o.kind === 'foreign' || o.kind === 'neighbour') && circles(o).some(([bx, bz, br]) => tc.some(([ax, az, ar]) => Math.hypot(ax - bx, az - bz) < ar + br)));
  if (!hit.length || carPen(c, x, z, ang, hit) > carPen(c, c.x, c.z, c.ang, hit) + 1e-4) return false;
  const dx = x - c.x, dz = z - c.z;
  for (const o of hit) {
    o.x += dx; o.z += dz;
    if ((o.shoved = (o.shoved || 0) + Math.hypot(dx, dz)) > 1) { startLeave(o); floatText('Délogé !', o.x, 3.2, o.z, '#ffd166'); SFX.honk(); }
  }
  return true;
}
// black smoke: the truck's diesel (idle trickle, more with speed, lots on the throttle) + low rumble; the BMW coughs a cloud at start-up
function exhaustFx(c, dt) {
  const v = Math.abs(c.speed);
  if (c.truck) c.smokeT += dt * (v > 0.3 ? 12 + v * 3 + (c.thr > 0 ? 30 : 0) : 3);
  if (c.cough > 0) { c.cough -= dt; c.smokeT += dt * 45; }
  if (c.smokeT >= 1) {
    c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.ang; c.mesh.updateMatrixWorld();
    const p = c.mesh.localToWorld(c.exhaust.clone());
    for (; c.smokeT >= 1; c.smokeT--) smokePuff(p);
  }
  if (c.truck && (c.rumbleT -= dt) <= 0) { c.rumbleT = 0.16; beep([36 + v * 5], 0.18, 'sawtooth', c.thr > 0 ? 0.035 : 0.02); }
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
  for (const b of [...bins, ...meters, ...PITS.map(([x, z]) => ({ x, z }))]) {
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), m = BIN_R + P_R;
    if (d < m && d > 1e-4) { p.x = b.x + (dx / d) * m; p.z = b.z + (dz / d) * m; }
  }
  pedBounds(p);
}
function walk(dt) {
  const f = axY(), r = axX(), push = Math.min(1, Math.hypot(f, r)); // a stick barely pushed walks slowly
  // screen-relative: camera looks along (-1,0,-1)
  let vx = r - f, vz = -f - r;
  const len = Math.hypot(vx, vz);
  player.moving = len > 0;
  if (len) {
    vx /= len; vz /= len;
    const v = push * (binsInHand ? 4.3 : 6.2) * (boostT > 0 ? 1.6 : 1) * (slowT > 0 ? 0.45 : 1);
    player.x += vx * v * dt; player.z += vz * v * dt;
    player.ang = Math.atan2(-vz, vx);
  }
  pushOut(player);
}
const pedFree = (x, z) => Math.abs(z) < WALL_Z - 0.45 && Math.abs(x) < 60 && !cars.some(o => o.state !== 'away' && pedPush({ x, z }, o));
const movable = c => c.kind === 'mine' && !c.taken || c.family && c.state === 'parked'; // her cars, and the household's parked ones
const nearestMine = () => { // measured to the nearest collision circle, so the long truck works from either end
  let best = null, bd = 2.2;
  for (const c of cars) if (movable(c)) for (const [x, z, r] of circles(c)) { const d = Math.hypot(x - player.x, z - player.z) - r; if (d < bd) { bd = d; best = c; } }
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
    if (WASH.c) return;
    const d = !binsInHand && nearestDirty();
    if (d) return startWash(d);
    if (c && binsInHand) return toast('Pose d’abord la poubelle (B)');
    if (c?.panne && !c.broken && !c.fixed && Math.random() < c.panne) {
      c.broken = true;
      spotlight(c.x, c.z, 'La BMW est en panne', 'Rrr… rrr… Ta BMW ne démarre pas, comme une fois sur deux. Stéphane le mécano arrive pour la réparer.');
    }
    if (c?.broken) {
      SFX.crank(); floatText('Rrr… rrr… elle démarre pas !', c.x, 3, c.z, '#ffd166');
      const msg = ST.car === c ? 'Stéphane le mécano s’en occupe' : ST.car ? 'Stéphane est occupé, il arrive juste après' : 'Elle ne démarre pas ! Stéphane le mécano arrive';
      callMechanic(c); return toast(msg);
    }
    if (c) {
      driving = c; c.fixed = false; c.speed = 0; c.rest = { x: c.x, z: c.z, ang: c.ang }; person.g.visible = false; SFX.door();
      if (c.family) { if (c.slot) { c.slot.ai = null; c.slot = null; } c.state = 'driven'; } // the AI leaves it alone meanwhile
      if (c.truck) c.smokeT = 8;
      if (c.smoky) { c.cough = 1.4; c.smokeT = 0; SFX.crank(); }
    }
    return;
  }
  const c = driving;
  if (Math.abs(c.speed) > 2) return toast('Ralentis avant de descendre !');
  const t = tidy(c);
  if (t) Object.assign(c, t);
  // exits: beside each collision circle front→back (driver door first), then behind / ahead, then further out
  const cs = Math.cos(c.ang), sn = Math.sin(c.ang), w = c.r + 0.85;
  for (const [a, l] of [...c.circ.flatMap(a => [[a, w], [a, -w]]), [-c.len / 2 - 0.8, 0], [c.len / 2 + 0.8, 0], [0, w + 1], [0, -w - 1]]) {
    const x = c.x + cs * a - sn * l, z = c.z - sn * a - cs * l;
    if (!pedFree(x, z)) continue;
    player.x = x; player.z = z; c.speed = 0; driving = null; person.g.visible = true; SFX.door();
    if (c.family) return settleFamily(c);
    if (!slots.some(s => covers(c, s))) return sendHome(c);
    const n = slots.filter(s => covers(c, s) && (!s.ai || s.ai.state === 'drive')).length;
    if (n) { floatText(n > 1 ? `${n} places bloquées !` : 'Place bloquée !', c.x, c.markY + 0.4, c.z, '#ffd166'); puff(c.x, c.z, 4 + n, '#fff3c4'); SFX.block(); }
    return;
  }
  toast('Pas la place de descendre ici');
}
// a household car Erika moved parks again in the bay it now covers (or goes back where it was), then carries on as before
function settleFamily(c) {
  const bay = () => slots.find(q => covers(c, q) && (!q.ai || q.ai.state === 'drive'));
  let s = bay();
  if (!s) { sendHome(c); s = bay(); }
  if (s?.ai) { s.ai.slot = null; s.ai = null; } // a stranger heading for it looks elsewhere
  Object.assign(c, { state: 'parked', slot: s ?? null, speed: 0 });
  if (s) s.ai = c;
  floatText(`Voiture de ${c.name} déplacée`, c.x, c.markY + 0.4, c.z, '#c9a7ff');
}
// a car left on the road goes back to where it was parked (or the nearest free spot if that's been taken)
function sendHome(c) {
  const ok = t => carPen(c, t.x, t.z, t.ang) === 0 && !slots.some(s => covers({ ...c, ...t }, s) && s.ai && s.ai.state !== 'drive');
  const spots = slots.flatMap(s => [s.x, s.x + SLOT_LEN / 2].map(x => ({ x, z: parkZ(c, s.side), ang: 0 })))
    .sort((a, b) => Math.hypot(a.x - c.rest.x, a.z - c.rest.z) - Math.hypot(b.x - c.rest.x, b.z - c.rest.z));
  const t = [c.rest, ...spots].find(t => (t === c.rest || slots.some(s => covers({ ...c, ...t }, s))) && ok(t));
  if (!t) return toast('Ta voiture bloque la rue !');
  puff(c.x, c.z, 8, '#fff3c4');
  Object.assign(c, t);
  puff(c.x, c.z, 8, '#fff3c4');
  floatText('Retour à sa place', c.x, c.markY + 0.4, c.z, '#ffd166');
  pushOut(player);
}
// dirty neighbour / household cars: mud on the doors and soap bubbles above; Erika washes one (E, 2.5 s) for credits
const WASH_PAY = 150, WASH = { c: null, t: 0, fx: 0 };
MARK.dirty = markerMat('#8a6a48', g => { for (const [x, y, r] of [[50, 74, 20], [80, 54, 14], [78, 86, 10], [56, 42, 8]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }); // soap bubbles
function setDirty(c, on) {
  c.dirty = on;
  if (on && !c.mud) {
    c.mud = new THREE.Group(); c.body.add(c.mud);
    const mud = () => pick(['#9a7a55', '#a8875f', '#7d6448']);
    for (let i = 0; i < 16; i++) box(c.mud, rand(0.3, 0.7), rand(0.12, 0.3), 0.02, mud(), rand(-c.len / 2 + 0.4, c.len / 2 - 0.4), rand(0.45, 0.95), pick([-1, 1]) * (c.bw + 0.01));
    for (const k of [-1, 1]) for (let i = 0; i < 3; i++) box(c.mud, 0.02, rand(0.12, 0.25), rand(0.3, 0.6), mud(), k * (c.len / 2 + 0.01), rand(0.4, 0.7), rand(-c.bw + 0.3, c.bw - 0.3)); // bumpers
    c.dirtTag = new THREE.Sprite(MARK.dirty); c.dirtTag.scale.setScalar(0.8); c.dirtTag.renderOrder = 5; c.dirtTag.position.y = c.markY + 1; c.mesh.add(c.dirtTag);
  }
  if (c.mud) c.mud.visible = c.dirtTag.visible = on;
}
const nearestDirty = () => cars.find(c => c.dirty && c.state === 'parked' && circles(c).some(([x, z, r]) => Math.hypot(x - player.x, z - player.z) - r < 2.2));
function startWash(c) {
  Object.assign(WASH, { c, t: 2.5, fx: 0 }); player.moving = false;
  floatText('Frotte, frotte !', player.x, 3.4, player.z, '#cfe9ff');
}
function wash(dt) {
  const c = WASH.c;
  if (c.state !== 'parked') { WASH.c = null; return toast(`${c.name} est parti avant la fin du lavage !`); }
  if ((WASH.fx -= dt) <= 0) { WASH.fx = 0.2; puff(c.x + rand(-c.len / 2, c.len / 2), c.z, 2, pick(['#ffffff', '#cfe9ff', '#e6f6ff'])); }
  if ((WASH.t -= dt) > 0) return;
  WASH.c = null; setDirty(c, false); score += WASH_PAY; EV.wash++; SFX.buy();
  floatText(`Voiture de ${c.name} toute propre ! +${WASH_PAY}`, c.x, 3.4, c.z, '#8ef0a8');
}
function actionB() {
  if (driving || WASH.c) return;
  const b = binsInHand;
  if (!b) {
    const n = nearBin();
    if (!n) return toast('Approche-toi d’une poubelle pour la prendre');
    bins.splice(bins.indexOf(n), 1); n.slot = null; binsInHand = n; SFX.door();
    return;
  }
  const side = Math.sign(b.z), walkway = Math.abs(b.z) > CURB_Z, s = walkway ? null : binSlot(), x = s ? s.x : walkway ? sidewalkSpot(b.x, side) : null;
  if (x === null) return toast(walkway ? 'Pas de place pour la poubelle ici' : 'Pousse la poubelle sur une place libre ou sur le trottoir');
  binsInHand = null;
  putBin(b, x, s ? s.z + s.side * 0.35 : side * BIN_Z, s);
  puff(b.x, b.z, 5, '#fff3c4');
  if (s) { floatText('Place bloquée !', b.x, 2.8, b.z, '#ffd166'); SFX.block(); }
  pushOut(player);
}
// Erika's driveway gate: no bay in front of it, new cars are delivered there and she parks them herself
const GARAGE_X = GATES[-1][1];
const garageBusy = me => cars.some(o => o !== me && o.state !== 'away' && Math.abs(o.x - GARAGE_X) < 4.5 && o.z < -2.5);
function buyCar() {
  const price = carPrice();
  if (score < price) return toast(`Une voiture coûte ${fr(price)} crédits`);
  if (garageBusy()) return toast('Déplace d’abord la voiture garée devant ton garage');
  score -= price; carsOwned++;
  deliver([buildBMW, buildPicasso][carsOwned - 2]?.(ENV), MINE_COLORS[(carsOwned - 1) % MINE_COLORS.length]);
  if (carsOwned === 2) cars.at(-1).panne = 0.5; // the BMW won't start one time in two (never right after Stéphane fixed it)
}
// bought cars wait in front of Erika's garage for her to park them; some won't start and Stéphane comes
function deliver(m, color) {
  const c = addCar('mine', color, pick(['hatch', 'mini', 'mpv']), m);
  Object.assign(c, { x: GARAGE_X, z: parkZ(c, -1), ang: 0, broken: Math.random() < 0.35 });
  if (m?.exhaust) Object.assign(c, { exhaust: m.exhaust, smoky: true, smokeT: 0 });
  puff(c.x, c.z, 10, '#fff3c4');
  floatText('Voiture livrée !', c.x, 3.4, c.z, '#ffd166');
  toast('Ta nouvelle voiture t’attend devant ton garage : va la garer !');
  SFX.buy();
  pushOut(player);
}
const FERRARI_PRICE = 10000;
let ferrariOwned = false;
function buyFerrari() {
  if (ferrariOwned) return toast('Tu as déjà la Ferrari');
  if (score < FERRARI_PRICE) return toast(`La Ferrari coûte ${fr(FERRARI_PRICE)} crédits`);
  if (garageBusy()) return toast('Déplace d’abord la voiture garée devant ton garage');
  score -= FERRARI_PRICE; ferrariOwned = true;
  deliver(buildF430(ENV));
}
const TRUCK_PRICE = 2000;
let truckOwned = false;
function buyTruck() {
  if (truckOwned) return toast('Tu as déjà le camion');
  if (score < TRUCK_PRICE) return toast(`Le camion coûte ${fr(TRUCK_PRICE)} crédits`);
  // delivered across two adjacent free bays (same group), nearest the player
  const from = driving || player, free = s => s && !s.ai && (!s.block || s.block === player);
  let best = null, bd = Infinity;
  for (const s of slots) {
    const x = s.x + SLOT_LEN / 2, d = Math.hypot(x - from.x, s.z - from.z);
    if (d < bd && free(s) && free(slots.find(q => q.side === s.side && Math.abs(q.x - s.x - SLOT_LEN) < 0.1))) { bd = d; best = s; }
  }
  if (!best) return toast('Le camion a besoin de deux places libres à la suite');
  score -= TRUCK_PRICE; truckOwned = true;
  const m = buildTruck(ENV), c = addCar('mine', null, null, m);
  Object.assign(c, { x: best.x + SLOT_LEN / 2, z: parkZ(c, best.side), ang: 0, truck: true, exhaust: m.exhaust,
    acc: 3.5, top: 9, turn: 0.3, pivot: 2.8, smokeT: 0, rumbleT: 0, markY: 4.6 });
  c.marker.scale.setScalar(1.4);
  puff(c.x, c.z, 14, '#fff3c4');
  floatText('Camion livré !', c.x, 5, c.z, '#ffd166');
  SFX.buy();
  pushOut(player);
}

// ───────────────────────── paid parking meters and extra bays
// a meter on a group: each of its bays not taken by a stranger earns METER_BONUS more (0.3 → 0.9 base credits/s, × the streak multiplier)
const METER_BONUS = 0.6, meters = [];
let meterRate = 0, baysBought = 0;
const meterPrice = () => 800 * 2 ** meters.length;
const meterGroup = () => { // group nearest Erika without a meter yet
  const from = driving || player, d = g => Math.hypot((g[0].x + g.at(-1).x) / 2 - from.x, g[0].z - from.z);
  return [1, -1].flatMap(s => bayGroups(SLOT_XS[s]).map(xs => slots.filter(q => q.side === s && xs.includes(q.x))))
    .filter(g => !g[0].meter).sort((a, b) => d(a) - d(b))[0];
};
const PAYANT = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(256, g => {
  g.canvas.height = 64; g.fillStyle = '#efefe9'; g.font = '700 50px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PAYANT', 128, 34);
}) });
const PSIGN = new THREE.MeshStandardMaterial({ roughness: 0.5, map: canvasTex(64, g => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1f5fbf'; g.fillRect(3, 3, 58, 58);
  g.fillStyle = '#fff'; g.font = '700 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 32, 35);
}) });
function buildMeter(x, s) { // « horodateur »: grey pay station on a post, screen and card slot on the camera side, blue P sign on top
  const g = new THREE.Group(); g.position.set(x, 0.15, s * (CURB_Z + 0.3)); g.scale.setScalar(1.3); scene.add(g);
  box(g, 0.1, 1.9, 0.1, '#3b4046', 0, 0.95, 0);
  box(g, 0.38, 0.62, 0.3, '#6f7a84', 0, 1.15, 0);
  box(g, 0.42, 0.06, 0.34, '#2c3136', 0, 1.49, 0);
  box(g, 0.02, 0.14, 0.24, '#9fe0b4', 0.2, 1.3, 0); // screen
  box(g, 0.02, 0.03, 0.12, '#ffd166', 0.2, 1.08, 0); // card slot
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), PSIGN); p.position.y = 2.05; p.rotation.y = Math.PI / 4; g.add(p); // faces the camera
  return g;
}
function buyMeter() {
  const grp = meterGroup(), price = meterPrice();
  if (!grp) return toast('Toutes les places ont déjà leur borne');
  if (score < price) return toast(`Une borne coûte ${fr(price)} crédits`);
  score -= price;
  const x = (grp[0].x + grp.at(-1).x) / 2, s = grp[0].side;
  meters.push({ x, z: s * (CURB_Z + 0.3), g: buildMeter(x, s) });
  for (const q of grp) {
    q.meter = true;
    const t = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), PAYANT); t.rotation.x = -Math.PI / 2; t.position.set(q.x, 0.009, s * (SLOT_Z + 0.55)); scene.add(t);
  }
  buildStrip();
  puff(x, s * (CURB_Z + 0.3), 10, '#fff3c4');
  floatText('Borne installée !', x, 3.6, s * SLOT_Z, '#8ecbff');
  toast(`Borne de parking payant : ${grp.length} places rapportent plus`);
  SFX.buy();
}
// extra bays for sale, in this order: clear of the gates (≥2.1 m), of the walkers' crossing at x=30 and of the zebras
// [side, bay centres, price]: every free stretch of curb, clear of gates (2.1 m), walkers' crossings and the zebras;
// sites next to an existing group extend it (contiguous bays, one set of markings)
const BAY_SITES = [[1, [8.1, 13.5], 3000], [-1, [12.7, 18.1], 5000], [1, [24.9], 6000], [1, [42.9], 6000], [-1, [33.5, 38.9, 44.3], 9000]];
const baysPrice = () => BAY_SITES[baysBought]?.[2] ?? Infinity;
function buyBays() {
  const site = BAY_SITES[baysBought], price = baysPrice();
  if (!site) return toast('Plus de places à acheter dans la rue');
  if (score < price) return toast(`Les nouvelles places coûtent ${fr(price)} crédits`);
  score -= price; baysBought++;
  const [s, xs] = site, x = (xs[0] + xs.at(-1)) / 2;
  SLOT_XS[s].push(...xs); SLOT_XS[s].sort((a, b) => a - b); resnap();
  for (const q of xs) addSlot(q, s);
  drawMarkings(); buildStrip();
  for (const q of xs) puff(q, s * SLOT_Z, 8, '#fff3c4');
  floatText(xs.length > 1 ? `${xs.length} nouvelles places !` : 'Nouvelle place !', x, 3.6, s * SLOT_Z, '#ffd166');
  toast(`${xs.length > 1 ? xs.length + ' places supplémentaires tracées' : 'Une place supplémentaire tracée'} ${s < 0 ? 'de ton côté' : 'en face'}, plus loin dans la rue !`);
  SFX.buy();
}

const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyZ: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyQ: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'brake' };
addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (!e.repeat) press(e.code);
});
function press(code) { // one key press, from the keyboard or a touch button
  if (!started) return;
  if (focus) { if (['KeyE', 'Space', 'Enter', 'Escape', 'KeyP'].includes(code)) unfocus(); return; }
  if (code === 'KeyH' || helpOn() && (code === 'KeyP' || code === 'Escape')) return help(!helpOn());
  if (code === 'KeyP') { paused = !paused; $('paused').classList.toggle('hidden', !paused); }
  if (paused) return;
  if (code === 'KeyE') actionE();
  if (code === 'KeyB') actionB();
  if (code === 'KeyM') { muted = !muted; toast(muted ? 'Son coupé' : 'Son activé'); }
  if (code === 'Digit1' || code === 'Numpad1') buyCar();
  if (code === 'Digit2' || code === 'Numpad2') buyTruck();
  if (code === 'Digit3' || code === 'Numpad3') buyFerrari();
  if (code === 'Digit4' || code === 'Numpad4') buyMeter();
  if (code === 'Digit5' || code === 'Numpad5') buyBays();
}
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// touch: a thumb anywhere on the left half of the street is a floating analog stick (square gate: full throttle and full lock together)
const STICK_R = 50, stick = $('stick'), knob = $('knob'), cv = renderer.domElement;
let stickId = null, stick0 = null;
const setStick = (dx, dy) => {
  const d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
  knob.style.transform = d ? `translate(${dx * k}px, ${dy * k}px)` : '';
  Object.assign(keys, { sx: dz(clamp(dx / STICK_R, -1, 1)), sy: dz(clamp(dy / STICK_R, -1, 1)) });
};
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || stickId !== null || e.clientX > innerWidth / 2) return;
  stickId = e.pointerId; stick0 = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId);
  Object.assign(stick.style, { left: e.clientX + 'px', top: e.clientY + 'px' }); stick.classList.add('on');
});
cv.addEventListener('pointermove', e => { if (e.pointerId === stickId) setStick(e.clientX - stick0[0], e.clientY - stick0[1]); });
const stickOff = e => { if (e.pointerId !== stickId) return; stickId = null; setStick(0, 0); stick.classList.remove('on'); stick.style.left = stick.style.top = ''; };
cv.addEventListener('pointerup', stickOff); cv.addEventListener('pointercancel', stickOff);
for (const b of document.querySelectorAll('[data-k]')) b.onpointerdown = e => { e.preventDefault(); press(b.dataset.k); };
const brake = on => e => { e.preventDefault(); keys.brake = on; };
$('tBrake').onpointerdown = brake(true); $('tBrake').onpointerup = $('tBrake').onpointercancel = $('tBrake').onpointerleave = brake(false);
// gamepad (standard layout): left stick or d-pad to move (the car goes where it points), or RT/LT throttle/reverse steered with the stick, A = E, B = B, X brake,
// LB/RB pick a shop item and Y buys it, Start pause, Back help; A or Start on the title card starts.
// Writes keys only when the pad changes, so it never overrides the keyboard or the touch stick.
const SHOP = ['buyCar', 'buyTruck', 'buyFerrari', 'buyMeter', 'buyBays'], PAD = { 0: 'KeyE', 1: 'KeyB', 8: 'KeyH', 9: 'KeyP' };
let padOld = [], padAx = [0, 0, 0], shopI = 0;
function pollPad() {
  const p = [...(navigator.getGamepads?.() || [])].find(Boolean);
  if (!p) return;
  const b = Array.from({ length: 17 }, (_, i) => !!p.buttons[i]?.pressed), old = padOld, hit = i => b[i] && !old[i], tr = i => dz(p.buttons[i]?.value || 0);
  padOld = b;
  const ax = [clamp(dz(p.axes[0] || 0) + b[15] - b[14], -1, 1), clamp(dz(p.axes[1] || 0) + b[13] - b[12], -1, 1), tr(7) - tr(6)];
  if (ax.some((v, i) => v !== padAx[i])) [keys.sx, keys.sy, keys.th] = padAx = ax;
  if (b[2] !== !!old[2]) keys.brake = b[2];
  if (!started) { if (hit(0) || hit(9)) $('title').querySelector('.btns button').click(); return; }
  if (helpOn() && hit(0)) return help(false);
  for (const i in PAD) if (hit(i)) press(PAD[i]);
  if (hit(4) || hit(5)) shopI = (shopI + (hit(5) ? 1 : SHOP.length - 1)) % SHOP.length;
  SHOP.forEach((id, i) => $(id).classList.toggle('pad', i === shopI));
  if (hit(3) && !paused) press('Digit' + (shopI + 1));
}
$('paused').onpointerdown = () => press('KeyP'); // not click: the tap that paused would land on it and resume
$('focus').onpointerdown = $('focusCard').onpointerdown = () => unfocus();
$('buyCar').onclick = e => { buyCar(); e.currentTarget.blur(); };
$('buyTruck').onclick = e => { buyTruck(); e.currentTarget.blur(); };
$('buyFerrari').onclick = e => { buyFerrari(); e.currentTarget.blur(); };
$('buyMeter').onclick = e => { buyMeter(); e.currentTarget.blur(); };
$('buyBays').onclick = e => { buyBays(); e.currentTarget.blur(); };

// ───────────────────────── per-frame bookkeeping
function computeBlocks() {
  for (const s of slots) {
    s.block = null;
    for (const c of cars) if ((c.blocker || c.family && c.state === 'parked') && covers(c, s)) s.block = c; // a household car left across a line holds both bays
    for (const b of bins) if (b.slot === s) s.block = b;
    if (!driving && !s.block && inSlot(player, s)) s.block = player;
    // a blocker cancels a reservation, even mid-manoeuvre: the car rejoins traffic instead of parking through it (Erika: it bounces off her belly)
    if (s.block && s.block !== player && (s.ai?.state === 'drive' || s.ai?.state === 'park')) { s.ai.state = 'drive'; s.ai.slot = null; if (s.ai.kind === 'foreign') s.ai.wantsSlot = false; s.ai = null; }
  }
}
const SLOT_COLORS = { foreign: '#ef476f', neighbour: '#2ec4b6', family: '#9b5de5', mine: '#f4a261', incoming: '#ffb703' };
function paintSlots() {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5);
  for (const s of slots) {
    const ai = s.ai && s.ai.state !== 'drive' ? (s.ai.family ? 'family' : s.ai.kind) : null;
    const kind = ai || (s.block && s.block !== player ? (s.block.family ? 'family' : 'mine') : s.ai?.kind === 'foreign' ? 'incoming' : null);
    s.ov.material.color.set(kind ? SLOT_COLORS[kind] : '#ffffff');
    s.ov.material.opacity = kind === 'foreign' || kind === 'incoming' ? 0.25 + 0.2 * pulse : kind ? 0.3 : 0.07 + 0.08 * pulse;
    s.el.style.background = kind ? SLOT_COLORS[kind] : 'rgba(255,255,255,.18)';
    s.el.style.opacity = kind === 'incoming' ? 0.5 + 0.5 * pulse : 1;
  }
}
function scoring(dt) {
  const stranger = s => s.ai?.kind === 'foreign' && (s.ai.state === 'park' || s.ai.state === 'parked');
  foreignN = slots.filter(stranger).length;
  const safe = slots.length - foreignN;
  if (foreignN === 0) { streak += dt; mult = 3 + Math.min(1.5, Math.floor(streak / 15) * 0.25); }
  else { streak = 0; mult = 1; }
  meterRate = METER_BONUS * slots.filter(s => s.meter && !stranger(s)).length * mult;
  rate = (1 + 0.3 * safe) * mult + meterRate;
  score += rate * dt;
  if (score > best) { best = score; }
}
let hudT = 0, wasProtected = false, trafficLevel = 0;
function hud(dt) {
  if ((hudT -= dt) > 0) return;
  hudT = 0.1;
  $('score').textContent = fr(Math.floor(score));
  $('rate').textContent = `+${fr(rate, 1)} /s` + (meterRate ? ` (bornes +${fr(meterRate, 1)})` : '');
  $('foreign').textContent = foreignN;
  $('neigh').textContent = cars.filter(c => c.kind === 'neighbour' && c.state === 'parked').length;
  $('held').textContent = slots.filter(s => s.block && s.block !== player && !s.block.family).length;
  $('banner').classList.toggle('on', foreignN === 0);
  $('bmult').textContent = `×${mult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`;
  if (foreignN === 0 && !wasProtected) toast('Plus aucun inconnu garé : crédits ×3 !');
  wasProtected = foreignN === 0;
  $('carPrice').textContent = fr(carPrice());
  $('buyCar').disabled = score < carPrice();
  $('truckPrice').textContent = truckOwned ? 'Acheté' : fr(TRUCK_PRICE);
  $('buyTruck').disabled = truckOwned || score < TRUCK_PRICE;
  $('ferrariPrice').textContent = ferrariOwned ? 'Achetée' : fr(FERRARI_PRICE);
  $('buyFerrari').disabled = ferrariOwned || score < FERRARI_PRICE;
  const meterLeft = meterGroup();
  $('meterPrice').textContent = meterLeft ? fr(meterPrice()) : 'Complet';
  $('buyMeter').disabled = !meterLeft || score < meterPrice();
  $('baysPrice').textContent = BAY_SITES[baysBought] ? fr(baysPrice()) : 'Complet';
  $('buyBays').disabled = !BAY_SITES[baysBought] || score < baysPrice();
  $('inv').textContent = nb((binsInHand ? '🗑️ Poubelle en main · B pour la poser' : `À toi : ${carsOwned} voiture${carsOwned > 1 ? 's' : ''}${truckOwned ? ' · le camion' : ''}${ferrariOwned ? ' · la Ferrari' : ''}${meters.length ? ` · 🅿️ ${meters.length}` : ''}`)
    + (boostT > 0 ? ' · 🥖 à fond !' : '') + (slowT > 0 ? ' · 💨 ralentie' : ''));
  const tr = traffic(), tl = tr < 0.3 ? 0 : tr < 0.7 ? 1 : 2;
  if (tl !== trafficLevel) { if (tl === 2) toast('Heure de pointe ! Des voitures partout'); else if (tl === 0 && trafficLevel > 0) toast('La circulation se calme'); trafficLevel = tl; }
  $('traffic').textContent = ['calme', 'chargée', 'heure de pointe'][tl];
  $('trafficDot').style.background = ['#06d6a0', '#ffd166', '#ef476f'][tl];
  let p = '';
  const mine = !driving && nearestMine(), dirty = !driving && !binsInHand && nearestDirty();
  if (WASH.c) p = 'Lavage en cours…';
  else if (driving) { // count what the E-snap will actually block
    const n = slots.filter(s => covers({ ...driving, ...tidy(driving) }, s)).length;
    p = n ? `E — laisser ${driving.truck ? 'le camion' : 'la voiture'} ici (${n} place${n > 1 ? 's bloquées' : ' bloquée'})` : 'E — descendre (retour à sa place)';
  }
  else if (binsInHand) p = Math.abs(binsInHand.z) > CURB_Z ? 'B — laisser la poubelle sur le trottoir' : binSlot() ? 'B — bloquer cette place avec la poubelle' : 'Pousse la poubelle sur une place libre ou sur le trottoir';
  else if (dirty) p = `E — laver la voiture de ${dirty.name} (+${WASH_PAY})`;
  else if (mine) p = mine.family ? `E — déplacer la voiture de ${mine.name}` : `E — conduire ${mine.truck ? 'le camion' : 'cette voiture'}`;
  else if (nearBin()) p = 'B — prendre la poubelle';
  $('prompt').textContent = started ? nb(p) : '';
  $('tE').classList.toggle('ready', p.startsWith('E')); $('tB').classList.toggle('ready', p.startsWith('B'));
  $('tBrake').classList.toggle('off', !driving); $('tMute').textContent = muted ? '🔇' : '🔊';
  coach();
  try { if (Math.floor(best) > (+localStorage.getItem('parkingGuardBest') || 0)) localStorage.setItem('parkingGuardBest', Math.floor(best)); } catch {}
}
// turn signal (world z side) for a car heading for a bay, pulling into it, or pulling out of it
function blinkSide(c) {
  const z = c.state === 'park' ? c.path[3][1] : c.state === 'leave' ? -c.path[0][1] : c.state === 'drive' ? c.slot?.z ?? (c === J && !J.leaving ? J.goal?.z : 0) : 0;
  return Math.sign(z || 0);
}
function sync(dt) {
  for (const c of cars) {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.ang;
    c.body.position.y = Math.abs(c.speed) > 0.3 ? Math.sin(elapsed * 17 + c.id) * 0.02 : 0;
    if (c.flames) c.flames.visible = (c.flameT -= dt) > 0;
    c.marker.visible = c.kind !== 'foreign' || c.state === 'park' || c.state === 'parked';
    c.marker.position.y = c.markY + Math.sin(elapsed * 3 + c.id) * 0.12;
    if (c.kind === 'neighbour') { // a pulsing "P?" while they look for a bay; household cars in purple
      const seek = c.wantsSlot && ['arrive', 'turn', 'drive'].includes(c.state);
      c.marker.material = seek ? (c.family ? MARK.famSeek : MARK.seek) : c.family ? MARK.family : MARK.neighbour;
      c.marker.scale.setScalar(seek ? 1.15 + 0.2 * Math.sin(elapsed * 8) : 0.9);
    }
    const bs = Math.sign(Math.cos(c.ang)) * blinkSide(c), on = Math.sin(elapsed * 10) > 0;
    for (const k of [-1, 1]) for (const b of c.blink[k]) b.visible = on && bs === k;
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
  if (driving) drive(driving, dt); else if (WASH.c) wash(dt); else walk(dt);
  computeBlocks();
  for (const c of [...cars]) if (c.kind !== 'mine' && c.kind !== 'jack' && c !== driving) updateAI(c, dt);
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
// free sidewalk x near x on side s: clear of gates, utility poles and other sidewalk bins
function sidewalkSpot(x, s) {
  for (let k = 0; k < 25; k++) {
    const t = x + (k & 1 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
    if (Math.abs(t) < STREET_X - 1 && GATES[s].every(g => Math.abs(t - g) > 2.2) && (s !== Math.sign(POLE_Z) || POLE_XS.every(p => Math.abs(t - p) > 0.8)) && bins.every(b => b.slot || Math.sign(b.z) !== s || Math.abs(b.x - t) > 1)) return t;
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
    floatText(pick(['Ces poubelles !', 'Pas sur la place !', 'Oh là là…']), red.x, 2.8, red.z, '#ffb4a2'); EV.valerie++;
    spotlight(red.x, red.z, 'Valérie retire ta poubelle', 'Le compte à rebours est fini : Valérie, la voisine rousse, remet la poubelle sur le trottoir. La place est libre ! Repose-la ailleurs, ou gare une voiture à la place.');
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
      floatText('Jack : Je te garde la place, Erika !', J.x, 3.4, J.z, '#b8f28a'); EV.jack++;
      spotlight(J.x, J.z, 'Jack te garde des places', 'Le vieux Jack a garé sa voiture beige à cheval sur deux places pour toi. Il rentre à pied et reviendra la chercher plus tard.', true);
      go(jw, route(jw.x, jw.z, JACK_GATE, -WALL_Z - 1.6), () => { jw.g.visible = false; J.phase = 'visit'; J.wait = rand(60, 90); });
      return;
    }
    case 'drive': {
      if (crossStreet(J, dt)) return;
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
      if ((v = exitGate(J, v, () => Object.assign(J, { state: 'away', phase: J.leaving ? 'gone' : 'round', wait: J.leaving ? rand(10, 25) : 4 }).mesh.visible = false)) < 0) return;
      J.speed += clamp(v - J.speed, -14 * dt, 5 * dt);
      J.x += J.speed * dt; J.z -= J.z * Math.min(1, dt * 3); J.ang = 0;
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
        floatText('Je prends la voiture, chéri !', k.x, 3.4, k.z, '#f1c0e8'); if (nearPlayer(k.x, k.z)) SFX.door(); EV.wife++;
        spotlight(k.x, k.z, 'Ta femme emprunte une voiture', 'Elle part faire un tour avec une de tes voitures : la place qu’elle gardait se libère ! Elle la ramènera devant ton garage, à toi de la regarer.', true);
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
      if (crossStreet(c, dt)) return;
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
      if ((v = exitGate(c, v, () => { c.state = 'away'; c.mesh.visible = false; W.phase = 'away'; W.wait = W.back ? 4 : rand(25, 50); })) < 0) return; // garage blocked: another lap
      c.speed += clamp(v - c.speed, -14 * dt, 5 * dt);
      c.x += c.speed * dt; c.z -= c.z * Math.min(1, dt * 3); c.ang = 0;
    }
  }
}

// little events: a baguette on the sidewalk (speed boost), « le père » (Valérie's husband, opposite) coming out to fart next to Erika (slowdown)
const baguette = new THREE.Group(), BAG = { t: rand(20, 35) };
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
      baguette.visible = false; boostT = 8; BAG.t = rand(25, 45); SFX.buy(); EV.baguette++;
      floatText('Baguette ! Erika file !', player.x, 3.4, player.z, '#ffd166');
    }
  } else if ((BAG.t -= dt) <= 0) {
    const s = pick([-1, 1]), x = sidewalkSpot(rand(-45, 45), s);
    if (x === null) BAG.t = 2;
    else { b.set(x, 0.6, s * (CURB_Z + WALL_Z) / 2); baguette.visible = true; puff(b.x, b.z, 4, '#fff3c4'); }
  }
  if (PA.phase === 'home') {
    if ((PA.t -= dt) > 0 || driving) return;
    [pa.x, pa.z] = PA_HOME; Object.assign(PA, { phase: 'chase', give: 25, reroute: 0 }); // Erika can shake him off
  } else if (PA.phase === 'chase') {
    if ((PA.give -= dt) <= 0 || driving) {
      floatText('Bon… je rentre !', pa.x, 2.8, pa.z, '#c7e8a0');
      if (!driving) toast('Tu as semé le père : il rentre chez lui');
      EV.pere++; return paGoHome();
    }
    if (Math.hypot(player.x - pa.x, player.z - pa.z) < 1.3) {
      slowT = 6; SFX.fart(); puff(pa.x, pa.z, 12, '#9ccf5a');
      floatText('Prrrrout !', pa.x, 2.8, pa.z, '#9ccf5a'); floatText('Oh non, le père !', player.x, 3.8, player.z, '#ffd166');
      EV.fart++; EV.pere++;
      spotlight(pa.x, pa.z, 'Le père t’a pété dessus !', 'Prrrrout ! Le père, le mari de Valérie, t’a lâché une caisse à côté : tu marches au ralenti pendant 6 secondes. La prochaine fois, sème-le !');
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
  c.broken = false; c.fixed = true; SFX.free();
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
  computeBlocks(); // he may have parked on the last frame, after this frame's block pass
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
  Object.assign(player, { x: 0, z: 0 }); // off the sidewalks, so the baguette can't spawn right under her
  BAG.t = 0; window.__game.step(0.1); ok(baguette.visible, 'baguette appears');
  Object.assign(player, { x: baguette.position.x, z: baguette.position.z }); window.__game.step(0.1);
  ok(boostT > 0 && !baguette.visible, 'baguette picked up: speed boost');
  Object.assign(player, { x: RED_GATE + 3, z: SW }); // near his gate: he reaches her well within his 25 s
  PA.t = 0; ok(until(60, () => slowT > 0), 'father farts next to Erika: slowdown');
  ok(until(60, () => PA.phase === 'home'), 'father back home'); slowT = 0;
  Object.assign(player, { x: 48, z: 5.5 }); PA.t = 0;
  ok(until(40, () => PA.phase === 'back') && slowT <= 0, 'Erika shakes him off: he goes home');
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
// self-check: a meter raises the rate of its group (not for a bay a stranger sits in); bought bays are painted, snap, get blocked and are used by strangers. Returns 'ok' or throws.
function selfTestEconomy() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestEconomy: ' + m); };
  const until = (sec, f) => { for (let t = 0; t < sec && !f(); t += 0.2) window.__game.step(0.2); return f(); };
  if (driving) { driving.speed = 0; actionE(); }
  W.wait = PA.t = chatT = BAG.t = 1e9; score = 1e5;
  for (const c of cars.filter(c => c.kind === 'foreign')) leaveStreet(c);
  scoring(0); const r0 = rate, n0 = slots.length;
  buyMeter(); const g = slots.filter(s => s.meter);
  ok(meters.length === 1 && g.length >= 2 && score === 1e5 - 800 && meterPrice() === 1600, 'meter bought, next one costs more');
  ok(g.every(s => s.el.classList.contains('m')), 'strip marks the metered bays');
  scoring(0); ok(Math.abs(rate - r0 - METER_BONUS * g.length * mult) < 1e-9 && meterRate > 0, 'metered bays earn more');
  const f = addCar('foreign', '#888', 'hatch'); placeParked(f, g[0], 999); scoring(0);
  ok(mult === 1 && Math.abs(meterRate - METER_BONUS * (g.length - 1)) < 1e-9, 'no bonus for a bay a stranger sits in');
  leaveStreet(f);
  buyBays(); ok(slots.length === n0 + 2 && baysPrice() === 5000, 'first bays bought, next ones cost more');
  for (let i = 1; i < BAY_SITES.length; i++) buyBays();
  const sc = score; buyBays();
  ok(slots.length === n0 + BAY_SITES.reduce((n, st) => n + st[1].length, 0) && score === sc, 'every site bought, then nothing left to buy');
  ok([1, -1].every(sd => bayGroups(SLOT_XS[sd]).every(gp => gp.every((x, i) => !i || Math.abs(x - gp[i - 1] - SLOT_LEN) < 1e-9))), 'bought bays extend groups cleanly');
  hud(1); ok($('buyBays').disabled && $('baysPrice').textContent === 'Complet', 'shop says sold out');
  for (const sd of [1, -1]) ok(SLOT_XS[sd].every((x, i, a) => !i || x - a[i - 1] >= SLOT_LEN - 1e-9), 'no overlapping bays');
  const nb = slots.slice(n0);
  ok(nb.every(s => GATES[s.side].every(x => Math.abs(x - s.x) >= SLOT_LEN / 2 + 2.1) && CROSS_XS.every(x => Math.abs(x - s.x) >= SLOT_LEN / 2 + 0.5)
    && Math.abs(s.x) + SLOT_LEN / 2 < 47.5 && s.el.isConnected && SNAP_XS[s.side].includes(s.x)), 'new bays clear of gates, crossings and zebras, in the strip and E-snap');
  const [a, b] = nb, mine = cars.find(c => c.kind === 'mine' && !c.taken && !c.truck);
  ok(snapX(a.side, a.x + 2) === a.x + SLOT_LEN / 2, 'E-snap on the line between two new bays');
  Object.assign(mine, { x: a.x + SLOT_LEN / 2, z: parkZ(mine, a.side), ang: 0 }); computeBlocks();
  ok(a.block === mine && b.block === mine, 'a car across the line blocks both new bays');
  const t = nb[2], c = addCar('foreign', '#888', 'hatch');
  Object.assign(player, { x: -40, z: -6 });
  Object.assign(c, { x: t.x - 10.2, z: 0, speed: 4, state: 'drive', wantsSlot: true, slot: null, scan: 0 });
  ok(findSlot(c) === t, 'strangers look for the new bays');
  ok(until(20, () => c.state === 'parked' && c.slot === t && foreignN > 0), 'a stranger parks in a new bay');
  Object.assign(player, { x: t.x, z: -6 }); buyMeter();
  ok(t.meter && meters.length === 2, 'the nearest group, a new one, gets the next meter');
  return 'ok';
}
// self-check: arrivals mix (70/20/10), Erika moving a household car, the "P?" marker, turn signals. Returns 'ok' or throws.
function selfTestFamily() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestFamily: ' + m); };
  if (driving) { driving.speed = 0; actionE(); }
  W.wait = PA.t = chatT = BAG.t = 1e9;
  const nbs = cars.filter(c => c.kind === 'neighbour');
  let nb = 0, fam = 0; const N = 3000;
  for (let i = 0; i < N; i++) {
    for (const c of nbs) if (c.state === 'away') Object.assign(c, { back: -1, timer: Infinity });
    const n0 = cars.length; spawnT = 0; spawner(0);
    const called = nbs.find(c => c.state === 'away' && c.timer === 0);
    if (called) called.family ? fam++ : nb++;
    for (const c of cars.slice(n0)) { scene.remove(c.mesh); cars.splice(cars.indexOf(c), 1); }
  }
  ok(Math.abs(nb / N - 0.2) < 0.04 && Math.abs(fam / N - 0.1) < 0.03, `arrivals mix: ${nb} neighbours, ${fam} household out of ${N}`);
  for (const c of nbs) if (c.state === 'away') c.timer = Infinity;
  const k = nbs.find(c => c.name === 'Kévin'), [q1, q2] = slots.filter(s => !s.ai && !s.block && s.side === 1);
  if (k.slot) { k.slot.ai = null; k.slot = null; }
  placeParked(k, q1, 999); k.mesh.visible = true;
  Object.assign(player, { x: k.x, z: k.z + k.r + 0.5 }); actionE();
  ok(driving === k && k.state === 'driven' && !q1.ai, 'Erika drives a household car');
  Object.assign(k, { x: q2.x, z: parkZ(k, q2.side), ang: 0, speed: 0 }); actionE();
  ok(!driving && k.state === 'parked' && k.slot === q2 && q2.ai === k, 'it stays parked where she left it');
  const v = nbs.find(c => c !== k && c.state === 'away'); Object.assign(v, { state: 'drive', wantsSlot: true, x: -40, z: 0, ang: 0 });
  const f = addCar('foreign', '#888', 'hatch'), q3 = slots.find(s => !s.ai && !s.block && s.side === -1);
  Object.assign(f, { state: 'drive', x: q3.x - 15, z: 0, ang: 0, slot: q3 }); q3.ai = f;
  elapsed = 0.05; sync(0);
  ok(v.marker.material === (v.family ? MARK.famSeek : MARK.seek), 'P? marker on a neighbour looking for a bay');
  ok(f.blink[-1].every(b => b.visible) && f.blink[1].every(b => !b.visible), 'left signal on for a bay on the left');
  return 'ok';
}
// self-check: the Seat floors it (much faster than the others), smokes and pops with flames. Returns 'ok' or throws.
function selfTestSeat() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestSeat: ' + m); };
  if (driving) { driving.speed = 0; actionE(); }
  Object.assign(player, { x: 0, z: -6 });
  const c = addSeat(), o = addCar('foreign', '#888', 'hatch');
  for (const [q, z] of [[c, -46], [o, -46]]) Object.assign(q, { state: 'drive', x: z, z: 0, ang: 0, speed: 0, wantsSlot: false, slot: null });
  o.z = 99; // out of the way
  const s0 = smoke.filter(q => q.m.visible).length;
  window.__game.step(1);
  ok(c.speed > 10 && c.speed >= c.cruise - 0.5, `the Seat floors it (${c.speed.toFixed(1)} m/s after 1 s; others manage 5)`);
  ok(smoke.filter(q => q.m.visible).length > s0 + 10, 'black smoke when accelerating');
  let flames = false; c.popN = 4; c.popT = 0;
  for (let i = 0; i < 20; i++) { window.__game.step(1 / 30); flames ||= c.flames.visible; }
  ok(flames && c.popN === 0, 'pops and bangs with flames');
  return 'ok';
}
// self-check: a household car left across a line holds both bays; a stranger turned away leaves the street; neighbours take the
// first free bay ahead; no sidewalk bin on a utility pole; the baguette waits to be picked up. Returns 'ok' or throws.
function selfTestStreet() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestStreet: ' + m); };
  if (driving) { driving.speed = 0; actionE(); }
  W.wait = PA.t = chatT = 1e9;
  ok(bins.every(b => b.slot || Math.sign(b.z) !== Math.sign(POLE_Z) || POLE_XS.every(p => Math.abs(b.x - p) > 0.8)), 'no bin on a utility pole');
  for (const c of cars.filter(c => c.kind === 'foreign')) leaveStreet(c);
  const k = cars.find(c => c.name === 'Kévin'), [a, b] = slots.filter((q, i, l) => q.side === 1 && bayFree(q) && l.some(r => r.side === 1 && bayFree(r) && Math.abs(r.x - q.x - SLOT_LEN) < 0.1))
    .map(q => [q, slots.find(r => r.side === 1 && Math.abs(r.x - q.x - SLOT_LEN) < 0.1)])[0];
  if (k.slot) { k.slot.ai = null; k.slot = null; }
  placeParked(k, a, 999); k.mesh.visible = true;
  Object.assign(player, { x: k.x, z: k.z + k.r + 0.5 }); actionE();
  Object.assign(k, { x: a.x + SLOT_LEN / 2, z: parkZ(k, 1), ang: 0, speed: 0 }); actionE(); computeBlocks();
  ok(!driving && [a, b].every(q => q.ai === k || q.block === k), 'household car across a line holds both bays');
  Object.assign(player, { x: 0, z: 0 }); computeBlocks();
  const n = cars.find(c => c.kind === 'neighbour' && c.state === 'away'), free = slots.filter(q => bayFree(q) && q.x - (-40) >= 10 && q.x - (-40) <= 45);
  Object.assign(n, { x: -40, z: 0, dir: 1, home: 40 }); // home: the old rule aimed for the bay nearest their house
  ok(findSlot(n) === free.sort((p, q) => p.x - q.x)[0], 'neighbour takes the first free bay ahead');
  const f = addCar('foreign', '#888', 'hatch'), q = slots.find(s => bayFree(s) && Math.abs(s.x) < 40);
  Object.assign(f, { x: q.x - 8, z: 0, speed: 4, slot: q, state: 'drive', wantsSlot: true }); q.ai = f; startPark(f);
  Object.assign(player, { x: bez(f.path, 0.3, 0), z: bez(f.path, 0.3, 1) });
  for (let t = 0; t < 5 && f.state !== 'drive'; t += 0.1) window.__game.step(0.1);
  ok(f.state === 'drive' && !f.wantsSlot && !f.slot, 'stranger turned away drives on');
  Object.assign(player, { x: 0, z: 0 }); BAG.t = 0; window.__game.step(0.1); ok(baguette.visible, 'baguette appears');
  window.__game.step(40); ok(baguette.visible, 'baguette still there 40 s later');
  return 'ok';
}
queueMicrotask(() => Object.assign(window.__game, { selfTestStreet, selfTestSeat, selfTestFamily, selfTestEconomy, selfTestMechanic, jack: J, jw, red, W, PA, pa, mech, walkers, held: () => binsInHand, selfTestNeighbours, selfTestWife, selfTestEvents, selfTestTuto })); // after __game exists

// ───────────────────────── setup
function setup() {
  const start = slots.find(s => s.side === -1 && s.x === -30.2);
  const mine = addCar('mine', null, null, buildSpring(ENV)); // her first car: the grey Dacia Spring
  Object.assign(mine, { x: start.x, z: start.z, ang: parkedAng(start) });
  player.x = start.x + 1.2; player.z = -6.2;
  computeBlocks();
  const freeSlot = () => pick(slots.filter(s => !s.ai && !s.block));
  NEIGHBOURS.forEach((n, i) => {
    const c = addCar('neighbour', n.color, n.type, n.model?.(ENV));
    Object.assign(c, { name: n.name, dented: n.dented, family: n.family, back: rand(10, 40) });
    if (i < 3) { placeParked(c, freeSlot(), rand(30, 120)); if (i !== 1) setDirty(c, true); }
    else { c.state = 'away'; c.timer = Infinity; c.mesh.visible = false; } // the spawner calls them home
  });
  for (const s of [1, -1]) for (const g of GATES[s]) for (const dx of Math.random() < 0.25 ? [2.4, 3.5] : [2.4])
    putBin(newBin('#4b4f55', pick(['#7a2b35', '#3d5a44', '#e0c53a'])), sidewalkSpot(g + dx, s) ?? g + dx, s * BIN_Z);
  for (let i = 0; i < 2; i++) placeParked(addCar('foreign', pick(AI_COLORS), pick(['hatch', 'mpv', 'suv', 'mini'])), freeSlot(), rand(20, 90));
  camTarget.set(player.x, 0, player.z);
  scoring(0); // initialise HUD counters before the first tick
}
setup();
$('best').textContent = best ? nb(`Meilleur score : ${fr(Math.floor(best))}`) : '';
$('start').onclick = () => {
  started = true; try { actx = new AudioContext(); } catch {} $('title').classList.add('hidden', 'ingame');
  if (TOUCH) document.documentElement.requestFullscreen?.().catch(() => {}); // hides the browser bars (no-op on iPhone)
  if (tutoI < 0) toast('Va jusqu’à ta Dacia grise et appuie sur E');
};

// ───────────────────────── tutorial: a coach panel shows one step at a time; a step is done when the game state says so
let tutoI = -1, tutoDone = false, tutoFrom = null; // tutoI: current step, -1 = off; tutoFrom: where Erika stood when it began
try { tutoDone = !!localStorage.getItem('parkingGuardTuto'); } catch {}
const mineCars = () => cars.filter(c => c.kind === 'mine');
const moved = c => c.rest && Math.hypot(c.x - c.rest.x, c.z - c.rest.z) > 2 && slots.some(s => s.block === c); // driven elsewhere and left in a bay
// the yellow arrow bobbing over what the current step is about (tip at its position)
const ARROW = new THREE.Group();
for (const [k, color] of [[1.18, '#2a1f05'], [1, '#ffb703']]) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.45 * k, 1.2 * k, 4).rotateX(Math.PI).translate(0, 0.6 * k - 0.1 * (k - 1), 0), new THREE.MeshBasicMaterial({ color, depthTest: false, side: k > 1 ? THREE.BackSide : THREE.FrontSide }));
  m.renderOrder = 12; ARROW.add(m);
}
ARROW.scale.setScalar(1.5); ARROW.visible = false; scene.add(ARROW);
let TU = {}, tutoEV = EV, tutoT0 = 0; // per-step scratch, event counts and game time when the step began
const did = k => EV[k] > tutoEV[k];
const at = (o, y) => o && { x: o.x, z: o.z, y }; // arrow target
const nearest = (list, o) => list.reduce((b, q) => !b || Math.hypot(q.x - o.x, q.z - o.z) < Math.hypot(b.x - o.x, b.z - o.z) ? q : b, null);
const nearBay = o => nearest(slots.filter(bayFree), o);
const shown = w => w.g.visible && w;
const looseBin = () => at(nearest(bins.filter(b => !b.slot), player), 2.6);
function dropBaguette() {
  const s = Math.sign(player.z) || -1;
  baguette.position.set(sidewalkSpot(player.x + 3, s) ?? player.x + 3, 0.6, s * (CURB_Z + WALL_Z) / 2); baguette.visible = true;
  puff(baguette.position.x, baguette.position.z, 4, '#fff3c4');
}
function tutoChat() { // keep one car coming down the street that will stop next to Erika
  if (did('chat')) return;
  chatT = 0;
  if (TU.car && cars.includes(TU.car)) return;
  const c = addCar('foreign', pick(AI_COLORS), 'hatch');
  if (enterStreet(c)) { c.wantsSlot = false; TU.car = c; } else { scene.remove(c.mesh); cars.pop(); }
}
function dirtyOne() { // make sure there's a dirty car to wash, close to Erika
  if (did('wash') || cars.some(c => c.dirty && c.state === 'parked')) return;
  const c = nearest(cars.filter(c => c.kind === 'neighbour' && c.state === 'parked'), player), n = cars.find(c => c.kind === 'neighbour' && c.state === 'away'), s = nearBay(player);
  if (c) setDirty(c, true);
  else if (n && s) { placeParked(n, s, rand(60, 120)); n.mesh.visible = true; setDirty(n, true); }
}
const TUTO = [ // t: title, x: text (html, or a function), done?, at: arrow target, go: on entry, tick: every HUD refresh
  { t: 'Marche un peu', x: 'Tu es Erika, avec l’anneau jaune. Déplace-toi avec <kbd>ZQSD</kbd> ou les <kbd>flèches</kbd>.', done: () => driving || Math.hypot(player.x - tutoFrom.x, player.z - tutoFrom.z) > 4 },
  { t: 'Monte dans ta voiture', x: 'Va jusqu’à ta Dacia grise (sous la flèche) et appuie sur <kbd>E</kbd> pour monter. Ensuite, <kbd>ZQSD</kbd> ou les <kbd>flèches</kbd> pour conduire, <kbd>Espace</kbd> pour freiner.',
    done: () => driving, at: () => at(mineCars()[0], 4.3) },
  { t: 'Bloque une autre place', x: 'Roule jusqu’à une place libre (sous la flèche) et appuie sur <kbd>E</kbd> : la voiture s’y range et tu descends. « Place bloquée ! » Garée à cheval sur la ligne, elle en bloque deux.',
    done: () => !driving && mineCars().some(moved), at: () => driving && at(nearBay(driving), 1.6) },
  { t: 'Attrape une poubelle', x: 'Les poubelles aussi bloquent une place. Approche-toi d’une poubelle sur le trottoir (sous la flèche) et appuie sur <kbd>B</kbd>.', done: () => binsInHand, at: looseBin },
  { t: 'Pousse-la sur une place', x: 'Pousse-la sur une place libre (sous la flèche) et appuie sur <kbd>B</kbd> pour la poser : la place est bloquée et un compte à rebours démarre.',
    done: () => bins.some(b => b.slot), at: () => binsInHand ? at(binSlot() ?? nearBay(player), 1.6) : looseBin() },
  { t: 'Valérie et les poubelles', x: 'À zéro, Valérie, la voisine rousse d’en face, vient remettre la poubelle sur le trottoir. Regarde-la faire !',
    tick: () => { if (!did('valerie')) for (const b of bins) if (b.slot) b.t = Math.min(b.t, 4); }, done: () => did('valerie') && !focus,
    at: () => at(shown(red), 3.2) || at(bins.find(b => b.slot), 3.2) },
  { t: 'Une baguette !', x: 'Une baguette est tombée sur le trottoir : marche dessus pour la ramasser, tu cours plus vite pendant quelques secondes.',
    go: dropBaguette, done: () => did('baguette'), at: () => baguette.visible && at(baguette.position, 1.6) },
  { t: 'Le père', x: 'Le père, le mari de Valérie, sort de chez lui pour te courir après et péter à côté de toi : tu marches au ralenti. Sème-le assez longtemps et il rentre… ou laisse-toi attraper pour voir !',
    tick: () => { if (!did('pere') && PA.phase === 'home') PA.t = 0; }, done: () => did('pere') && !focus, at: () => at(shown(pa), 3) },
  { t: 'Les potins du quartier', x: 'Va au bord de la route, à pied : une voiture va s’arrêter pour te raconter les potins du quartier. Pendant ce temps, elle bloque la circulation !',
    tick: tutoChat, done: () => did('chat') && !focus, at: () => TU.car?.mesh.visible && at(TU.car, 3.6) },
  { t: 'Jack', x: 'Le vieux Jack, ton voisin, sort sa voiture beige et la gare à cheval sur deux places pour te les garder. Merci Jack !',
    tick: () => { if (!did('jack') && ['home', 'gone', 'round', 'visit'].includes(J.phase)) J.wait = Math.min(J.wait, 0.5); }, done: () => did('jack') && !focus,
    at: () => J.mesh.visible && J.state !== 'away' ? at(J, 4.3) : at(shown(jw), 3) },
  { t: 'Ta femme', x: 'Ta femme emprunte parfois une de tes voitures : la place qu’elle gardait se libère ! Elle la ramène plus tard devant ton garage.',
    tick: () => { if (!did('wife') && W.phase === 'home') W.wait = Math.min(W.wait, 0.5); }, done: () => did('wife') && !focus, at: () => at(shown(ww), 3) || W.car && at(W.car, 4.3) },
  { t: 'La Seat noire', x: 'Voilà la Seat noire portugaise : elle fonce, crache de la fumée noire et pétarade. C’est un inconnu comme les autres : ne lui laisse pas de place !',
    tick: () => { if (!cars.some(o => o.seat)) { const c = addSeat(); if (!enterStreet(c)) { scene.remove(c.mesh); cars.pop(); } } },
    done: () => elapsed - tutoT0 > 15, at: () => at(cars.find(o => o.seat && o.mesh.visible), 4) },
  { t: 'Achète une voiture', shop: true, x: () => `Tu gagnes des crédits en continu, trois fois plus vite quand aucun inconnu n’est garé. La boutique est en bas à droite : achète une voiture (touche <kbd>1</kbd>) dès que tu as ${fr(carPrice())} crédits${score < carPrice() ? ` (encore ${fr(Math.ceil(carPrice() - score))})` : ', c’est bon !'}.`,
    done: () => carsOwned > 1 },
  { t: 'Gare ta BMW', x: 'Ta BMW est livrée devant ton garage, mais elle tombe en panne une fois sur deux ! Appuie sur <kbd>E</kbd> : si elle ne démarre pas, Stéphane le mécano arrive la réparer. Ensuite, gare-la sur une place libre.',
    go: () => { const c = TU.car = mineCars().find(c => c.panne) ?? mineCars().at(-1); if (c.panne && !c.rest) c.broken = true; }, // show the breakdown
    done: () => mineCars().slice(1).some(moved), at: () => driving ? at(nearBay(driving), 1.6) : at(TU.car, 4.3) },
  { t: 'Lave les voitures sales', x: `Des voitures des voisins et de ta famille sont sales : boue sur les portières et bulles marron au-dessus. Approche-toi et appuie sur <kbd>E</kbd> pour la laver : +${WASH_PAY} crédits !`,
    tick: dirtyOne, done: () => did('wash'), at: () => !WASH.c && at(nearest(cars.filter(c => c.dirty && c.state === 'parked'), player), 5.2) },
  { t: 'Qui est qui dans la rue', x: '<ul><li>Les <b>inconnus</b> (rouge) : −10 chacun quand ils se garent.</li><li>Les <b>voisins</b> (turquoise) doivent trouver une place, sinon −100.</li>'
    + '<li>Les conducteurs qui s’arrêtent te parlent de <b>Jean-Marie</b> ton patron, de sa sœur <b>Raymonde</b>, de ton ami <b>Jean-Claude</b> et de <b>Dalila</b>, l’amie de ta femme.</li>'
    + '<li>Gare-toi avant l’<b>heure de pointe</b> !</li></ul><kbd>H</kbd> pour revoir l’aide. Bonne chance !' },
];
function tuto(i) {
  tutoI = i >= 0 && i < TUTO.length ? i : -1; tutoFrom = { x: player.x, z: player.z };
  if (tutoI < 0) { tutoDone = true; try { localStorage.setItem('parkingGuardTuto', 1); } catch {} }
  TU = {}; tutoEV = { ...EV }; tutoT0 = elapsed;
  TUTO[tutoI]?.go?.();
  $('coachText').dataset.t = '';
  if (tutoI > 0) $('coach').animate([{ transform: 'scale(1.05)' }, { transform: 'scale(1)' }], 300);
}
function coach() { // called from hud(): advance when the step is done, refresh the text
  const st = TUTO[tutoI], last = tutoI === TUTO.length - 1;
  $('coach').classList.toggle('hidden', !st || !started);
  $('shop').classList.toggle('glow', !!st?.shop);
  if (!st || !started) return;
  if (st.done?.()) { SFX.free(); return tuto(tutoI + 1); }
  st.tick?.();
  let t = nb(typeof st.x === 'function' ? st.x() : st.x);
  if (TOUCH) t = t.replace(/<kbd>ZQSD<\/kbd> ou les <kbd>flèches<\/kbd>/g, 'le joystick (pouce sur la moitié gauche de l’écran)').replace('<kbd>Espace</kbd>', '<kbd>Frein</kbd>')
    .replace(' (touche <kbd>1</kbd>)', ' (🚗)').replace('en bas à droite', 'en bas').replace('<kbd>H</kbd>', '<kbd>?</kbd>');
  if ($('coachText').dataset.t === t) return;
  $('coachText').dataset.t = t; $('coachText').innerHTML = t;
  $('coachTitle').textContent = nb(st.t); $('coachStep').textContent = `Tutoriel · ${tutoI + 1}/${TUTO.length}`;
  $('coachNext').textContent = last ? 'Terminer' : 'Passer'; $('coachQuit').hidden = last;
}
const click = f => e => { f(); e.currentTarget.blur(); }; // blur: Space (brake) must not press the button again
$('coachNext').onclick = click(() => tuto(tutoI + 1));
$('coachQuit').onclick = click(() => tuto(-1));
$('startTuto').onclick = () => { tuto(0); $('start').click(); };
if (tutoDone) { $('start').classList.remove('alt'); $('startTuto').classList.add('alt'); $('startTuto').before($('start')); } // already done: « Jouer » first
// H: the title card again as an in-game help screen (pauses the game)
const helpOn = () => started && !$('title').classList.contains('hidden');
const help = on => { paused = on; $('title').classList.toggle('hidden', !on); $('paused').classList.add('hidden'); };
$('resume').onclick = click(() => help(false));
$('retuto').onclick = click(() => { help(false); tuto(0); });
// self-check (game started): the plain start leaves the tutorial off; each step advances when Erika does it or the event it shows happens. Returns 'ok' or throws.
function selfTestTuto() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestTuto: ' + m); };
  const at = (i, m) => { coach(); ok(tutoI === i, `${m} (step ${tutoI})`); };
  const until = (sec, i, m) => { for (let t = 0; t < sec && tutoI < i; t += 0.2) { window.__game.step(0.2); if (focus) unfocus(); coach(); } at(i, m); };
  const park = c => { const q = slots.find(q => bayFree(q) && Math.abs(q.x - c.x) > 4 && carPen(c, q.x, parkZ(c, q.side), 0) === 0); Object.assign(c, { x: q.x, z: parkZ(c, q.side), ang: 0, speed: 0 }); actionE(); computeBlocks(); };
  const near = c => Object.assign(player, { x: c.x, z: c.z - Math.sign(c.z) * (c.r + 0.5) });
  const getIn = c => { near(c); actionE(); ok(driving === c, 'get in'); };
  let saved = null; try { saved = localStorage.getItem('parkingGuardTuto'); } catch {}
  ok(started, 'game started');
  if (tutoI !== -1) tuto(-1);
  if (driving) { driving.speed = 0; actionE(); }
  W.wait = PA.t = chatT = BAG.t = 1e9;
  tuto(0); at(0, 'starts at step 1');
  player.x += 5; at(1, 'walked');
  ok(ARROW && TUTO[1].at().x === mineCars()[0].x, 'arrow on the Dacia');
  getIn(mineCars()[0]); at(2, 'drives');
  park(driving); ok(!driving, 'got out'); at(3, 'car left in another bay');
  const b = bins.find(q => !q.slot); Object.assign(player, { x: b.x, z: Math.sign(b.z) * SW }); actionB(); at(4, 'bin picked up');
  const s = slots.find(q => bayFree(q) && !cars.some(c => c.state !== 'away' && Math.hypot(c.x - q.x, c.z - q.z) < 5));
  Object.assign(player, { x: s.x - 0.9, z: s.z, ang: 0 }); person.g.rotation.y = 0; window.__game.step(0.1); actionB(); at(5, 'bin in a bay');
  player.x = s.x - 8; until(120, 6, 'Valérie takes the bin back');
  ok(baguette.visible, 'baguette dropped'); Object.assign(player, { x: baguette.position.x, z: baguette.position.z }); window.__game.step(0.1); at(7, 'baguette picked up');
  Object.assign(player, { x: RED_GATE + 3, z: SW }); until(60, 8, 'the father came out');
  Object.assign(player, { x: -20, z: -5.5 }); until(150, 9, 'a driver stopped to chat');
  until(300, 10, 'Jack kept two bays');
  until(150, 11, 'the wife took a car');
  ok(cars.some(o => o.seat), 'the Seat shows up'); until(20, 12, 'Seat shown');
  W.wait = 1e9; for (const o of mineCars()) if (Math.abs(o.x - GARAGE_X) < 4.5 && o.z < -2.5) o.x = -72; // the wife may have left one in front of the garage
  for (let t = 0; t < 30 && garageBusy(); t += 0.2) window.__game.step(0.2);
  score = 1e5; buyCar(); at(13, 'car bought');
  const n = TU.car; near(n); actionE(); ok(!driving && n.broken && ST.car === n, 'the BMW breaks down, Stéphane comes');
  for (let t = 0; t < 90 && n.broken; t += 0.2) window.__game.step(0.2);
  n.panne = 0; getIn(n); park(n); at(14, 'BMW parked');
  const d = cars.find(c => c.dirty && c.state === 'parked'); ok(d, 'a dirty car'); const sc = score;
  near(d); actionE(); ok(WASH.c === d, 'washing'); for (let t = 0; t < 3; t += 0.2) window.__game.step(0.2);
  at(15, 'car washed'); ok(!d.dirty && score >= sc + WASH_PAY, 'paid for the wash');
  $('coachNext').click(); ok(tutoI === -1 && tutoDone, 'finished');
  try { if (saved === null) localStorage.removeItem('parkingGuardTuto'); } catch {}
  return 'ok';
}

let last = performance.now(), timeScale = 1;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05); // a rAF timestamp can predate the last performance.now()
  pollPad();
  last = now;
  if (focus && (focus.t -= dt) <= 0) unfocus();
  if (started && !paused && !focus) for (let k = timeScale; k > 0; k--) update(dt * Math.min(1, k)); // debug.vitesse(k) runs k updates per frame
  if (!paused && !focus) { sync(dt); updateFx(dt); updateWorld(dt); paintSlots(); }
  hud(dt);
  const tg = started && !focus && TUTO[tutoI]?.at?.(); // tutorial arrow over what to interact with
  ARROW.visible = !!tg;
  if (tg) { ARROW.position.set(tg.x, tg.y + 0.3 + 0.5 * Math.abs(Math.sin(now / 250)), tg.z); ARROW.rotation.y += dt * 2; }
  const who = focus || driving || player;
  camTarget.lerp(new THREE.Vector3(who.x, 0, who.z), 1 - Math.exp(-4 * dt));
  camera.position.copy(camTarget).add(CAM_OFF);
  camera.lookAt(camTarget);
  sun.position.copy(camTarget).add(SUN_OFF);
  sun.target.position.copy(camTarget);
  if (focus) { // keep the clear hole of the blur on the event
    const v = new THREE.Vector3(focus.x, 1, focus.z).project(camera), f = $('focus').style;
    f.setProperty('--fx', (v.x + 1) / 2 * innerWidth + 'px'); f.setProperty('--fy', (1 - v.y) / 2 * innerHeight + 'px');
  }
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
Object.assign(window.__game, { buyTruck, buyFerrari, buyMeter, buyBays, circles, smoke, selfTest() {
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
  buyCar(); const bmw = cars.at(-1); bmw.broken = false; bmw.panne = 0; // deliveries may randomly not start, the BMW one start in two
  ok(bmw.x === GARAGE_X && !slots.some(s => covers(bmw, s)), 'new car waits in front of the garage');
  buyCar(); ok(cars.at(-1) === bmw, 'no second delivery while the garage spot is taken');
  getIn(bmw); window.__game.step(0.5);
  ok(smoke.some(s => s.m.visible), 'BMW smokes at start-up');
  const home = { x: bmw.x, z: bmw.z };
  bmw.z = 0.3; actionE();
  ok(!driving && Math.hypot(bmw.x - home.x, bmw.z - home.z) < 1e-6, 'car left on the road goes home');
  bmw.x = -72; buyCar(); const picasso = cars.at(-1); // out of the way: Rue du Centre is busy now
  ok(bmw.smoky && picasso.len === 4.28 && cars.some(c => c.kind === 'mine' && c.len === 3.73), 'Dacia Spring at start, then BMW, then Picasso');
  picasso.x = -78;
  Object.assign(player, { x: -20, z: 0 });
  ok(until(150, () => cars.some(c => c.stuckT > PATIENCE_ON_FOOT)), 'traffic waits behind Erika');
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
  // she already stands on the bay: the car still reserves it, pulls in, bounces once (one boing) and never retries it
  for (const c of cars.filter(c => c.kind === 'foreign')) leaveStreet(c);
  const r = addCar('foreign', '#888', 'hatch'), q2 = slots.find(s => !s.ai && !s.block && Math.abs(s.x) < 30);
  Object.assign(player, { x: q2.x, z: q2.z }); computeBlocks();
  ok(q2.block === player, 'Erika holds the bay');
  Object.assign(r, { x: q2.x - 12, z: 0, dir: 1, ang: 0, speed: 4, state: 'drive', wantsSlot: true, scan: 0, slot: null }); r.mesh.visible = true;
  const boing = SFX.boing; let n = 0; SFX.boing = () => { n++; boing(); };
  try { ok(until(1, () => r.slot === q2), 'car picks the bay she stands on'); ok(until(8, () => r.snub === q2) && n === 1 && belly > 0 && r.kick > 0, 'car pulls in and bounces off her belly');
    ok(!until(4, () => r.slot === q2 || n > 1), 'one boing, no retry'); } finally { SFX.boing = boing; }
  return 'ok';
} });
// driving: a car (and the truck) flush against the curb or with a corner in it can still drive, reverse and turn away;
// it slides along the curb, stops against a parked car without overlapping it, and bumps back when hitting it fast
Object.assign(window.__game, { selfTestDriving() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestDriving: ' + m); };
  W.wait = PA.t = chatT = BAG.t = spawnT = J.wait = 1e9; score = 1e5; // no traffic, no events
  for (const c of cars.filter(c => c.kind !== 'mine')) { leaveStreet(c); c.timer = 1e9; }
  buyTruck();
  const car = cars.find(c => c.kind === 'mine' && !c.truck), tr = cars.find(c => c.truck), K = ['up', 'down', 'left', 'right'];
  const clearAt = (v, x) => ![...bins, ...cars.filter(o => o !== v && o.state !== 'away'), ...PITS.map(([x, z]) => ({ x, z }))].some(o => Math.abs(o.z) < CURB_Z + 1 && Math.abs(o.x - x) < 14);
  const run = (v, pose, on, sec = 2) => { // drives v from pose with keys `on` held; returns how far it got
    Object.assign(v, pose, { speed: pose.speed || 0 }); driving = v;
    ok(carPen(v, v.x, v.z, v.ang) < 1e-3, 'start pose clear');
    for (const k of K) keys[k] = on.includes(k);
    const x0 = v.x, z0 = v.z, a0 = v.ang;
    let worst = 0;
    for (let t = 0; t < sec; t += 0.1) { window.__game.step(0.1); worst = Math.max(worst, carPen(v, v.x, v.z, v.ang)); }
    for (const k of K) keys[k] = false;
    driving = null;
    return { moved: Math.hypot(v.x - x0, v.z - z0), off: Math.sign(z0) * (z0 - v.z), turned: Math.abs(v.ang - a0), worst };
  };
  for (const v of [car, tr]) for (const s of [1, -1]) {
    const X = [-40, -30, -20, -10, 0, 10, 20, 30, 40].find(x => clearAt(v, x)), e = v.circ[0], a = 0.35, L = s > 0 ? 'left' : 'right', R = s > 0 ? 'right' : 'left';
    ok(X !== undefined, 'a clear stretch of street');
    const n = v.truck ? 'truck ' + s : 'car ' + s, flush = { x: X, z: s * (CURB_Z - v.r - 1e-3), ang: 0 };
    const rear = { x: X, z: s * (CURB_Z - v.r - 1e-3 - Math.sin(a) * e), ang: s * a }, nose = { ...rear, ang: -s * a }; // rear / front corner on the curb
    for (const [p, on, what, f] of [[flush, ['up', L], 'pulls out from flush', r => r.off > 0.5], [flush, ['down', L], 'reverses out from flush', r => r.off > 0.3],
      [rear, ['down'], 'reverses with its rear on the curb', r => r.moved > 1], [rear, ['down', R], 'reverses and turns with its rear on the curb', r => r.moved > 1 && r.turned > 0.1],
      [rear, ['up', L], 'pulls out with its rear on the curb', r => r.off > 0.5], [nose, ['up'], 'slides along the curb nose first', r => r.moved > 2],
      [nose, ['down', L], 'backs off the curb', r => r.off > 0.3]]) {
      const r = run(v, p, on);
      ok(f(r) && r.worst < 0.02, `${n}: ${what} ${JSON.stringify(r)}`);
    }
  }
  const f = addCar('foreign', '#888', 'hatch'), q = slots.find(q => q.side === 1 && clearAt(car, q.x - 4));
  placeParked(f, q, 999);
  const r = run(car, { x: q.x - (car.len + f.len) / 2 - 3, z: q.z, ang: 0, speed: 10 }, [], 1);
  ok(r.worst < 0.02 && car.speed <= 0.5 && car.x < f.x - (car.len + f.len) / 2 + 0.2, `stops against a parked car ${JSON.stringify(r)}`);
  return 'ok';
} });

// ───────────────────────── debug console: type debug.aide() in the browser console (F12)
{
  const free = f => { const s0 = score; score = 1e12; f(); score = s0; }; // buy without paying
  const CARS = { bmw: buildBMW, spring: buildSpring, picasso: buildPicasso, ferrari: buildF430, z4: buildZ4, polo: buildPolo };
  const who = () => driving || player;
  const nearMine = () => cars.filter(c => c.kind === 'mine').sort((a, b) => Math.hypot(a.x - who().x, a.z - who().z) - Math.hypot(b.x - who().x, b.z - who().z))[0];
  const stranger = type => type === 'seat' ? addSeat() : addCar('foreign', pick(AI_COLORS), type ?? pick(['hatch', 'hatch', 'mpv', 'suv', 'mini']));
  const HELP = {
    'credits(n = 1000)': 'ajoute n crédits (négatif pour en retirer)',
    'setCredits(n)': 'fixe les crédits à n',
    'inconnu(type?)': "fait entrer une voiture d'inconnu dans la rue (hatch, mpv, suv, mini, seat : la Seat noire portugaise)",
    'inconnuGare(n = 1)': "gare n voitures d'inconnus sur des places libres",
    'videInconnus()': 'fait disparaître toutes les voitures des inconnus',
    'voisin(nom)': 'fait revenir un voisin tout de suite (Marion, Thierry, Marie-Claude, Dédé, Florence, Le père, Clément, Léa, Kévin)',
    "voiture(modele = 'bmw')": 'livre gratuitement une voiture devant le garage : ' + Object.keys(CARS).join(', ') + ', ou un type générique (hatch, mpv, suv, mini)',
    'camion()': 'livre le camion gratuitement',
    'borne()': 'installe une borne de parking payant gratuitement',
    'places()': 'achète gratuitement le prochain groupe de places',
    'tp(x, z)': 'téléporte Erika (ou la voiture conduite) ; la rue va de x = -52 à 52, trottoirs à z = ±6',
    'baguette()': 'fait apparaître une baguette à côté d’Erika',
    'vitesseBoost(s = 8) / ralenti(s = 6)': 'bonus / malus de vitesse de marche',
    'pere()': 'le père sort pour péter à côté d’Erika',
    'femme()': 'la femme d’Erika part tout de suite avec une voiture',
    'discussion()': 'la prochaine voiture qui passe près d’Erika s’arrête pour discuter',
    'panne()': 'met en panne la voiture d’Erika la plus proche',
    'mecano()': 'appelle Stéphane sur la voiture d’Erika la plus proche',
    'sale()': 'salit la voiture garée de voisin ou de la famille la plus proche (à laver avec E)',
    'jack()': 'Jack sort tout de suite garder deux places',
    'valerie()': 'les poubelles garées sont toutes « en retard » : Valérie arrive',
    'trafic(v)': 'force le trafic entre 0 (calme) et 1 (rush) ; trafic(null) pour revenir aux vagues',
    'vitesse(k = 1)': 'vitesse du temps (0.5 = ralenti, 4 = accéléré)',
    'avance(s)': 'fait avancer la simulation de s secondes d’un coup',
    'etat()': 'résumé : crédits, trafic, timers des événements, possessions',
    "tests(nom?)": 'lance les self-tests (tous, ou un seul : Rules, Wife, Events…) — ils modifient la partie',
  };
  window.debug = {
    aide() { console.table(Object.fromEntries(Object.entries(HELP).map(([k, v]) => [`debug.${k}`, v]))); return 'Commandes listées ci-dessus'; },
    credits(n = 1000) { score = Math.max(0, score + n); return Math.floor(score); },
    setCredits(n) { score = Math.max(0, n); return Math.floor(score); },
    inconnu(type) { const c = stranger(type); if (enterStreet(c)) return c; scene.remove(c.mesh); cars.splice(cars.indexOf(c), 1); return 'entrée de rue occupée, réessaie'; },
    inconnuGare(n = 1) {
      let k = 0;
      for (const sl of slots) { if (k >= n) break; if (sl.ai || sl.block) continue; placeParked(stranger(), sl, rand(45, 110)); k++; }
      return `${k} inconnu(s) garé(s)`;
    },
    videInconnus() { const f = cars.filter(c => c.kind === 'foreign'); for (const c of f) { if (c.slot) c.slot.ai = null; scene.remove(c.mesh); cars.splice(cars.indexOf(c), 1); } return `${f.length} voiture(s) supprimée(s)`; },
    voisin(nom) {
      const c = cars.find(o => o.kind === 'neighbour' && o.name.toLowerCase() === String(nom).toLowerCase());
      if (!c) return 'voisins : ' + cars.filter(o => o.kind === 'neighbour').map(o => o.name).join(', ');
      if (c.state !== 'away') return `${c.name} est déjà dans la rue (${c.state})`;
      c.timer = 0; return `${c.name} arrive`;
    },
    voiture(modele = 'bmw') {
      if (garageBusy()) return 'quelque chose est déjà devant le garage';
      const b = CARS[modele];
      if (!b && !CAR_TYPES[modele]) return 'modèles : ' + Object.keys(CARS).join(', ') + ', ' + Object.keys(CAR_TYPES).join(', ');
      carsOwned++; return deliver(b?.(ENV), pick(MINE_COLORS)) ?? cars.at(-1);
    },
    camion() { truckOwned = false; free(buyTruck); return cars.at(-1); },
    borne() { free(buyMeter); return 'ok'; },
    places() { free(buyBays); return `${slots.length} places`; },
    tp(x, z) { const w = who(); Object.assign(w, { x, z }); if (!driving) pushOut(player); camTarget.set(x, 0, z); return [w.x, w.z]; },
    baguette() { BAG.t = 0; events(0); const s = Math.sign(player.z) || -1; baguette.position.set(player.x + 2, 0.6, s * (CURB_Z + WALL_Z) / 2); return 'baguette posée'; },
    vitesseBoost(sec = 8) { boostT = sec; return 'ok'; },
    ralenti(sec = 6) { slowT = sec; return 'ok'; },
    pere() { if (PA.phase !== 'home') return `le père est déjà dehors (${PA.phase})`; PA.t = 0; return 'le père arrive'; },
    femme() { if (W.phase !== 'home') return `elle est déjà partie (${W.phase})`; W.wait = 0; return 'elle arrive'; },
    discussion() { chatT = 0; return 'ok'; },
    panne() { const c = nearMine(); if (!c) return 'aucune voiture'; c.broken = true; return c; },
    sale() { const c = cars.filter(o => o.kind === 'neighbour' && o.state === 'parked').sort((a, b) => Math.hypot(a.x - who().x, a.z - who().z) - Math.hypot(b.x - who().x, b.z - who().z))[0]; if (!c) return 'aucune voiture de voisin garée'; setDirty(c, true); return c.name; },
    mecano() { const c = nearMine(); if (!c) return 'aucune voiture'; c.broken = true; callMechanic(c); return 'Stéphane arrive'; },
    jack() { if (!['home', 'visit', 'gone', 'round'].includes(J.phase)) return `Jack est occupé (${J.phase})`; J.wait = 0; return 'Jack arrive'; },
    valerie() { const b = bins.filter(q => q.slot); for (const q of b) q.t = 0; return `${b.length} poubelle(s) en retard`; },
    trafic(v) { trafficForced = v == null ? null : clamp(v, 0, 1); return traffic(); },
    vitesse(k = 1) { timeScale = clamp(k, 0.05, 20); return timeScale; },
    avance(sec) { window.__game.step(sec); return Math.floor(elapsed) + ' s de jeu'; },
    etat() {
      return { credits: Math.floor(score), parSeconde: +rate.toFixed(1), trafic: +traffic().toFixed(2), tempsDeJeu: Math.floor(elapsed),
        voitures: cars.filter(c => c.kind === 'mine').length, camion: truckOwned, ferrari: ferrariOwned, places: slots.length,
        inconnusGares: foreignN, baguette: baguette.visible ? 'posée' : `dans ${Math.max(0, BAG.t).toFixed(0)} s`,
        pere: PA.phase === 'home' ? `dans ${Math.max(0, PA.t).toFixed(0)} s` : PA.phase, femme: W.phase === 'home' ? `dans ${Math.max(0, W.wait).toFixed(0)} s` : W.phase,
        discussion: `dans ${Math.max(0, chatT).toFixed(0)} s`, jack: J.phase, mecano: ST.car ? 'en réparation' : 'libre' };
    },
    tests(nom) {
      const all = Object.keys(window.__game).filter(k => k.startsWith('selfTest')), run = nom ? ['selfTest' + nom] : all;
      return Object.fromEntries(run.map(t => { try { return [t, window.__game[t]()]; } catch (e) { return [t, e.message]; } }));
    },
  };
  console.info('Parking Guard — console de debug : tapez debug.aide()');
}
// traffic: cars come down Rue du Centre from both ends and turn in, leave at the far end either way, never overlap, never come out of the one-way street
Object.assign(window.__game, { selfTestTraffic() {
  const ok = (c, m) => { if (!c) throw new Error('selfTestTraffic: ' + m); };
  if (driving) { driving.speed = 0; actionE(); }
  W.wait = PA.t = chatT = BAG.t = 1e9;
  Object.assign(player, { x: 0, z: -6.2 }); elapsed = 375; // rush hour
  const from = {}, prev = {}, turnT = {}, seen = { in1: 0, 'in-1': 0, out1: 0, 'out-1': 0, pass: 0 }, moving = ['arrive', 'turn', 'depart'];
  for (let i = 0; i < 240 * 30; i++) {
    window.__game.step(1 / 30);
    const live = cars.filter(c => c.kind !== 'mine' && [...moving, 'drive', 'leave', 'park'].includes(c.state));
    for (const c of live) {
      if (c.state === 'arrive') from[c.id] = -Math.sign(c.z); // heading along z: +1 = came from z<0
      ok((turnT[c.id] = c.state === 'turn' ? (turnT[c.id] || 0) + 1 / 30 : 0) < 15, `car ${c.id} stuck mid-turn`);
      if (prev[c.id] === 'turn' && c.state === 'drive' && c.x < 0) seen['in' + from[c.id]]++;
      if (prev[c.id] === 'turn' && c.state === 'depart') c.x > 0 ? seen['out' + Math.sign(c.z)]++ : seen.pass++;
      ok(!(c.x < -XS - 5 && Math.cos(c.ang) > 0.3), 'a car comes out of the one-way street');
      for (const o of live) if (o.id > c.id && (moving.includes(c.state) || moving.includes(o.state)))
        for (const [ax, az, ar] of circles(c)) for (const [bx, bz, br] of circles(o))
          ok(Math.hypot(ax - bx, az - bz) > ar + br - 0.1, `cars ${c.id} (${c.state}) and ${o.id} (${o.state}) overlap at ${c.x.toFixed(1)},${c.z.toFixed(1)}`);
    }
    for (const c of cars) prev[c.id] = c.state;
  }
  ok(seen.in1 > 1 && seen['in-1'] > 1, 'turn in from both ends of Rue du Centre ' + JSON.stringify(seen));
  ok(seen.out1 > 1 && seen['out-1'] > 1, 'turn out both ways at the far end ' + JSON.stringify(seen));
  ok(seen.pass > 0, 'through traffic on Rue du Centre');
  return 'ok ' + JSON.stringify(seen);
} });
