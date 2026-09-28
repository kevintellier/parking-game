// Jack, behind his tall laurel hedge — reference photos: Aguesseau_1-3.png, aguesseau_haut.png
// Street: cream wall with a brick coping, brick pillars, arched crimson slats, a 4 m laurel hedge hiding the lot.
// Aerial: a long single-storey wing with an anthracite roof along the north (+x) boundary, a taller hip-roofed block
// set back ~9 m on its south side, and a treed front garden with a terrace and a white parasol.
import * as THREE from 'three';

// brick pillar face (0.44 m × 2.3 m: 2 bricks across, 35 courses), mixed orange / tan / brown bricks
const BRICK = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d'), ch = 512 / 35, cols = ['#c77a45', '#d49a5e', '#a9603a', '#ddb07a', '#b86b3e', '#8f5232', '#cf8a50'];
  g.fillStyle = '#d8ccb4'; g.fillRect(0, 0, 64, 512);
  for (let r = 0; r < 35; r++) for (let x = r % 2 ? -16 : 0, i = 0; x < 64; x += 32, i++) {
    g.fillStyle = cols[(r * 5 + i * 3 + ((r * r) % 7)) % cols.length];
    g.fillRect(x + 1.5, r * ch + 1.5, 29, ch - 3);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
})();

export const hero = { style: { wall: '#eeeae0', cap: '#c68650', pil: BRICK, ph: 2.3, slat: '#8d2d3b', hedge: 'laurel', gate: '#8d2d3b' } };

const WALL = '#f3f1ea', SHUT = '#aab2b8', PLINTH = '#bcb4a6', EAVE = '#e9e7e2';

// hip roof over the eave rectangle x0..x1 × z0..z1 (ridge along z, needs z1 - z0 > x1 - x0), UVs in metres / 2
function hip(k, x0, x1, z0, z1, y, rh, mat) {
  const V = THREE.Vector3, xc = (x0 + x1) / 2, e = (x1 - x0) / 2, t = y + rh;
  const A = new V(x0, y, z0), B = new V(x1, y, z0), C = new V(x1, y, z1), D = new V(x0, y, z1), R0 = new V(xc, t, z0 + e), R1 = new V(xc, t, z1 - e);
  const pos = [], nor = [], uv = [];
  for (let [p, q, r] of [[A, D, R1], [A, R1, R0], [B, R0, R1], [B, R1, C], [D, C, R1], [A, R0, B]]) {
    const n = q.clone().sub(p).cross(r.clone().sub(p)).normalize();
    if (n.y < 0) { [q, r] = [r, q]; n.negate(); }
    const ed = new V(-n.z, 0, n.x).normalize(), up = n.clone().cross(ed);
    if (up.y < 0) up.negate();
    for (const v of [p, q, r]) { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push(v.dot(ed) / 2, v.dot(up) / 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  k.mesh(k.S, g, mat);
  k.box(k.S, x1 - x0, 0.14, z1 - z0, EAVE, xc, y - 0.07, (z0 + z1) / 2); // soffit + fascia
}
// rendered block with plinth, top band and hip roof (overhang ov)
function block(k, x0, x1, z0, z1, h, rh, roof, ov = 0.45) {
  const w = x1 - x0, d = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
  k.box(k.S, w, h, d, WALL, x, h / 2, z);
  k.box(k.S, w + 0.08, 0.4, d + 0.08, PLINTH, x, 0.2, z);
  hip(k, x0 - ov, x1 + ov, z0 - ov, z1 + ov, h + 0.1, rh, roof);
}

export default function build(k, l) {
  const { S, box, tbox, win, door, M } = k;
  // anthracite fibre-cement slates
  const slate = k.tmat(k.canvasTex(128, g => {
    g.fillStyle = '#2f3236'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) for (let x = (y & 16) ? -8 : 0; x < 128; x += 16) {
      g.fillStyle = `hsl(210,${k.sr(3, 7)}%,${k.sr(30, 38)}%)`; g.fillRect(x + 1, y + 1, 14, 14);
    }
  }), '#fff', { roughness: 0.7 });

  // long single-storey wing along the north boundary; the entrance faces the driveway
  const wx0 = -10.1, wx1 = -6.35, wz0 = -27.5, wz1 = -13.6;
  block(k, wx0, wx1, wz0, wz1, 2.9, 1.35, slate, 0.35);
  door(S, -9.35, wz1 + 0.02, 0, '#e8e6e0', false);
  box(S, 1.5, 0.08, 0.9, EAVE, -9.35, 2.45, wz1 + 0.45); // flat canopy over the door
  win(S, -7.4, 1.5, wz1 + 0.03, 0, SHUT);
  for (const z of [-16, -19.6, -23.2, -26.2]) win(S, wx1 + 0.03, 1.5, z, Math.PI / 2, SHUT);

  // main block, two storeys, set back behind the garden
  const mx0 = -15.3, mz1 = -16.6, mz0 = -26.8, h = 5.4;
  block(k, mx0, wx0, mz0, mz1, h, 2.3, slate);
  for (const x of [-13.9, -11.5]) win(S, x, 4.0, mz1 + 0.03, 0, SHUT);
  win(S, -13.9, 1.5, mz1 + 0.03, 0, SHUT);
  door(S, -11.5, mz1 + 0.02, 0, '#e8e6e0', false);
  for (const z of [-19.2, -24.2]) win(S, wx0 + 0.03, 4.1, z, Math.PI / 2, SHUT, 0.9);
  box(S, 0.62, 1.7, 0.62, WALL, -12.7, h + 2.2, -22.5); // chimney
  box(S, 0.76, 0.1, 0.76, '#8d8a85', -12.7, h + 3.1, -22.5);
  box(S, 0.04, 1.5, 0.04, '#55585c', -12.35, h + 3.8, -22.5); // TV antenna
  for (let i = -2; i <= 2; i++) box(S, 0.5 - Math.abs(i) * 0.08, 0.02, 0.02, '#55585c', -12.35, h + 4.4, -22.5 + i * 0.26);

  // paving: the driveway runs on to the entrance; stone terrace in front of the main block
  tbox(S, 4.0, 0.03, 2.1, k.COBBLE, -8.4, 0.015, -12.55);
  tbox(S, 5.2, 0.06, 2.6, M('#d8d3c7'), -12.7, 0.03, -15.3);
  // white hexagonal parasol over a garden table
  box(S, 0.06, 2.3, 0.06, '#e9e7e2', -12.9, 1.15, -15.1);
  k.mesh(S, new THREE.ConeGeometry(1.45, 0.55, 6), '#f4f2ec', -12.9, 2.45, -15.1);
  k.mesh(S, new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12), '#f1efe9', -12.9, 0.74, -15.1);
  box(S, 0.08, 0.72, 0.08, '#b9b6af', -12.9, 0.36, -15.1);
  for (const [dx, dz] of [[-0.85, 0], [0.85, 0], [0, 0.85]]) box(S, 0.42, 0.45, 0.42, '#5d666d', -12.9 + dx, 0.23, -15.1 + dz);

  // treed front garden behind the hedge, big trees south of the house, a few shrubs
  k.tree(S, -20.4, -12.6, 6.2);
  k.tree(S, -14.6, -12.3, 5.2);
  k.tree(S, -19.8, -19.5, 6.8);
  k.tree(S, -21.0, -24.5, 6.0, 'red');
  k.shrub(S, -16.6, -14.6, 0.7);
  k.shrub(S, -10.9, -14.2, 0.5, true);
  k.shrub(S, -18.2, -16.2, 0.8);
  return 4.3; // wires reach the house over the hedge
}
