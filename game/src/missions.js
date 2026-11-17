// Solace Vice — the story of Marco Reyes and Port Solace, as data plus a
// small step engine. Four missions chain from Café Lucia: a first driving
// favour, a timed package run, a beach debt collected the hard way, and the
// Solace Score — stealing the Turismo GT and losing the police. Each mission
// is dialogue, then steps (go, drive, steal, fight, escape), then a payout.
import { distance } from './random.js';
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { addCrime, wantedStars } from './police.js';
import { writeSave } from './save.js';

export const MISSIONS = [
  {
    title: 'First Wheels',
    giver: 'cafe',
    giverName: 'Lucia Ferrer',
    intro: [
      ['Lucia', 'Marco Reyes. Back in Port Solace and already owing me a favour.'],
      ['Marco', 'Name it, Lucia. Driving, I hope.'],
      ['Lucia', 'My nephew left my Brisa at the docks again. Fetch it, bring it home. And Marco — drive like the car is mine. It is.'],
    ],
    steps: [
      { type: 'enter', carTag: 'lucia-car', at: 'cafe', label: 'Get in Lucia’s Brisa Coupe' },
      { type: 'drive', at: 'docks', label: 'Drive the Brisa to Port Solace Docks' },
      { type: 'drive', at: 'cafe', label: 'Bring the Brisa back to Café Lucia' },
    ],
    reward: 250,
    outro: [
      ['Lucia', 'Unscratched. You still have the hands, Reyes.'],
      ['Lucia', 'Take this — a Brisa Arms pistol, and shells. Port Solace is not as friendly as it looks.'],
    ],
    grantsPistol: true,
  },
  {
    title: 'Package Run',
    giver: 'docks',
    giverName: 'Old Ferran',
    intro: [
      ['Ferran', 'You Lucia’s driver? Good. This crate goes to the Copacabana Club on the Neon Mile.'],
      ['Ferran', 'No questions, no stops. The harbour patrol has been curious lately — expect stars.'],
    ],
    steps: [
      { type: 'goto', at: 'docks', label: 'Pick up the package at the docks' },
      { type: 'drive', at: 'neonMile', label: 'Deliver the package to the Copacabana Club', timer: 150, heatOnStart: 2 },
    ],
    reward: 700,
    outro: [
      ['Ferran', 'On time and breathing. Lucia was right about you.'],
    ],
  },
  {
    title: 'Beach Debt',
    giver: 'beach',
    giverName: 'Lucia Ferrer',
    intro: [
      ['Lucia', 'Vince Marlowe’s collectors are shaking down my cousin at Playa Brisa.'],
      ['Lucia', 'He owes Vince. Vince owes me. Go explain arithmetic to them, Marco.'],
    ],
    steps: [
      { type: 'goto', at: 'beach', label: 'Find the collectors at Playa Brisa' },
      { type: 'fight', at: 'beach', count: 2, label: 'Deal with Vince’s collectors' },
      { type: 'drive', at: 'cafe', label: 'Take the settled debt back to Café Lucia' },
    ],
    reward: 900,
    outro: [
      ['Lucia', 'Arithmetic, explained. Vince will hear about this — that is the point.'],
    ],
  },
  {
    title: 'The Solace Score',
    giver: 'dealership',
    giverName: 'Lucia Ferrer',
    intro: [
      ['Lucia', 'One last job, Marco. The Turismo GT at Solace Motors — Vince’s toy, bought with my money.'],
      ['Lucia', 'Take it. Lose the police. Park it at your hideout. Then we are square, and Port Solace is ours again.'],
    ],
    steps: [
      { type: 'steal', carTag: 'score-car', at: 'dealership', label: 'Steal the Turismo GT from Solace Motors' },
      { type: 'escape', label: 'Lose the police' },
      { type: 'drive', at: 'hideout', label: 'Park the GT at the Reyes Hideout' },
    ],
    reward: 2000,
    outro: [
      ['Lucia', 'Square, Marco. The café, the mile, the bay — Port Solace remembers its own.'],
      ['Marco', 'Then let’s make sure it keeps remembering.'],
    ],
  },
];

function landmark(state, key) {
  return state.city.landmarks[key];
}

/** Where the player should go next: the active step, or the next giver. */
export function currentObjective(state) {
  if (state.mission) {
    const step = state.mission.def.steps[state.mission.stepIndex];
    if (!step) return null;
    if (step.type === 'escape') return { x: state.player.x, y: state.player.y, label: step.label, hideMarker: true };
    if ((step.type === 'enter' || step.type === 'steal') && state.mission.spawnedCar) {
      return { x: state.mission.spawnedCar.x, y: state.mission.spawnedCar.y, label: step.label };
    }
    const at = landmark(state, step.at ?? state.mission.def.giver);
    return { x: at.x, y: at.y, label: step.label };
  }
  if (!state.story.done && state.story.nextMission < MISSIONS.length) {
    const def = MISSIONS[state.story.nextMission];
    const at = landmark(state, def.giver);
    return { x: at.x, y: at.y, label: `${def.giverName} has work — press E`, giver: true };
  }
  return null;
}

/** Begin the next mission's intro dialogue when the player talks to the giver. */
export function tryStartMission(state) {
  if (state.mission || state.story.done || state.story.nextMission >= MISSIONS.length) return false;
  const def = MISSIONS[state.story.nextMission];
  const at = landmark(state, def.giver);
  const focus = state.player;
  if (distance(focus.x, focus.y, at.x, at.y) > 90) return false;
  state.dialogue = { lines: def.intro, index: 0, onDone: () => activateMission(state, def) };
  return true;
}

function activateMission(state, def) {
  state.mission = { def, stepIndex: 0, spawnedCar: null, thugs: [], stepStarted: false, timerLeft: null };
  state.message = { text: `Mission: ${def.title}`, until: state.time + 3.4 };
  state.audio.missionDone();
  beginStep(state);
}

function beginStep(state) {
  const mission = state.mission;
  const step = mission.def.steps[mission.stepIndex];
  if (!step) return;
  mission.stepStarted = true;
  mission.timerLeft = step.timer ?? null;
  if (step.heatOnStart) addCrime(state, step.heatOnStart, true);
  if ((step.type === 'enter' || step.type === 'steal') && step.carTag && !mission.spawnedCar) {
    const at = landmark(state, step.at);
    const car = createCar(state.rng, at.x + 46, at.y + 30, Math.PI, 'parked');
    if (step.carTag === 'score-car') {
      car.model = 'Turismo GT';
      car.topFactor = 1.22;
      car.accelFactor = 1.25;
      car.color = '#ffd32a';
    } else {
      car.model = 'Brisa Coupe';
      car.color = '#e74c3c';
    }
    car.tag = step.carTag;
    mission.spawnedCar = car;
    state.cars.push(car);
  }
  if (step.type === 'fight' && mission.thugs.length === 0) {
    const at = landmark(state, step.at);
    for (let i = 0; i < (step.count ?? 2); i += 1) {
      const thug = createPed(state.rng, at.x + 30 + i * 42, at.y + 16 - i * 20);
      thug.hostile = true;
      thug.health = 95;
      thug.shirt = '#2d3436';
      mission.thugs.push(thug);
      state.peds.push(thug);
    }
    state.message = { text: 'They don’t look like talking.', until: state.time + 2.6 };
  }
  if (step.type === 'steal') {
    // The GT is alarmed: taking it is the crime, handled on entry.
  }
}

/** Called by the game when the player gets into any car. */
export function missionOnEnterCar(state, car) {
  const mission = state.mission;
  if (!mission) return;
  const step = mission.def.steps[mission.stepIndex];
  if (!step) return;
  if ((step.type === 'enter' || step.type === 'steal') && car.tag === step.carTag) {
    if (step.type === 'steal') addCrime(state, 3, true);
    advanceStep(state);
  }
}

function advanceStep(state) {
  const mission = state.mission;
  mission.stepIndex += 1;
  mission.stepStarted = false;
  mission.thugs = [];
  if (mission.stepIndex >= mission.def.steps.length) completeMission(state);
  else beginStep(state);
}

function completeMission(state) {
  const def = state.mission.def;
  state.player.money += def.reward;
  if (def.grantsPistol) {
    state.player.hasPistol = true;
    state.player.ammo += 30;
  }
  state.mission = null;
  state.story.nextMission += 1;
  if (state.story.nextMission >= MISSIONS.length) state.story.done = true;
  state.audio.missionDone();
  state.dialogue = { lines: def.outro, index: 0, onDone: null };
  state.message = { text: `Mission complete — $${def.reward}`, until: state.time + 3.6 };
  writeSave(state);
}

function failMission(state, reason) {
  state.mission = null;
  state.message = { text: `Mission failed — ${reason}. The giver still has work (E).`, until: state.time + 4 };
  state.audio.hurt();
}

/** Advance the active mission by one step of game time. */
export function updateMission(state, dt) {
  const mission = state.mission;
  if (!mission) return;
  const step = mission.def.steps[mission.stepIndex];
  if (!step) return;
  if (mission.timerLeft !== null) {
    mission.timerLeft -= dt;
    if (mission.timerLeft <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }
  const player = state.player;
  const focus = player.car ?? player;
  if (step.type === 'goto') {
    const at = landmark(state, step.at);
    if (!player.car && distance(player.x, player.y, at.x, at.y) < 58) advanceStep(state);
  } else if (step.type === 'drive') {
    const at = landmark(state, step.at);
    if (player.car && distance(focus.x, focus.y, at.x, at.y) < 92) advanceStep(state);
  } else if (step.type === 'fight') {
    if (mission.thugs.length > 0 && mission.thugs.every((thug) => !thug.alive)) advanceStep(state);
  } else if (step.type === 'escape') {
    if (wantedStars(state) === 0 && state.wanted.unseen > 1.2) advanceStep(state);
  }
}
