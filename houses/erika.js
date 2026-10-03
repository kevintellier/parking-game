// Erika (the player) — reference photos: maison.png, Aguesseau_1-2.png, aguesseau_haut.png
// A 1930s pavillon: cream render, steep terracotta gable facing the street (attic window with brown shutters, bargeboards
// on brackets), tiled canopy over the door, grey lintel bands, chimney + velux on the north (+x) slope, a rear extension in
// line with the house, a white double garage with a grey roof flush with the facade on the north side (the driveway, x = -25),
// an olive tree and an in-ground pool in the back garden.
export const hero = { style: 'green', mail: '#2d5a43', wicket: -30.6 }; // green pedestrian gate in line with the door

const WALL = '#ecdfc4', TRIM = '#f6f4ee', QUOIN = '#f4efe3', BAND = '#5b6168', WOOD = '#5e3424', SHUT = '#6b3f2a', PLINTH = '#c9c0b0';
const X0 = -34.4, X1 = -26.8, ZF = -11.5, ZB = -20.5, H = 3.3; // main block footprint and eave height
const CX = (X0 + X1) / 2, W = X1 - X0, D = ZF - ZB, CZ = (ZF + ZB) / 2;

function group(k, P, x, y, z, ry = 0) { const g = new k.THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; P.add(g); return g; }

// white casement window with small panes (local +z = outside); optional brown shutters, grey lintel band above
function win(k, x, y, z, ry, w, h, { shut, band = true } = {}) {
  const g = group(k, k.S, x, y, z, ry);
  k.box(g, w + 0.14, h + 0.14, 0.06, TRIM);
  k.box(g, w - 0.08, h - 0.08, 0.06, k.GLASS, 0, 0, 0.02);
  k.box(g, 0.06, h, 0.08, TRIM, 0, 0, 0.04);
  for (const q of [-1, 1]) {
    k.box(g, w, 0.035, 0.07, TRIM, 0, q * h / 6, 0.04);
    k.box(g, 0.03, h, 0.07, TRIM, q * w / 4, 0, 0.04);
  }
  k.box(g, w + 0.24, 0.07, 0.24, shut ? '#a86a4a' : '#d8d2c6', 0, -h / 2 - 0.1, 0.1);
  if (shut) for (const q of [-1, 1]) {
    k.box(g, w / 2 + 0.04, h + 0.1, 0.05, shut, q * (w * 0.75 + 0.1), 0, 0.03);
    for (const t of [-0.3, 0.3]) k.box(g, w / 2 + 0.04, 0.05, 0.07, '#4e2c1e', q * (w * 0.75 + 0.1), t * h, 0.04);
  }
  if (band) k.box(g, w + 0.7, 0.15, 0.14, BAND, 0, h / 2 + 0.2, 0.06);
}

// gable roof over a box: ridge along local z (rotate the group for a ridge along x); bargeboards on both gables
function roof(k, g, span, len, rh, rm, wc, { ov = 0.45, gov = 0.35, trim = WOOD, ridge = '#8b3b27', brackets = false } = {}) {
  const half = span / 2, a = Math.atan2(rh, half), sl = Math.hypot(half, rh) + ov, L = len + 2 * gov;
  k.mesh(g, new k.THREE.ExtrudeGeometry(new k.THREE.Shape([k.V2(-half, 0), k.V2(half, 0), k.V2(0, rh)]), { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2), wc);
  const slabs = [];
  for (const q of [-1, 1]) {
    const x = q * (sl * Math.cos(a) / 2 + Math.sin(a) * 0.1), y = rh - sl * Math.sin(a) / 2 + Math.cos(a) * 0.1;
    const m = rm.isMaterial ? k.tbox(g, sl, 0.2, L, rm, x, y, 0) : k.box(g, sl, 0.2, L, rm, x, y, 0);
    m.rotation.z = -q * a; slabs.push(m);
    for (const z of [-1, 1]) k.box(g, sl, 0.26, 0.06, trim, x - q * Math.sin(a) * 0.06, y - Math.cos(a) * 0.06, z * (L / 2 + 0.02)).rotation.z = -q * a;
    k.box(g, 0.06, 0.22, L, trim, q * (half + ov * Math.cos(a) + 0.03), -ov * Math.sin(a) - 0.02, 0); // eave fascia
    if (brackets) for (const f of [0.3, 0.65, 0.98]) for (const z of [-1, 1]) // carved rafter brackets under the gable overhang
      k.box(g, 0.08, 0.14, gov + 0.05, trim, q * half * f, rh * (1 - f) - 0.08, z * (len / 2 + gov / 2));
  }
  k.box(g, 0.28, 0.2, L, ridge, 0, rh + 0.12, 0);
  return slabs;
}

export default function build(k, l) {
  const S = k.S, rm = k.tmat(k.tileTex, '#f6d2bd', { roughness: 0.75 });

  // ── main block, gable to the street
  k.box(S, W, H, D, WALL, CX, H / 2, CZ);
  k.box(S, W + 0.08, 0.45, D + 0.08, PLINTH, CX, 0.225, CZ);
  for (const x of [X0, X1]) k.box(S, 0.3, H - 0.45, 0.3, QUOIN, x + Math.sign(CX - x) * -0.02, H / 2 + 0.22, ZF - 0.12); // corner pilasters
  k.box(S, 0.3, H - 0.45, 0.3, QUOIN, X1 + 0.02, H / 2 + 0.22, ZB + 0.12);
  const R = group(k, S, CX, H, CZ);
  const slabs = roof(k, R, W, D, 3.3, rm, WALL, { brackets: true });
  // velux near the top of the north (+x) slope, towards the back
  k.box(slabs[1], 0.9, 0.06, 1.1, '#e6e4de', -0.9, 0.12, -1.6); k.box(slabs[1], 0.74, 0.07, 0.94, k.GLASS, -0.9, 0.13, -1.6);
  // chimney on the north slope at the back, TV antenna beside it
  const chx = CX + 1.3, chz = ZB + 1.6, ct = H + 3.3 + 1.0;
  k.box(S, 0.7, ct - H, 0.8, QUOIN, chx, H + (ct - H) / 2, chz);
  k.box(S, 0.86, 0.12, 0.96, '#9a958c', chx, ct + 0.06, chz);
  for (const dz of [-0.18, 0.18]) k.box(S, 0.2, 0.3, 0.2, '#a4573b', chx, ct + 0.27, chz + dz);
  k.box(S, 0.04, 1.8, 0.04, '#55585c', chx - 0.5, ct + 0.6, chz);
  k.box(S, 0.03, 0.03, 1.3, '#55585c', chx - 0.5, ct + 1.35, chz);
  for (let i = -2; i <= 2; i++) k.box(S, 0.6 - Math.abs(i) * 0.09, 0.02, 0.02, '#55585c', chx - 0.5, ct + 1.35, chz + i * 0.28);

  // street gable: attic window with shutters, door under a tiled canopy, two windows with grey lintel bands
  const fz = ZF + 0.03;
  win(k, CX, H + 0.95, fz, 0, 0.75, 1.05, { shut: SHUT, band: false });
  for (const dx of [-2.05, 2.05]) win(k, CX + dx, 1.55, fz, 0, 1.05, 1.25);
  const dg = group(k, S, CX, 0, fz);
  k.box(dg, 1.1, 2.35, 0.06, TRIM, 0, 1.55, 0);
  k.box(dg, 0.9, 2.15, 0.08, '#4b5159', 0, 1.47, 0.02);
  k.box(dg, 0.56, 0.9, 0.09, k.GLASS, 0, 1.95, 0.03);
  for (const x of [-0.12, 0.12]) k.box(dg, 0.03, 0.9, 0.1, '#3a3f45', x, 1.95, 0.04);
  k.box(dg, 1.5, 0.15, 0.14, BAND, 0, 2.85, 0.06);
  k.box(dg, 1.6, 0.2, 0.5, '#cfcac0', 0, 0.3, 0.25); k.box(dg, 1.9, 0.2, 0.9, '#cfcac0', 0, 0.1, 0.45); // steps
  k.tbox(dg, 2.4, 0.08, 1.0, rm, 0, 3.12, 0.48).rotation.x = 0.38; // canopy
  k.box(dg, 2.42, 0.14, 0.05, WOOD, 0, 2.93, 0.97);
  for (const q of [-1, 1]) { k.box(dg, 0.07, 0.07, 0.95, WOOD, q * 1.0, 2.75, 0.4).rotation.x = -0.55; k.box(dg, 0.07, 0.6, 0.07, WOOD, q * 1.0, 2.75, 0.06); }
  // north side (+x): blind, the garage stands against it

  // ── rear extension: as wide as the house and in line with it, eaves as high, ridge just below the main one
  const rz0 = ZB, rz1 = -25.2, rd = rz0 - rz1;
  k.box(S, W, H, rd, WALL, CX, H / 2, (rz0 + rz1) / 2);
  k.box(S, W + 0.08, 0.45, rd + 0.08, PLINTH, CX, 0.225, (rz0 + rz1) / 2);
  roof(k, group(k, S, CX, H, (rz0 + rz1) / 2), W, rd, 2.9, rm, WALL, { gov: 0.25 });
  win(k, X1 + 0.03, 1.55, (rz0 + rz1) / 2, Math.PI / 2, 1.05, 1.25);
  win(k, CX - 1.6, 1.55, rz1 - 0.03, Math.PI, 1.05, 1.25);
  win(k, CX + 1.6, 1.55, rz1 - 0.03, Math.PI, 1.05, 1.25);

  // ── double garage against the north side, front flush with the facade: white, low gable with grey roof, two doors
  const gx0 = X1, gx1 = -21.35, gx = (gx0 + gx1) / 2, gw = gx1 - gx0, gz0 = ZF, gz1 = ZF - 6, gh = 2.6, gd = gz0 - gz1;
  k.box(S, gw, gh, gd, TRIM, gx, gh / 2, (gz0 + gz1) / 2);
  roof(k, group(k, S, gx, gh, (gz0 + gz1) / 2), gw, gd, 1.2, '#666b71', TRIM, { ov: 0.25, gov: 0.2, trim: '#f2f1ec', ridge: '#55595e' });
  for (const dx of [-1.3, 1.3]) {
    k.box(S, 2.3, 2.1, 0.06, '#dcdcd6', gx + dx, 1.05, gz0 + 0.03);
    for (let i = 1; i < 5; i++) k.box(S, 2.3, 0.03, 0.08, '#b9b9b3', gx + dx, i * 0.42, gz0 + 0.04);
  }

  // ── front garden: paved path to the door, big laurel bush (south) behind a green privacy mesh, a round shrub
  k.box(S, 1.2, 0.04, 3.6, '#bdb5a6', CX, 0.02, -9.7);
  k.box(S, 4.6, 0.78, 0.03, '#2c5a3e', -34.45, 1.36, -7.84);
  for (const [x, z, r, y] of [[-36.2, -8.9, 1.3, 1.3], [-35.0, -9.4, 1.2, 1.5], [-36.1, -10.5, 1.2, 2.1], [-34.9, -10.6, 1.0, 2.4], [-33.6, -9.0, 0.9, 1.1], [-35.6, -9.6, 1.0, 2.6]])
    k.blob(S, x, y, z, r, k.sp(k.HEDGES.laurel), 0.95);
  k.blob(S, -28.3, 0.75, -10.4, 0.8, '#3f6e2c', 0.9);
  k.blob(S, -32.2, 0.45, -10.9, 0.5, '#557f3a', 0.8);
  k.shrub(S, -29.2, -9.2, 0.4, true);

  // ── back garden: long hedge on the south boundary, round in-ground pool (stone coping flush with the lawn), an olive tree
  k.zhedge(-36.65, -11.6, -28, 1.8, k.HEDGES.privet, 0.7);
  k.mesh(S, new k.THREE.CylinderGeometry(1.95, 1.95, 0.06, 24), '#e3ddd0', -34.3, 0.03, -27.4);
  k.mesh(S, new k.THREE.CylinderGeometry(1.65, 1.65, 0.07, 24), '#4fa9d9', -34.3, 0.035, -27.4);
  const ox = -29.6, oz = -27.6; // olive: short twisted trunk, a few leaning limbs, loose silver-green crown
  for (const [dx, dz, rx, rz, h] of [[0, 0, 0.12, -0.1, 1.2], [0.2, -0.1, 0.5, 0.3, 1.1], [-0.2, 0.1, -0.45, -0.25, 1.0]]) {
    const m = k.mesh(S, k.TRUNK, '#7a6a55', ox + dx + Math.sin(rz) * -0.4, 0.2 + h * 0.5, oz + dz + Math.sin(rx) * 0.4); m.scale.set(1.3, h, 1.3); m.rotation.set(rx, 0, rz);
  }
  for (let i = 0; i < 7; i++) k.blob(S, ox + k.sr(-1.1, 1.1), k.sr(2.0, 2.8), oz + k.sr(-0.9, 0.9), k.sr(0.55, 0.85), k.sp(['#8b9a6e', '#9aa982', '#7c8c63', '#a3ae8c']), 0.7);
  return H + 1.2;
}
