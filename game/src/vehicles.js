// Cars: box-built low-poly vehicles, arcade physics, traffic AI on road loops.
import * as THREE from 'three';
import { VEHICLES, MAP } from './config.js';
import { RNG } from './random.js';

export function makeCarMesh(def, withLightbar = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 90 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2); cabin.castShadow = true; g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.9), bodyMat);
  hood.position.set(0, 0.9, 1.7); g.add(hood);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(x, 0.38, z); g.add(w);
  }
  // headlights + taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), hl);
    h.position.set(x, 0.6, 2.22); g.add(h);
  }
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2211 });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tl);
    t.position.set(x, 0.6, -2.22); g.add(t);
  }
  if (withLightbar) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.5, -0.2); g.add(bar);
    g.userData.lightbar = bar;
  }
  if (def.kind === 'truck') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 2.6), new THREE.MeshLambertMaterial({ color: 0xb8b8b8 }));
    box.position.set(0, 1.4, -1.2); box.castShadow = true; g.add(box);
  }
  return g;
}

export class Car {
  constructor(def, x, z, heading) {
    this.def = def;
    this.mesh = makeCarMesh(def, def.kind === 'police');
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.airborne = false;
    this.vy = 0;
    this.drift = 0;
    this.stolen = false;
    this.npc = false;
    this.updateMesh();
  }
  updateMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }
}

// Arcade car physics: throttle/brake/steer, grip, drift on handbrake.
export function driveCar(car, input, dt) {
  const d = car.def;
  const th = input.forward ? 1 : input.back ? -0.55 : 0;
  const target = th * d.top;
  const accel = th !== 0 ? d.accel : 14;
  car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), accel * dt);
  if (Math.abs(car.speed) < 0.05 && th === 0) car.speed = 0;
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const spd = Math.abs(car.speed);
  const maxSteer = 0.55 * Math.max(0.25, 1 - spd / (d.top * 1.6));
  car.steer += (steerInput * maxSteer - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * (car.speed / d.top) * d.grip * dt * (car.speed < 0 ? -1 : 1);
  if (input.handbrake && spd > 4) {
    car.drift = Math.min(1, car.drift + dt * 2);
    car.heading += car.steer * 0.5 * dt;
  } else {
    car.drift = Math.max(0, car.drift - dt * 3);
  }
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  // stay inside the map
  car.pos.x = Math.max(-MAP.half + 6, Math.min(MAP.half - 6, car.pos.x));
  car.pos.z = Math.max(-MAP.half + 6, Math.min(MAP.half - 6, car.pos.z));
  car.updateMesh();
}

// Traffic: cars loop around rectangular road circuits.
export function spawnTraffic(G) {
  const rng = new RNG(G.seed + 11);
  G.traffic = [];
  const loops = [
    { x0: -240, z0: -240, x1: 240, z1: 140 },
    { x0: -160, z0: -160, x1: 160, z1: 80 },
    { x0: -80, z0: -80, x1: 80, z1: 0 },
  ];
  for (let i = 0; i < 14; i++) {
    const def = VEHICLES[rng.int(1, 5)];
    const loop = loops[i % loops.length];
    const side = i % 4;
    let x, z, heading;
    if (side === 0) { x = rng.range(loop.x0, loop.x1); z = loop.z0; heading = Math.PI / 2; }
    else if (side === 1) { x = loop.x1; z = rng.range(loop.z0, loop.z1); heading = Math.PI; }
    else if (side === 2) { x = rng.range(loop.x0, loop.x1); z = loop.z1; heading = -Math.PI / 2; }
    else { x = loop.x0; z = rng.range(loop.z0, loop.z1); heading = 0; }
    const car = new Car(def, x, z, heading);
    car.npc = true;
    car.speed = rng.range(8, 14);
    car.loop = loop;
    G.scene.add(car.mesh);
    G.traffic.push(car);
  }
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    if (!car.loop) continue; // parked cars (mission props) do not drive loops
    // follow the rectangle loop: steer toward the next corner
    const l = car.loop;
    const corners = [[l.x0, l.z0], [l.x1, l.z0], [l.x1, l.z1], [l.x0, l.z1]];
    let best = 0, bd = 1e9;
    for (let i = 0; i < 4; i++) {
      const dd = (car.pos.x - corners[i][0]) ** 2 + (car.pos.z - corners[i][1]) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    // target the corner after the nearest one (keeps the loop moving)
    const t = corners[(best + 1) % 4];
    const want = Math.atan2(t[0] - car.pos.x, t[1] - car.pos.z);
    let dh = want - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.updateMesh();
    // gentle avoidance: slow when a car is right ahead
    for (const other of G.traffic) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
      if (dx * dx + dz * dz < 36) { car.speed = Math.max(4, car.speed - dt * 6); break; }
    }
  }
}

export function nearestCar(G, x, z, maxDist = 14) {
  let best = null, bd = maxDist * maxDist;
  const all = [...G.traffic, ...G.police.cars];
  for (const c of all) {
    const dd = (c.pos.x - x) ** 2 + (c.pos.z - z) ** 2;
    if (dd < bd) { bd = dd; best = c; }
  }
  return best;
}
