// Solace Vice — the screenshot scenes behind ?shot=drive|chase|mission|title.
// Each scene builds a fresh game, stages a real moment the rules can produce
// (a drive down the Neon Mile mid-mission, a three-star chase on the coast
// road, the package pickup at the docks, the title over the city), runs the
// simulation forward a few seconds with a scripted driver, and leaves the
// frame ready to capture. Same seed, same frame, every time.
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { missionOnEnterCar, tryStartMission } from './missions.js';

const HELD = { w: false };
const fakeInput = {
  held: new Set(),
  mouse: { x: 880, y: 320, down: false, clicked: false },
  takePressed: () => false,
  takeClicked: () => false,
  isDown: (...codes) => (HELD.w && codes.includes('KeyW')),
};

function runSteps(game, seconds, drive) {
  HELD.w = drive;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.step(STEP, fakeInput);
  HELD.w = false;
}

function finishDialogue(state) {
  if (!state.dialogue) return;
  const done = state.dialogue.onDone;
  state.dialogue = null;
  if (done) done();
}

function startMissionAt(game, missionIndex, giverKey) {
  const state = game.state;
  state.story.nextMission = missionIndex;
  const at = state.city.landmarks[giverKey];
  state.player.x = at.x + 20;
  state.player.y = at.y + 30;
  tryStartMission(state);
  finishDialogue(state);
}

function putPlayerInCar(state, car, x, y, angle) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.kind = 'player';
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
}

/** Stage the named scene on a fresh game and return the game, ready to draw. */
export function stageShot(game, name) {
  const state = game.state;
  state.screen = 'play';
  if (name === 'chase') {
    // Three stars on the coast road: the yellow Turismo, cruisers behind.
    startMissionAt(game, 0, 'cafe');
    const car = state.mission?.spawnedCar ?? state.cars.find((c) => c.kind === 'parked');
    car.model = 'Turismo GT';
    car.color = '#ffd32a';
    putPlayerInCar(state, car, 3264, 1980, -Math.PI / 2);
    missionOnEnterCar(state, car);
    state.wanted.heat = 3.2;
    for (let i = 0; i < 3; i += 1) {
      const cop = createCar(state.rng, 3264 + (i - 1) * 26, 2190 + i * 84, -Math.PI / 2, 'police');
      cop.speed = 215;
      state.cars.push(cop);
    }
    runSteps(game, 1.8, true);
    return game;
  }
  if (name === 'mission') {
    // On foot at the docks, package run accepted, the marker up, crew around.
    startMissionAt(game, 1, 'docks');
    state.player.x = 3330;
    state.player.y = 2496;
    state.player.angle = 0.5;
    state.player.hasPistol = true;
    state.player.ammo = 24;
    state.player.money = 370;
    for (const [px, py] of [[3410, 2540], [3360, 2620], [3460, 2470], [3300, 2580]]) {
      state.peds.push(createPed(state.rng, px, py));
    }
    runSteps(game, 1.2, false);
    return game;
  }
  if (name === 'title') {
    state.screen = 'title';
    state.camera.x = 1500;
    state.camera.y = 900;
    runSteps(game, 1.5, false);
    state.camera.x = 1500;
    state.camera.y = 900;
    return game;
  }
  // 'drive' (the cover): mid-mission on the Neon Mile, traffic all around,
  // Lucia's red Brisa under the player, objective banner on the HUD.
  startMissionAt(game, 0, 'cafe');
  const car = state.mission?.spawnedCar ?? state.cars.find((c) => c.kind === 'parked');
  putPlayerInCar(state, car, 2050, 1216, 0);
  missionOnEnterCar(state, car);
  state.player.money = 120;
  // Company on the Mile: one car ahead in our lane, one coming the other way.
  const ahead = createCar(state.rng, 2620, 1244, 0, 'traffic');
  ahead.speed = 120;
  const oncoming = createCar(state.rng, 2980, 1188, Math.PI, 'traffic');
  oncoming.speed = 120;
  state.cars.push(ahead, oncoming);
  runSteps(game, 2.6, true);
  return game;
}
