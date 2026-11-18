// APD — Aurelia Police Department: wanted stars, named units, pursuit / ram /
// roadblock tactics, the AIR-1 helicopter (wanted 3+) and the police boat (wanted 4+).
import * as THREE from 'three';
import { POLICE_UNITS, POLICE_TACTICS, VEHICLES } from './config.js';
import { Car } from './vehicles.js';
import { Boat } from './boats.js';
import { RNG } from './random.js';

export function initPolice(G) {
  G.police = {
    wanted: 0, heat: 0, cars: [], heli: null, heliAngle: 0, boat: null,
    units: [], cooldown: 0,
  };
}

function makeHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
  body.castShadow = true; g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
  tail.position.set(0, 0.2, -4); g.add(tail);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 1.2), new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 90 }));
  glass.position.set(0, 0.3, 1.8); g.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1; g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  tailRotor.position.set(0.4, 0.4, -5.6); g.add(tailRotor);
  const spot = new THREE.SpotLight(0xfff2b0, 60, 90, 0.35, 0.5, 1.2);
  spot.position.set(0, -0.8, 0);
  const tgt = new THREE.Object3D();
  tgt.position.set(0, -30, 0);
  g.add(tgt); spot.target = tgt;
  g.add(spot);
  g.userData.rotor = rotor;
  g.userData.spot = spot;
  return g;
}

export function spawnHeli(G) {
  if (G.police.heli) return G.police.heli;
  const heli = makeHeli();
  G.scene.add(heli);
  G.police.heli = heli;
  return heli;
}

export function spawnPoliceBoat(G) {
  if (G.police.boat) return G.police.boat;
  const boat = new Boat(G.player.pos.x + 30, Math.max(210, G.player.pos.z + 20), 0, true);
  G.scene.add(boat.mesh);
  G.police.boat = boat;
  return boat;
}

export function setWanted(G, stars) {
  const p = G.police;
  p.wanted = Math.max(0, Math.min(5, stars));
  G.player.wanted = p.wanted;
}

function spawnUnit(G, i) {
  const rng = new RNG(G.seed + 31 + i * 7 + Math.floor(G.time.t));
  const def = VEHICLES[4];
  const a = rng.range(0, Math.PI * 2);
  const r = rng.range(45, 70);
  const car = new Car(def, G.player.pos.x + Math.sin(a) * r, G.player.pos.z + Math.cos(a) * r, 0);
  car.npc = true; car.police = true;
  car.unit = POLICE_UNITS[i % POLICE_UNITS.length];
  car.tactic = POLICE_TACTICS[i % POLICE_TACTICS.length];
  car.speed = 10;
  G.scene.add(car.mesh);
  G.police.cars.push(car);
  G.police.units.push({ name: car.unit, tactic: car.tactic, dist: Math.round(r) });
}

export function damagePlayer(G, amount) {
  const pl = G.player;
  if (pl.armour > 0) {
    const absorbed = Math.min(pl.armour, amount);
    pl.armour -= absorbed;
    amount -= absorbed;
  }
  pl.health -= amount;
  if (pl.health <= 0) {
    pl.health = 0;
    G.mode = 'wasted';
  }
}

export function updatePolice(G, dt) {
  const p = G.police;
  const player = G.player;
  // wanted decays when the player stays slow and hidden for a while
  p.cooldown -= dt;
  if (p.wanted > 0 && player.speed < 2 && p.cooldown <= 0 && G.mode === 'play') {
    p.heat += dt;
    if (p.heat > 25) { setWanted(G, p.wanted - 1); p.heat = 0; }
  } else if (player.speed > 5) {
    p.heat = 0;
  }
  // keep the right number of units on the street
  const want = p.wanted > 0 ? p.wanted + 1 : 0;
  while (p.cars.length < want) spawnUnit(G, p.cars.length);
  while (p.cars.length > want) {
    const c = p.cars.pop();
    G.scene.remove(c.mesh);
    p.units.pop();
  }
  // unit AI: pursuit, ramming, roadblock ahead of the player
  for (let i = 0; i < p.cars.length; i++) {
    const car = p.cars[i];
    const dx = player.pos.x - car.pos.x, dz = player.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    p.units[i].dist = Math.round(dist);
    let target;
    if (car.tactic === 'ROADBLOCK') {
      const ahead = 26;
      target = [player.pos.x + Math.sin(player.heading) * ahead, player.pos.z + Math.cos(player.heading) * ahead];
    } else {
      target = [player.pos.x, player.pos.z];
    }
    const wantH = Math.atan2(target[0] - car.pos.x, target[1] - car.pos.z);
    let dh = wantH - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const ram = car.tactic === 'RAMMING' ? 1.25 : 1;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const top = 46 * ram;
    car.speed += (top - car.speed) * Math.min(1, dt * 0.7);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.updateMesh();
    // ram contact: shove the player car and deal a little damage
    if (dist < 4.5 && player.mode === 'car' && player.vehicle) {
      player.vehicle.speed *= 0.94;
      if (p.cooldown <= 0) { damagePlayer(G, 3); p.cooldown = 0.8; }
    }
    // a unit that fell far behind respawns near the player
    if (dist > 220) {
      const a = Math.random() * Math.PI * 2;
      car.pos.x = player.pos.x + Math.sin(a) * 60;
      car.pos.z = player.pos.z + Math.cos(a) * 60;
    }
  }
  // helicopter: circles the player at wanted 3+. It tracks the player
  // position directly, so it never crashes when the player is on foot.
  if (p.wanted >= 3) {
    if (!p.heli) {
      p.heli = makeHeli();
      G.scene.add(p.heli);
    }
    p.heliAngle += dt * 0.35;
    const hx = player.pos.x + Math.sin(p.heliAngle) * 26;
    const hz = player.pos.z + Math.cos(p.heliAngle) * 26;
    p.heli.position.set(hx, 34, hz);
    p.heli.rotation.y = Math.atan2(player.pos.x - hx, player.pos.z - hz);
    p.heli.userData.rotor.rotation.y += dt * 22;
    p.heli.userData.spot.target.position.set(player.pos.x - hx, -34, player.pos.z - hz);
  } else if (p.heli) {
    G.scene.remove(p.heli);
    p.heli = null;
  }
  // police boat chases on the water at wanted 4+
  if (p.wanted >= 4) {
    if (!p.boat) {
      p.boat = new Boat(player.pos.x + 30, Math.max(210, player.pos.z + 20), 0, true);
      G.scene.add(p.boat.mesh);
    }
    const b = p.boat;
    const wantH = Math.atan2(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
    let dh = wantH - b.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    b.heading += Math.max(-1.2 * dt, Math.min(1.2 * dt, dh));
    b.speed += (17 - b.speed) * Math.min(1, dt * 0.5);
    b.pos.x += Math.sin(b.heading) * b.speed * dt;
    b.pos.z += Math.cos(b.heading) * b.speed * dt;
    b.pos.y = -0.9 + G.city.tide * 1.1;
    b.updateMesh();
  } else if (p.boat) {
    G.scene.remove(p.boat.mesh);
    p.boat = null;
  }
}
