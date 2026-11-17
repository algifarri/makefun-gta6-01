// Solace Vice — everything drawn over the world: the HUD (money, health,
// wanted stars, weapon), the mission objective banner, dialogue boxes, the
// minimap with its blips, and the full-screen panels (title, pause, busted,
// wasted, story complete). If it is read rather than walked on, it is here.
import { FONT, PALETTE, ROAD_W, ROAD_XS, ROAD_YS, WORLD_H, WORLD_W } from './config.js';
import { clamp, distance } from './random.js';
import { wantedStars } from './police.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function text(ctx, value, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

export function drawMinimap(ctx, state) {
  const w = 224;
  const h = 168;
  const x = state.viewW - w - 16;
  const y = state.viewH - h - 16;
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  panel(ctx, x - 4, y - 4, w + 8, h + 26);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#eed491';
  ctx.fillRect(x + 3520 * sx, y, (3712 - 3520) * sx, h);
  ctx.fillStyle = '#2ea6c6';
  ctx.fillRect(x + 3712 * sx, y, (WORLD_W - 3712) * sx, h);
  ctx.fillStyle = '#8f8f98';
  for (const rx of ROAD_XS) ctx.fillRect(x + rx * sx, y, ROAD_W * sx, h);
  for (const ry of ROAD_YS) ctx.fillRect(x, y + ry * sy, w, ROAD_W * sy);
  // Police blips flash; the objective pulses; the player is a white arrow.
  const flash = Math.floor(state.time * 2.4) % 2 === 0;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = flash ? '#ff4747' : '#4d8dff';
    ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  }
  const objective = state.objective;
  if (objective && !objective.hideMarker) {
    ctx.fillStyle = PALETTE.neonAmber;
    ctx.beginPath();
    ctx.arc(x + objective.x * sx, y + objective.y * sy, 3.4 + Math.sin(state.time * 5) * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  const focus = state.player.car ?? state.player;
  ctx.save();
  ctx.translate(x + focus.x * sx, y + focus.y * sy);
  ctx.rotate(focus.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'PORT SOLACE', x + w / 2, y + h + 17, 11, PALETTE.hudText, 'center', 600);
}

export function drawHud(ctx, state) {
  const player = state.player;
  // Money and health, top-left.
  panel(ctx, 16, 14, 218, 74);
  text(ctx, `$${player.money.toLocaleString('en-US')}`, 30, 46, 25, PALETTE.money);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(30, 58, 190, 13);
  ctx.fillStyle = player.health > 30 ? PALETTE.health : '#ff2222';
  ctx.fillRect(30, 58, 190 * clamp(player.health / 100, 0, 1), 13);
  text(ctx, 'HEALTH', 30, 84, 10, PALETTE.hudText, 'left', 600);

  // Wanted stars, top-right.
  const stars = wantedStars(state);
  if (stars > 0 || state.wanted.bust > 0) {
    panel(ctx, state.viewW - 216, 14, 200, 52);
    for (let i = 0; i < 5; i += 1) {
      text(ctx, '★', state.viewW - 196 + i * 38, 52, 30, i < stars ? PALETTE.neonAmber : 'rgba(255,255,255,0.22)', 'left', 900);
    }
    if (state.wanted.bust > 0 && !player.car) {
      ctx.fillStyle = '#ff4747';
      ctx.fillRect(state.viewW - 196, 58, 164 * clamp(state.wanted.bust, 0, 1), 5);
    }
  }

  // Weapon / fists, bottom-left.
  panel(ctx, 16, state.viewH - 52, 196, 38);
  text(ctx, player.car ? player.car.model.toUpperCase() : player.hasPistol ? `PISTOL · ${player.ammo}` : 'FISTS', 28, state.viewH - 27, 15, PALETTE.hudText);

  // Objective banner, top-centre, with distance and any mission timer.
  const objective = state.objective;
  if (objective && state.screen === 'play') {
    const focus = player.car ?? player;
    const dist = Math.round(distance(focus.x, focus.y, objective.x, objective.y) / 10);
    let label = objective.hideMarker ? objective.label : `${objective.label} · ${dist}m`;
    if (state.mission?.timerLeft != null) label += ` · ${Math.max(0, Math.ceil(state.mission.timerLeft))}s`;
    ctx.font = `700 16px ${FONT}`;
    const tw = ctx.measureText(label).width;
    panel(ctx, state.viewW / 2 - tw / 2 - 16, 14, tw + 32, 40);
    text(ctx, label, state.viewW / 2, 40, 16, PALETTE.neonAmber, 'center');
  }

  // Transient centre message (mission titles, pickups, warnings).
  if (state.message && state.time < state.message.until) {
    const fade = clamp((state.message.until - state.time) / 0.6, 0, 1);
    ctx.globalAlpha = fade;
    text(ctx, state.message.text, state.viewW / 2, 108, 24, '#ffffff', 'center', 900);
    ctx.globalAlpha = 1;
  }
  drawMinimap(ctx, state);
}

export function drawDialogue(ctx, state) {
  const dialogue = state.dialogue;
  if (!dialogue) return;
  const [speaker, line] = dialogue.lines[dialogue.index];
  const x = 190;
  const y = state.viewH - 148;
  const w = state.viewW - 380;
  panel(ctx, x, y, w, 108);
  text(ctx, speaker.toUpperCase(), x + 22, y + 32, 14, PALETTE.neonTeal, 'left', 900);
  ctx.font = `500 19px ${FONT}`;
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'left';
  wrapText(ctx, line, x + 22, y + 62, w - 44, 24);
  text(ctx, 'E ▸', x + w - 34, y + 92, 14, PALETTE.neonAmber, 'right', 900);
}

function wrapText(ctx, value, x, y, maxWidth, lineHeight) {
  const words = value.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, ly);
      line = word;
      ly += lineHeight;
    } else line = trial;
  }
  if (line) ctx.fillText(line, x, ly);
}

function bigPanel(ctx, state, title, titleColor, lines, prompt) {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
  ctx.fillRect(0, 0, state.viewW, state.viewH);
  text(ctx, title, state.viewW / 2, 218, 74, titleColor, 'center', 900);
  let y = 268;
  for (const line of lines) {
    text(ctx, line, state.viewW / 2, y, 19, PALETTE.hudText, 'center', 500);
    y += 28;
  }
  if (prompt) text(ctx, prompt, state.viewW / 2, y + 22, 20, PALETTE.neonAmber, 'center', 800);
}

export function drawScreens(ctx, state) {
  if (state.screen === 'title') {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.42)';
    ctx.fillRect(0, 0, state.viewW, state.viewH);
    text(ctx, 'SOLACE', state.viewW / 2, 168, 96, '#ffffff', 'center', 900);
    text(ctx, 'VICE', state.viewW / 2, 252, 96, PALETTE.neonPink, 'center', 900);
    text(ctx, '— Port Solace Stories —', state.viewW / 2, 292, 20, PALETTE.neonTeal, 'center', 600);
    const menu = state.hasSave ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
    menu.forEach((item, i) => {
      const selected = state.titleChoice === i;
      text(ctx, `${selected ? '▸ ' : ''}${item}`, state.viewW / 2, 356 + i * 38, 24, selected ? PALETTE.neonAmber : PALETTE.hudText, 'center', 800);
    });
    text(ctx, 'WASD drive & walk · F enter car · mouse aim, click attack · E talk & missions · Shift run · P pause', state.viewW / 2, 470, 15, 'rgba(244, 241, 232, 0.8)', 'center', 500);
    text(ctx, 'An original open-world crime game. Every name, street and story in Port Solace is its own.', state.viewW / 2, 660, 13, 'rgba(244, 241, 232, 0.55)', 'center', 500);
  } else if (state.screen === 'paused') {
    bigPanel(ctx, state, 'PAUSED', '#ffffff', ['Port Solace waits for no one. Except now.'], 'P or Esc to resume');
  } else if (state.screen === 'busted') {
    bigPanel(ctx, state, 'BUSTED', PALETTE.lightBlue, ['The Port Solace PD walks you out of the station,', `$${state.lastFine} lighter and considerably wiser.`], 'Press Enter to carry on');
  } else if (state.screen === 'wasted') {
    bigPanel(ctx, state, 'WASTED', PALETTE.health, ['St. Solace General patches you up.', `The bill: $${state.lastFine}. The bay keeps your secrets.`], 'Press Enter to carry on');
  } else if (state.screen === 'storydone') {
    bigPanel(ctx, state, 'PORT SOLACE IS YOURS', PALETTE.neonAmber, ['The Solace Score is settled and Lucia’s café is safe.', 'Free roam: the city, its cars and its police remain.'], 'Press Enter to keep roaming');
  }
}
