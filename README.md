[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/syahruldyh/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/syahruldyh/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [make.fun bounty](https://make.fun/bounty/gta6-01).

# AURELIA DELTA

An original open-world crime game in **Port Aurelia**, a river-delta port city.
You are **Mara Vela, 27**, a getaway driver and ex-harbour pilot, framed by
Kapten Harun of the APD. Run **8 jobs** for Ibu Ratna's crew, from FIRST LIGHT
to the finale VANISHING POINT: jump the rising drawbridge, take the boat, and
vanish into the delta.

## What is in the game

- **A city on foot and by car** — 8 named districts (The Docks, Canal Row,
  Fishmarket, Old Customs, Drawbridge Quarter, The Spit, Crane Yard, Aurelia
  Heights), a road grid, a beach, and a river delta.
- **Traffic and pedestrians** — cars follow road loops and brake for you;
  pedestrians stroll the sidewalks and flee from danger.
- **Cars to steal** — press F near a parked car. Stealing one raises your
  wanted level and shows `VEHICLE STOLEN: <name>`.
- **Wanted 1–5 + the APD** — named units (HERON-2, MERAK-5, ELANG-7…) pursue,
  ram and roadblock. At 3 stars the AIR-1 helicopter joins with a searchlight;
  at 4 stars a police boat works the river. Get busted on foot or wasted at
  0 health and you lose $200.
- **8 jobs, one story** — a single mission chain with stages, timers, dialog
  and rewards. Every job is completable; the autopilot in `shots.js` proves it.
- **Combat** — FISTS, PISTOL, SMG, SHOTGUN (1–4 to switch, R to reload).
- **HUD + minimap** — mission panel, wanted stars, money, day/time, a big
  TIDE label, a round district minimap, health/armour, rep, vehicle + nitro +
  speedometer, radio, and floating DRIFT / NEAR MISS scores.
- **Start screen + save** — CONTINUE / NEW GAME / MISSIONS / GARAGE, autosave
  after every job (localStorage).
- **Radio** — 4 stations (DELTA 88.1, WAVE 104.2, K-SUN 91.7, CORAL 89.5),
  all synthesised with WebAudio. N for the next station.
- **Three systems no other entry has** — a drivable boat, a rising
  drawbridge you can jump, and a **TIDE** system: the water rises and falls
  on a 4-minute cycle and opens or closes the shallow delta routes.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Drive / walk |
| Mouse | Look (on foot) |
| SPACE | Handbrake (drift) |
| SHIFT | Nitro |
| F | Enter / steal car, board boat, exit |
| E | Interact (pick up) |
| CLICK | Shoot (on foot) |
| 1–4 | Weapons · R reload |
| N | Next radio station · M mute |
| ESC | Pause |

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

No build step, no network request: three.js is vendored under
`game/vendor/three.min.js`, all textures are drawn in code, all audio is
synthesised. Screenshots are staged deterministically with
`?shot=cover|onfoot|start|boat&seed=1` (see `game/src/shots.js`).

## Files

- `game/index.html` — page + import map + HUD mount
- `game/vendor/three.min.js` — three.js r170, vendored (not our code)
- `game/src/config.js` — world data: districts, vehicles, weapons, jobs
- `game/src/random.js` — seeded RNG
- `game/src/city.js` — procedural Port Aurelia + the drawbridge
- `game/src/vehicles.js` — cars, arcade physics, traffic AI
- `game/src/boats.js` — boats + the TIDE system
- `game/src/pedestrians.js` — pedestrians
- `game/src/police.js` — wanted levels + APD + helicopter + police boat
- `game/src/missions.js` — the 8-job chain
- `game/src/combat.js` — weapons + foes
- `game/src/hud.js` — HUD + minimap
- `game/src/audio.js` — WebAudio synth (engine, siren, radio)
- `game/src/save.js` — localStorage save
- `game/src/render.js` — renderer, golden-hour sky, chase cam, quality tiers
- `game/src/input.js` — keyboard + mouse
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/main.js` — game loop + state machine + autopilot
- `main.ts` — hands the game in (copies game/ + screenshots/, writes dossier.json)
- `serve.ts` — local static server

All art is original and procedural. No Rockstar / GTA content, no borrowed
assets. Built fresh in-session for the make.fun gta6-01 bounty.
