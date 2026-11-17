// Solace Vice — combat: fists, the Brisa Arms pistol, thugs who fight back,
// cash that falls out of trouble, and the crime reports every act files with
// the wanted system. The player aims with the mouse; a click punches when
// close and shoots when the pistol is out.
import { PLAYER } from './config.js';
import { clamp, distance } from './random.js';
import { addCrime, crimeWitnessed } from './police.js';
import { scarePeds } from './pedestrians.js';

export function spawnFx(state, fx) {
  state.fx.push({ life: 0.4, maxLife: 0.4, ...fx });
}

export function updateFx(state, dt) {
  for (let i = state.fx.length - 1; i >= 0; i -= 1) {
    const fx = state.fx[i];
    fx.life -= dt;
    fx.x += (fx.vx ?? 0) * dt;
    fx.y += (fx.vy ?? 0) * dt;
    if (fx.life <= 0) state.fx.splice(i, 1);
  }
}

function hurtPed(state, ped, damage, cause) {
  if (!ped.alive) return;
  ped.health -= damage;
  spawnFx(state, { x: ped.x, y: ped.y - 8, vx: 0, vy: -30, kind: 'hit', life: 0.3, maxLife: 0.3 });
  if (ped.health <= 0) {
    ped.alive = false;
    ped.mode = 'down';
    state.audio.hurt();
    // Trouble drops money.
    state.pickups.push({ x: ped.x + 8, y: ped.y + 4, kind: 'cash', amount: 20 + Math.floor(state.rng() * 40), bob: Math.random() * 6 });
    addCrime(state, cause === 'shot' ? 1.4 : 1.0, crimeWitnessed(state, ped.x, ped.y));
    scarePeds(state, ped.x, ped.y, 260);
  } else if (!ped.hostile) {
    ped.mode = 'flee';
    ped.fleeFrom = { x: state.player.x, y: state.player.y };
    ped.fleeTimer = 2.4;
  }
}

/** One attack from the player, aimed at the mouse's world position. */
export function tryAttack(state, aimX, aimY) {
  const player = state.player;
  if (player.car || player.fireTimer > 0) return;
  const angle = Math.atan2(aimY - player.y, aimX - player.x);
  player.angle = angle;

  if (player.hasPistol && player.ammo > 0) {
    player.fireTimer = PLAYER.fireCooldown;
    player.ammo -= 1;
    state.audio.shot();
    spawnFx(state, { x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, kind: 'tracer', life: 0.09, maxLife: 0.09 });
    scarePeds(state, player.x, player.y, 300);
    addCrime(state, 0.8, crimeWitnessed(state, player.x, player.y));
    // Hitscan: the nearest living ped or car body within a narrow cone.
    let bestPed = null;
    let bestDist = 430;
    for (const ped of state.peds) {
      if (!ped.alive) continue;
      const d = distance(player.x, player.y, ped.x, ped.y);
      if (d > bestDist) continue;
      const a = Math.atan2(ped.y - player.y, ped.x - player.x);
      if (Math.abs(((a - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.09) {
        bestPed = ped;
        bestDist = d;
      }
    }
    if (bestPed) hurtPed(state, bestPed, PLAYER.shotDamage, 'shot');
    return;
  }

  // Fists: anyone within reach and roughly in front.
  player.fireTimer = 0.28;
  state.audio.punch();
  let hit = false;
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    if (distance(player.x, player.y, ped.x, ped.y) > PLAYER.punchRange + 8) continue;
    const a = Math.atan2(ped.y - player.y, ped.x - player.x);
    if (Math.abs(((a - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.1) {
      hurtPed(state, ped, PLAYER.punchDamage, 'punch');
      hit = true;
    }
  }
  if (hit) addCrime(state, 0.5, crimeWitnessed(state, player.x, player.y));
}

/** Hostile thugs (mission muscle) close in and swing at the player. */
export function updateThugs(state, dt) {
  const player = state.player;
  for (const ped of state.peds) {
    if (!ped.alive || !ped.hostile) continue;
    const target = player.car ?? player;
    const d = distance(ped.x, ped.y, target.x, target.y);
    if (player.car) continue;                    // thugs won't chase a car
    if (d > 26) {
      const a = Math.atan2(player.y - ped.y, player.x - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * 128 * dt;
      ped.y += Math.sin(a) * 128 * dt;
      const fixed = state.city.collideCircle(ped.x, ped.y, 10);
      ped.x = fixed.x;
      ped.y = fixed.y;
    } else {
      ped.swing = (ped.swing ?? 0) - dt;
      if (ped.swing <= 0) {
        ped.swing = 0.9;
        player.health -= 7;
        state.audio.hurt();
        spawnFx(state, { x: player.x, y: player.y - 10, vx: 0, vy: -24, kind: 'hit', life: 0.3, maxLife: 0.3 });
      }
    }
  }
}

/** Cash and ammo pickups drift to the player on foot and are collected. */
export function updatePickups(state, dt) {
  const player = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = state.pickups[i];
    pickup.bob += dt * 4;
    if (!player.car && distance(player.x, player.y, pickup.x, pickup.y) < 26) {
      if (pickup.kind === 'cash') {
        player.money += pickup.amount;
        state.audio.cash();
      } else if (pickup.kind === 'ammo') {
        player.ammo += pickup.amount;
        state.audio.pickup();
      }
      state.pickups.splice(i, 1);
    }
  }
}

export function damagePlayer(state, amount) {
  const player = state.player;
  player.health = clamp(player.health - amount, 0, PLAYER.maxHealth);
  if (amount > 2) state.audio.hurt();
}
