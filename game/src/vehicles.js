// Solace Vice — vehicles: the car factory, the parked cars waiting to be
// stolen, the traffic that drives Port Solace's grid, and the arcade driving
// physics for the car the player is in. Police cars are built here too, but
// their pursuit brains live in police.js.
import { CAR, ROAD_W, ROAD_XS, ROAD_YS, WORLD_H, WORLD_W } from './config.js';
import { clamp, distance, pick, randRange, turnToward } from './random.js';

export const CAR_MODELS = [
  { name: 'Brisa Coupe', topSpeed: 1.0, accel: 1.0 },
  { name: 'Solace Sedan', topSpeed: 0.92, accel: 0.9 },
  { name: 'Marina Pickup', topSpeed: 0.88, accel: 0.95 },
  { name: 'Docks Van', topSpeed: 0.8, accel: 0.85 },
  { name: 'Turismo GT', topSpeed: 1.22, accel: 1.25 },
  { name: 'Palmetto Wagon', topSpeed: 0.9, accel: 0.88 },
];
const CAR_COLORS = ['#e74c3c', '#f39c12', '#f7f1e1', '#3498db', '#2ecc71', '#9b59b6', '#fd79a8', '#95a5a6', '#fdcb6e', '#00b8d4'];

let nextCarId = 1;

export function createCar(rng, x, y, angle, kind) {
  const model = pick(rng, CAR_MODELS);
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    kind,                       // 'traffic' | 'parked' | 'police'
    model: model.name,
    topFactor: model.topSpeed,
    accelFactor: model.accel,
    color: kind === 'police' ? '#232c3f' : pick(rng, CAR_COLORS),
    health: 100,
    axis: Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle)) ? 'v' : 'h',
    dir: Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle)) ? Math.sign(Math.sin(angle)) || 1 : Math.sign(Math.cos(angle)) || 1,
    turnCooldown: randRange(rng, 2, 6),
    sirenPhase: Math.random() * Math.PI * 2,
    wrecked: false,
  };
}

/** Place traffic cars on random road lanes, away from the given point. */
export function spawnTraffic(city, rng, count, awayFrom) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 30) {
    guard += 1;
    const vertical = rng() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      const rx = ROAD_XS[Math.floor(rng() * ROAD_XS.length)];
      const dir = rng() < 0.5 ? 1 : -1;
      x = rx + ROAD_W * (dir > 0 ? 0.72 : 0.28);
      y = randRange(rng, 60, WORLD_H - 60);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = ROAD_YS[Math.floor(rng() * ROAD_YS.length)];
      const dir = rng() < 0.5 ? 1 : -1;
      y = ry + ROAD_W * (dir > 0 ? 0.72 : 0.28);
      x = randRange(rng, 60, WORLD_W - 200);
      angle = dir > 0 ? 0 : Math.PI;
    }
    if (awayFrom && distance(x, y, awayFrom.x, awayFrom.y) < 420) continue;
    cars.push(createCar(rng, x, y, angle, 'traffic'));
  }
  return cars;
}

/** Parked cars fill the city's lots and a few curbs — all of them stealable. */
export function spawnParkedCars(city, rng) {
  const cars = [];
  for (const spot of city.parkingSpots) {
    if (rng() < 0.38) continue;
    const car = createCar(rng, spot.x, spot.y, spot.angle, 'parked');
    cars.push(car);
  }
  return cars;
}

function trafficTargetSpeed(car, state) {
  // Brake for anything solid ahead: another car, the player's car, a person.
  const aheadX = car.x + Math.cos(car.angle) * 58;
  const aheadY = car.y + Math.sin(car.angle) * 58;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    if (distance(aheadX, aheadY, other.x, other.y) < 34) return 0;
  }
  const focus = state.player.car ?? state.player;
  if (distance(aheadX, aheadY, focus.x, focus.y) < 40) return 0;
  for (const ped of state.peds) {
    if (ped.alive && distance(aheadX, aheadY, ped.x, ped.y) < 30) return 0;
  }
  return CAR.trafficSpeed * car.topFactor;
}

/** Drive one traffic car along the grid: hold the lane, turn at junctions. */
export function updateTraffic(car, dt, state) {
  if (car.wrecked) return;
  const city = state.city;
  const target = trafficTargetSpeed(car, state);
  car.speed += clamp(target - car.speed, -CAR.brake * dt, CAR.accel * 0.5 * dt);
  car.turnCooldown -= dt;

  // Desired heading: along the current axis and direction, centred in lane.
  let desired = car.angle;
  const lane = city.laneCenter(car.x, car.y, car.angle);
  if (lane) {
    if (lane.axis === 'v') {
      const drift = lane.fixed - car.x;
      desired = Math.atan2(car.dir, clamp(drift * 0.04, -0.5, 0.5));
      if (car.dir < 0) desired = Math.atan2(-1, clamp(-drift * 0.04, -0.5, 0.5));
    } else {
      const drift = lane.fixed - car.y;
      desired = Math.atan2(clamp(drift * 0.04, -0.5, 0.5), car.dir);
      if (car.dir < 0) desired = Math.atan2(clamp(-drift * 0.04, -0.5, 0.5), -1);
    }
  }
  car.angle = turnToward(car.angle, desired, 1.9 * dt);

  // At an intersection, sometimes take the crossing road.
  const axisHere = city.roadAxis(car.x, car.y);
  const onCrossing = city.isRoad(car.x, car.y) && ((axisHere === 'v' && roadSpan(car.y, ROAD_YS)) || (axisHere === 'h' && roadSpan(car.x, ROAD_XS)));
  if (onCrossing && car.turnCooldown <= 0 && state.rng() < 0.35) {
    car.turnCooldown = randRange(state.rng, 2.5, 6);
    if (car.axis === 'v') {
      car.axis = 'h';
      car.dir = state.rng() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.axis = 'v';
      car.dir = state.rng() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = city.collideCircle(car.x, car.y, 20);
  car.x = fixed.x;
  car.y = fixed.y;
}

function roadSpan(pos, spans) {
  for (const start of spans) {
    if (pos >= start && pos < start + ROAD_W) return true;
  }
  return false;
}

/**
 * The player's driving: W/S or arrows to go and brake, A/D to steer (more
 * authority the faster the car rolls), Space for the handbrake. Returns the
 * impact speed when the car hits a building, else 0.
 */
export function drivePlayerCar(car, dt, input, city) {
  const up = input.isDown('KeyW', 'ArrowUp');
  const down = input.isDown('KeyS', 'ArrowDown');
  const left = input.isDown('KeyA', 'ArrowLeft');
  const right = input.isDown('KeyD', 'ArrowRight');
  const handbrake = input.isDown('Space');
  const top = CAR.playerTopSpeed * car.topFactor;
  if (up) car.speed += CAR.accel * car.accelFactor * dt;
  else if (down) {
    if (car.speed > 12) car.speed -= CAR.brake * dt;
    else car.speed = Math.max(car.speed - CAR.reverse * dt, -130);
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  if (handbrake) car.speed -= car.speed * 2.6 * dt;
  car.speed = clamp(car.speed, -140, top);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer !== 0 && car.speed !== 0) {
    const authority = clamp(Math.abs(car.speed) / 130, 0.25, 1) * 2.15;
    car.angle += steer * authority * dt * Math.sign(car.speed);
  }
  const before = { x: car.x, y: car.y, speed: Math.abs(car.speed) };
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = city.collideCircle(car.x, car.y, 19);
  let impact = 0;
  if (fixed.x !== car.x || fixed.y !== car.y) {
    if (before.speed > 120) impact = before.speed;
    car.speed *= 0.35;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  return impact;
}

export function carSpeedRatio(car) {
  return clamp(Math.abs(car.speed) / (CAR.playerTopSpeed * car.topFactor), 0, 1);
}
