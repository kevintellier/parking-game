// Character & vehicle meshes, no gameplay. Conventions: metres, y up, feet/wheels at y=0, model faces +x.
// Builders return fresh objects and do NOT add them to the scene.
import * as THREE from 'three';

const mats = {};
const M = (color, o = {}) => mats[color + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
function add(parent, geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, color.isMaterial ? color : M(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Person contract: { g, legs: [hipL, hipR], arms: [shoulderL, shoulderR] }.
// legs/arms are pivot Groups at hip/shoulder; the game swings them with rotation.z (walk cycle).
function person({ shirt, pants, skin = '#f0c39b', hair }) {
  const g = new THREE.Group(), legs = [], arms = [];
  for (const z of [-0.11, 0.11]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.62, z); g.add(hip); legs.push(hip);
    add(hip, new THREE.BoxGeometry(0.16, 0.62, 0.16), pants, 0, -0.31, 0);
  }
  add(g, new THREE.CapsuleGeometry(0.22, 0.38, 4, 10), shirt, 0, 0.98, 0);
  for (const z of [-0.29, 0.29]) {
    const sh = new THREE.Group(); sh.position.set(0, 1.2, z); g.add(sh); arms.push(sh);
    add(sh, new THREE.BoxGeometry(0.12, 0.5, 0.12), shirt, 0, -0.25, 0);
  }
  add(g, new THREE.SphereGeometry(0.19, 12, 10), skin, 0, 1.46, 0);
  add(g, new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 1.5, 0);
  g.scale.setScalar(1.3);
  return { g, legs, arms };
}

// Erika — the player (see erika.png). PLACEHOLDER: replaced by the models agent.
export const buildErika = () => person({ shirt: '#6b7a3e', pants: '#4a6a93', hair: '#c9c9c9' });
// Red-haired neighbour who wheels bins back onto the sidewalk. PLACEHOLDER.
export const buildRedhead = () => person({ shirt: '#7d5ba6', pants: '#2d3440', hair: '#c1440e' });
// Jack, the old neighbour who helps Erika. PLACEHOLDER.
export const buildJack = () => person({ shirt: '#b59b72', pants: '#5a5047', hair: '#eeeeee' });

// MAN tipper truck with crane (see camion.png). PLACEHOLDER.
// Contract: { g, body, len, w, exhaust } — body is the sprung part (game bobs body.position.y),
// len/w are the footprint in metres, exhaust is a local-space Vector3 at the smoke outlet.
export function buildTruck(env) {
  const g = new THREE.Group(), body = new THREE.Group(), len = 9.6, w = 2.5; g.add(body);
  add(body, new THREE.BoxGeometry(2.2, 2.6, w), M('#1f5a57', { roughness: 0.35, metalness: 0.4, envMap: env }), len / 2 - 1.1, 1.8, 0);
  add(body, new THREE.BoxGeometry(len - 2.4, 1.4, w), '#2a6b52', -1.2, 1.6, 0);
  for (const x of [len / 2 - 1.4, -len / 2 + 2.6, -len / 2 + 1.3]) for (const z of [-1, 1])
    add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14), '#1b1b1d', x, 0.5, z * (w / 2 - 0.15)).rotation.x = Math.PI / 2;
  return { g, body, len, w, exhaust: new THREE.Vector3(len / 2 - 2.3, 3.4, -w / 2 + 0.1) };
}
