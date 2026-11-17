# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/algifarri/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/algifarri/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solace Vice — Port Solace Stories.** An original open-world crime game in a
top-down 2D coastal city, built with plain web tech: no engine, no libraries,
no network. Port Solace is a full grid city — named shops, a park, parking
lots, the Neon Mile, Playa Brisa and the bay — that you explore on foot and
by car. Traffic drives the lanes and brakes for you; pedestrians stroll,
scatter and flee. Any car can be taken: walk up, press F, and it is yours —
including, unwisely, police cruisers. Crimes raise a five-star wanted level;
cruisers converge, box you in and bust you if they hold you, and the heat
only cools when no one can see you.

A four-mission story chains across the city — *First Wheels*, *Package Run*,
*Beach Debt* and *The Solace Score* — with dialogue, a timed delivery under
heat, a beach fight against two collectors, and a finale: steal the Turismo
GT, lose the police, park it at the hideout. Combat is fists or the pistol
Lucia gives you, with cash and ammo pickups; Brisa Arms sells shells. The
HUD carries money, health, wanted stars, weapon and objective with distance,
plus a live minimap with police blips. Busted and wasted cost fines and drop
you at the station or the hospital; progress saves to localStorage, and the
title screen offers Continue. Sound is synthesized WebAudio — engine, siren,
shots and a two-mode score — with zero audio files.

## Run it

```sh
node serve.ts   # then open http://localhost:8080 — or open game/index.html in a desktop browser
```

Controls: WASD walk & drive · F enter/exit car · mouse aim, click or J to
attack · E talk, accept and advance missions · Shift run · P/Esc pause.

The source is one responsibility per file under `game/src/` — `city.js` (the
generated city and its spatial queries), `vehicles.js`, `pedestrians.js`,
`police.js` (wanted system and pursuit), `combat.js`, `missions.js` (the
story as data plus a step engine), `render.js`, `hud.js`, `audio.js`,
`save.js`, wired together by `game.js` and booted by `main.js`.
Deterministic screenshot scenes live in `shots.js` (`?shot=drive|chase|
mission|title`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=ajkq5baq&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
