// Solace Vice — boot and the one loop. The canvas is a fixed 1280x720 stage
// the CSS stretches to the window; the world advances in fixed 1/60 s steps
// and the renderer paints world, HUD and screens each frame.
//
// ?shot=drive|chase|mission|title stages a screenshot scene instead of
// running the loop, paints it twice and sets window.__shotReady.
import { STEP, VIEW_H, VIEW_W } from './config.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { drawWorld } from './render.js';
import { drawDialogue, drawHud, drawScreens } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const game = createGame(seed);

function draw() {
  const state = game.state;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWorld(ctx, state);
  if (state.screen === 'play' || state.screen === 'paused') {
    drawHud(ctx, state);
    drawDialogue(ctx, state);
  }
  drawScreens(ctx, state);
}

if (shot) {
  stageShot(game, shot);
  let painted = 0;
  const paint = () => {
    draw();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  let accumulator = 0;
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      game.step(STEP, input);
      accumulator -= STEP;
    }
    draw();
  };
  requestAnimationFrame(frame);
}
