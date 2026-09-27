// Erika (the player) — reference photos: maison.png, aguesseau_haut.png
// Lot data (front boundary style, house-number plate, letterbox colour, options for the generic k.house builder).
// style: a key of STYLES in game.js, or a style object { wall, cap, pil, bar?, slat?, hedge?, wave?, gate, ph?, ball? }.
export const hero = { style: 'green', mail: '#2d5a43', house: { dx: -1, wall: '#efe1c3', shut: null, gshut: '#6b3f2a', along: false, porch: true, doorX: -31, velux: true, h: 3.4, w: 8, d: 9, garage: true } };

// Draws everything in the lot behind the front wall and returns the facade height. The kit is KIT in game.js.
export default function build(k, l) {
  const h = k.house(k.S, l.cx + (l.house.dx ?? 0), l.s, l.zf, { doorX: l.gate, ...l.house });
  k.garden(l);
  return h;
}
