// Valérie, the red-haired neighbour, and her husband « le père » — reference photos: valerie.png, Aguesseau_2.png, aguesseau_haut.png
// A salmon-pink single-storey house, gable end to the street: round œil-de-bœuf in the gable, two windows with grey hoods,
// mint sills and yellow awnings, a lean-to glazed entry on the south side, two roof windows on the north slope.
// Front boundary: pink rendered wall + pale wavy railing, pink pillars, solid sage-green gate.
export const hero = {
  style: { wall: '#e6a491', cap: '#ece9e3', pil: '#e6a491', bar: '#d2e3db', wave: true, gate: '#9fc4b1', ph: 1.95, ball: '#8fa6bf' },
  num: '92', mail: '#98b0a3', // no pedestrian gate
};

const PINK = '#f7bfac', MINT = '#9dc6ae', WHITE = '#f4f3ee', HOOD = '#dcd9d1', VERGE = '#93402b';

// casement window facing local +z (rotY: π → -z, π/2 → +x, -π/2 → -x)
function fen(k, x, y, z, rotY, awning, wd = 1.1, ht = 1.45) {
  const g = new k.THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; k.S.add(g);
  k.box(g, wd, ht, 0.06, WHITE);
  k.box(g, wd - 0.2, ht - 0.17, 0.06, k.GLASS, 0, 0, 0.02);
  k.box(g, 0.06, ht - 0.17, 0.08, WHITE, 0, 0, 0.04);
  k.box(g, wd + 0.2, 0.08, 0.2, MINT, 0, -ht / 2 - 0.04, 0.08); // mint sill
  k.box(g, wd + 0.2, 0.14, 0.16, HOOD, 0, ht / 2 + 0.11, 0.07); // grey lintel hood
  if (awning) { k.box(g, wd - 0.18, 0.13, 0.1, '#e4c35c', 0, ht / 2 - 0.2, 0.06); k.box(g, wd - 0.18, 0.04, 0.11, '#6f767d', 0, ht / 2 - 0.29, 0.06); }
}
// round œil-de-bœuf facing local +z: white ring, cross bars, shadowed reveal, mint sill
function oeil(k, x, y, z, rotY) {
  const g = new k.THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; k.S.add(g);
  k.box(g, 0.9, 0.9, 0.02, '#e7ab98');
  k.mesh(g, new k.THREE.TorusGeometry(0.33, 0.06, 6, 24), WHITE, 0, 0, 0.04);
  k.mesh(g, new k.THREE.CylinderGeometry(0.31, 0.31, 0.03, 24), k.GLASS, 0, 0, 0.02).rotation.x = Math.PI / 2;
  k.box(g, 0.64, 0.035, 0.05, WHITE, 0, 0, 0.04); k.box(g, 0.035, 0.64, 0.05, WHITE, 0, 0, 0.04);
  k.box(g, 0.95, 0.07, 0.16, MINT, 0, -0.5, 0.07);
}

export default function build(k, l) {
  const { S, box, tbox, mesh, M } = k, zf = l.zf;
  const X0 = -26.1, X1 = -19.5, w = X1 - X0, cx = (X0 + X1) / 2, D = 8.6, zc = zf + D / 2, zb = zf + D, H = 3.0;
  const roof = k.tmat(k.tileTex, '#ffe2d6', { roughness: 0.75 });

  // main body, plinth, eaves band
  box(S, w, H, D, PINK, cx, H / 2, zc);
  box(S, w + 0.06, 0.35, D + 0.06, '#c98877', cx, 0.175, zc);
  // gable roof, ridge perpendicular to the street (as in the aerial view), 0.45 m overhangs
  const half = w / 2, rh = 1.95, ov = 0.45, a = Math.atan2(rh, half), sl = Math.hypot(half, rh) + ov, len = D + 2 * ov;
  const r = new k.THREE.Group(); r.position.set(cx, H, zc); S.add(r);
  mesh(r, new k.THREE.ExtrudeGeometry(new k.THREE.Shape([k.V2(-half, 0), k.V2(half, 0), k.V2(0, rh)]), { depth: D, bevelEnabled: false }).translate(0, 0, -D / 2), PINK);
  for (const q of [-1, 1]) {
    const m = tbox(r, sl, 0.18, len, roof, q * (sl * Math.cos(a) / 2 + Math.sin(a) * 0.09), rh - sl * Math.sin(a) / 2 + Math.cos(a) * 0.09, 0);
    m.rotation.z = -q * a;
    box(m, sl, 0.03, len - 0.02, '#cfc7bb', 0, -0.1, 0); // soffit under the overhangs
    for (const e of [-1, 1]) box(m, sl + 0.04, 0.14, 0.18, VERGE, 0, 0.1, e * (len / 2 - 0.08)); // rounded verge tiles on the rakes
    if (q > 0) for (const v of [-1.4, 1.6]) { box(m, 0.8, 0.05, 1.0, '#e6e4de', -0.4, 0.11, v); box(m, 0.64, 0.06, 0.84, k.GLASS, -0.4, 0.12, v); } // velux, north slope
    // white gutter along the eaves
    box(S, 0.13, 0.13, len, WHITE, cx + q * (sl * Math.cos(a) + 0.03), H + rh - sl * Math.sin(a) - 0.03, zc);
  }
  box(r, 0.26, 0.18, len, VERGE, 0, rh + 0.14, 0); // ridge tiles
  // downpipes: front-south corner (as in the photo) and back-north corner
  for (const [x, z, q] of [[X0 - 0.08, zf + 0.12, -1], [X1 + 0.08, zb - 0.12, 1]]) {
    box(S, 0.09, H - 0.15, 0.09, WHITE, x, (H - 0.15) / 2 + 0.05, z);
    box(S, 0.09, 0.4, 0.09, WHITE, x + q * 0.2, H - 0.25, z).rotation.z = q * 0.8;
  }

  // street gable (faces -z): two windows with awnings, œil-de-bœuf
  for (const x of [X1 - 0.29 * w, X1 - 0.71 * w]) fen(k, x, 1.72, zf - 0.03, Math.PI, true);
  oeil(k, cx, H + 0.5, zf - 0.03, Math.PI);
  // back gable (+z, facing the camera): glazed door with a small tiled canopy, window, œil-de-bœuf, terrace
  fen(k, X1 - 1.7, 1.72, zb + 0.03, 0, true);
  oeil(k, cx, H + 0.5, zb + 0.03, 0);
  {
    const dx = X0 + 2.1;
    box(S, 1.2, 2.3, 0.06, WHITE, dx, 1.3, zb + 0.03);
    box(S, 0.95, 2.05, 0.08, k.GLASS, dx, 1.22, zb + 0.04);
    box(S, 0.06, 2.05, 0.1, WHITE, dx, 1.22, zb + 0.05);
    box(S, 1.4, 0.14, 0.16, HOOD, dx, 2.55, zb + 0.08);
    tbox(S, 4.0, 0.1, 2.2, M('#b3a797'), cx - 0.6, 0.05, zb + 1.1); // paved terrace
  }
  // north side (+x, camera side): two windows; south side: one window behind the entry
  for (const z of [zf + 2.4, zf + 6.2]) fen(k, X1 + 0.03, 1.72, z, Math.PI / 2, false);
  fen(k, X0 - 0.03, 1.72, zf + 6.0, -Math.PI / 2, false);

  // lean-to glazed entry on the south side, set back from the street gable
  {
    const e0 = X0 - 1.25, ez0 = zf + 1.1, ed = 2.6, eh = 2.3, ex = (e0 + X0) / 2, ew = X0 - e0 + 0.25;
    box(S, X0 - e0, eh, ed, PINK, ex, eh / 2, ez0 + ed / 2);
    const ra = Math.atan2(0.35, ew), rl = Math.hypot(ew, 0.35), rl2 = ed + 0.3; // single slope, high against the house
    const m = tbox(S, rl, 0.12, rl2, roof, X0 - ew / 2, eh + 0.28, ez0 + ed / 2 - 0.15);
    m.rotation.z = ra;
    box(m, rl + 0.04, 0.12, 0.16, VERGE, 0, 0.08, -rl2 / 2 + 0.08);
    box(S, X0 - e0, 0.28, 0.05, WHITE, ex, eh + 0.1, ez0 - 0.03); // white fascia under the roof edge
    box(S, 0.1, 0.1, rl2, WHITE, e0 - 0.3, eh + 0.06, ez0 + ed / 2 - 0.15); // gutter
    box(S, 0.95, 2.15, 0.06, WHITE, ex, 1.12, ez0 - 0.03);
    box(S, 0.75, 1.9, 0.07, M('#d8c983', { roughness: 0.3 }), ex, 1.1, ez0 - 0.04); // frosted yellow glass
    for (const y of [0.75, 1.45]) box(S, 0.75, 0.04, 0.09, WHITE, ex, y, ez0 - 0.05);
    box(S, 1.3, 0.16, 0.5, '#cfcac0', ex, 0.08, ez0 - 0.25); // step
  }

  // driveway beyond the kerb-side pavés (pale paving, as in the aerial view) and path to the entry
  tbox(S, 3.2, 0.03, 7.4, k.COBBLE, l.gate, 0.015, zf + 3.7);
  tbox(S, 1.25, 0.03, 1.1, M('#bdb5a8'), X0 - 0.62, 0.025, zf + 0.55);

  // planting: poppies on the sidewalk at the wall foot, low shrubs in front, trees in the back garden
  k.poppies(l.x0 + 0.4, l.x1 - 0.4, l.s * (k.WALL_Z - 0.33), l.gate, l.wicket);
  k.shrub(S, -22.8, zf - 0.7, 0.45, false);
  k.shrub(S, -20.3, zf - 0.9, 0.55, true);
  k.shrub(S, -25.2, 8.5, 0.4, true);
  k.tree(S, -23.5, zb + 6.5, 5.5);
  k.tree(S, -29.2, zb + 5.5, 6.5);
  k.tree(S, -20.6, zb + 3.5, 5, 'cone');
  k.shrub(S, -29.8, zb + 3, 0.9, false);
  // solid sage-green gate leaf (drawn open behind the wall by game.js as bars) — the real one is full panels
  box(S, 3.6, 1.6, 0.02, M(l.st.gate, { metalness: 0.4, roughness: 0.5 }), l.gate + 2.5, 0.95, 7.87);
  return H;
}
