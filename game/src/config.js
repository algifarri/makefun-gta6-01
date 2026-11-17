// Solace Vice — tuning constants and the sun-soaked Port Solace palette.
// Every other module reads its numbers from here so the whole game stays
// balanced from one place: world size, the road grid, speeds, wanted heat,
// and the colours of a coastal city at golden hour.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;

export const WORLD_W = 3840;
export const WORLD_H = 2880;
export const ROAD_W = 128;
export const ROAD_XS = [0, 640, 1280, 1920, 2560, 3200];
export const ROAD_YS = [0, 576, 1152, 1728, 2304];
export const BEACH_X = 3520;
export const WATER_X = 3712;

export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  runSpeed: 242,
  maxHealth: 100,
  punchRange: 36,
  punchDamage: 34,
  shotDamage: 55,
  fireCooldown: 0.32,
};

export const CAR = {
  length: 54,
  width: 27,
  accel: 360,
  brake: 560,
  reverse: 140,
  drag: 0.85,
  trafficSpeed: 172,
  policeSpeed: 262,
  playerTopSpeed: 430,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 24,
  bustFillSeconds: 1.5,
  sightRange: 460,
};

export const PALETTE = {
  grass: '#7cb75a',
  grassDark: '#6cab4e',
  sand: '#eed491',
  water: '#2ea6c6',
  waterDeep: '#1d84ac',
  road: '#4b4b53',
  roadEdge: '#3a3a41',
  roadLine: '#f7d774',
  sidewalk: '#d3ccbe',
  plaza: '#e0d8c6',
  roofShadow: 'rgba(24, 26, 38, 0.30)',
  playerShirt: '#ffcf3f',
  playerSkin: '#8a5a33',
  policeBody: '#232c3f',
  lightRed: '#ff4747',
  lightBlue: '#4d8dff',
  marker: '#ffb400',
  hudPanel: 'rgba(10, 14, 22, 0.74)',
  hudText: '#f4f1e8',
  neonPink: '#ff4fa3',
  neonTeal: '#25e8d4',
  neonAmber: '#ffb400',
  money: '#7be495',
  health: '#ff5d5d',
};

export const CITY_NAME = 'Port Solace';
export const GAME_TITLE = 'SOLACE VICE';
export const SAVE_KEY = 'solace-vice-save-v1';
export const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
