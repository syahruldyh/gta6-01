// Low-poly box-built cars, arcade driving physics (with real jumps: a car that
// leaves a raised bridge leaf goes airborne and lands on the far leaf), traffic
// AI that follows road loops, and simple circle collision between cars.
import * as THREE from 'three';
import { CFG, clamp, lerp, dist2 } from './config.js';
import { mulberry32, range, pick } from './random.js';

const GEO = {};
function geo(key, make) { if (!GEO[key]) GEO[key] = make(); return GEO[key]; }
const MAT = {};
function mat(color, emissive = 0, ei = 0) {
  const k = color + ':' + emissive + ':' + ei;
  if (!MAT[k]) MAT[k] = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei });
  return MAT[k];
}

// One car = body + cabin + 4 wheels + light bars. ~8 meshes, shared geometry.
export function buildCarMesh(def) {
  const g = new THREE.Group();
  const bodyH = def.body === 'truck' ? 0.95 : 0.62;
  const bodyL = def.body === 'truck' ? 5.6 : 4.4;
  const body = new THREE.Mesh(geo('body' + def.body, () => new THREE.BoxGeometry(bodyL, bodyH, 1.9)), mat(def.color));
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(geo('cab' + def.body, () => new THREE.BoxGeometry(def.body === 'truck' ? 1.6 : 2.2, 0.55, 1.7)), mat(0x1c2733));
  cab.position.set(def.body === 'truck' ? 1.6 : -0.25, 1.18, 0); cab.castShadow = true; g.add(cab);
  if (def.body === 'truck') {
    const bed = new THREE.Mesh(geo('bed', () => new THREE.BoxGeometry(2.6, 0.5, 1.8)), mat(0x5a6b5a));
    bed.position.set(-1.4, 1.05, 0); bed.castShadow = true; g.add(bed);
  }
  if (def.body === 'sport') {
    const wing = new THREE.Mesh(geo('wing', () => new THREE.BoxGeometry(0.5, 0.08, 1.8)), mat(0x11151c));
    wing.position.set(-2.1, 1.12, 0); g.add(wing);
  }
  const wheelGeo = geo('wheel', () => new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10));
  const wheels = [];
  for (const [wx, wz] of [[1.45, 0.85], [1.45, -0.85], [-1.45, 0.85], [-1.45, -0.85]]) {
    const w = new THREE.Mesh(wheelGeo, mat(0x14161a));
    w.rotation.x = Math.PI / 2; w.position.set(wx, 0.36, wz); w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  const front = new THREE.Mesh(geo('front', () => new THREE.BoxGeometry(0.1, 0.22, 1.6)), mat(0xfff2c0, 0xffd970, 1.2));
  front.position.set(bodyL / 2 + 0.02, 0.62, 0); g.add(front);
  const rear = new THREE.Mesh(geo('rear', () => new THREE.BoxGeometry(0.1, 0.22, 1.6)), mat(0xff2a2a, 0xd21f2b, 1.0));
  rear.position.set(-bodyL / 2 - 0.02, 0.62, 0); g.add(rear);
  if (def.body === 'police') {
    const bar = new THREE.Mesh(geo('bar', () => new THREE.BoxGeometry(0.9, 0.16, 0.5)), mat(0x2244ff, 0x2244ff, 1.4));
    bar.position.set(-0.25, 1.55, 0); g.add(bar);
    const bar2 = new THREE.Mesh(geo('bar2', () => new THREE.BoxGeometry(0.9, 0.16, 0.5)), mat(0xff2222, 0xff2222, 1.4));
    bar2.position.set(-0.25, 1.55, 0); bar2.position.z = 0; g.add(bar2);
    g.userData.lightBar = bar; g.userData.lightBar2 = bar2;
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(def, x, z, heading) {
    this.def = def;
    this.mesh = buildCarMesh(def);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.vy = 0;
    this.airborne = false;
    this.condition = 100;
    this.nitro = 100;
    this.drift = 0;
    this.stolen = false;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = -heading;
  }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  update(dt, input, groundHeight, isWater) {
    const def = this.def;
    const nitroOn = input.nitro && this.nitro > 0 && this.speed > 4;
    const top = def.top * (nitroOn ? 1.35 : 1);
    if (nitroOn) this.nitro = Math.max(0, this.nitro - 26 * dt);
    else this.nitro = Math.min(100, this.nitro + 5 * dt);
    if (input.throttle) this.speed += def.acc * (nitroOn ? 1.6 : 1) * dt;
    else if (input.brake) this.speed -= def.acc * 1.4 * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    if (input.handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 30 * dt);
    this.speed = clamp(this.speed, -12, top);
    const maxSteer = 0.62 / (1 + Math.abs(this.speed) * 0.045);
    const targetSteer = (input.left ? 1 : 0) * maxSteer - (input.right ? 1 : 0) * maxSteer;
    const steerRate = input.handbrake ? 7 : 5;
    this.steer += clamp(targetSteer - this.steer, -steerRate * dt, steerRate * dt);
    const grip = input.handbrake ? def.grip * 0.55 : def.grip;
    this.heading += (this.speed / 2.9) * Math.tan(this.steer) * grip * dt * (this.speed >= 0 ? 1 : -1);
    // drift: hard steering at speed
    const drifting = input.handbrake && Math.abs(this.speed) > 12;
    this.drift = drifting ? this.drift + dt : 0;
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    // vertical: follow the ground, or fly when the ground drops away (bridge gap)
    const gh = groundHeight(this.pos.x, this.pos.z);
    if (!this.airborne) {
      if (this.pos.y > gh + 0.6) { this.airborne = true; this.vy = 0; }
      else this.pos.y = gh;
    }
    if (this.airborne) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) {
        this.pos.y = gh; this.vy = 0; this.airborne = false;
        if (gh < -1) { /* landed in water */ }
      }
    }
    // wheels spin + steer visual
    const spin = this.speed * dt / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.z += spin;
    this.mesh.position.copy(this.pos);
    // The car model faces local +X, so yaw = heading - PI/2 maps +X to forward.
    this.mesh.rotation.y = this.heading - Math.PI / 2;
    this.mesh.rotation.z = this.airborne ? clamp(-this.vy * 0.02, -0.2, 0.28) : 0;
    this.mesh.rotation.x = 0;
    return { inWater: isWater(this.pos.x, this.pos.z) && this.pos.y < -0.4, drifting };
  }
  damage(amount) {
    this.condition = Math.max(0, this.condition - amount);
    return this.condition <= 0;
  }
}

// Circle collision between cars: push apart, trade speed, damage on hard hits.
export function collideCars(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const d2 = dx * dx + dz * dz, min = 4.4;
  if (d2 > min * min || d2 < 0.0001) return 0;
  const d = Math.sqrt(d2), push = (min - d) / 2, nx = dx / d, nz = dz / d;
  a.pos.x -= nx * push; a.pos.z -= nz * push;
  b.pos.x += nx * push; b.pos.z += nz * push;
  const rel = Math.abs(a.speed - b.speed);
  const dmg = rel > 8 ? (rel - 8) * 0.35 : 0;
  if (dmg > 0) { a.damage(dmg); b.damage(dmg); }
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.7; b.speed = avg * 0.7;
  return dmg;
}

// Traffic: cars that follow rectangular loops on the road grid.
export class Traffic {
  constructor(scene, rng, groundHeight) {
    this.cars = [];
    this.groundHeight = groundHeight;
    const loops = [
      [[-260, -260], [-20, -260], [-20, 140], [-260, 140]],
      [[60, -260], [140, -260], [140, 220], [60, 220]],
      [[-180, -180], [60, -180], [60, 60], [-180, 60]],
      [[-260, -20], [140, -20], [140, -20], [-260, -20]],
    ];
    for (let i = 0; i < CFG.tuning.trafficCount; i++) {
      const loop = loops[i % loops.length];
      const start = loop[Math.floor(rng() * loop.length)];
      const def = { ...CFG.vehicles.elang, color: pick(rng, CFG.trafficColors), name: 'TRAFFIC' };
      if (rng() < 0.25) def.color = CFG.vehicles.taxi.color;
      const car = new Car(def, start[0] + range(rng, -4, 4), start[1] + range(rng, -4, 4), rng() * 6.28);
      car.loop = loop; car.wp = Math.floor(rng() * loop.length);
      car.cruise = range(rng, 8, 13);
      scene.add(car.mesh);
      this.cars.push(car);
    }
  }
  update(dt, playerCar) {
    for (const car of this.cars) {
      const wp = car.loop[car.wp];
      const dx = wp[0] - car.pos.x, dz = wp[1] - car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 8) { car.wp = (car.wp + 1) % car.loop.length; continue; }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // brake for the car ahead (player or traffic)
      let blocked = false;
      const ahead = { x: car.pos.x + Math.sin(car.heading) * 7, z: car.pos.z + Math.cos(car.heading) * 7 };
      if (playerCar && dist2(ahead.x, ahead.z, playerCar.pos.x, playerCar.pos.z) < 36) blocked = true;
      for (const o of this.cars) {
        if (o !== car && dist2(ahead.x, ahead.z, o.pos.x, o.pos.z) < 30) { blocked = true; break; }
      }
      const input = {
        throttle: !blocked && Math.abs(dh) < 1.2,
        brake: blocked || Math.abs(dh) > 1.2,
        left: dh > 0.08, right: dh < -0.08,
        handbrake: false, nitro: false,
      };
      if (!input.throttle && car.speed < car.cruise * 0.4) input.throttle = true;
      if (blocked) car.speed = Math.max(0, car.speed - 14 * dt);
      else car.speed = Math.min(car.cruise, car.speed + 8 * dt);
      // steer toward the waypoint
      car.heading += clamp(dh, -1.4 * dt, 1.4 * dt) * clamp(Math.abs(car.speed) / 6, 0.3, 1);
      const f = car.forward();
      car.pos.x += f.x * car.speed * dt;
      car.pos.z += f.z * car.speed * dt;
      car.pos.y = this.groundHeight(car.pos.x, car.pos.z);
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading - Math.PI / 2;
      const spin = car.speed * dt / 0.36;
      for (const w of car.mesh.userData.wheels) w.rotation.z += spin;
    }
    for (let i = 0; i < this.cars.length; i++)
      for (let j = i + 1; j < this.cars.length; j++) collideCars(this.cars[i], this.cars[j]);
  }
}
