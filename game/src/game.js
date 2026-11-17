// Solace Vice — the game itself: the shared state, the screens (title,
// play, pause, busted, wasted, story complete), and the per-step update
// that wires every system together — walking and driving, stealing cars,
// traffic, crowds, police, combat, missions, pickups and the camera.
import { PALETTE, PLAYER, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { clamp, distance, makeRng } from './random.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createCar, drivePlayerCar, spawnParkedCars, spawnTraffic, updateTraffic, carSpeedRatio } from './vehicles.js';
import { scarePeds, spawnCrowd, updatePed } from './pedestrians.js';
import { addCrime, crimeWitnessed, updatePoliceCar, updateWanted, wantedStars } from './police.js';
import { damagePlayer, tryAttack, updateFx, updatePickups, updateThugs, spawnFx } from './combat.js';
import { currentObjective, missionOnEnterCar, tryStartMission, updateMission } from './missions.js';
import { clearSave, loadSave, writeSave } from './save.js';

export function createGame(seed) {
  const rng = makeRng(seed);
  const city = buildCity(20261117);
  const audio = createAudio();
  const state = {
    rng,
    city,
    audio,
    time: 0,
    screen: 'title',
    viewW: VIEW_W,
    viewH: VIEW_H,
    camera: { x: 0, y: 0 },
    player: null,
    cars: [],
    peds: [],
    fx: [],
    pickups: [],
    wanted: { heat: 0, unseen: 0, bust: 0, lastSpawn: 0 },
    story: { nextMission: 0, done: false },
    mission: null,
    dialogue: null,
    message: null,
    objective: null,
    hasSave: false,
    titleChoice: 0,
    lastFine: 0,
    storyShown: false,
    trafficTimer: 0,
  };

  function freshPlayer(x, y) {
    return {
      x, y, vx: 0, vy: 0, angle: -Math.PI / 2,
      health: PLAYER.maxHealth, money: 120,
      car: null, hasPistol: false, ammo: 0, fireTimer: 0,
    };
  }

  function resetWorld(fromSave) {
    const cafe = city.landmarks.cafe;
    state.player = freshPlayer(cafe.x - 60, cafe.y + 56);
    state.cars = [...spawnTraffic(city, rng, 14, state.player), ...spawnParkedCars(city, rng)];
    state.peds = spawnCrowd(city, rng, 42);
    state.fx = [];
    state.pickups = [];
    state.wanted = { heat: 0, unseen: 0, bust: 0, lastSpawn: 0 };
    state.mission = null;
    state.dialogue = null;
    state.story = { nextMission: 0, done: false };
    state.storyShown = false;
    if (fromSave) {
      const save = loadSave();
      if (save) {
        state.player.money = save.money;
        state.player.hasPistol = save.hasPistol;
        state.player.ammo = save.ammo;
        state.player.x = save.x;
        state.player.y = save.y;
        state.story.nextMission = save.nextMission;
        state.story.done = save.storyDone;
      }
    }
    state.hasSave = !!loadSave();
  }

  resetWorld(false);
  state.hasSave = !!loadSave();

  function focus() {
    return state.player.car ?? state.player;
  }

  function updateCamera(dt) {
    const f = focus();
    const tx = clamp(f.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const ty = clamp(f.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    const ease = state.screen === 'title' ? 0.4 : 1 - Math.pow(0.0001, dt);
    state.camera.x += (tx - state.camera.x) * Math.min(1, ease);
    state.camera.y += (ty - state.camera.y) * Math.min(1, ease);
    if (state.screen === 'title') {
      state.camera.x = (Math.sin(state.time * 0.05) * 0.5 + 0.5) * (WORLD_W - VIEW_W);
      state.camera.y = (Math.cos(state.time * 0.037) * 0.5 + 0.5) * (WORLD_H - VIEW_H);
    }
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of state.cars) {
      if (car.wrecked) continue;
      const d = distance(x, y, car.x, car.y);
      if (d < bestDist) {
        best = car;
        bestDist = d;
      }
    }
    return best;
  }

  function enterCar(car) {
    const player = state.player;
    const wasParked = car.kind === 'parked';
    if (car.kind === 'traffic') {
      // Yank the driver out: they become a very unhappy pedestrian.
      const driver = state.peds.find((ped) => !ped.alive) ?? null;
      if (driver) {
        driver.alive = true;
        driver.health = 60;
        driver.x = car.x + 24;
        driver.y = car.y + 10;
        driver.mode = 'flee';
        driver.fleeFrom = { x: player.x, y: player.y };
        driver.fleeTimer = 3;
      }
      addCrime(state, 1, crimeWitnessed(state, car.x, car.y));
      scarePeds(state, car.x, car.y, 200);
    } else if (wasParked && !car.everStolen) {
      car.everStolen = true;
      addCrime(state, 0.8, crimeWitnessed(state, car.x, car.y));
    }
    car.kind = 'player';
    player.car = car;
    state.audio.door();
    missionOnEnterCar(state, car);
  }

  function exitCar() {
    const player = state.player;
    const car = player.car;
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    const side = car.angle + Math.PI / 2;
    const spot = city.collideCircle(car.x + Math.cos(side) * 30, car.y + Math.sin(side) * 30, PLAYER.radius);
    player.x = spot.x;
    player.y = spot.y;
    player.car = null;
    state.audio.door();
  }

  function runOverAndCollisions(dt) {
    const player = state.player;
    const car = player.car;
    if (!car) return;
    // Running down pedestrians is fast, loud and very illegal.
    if (Math.abs(car.speed) > 70) {
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        if (distance(car.x, car.y, ped.x, ped.y) < 24) {
          ped.alive = false;
          ped.mode = 'down';
          car.speed *= 0.82;
          state.audio.crash();
          addCrime(state, 1.2, crimeWitnessed(state, ped.x, ped.y));
          scarePeds(state, ped.x, ped.y, 280);
          state.pickups.push({ x: ped.x + 6, y: ped.y, kind: 'cash', amount: 15 + Math.floor(state.rng() * 30), bob: 0 });
        }
      }
    }
    // Car-to-car contact: shove apart, trade damage, draw sparks.
    for (const other of state.cars) {
      if (other === car) continue;
      const d = distance(car.x, car.y, other.x, other.y);
      if (d < 46 && d > 0.01) {
        const push = (46 - d) / 2;
        const nx = (other.x - car.x) / d;
        const ny = (other.y - car.y) / d;
        other.x += nx * push;
        other.y += ny * push;
        car.x -= nx * push;
        car.y -= ny * push;
        const impact = Math.abs(car.speed) + Math.abs(other.speed);
        if (impact > 130) {
          state.audio.crash();
          spawnFx(state, { x: (car.x + other.x) / 2, y: (car.y + other.y) / 2, kind: 'spark', life: 0.35, maxLife: 0.35 });
          other.health -= impact * 0.06;
          car.health -= impact * 0.045;
          if (other.health <= 0) other.wrecked = true;
          if (car.health <= 0) car.wrecked = true;
          if (other.kind === 'police') addCrime(state, 0.7, true);
          car.speed *= 0.55;
          other.speed *= 0.4;
          damagePlayer(state, impact * 0.012);
        }
      }
    }
  }

  function updatePlayerOnFoot(dt, input, mouseWorld) {
    const player = state.player;
    const dx = (input.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const dy = (input.isDown('KeyS', 'ArrowDown') ? 1 : 0) - (input.isDown('KeyW', 'ArrowUp') ? 1 : 0);
    const running = input.isDown('ShiftLeft', 'ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      player.vx = (dx / len) * speed;
      player.vy = (dy / len) * speed;
    } else {
      player.vx = 0;
      player.vy = 0;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const fixed = city.collideCircle(player.x, player.y, PLAYER.radius);
    player.x = fixed.x;
    player.y = fixed.y;
    player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
    if (input.takePressed('KeyF') || input.takePressed('Enter')) {
      const car = nearestCar(player.x, player.y, 52);
      if (car) enterCar(car);
    }
    if (input.mouse.down || input.isDown('KeyJ')) tryAttack(state, mouseWorld.x, mouseWorld.y);
  }

  function endRun(kind) {
    const player = state.player;
    const stars = wantedStars(state);
    state.lastFine = kind === 'busted' ? Math.min(player.money, 150 + stars * 20) : Math.min(player.money, 100 + stars * 15);
    player.money -= state.lastFine;
    if (player.car) {
      player.car.kind = 'parked';
      player.car.speed = 0;
      player.car = null;
    }
    const spot = kind === 'busted' ? city.landmarks.policeStation : city.landmarks.hospital;
    player.x = spot.x + 30;
    player.y = spot.y + 44;
    player.health = PLAYER.maxHealth;
    state.wanted = { heat: 0, unseen: 0, bust: 0, lastSpawn: 0 };
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      if (state.cars[i].kind === 'police') state.cars.splice(i, 1);
    }
    state.mission = null;
    state.screen = kind;
    state.audio.setSiren(false, 0);
    state.audio.setEngine(false, 0);
    writeSave(state);
  }

  function stepPlay(dt, input) {
    const player = state.player;
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    const mouseWorld = { x: input.mouse.x + state.camera.x, y: input.mouse.y + state.camera.y };

    // Dialogue holds the player's feet; the city keeps breathing.
    if (state.dialogue) {
      if (input.takePressed('KeyE') || input.takePressed('Enter') || input.takeClicked()) {
        state.dialogue.index += 1;
        if (state.dialogue.index >= state.dialogue.lines.length) {
          const done = state.dialogue.onDone;
          state.dialogue = null;
          if (done) done();
        }
      }
    } else if (player.car) {
      const impact = drivePlayerCar(player.car, dt, input, city);
      if (impact > 0) {
        state.audio.crash();
        spawnFx(state, { x: player.car.x, y: player.car.y, kind: 'spark', life: 0.3, maxLife: 0.3 });
        damagePlayer(state, impact * 0.02);
        addCrime(state, 0.4, crimeWitnessed(state, player.car.x, player.car.y));
      }
      runOverAndCollisions(dt);
      if (input.takePressed('KeyF') || input.takePressed('Enter')) exitCar();
      if (player.car && player.car.wrecked) {
        state.message = { text: 'The car is wrecked. Walk away, find another.', until: state.time + 3 };
        exitCar();
      }
    } else {
      updatePlayerOnFoot(dt, input, mouseWorld);
      if (input.takePressed('KeyE')) {
        if (!tryStartMission(state)) tryGunShop(state);
      }
    }

    // The living city.
    for (const car of state.cars) {
      if (car.kind === 'traffic') updateTraffic(car, dt, state);
      else if (car.kind === 'police') {
        if (updatePoliceCar(car, dt, state) === 'busted') {
          endRun('busted');
          return;
        }
      }
    }
    for (const ped of state.peds) updatePed(ped, dt, state);
    updateThugs(state, dt);
    updatePickups(state, dt);
    updateFx(state, dt);
    updateWanted(state, dt);
    updateMission(state, dt);
    if (state.wanted.bust > 0 && !state.cars.some((car) => car.kind === 'police' && distance(car.x, car.y, player.x, player.y) < 70)) {
      state.wanted.bust = Math.max(0, state.wanted.bust - dt * 0.6);
    }
    // Keep the traffic population topped up.
    state.trafficTimer -= dt;
    if (state.trafficTimer <= 0) {
      state.trafficTimer = 4;
      const trafficCount = state.cars.filter((car) => car.kind === 'traffic').length;
      if (trafficCount < 12) state.cars.push(...spawnTraffic(city, state.rng, 2, focus()));
    }
    // Sound follows the action.
    const nearestCop = Math.min(...state.cars.filter((car) => car.kind === 'police').map((car) => distance(car.x, car.y, focus().x, focus().y)), Infinity);
    state.audio.setSiren(wantedStars(state) > 0 && nearestCop < 560, dt);
    state.audio.setEngine(!!player.car, player.car ? carSpeedRatio(player.car) : 0);
    state.audio.updateMusic(dt, wantedStars(state) === 0);
    state.objective = currentObjective(state);
    if (player.health <= 0) {
      endRun('wasted');
      return;
    }
    if (state.story.done && !state.storyShown && !state.dialogue && !state.mission) {
      state.storyShown = true;
      state.screen = 'storydone';
    }
  }

  function tryGunShop(stateRef) {
    const shop = city.landmarks.gunShop;
    const player = stateRef.player;
    if (distance(player.x, player.y, shop.x, shop.y) < 90) {
      if (!player.hasPistol) {
        stateRef.message = { text: 'Brisa Arms: the pistol is a story of its own. (Lucia has one for you.)', until: stateRef.time + 3 };
      } else if (player.money >= 60) {
        player.money -= 60;
        player.ammo += 30;
        stateRef.audio.pickup();
        stateRef.message = { text: 'Brisa Arms: +30 shells for $60.', until: stateRef.time + 2.4 };
      } else {
        stateRef.message = { text: 'Brisa Arms: shells are $60. You’re short.', until: stateRef.time + 2.4 };
      }
    }
  }

  /** Advance the whole game one fixed step. */
  function step(dt, input) {
    state.time += dt;
    if (state.screen === 'title') {
      for (const car of state.cars) if (car.kind === 'traffic') updateTraffic(car, dt, state);
      for (const ped of state.peds) updatePed(ped, dt, state);
      updateFx(state, dt);
      state.audio.updateMusic(dt, true);
      const menuCount = state.hasSave ? 2 : 1;
      if (input.takePressed('KeyS') || input.takePressed('ArrowDown') || input.takePressed('KeyW') || input.takePressed('ArrowUp')) {
        state.titleChoice = (state.titleChoice + 1) % menuCount;
      }
      if (input.takePressed('Enter') || input.takePressed('Space') || input.takeClicked()) {
        state.audio.unlock();
        const cont = state.hasSave && state.titleChoice === 1;
        clearSaveIfNew(cont);
        resetWorld(cont);
        state.screen = 'play';
        state.message = { text: cont ? 'Welcome back to Port Solace.' : 'Port Solace. Lucia is waiting at her café — follow the marker.', until: state.time + 4.2 };
      }
    } else if (state.screen === 'play') {
      if (input.takePressed('KeyP') || input.takePressed('Escape')) {
        state.screen = 'paused';
        state.audio.setEngine(false, 0);
        state.audio.setSiren(false, 0);
      } else stepPlay(dt, input);
    } else if (state.screen === 'paused') {
      if (input.takePressed('KeyP') || input.takePressed('Escape') || input.takePressed('Enter')) state.screen = 'play';
    } else if (state.screen === 'busted' || state.screen === 'wasted' || state.screen === 'storydone') {
      if (input.takePressed('Enter') || input.takePressed('Space') || input.takeClicked()) state.screen = 'play';
    }
    updateCamera(dt);
    state.objective = state.screen === 'play' ? state.objective : currentObjective(state);
  }

  function clearSaveIfNew(cont) {
    if (!cont) clearSave();
  }

  return { state, step, resetWorld };
}
