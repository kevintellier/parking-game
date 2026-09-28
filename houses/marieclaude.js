// Marie-Claude — reference photos: Aguesseau_1.png (far left, looking south: banana, black railing), aguesseau_haut.png
// Two-storey white house, ridge along the street, grey tiled roof with white boxed eaves, grey shutters;
// flat grey canopy against the front wall north of the gate; big banana tree behind the gate, a large bush to the south.
export const hero = { style: { wall: '#eeede8', cap: '#e0ded8', pil: '#eeede8', bar: '#1e1f21', gate: '#1e1f21' }, mail: '#f1efe9' };

let tiles; // grey interlocking tiles (same layout as the kit's tileTex: courses along texture v)
export default function build(k, l) {
  const { THREE, S, box, tbox, mesh, win, door, V2, sr, sp, rnd, blob } = k;
  const W = 10, D = 8, H = 5.6, cx = -12.3, cz = l.zf + D / 2, fz = D / 2 + 0.03; // s = 1: street facade faces -z
  const wall = '#f2f0ea', white = '#f8f7f3', shut = '#6a6f75', grey = '#8e9094';
  tiles ||= k.canvasTex(256, (g, s) => {
    g.setTransform(0, 1, 1, 0, 0, 0);
    const c = s / 6;
    g.fillStyle = '#2f3134'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += c) for (let x = 0; x < s; x += 32) {
      const lt = sr(40, 47);
      g.fillStyle = `hsl(215,${sr(3, 7)}%,${lt}%)`; g.fillRect(x + 1, y, 30, c - 2);
      g.fillStyle = `hsla(215,6%,${lt + 10}%,.3)`; g.fillRect(x + 12, y, 6, c - 9);
      g.fillStyle = 'rgba(10,12,16,.35)'; g.fillRect(x + 1, y + c - 9, 30, 7);
    }
  });
  const rm = k.tmat(tiles, '#fff', { roughness: 0.8 });

  const g = new THREE.Group(); g.position.set(cx, 0, cz); S.add(g);
  box(g, W, H, D, wall, 0, H / 2, 0);
  box(g, W + 0.1, 0.45, D + 0.1, '#bdbab3', 0, 0.225, 0); // plinth
  box(g, W + 0.06, 0.12, D + 0.06, white, 0, 2.95, 0); // floor band
  box(g, W + 0.08, 0.14, D + 0.08, white, 0, H - 0.07, 0);

  // gable roof, ridge along the street (x): wall-coloured gables, two tiled slabs, white boxed eaves, grey gutters
  const half = D / 2, rh = 3.0, ov = 0.6, a = Math.atan2(rh, half), sl = Math.hypot(half, rh) + ov, len = W + 0.6;
  const r = new THREE.Group(); r.position.y = H; r.rotation.y = Math.PI / 2; g.add(r); // local z = world x, local -x = world +z (back)
  mesh(r, new THREE.ExtrudeGeometry(new THREE.Shape([V2(-half, 0), V2(half, 0), V2(0, rh)]), { depth: W, bevelEnabled: false }).translate(0, 0, -W / 2), wall);
  for (const q of [-1, 1]) {
    const m = tbox(r, sl, 0.2, len, rm, q * (sl * Math.cos(a) / 2 + Math.sin(a) * 0.1), rh - sl * Math.sin(a) / 2 + Math.cos(a) * 0.1, 0);
    m.rotation.z = -q * a;
    for (const e of [-1, 1]) box(m, sl, 0.26, 0.06, white, 0, -0.1, e * len / 2); // white verge boards
    const ex = half + ov * Math.cos(a);
    box(r, ex - half + 0.05, 0.1, len, white, q * (half + ex) / 2, -ov * Math.sin(a) - 0.05, 0); // soffit
    box(r, 0.06, 0.32, len, white, q * ex, -ov * Math.sin(a) + 0.02, 0); // fascia
    box(r, 0.14, 0.13, len, grey, q * (ex + 0.1), -ov * Math.sin(a) + 0.02, 0); // gutter
    for (const e of [-1, 1]) box(r, 0.45, 0.4, 0.34, white, q * (half + 0.2), -0.25, e * (W / 2 + 0.12)); // eave returns
  }
  box(r, 0.34, 0.2, len, '#55575b', 0, rh + 0.12, 0); // ridge tiles
  box(r, 0.6, rh + 0.8, 0.6, wall, -1.4, (rh + 0.8) / 2, 2.6); // chimney on the back slope
  box(r, 0.74, 0.1, 0.74, '#8d8a85', -1.4, rh + 0.85, 2.6);
  for (const z of [-D / 2 - 0.08, D / 2 + 0.08]) box(g, 0.08, H, 0.08, grey, W / 2 - 0.25, H / 2, z); // downpipes

  // street facade: door behind the gate, ground-floor windows, four shuttered first-floor windows
  const xs = [-3.75, -1.25, 1.25, 3.75];
  xs.forEach((x, i) => {
    if (i === 1) door(g, x, -fz, Math.PI, '#3f4347', false); else win(g, x, 1.55, -fz, Math.PI, shut);
    win(g, x, H - 1.45, -fz, Math.PI, shut);
  });
  // back facade (+z, seen by the game camera): French door onto the garden, windows, small terrace
  xs.forEach((x, i) => {
    if (i === 2) door(g, x, fz, 0, k.GLASS, false); else win(g, x, 1.55, fz, 0, shut);
    win(g, x, H - 1.45, fz, 0, shut);
  });
  box(g, 4.2, 0.12, 2.4, '#c9c4b8', 1.25, 0.06, D / 2 + 1.2);
  // north gable (+x)
  for (const z of [-2, 2]) for (const y of [1.55, H - 1.45]) win(g, W / 2 + 0.03, y, z, Math.PI / 2, shut);
  win(g, W / 2 + 0.03, H + rh * 0.33, 0, Math.PI / 2, shut, 0.7);

  // flat grey canopy on white posts, against the front wall north of the gate, rain pipe down the front corner
  const c0 = -9.7, c1 = -6.4, cz0 = 7.95, cz1 = l.zf;
  const cr = box(S, c1 - c0, 0.12, cz1 - cz0, '#9a9c9f', (c0 + c1) / 2, 2.4, (cz0 + cz1) / 2); cr.rotation.x = -0.04;
  box(S, c1 - c0 + 0.08, 0.2, 0.08, white, (c0 + c1) / 2, 2.28, cz0);
  for (const x of [c0, c1]) { box(S, 0.08, 0.2, cz1 - cz0, white, x, 2.4, (cz0 + cz1) / 2); box(S, 0.12, 2.3, 0.12, white, x + (x < -8 ? 0.1 : -0.1), 1.15, cz0 + 0.12); }
  box(S, 0.08, 2.3, 0.08, grey, c0 - 0.02, 1.15, cz0 + 0.02);

  // front garden: tall banana tree just north of the gate, big rounded bush to the south, lower shrubs by the wall
  for (const [dx, dz, sh] of [[0, 0, 3.6], [0.5, 0.3, 2.9], [-0.4, 0.45, 2.3]]) { // banana clump: pseudo-stems + long arching leaves
    const x = -10.4 + dx, z = 9.5 + dz;
    mesh(S, k.TRUNK, sp(['#7d7c4c', '#8a9150']), x, sh / 2, z).scale.set(1.2, sh, 1.2);
    for (let i = 0; i < 8; i++) { // leaf: three segments, rising then arching over, tapering
      let p = new THREE.Group(); p.position.set(x, sh - sr(0, 0.4), z); p.rotation.set(0, i * 0.8 + sr(0, 0.5), sr(0.8, 1.25)); S.add(p);
      const c = rnd() < 0.15 ? '#9c9350' : sp(['#6f9b3a', '#86ad48', '#5c8a30', '#78a444']), L = sr(0.95, 1.2), w = sr(0.55, 0.7);
      for (let j = 0; j < 3; j++) {
        box(p, L, 0.03, w * (1 - j * 0.22), c, L / 2, 0, 0);
        const q = new THREE.Group(); q.position.x = L; q.rotation.z = -sr(0.4, 0.65); p.add(q); p = q;
      }
    }
  }
  const G = ['#3f6b30', '#4f7a35', '#557f3a', '#5f8f3e'];
  for (const [x, y, z, rr] of [[-17, 1.2, 9.4, 1.3], [-16.1, 1.9, 9.8, 1.2], [-17.4, 2.3, 10.1, 1.0], [-16.6, 2.7, 9.6, 0.8], [-15.8, 1.0, 9.2, 0.9]]) blob(S, x, y, z, rr, sp(G));
  for (const x of [-18.3, -15.7, -8.6]) k.shrub(S, x + sr(-0.2, 0.2), 8.5 + sr(0, 0.4), sr(0.45, 0.6));
  return H;
}
