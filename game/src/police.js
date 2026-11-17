// Solace Vice — the wanted system and the Port Solace PD. Crimes add heat;
// heat shows as stars. Police cars spawn on the roads around the player and
// hunt: they ram a fleeing car, and they box in a player on foot — stand
// next to a cruiser too long and the bust meter fills. Break line of sight
// long enough and the heat cools, star by star.
import { CAR, WANTED } from './config.js';
import { clamp, distance, randRange, turnToward } from './random.js';
import { createCar } from './vehicles.js';

/** Register a crime: `points` of heat, scaled by whether anyone saw it. */
export function addCrime(state, points, witnessed) {
  const w = state.wanted;
  w.heat = clamp(w.heat + points * (witnessed ? 1 : 0.45), 0, WANTED.maxStars);
  if (witnessed) w.unseen = 0;
}

export function wantedStars(state) {
  return state.wanted.heat <= 0.04 ? 0 : Math.min(WANTED.maxStars, Math.ceil(state.wanted.heat));
}

/** Was the crime at (x, y) seen by a cop or a pedestrian close enough to call it in? */
export function crimeWitnessed(state, x, y) {
  for (const car of state.cars) {
    if (car.kind === 'police' && distance(car.x, car.y, x, y) < WANTED.sightRange) return true;
  }
  for (const ped of state.peds) {
    if (ped.alive && distance(ped.x, ped.y, x, y) < 190) return true;
  }
  return false;
}

function spawnPoint(state) {
  // A road point roughly off-screen from the player, so cruisers arrive
  // from the streets instead of materialising in view.
  const p = state.player.car ?? state.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const angle = randRange(state.rng, 0, Math.PI * 2);
    const dist = randRange(state.rng, 500, 620);
    const x = clamp(p.x + Math.cos(angle) * dist, 40, 3300);
    const y = clamp(p.y + Math.sin(angle) * dist, 40, 2840);
    if (state.city.isRoad(x, y)) return { x, y };
  }
  return { x: p.x + 520, y: p.y };
}

export function updateWanted(state, dt) {
  const w = state.wanted;
  const stars = wantedStars(state);
  const focus = state.player.car ?? state.player;

  // Sight: any cruiser close to the player keeps the heat fresh.
  let seen = false;
  for (const car of state.cars) {
    if (car.kind === 'police' && distance(car.x, car.y, focus.x, focus.y) < WANTED.sightRange) seen = true;
  }
  if (seen) w.unseen = 0;
  else {
    w.unseen += dt;
    if (w.unseen > WANTED.decaySeconds && w.heat > 0) {
      w.heat = Math.max(0, w.heat - dt / WANTED.decaySeconds);
      if (w.heat === 0) w.unseen = 0;
    }
  }

  // Keep the pursuit fleet at one cruiser per star; retire distant ones
  // once the heat is gone.
  const cruisers = state.cars.filter((car) => car.kind === 'police');
  if (stars > cruisers.length && state.time > (w.lastSpawn ?? 0) + 1.2) {
    w.lastSpawn = state.time;
    const spot = spawnPoint(state);
    const car = createCar(state.rng, spot.x, spot.y, Math.atan2(focus.y - spot.y, focus.x - spot.x), 'police');
    state.cars.push(car);
  }
  if (stars === 0) {
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.kind === 'police' && distance(car.x, car.y, focus.x, focus.y) > 760) state.cars.splice(i, 1);
    }
  }
}

/**
 * Drive one cruiser. Returns 'busted' when a foot arrest completes.
 * Cruisers chase the player's position (or car), brake to arrest on foot,
 * and trade paint with a fleeing car.
 */
export function updatePoliceCar(car, dt, state) {
  if (car.wrecked) return '';
  const player = state.player;
  const focus = player.car ?? player;
  const dist = distance(car.x, car.y, focus.x, focus.y);
  const stars = wantedStars(state);
  let targetSpeed = CAR.policeSpeed * (0.86 + stars * 0.045) * car.topFactor;
  if (!player.car && dist < 52) targetSpeed = 0;           // box in for the arrest
  if (dist > 700) targetSpeed *= 1.25;                      // catch up from far away
  car.speed += clamp(targetSpeed - Math.abs(car.speed), -CAR.brake * dt, CAR.accel * dt) * Math.sign(car.speed || 1);
  if (car.speed < 0) car.speed = targetSpeed * 0.4;

  const lead = clamp(dist / 300, 0, 0.5);
  const aimX = focus.x + (focus.vx ?? 0) * lead;
  const aimY = focus.y + (focus.vy ?? 0) * lead;
  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  car.angle = turnToward(car.angle, desired, 2.3 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = state.city.collideCircle(car.x, car.y, 19);
  if (fixed.x !== car.x || fixed.y !== car.y) car.speed *= 0.5;
  car.x = fixed.x;
  car.y = fixed.y;

  // The arrest: player on foot, cruiser alongside, nowhere to run.
  if (!player.car && dist < 54) {
    state.wanted.bust += dt / WANTED.bustFillSeconds;
    if (state.wanted.bust >= 1) return 'busted';
  }
  return '';
}
