// Solace Vice — the save game. Progress (money, story position, the pistol,
// where Reyes stands) is kept in this browser's local storage, so the title
// screen can offer Continue. Nothing leaves the machine.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const player = state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: player.money,
      nextMission: state.story.nextMission,
      storyDone: state.story.done,
      hasPistol: player.hasPistol,
      ammo: player.ammo,
      x: Math.round(player.x),
      y: Math.round(player.y),
    }));
  } catch {
    // Storage can be unavailable (private windows): the run simply isn't kept.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
