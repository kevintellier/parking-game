// Bugnot, on the corner of Rue du Centre — reference photo: maison_bugnot.png, aguesseau_haut.png
// Cream two-storey house facing Rue du Centre behind a tall hedge: brown hip roof with a dormer, brick chimney with a TV
// aerial, balcony with flower boxes on the first floor, a lower flat-roofed white wing at the back. Its white garage stands
// right on the Rue d'Aguesseau sidewalk, against Dédé's lot. The street is squeezed here (Dédé's gate at -46.5, the
// first bays), so the lot is only 3.3 m wide on Rue d'Aguesseau: the house turns its facade to Rue du Centre.
export const hero = { style: { wall: '#f1eee6', cap: '#dcd8cf', pil: '#f1eee6', gate: '#e9e6de' }, noWall: true };

const CREAM = '#efe4cf', WHITE = '#f3f1ea', TILE = '#8f5a43', RAIL = '#2d2f33';

export default function build(k, l) {
  const { S, box, THREE } = k;
  const x0 = -51.3, x1 = l.x1 - 0.15, cx = (x0 + x1) / 2, w = x1 - x0; // house and wing span the lot behind the Rue du Centre hedge
  const W = (x, y, z, r, s) => k.win(S, x, y, z, r, null, s);

  // ── garage on the sidewalk: white, flat roof with a coping, sectional door facing Rue d'Aguesseau (street sign above it)
  const gx0 = -51.85, gz0 = -7.36, gz1 = -12.0, gh = 3.0, gc = (gx0 + x1) / 2;
  box(S, x1 - gx0, gh, gz0 - gz1, WHITE, gc, gh / 2, (gz0 + gz1) / 2);
  box(S, x1 - gx0 + 0.12, 0.12, gz0 - gz1 + 0.12, '#d6d3cb', gc, gh + 0.06, (gz0 + gz1) / 2);
  box(S, 2.4, 2.1, 0.06, '#eceae4', gc, 1.05, gz0 + 0.02);
  for (let i = 1; i < 5; i++) box(S, 2.4, 0.03, 0.08, '#c9c6bf', gc, i * 0.42, gz0 + 0.03);

  // ── house: two storeys, hip roof with its ridge along Rue du Centre (z)
  const z0 = gz1, z1 = -20.5, H = 5.6, D = z0 - z1, cz = (z0 + z1) / 2;
  box(S, w, H, D, CREAM, cx, H / 2, cz);
  box(S, w + 0.08, 0.4, D + 0.08, '#c8bfae', cx, 0.2, cz);
  box(S, w + 0.08, 0.12, D + 0.08, '#f6f3ec', cx, H - 0.06, cz);
  const ov = 0.4, rh = 1.7, a = w / 2 + ov, b = D / 2 + ov, y = H - 0.05, V = (p, q, r) => new THREE.Vector3(p, q, r);
  const R0 = V(cx, y + rh, cz + b - a), R1 = V(cx, y + rh, cz - b + a), E = (sx, sz) => V(cx + sx * a, y, cz + sz * b);
  const pos = [];
  for (const [p, q, r] of [[E(-1, 1), E(1, 1), R0], [E(1, 1), E(1, -1), R1], [E(1, 1), R1, R0], [E(1, -1), E(-1, -1), R1], [E(-1, -1), E(-1, 1), R0], [E(-1, -1), R0, R1]])
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  k.mesh(S, geo, k.M(TILE, { roughness: 0.8, side: THREE.DoubleSide }));
  box(S, 0.16, 0.14, R0.z - R1.z, '#6e3f2d', cx, y + rh + 0.05, cz); // ridge
  // dormer on the Rue du Centre slope, two windows
  box(S, 0.9, 1.0, 3.0, CREAM, x0 + 0.2, H + 0.5, cz - 0.6);
  box(S, 1.2, 0.1, 3.3, TILE, x0 + 0.3, H + 1.05, cz - 0.6);
  for (const dz of [-1.3, 0.1]) W(x0 - 0.27, H + 0.5, cz + dz, -Math.PI / 2, 0.7);
  // brick chimney with a TV aerial, at the Rue d'Aguesseau end
  const chz = z0 - 2.2, ct = y + rh + 1.0;
  box(S, 0.55, ct - H, 0.75, '#9c4f36', cx + 0.3, (H + ct) / 2, chz);
  box(S, 0.7, 0.1, 0.9, '#6f6c68', cx + 0.3, ct + 0.05, chz);
  box(S, 0.04, 1.5, 0.04, '#55585c', cx + 0.3, ct + 0.8, chz + 0.5);
  for (let i = -2; i <= 2; i++) box(S, 0.05, 0.02, 0.6 - Math.abs(i) * 0.09, '#55585c', cx + 0.3 + i * 0.25, ct + 1.4, chz + 0.5);

  // Rue du Centre facade: three bays on each floor, first-floor balcony with a black railing and red flower boxes
  for (const z of [z0 - 1.6, cz, z1 + 1.6]) { W(x0 - 0.03, 1.5, z, -Math.PI / 2); W(x0 - 0.03, 4.1, z, -Math.PI / 2); }
  box(S, 0.6, 0.14, 4.6, '#e9e5dc', x0 - 0.3, 3.0, z0 - 3.0);
  box(S, 0.05, 0.05, 4.6, RAIL, x0 - 0.56, 3.95, z0 - 3.0);
  for (let z = z0 - 5.25; z < z0 - 0.7; z += 0.14) box(S, 0.03, 0.85, 0.03, RAIL, x0 - 0.56, 3.5, z);
  for (let z = z0 - 5.0; z < z0 - 1.0; z += 0.6) {
    box(S, 0.2, 0.18, 0.5, '#7b4a2f', x0 - 0.66, 3.75, z);
    for (let i = 0; i < 4; i++) k.inst(k.FLOWER, k.M('#d4343b'), x0 - 0.66, k.sr(3.9, 4.0), z + k.sr(-0.22, 0.22));
  }
  // Rue d'Aguesseau end, above the garage: one window under the hip
  W(cx, 4.1, z0 + 0.03, 0, 0.8);

  // ── lower white wing at the back, flat roof
  const wz1 = -24.3, wh = 3.0;
  box(S, w, wh, z1 - wz1, WHITE, cx, wh / 2, (z1 + wz1) / 2);
  box(S, w + 0.12, 0.12, z1 - wz1 + 0.12, '#d6d3cb', cx, wh + 0.06, (z1 + wz1) / 2);
  W(x0 - 0.03, 1.5, (z1 + wz1) / 2, -Math.PI / 2);

  // ── tall hedge along Rue du Centre in front of the house, a tree at the bottom of the garden
  k.zhedge(-51.68, z0 - 0.2, wz1 - 0.2, 2.1, k.HEDGES.privet, 0.6);
  k.tree(S, -50.2, -27.4, 5.2);
  return H;
}
