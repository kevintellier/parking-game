// Dédé (89) — reference photos: dede.png, Aguesseau_1-3.png
// Lot data (front boundary style, house-number plate, letterbox colour, options for the generic k.house builder).
// style: a key of STYLES in game.js, or a style object { wall, cap, pil, bar?, slat?, hedge?, wave?, gate, ph?, ball? }.
export const hero = { style: 'anth', num: '89', house: { wall: '#f4f3ef', shut: null, along: true, h: 5.9, w: 10, d: 9, roof: '#b49488', dormer: true, balcony: -2.5, gdoor: -2.5, doorX: -41, velux: false, garage: false } };

// Draws everything in the lot behind the front wall and returns the facade height. The kit is KIT in game.js.
export default function build(k, l) {
  const h = k.house(k.S, l.cx + (l.house.dx ?? 0), l.s, l.zf, { doorX: l.gate, ...l.house });
  k.garden(l);
  return h;
}
