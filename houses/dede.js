// Dédé (89) — reference photos: dede.png, Aguesseau_2-3.png, aguesseau_haut.png
// White two-storey house, ridge along the street, very wide flat-topped dormer in white brick, balcony with
// diamond railing over the garage, recessed entrance porch, textured white-brick bands, lower cream annex
// with a roof terrace and a brick chimney on the corner side.
export const hero = {
  style: { wall: '#f1f0ec', cap: '#e4e3de', pil: '#f3f2ee', bar: '#3e4146', gate: '#3e4146' },
  num: '89', mail: '#ecebe6', wicket: -41, // pedestrian gate in line with the porch
};

const W = 10.4, D = 9.2, H = 6.0, RH = 3.4; // main block: width (x), depth (z), eave height, roof rise
const WALL = '#f3f2ee', RAIL = '#3e4146';

export default function build(k, l) {
  const T = k.THREE, X0 = l.gate - 2.6, Z0 = -l.zf; // garage door centred on the gate; front face on the facade line
  const g = new T.Group(); g.position.set(X0, 0, Z0); k.S.add(g);
  // box with per-face UVs in metres (1 texture repeat = `u` metres), for bricks and roller-shutter slats
  const fbox = (P, w, h, d, mat, x, y, z, u = 1) => {
    const geo = new T.BoxGeometry(w, h, d), uv = geo.attributes.uv, f = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < uv.count; i++) { const [a, b] = f[i >> 2]; uv.setXY(i, uv.getX(i) * a / u, uv.getY(i) * b / u); }
    return k.mesh(P, geo, mat, x, y, z);
  };
  const BRICK = k.tmat(k.canvasTex(256, (c, s) => { // white split-face blocks
    c.fillStyle = '#f2f1ec'; c.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) {
      c.fillStyle = '#d3d1ca'; c.fillRect(0, r * 32, s, 3);
      for (let x = (r & 1) * 43; x < s + 86; x += 86) c.fillRect(x, r * 32, 3, 32);
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(0,0,0,${k.sr(0.02, 0.06)})`; c.fillRect(k.rnd() * s, r * 32 + 4 + k.rnd() * 26, k.sr(4, 20), 2); }
    }
  }));
  const SLATS = k.tmat(k.canvasTex(64, (c, s) => {
    c.fillStyle = '#e6e6e1'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#c4c4be'; for (let y = 0; y < s; y += 4) c.fillRect(0, y, s, 1);
  }));
  const TILES = k.tmat(k.tileTex, '#94685c', { roughness: 0.75 });
  const PAVE = k.tmat(k.canvasTex(128, (c, s) => {
    c.fillStyle = '#bfae94'; c.fillRect(0, 0, s, s);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = `hsl(36,${k.sr(22, 30)}%,${k.sr(66, 74)}%)`; c.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
  }));
  const bar = (P, x0, y0, x1, y1, z, t = 0.035) => { // thin rail between two points in an xy plane
    const m = k.box(P, Math.hypot(x1 - x0, y1 - y0), t, t, RAIL, (x0 + x1) / 2, (y0 + y1) / 2, z);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0); return m;
  };
  // window with roller shutter pulled down to `c` (0 open .. 1 closed); faces +z of its group
  const rwin = (P, x, y, z, w, h, c = 0.8, rot = 0, sill = '#8f8e8a') => {
    const q = new T.Group(); q.position.set(x, y, z); q.rotation.y = rot; P.add(q);
    k.box(q, w + 0.14, h + 0.14, 0.05, '#fbfaf7', 0, 0, 0);
    k.box(q, w, h, 0.06, k.GLASS, 0, 0, 0.01);
    fbox(q, w + 0.04, h * c, 0.04, SLATS, 0, h / 2 - h * c / 2, 0.05, 0.5);
    k.box(q, w + 0.2, 0.06, 0.18, sill, 0, -h / 2 - 0.1, 0.08);
  };

  // ── main block: first floor + attic over a ground floor with a recessed porch on the right
  k.box(g, W, H - 2.8, D, WALL, W / 2, 2.8 + (H - 2.8) / 2, -D / 2);
  k.box(g, 6.2, 2.8, D, WALL, 3.1, 1.4, -D / 2);
  fbox(g, W - 6.7, 2.8, D - 1.0, BRICK, 6.2 + (W - 6.7) / 2, 1.4, -1.0 - (D - 1.0) / 2);
  fbox(g, 0.5, 2.8, D, BRICK, W - 0.25, 1.4, -D / 2); // brick corner post of the porch
  k.box(g, W + 0.06, 0.3, D + 0.06, '#d9d7d0', W / 2, 0.15, -D / 2); // plinth
  fbox(g, 2.5, H, 0.06, BRICK, 5.05, H / 2, 0.02); // central white-brick band
  fbox(g, 0.8, H + 0.1, 1.2, BRICK, -0.1, (H + 0.1) / 2, -0.35); // brick pier on the left end
  k.box(g, 0.1, 0.1, D + 0.9, '#d4d3ce', W + 0.45, H - 0.1, -D / 2); // gutters
  k.box(g, W + 1.0, 0.14, 0.14, '#d4d3ce', W / 2, H - 0.1, 0.5);
  k.box(g, 0.08, H - 0.1, 0.08, '#d4d3ce', W + 0.1, (H - 0.1) / 2, 0.35); // downpipe

  // gable roof, ridge along the street (same construction as the kit's house)
  const half = D / 2, ov = 0.45, a = Math.atan2(RH, half), sl = Math.hypot(half, RH) + ov;
  const r = new T.Group(); r.position.set(W / 2, H, -D / 2); r.rotation.y = Math.PI / 2; g.add(r);
  k.mesh(r, new T.ExtrudeGeometry(new T.Shape([k.V2(-half, 0), k.V2(half, 0), k.V2(0, RH)]), { depth: W, bevelEnabled: false }).translate(0, 0, -W / 2), WALL);
  for (const q of [-1, 1]) k.tbox(r, sl, 0.2, W + 2 * ov, TILES, q * (sl * Math.cos(a) / 2 + Math.sin(a) * 0.1), RH - sl * Math.sin(a) / 2 + Math.cos(a) * 0.1, 0).rotation.z = -q * a;
  k.box(r, 0.3, 0.2, W + 2 * ov, '#7c3a28', 0, RH + 0.1, 0);
  for (const zz of [-W / 2 - ov, W / 2 + ov]) for (const q of [-1, 1]) { // white verge boards
    const m = k.box(r, sl, 0.26, 0.06, '#f4f3ef', q * sl * Math.cos(a) / 2, RH - sl * Math.sin(a) / 2 + 0.05, zz); m.rotation.z = -q * a;
  }
  // ◇◇ ornament high on the +x gable
  const orn = new T.Group(); orn.position.set(W + 0.03, H + RH * 0.55, -D / 2); orn.rotation.y = Math.PI / 2; g.add(orn);
  for (const cx of [-0.42, 0.42]) for (const [x0, y0, x1, y1] of [[-0.5, 0, 0, 0.3], [0, 0.3, 0.5, 0], [0.5, 0, 0, -0.3], [0, -0.3, -0.5, 0]])
    k.box(orn, Math.hypot(x1 - x0, y1 - y0), 0.07, 0.04, '#b9b8b3', cx + (x0 + x1) / 2, (y0 + y1) / 2, 0).rotation.z = Math.atan2(y1 - y0, x1 - x0);

  // wide flat-topped dormer in white brick, two roller-shuttered windows
  const dx0 = 1.3, dx1 = 8.4, dz = -0.6, dtop = 8.2, dback = -3.5;
  fbox(g, dx1 - dx0, dtop - H + 0.2, dz - dback, BRICK, (dx0 + dx1) / 2, (H - 0.2 + dtop) / 2, (dz + dback) / 2);
  k.box(g, dx1 - dx0 + 0.3, 0.16, dz - dback + 0.25, '#b9b8b2', (dx0 + dx1) / 2, dtop + 0.08, (dz + dback) / 2 + 0.12);
  k.box(g, dx1 - dx0 + 0.32, 0.1, 0.05, '#9b9a95', (dx0 + dx1) / 2, dtop + 0.06, dz + 0.26);
  rwin(g, 3.35, 7.05, dz + 0.02, 1.9, 1.1, 0.7, 0, '#4a4b4d');
  rwin(g, 6.35, 7.05, dz + 0.02, 2.0, 1.1, 0.7, 0, '#4a4b4d');

  // chimneys
  for (const [cx, cz, ch] of [[8.3, -D / 2 - 0.3, 1.0], [W - 0.6, -D + 1.6, 1.4]]) {
    const hh = H + RH * (1 - Math.abs(cz + D / 2) / half) + ch;
    k.box(g, 0.55, hh - H, 0.55, '#dcd9d2', cx, (H + hh) / 2, cz);
    k.box(g, 0.7, 0.1, 0.7, '#6f6c68', cx, hh + 0.05, cz);
  }

  // street facade: first floor French window behind the balcony, right window, garage door
  rwin(g, 2.45, 3.95, 0.02, 2.4, 2.0, 0.75);
  rwin(g, 7.6, 4.3, 0.02, 2.1, 1.35, 0.7);
  k.box(g, 0.28, 0.2, 0.03, '#c9a44a', 6.9, 3.35, 0.04); // brass plaques
  k.box(g, 0.2, 0.15, 0.03, '#c9a44a', 8.7, 3.2, 0.04);
  k.box(g, 2.6, 2.25, 0.05, '#f7f6f2', 2.6, 1.12, 0.02);
  k.box(g, 2.4, 2.1, 0.06, '#2b2f35', 2.6, 1.05, 0.04);
  for (let i = 1; i < 7; i++) k.box(g, 2.4, 0.04, 0.08, '#60656c', 2.6, i * 0.3, 0.04);
  for (let i = 1; i < 4; i++) k.box(g, 0.04, 2.1, 0.08, '#60656c', 1.4 + i * 0.6, 1.05, 0.04);
  k.box(g, 0.18, 0.12, 0.08, '#2b2b2b', 0.8, 2.3, 0.05); // wall lamp
  // porch (recessed 1 m): dark gridded door and narrow window
  const pz = -1.0 + 0.02;
  k.box(g, 1.0, 2.2, 0.05, '#f7f6f2', 8.1, 1.1, pz);
  k.box(g, 0.85, 2.1, 0.07, '#2b2f35', 8.1, 1.05, pz + 0.01);
  k.box(g, 0.6, 1.5, 0.08, k.GLASS, 8.1, 1.2, pz + 0.02);
  k.box(g, 0.04, 1.5, 0.1, '#2b2f35', 8.1, 1.2, pz + 0.03);
  for (const y of [0.75, 1.2, 1.65]) k.box(g, 0.6, 0.04, 0.1, '#2b2f35', 8.1, y, pz + 0.03);
  k.box(g, 1.3, 0.14, 0.9, '#cfcac0', 8.1, 0.07, -0.55); // doorstep
  k.box(g, 0.7, 1.35, 0.05, '#f7f6f2', 7.0, 1.4, pz);
  k.box(g, 0.56, 1.2, 0.07, k.GLASS, 7.0, 1.4, pz + 0.01);
  for (const y of [1.0, 1.4, 1.8]) k.box(g, 0.56, 0.04, 0.09, '#2b2f35', 7.0, y, pz + 0.02);
  k.box(g, 0.04, 1.2, 0.09, '#2b2f35', 7.0, 1.4, pz + 0.02);

  // balcony over the garage: slab + railing in three panels, each with a flat double diamond
  const bx0 = 0.1, bx1 = 6.0, bd = 1.25, bz = bd - 0.05, by = 2.78, top = by + 1.05;
  k.box(g, bx1 - bx0, 0.16, bd, '#eeede8', (bx0 + bx1) / 2, by, bd / 2);
  k.box(g, bx1 - bx0, 0.05, 0.05, RAIL, (bx0 + bx1) / 2, top, bz);
  k.box(g, bx1 - bx0, 0.04, 0.04, RAIL, (bx0 + bx1) / 2, by + 0.15, bz);
  const pw = (bx1 - bx0) / 3, my = by + 0.6;
  for (let p = 0; p <= 3; p++) k.box(g, 0.05, top - by, 0.05, RAIL, bx0 + p * pw, (by + top) / 2, bz);
  for (let p = 0; p < 3; p++) {
    const c = bx0 + (p + 0.5) * pw, hw = pw / 2 - 0.12;
    bar(g, c - hw, my, c + hw, my, bz);
    for (const [ax, ay] of [[hw, 0.28], [0.3, 0.1]]) for (const q of [-1, 1]) { bar(g, c - ax, my, c, my + q * ay, bz, 0.03); bar(g, c, my + q * ay, c + ax, my, bz, 0.03); }
    for (const x of [c - hw, c + hw]) k.box(g, 0.03, top - by - 0.15, 0.03, RAIL, x, (by + 0.15 + top) / 2, bz);
  }
  for (const x of [bx0, bx1]) { // side returns back to the wall
    k.box(g, 0.05, 0.05, bd, RAIL, x, top, bd / 2);
    for (const zz of [0.35, 0.7]) k.box(g, 0.03, top - by, 0.03, RAIL, x, (by + top) / 2, zz);
  }

  // +x side (seen by the camera): roller-shuttered windows on both floors
  for (const [zz, y, w, h] of [[-2.3, 4.3, 1.2, 1.3], [-6.4, 4.3, 1.2, 1.3], [-6.4, 1.5, 1.2, 1.3], [-2.9, 1.4, 0.7, 1.0]]) rwin(g, W + 0.02, y, zz, w, h, 0.6, Math.PI / 2);

  // ── cream annex on the corner side: two storeys, flat-roofed front room with a railed terrace on top
  const A = new T.Group(); A.position.set(-2.5, 0, 0); g.add(A); // annex local x -2.5..0 (world lot edge + 0.1)
  const AC = '#ede5d8', AW = 2.3, ah = 5.5;
  k.box(A, AW, ah, 7.5, AC, AW / 2, ah / 2, -1.5 - 3.75);
  k.box(A, AW + 0.05, 0.3, 7.55, '#d9d7d0', AW / 2, 0.15, -5.25);
  const ar = new T.Group(); ar.position.set(AW / 2, ah, -5.25); ar.rotation.y = Math.PI / 2; A.add(ar);
  const ahf = 3.75, arh = 1.7, aa = Math.atan2(arh, ahf), asl = Math.hypot(ahf, arh) + 0.35;
  k.mesh(ar, new T.ExtrudeGeometry(new T.Shape([k.V2(-ahf, 0), k.V2(ahf, 0), k.V2(0, arh)]), { depth: AW, bevelEnabled: false }).translate(0, 0, -AW / 2), AC);
  for (const q of [-1, 1]) k.tbox(ar, asl, 0.18, AW + 0.3, TILES, q * (asl * Math.cos(aa) / 2 + Math.sin(aa) * 0.1), arh - asl * Math.sin(aa) / 2 + Math.cos(aa) * 0.1, 0.15).rotation.z = -q * aa;
  k.box(A, 0.6, 3.0, 0.5, '#9c4f36', 0.5, ah + 1.2, -4.2); // brick chimney + TV antenna
  k.box(A, 0.7, 0.1, 0.6, '#6f6c68', 0.5, ah + 2.75, -4.2);
  k.box(A, 0.04, 1.6, 0.04, '#55585c', 0.9, ah + 3.5, -4.2);
  k.box(A, 0.03, 0.03, 1.3, '#55585c', 0.9, ah + 4.2, -4.2);
  for (let i = -2; i <= 2; i++) k.box(A, 0.55 - Math.abs(i) * 0.08, 0.02, 0.02, '#55585c', 0.9, ah + 4.2, -4.2 + i * 0.28);
  rwin(A, AW / 2 + 0.1, 4.2, -1.48, 0.9, 1.3, 0.3);
  k.box(A, AW, 2.8, 3.0, WALL, AW / 2, 1.4, -1.5 + 1.5 - 0.0); // ground-floor front room reaching z = +1.5
  k.box(A, AW + 0.1, 0.12, 3.1, '#e2e1dc', AW / 2, 2.86, 0);
  k.box(A, AW, 0.05, 0.05, RAIL, AW / 2, 3.9, 1.45);
  for (let x = 0.1; x < AW; x += 0.16) k.box(A, 0.03, 0.95, 0.03, RAIL, x, 3.4, 1.45);
  k.box(A, 0.05, 0.05, 3.0, RAIL, AW - 0.02, 3.9, 0);
  for (let z = -1.3; z < 1.45; z += 0.16) k.box(A, 0.03, 0.95, 0.03, RAIL, AW - 0.02, 3.4, z);

  // ── front garden: beige tiled forecourt and path to the porch, shrubs, pots, bamboo
  const tile = (x0, x1, z0, z1) => fbox(k.S, x1 - x0, 0.03, z1 - z0, PAVE, (x0 + x1) / 2, 0.035, (z0 + z1) / 2, 1.2);
  tile(X0 + 0.2, X0 + 4.9, Z0 + 0.0, -7.8);
  tile(X0 + 4.9, X0 + 8.8, Z0 - 1.0, Z0 + 1.2);
  tile(l.wicket - 0.6, l.wicket + 0.6, Z0 + 1.2, -7.8); // path from the wicket
  const pot = (x, z, col, r) => { k.mesh(k.S, new T.CylinderGeometry(r, r * 0.75, r * 1.5, 10), col, x, r * 0.75, z); return r * 1.5; };
  const bamboo = (x, z) => {
    const ph = pot(x, z, '#6a9a3a', 0.3);
    for (let i = 0; i < 9; i++) { const m = k.box(k.S, 0.03, k.sr(1.6, 2.2), 0.03, '#7f9a4a', x + k.sr(-0.15, 0.15), ph + 0.9, z + k.sr(-0.15, 0.15)); m.rotation.set(k.sr(-0.15, 0.15), 0, k.sr(-0.15, 0.15)); }
    for (let i = 0; i < 4; i++) k.blob(k.S, x + k.sr(-0.3, 0.3), ph + k.sr(1.1, 2.0), z + k.sr(-0.25, 0.25), 0.3, '#7e9a45', 1.4);
  };
  bamboo(X0 + 0.9, Z0 + 1.0);
  k.shrub(k.S, X0 + 0.5, Z0 + 2.2, 0.35, true);
  for (let i = 0; i < 7; i++) k.inst(k.FLOWER, k.M('#8e6ac8'), X0 + k.sr(0.2, 1.0), 0.3, Z0 + k.sr(1.6, 3.2));
  const tp = pot(X0 + 8.95, Z0 - 0.3, '#8a8580', 0.22);
  k.blob(k.S, X0 + 8.95, tp + 0.25, Z0 - 0.3, 0.32, '#5f8f3e', 1.1);
  k.blob(k.S, -38.4, 1.2, -9.3, 1.1, '#4f7a35', 1.2); // big shrubs behind the right-hand railing
  k.blob(k.S, -39.6, 1.0, -10.4, 0.9, '#5f8f3e', 1.1);
  k.blob(k.S, -38.3, 0.9, -11.2, 0.8, '#3f6b30', 1.0);
  k.shrub(k.S, -42.8, -8.6, 0.5, true);
  // back garden: lawn with a couple of trees
  k.tree(k.S, -48.5, -26, 6.5, 'green');
  k.tree(k.S, -40, -28, 5.5, 'green');
  return H;
}
