// Jack, behind his tall laurel hedge — reference photos: Aguesseau_1-3.png, aguesseau_haut.png
// Street: cream wall with a brick coping, brick pillars, arched crimson slats, a 4 m laurel hedge hiding the lot.
// A single-storey L under anthracite hip roofs: a long wing along the north (+x) boundary whose front end is a single
// garage opening straight onto the street (Jack's car lives in it), and a block set back ~9 m on its south side.
// The garden, front and back, is full of trees; a terrace with a white parasol in front of the house.
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

export const hero = { style: { wall: '#eeeae0', cap: '#c68650', pil: BRICK, ph: 2.3, slat: '#8d2d3b', hedge: 'laurel', gate: '#8d2d3b' }, wicket: -12.4, streetGarage: true }; // wicket through the hedge, facing the terrace

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
// rendered block with plinth, top band and hip roof (overhang ov; roof null: none)
function block(k, x0, x1, z0, z1, h, rh, roof, ov = 0.45) {
  const w = x1 - x0, d = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
  k.box(k.S, w, h, d, WALL, x, h / 2, z);
  k.box(k.S, w + 0.08, 0.4, d + 0.08, PLINTH, x, 0.2, z);
  if (roof) hip(k, x0 - ov, x1 + ov, z0 - ov, z1 + ov, h + 0.1, rh, roof);
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

  // long wing along the north boundary, its front end a garage on the street line, open on Jack's car (game.js parks it at z -10.1)
  const h = 2.9, wx0 = l.gate - 1.8, wx1 = l.gate + 1.8, wz0 = -27.5, wz1 = -7.65, gz = -13.6;
  block(k, wx0, wx1, wz0, gz, h, 1.35, null); // one hip roof over the whole wing, garage included
  hip(k, wx0 - 0.35, wx1 + 0.35, wz0 - 0.35, wz1 + 0.3, h + 0.1, 1.35, slate);
  for (const x of [wx0 + 0.1, wx1 - 0.1]) box(S, 0.2, h, wz1 - gz, WALL, x, h / 2, (wz1 + gz) / 2); // garage side walls
  box(S, wx1 - wx0, 0.5, 0.2, WALL, l.gate, h - 0.25, wz1 - 0.1); // lintel over the opening
  box(S, wx1 - wx0 - 0.4, 0.02, wz1 - gz, '#8f8c86', l.gate, 0.01, (wz1 + gz) / 2); // concrete floor
  box(S, wx1 - wx0 - 0.4, h, 0.05, '#4a4d50', l.gate, h / 2, gz + 0.03); // dim back wall
  box(S, wx1 - wx0, 0.1, wz1 - gz, EAVE, l.gate, h - 0.05, (wz1 + gz) / 2); // ceiling
  for (const z of [-16, -19.6, -23.2, -26.2]) win(S, wx1 + 0.03, 1.5, z, Math.PI / 2, SHUT);

  // the other leg of the L, single storey too, set back behind the garden; the entrance faces the terrace
  const mx0 = -15.3, mz1 = -16.6, mz0 = -26.8;
  block(k, mx0, wx0, mz0, mz1, h, 1.5, slate);
  win(S, -13.9, 1.5, mz1 + 0.03, 0, SHUT);
  door(S, -11.5, mz1 + 0.02, 0, '#e8e6e0', false);
  box(S, 1.5, 0.08, 0.9, EAVE, -11.5, 2.45, mz1 + 0.45); // flat canopy over the door
  win(S, mx0 - 0.03, 1.5, -21.7, -Math.PI / 2, SHUT);
  box(S, 0.62, 1.4, 0.62, WALL, -12.7, h + 1.6, -22.5); // chimney
  box(S, 0.76, 0.1, 0.76, '#8d8a85', -12.7, h + 2.35, -22.5);
  box(S, 0.04, 1.5, 0.04, '#55585c', -12.35, h + 3.1, -22.5); // TV antenna
  for (let i = -2; i <= 2; i++) box(S, 0.5 - Math.abs(i) * 0.08, 0.02, 0.02, '#55585c', -12.35, h + 3.7, -22.5 + i * 0.26);

  // stone terrace in front of the house
  tbox(S, 5.2, 0.06, 2.6, M('#d8d3c7'), -12.7, 0.03, -15.3);
  tbox(S, 1.1, 0.05, 6.2, M('#d8d3c7'), l.wicket, 0.025, -10.9); // path from the wicket to the terrace
  // white hexagonal parasol over a garden table
  box(S, 0.06, 2.3, 0.06, '#e9e7e2', -12.9, 1.15, -15.1);
  k.mesh(S, new THREE.ConeGeometry(1.45, 0.55, 6), '#f4f2ec', -12.9, 2.45, -15.1);
  k.mesh(S, new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12), '#f1efe9', -12.9, 0.74, -15.1);
  box(S, 0.08, 0.72, 0.08, '#b9b6af', -12.9, 0.36, -15.1);
  for (const [dx, dz] of [[-0.85, 0], [0.85, 0], [0, 0.85]]) box(S, 0.42, 0.45, 0.42, '#5d666d', -12.9 + dx, 0.23, -15.1 + dz);

  // a garden full of trees, front and back, a few shrubs
  for (const [x, z, t, kind] of [[-19.4, -12.6, 6.2], [-14.6, -12.3, 5.2], [-17.2, -10.4, 5], [-16.6, -14.6, 5.6, 'red'], [-19.6, -16.3, 5.8, 'cone'],
    [-10.9, -10.2, 4.6], [-19.8, -19.5, 6.8], [-17.2, -22.2, 6.2], [-19.9, -24.5, 6.0, 'red'], [-17.6, -27.6, 5.5, 'cone'], [-13.2, -28.5, 5.2], [-10.3, -28.8, 4.8]])
    k.tree(S, x, z, t, kind);
  k.shrub(S, -10.9, -14.2, 0.5, true);
  k.shrub(S, -18.2, -13.6, 0.8);
  return 3.6; // wires reach the house over the hedge
}
