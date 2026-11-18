// AURELIA DELTA — the game itself. State machine (title / car / foot / boat /
// pause / busted / wasted / complete), the on-foot player, stealing cars,
// the mission flow, wanted + police, drift / near-miss scoring, the bridge
// schedule, the autopilot (used by shots.js to prove every job is doable),
// and the shot mode (?shot=cover|onfoot|start|boat&seed=1).
import * as THREE from 'three';
import { CFG, clamp, lerp, dist2, districtAt } from './config.js';
import { mulberry32, range } from './random.js';
import { buildCity } from './city.js';
import { createRenderer, createSky, createLights, ChaseCam, Quality, resizeRenderer } from './render.js';
import { Car, Traffic, collideCars } from './vehicles.js';
import { Boat, Tide } from './boats.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { loadSave, writeSave, clearSave, freshState } from './save.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10);
const AUTOPILOT = params.get('autopilot') === '1';
// Fast-forward (autopilot only, a test tool): run N update steps per frame
// so the mission chain can be proven in minutes on a slow software renderer.
const FF = AUTOPILOT ? Math.max(1, Math.min(12, parseInt(params.get('ff') || '6', 10))) : 1;

function buildPlayerMesh() {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), mat(0xd21f2b));
  torso.position.y = 0.92; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), mat(0xd9a986));
  head.position.y = 1.5; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 10, 8, 0, Math.PI * 2, 0, 1.4), mat(0x1c1410));
  hair.position.y = 1.54; g.add(hair);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.55, 0.2), mat(0x2c343c));
    leg.position.set(s * 0.14, 0.28, 0); leg.castShadow = true; g.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.16), mat(0xd21f2b));
    arm.position.set(s * 0.36, 0.92, 0); arm.castShadow = true; g.add(arm);
  }
  return g;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = createRenderer(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 2000);
    createSky(this.scene);
    this.lights = createLights(this.scene);
    this.city = buildCity(this.scene);
    this.tide = new Tide(this.city.water);
    this.rng = mulberry32(SEED * 7919 + 13);
    this.traffic = new Traffic(this.scene, this.rng, this.city.groundHeight);
    this.peds = new Pedestrians(this.scene, this.rng, this.city.groundHeight);
    this.police = new Police(this.scene, this.rng, this.city.groundHeight, this.city.isWater);
    this.missions = new Missions();
    this.combat = new Combat(this.scene);
    this.hud = new HUD(document.body);
    this.audio = new AudioSys();
    this.input = new Input(this.canvas);
    this.chase = new ChaseCam(this.camera);
    this.quality = new Quality(this.renderer);
    this.state = { ...(loadSave() || freshState()) };
    this.mode = 'title';
    this.frozen = false;
    this.shotCam = null;
    this.shotName = null;
    this.frame = 0;
    this.time = 0;
    this.day = 1;
    this.timeMin = 18 * 60 + 12;
    this.bridgeT = 0;
    this.bridgeRaised = false;
    this.nearMissT = 0;
    this.autopilot = AUTOPILOT;
    this.apStuckT = 0;
    this.apReverseT = 0;
    this.apLeg = 0;
    // The player: on foot, in the red MERAK GT, or in the boat.
    this.playerMesh = buildPlayerMesh();
    this.scene.add(this.playerMesh);
    this.playerPos = new THREE.Vector3(-20, 0, 150);
    this.playerHeading = 0;
    this.playerSpeed = 0;
    this.playerCar = new Car({ ...CFG.vehicles.merak }, -20, 150, 0);
    this.scene.add(this.playerCar.mesh);
    this.playerBoat = new Boat(this.scene, 224, 120, Math.PI, 0xe8e8e8);
    this.playerBoat.mesh.visible = false;
    // Parked stealable cars around the city (job targets + free roam).
    this.parked = [];
    const parkedDefs = [
      ['merak', -160, 60], ['komodo', 300, -60], ['elang', 60, -100],
      ['kancil', -100, 140], ['merak', 150, 0], ['elang', -180, -180],
    ];
    for (const [key, x, z] of parkedDefs) {
      const c = new Car({ ...CFG.vehicles[key] }, x, z, this.rng() * 6.28);
      c.parked = true;
      this.scene.add(c.mesh);
      this.parked.push(c);
    }
    // Mission beacon: a floating diamond over the current stage target.
    const beaconGeo = new THREE.OctahedronGeometry(1.6);
    this.beacon = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xffd970, transparent: true, opacity: 0.9 }));
    this.scene.add(this.beacon);
    const beamGeo = new THREE.CylinderGeometry(0.5, 1.6, 60, 8, 1, true);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffd970, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    this.scene.add(this.beam);
    this.missions.startJob(this.state.jobIndex);
    this.police.set(this.missions.job ? this.missions.job.wanted : 0);
    this.bindInput();
    this.showTitle();
    resizeRenderer(this.renderer, this.camera);
    window.addEventListener('resize', () => resizeRenderer(this.renderer, this.camera));
    if (SHOT) {
      // Shot mode: stage the scene, freeze the sim, signal readiness.
      this.mode = 'title';
      setTimeout(() => {
        stageShot(this, SHOT);
        this.hud.hideScreen();
        if (SHOT === 'start') this.showTitle();
        this.frame = 0;
        if (SHOT !== 'start') {
          // One live frame so the HUD fills with the staged values (job,
          // money, wanted, tide, minimap), then freeze + show the HUD.
          this.frozen = false;
          this.update(0.016);
          this.frozen = true;
          this.hud.setHudVisible(true);
        }
      }, 350);
    }
  }
  bindInput() {
    this.input.onKey = (code, down) => {
      if (!down) return;
      this.audio.ensure();
      if (code === 'Escape') {
        if (this.mode === 'pause') { this.mode = this.prevMode || 'car'; this.hud.hideScreen(); }
        else if (this.mode !== 'title') { this.prevMode = this.mode; this.mode = 'pause'; this.showPause(); }
        return;
      }
      if (this.mode === 'title' || this.mode === 'pause' || this.mode === 'busted' || this.mode === 'wasted' || this.mode === 'complete') return;
      if (code === 'KeyF') this.tryEnterExit();
      if (code === 'KeyE') this.tryInteract();
      if (code === 'KeyR') this.combat.reload();
      if (code === 'KeyN') { const st = this.audio.nextStation(); this.hud.setToast(st.name + ' — ' + st.song); }
      if (code === 'KeyM') this.audio.setMuted(!this.audio.muted);
      if (code.startsWith('Digit')) {
        const n = parseInt(code.slice(5), 10);
        if (n >= 1 && n <= 4) this.combat.select(n - 1);
      }
    };
    this.input.onClick = () => {
      this.audio.ensure();
      if (this.mode === 'foot') this.shoot();
    };
  }
  // --- screens ---
  showTitle() {
    const save = loadSave();
    const mainBtn = save
      ? `<button class="btn" onclick="window.__game.startGame(true)">CONTINUE</button>
      <button class="btn alt" onclick="window.__game.newGame()">NEW GAME</button>`
      : `<button class="btn" onclick="window.__game.startGame(false)">NEW GAME</button>`;
    this.hud.setHudVisible(false);
    this.hud.showScreen(`
      <div class="tag">PORT AURELIA · RIVER-DELTA PORT CITY</div>
      <h1>AURELIA DELTA</h1>
      <h2>8 jobs. 5-star police. Boats &amp; bridges. One getaway driver: Mara Vela.</h2>
      ${mainBtn}
      <button class="btn alt" onclick="window.__game.showMissions()">MISSIONS</button>
      <button class="btn alt" onclick="window.__game.showGarage()">GARAGE</button>
      <div class="fine">WASD drive / walk · F enter / steal car · E interact · CLICK shoot · SHIFT nitro · N radio<br>An original open-world crime game. No Rockstar content. All art procedural.</div>`);
  }
  showPause() {
    this.hud.setHudVisible(false);
    this.hud.showScreen(`
      <h1 style="font-size:34px">PAUSED</h1>
      <h2>${this.missions.label()} — ${this.missions.stage ? this.missions.stage.text : ''}</h2>
      <button class="btn" onclick="window.__game.resume()">RESUME</button>
      <button class="btn alt" onclick="window.__game.toTitle()">QUIT TO TITLE</button>
      <div class="fine">Progress autosaves after every job.</div>`);
  }
  showMissions() {
    const rows = CFG.jobs.map((j, i) => `<div style="font-size:13px;margin:3px">${i + 1}. ${j.title} — ${j.brief} <span style="color:#ffd970">$${j.reward}</span></div>`).join('');
    this.hud.showScreen(`<h1 style="font-size:30px">MISSIONS</h1><div style="text-align:left;max-width:520px">${rows}</div><button class="btn alt" onclick="window.__game.showTitle()">BACK</button>`);
  }
  showGarage() {
    this.hud.showScreen(`<h1 style="font-size:30px">GARAGE</h1><h2>MERAK GT — condition ${Math.round(this.playerCar.condition)}% · nitro ${Math.round(this.playerCar.nitro)}%<br>Repairs are free at the safehouse. Paint: Aurelia Red.</h2><button class="btn alt" onclick="window.__game.showTitle()">BACK</button>`);
  }
  startGame(useSave) {
    if (!useSave) { this.state = freshState(); clearSave(); }
    this.missions.startJob(this.state.jobIndex);
    this.police.set(this.missions.job.wanted);
    this.hud.hideScreen();
    this.hud.setHudVisible(true);
    this.setMode(this.playerCar ? 'car' : 'foot');
    this.chase.snap(this.playerCar.pos, this.playerCar.heading, 'car');
  }
  newGame() { this.state = freshState(); clearSave(); this.startGame(false); }
  resume() { this.mode = this.prevMode || 'car'; this.hud.hideScreen(); this.hud.setHudVisible(true); }
  toTitle() { this.mode = 'title'; this.showTitle(); }
  setMode(m) {
    this.mode = m;
    this.playerMesh.visible = m === 'foot';
    this.playerCar.mesh.visible = m !== 'foot' || true;
    if (m === 'foot') this.playerCar.mesh.visible = true; // the car stays parked
    if (m === 'boat') this.playerBoat.mesh.visible = true;
  }
  // --- interactions ---
  nearestParked(maxD = 6) {
    let best = null, bd = maxD * maxD;
    for (const c of this.parked) {
      const d2 = dist2(this.playerPos.x, this.playerPos.z, c.pos.x, c.pos.z);
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }
  tryEnterExit() {
    if (this.mode === 'car') {
      // exit to foot beside the car
      const f = this.playerCar.forward();
      this.playerPos.set(this.playerCar.pos.x - f.x * 3, this.city.groundHeight(this.playerCar.pos.x, this.playerCar.pos.z), this.playerCar.pos.z - f.z * 3);
      this.playerHeading = this.playerCar.heading;
      this.setMode('foot');
      return;
    }
    if (this.mode === 'boat') {
      // beach the boat: step onto the bank nearest the current stage target
      // (land, never water) — west bank 218 / east bank 282, z in the Docks.
      const s = this.missions.stage;
      const tx = (s && s.at) ? s.at[0] : this.playerBoat.pos.x;
      const bankX = tx < 250 ? 218 : 282;
      const bankZ = Math.max(-160, Math.min(160, this.playerBoat.pos.z));
      this.playerPos.set(bankX, 0, bankZ);
      this.playerHeading = this.playerBoat.heading;
      this.playerBoat.mesh.visible = false;
      this.setMode('foot');
      return;
    }
    if (this.mode !== 'foot') return;
    // board the boat? (15 m reach, so you can step aboard from the bank)
    if (dist2(this.playerPos.x, this.playerPos.z, this.playerBoat.pos.x, this.playerBoat.pos.z) < 225) {
      this.setMode('boat');
      this.playerBoat.mesh.visible = true;
      this.missionsSayStage('boat');
      return;
    }
    // enter the nearest car (own car or a parked one = steal). If both are
    // in reach, take whichever is closer — standing at a parked car steals
    // it instead of re-entering your own.
    const near = this.nearestParked(6);
    const ownD2 = dist2(this.playerPos.x, this.playerPos.z, this.playerCar.pos.x, this.playerCar.pos.z);
    const own = ownD2 < 36;
    if (near) {
      const nearD2 = dist2(this.playerPos.x, this.playerPos.z, near.pos.x, near.pos.z);
      if (!own || nearD2 < ownD2) {
        this.swapPlayerCar(near);
        this.police.raise(1);
        this.hud.setToast(`VEHICLE STOLEN: ${near.def.name}`);
        this.audio.blip(520, 0.15, 0.15);
        this.missionsSayStage('steal');
        return;
      }
    }
    if (own) { this.setMode('car'); return; }
  }
  swapPlayerCar(newCar) {
    // The stolen car becomes the player's car; the old one stays parked.
    const old = this.playerCar;
    this.scene.remove(old.mesh);
    old.parked = true;
    this.parked.push(old);
    const idx = this.parked.indexOf(newCar);
    if (idx >= 0) this.parked.splice(idx, 1);
    this.playerCar = newCar;
    this.playerCar.stolen = true;
    this.scene.add(this.playerCar.mesh);
    this.playerCar.mesh.visible = true;
    this.setMode('car');
    this.chase.snap(this.playerCar.pos, this.playerCar.heading, 'car');
  }
  tryInteract() {
    const s = this.missions.stage;
    if (!s) return;
    if (s.type === 'pickup' && this.missions.atStageTarget(this.playerPos.x, this.playerPos.z)) {
      this.audio.blip(990, 0.12, 0.15);
      this.missionsSayStage('pickup');
    }
  }
  missionsSayStage(type) {
    const s = this.missions.stage;
    if (!s || s.type !== type) return;
    const r = this.missions.advance();
    this.onJobAdvanced(r);
  }
  onJobAdvanced(r) {
    if (r === 'job-done') {
      const done = this.missions.jobs[this.missions.jobIndex - 1];
      this.state.money += done.reward;
      this.state.rep += CFG.tuning.repPerJob;
      this.state.jobIndex = this.missions.jobIndex;
      writeSave(this.state);
      this.hud.setToast(`JOB DONE — $${done.reward}`);
      this.audio.blip(1180, 0.2, 0.15);
      this.police.set(this.missions.job.wanted);
      this.combat.clearFoes();
      // Job 8 (VANISHING POINT): after the bridge jump Mara is on the east
      // bank and the bridge is up, so the getaway boat waits in the channel
      // just off the east bank — Sinta moved it there.
      if (this.missions.jobIndex === 7) {
        this.playerBoat.pos.set(272, this.tide.level, 100);
        this.playerBoat.mesh.position.copy(this.playerBoat.pos);
        this.playerBoat.mesh.visible = true;
      }
    } else if (r === 'all-done') {
      this.state.money += 6000;
      this.state.rep += CFG.tuning.repPerJob;
      writeSave(this.state);
      this.mode = 'complete';
      this.hud.showScreen(`<h1 style="font-size:40px">AURELIA DELTA<br>COMPLETE</h1><h2>Mara vanished into the delta. The ledger is ours.<br>$${this.state.money.toLocaleString()} · REP ${this.state.rep}</h2><button class="btn" onclick="window.__game.toTitle()">TITLE</button>`);
    }
  }
  shoot() {
    const cam = this.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    const targets = [
      ...this.combat.foeHitMeshes(),
      ...this.police.cars.map(c => c.mesh),
      ...this.traffic.cars.map(c => c.mesh),
    ];
    const res = this.combat.fire(origin, dir, targets);
    if (!res) return;
    this.audio.shot();
    this.police.raise(1);
    if (res.hit) {
      const obj = res.hit.object;
      // find which foe / car was hit
      const foe = this.combat.foes.find(f => f.hp > 0 && (f.mesh === obj || f.mesh.children.includes(obj)));
      if (foe) {
        foe.hp -= res.weapon.damage;
        if (foe.hp <= 0) {
          foe.mesh.visible = false;
          this.missions.foesDown++;
          this.hud.addFloater('TARGET DOWN');
          if (this.missions.stage && this.missions.stage.type === 'fight' && this.missions.foesDown >= (this.missions.stage.foes || 3)) {
            this.missions.advance();
            this.onJobAdvanced(null);
          }
        }
      }
    }
    // peds flee from the shot
    this.pedDanger = { x: this.playerPos.x, z: this.playerPos.z, r: 30, kind: 'shot' };
  }
  // --- autopilot (drives the real rules; used by shots.js + playtest) ---
  autopilotStep(dt) {
    const s = this.missions.stage;
    if (!s || this.missions.allDone) return;
    const target = this.missions.driveTarget();
    if (this.mode === 'boat') {
      if (s.type === 'boatgoto' && this.missions.atStageTarget(this.playerBoat.pos.x, this.playerBoat.pos.z)) {
        const r = this.missions.advance(); this.onJobAdvanced(r); return;
      }
      if (s.type === 'boat') {
        // already aboard: the boat stage is satisfied
        const r = this.missions.advance(); this.onJobAdvanced(r); return;
      }
      if (s.type !== 'boatgoto') {
        // the boat has served its purpose (e.g. job 8 starts with a steal):
        // beach it and continue on foot
        this.tryEnterExit();
        return;
      }
      if (!target) return;
      const dx = target[0] - this.playerBoat.pos.x, dz = target[1] - this.playerBoat.pos.z;
      const bd = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dh = want - this.playerBoat.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // slow down near the marker: the boat turns tighter at low speed, so
      // it can actually hit a 14 m radius instead of orbiting past it.
      // Keep throttle on until 12 m out: a 10-20 m dead zone (no throttle,
      // no brake) would beach the boat stopped just outside the radius.
      this.playerBoat.update(dt, { throttle: bd > 12, brake: bd < 6, left: dh > 0.06, right: dh < -0.06, nitro: false }, this.tide.level);
      return;
    }
    if (this.mode === 'foot') {
      // walk toward the stage target, then interact / fight
      if (s.type === 'pickup' && this.missions.atStageTarget(this.playerPos.x, this.playerPos.z)) { this.tryInteract(); return; }
      if (s.type === 'fight') {
        const foe = this.combat.foes.find(f => f.hp > 0);
        if (foe) {
          const dx = foe.mesh.position.x - this.playerPos.x, dz = foe.mesh.position.z - this.playerPos.z;
          const d = Math.hypot(dx, dz);
          if (d > 14) { this.walkToward(foe.mesh.position.x, foe.mesh.position.z, dt); }
          else {
            // aim + shoot
            this.playerHeading = Math.atan2(dx, dz);
            const dir = new THREE.Vector3(Math.sin(this.playerHeading), 0, Math.cos(this.playerHeading));
            const origin = this.playerPos.clone(); origin.y = 1.5;
            const res = this.combat.fire(origin, dir, this.combat.foeHitMeshes());
            if (res && res.hit) {
              const f = this.combat.foes.find(x => x.hp > 0 && (x.mesh === res.hit.object || x.mesh.children.includes(res.hit.object)));
              if (f) {
                f.hp -= res.weapon.damage;
                if (f.hp <= 0) {
                  f.mesh.visible = false; this.missions.foesDown++;
                  if (this.missions.foesDown >= (s.foes || 3)) { const r = this.missions.advance(); this.onJobAdvanced(r); }
                }
              }
            }
            if (res) this.audio.shot();
          }
        }
        return;
      }
      if (s.type === 'boat') {
        // walk to the boat itself (not the stage marker) and board in reach
        const bd = Math.hypot(this.playerBoat.pos.x - this.playerPos.x, this.playerBoat.pos.z - this.playerPos.z);
        if (bd < 14) { this.tryEnterExit(); return; }
        this.walkToward(this.playerBoat.pos.x, this.playerBoat.pos.z, dt);
        return;
      }
      if (s.type === 'steal') {
        const tc = this.parked.find(c => c.def.name === (CFG.vehicles[s.car] || {}).name);
        const tx = tc ? tc.pos.x : s.at[0], tz = tc ? tc.pos.z : s.at[1];
        if (Math.hypot(tx - this.playerPos.x, tz - this.playerPos.z) < 5) { this.tryEnterExit(); return; }
        this.walkToward(tx, tz, dt);
        return;
      }
      if (target) this.walkToward(target[0], target[1], dt);
      return;
    }
    // in the car
    if (s.type === 'steal') {
      const tc = this.parked.find(c => c.def.name === (CFG.vehicles[s.car] || {}).name);
      const tx = tc ? tc.pos.x : s.at[0], tz = tc ? tc.pos.z : s.at[1];
      const d = Math.hypot(tx - this.playerCar.pos.x, tz - this.playerCar.pos.z);
      if (d < 6) {
        this.setMode('foot');
        // Stand at the TARGET car, not at our own car, so F steals it.
        this.playerPos.set(tx, 0, tz);
        this.tryEnterExit();
        return;
      }
      this.driveToward(tx, tz, dt, s.type === 'jump');
      return;
    }
    if (s.type === 'boat') {
      // Board from the bank: drive to the bank edge nearest the boat, get
      // out when the boat is within reach, and let the on-foot autopilot
      // walk the last metres and board. Do NOT call tryEnterExit here: if
      // boarding fails it re-enters the car and this handler loops forever.
      const bx = this.playerBoat.pos.x, bz = this.playerBoat.pos.z;
      const bankX = bx < 250 ? 214 : 286;
      const bankZ = Math.max(-160, Math.min(160, bz));
      const bd = Math.hypot(bx - this.playerCar.pos.x, bz - this.playerCar.pos.z);
      if (bd < 22) {
        this.setMode('foot');
        this.playerPos.set(this.playerCar.pos.x, 0, this.playerCar.pos.z);
        this.playerBoat.mesh.visible = true;
        return;
      }
      this.driveToward(bankX, bankZ, dt, false);
      return;
    }
    if (s.type === 'jump') {
      // full speed + nitro at the bridge; the bridge is raised in job 8
      this.driveToward(s.at[0], s.at[1], dt, true);
      if (this.playerCar.pos.x > 252 && this.playerCar.pos.y > 2) {
        const r = this.missions.advance(); this.onJobAdvanced(r);
      }
      return;
    }
    if (target) {
      if (this.missions.atStageTarget(this.playerCar.pos.x, this.playerCar.pos.z)) {
        const r = this.missions.advance(); this.onJobAdvanced(r);
        return;
      }
      this.driveToward(target[0], target[1], dt, false);
    }
  }
  walkToward(tx, tz, dt) {
    const dx = tx - this.playerPos.x, dz = tz - this.playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) return;
    this.playerHeading = Math.atan2(dx, dz);
    const sp = CFG.tuning.runSpeed;
    this.playerPos.x += Math.sin(this.playerHeading) * sp * dt;
    this.playerPos.z += Math.cos(this.playerHeading) * sp * dt;
    this.playerPos.y = this.city.groundHeight(this.playerPos.x, this.playerPos.z);
  }
  driveToward(tx, tz, dt, fullSpeed) {
    const car = this.playerCar;
    // BRIDGE CROSSING: the only way across the river channel (x 220-280)
    // is the bridge at z=0. If the target is across the river, route via
    // the bridge end on our side, then straight across z=0.
    let dest = { x: tx, z: tz };
    const needEast = car.pos.x < 220 && tx > 280;
    const needWest = car.pos.x > 280 && tx < 220;
    if (needEast || needWest) {
      const east = needEast;
      // Stage on Bridge Road well before the bridge (x=80 eastward) so the
      // car is already heading east, centred on z=0, when it reaches the
      // deck — turning onto the bridge from a side road overshoots it.
      // Once past the staging point on Bridge Road, stay committed to the
      // far side (do not flip back to the staging point).
      const endX = east ? 80 : 300; // staging point on our side
      const farX = east ? 305 : 175; // far side of the bridge
      const across = east ? car.pos.x > 285 : car.pos.x < 215;
      const committed = east
        ? (car.pos.x > endX && Math.abs(car.pos.z) < CFG.bridge.halfW)
        : (car.pos.x < endX && Math.abs(car.pos.z) < CFG.bridge.halfW);
      if (!across) {
        dest = committed ? { x: farX, z: 0 } : { x: endX, z: 0 };
      }
    }
    // GRID NAVIGATION: the city is a road grid (roads at multiples of 80 m)
    // with building blocks between them. Driving straight at a far target
    // cuts diagonally across blocks and wedges the car on a building. So the
    // autopilot drives an L-shape: project the target onto the road the car
    // is on, drive along that road, then turn onto the target. Once the car
    // is aligned with the target on one axis (or close), drive straight in.
    let wx = dest.x, wz = dest.z;
    const dx = dest.x - car.pos.x, dz = dest.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    const alignedX = Math.abs(dx) < 12, alignedZ = Math.abs(dz) < 12;
    if (d > 35 && !alignedX && !alignedZ) {
      const rx = Math.round(car.pos.x / 80) * 80; // nearest N-S road
      const rz = Math.round(car.pos.z / 80) * 80; // nearest E-W road
      const onEW = Math.abs(car.pos.z - rz) < 10;
      const onNS = Math.abs(car.pos.x - rx) < 10;
      if (onEW && !onNS) { wx = dest.x; wz = rz; }
      else if (onNS && !onEW) { wx = rx; wz = dest.z; }
      else if (onEW && onNS) {
        if (Math.abs(dx) > Math.abs(dz)) { wx = dest.x; wz = rz; }
        else { wx = rx; wz = dest.z; }
      } else {
        // off-road: get to the nearest road centreline first
        if (Math.abs(car.pos.z - rz) < Math.abs(car.pos.x - rx)) { wx = car.pos.x; wz = rz; }
        else { wx = rx; wz = car.pos.z; }
      }
    }
    const sdx = wx - car.pos.x, sdz = wz - car.pos.z;
    const sd = Math.hypot(sdx, sdz);
    const want = Math.atan2(sdx, sdz);
    let dh = want - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    // unstick: reverse + turn if barely moving while far from the waypoint
    if (Math.abs(car.speed) < 1.2 && sd > 10) this.apStuckT += dt; else this.apStuckT = 0;
    if (this.apStuckT > 2.5) { this.apReverseT = 1.4; this.apStuckT = 0; }
    // On / approaching the narrow bridge (16 m wide) cap the speed so the
    // car enters centred and stays on the deck instead of drifting off the
    // edge into the river at 46 m/s.
    const nearBridge = Math.abs(car.pos.z) < 40 && car.pos.x > 140 && car.pos.x < 340;
    const targetSpeed = nearBridge ? 18 : (fullSpeed ? 40 : 28);
    const tooFast = car.speed > targetSpeed;
    let input;
    if (this.apReverseT > 0) {
      this.apReverseT -= dt;
      input = { throttle: false, brake: true, left: dh < 0, right: dh >= 0, handbrake: false, nitro: false };
    } else {
      // Slow for turns: only throttle when roughly facing the waypoint, so
      // the car does not overshoot a corner at top speed and end up in the
      // river beside the bridge. BUT a stopped car must still creep forward
      // to turn at all (heading only changes with speed) — otherwise a big
      // heading error deadlocks it: it brakes, never moves, never turns.
      const facingAway = Math.abs(dh) > 0.9;
      input = {
        throttle: sd > 6 && (!facingAway || car.speed < 8) && !tooFast,
        brake: sd < 6 || (facingAway && car.speed > 8) || tooFast,
        left: dh > 0.07, right: dh < -0.07,
        handbrake: false, nitro: fullSpeed && Math.abs(dh) < 0.3 && !tooFast,
      };
    }
    car.update(dt, input, this.city.groundHeight, this.city.isWater);
  }
  // --- per-frame update ---
  update(dt) {
    this.time += dt;
    this.frame++;
    this.city.update(dt, this.time);
    this.tide.update(dt);
    // bridge schedule: down 65 s, up 25 s; forced up during job 8
    this.bridgeT += dt;
    const job8 = this.missions.jobIndex === 7;
    const cycle = this.bridgeT % (CFG.bridge.lowerSecs + CFG.bridge.raiseSecs);
    const wantAngle = job8 ? CFG.bridge.maxAngle : (cycle > CFG.bridge.lowerSecs ? CFG.bridge.maxAngle : 0);
    const cur = this.city.bridge.angle;
    const next = cur + clamp(wantAngle - cur, -0.35 * dt, 0.35 * dt);
    this.city.bridge.setAngle(next);
    // clock: 1 game minute per 2 real seconds, day rolls at 24:00
    this.timeMin += dt * 0.5;
    if (this.timeMin >= 1440) { this.timeMin -= 1440; this.day++; }
    if (this.frozen) {
      // shot mode: render only, no gameplay
      this.render();
      if (this.frame === 45) window.__shotReady = true;
      return;
    }
    if (this.mode === 'title') {
      // slow cinematic orbit over the city
      const a = this.time * 0.03;
      this.camera.position.set(Math.sin(a) * 260, 70, Math.cos(a) * 260);
      this.camera.lookAt(0, 8, 0);
      this.traffic.update(dt, null);
      this.render();
      return;
    }
    if (this.mode === 'pause' || this.mode === 'busted' || this.mode === 'wasted' || this.mode === 'complete') {
      this.render();
      return;
    }
    this.missions.update(dt);
    const input = this.input.drive();
    const mouse = this.input.consumeMouse();
    // --- player ---
    let danger = null;
    if (this.mode === 'car') {
      const res = this.playerCar.update(dt, this.autopilot ? { throttle: false, brake: false, left: false, right: false, handbrake: false, nitro: false } : input, this.city.groundHeight, this.city.isWater);
      if (res.inWater) { this.respawn('The MERAK GT went into the delta. Doni fishes it out.'); }
      if (res.drifting && this.playerCar.drift > 1.2) {
        this.state.money += CFG.tuning.driftBonus;
        this.hud.addFloater(`DRIFT x${Math.min(5, 1 + Math.floor(this.playerCar.drift))} +$${CFG.tuning.driftBonus}`);
        this.playerCar.drift = 0;
      }
      // near-miss with traffic
      this.nearMissT -= dt;
      for (const t of this.traffic.cars) {
        const d = Math.hypot(t.pos.x - this.playerCar.pos.x, t.pos.z - this.playerCar.pos.z);
        if (d < 5 && d > 2.4 && Math.abs(this.playerCar.speed) > 20 && this.nearMissT <= 0) {
          this.state.money += CFG.tuning.nearMissBonus;
          this.hud.addFloater(`NEAR MISS +$${CFG.tuning.nearMissBonus}`);
          this.nearMissT = 4;
        }
      }
      danger = { x: this.playerCar.pos.x, z: this.playerCar.pos.z, r: 26, kind: 'car' };
      this.chase.yaw = this.playerCar.heading;
      this.chase.update(dt, this.playerCar.pos, this.playerCar.heading, 'car');
      this.audio.setEngine(Math.abs(this.playerCar.speed) / this.playerCar.def.top, true);
    } else if (this.mode === 'boat') {
      this.playerBoat.update(dt, this.autopilot ? { throttle: false, brake: false, left: false, right: false, nitro: false } : input, this.tide.level);
      this.chase.update(dt, this.playerBoat.pos, this.playerBoat.heading, 'boat');
      this.audio.setEngine(Math.abs(this.playerBoat.speed) / 24, true);
    } else if (this.mode === 'foot') {
      this.chase.yaw -= mouse.dx * 0.0032;
      this.chase.pitch = clamp(this.chase.pitch + mouse.dy * 0.0022, -0.5, 0.45);
      const w = this.input.walk();
      const sp = w.run ? CFG.tuning.runSpeed : CFG.tuning.walkSpeed;
      const fx = Math.sin(this.chase.yaw), fz = Math.cos(this.chase.yaw);
      const rx = Math.cos(this.chase.yaw), rz = -Math.sin(this.chase.yaw);
      const mx = fx * w.fwd + rx * w.strafe, mz = fz * w.fwd + rz * w.strafe;
      const ml = Math.hypot(mx, mz);
      if (ml > 0.01) {
        this.playerHeading = Math.atan2(mx / ml, mz / ml);
        this.playerPos.x += (mx / ml) * sp * dt;
        this.playerPos.z += (mz / ml) * sp * dt;
      }
      this.playerPos.y = this.city.groundHeight(this.playerPos.x, this.playerPos.z);
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.y = this.playerHeading;
      this.chase.update(dt, this.playerPos, 0, 'foot');
      this.audio.setEngine(0, false);
      if (this.input.mouseDown) this.shoot();
      danger = { x: this.playerPos.x, z: this.playerPos.z, r: 18, kind: 'foot' };
      // hit a ped by walking into one (wanted +1, once per ped per 5 s)
      const ped = this.peds.nearest(this.playerPos.x, this.playerPos.z, 1.2);
      if (ped && !ped.hitT) { ped.hitT = 5; this.police.raise(1); }
    }
    if (this.autopilot) this.autopilotStep(dt);
    // --- mission stage checks (car) ---
    const s = this.missions.stage;
    if (s && this.mode === 'car') {
      if ((s.type === 'goto') && this.missions.atStageTarget(this.playerCar.pos.x, this.playerCar.pos.z)) {
        const r = this.missions.advance(); this.onJobAdvanced(r);
      }
      if (s.type === 'fight') { /* on foot only */ }
    }
    if (s && this.mode === 'foot' && s.type === 'goto' && s.onFoot && this.missions.atStageTarget(this.playerPos.x, this.playerPos.z)) {
      const r = this.missions.advance(); this.onJobAdvanced(r);
    }
    if (s && s.type === 'fight' && this.combat.foes.length === 0 && this.mode === 'foot') {
      // spawn the foes once when the fight stage starts
      if (!this.foesSpawned) {
        this.foesSpawned = true;
        this.combat.spawnFoes(s.at[0], s.at[1], s.foes || 3, this.playerPos);
        this.missions.foesDown = 0;
      }
    }
    if (!s || s.type !== 'fight') this.foesSpawned = false;
    // --- world ---
    this.traffic.update(dt, this.mode === 'car' ? this.playerCar : null);
    for (const c of this.traffic.cars) collideCars(c, this.playerCar);
    if (this.mode === 'car') for (const c of this.traffic.cars) { /* already collided */ }
    this.peds.update(dt, danger);
    for (const p of this.peds.list) if (p.hitT) p.hitT -= dt;
    const targetPos = this.mode === 'car' ? this.playerCar.pos : this.mode === 'boat' ? this.playerBoat.pos : this.playerPos;
    const pres = this.police.update(dt, this.playerPos, this.mode === 'car' ? this.playerCar : null, this.mode === 'boat' ? this.playerBoat : null, this.mode === 'foot');
    if (pres.busted) { this.busted(); return; }
    const combatRes = this.combat.update(dt);
    if (combatRes && combatRes.foeShot) {
      if (this.combat.damage(8)) { this.wasted(); return; }
    }
    this.audio.setSiren(this.police.wanted > 0, this.time);
    // --- beacon over the stage target ---
    const tgt = this.missions.driveTarget();
    if (tgt && !this.missions.allDone) {
      this.beacon.visible = true; this.beam.visible = true;
      const by = this.city.groundHeight(tgt[0], tgt[1]) + 8 + Math.sin(this.time * 2) * 0.8;
      this.beacon.position.set(tgt[0], by, tgt[1]);
      this.beacon.rotation.y += dt * 1.5;
      this.beam.position.set(tgt[0], by - 30, tgt[1]);
    } else { this.beacon.visible = false; this.beam.visible = false; }
    // --- HUD ---
    const st = this.state;
    const car = this.playerCar;
    const w = this.combat.weapon;
    const weaponsTxt = this.combat.weapons.map((x, i) =>
      `${i + 1} ${x.name}${x.mag >= 0 ? ` ${x.inMag}/${x.reserve}` : ''}${i === this.combat.current ? ' ◄' : ''}`).join(' · ');
    this.hud.update(dt, {
      mission: {
        label: this.missions.label(),
        objective: this.missions.stage ? this.missions.stage.text : '—',
        stage: this.missions.stage ? `STAGE ${this.missions.stageIndex + 1}/${this.missions.stageCount}` : '',
        next: this.missions.nextText(),
        timer: this.missions.timerText(),
      },
      wanted: this.police.wanted,
      money: st.money,
      day: this.day,
      time: `${String(Math.floor(this.timeMin / 60)).padStart(2, '0')}:${String(Math.floor(this.timeMin % 60)).padStart(2, '0')}`,
      tide: this.tide.state,
      apd: {
        units: this.police.cars.length + (this.police.heli ? 1 : 0) + (this.police.boat ? 1 : 0),
        nearest: this.police.nearestUnits(targetPos).map(u => `${u.name} ${u.d}m ${u.tactic.toUpperCase()}`).join('<br>') || '—',
      },
      health: Math.round(this.combat.health),
      armour: Math.round(this.combat.armour),
      rep: st.rep,
      repMax: 2400,
      repLevel: 1 + Math.floor(st.rep / 480),
      district: districtAt(targetPos.x, targetPos.z).name.toUpperCase(),
      car: this.mode === 'boat' ? 'DELTA SKIFF · COND 94%' : `${car.def.name} · COND ${Math.round(car.condition)}%`,
      speed: this.mode === 'boat' ? Math.abs(this.playerBoat.speed) : this.mode === 'foot' ? 0 : Math.abs(car.speed),
      nitro: Math.round(car.nitro),
      weapons: weaponsTxt,
      radio: this.audio.stationText(),
      dialog: this.missions.messageT > 0 ? this.missions.message : '',
      onFoot: this.mode === 'foot',
      map: {
        player: [targetPos.x, targetPos.z],
        heading: this.mode === 'car' ? car.heading : this.mode === 'boat' ? this.playerBoat.heading : this.playerHeading,
        police: this.police.cars.map(c => [c.pos.x, c.pos.z]),
        target: tgt,
      },
    });
    this.render();
  }
  respawn(msg) {
    this.hud.setToast(msg);
    this.playerCar.pos.set(-20, 0, 150);
    this.playerCar.heading = 0;
    this.playerCar.speed = 0;
    this.playerCar.condition = Math.max(40, this.playerCar.condition - 10);
    this.playerCar.mesh.position.copy(this.playerCar.pos);
    this.setMode('car');
    this.chase.snap(this.playerCar.pos, this.playerCar.heading, 'car');
    this.police.clear();
  }
  busted() {
    this.mode = 'busted';
    this.state.money = Math.max(0, this.state.money - 200);
    writeSave(this.state);
    this.police.clear();
    this.hud.showScreen(`<h1 style="font-size:40px">BUSTED</h1><h2>Kapten Harun's APD caught Mara. -$200.<br>The crew posts bail — the job goes on.</h2><button class="btn" onclick="window.__game.unbust()">BACK TO THE STREETS</button>`);
  }
  unbust() {
    this.hud.hideScreen();
    this.playerPos.set(-20, 0, 150);
    this.setMode('car');
    this.playerCar.pos.set(-20, 0, 150);
    this.playerCar.heading = 0; this.playerCar.speed = 0;
    this.chase.snap(this.playerCar.pos, this.playerCar.heading, 'car');
  }
  wasted() {
    this.mode = 'wasted';
    this.state.money = Math.max(0, this.state.money - 200);
    writeSave(this.state);
    this.combat.health = 100; this.combat.armour = 50;
    this.hud.showScreen(`<h1 style="font-size:40px">WASTED</h1><h2>Mara is down. Doni drags her out. -$200.</h2><button class="btn" onclick="window.__game.unbust()">BACK TO THE STREETS</button>`);
  }
  render() {
    if (this.shotCam) {
      this.camera.position.copy(this.shotCam.pos);
      this.camera.lookAt(this.shotCam.look);
    }
    this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info;
    window.__drawCalls = info.render.calls;
    window.__triangles = info.render.triangles;
  }
  run() {
    let last = performance.now();
    let fpsN = 0, fpsT = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t0 = performance.now();
      try {
        for (let i = 0; i < FF; i++) this.update(dt);
      } catch (err) {
        // One bad frame must never freeze the game; log it and keep running.
        console.error('game update error:', err);
      }
      const ms = performance.now() - t0;
      this.quality.noteFrame(ms);
      window.__frameMs = ms;
      fpsN++;
      if (now - fpsT > 1000) { window.__fps = fpsN; fpsN = 0; fpsT = now; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.__game = new Game();
window.__game.run();
