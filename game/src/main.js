// AURELIA DELTA — main: game state, player movement (foot / car / boat),
// the drawbridge jump, enter / steal / board, state machine, game loop.
import * as THREE from 'three';
import { GAME_TITLE, MAP, VEHICLES, WEAPONS, RADIO, START_MONEY, TIDE_PERIOD } from './config.js';
import { RNG } from './random.js';
import { buildCity, updateCity, setBridgeAngle, districtAt } from './city.js';
import { Car, driveCar, spawnTraffic, updateTraffic, nearestCar } from './vehicles.js';
import { Boat, driveBoat, spawnBoats, nearestBoat } from './boats.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { initPolice, updatePolice, setWanted } from './police.js';
import { initMissions, startMission, updateMissions, currentStage, spawnGuards } from './missions.js';
import { initCombat, shoot, melee, updateCombat, renderGuards } from './combat.js';
import { buildHUD, updateHUD, say, floatText, locationCard } from './hud.js';
import { initAudio, updateAudio, unlockAudio, sfx } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { initRenderer, updateCamera, shotCamera } from './render.js';
import { initInput, pressedKeys } from './input.js';
import { stageShot, autopilotStep } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 1);
const SHOT = params.get('shot');
const AUTOPILOT = params.get('autopilot') === '1';
const FF = Math.max(1, Math.min(20, Number(params.get('ff') || 1)));

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const G = {
  seed: SEED, mode: 'title', time: { t: 0, day: 1 },
  player: null, traffic: [], boats: [], peds: [],
  city: null, police: null, missions: null, combat: null, hud: null, audio: null,
  input: null, scene: null, camera: null, renderer: null,
  autopilot: AUTOPILOT, ff: FF, shotFrozen: false, shotCam: null,
  radio: { station: 0 },
  hudFns: { say, floatText, locationCard },
};
window.__game = G;

function makePlayer() {
  return {
    pos: new THREE.Vector3(-40, 0, 8),
    heading: 0, speed: 0, mode: 'foot',
    vehicle: null, boat: null,
    health: 100, armour: 0, money: START_MONEY, rep: 0, wanted: 0,
    weapon: 0, ammo: [0, 12, 32, 6], reserve: [0, 48, 128, 18],
    nitro: 100, onFootMesh: null,
  };
}

function makeFootMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xd21f2b });
  const legs = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.65; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), legs);
  legL.position.set(-0.14, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), shirt);
  armL.position.set(-0.38, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.38; g.add(armR);
  return g;
}

// ---- vehicle enter / exit ----
G.enterCar = function (car, stolen) {
  const p = G.player;
  if (p.mode === 'car' && p.vehicle === car) return;
  if (p.mode === 'boat') G.exitBoat();
  // remove from traffic/police lists so it is not driven twice
  G.traffic = G.traffic.filter((c) => c !== car);
  G.police.cars = G.police.cars.filter((c) => c !== car);
  p.vehicle = car; p.mode = 'car'; p.speed = car.speed;
  p.pos.copy(car.pos); p.heading = car.heading;
  if (stolen && !car.stolen) {
    car.stolen = true;
    setWanted(G, Math.min(5, G.police.wanted + 1));
    floatText(G, 'VEHICLE STOLEN: ' + car.def.name);
  }
  if (p.onFootMesh) p.onFootMesh.visible = false;
  sfx(G, 'pickup');
};

G.exitCar = function () {
  const p = G.player;
  if (p.mode !== 'car' || !p.vehicle) return;
  const car = p.vehicle;
  car.speed = 0;
  p.pos.set(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 2.5, 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.5);
  p.heading = car.heading;
  p.vehicle = null; p.mode = 'foot'; p.speed = 0;
  if (p.onFootMesh) { p.onFootMesh.visible = true; p.onFootMesh.position.copy(p.pos); }
};

G.boardBoat = function (boat) {
  const p = G.player;
  if (p.mode === 'car') G.exitCar();
  p.boat = boat; p.mode = 'boat'; p.speed = boat.speed;
  p.pos.copy(boat.pos); p.heading = boat.heading;
  if (p.onFootMesh) p.onFootMesh.visible = false;
  floatText(G, 'DELTA SKIFF — take the wheel');
};

G.exitBoat = function () {
  const p = G.player;
  if (p.mode !== 'boat' || !p.boat) return;
  p.pos.set(24, 0, 225);
  p.boat = null; p.mode = 'foot'; p.speed = 0;
  if (p.onFootMesh) { p.onFootMesh.visible = true; p.onFootMesh.position.copy(p.pos); }
};

G.startNewGame = function () {
  const p = G.player;
  p.health = 100; p.armour = 0; p.money = START_MONEY; p.rep = 0;
  p.pos.set(-40, 0, 8); p.heading = 0; p.mode = 'foot'; p.vehicle = null; p.boat = null;
  p.weapon = 0;
  initMissions(G);
  G.missions.completed = 0;
  setWanted(G, 0);
  startMission(G, 0);
  G.mode = 'play';
  unlockAudio(G);
  locationCard(G, 'Fishmarket');
};

// ---- bridge jump ----
function bridgeHeightAt(z, angle) {
  if (z <= 180) return (z - 160) * Math.sin(angle);
  return (200 - z) * Math.sin(angle);
}

function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.vehicle;
  if (!car) return;
  const inp = G.input;
  const onBridge = Math.abs(car.pos.x) < 14 && car.pos.z > 148 && car.pos.z < 212;
  const angle = G.city.bridge.angle;
  if (car.airborne) {
    // ballistic flight over the gap
    car.vy -= 22 * dt;
    car.pos.y += car.vy * dt;
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.x = -0.12;
    if (car.pos.z >= 183) {
      const landY = 1 + bridgeHeightAt(car.pos.z, angle);
      if (car.pos.y <= landY) {
        car.airborne = false;
        car.pos.y = landY;
        car.speed *= 0.85;
        car.mesh.rotation.x = 0;
        floatText(G, 'BRIDGE JUMP!');
      }
    } else if (car.pos.y < -0.5) {
      splashRespawn(G, 'The car sank in the canal.');
    }
    car.updateMesh();
    p.pos.copy(car.pos); p.heading = car.heading; p.speed = car.speed;
    return;
  }
  driveCar(car, inp, dt);
  p.pos.copy(car.pos); p.heading = car.heading; p.speed = car.speed;
  if (onBridge) {
    if (angle > 0.05) {
      // riding a raised leaf: follow its slope
      car.pos.y = 1 + bridgeHeightAt(car.pos.z, angle);
      // launch off the south leaf tip when fast enough
      if (car.pos.z >= 177 && car.pos.z < 183 && car.speed >= 16) {
        car.airborne = true;
        car.vy = car.speed * Math.sin(angle) * 0.8 + 1.5;
      } else if (car.pos.z >= 178 && car.speed < 16) {
        // too slow: falls into the gap
        car.airborne = true;
        car.vy = 0;
      }
    } else {
      car.pos.y = 1;
    }
  } else {
    car.pos.y = 0;
    // drove into the water off the bridge road?
    if (car.pos.z > 205) splashRespawn(G, 'The car sank in the delta.');
  }
  car.updateMesh();
}

function splashRespawn(G, text) {
  const p = G.player;
  p.health = Math.max(10, p.health - 10);
  if (p.vehicle) {
    const car = p.vehicle;
    car.airborne = false; car.speed = 0;
    car.pos.set(0, 0, 140); car.heading = 0;
    car.updateMesh();
    p.pos.copy(car.pos); p.heading = 0; p.speed = 0;
  }
  floatText(G, text);
}

// ---- on-foot movement ----
function updatePlayerFoot(G, dt) {
  const p = G.player;
  const inp = G.input;
  const turn = ((inp.left ? 1 : 0) - (inp.right ? 1 : 0)) * 2.6 * dt;
  p.heading += turn;
  const run = inp.handbrake ? 9 : 5.5;
  const fwd = (inp.forward ? 1 : 0) - (inp.back ? 0.6 : 0);
  p.speed = fwd * run;
  p.pos.x += Math.sin(p.heading) * p.speed * dt;
  p.pos.z += Math.cos(p.heading) * p.speed * dt;
  // on foot the player cannot wade into the canal — except on the
  // drawbridge road (|x| < 13), where the deck carries them across.
  const onBridgeRoad = Math.abs(p.pos.x) < 13;
  p.pos.x = Math.max(-MAP.half + 4, Math.min(MAP.half - 4, p.pos.x));
  p.pos.z = Math.max(-MAP.half + 4, Math.min(onBridgeRoad ? 240 : 158, p.pos.z));
  if (p.onFootMesh) {
    p.onFootMesh.position.copy(p.pos);
    p.onFootMesh.rotation.y = p.heading;
    // stand on the bridge deck when crossing it
    const onDeck = Math.abs(p.pos.x) < 14 && p.pos.z > 150 && p.pos.z < 210;
    p.onFootMesh.position.y = (onDeck ? 1 : 0) + Math.abs(Math.sin(G.time.t * 9)) * 0.05;
  }
}

// ---- main loop ----
let last = performance.now();
let nearMissCd = 0;
let driftBank = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let rawDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const dt = rawDt * (G.autopilot ? G.ff : 1);
  const p = G.player;
  if (G.mode === 'play' && !G.shotFrozen) {
    // bridge schedule: raises for the finale and on a slow cycle
    const job = G.missions.index;
    const wantUp = job === 7 || (G.time.t % 120) > 90;
    G.city.bridge.target = wantUp ? 0.35 : 0;
    updateCity(G, dt);
    // autopilot drives the mission
    if (G.autopilot) autopilotStep(G, dt);
    // manual input: interact / weapons / radio / pause
    const keys = pressedKeys(G);
    for (const k of keys) {
      if (k === 'KeyF' && !G.autopilot) tryInteract(G);
      if (k === 'Digit1') p.weapon = 0;
      if (k === 'Digit2') p.weapon = 1;
      if (k === 'Digit3') p.weapon = 2;
      if (k === 'Digit4') p.weapon = 3;
      if (k === 'KeyN') { G.audio.setStation(G.radio.station + 1); sfx(G, 'jingle'); }
      if (k === 'KeyR' && G.mode === 'play') reloadWeapon(G);
      if (k === 'Escape') G.mode = 'pause';
      if (k === 'KeyM') G.hud.location(districtAt(p.pos.x, p.pos.z));
    }
    if (G.mode === 'pause') {
      const k2 = pressedKeys(G);
      if (k2.includes('Escape')) G.mode = 'play';
    }
    // shooting
    if (G.input.shoot && p.mode !== 'boat') {
      if (p.weapon === 0) melee(G);
      else shoot(G);
    }
    // movement by mode
    if (p.mode === 'car') updatePlayerCar(G, dt);
    else if (p.mode === 'boat') {
      driveBoat(p.boat, G.input, dt, G);
      p.pos.copy(p.boat.pos); p.heading = p.boat.heading; p.speed = p.boat.speed;
    } else updatePlayerFoot(G, dt);
    // drift + near-miss scoring
    nearMissCd -= dt;
    if (p.mode === 'car' && p.vehicle) {
      if (p.vehicle.drift > 0.5 && Math.abs(p.vehicle.speed) > 15) {
        driftBank += dt * 60;
      } else if (driftBank > 50) {
        const gain = Math.round(driftBank);
        p.money += gain;
        floatText(G, 'DRIFT x3 +$' + gain);
        driftBank = 0;
      }
      for (const t of G.traffic) {
        const d = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
        if (d < 3.5 && Math.abs(p.vehicle.speed) > 20 && nearMissCd <= 0) {
          p.money += 250;
          floatText(G, 'NEAR MISS +$250');
          nearMissCd = 3;
        }
      }
    }
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    // slow health regen when not recently damaged (GTA-like)
    if (p.health < (p._lastHealth ?? p.health)) p.lastDamageT = G.time.t;
    p._lastHealth = p.health;
    if (p.health > 0 && p.health < 100 && G.time.t - (p.lastDamageT ?? -999) > 6) {
      p.health = Math.min(100, p.health + 3 * dt);
    }
    updateMissions(G, dt);
    renderGuards(G);
    updateCombat(G, dt);
    updateAudio(G, dt);
    // district change card
    const d = districtAt(p.pos.x, p.pos.z);
    if (d !== G._district) {
      G._district = d;
      if (G.mode === 'play') locationCard(G, d);
    }
    // mission 5 guards spawn on stage 2
    if (G.missions.index === 4 && G.missions.stage === 1 && G.missions.guards.length === 0) {
      spawnGuards(G);
    }
    // autosave on mission complete
    if (G.missions.completed !== G._savedMissions) {
      G._savedMissions = G.missions.completed;
      saveGame(G);
    }
  } else if (G.mode === 'title') {
    updateCity(G, rawDt);
    // slow orbit over the skyline
    const a = G.time.t * 0.03;
    G.camera.position.set(Math.sin(a) * 220, 60, Math.cos(a) * 220 - 40);
    G.camera.lookAt(0, 8, 40);
    G.time.t += rawDt;
  } else if (G.mode === 'wasted') {
    const keys = pressedKeys(G);
    if (keys.includes('Enter')) {
      p.health = 100; p.armour = 50;
      p.pos.set(-40, 0, 8); p.mode = 'foot'; p.vehicle = null;
      startMission(G, G.missions.index);
      G.mode = 'play';
    }
  }
  // camera
  if (G.shotCam) shotCamera(G, G.shotCam.pos, G.shotCam.look);
  else if (G.mode !== 'title') updateCamera(G, rawDt);
  updateHUD(G, rawDt);
  G.renderer.render(G.scene, G.camera);
}

function tryInteract(G) {
  const p = G.player;
  if (p.mode === 'foot') {
    const car = nearestCar(G, p.pos.x, p.pos.z, 6);
    if (car) { G.enterCar(car, true); return; }
    const boat = nearestBoat(G, p.pos.x, p.pos.z, 8);
    if (boat) { G.boardBoat(boat); return; }
  } else if (p.mode === 'car') {
    G.exitCar();
  } else if (p.mode === 'boat') {
    G.exitBoat();
  }
}

function reloadWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (!w || w.mag === 0) return;
  const need = w.mag - p.ammo[p.weapon];
  const take = Math.min(need, p.reserve[p.weapon]);
  if (take > 0) { p.reserve[p.weapon] -= take; p.ammo[p.weapon] += take; }
}

// ---- boot ----
function boot() {
  initRenderer(G);
  G.player = makePlayer();
  G.player.onFootMesh = makeFootMesh();
  G.scene.add(G.player.onFootMesh);
  buildCity(G);
  initPolice(G);
  initMissions(G);
  initCombat(G);
  initAudio(G);
  initInput(G);
  buildHUD(G);
  spawnTraffic(G);
  spawnBoats(G);
  spawnPeds(G);
  // a parked MERAK GT near the Fishmarket for mission 1
  const hero = new Car(VEHICLES[0], -34, 14, Math.PI / 2);
  G.scene.add(hero.mesh);
  G.traffic.push(hero);
  // a KOMODO truck at the docks for mission 3
  const truck = new Car(VEHICLES[3], -220, 100, 0);
  G.scene.add(truck.mesh);
  G.traffic.push(truck);
  G.camera.position.set(0, 60, -120);
  if (SHOT) {
    // staged screenshot: start the game state, then freeze it for the shot
    if (SHOT === 'start') {
      G.mode = 'title';
    } else {
      G.startNewGame();
      // let the world settle a couple of frames, then stage
      setTimeout(() => stageShot(G, SHOT), 300);
    }
  } else if (AUTOPILOT) {
    G.startNewGame();
  }
  document.getElementById('game').addEventListener('click', () => unlockAudio(G));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && G.mode === 'title') G.startNewGame();
  });
  requestAnimationFrame(frame);
}

boot();
