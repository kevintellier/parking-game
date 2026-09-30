// corner house on Rue du Centre — reference photos: Aguesseau_1-3.png, aguesseau_haut.png
// A single-storey cream house set back behind its lawn: hipped orange-tile roof whose ridge runs along z (parallel to
// Rue du Centre), a lower lean-to roof along the Rue d'Aguesseau facade, a flat-roofed white garage at the back on the
// Rue du Centre side, a Japanese maple and a big tree in the front garden, a tall tree behind on Marion's side.
export const hero = { style: { wall: '#eeebe4', cap: '#c3c0b9', pil: '#ebe7df', bar: '#2f3337', gate: '#2f3337' }, mail: '#3a3d40', wicket: -49.2 }; // wicket in line with the door

const WC = '#efe5d0', CAP = '#8b3b27', FASCIA = '#ddd5c6';

export default function build(k, l) {
  const { THREE, S, box, mesh } = k, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const roof = k.tmat(k.tileTex, '#fff2ea', { roughness: 0.75, side: THREE.DoubleSide });

  // convex tiled roof plane(s); e = unit vector along the eave, so tile courses run parallel to it
  const planes = [];
  const plane = (pts, e) => planes.push([pts, e]);
  const flushRoof = () => {
    const pos = [], uv = [];
    for (const [pts, e] of planes) {
      const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0]));
      if (n.y < 0) pts.reverse();
      const sd = new THREE.Vector3().crossVectors(e, n).normalize();
      for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) { pos.push(p.x, p.y, p.z); uv.push(p.dot(sd) / 2, p.dot(e) / 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    mesh(S, g, roof);
  };
  const beam = (a, b, t, col) => { const m = mesh(S, new THREE.BoxGeometry(t, t * 0.7, a.distanceTo(b)), col, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.lookAt(b); };
  const prism = (shape, depth, col) => mesh(S, new THREE.ExtrudeGeometry(new THREE.Shape(shape.map(([x, y]) => k.V2(x, y))), { depth, bevelEnabled: false }), col);

  // ── main block: x -50.4..-44.2, z 13.1..21.4, hipped roof, ridge along z (parallel to Rue du Centre)
  // game.js already lines Rue du Centre with a low wall (x -52) and a privet hedge (x ≈ -51.4), so the house starts at x -50.4
  const zf = l.zf - 1.8, x0 = -50.4, x1 = -44.2, z0 = zf + 1.7, z1 = zf + 10, H = 3.4;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, a = (x1 - x0) / 2, b = (z1 - z0) / 2, rh = a * 0.8, ov = 0.45;
  box(S, x1 - x0, H, z1 - z0, WC, cx, H / 2, cz);
  box(S, x1 - x0 + 0.1, 0.4, z1 - z0 + 0.1, '#bcb4a6', cx, 0.2, cz);
  box(S, x1 - x0 + 0.08, 0.14, z1 - z0 + 0.08, '#f7f5ef', cx, H - 0.07, cz);
  const ye = H - ov * rh / a, R1 = V3(cx, H + rh, cz - b + a), R2 = V3(cx, H + rh, cz + b - a);
  const E = (sx, sz) => V3(cx + sx * (a + ov), ye, cz + sz * (b + ov));
  const X = V3(1, 0, 0), Z = V3(0, 0, 1);
  plane([E(1, -1), E(1, 1), R2, R1], Z);
  plane([E(-1, 1), E(-1, -1), R1, R2], Z);
  plane([E(1, 1), E(-1, 1), R2], X);
  plane([E(-1, -1), E(1, -1), R1], X);
  beam(R1, R2, 0.22, CAP);
  for (const [e, r] of [[E(1, -1), R1], [E(-1, -1), R1], [E(1, 1), R2], [E(-1, 1), R2]]) beam(V3(e.x, e.y + 0.03, e.z), V3(r.x, r.y + 0.03, r.z), 0.16, CAP);
  for (const s of [-1, 1]) {
    box(S, 0.05, 0.16, 2 * (b + ov), FASCIA, cx + s * (a + ov), ye - 0.06, cz);
    box(S, 2 * (a + ov), 0.16, 0.05, FASCIA, cx, ye - 0.06, cz + s * (b + ov));
  }
  { // velux on the north (+x) slope, near the back
    const t = 1.5, g = new THREE.Group(); g.position.set(cx + t, H + rh - t * rh / a + 0.04, z1 - 2.2); g.rotation.z = -Math.atan2(rh, a); S.add(g);
    box(g, 0.8, 0.06, 1.0, '#e6e4de'); box(g, 0.64, 0.07, 0.84, k.GLASS);
  }
  { // rendered chimney at the Rue d'Aguesseau end of the ridge, with a TV aerial
    const chx = cx - 0.35, chz = R1.z + 0.5, top = H + rh + 0.9;
    box(S, 0.6, 1.6, 0.6, WC, chx, top - 0.8, chz);
    box(S, 0.74, 0.1, 0.74, '#8d8a85', chx, top + 0.05, chz);
    box(S, 0.04, 1.7, 0.04, '#55585c', chx + 0.35, top + 0.5, chz);
    box(S, 0.03, 0.03, 1.3, '#55585c', chx + 0.35, top + 1.2, chz);
    for (let i = -2; i <= 2; i++) box(S, 0.55 - Math.abs(i) * 0.08, 0.02, 0.02, '#55585c', chx + 0.35, top + 1.2, chz + i * 0.28);
  }

  // ── lean-to along the street facade (z zf..z0), wall 2.65 at the front, 3.0 against the main block
  const lf = 2.65, lb = 3.0, lov = 0.45, lsl = (lb - lf) / (z0 - zf);
  const lt = prism([[-zf, 0], [-z0, 0], [-z0, lb], [-zf, lf]], x1 - x0, WC); lt.rotation.y = Math.PI / 2; lt.position.x = x0;
  box(S, x1 - x0 + 0.1, 0.4, z0 - zf + 0.1, '#bcb4a6', cx, 0.2, (zf + z0) / 2);
  const ly = z => lf + (z - zf) * lsl + 0.03, rx0 = x0 - lov, rx1 = x1 + lov;
  plane([V3(rx0, ly(zf - lov), zf - lov), V3(rx1, ly(zf - lov), zf - lov), V3(rx1, ly(z0), z0), V3(rx0, ly(z0), z0)], X);
  box(S, rx1 - rx0, 0.14, 0.05, FASCIA, cx, ly(zf - lov) - 0.06, zf - lov);
  for (const x of [rx0, rx1]) box(S, 0.05, 0.14, z0 - zf + lov, FASCIA, x, ly(zf) - 0.06, zf + (z0 - zf - lov) / 2);
  flushRoof();

  // ── openings: white PVC windows with roller shutters, like the rest of the street
  const W = (x, y, z, r, s = 1) => k.win(S, x, y, z, r, null, s);
  k.door(S, -49.2, zf - 0.03, Math.PI, '#f4f2ec', false);
  for (const x of [-47.2, -45.3]) W(x, 1.35, zf - 0.03, Math.PI);
  W(x1 + 0.03, 1.35, zf + 0.85, Math.PI / 2, 0.8);
  for (const z of [z0 + 1.4, cz, z1 - 1.4]) W(x1 + 0.03, 1.6, z, Math.PI / 2);
  for (const x of [x0 + 1.4, x1 - 1.4]) W(x, 1.6, z1 + 0.03, 0);
  k.door(S, cx, z1 + 0.03, 0, '#f4f2ec', false);
  for (const z of [z0 + 1.6, z1 - 1.6]) W(x0 - 0.03, 1.6, z, -Math.PI / 2);

  // ── flat-roofed white garage at the back, on the Rue du Centre side, with its concrete apron
  const gx0 = -50.8, gx1 = -48.2, gz0 = z1 + 0.6, gz1 = gz0 + 4.2, gc = (gz0 + gz1) / 2;
  box(S, gx1 - gx0, 2.6, gz1 - gz0, '#f3f0e9', (gx0 + gx1) / 2, 1.3, gc);
  box(S, gx1 - gx0 + 0.2, 0.18, gz1 - gz0 + 0.2, '#d9d6cf', (gx0 + gx1) / 2, 2.69, gc);
  box(S, 2.1, 2.1, 0.08, '#e9e6de', (gx0 + gx1) / 2, 1.05, gz1 + 0.02);
  for (let i = 1; i < 5; i++) box(S, 2.1, 0.03, 0.1, '#cfccc4', (gx0 + gx1) / 2, i * 0.42, gz1 + 0.03);
  k.tbox(S, gx1 - gx0, 0.04, 1.6, k.WALK, (gx0 + gx1) / 2, 0.02, gz1 + 0.8);

  k.tbox(S, 1.1, 0.03, zf - k.WALL_Z - 0.3, k.WALK, l.wicket, 0.02, (zf + k.WALL_Z + 0.3) / 2); // path from the wicket to the door
  // ── gardens: lawn, a Japanese maple by Marion's side, a big tree near the corner, shrubs, a big tree out back
  k.tree(S, -44.8, 9.6, 3.4, 'red');
  k.tree(S, -50.3, 9.8, 4.6, 'green');
  k.tree(S, -44.6, z1 + 3, 6, 'green'); // big tree behind the house, on Marion's side (aerial view)
  for (const [x, z, r] of [[-47.5, 8.4, 0.6], [-46.2, 8.5, 0.5], [-48.2, 10.6, 0.4]]) k.shrub(S, x, z, r);
  return H;
}
