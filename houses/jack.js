// Jack, behind his tall laurel hedge — reference photos: Aguesseau_1-3.png, aguesseau_haut.png
// Lot data (front boundary style, house-number plate, letterbox colour, options for the generic k.house builder).
// style: a key of STYLES in game.js, or a style object { wall, cap, pil, bar?, slat?, hedge?, wave?, gate, ph?, ball? }.
export const hero = { style: 'laurel', house: { dx: -2.5, wall: '#f6f4ef', shut: '#b3babf', along: false, h: 5.8, w: 8, d: 9.5, roof: '#a7a9ab', garage: false } };

// Draws everything in the lot behind the front wall and returns the facade height. The kit is KIT in game.js.
export default function build(k, l) {
  const h = k.house(k.S, l.cx + (l.house.dx ?? 0), l.s, l.zf, { doorX: l.gate, ...l.house });
  k.garden(l);
  return h;
}
