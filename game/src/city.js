// Solace Vice — Port Solace itself: the road grid, the city blocks and their
// buildings, the beach and the bay, landmarks with names, and every spatial
// question the rest of the game asks (is this a road? what do I collide with?
// which lane does traffic use?). The city is generated once from a fixed seed.
import { BEACH_X, ROAD_W, ROAD_XS, ROAD_YS, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { makeRng, pick, randInt, randRange, rectsOverlap } from './random.js';

const ROOF_COLORS = ['#e2725b', '#f2e3c6', '#7fc8bc', '#e8a2b4', '#f4c95d', '#9db8e8', '#d97b4f', '#b5d99c', '#efe6da', '#88b0a0'];
const SHOP_NAMES = [
  'Café Lucia', 'Solace Motors', 'Neon Pawn', 'Marina Bait & Tackle', 'Hotel Coralina',
  'Palm Pharmacy', 'Banco del Sol', 'Taco Brisa', 'Vice Vinyl', 'Solace Surf Co.',
  'La Ola Bakery', 'Portside Gym', 'Marea Jewels', 'Copacabana Club', 'Sunset Liquor',
  'Barbería Rey', 'Solace Arcade', 'The Salty Anchor', 'Flamingo Suites', 'Pez Gordo Diner',
];
const SIDEWALK = 20;

function roadSpanAt(pos, spans) {
  for (const start of spans) {
    if (pos >= start && pos < start + ROAD_W) return start;
  }
  return -1;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const parkingSpots = [];
  const lots = [];
  const landmarks = {};

  // Blocks are the rectangles between roads; each gets buildings, a park, a
  // plaza or a parking lot, with named landmarks pinned to fixed blocks.
  const specialBlocks = new Map();
  specialBlocks.set('1,1', 'park');
  specialBlocks.set('3,2', 'plaza');
  specialBlocks.set('2,3', 'parking');
  specialBlocks.set('4,1', 'parking');
  specialBlocks.set('0,3', 'parking');

  let shopIndex = 0;
  for (let bx = 0; bx < ROAD_XS.length; bx += 1) {
    for (let by = 0; by < ROAD_YS.length; by += 1) {
      const x0 = ROAD_XS[bx] + ROAD_W;
      const y0 = ROAD_YS[by] + ROAD_W;
      const x1 = bx + 1 < ROAD_XS.length ? ROAD_XS[bx + 1] : BEACH_X;
      const y1 = by + 1 < ROAD_YS.length ? ROAD_YS[by + 1] : WORLD_H;
      if (x1 - x0 < 200 || y1 - y0 < 200) continue;
      const kind = specialBlocks.get(`${bx},${by}`) ?? 'buildings';
      const inner = { x: x0 + SIDEWALK, y: y0 + SIDEWALK, w: x1 - x0 - SIDEWALK * 2, h: y1 - y0 - SIDEWALK * 2 };
      if (kind === 'park' || kind === 'plaza') {
        for (let i = 0; i < 14; i += 1) {
          palms.push({ x: randRange(rng, inner.x + 16, inner.x + inner.w - 16), y: randRange(rng, inner.y + 16, inner.y + inner.h - 16) });
        }
        if (kind === 'park') landmarks.park = { x: inner.x + inner.w / 2, y: inner.y + inner.h / 2, name: 'Palmetto Park' };
        continue;
      }
      if (kind === 'parking') {
        lots.push({ x: inner.x - 6, y: inner.y - 6, w: inner.w + 12, h: inner.h + 12 });
        for (let row = 0; row < 3; row += 1) {
          for (let col = 0; col < 4; col += 1) {
            parkingSpots.push({ x: inner.x + 44 + col * 92, y: inner.y + 52 + row * 108, angle: Math.PI / 2 });
          }
        }
        continue;
      }
      // Ordinary block: 2x2 buildings with an alley cross between them.
      const gap = 26;
      const bw = (inner.w - gap) / 2;
      const bh = (inner.h - gap) / 2;
      for (let cx = 0; cx < 2; cx += 1) {
        for (let cy = 0; cy < 2; cy += 1) {
          const building = {
            x: inner.x + cx * (bw + gap),
            y: inner.y + cy * (bh + gap),
            w: bw - randRange(rng, 0, 26),
            h: bh - randRange(rng, 0, 26),
            color: pick(rng, ROOF_COLORS),
            name: '',
          };
          if (rng() < 0.42 && shopIndex < SHOP_NAMES.length) {
            building.name = SHOP_NAMES[shopIndex];
            shopIndex += 1;
          }
          buildings.push(building);
        }
      }
      // Palms along the block's south sidewalk.
      for (let px = inner.x + 20; px < inner.x + inner.w - 10; px += 74) {
        if (rng() < 0.7) palms.push({ x: px + randRange(rng, -6, 6), y: y1 - 12 });
      }
    }
  }

  // Street lamps at intersections.
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) lamps.push({ x: rx + 10, y: ry + 10 }, { x: rx + ROAD_W - 10, y: ry + ROAD_W - 10 });
  }
  // Beach palms and the pier-side parking by the docks.
  for (let y = 120; y < WORLD_H - 80; y += 130) {
    if (rng() < 0.75) palms.push({ x: BEACH_X + randRange(rng, 26, 130), y });
  }
  for (let i = 0; i < 5; i += 1) parkingSpots.push({ x: 3300, y: 400 + i * 104, angle: 0 });
  lots.push({ x: 3260, y: 340, w: 130, h: 560 });

  // Named landmarks the story uses, each a point in front of its building.
  landmarks.cafe = { x: 700, y: 1090, name: 'Café Lucia' };
  landmarks.hideout = { x: 330, y: 2260, name: 'Reyes Hideout' };
  // The docks and the dealership sit on open ground (sand strip / the coast
  // road), never inside a building footprint: missions spawn cars there.
  landmarks.docks = { x: 3400, y: 2560, name: 'Port Solace Docks' };
  landmarks.dealership = { x: 1600, y: 64, name: 'Solace Motors' };
  landmarks.beach = { x: 3560, y: 1500, name: 'Playa Brisa' };
  landmarks.hospital = { x: 700, y: 1660, name: 'St. Solace General' };
  landmarks.policeStation = { x: 1980, y: 1090, name: 'Port Solace PD' };
  landmarks.gunShop = { x: 2620, y: 1660, name: 'Brisa Arms' };
  landmarks.neonMile = { x: 2240, y: 1216, name: 'The Neon Mile' };

  function isRoad(x, y) {
    return roadSpanAt(x, ROAD_XS) >= 0 || roadSpanAt(y, ROAD_YS) >= 0;
  }

  /** 'v' on a vertical road, 'h' on a horizontal one, null off-road. */
  function roadAxis(x, y) {
    if (roadSpanAt(x, ROAD_XS) >= 0) return 'v';
    if (roadSpanAt(y, ROAD_YS) >= 0) return 'h';
    return null;
  }

  /** The centre line of the correct (right-hand) lane for a heading on a road. */
  function laneCenter(x, y, heading) {
    const vx = roadSpanAt(x, ROAD_XS);
    const hy = roadSpanAt(y, ROAD_YS);
    if (vx >= 0 && (Math.abs(Math.sin(heading)) > Math.abs(Math.cos(heading)) || hy < 0)) {
      return { axis: 'v', fixed: vx + (Math.sin(heading) > 0 ? ROAD_W * 0.72 : ROAD_W * 0.28) };
    }
    if (hy >= 0) return { axis: 'h', fixed: hy + (Math.cos(heading) > 0 ? ROAD_W * 0.72 : ROAD_W * 0.28) };
    return null;
  }

  function buildingAt(x, y, pad) {
    for (const b of buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  }

  /**
   * Push a circle (centre + radius) out of every building and back inside the
   * world; the bay water is solid to everyone. Returns the corrected centre.
   */
  function collideCircle(x, y, radius) {
    let nx = Math.min(Math.max(x, radius), WATER_X - radius);
    let ny = Math.min(Math.max(y, radius), WORLD_H - radius);
    for (const b of buildings) {
      const rect = { x: b.x, y: b.y, w: b.w, h: b.h };
      const probe = { x: nx - radius, y: ny - radius, w: radius * 2, h: radius * 2 };
      if (!rectsOverlap(probe, rect)) continue;
      const left = nx + radius - b.x;
      const right = b.x + b.w - (nx - radius);
      const top = ny + radius - b.y;
      const bottom = b.y + b.h - (ny - radius);
      const min = Math.min(left, right, top, bottom);
      if (min === left) nx = b.x - radius;
      else if (min === right) nx = b.x + b.w + radius;
      else if (min === top) ny = b.y - radius;
      else ny = b.y + b.h + radius;
    }
    return { x: nx, y: ny };
  }

  return {
    buildings, palms, lamps, parkingSpots, lots, landmarks,
    isRoad, roadAxis, laneCenter, buildingAt, collideCircle,
    rng,
  };
}
