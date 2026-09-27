// Marion (88) — reference photos: marion.png
// Lot data (front boundary style, house-number plate, letterbox colour, options for the generic k.house builder).
// style: a key of STYLES in game.js, or a style object { wall, cap, pil, bar?, slat?, hedge?, wave?, gate, ph?, ball? }.
export const hero = { style: 'black', maple: true, house: { wall: '#ece4d2', shut: null, along: false, h: 5.4, w: 8, d: 9 } };

// Draws everything in the lot behind the front wall and returns the facade height. The kit is KIT in game.js.
export default function build(k, l) {
  const h = k.house(k.S, l.cx + (l.house.dx ?? 0), l.s, l.zf, { doorX: l.gate, ...l.house });
  k.garden(l);
  return h;
}
