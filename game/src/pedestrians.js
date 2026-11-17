// Solace Vice — the people of Port Solace. Pedestrians stroll the sidewalks
// between the roads and the buildings, chat in pairs, and run when crime or
// a fast car frightens them. They are witnesses too: crimes they see feed
// the wanted system through combat.js and missions.js.
import { PLAYER, WORLD_H, WORLD_W } from './config.js';
import { clamp, distance, pick, randRange, turnToward } from './random.js';

const SHIRTS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#5f27cd', '#c8d6e5', '#ff9ff3'];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

let nextPedId = 1;

export function createPed(rng, x, y) {
  return {
    id: nextPedId++,
    x, y,
    angle: randRange(rng, 0, Math.PI * 2),
    speed: 0,
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, SKIN),
    health: 60,
    alive: true,
    mode: 'walk',               // 'walk' | 'flee'
    fleeFrom: null,
    fleeTimer: 0,
    waypoint: null,
    waitTimer: randRange(rng, 0, 2),
    panic: 0,
  };
}

/** A random point on a sidewalk: just off a road's edge, where people walk. */
function sidewalkPoint(rng, near) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const roadX = [0, 640, 1280, 1920, 2560, 3200][Math.floor(rng() * 6)];
    const side = rng() < 0.5 ? -14 : 142;
    return {
      x: clamp(roadX + side + randRange(rng, -4, 4), 16, WORLD_W - 16),
      y: clamp(near.y + randRange(rng, -420, 420), 16, WORLD_H - 16),
    };
  }
  const roadY = [0, 576, 1152, 1728, 2304][Math.floor(rng() * 5)];
  const side = rng() < 0.5 ? -14 : 142;
  return {
    x: clamp(near.x + randRange(rng, -420, 420), 16, WORLD_W - 170),
    y: clamp(roadY + side + randRange(rng, -4, 4), 16, WORLD_H - 16),
  };
}

export function spawnCrowd(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const spot = sidewalkPoint(rng, { x: randRange(rng, 200, 3000), y: randRange(rng, 200, 2600) });
    const fixed = city.collideCircle(spot.x, spot.y, 10);
    peds.push(createPed(rng, fixed.x, fixed.y));
  }
  return peds;
}

/** Frighten everyone near a point: gunfire, a crash, a body. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    if (distance(ped.x, ped.y, x, y) < radius) {
      ped.mode = 'flee';
      ped.fleeFrom = { x, y };
      ped.fleeTimer = randRange(state.rng, 2, 3.6);
    }
  }
}

export function updatePed(ped, dt, state) {
  if (!ped.alive) return;
  const city = state.city;
  let targetSpeed = 62;
  if (ped.mode === 'flee' && ped.fleeFrom) {
    ped.fleeTimer -= dt;
    const away = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
    ped.angle = turnToward(ped.angle, away, 6 * dt);
    targetSpeed = PLAYER.runSpeed * 0.92;
    if (ped.fleeTimer <= 0) {
      ped.mode = 'walk';
      ped.waypoint = null;
    }
  } else {
    if (!ped.waypoint || distance(ped.x, ped.y, ped.waypoint.x, ped.waypoint.y) < 14) {
      if (ped.waitTimer > 0) {
        ped.waitTimer -= dt;
        targetSpeed = 0;
      } else {
        ped.waypoint = sidewalkPoint(state.rng, ped);
        ped.waitTimer = randRange(state.rng, 0, 5);
      }
    }
    if (ped.waypoint && targetSpeed > 0) {
      const toward = Math.atan2(ped.waypoint.y - ped.y, ped.waypoint.x - ped.x);
      ped.angle = turnToward(ped.angle, toward, 4 * dt);
    }
    // A car bearing down scares a walker even without a crime.
    const focus = state.player.car;
    if (focus && Math.abs(focus.speed) > 200 && distance(ped.x, ped.y, focus.x, focus.y) < 90) {
      ped.mode = 'flee';
      ped.fleeFrom = { x: focus.x, y: focus.y };
      ped.fleeTimer = 1.6;
    }
  }
  ped.speed += clamp(targetSpeed - ped.speed, -300 * dt, 300 * dt);
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  const fixed = city.collideCircle(ped.x, ped.y, 10);
  ped.x = fixed.x;
  ped.y = fixed.y;
}
