import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildErika } from './models.js';

// ───────────────────────── helpers
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);

// ───────────────────────── street layout (street runs along X, sides are z>0 (s=1) and z<0 (s=-1))
// one-way street: a single lane at z=0, traffic always flows toward +x (enters at -END_X, exits at +END_X)
const LANE_Z = 0, SLOT_Z = 3.95, CURB_Z = 5.1, WALL_Z = 7.5, STREET_X = 52, END_X = 70, SLOT_LEN = 5.4;
const SLOT_XS = { 1: [-27, -21.6, -16.2, -10.8, 3.6, 9, 14.4, 19.8], [-1]: [-20, -14.6, -9.2, -3.8, 10.8, 16.2, 21.6, 27] };
const GATES = { 1: [-40, -3.6, 30, 44], [-1]: [-44, -33, 3.6, 38] };
const STRANGER_FINE = 10;
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

scene.add(new THREE.HemisphereLight('#dbe9ff', '#8a7b5c', 1.1));
const sun = new THREE.DirectionalLight('#fff0d8', 2.4);
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
function speckle(g, s, n, alpha) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * alpha})`;
    const r = 1 + Math.random() * 2;
    g.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
}
const asphalt = (rx, ry) => canvasTex(256, (g, s) => {
  g.fillStyle = '#56585c'; g.fillRect(0, 0, s, s);
  speckle(g, s, 9000, 0.13);
}, rx, ry);
const pavingTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#a19c93'; g.fillRect(0, 0, s, s);
  speckle(g, s, 7000, 0.12);
  g.strokeStyle = 'rgba(60,55,50,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke(); }
}, STREET_X, 1);
const grassTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#7b9a55'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `hsla(${rand(70, 110)},40%,${rand(25, 50)}%,.25)`; g.fillRect(Math.random() * s, Math.random() * s, 2, 3); }
}, 90, 90);

// ───────────────────────── static world (built into S, then merged per material for speed)
const S = new THREE.Group();
const WALLS = ['#ece3cf', '#f1ede4', '#e5a791', '#efe6d6', '#dcd3c0', '#e9c9a8', '#f4f1ea'];
const ROOFS = ['#a8472f', '#9c3f2a', '#b5553a', '#8e3b2a', '#a44d34', '#66615e'];
const SHUTTERS = ['#6b3f2a', '#3f5a4a', '#8a8f96', '#f4f1ea', '#5a3a2e'];
const LOT_WALLS = ['#f1ede4', '#ece6d8', '#e8b9a6', '#dcd6c8', '#f3efe6'];
const FENCES = ['#2f4a3c', '#26292d', '#2f4a3c', '#5d666d', '#dfe7e4', 'hedge'];
const GREENS = ['#5f8f3e', '#4f7a35', '#6fa04a', '#3f6b30', '#79a652'];
const REDS = ['#8e2f3c', '#a03a3a', '#7a2836'];

function win(P, x, y, z, rotY, shutter) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; P.add(g);
  box(g, 1.15, 1.35, 0.06, '#f4f2ec');
  box(g, 0.9, 1.1, 0.06, GLASS, 0, 0, 0.02);
  box(g, 0.06, 1.1, 0.08, '#f4f2ec', 0, 0, 0.04);
  box(g, 1.3, 0.08, 0.2, '#e3dfd6', 0, -0.72, 0.08);
  if (shutter) for (const k of [-1, 1]) box(g, 0.5, 1.35, 0.05, shutter, k * 0.85, 0, 0);
}
function door(P, x, z, rotY, color, awning) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; P.add(g);
  box(g, 1.25, 2.3, 0.06, '#f4f2ec', 0, 1.4, 0);
  box(g, 1.0, 2.1, 0.08, color, 0, 1.35, 0.02);
  box(g, 1.7, 0.1, 0.9, awning, 0, 2.75, 0.45).rotation.x = 0.25;
}
function house(P, cx, s, zFront, w, d, h, detail = true) {
  const g = new THREE.Group(); g.position.set(cx, 0, s * (zFront + d / 2)); P.add(g);
  const wc = pick(WALLS), rc = pick(ROOFS), sc = pick(SHUTTERS);
  box(g, w, h, d, wc, 0, h / 2, 0);
  box(g, w + 0.12, 0.45, d + 0.12, '#b3aa9b', 0, 0.22, 0);
  box(g, w + 0.1, 0.16, d + 0.1, '#f7f5ef', 0, h - 0.08, 0);
  // gable roof: wall-coloured triangle + two tile slabs
  const along = Math.random() < 0.6, span = along ? d : w, len = along ? w : d, half = span / 2;
  const rh = half * rand(0.7, 0.95), ov = 0.45, a = Math.atan2(rh, half), slope = Math.hypot(half, rh) + ov;
  const r = new THREE.Group(); r.position.y = h; r.rotation.y = along ? Math.PI / 2 : 0; g.add(r);
  const tg = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rh)]), { depth: len, bevelEnabled: false });
  tg.translate(0, 0, -len / 2);
  mesh(r, tg, wc);
  for (const k of [-1, 1]) {
    box(r, slope, 0.22, len + 2 * ov, rc, k * (slope * Math.cos(a) / 2 + Math.sin(a) * 0.11), rh - slope * Math.sin(a) / 2 + Math.cos(a) * 0.11, 0).rotation.z = -k * a;
  }
  box(r, 0.34, 0.24, len + 2 * ov, '#7a3424', 0, rh + 0.14, 0);
  const chx = half * 0.4 * pick([-1, 1]), chz = rand(-len / 3, len / 3);
  box(r, 0.7, rh + 1.1, 0.7, pick([wc, '#9a5a44']), chx, (rh + 1.1) / 2, chz);
  box(r, 0.85, 0.12, 0.85, '#8d8a85', chx, rh + 1.16, chz);
  if (!detail) return;
  // facades: street side (door), back side and +x side get windows
  const faces = [{ z: -s * (d / 2 + 0.03), rot: s > 0 ? Math.PI : 0, front: true }, { z: s * (d / 2 + 0.03), rot: s > 0 ? 0 : Math.PI }];
  for (const f of faces) {
    const n = Math.max(2, Math.floor(w / 2.4)), doorI = f.front ? (Math.random() * n) | 0 : -1;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      if (i === doorI) door(g, x, f.z, f.rot, sc === '#f4f1ea' ? '#6b3f2a' : sc, rc);
      else win(g, x, 1.6, f.z, f.rot, sc);
      if (h > 5.3) win(g, x, h - 1.55, f.z, f.rot, sc);
    }
  }
  for (let i = 0, n = Math.max(1, Math.floor(d / 3)); i < n; i++) win(g, w / 2 + 0.03, 1.6, -d / 2 + (i + 0.5) * (d / n), Math.PI / 2, null);
  if (Math.random() < 0.4) { // garage annex
    const gx = pick([-1, 1]) * (w / 2 + 1.7), gz = -s * (d / 2 - 2.6);
    box(g, 3.4, 2.7, 5.2, wc, gx, 1.35, gz);
    box(g, 3.6, 0.2, 5.4, '#8d8a85', gx, 2.8, gz);
    box(g, 2.6, 2.0, 0.08, '#e9e6de', gx, 1.0, gz - s * 2.62);
  }
}
function tree(P, x, z, h, red) {
  mesh(P, new THREE.CylinderGeometry(0.14, 0.22, h * 0.55, 6), '#6b4a33', x, h * 0.27, z);
  const col = red ? pick(REDS) : pick(GREENS);
  for (let i = 0; i < 3; i++) {
    const r = h * rand(0.2, 0.3);
    mesh(P, new THREE.IcosahedronGeometry(r, 0), col, x + rand(-0.6, 0.6), h * 0.58 + i * r * 0.55, z + rand(-0.6, 0.6)).rotation.set(rand(0, 3), rand(0, 3), 0);
  }
}
function shrub(P, x, z, r) {
  const m = mesh(P, new THREE.IcosahedronGeometry(r, 0), pick(GREENS), x, r * 0.7, z);
  m.rotation.set(rand(0, 3), rand(0, 3), 0);
  if (Math.random() < 0.5) for (let i = 0; i < 4; i++) mesh(P, new THREE.IcosahedronGeometry(0.1, 0), pick(['#f28c28', '#f2c230', '#e8e2f0', '#d6456b']), x + rand(-r, r) * 0.7, r * rand(0.9, 1.4), z + rand(-r, r) * 0.7);
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
  ground(500, 500, grassTex, 0, -0.02, 0);
  ground(2 * END_X + 40, 2 * CURB_Z, asphalt(40, 3), 0, 0, 0);
  for (const x of [-58, 58]) ground(10, 400, asphalt(3, 100), x, 0.004, 0);

  const bars = {};
  for (const s of [1, -1]) {
    // sidewalk + curb
    const sw = new THREE.Mesh(boxGeo(2 * STREET_X, 0.15, WALL_Z - CURB_Z), new THREE.MeshStandardMaterial({ map: pavingTex, roughness: 0.95 }));
    sw.position.set(0, 0.075, s * (CURB_Z + WALL_Z) / 2); sw.receiveShadow = true; S.add(sw);
    box(S, 2 * STREET_X, 0.2, 0.25, '#cfcac0', 0, 0.1, s * CURB_Z);

    // parking markings: dashed lane edge + end lines + slot ticks
    const xs = SLOT_XS[s], groups = [[xs[0]]];
    for (let i = 1; i < xs.length; i++) (xs[i] - xs[i - 1] > SLOT_LEN + 0.1 ? groups[groups.push([]) - 1] : groups.at(-1)).push(xs[i]);
    const edge = s * (SLOT_Z - 1.15);
    for (const gp of groups) {
      const a = gp[0] - SLOT_LEN / 2, b = gp.at(-1) + SLOT_LEN / 2;
      for (let x = a + 0.3; x < b; x += 1.2) box(S, 0.6, 0.01, 0.13, '#efefe9', x, 0.006, edge);
      for (const x of [a, b]) box(S, 0.13, 0.01, 2.2, '#efefe9', x, 0.006, edge + s * 1.1);
      for (let i = 1; i < gp.length; i++) box(S, 0.1, 0.01, 0.5, '#efefe9', gp[i] - SLOT_LEN / 2, 0.006, edge + s * 0.25);
    }

    // lots: walls, fences, gates, houses, gardens
    const lots = [];
    for (let x = -STREET_X; x < STREET_X - 6;) {
      const w = Math.min(rand(11, 15), STREET_X - x);
      lots.push({ x0: x, x1: x + w, wall: pick(LOT_WALLS), fence: s < 0 || Math.random() < 0.8 ? pick(FENCES) : '#26292d' });
      x += w;
    }
    lots.at(-1).x1 = STREET_X;
    const gates = GATES[s], z = s * WALL_Z;
    const cuts = [...new Set([-STREET_X, STREET_X, ...lots.flatMap(l => [l.x0, l.x1]), ...gates.flatMap(g => [g - 1.8, g + 1.8])])].sort((p, q) => p - q);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2, len = b - a;
      if (len < 0.05) continue;
      const lot = lots.find(l => m >= l.x0 && m <= l.x1);
      const gate = gates.find(g => Math.abs(m - g) < 1.8);
      if (gate !== undefined) {
        const gc = lot.fence === 'hedge' || lot.fence === '#dfe7e4' ? '#2f4a3c' : lot.fence;
        box(S, len, 1.55, 0.08, gc, m, 0.85, z);
        box(S, len, 0.12, 0.12, gc, m, 1.6, z);
        box(S, len, 0.02, 4.2, '#bdb5a5', m, 0.01, s * (WALL_Z + 2.2)); // driveway
        continue;
      }
      box(S, len, 0.95, 0.35, lot.wall, m, 0.475, z);
      box(S, len, 0.08, 0.45, '#d9d4c9', m, 0.99, z);
      if (lot.fence === 'hedge') {
        box(S, len, 1.3, 1.0, '#3f6b30', m, 0.65, z + s * 0.75);
        for (let x = a + 0.4; x < b; x += 0.8) mesh(S, new THREE.IcosahedronGeometry(rand(0.55, 0.75), 0), pick(['#3f6b30', '#46753a', '#4f7a35']), x, rand(1.4, 1.8), z + s * rand(0.6, 0.9)).rotation.set(rand(0, 3), rand(0, 3), 0);
        (bars['#7a2e35'] ||= []).push(...Array.from({ length: Math.floor(len / 0.16) }, (_, k) => [a + 0.1 + k * 0.16, z]));
        box(S, len, 0.06, 0.06, '#7a2e35', m, 1.72, z);
      } else {
        (bars[lot.fence] ||= []).push(...Array.from({ length: Math.floor(len / 0.16) }, (_, k) => [a + 0.1 + k * 0.16, z]));
        box(S, len, 0.06, 0.06, lot.fence, m, 1.72, z);
        box(S, len, 0.06, 0.06, lot.fence, m, 1.08, z);
      }
      for (const px of [a, b]) {
        box(S, 0.5, 1.85, 0.5, lot.wall, px, 0.925, z);
        box(S, 0.62, 0.1, 0.62, '#d9d4c9', px, 1.9, z);
      }
    }
    for (const l of lots) {
      const lw = l.x1 - l.x0, w = rand(7, Math.min(10.5, lw - 2.5)), front = s > 0 ? 13.2 : 11.5;
      house(S, (l.x0 + l.x1) / 2 + rand(-0.8, 0.8), s, front, w, rand(7, 9), rand(4.6, 6.8));
      // front garden: small stuff on the camera side (s>0) so the street stays visible
      for (let i = 0; i < 3; i++) {
        const tx = rand(l.x0 + 1, l.x1 - 1);
        if (gates.some(g => Math.abs(tx - g) < 2.5)) continue;
        if (s < 0 && Math.random() < 0.5) tree(S, tx, s * rand(9, 10.5), rand(4, 6.5), Math.random() < 0.35);
        else shrub(S, tx, s * rand(8.5, 10.5), rand(0.5, 0.9));
      }
      tree(S, rand(l.x0 + 1, l.x1 - 1), s * rand(22, 26), rand(4.5, 7.5), Math.random() < 0.25);
    }
    // back row of houses to fill the neighbourhood
    for (let x = -68; x < 70; x += rand(12, 16)) house(S, x, s, 30, rand(7, 10), rand(7, 9), rand(4.6, 6.5), false);
    // decor wheelie bins next to gates
    for (const g of gates) if (Math.random() < 0.7) buildBin(S, '#4b4f55', pick(['#7a2b35', '#3d5a44', '#e0c53a'])).position.set(g + 2.4, 0.15, s * (WALL_Z - 0.6));
    // zebra crossings near both ends
    for (const x of [-49, 49]) for (let k = -4; k <= 4; k++) box(S, 3, 0.01, 0.55, '#efefe9', x, 0.006, k * 1.05);
  }
  for (const [color, list] of Object.entries(bars)) {
    const im = new THREE.InstancedMesh(boxGeo(0.045, 0.72, 0.045), M(color, { metalness: 0.4, roughness: 0.5 }), list.length);
    const m4 = new THREE.Matrix4();
    list.forEach(([x, z], i) => im.setMatrixAt(i, m4.makeTranslation(x, 1.38, z)));
    im.castShadow = true;
    scene.add(im);
  }

  // wooden utility poles, lamps and droopy overhead wires (far side, like the photos)
  const poleXs = [-46, -26, -6, 14, 34], pz = -6.8;
  for (const x of poleXs) {
    mesh(S, new THREE.CylinderGeometry(0.11, 0.15, 8.6, 7), '#7a5a3c', x, 4.3, pz);
    box(S, 0.12, 0.12, 1.6, '#6a4d33', x, 8.1, pz);
    box(S, 0.08, 0.08, 2.2, '#3a3d40', x, 6.4, pz + 1.1);
    box(S, 0.6, 0.16, 0.42, LAMP, x, 6.3, pz + 2.2);
  }
  const wireMat = new THREE.LineBasicMaterial({ color: '#2a2a2a' });
  const wx = [-80, ...poleXs, 80];
  for (let i = 0; i < wx.length - 1; i++) for (const oz of [-0.65, 0, 0.65]) {
    const pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(wx[i] + (wx[i + 1] - wx[i]) * t, 8.15 - Math.sin(Math.PI * t) * 0.9, pz + oz)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }

  // blue Paris-style street sign on the far wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: canvasTex(512, (g) => {
    g.canvas.height = 160;
    g.fillStyle = '#2e7d4f'; g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#1d3f7a'; g.fillRect(10, 10, 492, 140);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(20, 20, 472, 120);
    g.fillStyle = '#fff'; g.font = '700 30px Fredoka, sans-serif'; g.textAlign = 'center';
    g.fillText('RUE', 256, 60); g.font = '700 50px Fredoka, sans-serif'; g.fillText("D'AGUESSEAU", 256, 115);
  }), roughness: 0.5 }));
  sign.position.set(-48.6, 1.45, -WALL_Z + 0.21);
  scene.add(sign);

  // merge static meshes by material
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
const NEIGHBOURS = [
  { name: 'M. Dupont', color: '#2f3e5c', type: 'mpv' },
  { name: 'Mme Lefèvre', color: '#5b6470', type: 'mpv' },
  { name: 'M. Moreau', color: '#3c3f44', type: 'suv' },
  { name: 'Mme Petit', color: '#6b7075', type: 'mini' },
  { name: 'M. Garnier', color: '#eeeeee', type: 'hatch' },
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
  return { g, body, t };
}

const cars = [], bins = [];
let carId = 0;
function addCar(kind, color, type) {
  const { g, body, t } = buildCar(color, type);
  scene.add(g);
  const c = { id: carId++, kind, mesh: g, body, len: t.len, off: t.len / 2 - 0.9, x: 0, z: 0, ang: 0, speed: 0, dir: 1,
    state: kind === 'mine' ? 'mine' : 'drive', blocker: kind === 'mine', slot: null, timer: 0, scan: 0, honkT: 0, cruise: rand(6.5, 9), wantsSlot: true };
  c.marker = new THREE.Sprite(MARK[kind]);
  c.marker.position.y = 2.9; c.marker.scale.setScalar(kind === 'neighbour' ? 0.9 : 1.1); c.marker.renderOrder = 5;
  g.add(c.marker);
  cars.push(c);
  return c;
}
const circles = (x, z, ang, off) => { const cx = Math.cos(ang) * off, sz = Math.sin(ang) * off; return [[x + cx, z - sz], [x - cx, z + sz]]; };

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
const inSlot = (o, s) => Math.abs(o.x - s.x) < SLOT_LEN / 2 && Math.abs(o.z - s.z) < 1.4;
const parkedAng = () => 0; // one-way: everyone parks facing +x

// ───────────────────────── player (pedestrian)
const person = buildErika(); // the player
scene.add(person.g);
const player = { x: 0, z: -6.2, ang: 0, moving: false, phase: 0 };
const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; scene.add(ring);

// ───────────────────────── game state
const keys = {};
let driving = null, score = 50, elapsed = 0, streak = 0, rate = 0, mult = 1, spawnT = 8;
let binsInHand = null, binsBought = 0, carsOwned = 1, started = false, paused = false, foreignN = 0;
let best = 0;
try { best = +localStorage.getItem('parkingGuardBest') || 0; } catch {}
const carPrice = () => 200 * 2 ** (carsOwned - 1);
const binPrice = () => 40 + 12 * binsBought;

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
  const test = (o, x, z, clear) => {
    const along = (x - c.x) * c.dir;
    if (along > 0 && Math.abs(z - c.z) < 1.9 && along - clear < gap) { gap = along - clear; who = o; }
  };
  for (const o of cars) if (o !== c && o.state !== 'away' && o.state !== 'parked') test(o, o.x, o.z, (c.len + o.len) / 2 + 1.2);
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
  c.state = 'away'; c.timer = rand(15, 60); c.mesh.visible = false;
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
}
function startLeave(c) {
  const s = c.slot, lz = laneZ(c), d = c.dir;
  c.path = [[s.x, s.z], [s.x + d * 3, s.z], [s.x + d * 6, lz], [s.x + d * 9, lz]];
  c.dur = 3; c.t = 0; c.state = 'leave';
  puff(s.x - d * c.len / 2, s.z, 5, '#bdbdbd');
}
function updateAI(c, dt) {
  c.honkT -= dt;
  switch (c.state) {
    case 'away':
      if ((c.timer -= dt) <= 0 && !enterStreet(c)) c.timer = 1;
      return;
    case 'parked':
      c.speed = 0;
      if ((c.timer -= dt) <= 0 && laneClear(c)) startLeave(c);
      return;
    case 'park':
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
  c.speed += clamp(target - c.speed, -14 * dt, 5 * dt);
  c.x += c.speed * c.dir * dt;
  c.z += (laneZ(c) - c.z) * Math.min(1, dt * 3);
  c.ang = c.dir > 0 ? 0 : Math.PI;
  if (gap < 0.3 && c.honkT <= 0 && (who === player || who?.kind === 'mine' || bins.includes(who))) {
    c.honkT = rand(3, 5);
    if (nearPlayer(c.x, c.z)) SFX.honk();
    floatText(pick(['BEEP!', 'Pouet!', 'HONK!']), c.x, 3, c.z, '#ffd166');
  }
  if (c.x * c.dir > END_X) leaveStreet(c);
}
const traffic = () => clamp((elapsed - 45) / 200, 0, 1); // 0 = learning trickle, 1 = rush hour
function spawner(dt) {
  if ((spawnT -= dt) > 0) return;
  spawnT = (14 - 11.5 * traffic()) * rand(0.7, 1.3);
  if (cars.filter(c => c.kind === 'foreign').length > 24) return;
  const c = addCar('foreign', pick(AI_COLORS), pick(['hatch', 'hatch', 'mpv', 'suv', 'mini']));
  if (!enterStreet(c)) { scene.remove(c.mesh); cars.pop(); }
}

// ───────────────────────── player movement & actions
function carPen(c, x, z, ang) {
  let pen = 0;
  for (const [ax, az] of circles(x, z, ang, c.off)) {
    pen += Math.max(0, Math.abs(az) + MY_R - CURB_Z) + Math.max(0, Math.abs(ax) - 62);
    for (const o of cars) {
      if (o === c || o.state === 'away') continue;
      for (const [bx, bz] of circles(o.x, o.z, o.ang, o.off)) pen += Math.max(0, MY_R + CAR_R - Math.hypot(ax - bx, az - bz));
    }
    for (const b of bins) pen += Math.max(0, MY_R + BIN_R - Math.hypot(ax - b.x, az - b.z));
  }
  return pen;
}
function drive(c, dt) {
  const acc = keys.up ? 9 : keys.down ? (c.speed > 0.5 ? -16 : -6) : 0;
  c.speed += acc * dt;
  if (!acc) c.speed *= Math.pow(0.3, dt);
  if (keys.brake) c.speed *= Math.pow(0.01, dt);
  c.speed = clamp(c.speed, -5, 13);
  const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const ang = c.ang + steer * clamp(c.speed, -4, 4) * 0.55 * dt;
  const x = c.x + Math.cos(ang) * c.speed * dt, z = c.z - Math.sin(ang) * c.speed * dt;
  const before = carPen(c, c.x, c.z, c.ang), after = carPen(c, x, z, ang);
  if (after <= before + 1e-4) Object.assign(c, { x, z, ang });
  else {
    if (Math.abs(c.speed) > 3) { puff(x, z, 3, '#ddd'); floatText('Bump!', c.x, 2.8, c.z, '#ffd166'); }
    c.speed *= -0.2;
  }
}
const pedBounds = p => { p.x = clamp(p.x, -60, 60); p.z = clamp(p.z, -WALL_Z + 0.45, WALL_Z - 0.45); };
function pushOut(p) {
  for (const o of cars) {
    if (o.state === 'away') continue;
    for (const [bx, bz] of circles(o.x, o.z, o.ang, o.off)) {
      const dx = p.x - bx, dz = p.z - bz, d = Math.hypot(dx, dz), m = CAR_R + P_R;
      if (d < m && d > 1e-4) { p.x = bx + (dx / d) * m; p.z = bz + (dz / d) * m; }
    }
  }
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
    const v = binsInHand ? 4.3 : 6.2;
    player.x += vx * v * dt; player.z += vz * v * dt;
    player.ang = Math.atan2(-vz, vx);
  }
  pushOut(player);
}
const pedFree = (x, z) => Math.abs(z) < WALL_Z - 0.45 && Math.abs(x) < 60 &&
  !cars.some(o => o.state !== 'away' && circles(o.x, o.z, o.ang, o.off).some(([bx, bz]) => Math.hypot(x - bx, z - bz) < CAR_R + P_R));
const nearestMine = () => {
  let best = null, bd = 3.6;
  for (const c of cars) if (c.kind === 'mine') { const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < bd) { bd = d; best = c; } }
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
    if (c) { driving = c; c.speed = 0; person.g.visible = false; SFX.door(); }
    return;
  }
  const c = driving;
  if (Math.abs(c.speed) > 2) return toast('Slow down before getting out!');
  const sl = slots.find(s => inSlot(c, s));
  if (sl) { // tidy the car into the spot if it fits
    const ang = Math.cos(c.ang) >= 0 ? 0 : Math.PI;
    if (carPen(c, sl.x, sl.z, ang) <= carPen(c, c.x, c.z, c.ang) + 1e-4) Object.assign(c, { x: sl.x, z: sl.z, ang });
  }
  const cs = Math.cos(c.ang), sn = Math.sin(c.ang);
  for (const [a, l] of [[0, 1.8], [0, -1.8], [-c.len / 2 - 0.8, 0], [c.len / 2 + 0.8, 0], [0, 2.8], [0, -2.8]]) {
    const x = c.x + cs * a - sn * l, z = c.z - sn * a - cs * l;
    if (!pedFree(x, z)) continue;
    player.x = x; player.z = z; c.speed = 0; driving = null; person.g.visible = true; SFX.door();
    if (sl && (!sl.ai || sl.ai.state === 'drive')) { floatText('Spot secured!', sl.x, 3.2, sl.z, '#ffd166'); puff(sl.x, sl.z, 5, '#fff3c4'); SFX.block(); }
    return;
  }
  toast('No room to get out here');
}
function actionB() {
  if (driving) return;
  const b = binsInHand;
  if (!b) {
    const n = nearBin();
    if (!n) return toast('Walk up to a bin to grab it — or buy one (key 2)');
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
function buyCar() {
  const price = carPrice();
  if (score < price) return toast(`A car costs ${price} credits`);
  const from = driving || player;
  let best = null, bd = Infinity;
  for (const s of slots) { const d = Math.hypot(s.x - from.x, s.z - from.z); if (d < bd && !s.ai && (!s.block || s.block === player)) { bd = d; best = s; } }
  if (!best) return toast('No free spot to deliver your new car');
  score -= price; carsOwned++;
  const c = addCar('mine', MINE_COLORS[(carsOwned - 1) % MINE_COLORS.length], pick(['hatch', 'mini', 'mpv']));
  Object.assign(c, { x: best.x, z: best.z, ang: parkedAng(best) });
  puff(best.x, best.z, 10, '#fff3c4');
  floatText('New car delivered!', best.x, 3.4, best.z, '#ffd166');
  SFX.buy();
  pushOut(player);
}
function buyBin() {
  const price = binPrice();
  if (score < price) return toast(`A bin costs ${price} credits`);
  score -= price; binsBought++; SFX.buy();
  const b = newBin('#2f5d3a', '#ffd23f', 1.15), w = driving || player, side = Math.sign(w.z) || -1;
  if (driving || binsInHand) { putBin(b, sidewalkSpot(w.x, side) ?? w.x, side * BIN_Z); return toast('Your new bin is waiting on the sidewalk'); }
  binsInHand = b; carryBin(b, player.x, player.z, person.g.rotation.y);
  toast('Bin in hand — push it into a free spot, B to put it down');
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
  if (e.code === 'Digit2' || e.code === 'Numpad2') buyBin();
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
$('buyCar').onclick = e => { buyCar(); e.currentTarget.blur(); };
$('buyBin').onclick = e => { buyBin(); e.currentTarget.blur(); };

// ───────────────────────── per-frame bookkeeping
function computeBlocks() {
  for (const s of slots) {
    s.block = null;
    for (const c of cars) if (c.blocker && inSlot(c, s)) s.block = c;
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
let hudT = 0, wasProtected = false;
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
  $('binPrice').textContent = binPrice();
  $('buyCar').disabled = score < carPrice();
  $('buyBin').disabled = score < binPrice();
  $('inv').textContent = binsInHand ? '🗑️ Bin in hand · B to put it down' : `${carsOwned} car${carsOwned > 1 ? 's' : ''} owned`;
  let p = '';
  if (driving) p = slots.some(s => inSlot(driving, s)) ? 'E — leave the car here (spot blocked)' : 'E — get out';
  else if (binsInHand) p = Math.abs(binsInHand.z) > CURB_Z ? 'B — leave the bin on the sidewalk' : binSlot() ? 'B — block this spot with the bin' : 'Push the bin into a free spot or onto the sidewalk';
  else if (nearestMine()) p = 'E — drive this car';
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
    c.marker.position.y = 2.9 + Math.sin(elapsed * 3 + c.id) * 0.12;
  }
  person.g.position.set(player.x, 0, player.z);
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
import { buildRedhead, buildJack } from './models.js';
const SW = 5.9, BIN_Z = WALL_Z - 0.6, CROSS_XS = [-33, -0.1, 31], RED_GATE = -33, JACK_GATE = -3.6, ARMS_CARRY = 1.2; // arms forward (+rotation.z swings a hanging arm toward +x)
const CD = Array.from({ length: 11 }, (_, i) => markerMat('#f77f00', g => { g.font = '900 70px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i, 64, 68); }));
MARK.jack = markerMat('#06d6a0', g => { g.beginPath(); g.moveTo(64, 98); g.bezierCurveTo(18, 66, 32, 22, 64, 46); g.bezierCurveTo(96, 22, 110, 66, 64, 98); g.fill(); });
const tolerance = () => rand(40, 70) * (1 - 0.45 * traffic());
function newBin(body, lid, sc = 1) {
  const mesh = buildBin(scene, body, lid), tag = new THREE.Sprite(MARK.mine);
  mesh.scale.setScalar(sc); tag.position.y = 2.1; tag.scale.setScalar(0.8); tag.renderOrder = 5; tag.visible = false; mesh.add(tag);
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
const red = walker(buildRedhead), RED_HOME = -WALL_Z - 1.6;
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
const jackHome = () => Object.assign(J, { x: JACK_GATE, z: WALL_Z + 2.6, ang: Math.PI / 2, state: 'parked', speed: 0, blocker: false, phase: 'home', wait: rand(60, 100), goal: null, leaving: false });
jackHome(); Object.assign(J, { name: 'Jack', wait: 22 });
const bayFree = s => !s.ai && !s.block;
const laneFree = (x, back, fwd) => !cars.some(o => o !== J && o.state !== 'away' && o.state !== 'parked' && Math.abs(o.z) < 2.2 && o.x > x - back && o.x < x + fwd);
function jackGoal() { // nearest reachable pair of adjacent free bays (straddle the line), else a single free bay
  let best = null, bs = Infinity;
  for (const a of slots) {
    if (!bayFree(a)) continue;
    const b = slots.find(q => q.side === a.side && Math.abs(q.x - a.x - SLOT_LEN) < 0.1 && bayFree(q));
    const x = b ? (a.x + b.x) / 2 - 0.25 : a.x, sc = x - J.x + (b ? 0 : 1000); // ponytail: -0.25 so a centre-only inSlot still sees one bay
    if (x - J.x >= 10 && sc < bs) { bs = sc; best = { x, z: a.z, side: a.side, bays: b ? [a, b] : [a] }; }
  }
  return best;
}
function jack(dt) {
  switch (J.phase) {
    case 'home': case 'visit': case 'gone': case 'round':
      if ((J.wait -= dt) > 0) return;
      if (J.phase === 'home') {
        J.phase = 'walk'; Object.assign(jw, { x: JACK_GATE - 1.3, z: WALL_Z + 5 });
        go(jw, [[JACK_GATE - 1.3, WALL_Z + 3]], () => { jw.g.visible = false; J.phase = 'wait'; if (nearPlayer(J.x, J.z)) SFX.door(); });
      } else if (J.phase === 'visit') {
        J.phase = 'walk'; Object.assign(jw, { x: JACK_GATE, z: WALL_Z + 1.6 });
        go(jw, route(JACK_GATE, WALL_Z + 1.6, J.x - 0.6, J.goal.side * 5.3), () => { jw.g.visible = false; J.phase = 'unpark'; if (nearPlayer(J.x, J.z)) SFX.door(); });
      } else if (J.phase === 'gone') { jackHome(); J.mesh.visible = true; }
      else if (enterStreet(J)) J.phase = 'drive';
      return;
    case 'wait':
      if (!laneFree(JACK_GATE, 28, 8)) return;
      Object.assign(J, { path: [[JACK_GATE, J.z], [JACK_GATE, 2.5], [JACK_GATE + 2, 0], [JACK_GATE + 6, 0]], dur: 3.2, t: 0, state: 'out', phase: 'out' });
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
      go(jw, route(jw.x, jw.z, JACK_GATE, WALL_Z + 1.6), () => { jw.g.visible = false; J.phase = 'visit'; J.wait = rand(60, 90); });
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

function neighbours(dt) {
  for (const b of bins) {
    b.tag.visible = !!b.slot;
    if (b.slot) { b.t -= dt; b.tag.material = b.t <= 0 ? MARK.foreign : b.t <= 10 ? CD[Math.ceil(b.t)] : MARK.mine; }
  }
  if (binsInHand) carryBin(binsInHand, player.x, player.z, person.g.rotation.y);
  redhead(); jack(dt); stepWalkers(dt);
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
queueMicrotask(() => Object.assign(window.__game, { jack: J, jw, red, walkers, held: () => binsInHand, selfTestNeighbours })); // after __game exists

// ───────────────────────── setup
function setup() {
  const start = slots.find(s => s.side === -1 && s.x === -3.8);
  const mine = addCar('mine', MINE_COLORS[0], 'hatch');
  Object.assign(mine, { x: start.x, z: start.z, ang: parkedAng(start) });
  player.x = start.x + 1.2; player.z = -6.2;
  computeBlocks();
  const freeSlot = () => pick(slots.filter(s => !s.ai && !s.block));
  NEIGHBOURS.forEach((n, i) => {
    const c = addCar('neighbour', n.color, n.type);
    Object.assign(c, { name: n.name, home: rand(-25, 25) });
    if (i < 3) placeParked(c, freeSlot(), rand(30, 120));
    else { c.state = 'away'; c.timer = rand(8, 40); c.mesh.visible = false; }
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
  if (!paused) { sync(dt); updateFx(dt); paintSlots(); }
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
window.__game = { cars, slots, bins, player, keys, actionE, actionB, buyCar, buyBin, start: () => $('start').click(), get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; },
  get score() { return score; }, set score(v) { score = v; }, get driving() { return driving; }, get rate() { return rate; }, get binsInHand() { return binsInHand; },
  zoom(v) { viewH = v; resize(); },
  step(sec, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { update(dt); sync(dt); updateFx(dt); } } };
