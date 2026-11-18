// Shots: deterministic staging for the 4 screenshots, and the autopilot that
// plays all 8 jobs for the playtest. Query params: ?shot=cover|onfoot|start|boat
// and ?autopilot=1&ff=12. Everything is seeded, so the same frame repeats.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { Car, nearestCar } from './vehicles.js';
import { nearestBoat } from './boats.js';
import { setBridgeAngle } from './city.js';
import { startMission, currentStage } from './missions.js';
import { setWanted, spawnHeli, spawnPoliceBoat } from './police.js';

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Steer the player toward a waypoint; returns true when close.
// A stopped car cannot turn (heading changes with speed), so when the
// player is nearly stopped we always throttle — the car turns as it moves.
function steerTo(G, x, z, arrive = 6) {
  const p = G.player;
  const dx = x - p.pos.x, dz = z - p.pos.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const dh = angDiff(want, p.heading);
  const inp = G.input;
  inp.left = dh > 0.12;
  inp.right = dh < -0.12;
  const stopped = Math.abs(p.speed || 0) < 3;
  inp.forward = stopped || Math.abs(dh) < 2.2;
  inp.back = !stopped && Math.abs(dh) > 2.4 && dist > 10;
  inp.handbrake = false;
  // speed control in a car: slow down as the target gets close, and when
  // the heading error is large, so the car can actually hit the waypoint
  // instead of overshooting it at full speed and looping around.
  if (p.mode === 'car' && p.vehicle) {
    const spd = Math.abs(p.speed || 0);
    const top = p.vehicle.def.top;
    let desired = Math.min(top, Math.max(6, dist * 0.45));
    if (Math.abs(dh) > 0.9) desired = Math.min(desired, 10);
    if (spd > desired + 2) { inp.forward = false; inp.back = true; }
  }
  return dist < arrive;
}

export function stageShot(G, name) {
  const p = G.player;
  if (name === 'start') {
    G.mode = 'title';
    p.pos.set(0, 0, 100);
    p.heading = Math.PI;
    return;
  }
  G.mode = 'play';
  G.shotFrozen = true;
  if (name === 'cover') {
    // Mission 8, stage 3/3: the MERAK GT airborne over the rising drawbridge.
    startMission(G, 7);
    G.missions.stage = 2;
    G.missions.timer = 179;
    setWanted(G, 5);
    setBridgeAngle(G, 0.35);
    G.city.bridge.target = 0.35;
    p.money = 48250; p.rep = 1960; p.health = 82; p.armour = 64; p.nitro = 64;
    p.weapon = 2; p.ammo = [0, 12, 32, 6]; p.reserve = [0, 48, 128, 18];
    // the red MERAK GT mid-jump over the gap, high and nose-up so the
    // airborne arc reads against the sky
    const car = new Car(VEHICLES[0], 0, 183, 0);
    car.speed = 42; car.stolen = true; car.condition = 82;
    car.mesh.position.set(0, 10, 183);
    car.mesh.rotation.x = -0.15;
    G.scene.add(car.mesh);
    p.vehicle = car; p.mode = 'car';
    p.pos.set(0, 10, 183); p.heading = 0; p.speed = 42;
    // two APD cruisers chasing across the bridge behind
    for (const [z, x] of [[150, -6], [138, 7]]) {
      const pc = new Car(VEHICLES[4], x, z, 0);
      pc.speed = 40; pc.police = true; pc.unit = 'HERON-2';
      G.scene.add(pc.mesh);
      G.police.cars.push(pc);
      G.police.units.push({ name: 'HERON-2', tactic: 'RAMMING', dist: 24 });
    }
    G.police.units.push(
      { name: 'MERAK-5', tactic: 'PURSUIT', dist: 14 },
      { name: 'ELANG-7', tactic: 'ROADBLOCK', dist: 22 },
      { name: 'GULL-3', tactic: 'SEARCHLIGHT', dist: 40 },
      { name: 'TIDE-1', tactic: 'PURSUIT', dist: 55 },
    );
    // AIR-1 overhead with its spotlight, clear of the car against the sky
    const heli = spawnHeli(G);
    heli.position.set(-22, 16, 190);
    heli.rotation.y = Math.PI;
    heli.userData.spot.target.position.set(-14, -34, 12);
    // police boat in the canal gap directly below the jumping car
    const pb = spawnPoliceBoat(G);
    pb.pos.set(2, 0, 181); pb.heading = 0; pb.updateMesh();
    // the escape boat waiting past the cranes
    G.escapeBoat.pos.set(-14, 0, 236); G.escapeBoat.heading = 0.4; G.escapeBoat.updateMesh();
    G.hud.say('SINTA', 'Getaway Planner', 'The bridge is rising, Mara! Don\u2019t stop — the boat is waiting past the cranes!');
    G.hud.floatText('DRIFT x3 +$150');
    G.hud.floatText('NEAR MISS +$250');
    // low, close, looking slightly up: the car looms against the orange
    // sky, the dark deck falls away below it; high enough to see the
    // police boat in the canal gap below the car
    G.shotCam = { pos: [16, 7, 169], look: [0, 7.5, 183] };
  } else if (name === 'onfoot') {
    // Mission 5, Night Market: Mara on foot in the Fishmarket, pistol out.
    startMission(G, 4);
    G.missions.stage = 1;
    setWanted(G, 3);
    p.pos.set(-38, 0, 4); p.heading = 0.5; p.mode = 'foot';
    p.weapon = 1; p.ammo = [0, 12, 32, 6]; p.reserve = [0, 48, 128, 18];
    p.money = 12500; p.rep = 980; p.health = 88; p.armour = 40;
    G.missions.guards = [
      { x: -28, z: 12, health: 50, dead: false, mesh: null },
      { x: -32, z: 6, health: 50, dead: false, mesh: null },
    ];
    G.hud.say('SINTA', 'Getaway Planner', 'They drew first. Finish it and run!');
    G.hud.floatText('NIGHT MARKET · FISHMARKET');
    G.shotCam = { pos: [-24, 6, -14], look: [-38, 1.2, 4] };
  } else if (name === 'boat') {
    // The delta skiff at dusk: cranes, AIR-1 searchlight, open water.
    startMission(G, 7);
    G.missions.stage = 2;
    setWanted(G, 5);
    p.money = 48250; p.rep = 1960;
    const boat = G.escapeBoat;
    boat.pos.set(0, 0, 248); boat.heading = Math.PI; boat.speed = 14;
    p.boat = boat; p.mode = 'boat';
    p.pos.copy(boat.pos); p.heading = Math.PI; p.speed = 14;
    const pb2 = spawnPoliceBoat(G);
    pb2.pos.set(14, 0, 236); pb2.heading = Math.PI * 0.8; pb2.updateMesh();
    const heli2 = spawnHeli(G);
    heli2.position.set(-8, 22, 244);
    heli2.rotation.y = 0.6;
    G.hud.say('SINTA', 'Getaway Planner', 'The tide is with you tonight. Vanish into the delta.');
    // behind the skiff looking south: the boat centred, the bridge and
    // cranes and orange sky beyond it, police boat and AIR-1 in frame
    G.shotCam = { pos: [12, 5, 264], look: [0, 1, 246] };
  }
}

// The autopilot: plays the current mission stage. Called every frame when
// G.autopilot is on. It writes G.input and performs enter/steal/board actions.
export function autopilotStep(G, dt) {
  const p = G.player;
  const m = G.missions;
  if (m.state !== 'active' || G.mode !== 'play') return;
  const cur = currentStage(G);
  if (!cur) return;
  const inp = G.input;
  inp.forward = false; inp.back = false; inp.left = false; inp.right = false; inp.handbrake = false;
  inp.shoot = false;
  // --- on-foot handling: walk to a car, steal it, or walk to the target ---
  if (cur.type === 'steal' || cur.type === 'drive' || cur.type === 'boat') {
    if (p.mode === 'boat') {
      if (cur.type === 'boat') {
        // already in the boat: steer it to the target
        steerTo(G, cur.x, cur.z, 12);
        return;
      }
      // a drive/steal stage while in the boat: get out and find a car
      G.exitBoat();
      return;
    }
    if (p.mode === 'foot') {
      if (cur.type === 'boat') {
        // walk to the escape boat and board it
        const b = nearestBoat(G, p.pos.x, p.pos.z, 400);
        if (b) {
          if (steerTo(G, b.pos.x, b.pos.z, 4)) {
            G.boardBoat(b);
            return;
          }
          p.speed = 6;
          return;
        }
      }
      const car = nearestCar(G, p.pos.x, p.pos.z, 400);
      if (car) {
        if (steerTo(G, car.pos.x, car.pos.z, 3)) {
          G.enterCar(car, true);
          return;
        }
        p.speed = 6;
        return;
      }
    }
  }
  if (cur.type === 'walk' || cur.type === 'combat') {
    if (p.mode === 'car') { G.exitCar(); return; }
    if (p.mode === 'boat') { G.exitBoat(); return; }
    if (cur.type === 'combat') {
      const guards = m.guards.filter((g) => !g.dead);
      if (guards.length === 0) return;
      const g = guards[0];
      const d = Math.hypot(g.x - p.pos.x, g.z - p.pos.z);
      if (d > 24) {
        steerTo(G, g.x, g.z, 20);
        p.speed = 6;
        return;
      }
      // face the guard and shoot
      p.heading = Math.atan2(g.x - p.pos.x, g.z - p.pos.z);
      p.weapon = 1;
      inp.shoot = true;
      return;
    }
    steerTo(G, cur.x, cur.z, 3);
    p.speed = 6;
    return;
  }
  if (cur.type === 'boat') {
    if (p.mode === 'boat') {
      steerTo(G, cur.x, cur.z, 12);
      return;
    }
    if (p.mode === 'car') {
      // if the boat is close, just get out and walk to it (no need to drive
      // back across the bridge); otherwise drive to the dock road first
      const b = nearestBoat(G, p.pos.x, p.pos.z, 400);
      const boatNear = b && Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) < 35;
      if (boatNear) { G.exitCar(); return; }
      if (steerTo(G, 0, 145, 10)) { G.exitCar(); return; }
      return;
    }
  }
  if (cur.type === 'drive' || cur.type === 'steal') {
    if (p.mode !== 'car') return;
    // route across the canal via the bridge road
    const crosses = (p.pos.z < 160 && cur.z > 200) || (p.pos.z > 200 && cur.z < 160);
    if (crosses) {
      const via = p.pos.z < 160 ? { x: 0, z: 145 } : { x: 0, z: 215 };
      if (Math.hypot(p.pos.x - via.x, p.pos.z - via.z) > 12) {
        steerTo(G, via.x, via.z, 8);
        return;
      }
    }
    // on the bridge itself: full throttle for the jump when it is raised
    const onBridge = Math.abs(p.pos.x) < 14 && p.pos.z > 150 && p.pos.z < 210;
    if (onBridge && G.city.bridge.angle > 0.05) {
      inp.forward = true; inp.left = p.pos.x > 2; inp.right = p.pos.x < -2;
      return;
    }
    steerTo(G, cur.x, cur.z, 10);
    return;
  }
}
