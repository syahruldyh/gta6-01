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
- **Steal cars** (F) — "VEHICLE STOLEN" raises your wanted level.
- **Wanted 1–5 stars** — named APD units (HERON-2, MERAK-5, ELANG-7, GULL-3,
  TIDE-1, KUNTUL-4) pursue, ram and roadblock you; the AIR-1 helicopter
  (wanted 3+) and a police boat (wanted 4+) join the hunt.
- **8 story jobs** — one mission chain with stages, objectives, timers and
  dialog from Sinta, Ibu Ratna, Doni and Kapten Harun.
- **Combat** — fists, pistol, SMG, shotgun, with ammo and reload.
- **A drivable boat** on the canal and the delta, and a **TIDE system** —
  the water rises and falls on a slow cycle and the HUD shows it.
- **The Aurelia Drawbridge** — it rises on a schedule and in the finale;
  cross it fast and jump the gap.
- **HUD + minimap** — mission panel, APD response panel, stars, money,
  day/time, tide, health/armour/rep, weapon slots, vehicle + speed, radio.
- **Radio** — 4 stations (DELTA 88.1, WAVE 104, K-SUN 91.7, CORAL FM),
  all WebAudio synth, no audio files.
- **Start screen + save** — title, NEW GAME / CONTINUE, autosave to
  localStorage, pause and game-over screens.

## Controls

WASD drive / walk · SPACE handbrake · F enter / steal car / board boat ·
E interact · CLICK shoot · 1–4 weapons · R reload · N radio · M map ·
ESC pause · ENTER start / retry.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: three.js is vendored under `game/vendor/`,
all textures are procedural, all audio is WebAudio synth.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
