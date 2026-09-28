// Marion (88) — reference photos: marion.png, Aguesseau_3.png (seen from the north), aguesseau_haut.png
// A 1920s pavillon: steep gable to the street with flared eaves (coyau), orange tiles, cream render on a millstone
// (meulière) basement; a small entry wing with steps on the north (+x) side, a low mono-pitch annex on the south (-x)
// side, a tall Japanese maple in front of the annex.
export const hero = { style: { wall: '#ece6da', cap: '#b7b5b0', pil: '#e8e3d9', bar: '#222427', gate: '#3b4450' }, num: '88', mail: '#2b2d30' };

const CREAM = '#ebe1cd', TRIM = '#f4efe4', FRAME = '#8f969b';

// Draws everything in the lot behind the front wall and returns the facade height. The kit is KIT in game.js.
export default function build(k, l) {
  const { THREE, S, box, mesh, M, V2 } = k;
  // box with world-scaled UVs on every face (one texture = 2 m)
  const ubox = (P, w, h, d, mat, x = 0, y = 0, z = 0) => {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < uv.count; i++) { const [a, b] = dims[i >> 2]; uv.setXY(i, uv.getX(i) * a / 2, uv.getY(i) * b / 2); }
    return mesh(P, g, mat, x, y, z);
  };
  const grp = (P, x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; P.add(g); return g; };
  const prism = (P, pts, depth, col, z0) => mesh(P, new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => V2(x, y))), { depth, bevelEnabled: false }), col, 0, 0, z0);

  // bright orange mechanical tiles (the kit's tiles are darker brown-red)
  const tiles = k.tmat(k.canvasTex(256, (g, s) => {
    g.setTransform(0, 1, 1, 0, 0, 0);
    const c = s / 6;
    g.fillStyle = '#7a2e16'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += c) for (let x = 0; x < s; x += 32) {
      const L = k.sr(44, 52);
      g.fillStyle = `hsl(${k.sr(13, 18)},${k.sr(58, 66)}%,${L}%)`; g.fillRect(x + 1, y, 30, c - 2);
      g.fillStyle = `hsla(22,70%,${L + 10}%,.35)`; g.fillRect(x + 12, y, 6, c - 9);
      g.fillStyle = 'rgba(70,20,0,.35)'; g.fillRect(x + 1, y + c - 9, 30, 7);
    }
  }), '#fff', { roughness: 0.75 });
  // meulière: rough ochre millstone with pale mortar joints
  const stone = k.tmat(k.canvasTex(256, (g, s) => {
    g.fillStyle = '#d9cfbc'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 110; i++) {
      const x = k.rnd() * s, y = k.rnd() * s, r = k.sr(12, 24);
      g.fillStyle = `hsl(${k.sr(26, 40)},${k.sr(18, 32)}%,${k.sr(52, 68)}%)`;
      g.beginPath();
      for (let j = 0; j < 7; j++) { const a = j / 7 * 6.283, q = r * k.sr(0.6, 1); g.lineTo(x + Math.cos(a) * q * 1.3, y + Math.sin(a) * q); }
      g.fill();
    }
  }));
  // window: moulded render surround, grey PVC frame; shut = closed white roller shutter
  const win = (P, x, y, z, ry, ww, wh, shut) => {
    const g = grp(P, x, y, z, ry);
    box(g, ww + 0.24, wh + 0.24, 0.05, TRIM);
    box(g, ww, wh, 0.07, FRAME, 0, 0, 0.01);
    if (shut) { box(g, ww - 0.08, wh - 0.08, 0.08, '#eeede8', 0, 0, 0.02); for (let v = -wh / 2 + 0.2; v < wh / 2; v += 0.2) box(g, ww - 0.1, 0.015, 0.09, '#cfcdc6', 0, v, 0.02); }
    else { box(g, ww - 0.16, wh - 0.16, 0.08, k.GLASS, 0, 0, 0.015); box(g, 0.06, wh - 0.1, 0.09, FRAME, 0, 0, 0.02); }
    box(g, ww + 0.3, 0.07, 0.2, '#d6d1c5', 0, -wh / 2 - 0.13, 0.08);
  };

  // ── main block: 7 m wide gable to the street, 8.6 m deep
  const zf = l.zf, X1 = -32.6, w = 7, X0 = X1 - w, cx = (X0 + X1) / 2, d = 8.6, zc = zf + d / 2, H = 5.0, half = w / 2, rh = 3.5;
  const g = grp(S, cx, 0, zc);
  box(g, w, H, d, CREAM, 0, H / 2, 0);
  ubox(g, w + 0.1, 1.3, d + 0.1, stone, 0, 0.65, 0); // raised basement in meulière
  box(g, w + 0.16, 0.08, d + 0.16, '#d8d2c4', 0, 1.33, 0);
  box(g, w + 0.06, 0.12, d + 0.06, TRIM, 0, 3.95, 0); // string course under the attic floor
  prism(g, [[-half, H], [half, H], [0, H + rh]], d, CREAM, -d / 2); // gable walls
  // gable decoration: tie beam and king post in relief, bargeboards and brackets under the rakes
  for (const q of [-1, 1]) {
    const z = q * (d / 2 + 0.03), a = Math.atan2(rh, half), L = Math.hypot(half, rh);
    box(g, 3.4, 0.1, 0.05, TRIM, 0, H + 1.75, z);
    box(g, 0.1, rh - 1.75, 0.05, TRIM, 0, H + 1.75 + (rh - 1.75) / 2, z);
    for (const s of [-1, 1]) {
      const bz = q * (d / 2 + 0.33);
      box(g, L + 0.3, 0.26, 0.05, '#f7f4ec', s * half / 2, H + rh / 2 - 0.08, bz).rotation.z = -s * a;
      for (const f of [0.25, 0.55, 0.85]) box(g, 0.08, 0.3, 0.34, '#7a6a5c', s * half * f, H + rh * (1 - f) - 0.22, q * (d / 2 + 0.17));
    }
  }
  // roof: two steep tiled slabs, each ending in a flatter flared eave that oversails the side walls
  {
    const r = grp(g, 0, H, 0), a = Math.atan2(rh, half), L = Math.hypot(half, rh) + 0.12, len = d + 0.7, t = 0.18, b = a * 0.42, fl = 0.85;
    for (const s of [-1, 1]) {
      const m = ubox(r, L, t, len, tiles, s * (half - L * Math.cos(a) / 2 + 0.08 + Math.sin(a) * t / 2), rh - L * Math.sin(a) / 2 + 0.08 + Math.cos(a) * t / 2, 0);
      m.rotation.z = -s * a;
      const f = ubox(r, fl, t, len, tiles, s * (half + fl * Math.cos(b) / 2 - 0.02 + Math.sin(b) * t / 2), -fl * Math.sin(b) / 2 + 0.08 + Math.cos(b) * t / 2, 0);
      f.rotation.z = -s * b;
      box(r, 0.14, 0.14, len, '#d9d5cc', s * (half + fl * Math.cos(b) + 0.02), -fl * Math.sin(b) + 0.02, 0); // gutter
      if (s > 0) { box(m, 0.8, 0.06, 1.0, '#6f7377', -0.1, t / 2 + 0.02, -d / 2 + 2.3); box(m, 0.64, 0.07, 0.82, k.GLASS, -0.1, t / 2 + 0.03, -d / 2 + 2.3); } // velux on the north slope
    }
    box(r, 0.34, 0.24, len, '#a9482a', 0, rh + 0.14, 0).rotation.z = Math.PI / 4; // ridge tiles
  }
  // street facade (faces -z): open window left, white-shuttered window right, gable window, basement window
  const F = -d / 2 - 0.02;
  win(g, X1 - 0.29 * w - cx, 2.8, F, Math.PI, 1.1, 1.7);
  win(g, X1 - 0.72 * w - cx, 2.8, F, Math.PI, 1.0, 1.6, true);
  win(g, 0, 5.75, F, Math.PI, 1.0, 1.55);
  win(g, X1 - 0.29 * w - cx, 0.75, F - 0.05, Math.PI, 0.8, 0.5);
  // back facade (+z, garden): windows, gable window, French door onto three steps
  const B = d / 2 + 0.02;
  win(g, -1.8, 2.8, B, 0, 1.1, 1.6);
  win(g, 0, 5.75, B, 0, 1.0, 1.55);
  win(g, 1.6, 2.35, B, 0, 1.2, 2.3);
  for (let i = 0; i < 3; i++) box(g, 1.8, 0.4 * (i + 1), 0.35, '#c9c3b7', 1.6, 0.2 * (i + 1), B + 1.05 - i * 0.35);
  // north side (+x), seen from the game camera: windows behind the entry wing
  win(g, half + 0.02, 2.8, 1.6, Math.PI / 2, 1.0, 1.5);
  win(g, half + 0.07, 0.75, 1.6, Math.PI / 2, 0.7, 0.45);
  win(g, half + 0.02, 2.8, -0.9 + 0.3, Math.PI / 2, 0.6, 0.8);

  // ── entry wing on the north side: door at raised-floor level, reached by steps from the street
  {
    const x0 = X1, x1 = -31.35, ew = x1 - x0, ez0 = zf + 0.9, ed = 3.4, eh = 3.6, ex = (x0 + x1) / 2, ez = ez0 + ed / 2;
    box(S, ew, eh, ed, CREAM, ex, eh / 2, ez);
    prism(grp(S, x0, eh, ez0), [[0, 0], [ew + 0.3, 0], [ew + 0.3, 0.08], [0, 0.7]], ed, CREAM, 0);
    const rf = ubox(S, ew + 0.55, 0.14, ed + 0.5, tiles, ex + 0.15, eh + 0.42, ez); rf.rotation.z = -Math.atan2(0.7, ew + 0.3);
    box(S, ew + 0.1, 0.5, 0.4, '#d8d2c4', ex, eh - 0.25, ez0 - 0.1); // eaves return
    const dg = grp(S, ex - 0.1, 1.2, ez0 - 0.02, Math.PI);
    box(dg, 1.1, 2.25, 0.05, TRIM, 0, 1.1, 0);
    box(dg, 0.9, 2.1, 0.07, '#efeadf', 0, 1.05, 0.01);
    box(dg, 0.5, 0.7, 0.08, k.GLASS, 0, 1.55, 0.02);
    win(S, x1 + 0.02, 2.4, ez + 0.6, Math.PI / 2, 0.6, 0.9);
    // steps up to the door, landing, black handrail
    const sx = ex - 0.1;
    box(S, 1.1, 1.2, 1.0, '#c9c3b7', sx, 0.6, ez0 - 0.5);
    for (let i = 0; i < 6; i++) box(S, 1.1, 0.2 * (i + 1), 0.3, '#cfc9bd', sx, 0.1 * (i + 1), ez0 - 1.0 - (6 - i) * 0.3 + 0.15);
    const hr = box(S, 0.05, 0.05, 2.3, '#1f2123', sx + 0.55, 1.55, ez0 - 1.85); hr.rotation.x = -Math.atan2(1.2, 1.8);
    for (const z of [ez0 - 2.7, ez0 - 1.0]) box(S, 0.04, 0.95, 0.04, '#1f2123', sx + 0.55, (z > ez0 - 2 ? 1.2 : 0.2) + 0.47, z);
    // stepping-stone path from the (street) wall to the steps
    for (let z = 8.1; z < ez0 - 2.9; z += 0.75) box(S, 0.9, 0.05, 0.55, '#c8c1b3', sx, 0.025, z);
  }

  // ── south annex (-x): mono-pitch pale roof sloping away from the house, tiled rakes, white roller shutter
  {
    const x1 = X0, x0 = -42.85, aw = x1 - x0, az0 = zf + 0.4, ad = d - 0.6, lo = 2.5, hi = 3.9, ax = (x0 + x1) / 2, az = az0 + ad / 2;
    box(S, aw, lo, ad, CREAM, ax, lo / 2, az);
    prism(grp(S, x0, lo, az0), [[0, 0], [aw, 0], [aw, hi - lo]], ad, CREAM, 0);
    const c = Math.atan2(hi - lo, aw), rl = Math.hypot(aw, hi - lo) + 0.3;
    const rf = ubox(S, rl, 0.12, ad + 0.4, '#cbc7bf', ax - 0.1, (lo + hi) / 2 + 0.1, az); rf.rotation.z = c;
    for (const q of [-1, 1]) ubox(rf, rl, 0.12, 0.28, tiles, 0, 0.1, q * (ad / 2 + 0.06));
    box(S, 0.14, 0.14, ad + 0.4, '#d9d5cc', x0 - 0.1, lo - 0.02, az);
    win(S, ax + 0.25, 1.15, az0 - 0.02, Math.PI, 1.8, 2.0, true);
    win(S, x0 + 0.35, 0.9, az0 - 0.02, Math.PI, 0.35, 0.4);
    win(S, ax, 1.6, az0 + ad + 0.02, 0, 0.9, 1.1);
    box(S, aw, 0.05, 1.6, '#c9c2b4', ax, 0.025, az0 - 0.8); // paving in front
  }

  // ── Japanese maple (Acer palmatum 'Bloodgood') in front of the annex: slender trunks, layered deep-red crown
  {
    const mx = -40.2, mz = 10.6, reds = ['#8a1d2b', '#9e2433', '#741826', '#b02c3a'];
    for (const [dx, dz, lean, tw] of [[0, 0, 0.1, 0], [0.12, 0.1, -0.3, 0.25], [-0.1, 0.12, 0.3, -0.3]]) { // trunks splay upwards from one base
      const t = mesh(S, k.TRUNK, '#4d3b34', mx + dx - Math.sin(lean) * 1.6, 1.6, mz + dz + Math.sin(tw) * 1.6); t.scale.set(0.4, 3.2, 0.4); t.rotation.set(tw, 0, lean);
    }
    // wide airy tiers of small flat leaf clusters, open between the tiers (the photo shows sky through the crown)
    for (const [y, r, n] of [[1.9, 1.7, 7], [2.7, 2.0, 9], [3.5, 1.8, 8], [4.3, 1.4, 6], [5.0, 0.8, 3]])
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283 + k.sr(0, 0.6), q = r * k.sr(0.35, 1);
        k.blob(S, mx + Math.cos(a) * q, y + k.sr(-0.15, 0.15), mz + Math.sin(a) * q * 0.8, k.sr(0.45, 0.7), k.sp(reds), 0.4);
        if (q > 0.9) box(S, 0.05, 0.05, q, '#4d3b34', mx + Math.cos(a) * q / 2, y - 0.25, mz + Math.sin(a) * q * 0.4).rotation.y = -a + Math.PI / 2;
      }
  }
  // ── front garden: beds along the wall (yellow and pink flowers), a cordyline, a big green shrub on the north side
  {
    const bed = (x0, x1, fl) => {
      box(S, x1 - x0, 0.06, 1.0, '#5a4535', (x0 + x1) / 2, 0.03, 8.35);
      for (let x = x0 + 0.4; x < x1; x += k.sr(0.7, 1.1)) k.shrub(S, x, k.sr(8.2, 8.6), k.sr(0.35, 0.55), false);
      if (fl) for (let i = 0; i < 26; i++) k.inst(k.FLOWER, M(fl), k.sr(x0 + 0.2, x1 - 0.2), k.sr(0.45, 0.8), k.sr(8.0, 8.8));
    };
    bed(-42.7, -39.4, '#f2c230');
    bed(-39.2, -36.6, null);
    bed(-36.4, -33.2, '#d6456b');
    k.blob(S, -37.4, 0.6, 9.2, 0.7, '#3f6b30', 0.9);
    for (let i = 0; i < 4; i++) k.blob(S, -33.6 + k.sr(-0.4, 0.4), k.sr(1.2, 3.2), 9.4 + k.sr(-0.4, 0.4), k.sr(0.9, 1.2), k.sp(k.GREENS));
    const cy = grp(S, -35.4, 0, 10.0); // cordyline
    mesh(cy, k.TRUNK, '#6b5a45', 0, 0.5, 0).scale.set(0.5, 1, 0.5);
    for (let i = 0; i < 22; i++) { const p = grp(cy, 0, 1.0, 0, i * 2.4); p.rotation.order = 'YXZ'; p.rotation.x = k.sr(0.2, 1.2); box(p, 0.12, 1.2, 0.02, k.sp(['#5c7a3a', '#6f8f45', '#4d6a32']), 0, 0.6, 0); }
  }
  // ── back garden: paved terrace with table and chairs behind the annex, a large tree at the back
  {
    const tz = zf + d + 1.6;
    box(S, 5.8, 0.06, 3.0, '#bdb6aa', -40.0, 0.03, tz);
    box(S, 1.4, 0.06, 0.9, '#8d9094', -40.2, 0.75, tz);
    for (const [dx, dz] of [[-0.6, 0], [0.6, 0], [0, -0.8], [0, 0.8]]) box(S, 0.1, 0.72, 0.1, '#8d9094', -40.2 + dx * 0.9, 0.36, tz + dz * 0.45);
    for (const [dx, dz] of [[-1.1, 0], [1.1, 0], [-0.3, 0.8], [0.3, -0.8]]) { box(S, 0.45, 0.06, 0.45, '#5f6468', -40.2 + dx, 0.45, tz + dz); box(S, 0.45, 0.5, 0.05, '#5f6468', -40.2 + dx, 0.7, tz + dz + (dz >= 0 ? 0.2 : -0.2)); }
    k.tree(S, -34.3, zf + d + 5.5, 7.5);
  }
  return H;
}
