// Solace Vice — drawing the world: Port Solace from above at golden hour.
// Ground, roads and buildings first, then pickups and the mission beacon,
// then people and cars, then effects. Everything is culled to the camera so
// only the visible streets are painted each frame.
import { BEACH_X, PALETTE, ROAD_W, ROAD_XS, ROAD_YS, WATER_X, WORLD_H, WORLD_W } from './config.js';

function inView(state, x, y, pad) {
  const cam = state.camera;
  return x > cam.x - pad && x < cam.x + state.viewW + pad && y > cam.y - pad && y < cam.y + state.viewH + pad;
}

function drawGround(ctx, state) {
  const cam = state.camera;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(cam.x, cam.y, state.viewW, state.viewH);
  // Mown stripes on the grass.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 128;
  for (let x = Math.floor(cam.x / stripe) * stripe; x < cam.x + state.viewW; x += stripe * 2) {
    ctx.fillRect(x, cam.y, stripe, state.viewH);
  }
  // The beach and the bay.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, cam.y, WATER_X - BEACH_X, state.viewH);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WATER_X, cam.y, WORLD_W - WATER_X + state.viewW, state.viewH);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let y = Math.floor(cam.y / 90) * 90; y < cam.y + state.viewH; y += 90) {
    ctx.fillRect(WATER_X + ((y * 7) % 60), y, 90, 5);
  }
  // Roads: asphalt, edge lines, dashed centre lines.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROAD_XS) ctx.fillRect(rx, cam.y, ROAD_W, state.viewH);
  for (const ry of ROAD_YS) ctx.fillRect(cam.x, ry, state.viewW, ROAD_W);
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const rx of ROAD_XS) {
    ctx.moveTo(rx + ROAD_W / 2, cam.y);
    ctx.lineTo(rx + ROAD_W / 2, cam.y + state.viewH);
  }
  for (const ry of ROAD_YS) {
    ctx.moveTo(cam.x, ry + ROAD_W / 2);
    ctx.lineTo(cam.x + state.viewW, ry + ROAD_W / 2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLots(ctx, state) {
  // Parking lots: tarmac with painted stall lines, under the parked cars.
  for (const lot of state.city.lots) {
    if (!inView(state, lot.x + lot.w / 2, lot.y + lot.h / 2, Math.max(lot.w, lot.h))) continue;
    ctx.fillStyle = '#55565e';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(244, 241, 232, 0.35)';
    ctx.lineWidth = 2;
    for (let sx = lot.x + 14; sx < lot.x + lot.w - 20; sx += 46) {
      ctx.beginPath();
      ctx.moveTo(sx, lot.y + 8);
      ctx.lineTo(sx, lot.y + 50);
      ctx.stroke();
    }
  }
}

function drawBuildings(ctx, state) {
  const city = state.city;
  for (const b of city.buildings) {
    if (!inView(state, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    // Sidewalk apron, then the shadow, then the roof.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(b.x - 12, b.y - 12, b.w + 24, b.h + 24);
    ctx.fillStyle = PALETTE.roofShadow;
    ctx.fillRect(b.x + 10, b.y + 14, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(40, 36, 30, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Rooftop detail: a skylight block and vents, cheap depth cues.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.fillRect(b.x + b.w * 0.18, b.y + b.h * 0.2, b.w * 0.3, b.h * 0.26);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.58, b.w * 0.16, b.h * 0.14);
    if (b.name) {
      ctx.fillStyle = 'rgba(20, 20, 28, 0.78)';
      const label = b.name.toUpperCase();
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = b.x + b.w / 2 - tw / 2 - 7;
      const ly = b.y + b.h - 24;
      ctx.fillRect(lx, ly, tw + 14, 19);
      ctx.fillStyle = '#ffd76e';
      ctx.textAlign = 'left';
      ctx.fillText(label, lx + 7, ly + 14);
    }
  }
  // Palms: a short trunk and a star of fronds.
  for (const palm of city.palms) {
    if (!inView(state, palm.x, palm.y, 40)) continue;
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + palm.x * 0.01;
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + Math.cos(a) * 17, palm.y + Math.sin(a) * 13);
    }
    ctx.stroke();
    ctx.fillStyle = '#795548';
    ctx.beginPath();
    ctx.arc(palm.x, palm.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#455a64';
  for (const lamp of city.lamps) {
    if (!inView(state, lamp.x, lamp.y, 12)) continue;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarker(ctx, state) {
  const objective = state.objective;
  if (!objective || objective.hideMarker) return;
  const pulse = 0.75 + Math.sin(state.time * 5) * 0.25;
  const x = objective.x;
  const y = objective.y;
  const grad = ctx.createLinearGradient(x, y - 190, x, y);
  grad.addColorStop(0, 'rgba(255, 180, 0, 0)');
  grad.addColorStop(1, `rgba(255, 180, 0, ${0.5 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - 13, y - 190, 26, 190);
  ctx.strokeStyle = PALETTE.marker;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 20 + Math.sin(state.time * 5) * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.moveTo(x, y - 44 - Math.sin(state.time * 5) * 5);
  ctx.lineTo(x - 10, y - 62 - Math.sin(state.time * 5) * 5);
  ctx.lineTo(x + 10, y - 62 - Math.sin(state.time * 5) * 5);
  ctx.closePath();
  ctx.fill();
}

function drawPickups(ctx, state) {
  for (const pickup of state.pickups) {
    if (!inView(state, pickup.x, pickup.y, 30)) continue;
    const bobY = Math.sin(pickup.bob) * 3;
    if (pickup.kind === 'cash') {
      ctx.fillStyle = '#2f9e44';
      ctx.fillRect(pickup.x - 10, pickup.y - 6 + bobY, 20, 12);
      ctx.fillStyle = '#b2f2bb';
      ctx.fillRect(pickup.x - 3, pickup.y - 6 + bobY, 6, 12);
    } else {
      ctx.fillStyle = '#343a40';
      ctx.fillRect(pickup.x - 9, pickup.y - 7 + bobY, 18, 14);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(pickup.x - 2, pickup.y - 7 + bobY, 4, 14);
    }
  }
}

function drawPerson(ctx, state, x, y, angle, shirt, skin, down) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 5, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (down) {
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(x, y, 15, 8, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15, 6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(x, y, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3, 6.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(ctx, state, car) {
  if (!inView(state, car.x, car.y, 90)) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(-24, -10, 56, 30);
  // Wheels.
  ctx.fillStyle = '#15181d';
  ctx.fillRect(-19, -17, 13, 6);
  ctx.fillRect(7, -17, 13, 6);
  ctx.fillRect(-19, 11, 13, 6);
  ctx.fillRect(7, 11, 13, 6);
  // Body.
  ctx.fillStyle = car.wrecked ? '#55504a' : car.color;
  roundRect(ctx, -27, -13.5, 54, 27, 7);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#eef1f5';
    ctx.fillRect(-8, -13.5, 17, 27);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(18, 26, 38, 0.88)';
  roundRect(ctx, -9, -10.5, 21, 21, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(140, 200, 235, 0.5)';
  ctx.fillRect(9, -9, 4, 18);
  ctx.fillRect(-13, -9, 3, 18);
  // Headlights.
  ctx.fillStyle = '#fff6bf';
  ctx.fillRect(25, -10, 3, 6);
  ctx.fillRect(25, 4, 3, 6);
  if (car.kind === 'police') {
    const phase = Math.floor(state.time * 6 + car.sirenPhase) % 2;
    ctx.fillStyle = phase === 0 ? PALETTE.lightRed : '#5a1616';
    ctx.fillRect(-6, -9, 6, 7);
    ctx.fillStyle = phase === 0 ? '#16305a' : PALETTE.lightBlue;
    ctx.fillRect(-6, 2, 6, 7);
  }
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(60, 60, 60, 0.35)';
    ctx.beginPath();
    ctx.arc(16, 0, 10 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFx(ctx, state) {
  for (const fx of state.fx) {
    const ratio = fx.life / fx.maxLife;
    if (fx.kind === 'tracer') {
      ctx.strokeStyle = `rgba(255, 230, 150, ${ratio})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(fx.x - (fx.vx ?? 0) * 0.03, fx.y - (fx.vy ?? 0) * 0.03);
      ctx.lineTo(fx.x, fx.y);
      ctx.stroke();
    } else if (fx.kind === 'hit') {
      ctx.fillStyle = `rgba(255, 90, 90, ${ratio})`;
      ctx.font = '900 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', fx.x, fx.y);
    } else if (fx.kind === 'spark') {
      ctx.fillStyle = `rgba(255, 190, 60, ${ratio})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 4 * ratio + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Paint the whole world for one frame; the HUD is hud.js's job, after this. */
export function drawWorld(ctx, state) {
  const cam = state.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, state);
  drawLots(ctx, state);
  drawBuildings(ctx, state);
  drawPickups(ctx, state);
  drawMarker(ctx, state);
  for (const car of state.cars) drawCar(ctx, state, car);
  for (const ped of state.peds) {
    if (inView(state, ped.x, ped.y, 30)) drawPerson(ctx, state, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, !ped.alive);
  }
  const player = state.player;
  if (!player.car) {
    drawPerson(ctx, state, player.x, player.y, player.angle, PALETTE.playerShirt, '#8a5a33', false);
    if (player.hasPistol) {
      ctx.strokeStyle = '#22252b';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8);
      ctx.lineTo(player.x + Math.cos(player.angle) * 19, player.y + Math.sin(player.angle) * 19);
      ctx.stroke();
    }
  }
  drawFx(ctx, state);
  ctx.restore();
  // Golden-hour wash over everything.
  const grad = ctx.createLinearGradient(0, 0, state.viewW, state.viewH);
  grad.addColorStop(0, 'rgba(255, 170, 60, 0.05)');
  grad.addColorStop(1, 'rgba(60, 30, 90, 0.07)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.viewW, state.viewH);
}
