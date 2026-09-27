// Valérie, the red-haired neighbour, and her husband « le père » — reference photos: valerie.png
// Lot data (front boundary style, house-number plate, letterbox colour, options for the generic k.house builder).
// style: a key of STYLES in game.js, or a style object { wall, cap, pil, bar?, slat?, hedge?, wave?, gate, ph?, ball? }.
export const hero = { style: 'pink', num: '92', mail: '#a9cfc0', poppies: true, house: { dx: 2, wall: '#e6a08a', shut: null, along: false, oeil: true, porch: true, h: 3.6, w: 7, d: 8 } };

// Draws everything in the lot behind the front wall and returns the facade height. The kit is KIT in game.js.
export default function build(k, l) {
  const h = k.house(k.S, l.cx + (l.house.dx ?? 0), l.s, l.zf, { doorX: l.gate, ...l.house });
  k.garden(l);
  return h;
}
