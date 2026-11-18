// Wanted 1-5 + the APD response: named police units that pursue, ram and
// roadblock, the AIR-1 helicopter with a searchlight (wanted 3+), and a police
// boat on the river (wanted 4+). Busted on foot, wasted at 0 health.
import * as THREE from 'three';
import { CFG, clamp, dist2 } from './config.js';
import { mulberry32, range } from './random.js';
import { Car, buildCarMesh, collideCars } from './vehicles.js';
import { Boat, buildBoatMesh } from './boats.js';

export class Police {
  constructor(scene, rng, groundHeight, isWater) {
    this.scene = scene;
    this.rng = rng;
    this.groundHeight = groundHeight;
    this.isWater = isWater;
    this.wanted = 0;
    this.cars = [];
    this.heat = 0; // seconds a cop has been touching the player on foot
    this.decayT = 0;
    this.roadblockT = 0;
    this.heli = null;
    this.heliLight = null;
    this.boat = null;
    this.nextUnit = 0;
  }
  unitName() { return CFG.policeUnits[this.nextUnit++ % CFG.policeUnits.length]; }
  desiredCount() { return this.wanted === 0 ? 0 : Math.min(CFG.tuning.maxPolice, this.wanted + 1); }
  spawnCarNear(pos) {
    const a = this.rng() * Math.PI * 2;
    const x = pos.x + Math.sin(a) * 70, z = pos.z + Math.cos(a) * 70;
    const car = new Car({ ...CFG.vehicles.police }, x, z, a);
    car.unit = this.unitName();
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }
  // `player` may be a Car/Boat (has .pos) or a bare Vector3 (on foot).
  spawnHeli(player) {
    const p = player.pos || player;
    const g = new THREE.Group();
    const mat = (c, e = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 1.8), mat(0x11151c));
    body.castShadow = true; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), mat(0x11151c));
    tail.position.set(-3.6, 0.4, 0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.7), mat(0x33363c));
    rotor.position.y = 1.1; g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.6), mat(0x33363c));
    tailRotor.position.set(-5.2, 0.6, 0); g.add(tailRotor);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0xfff2c0, 0xffd970, 2));
    light.position.set(2, -0.9, 0); g.add(light);
    // searchlight cone (fake volumetric)
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.set(2, -22, 0); cone.rotation.x = Math.PI;
    g.add(cone);
    g.position.set(p.x, 46, p.z - 30);
    this.scene.add(g);
    this.heli = { mesh: g, rotor, cone, pos: g.position, heading: 0 };
  }
  update(dt, player, playerCar, playerBoat, onFoot) {
    const want = this.desiredCount();
    // The target's position, whatever the player is driving (car / boat / feet).
    const tpos = playerCar ? playerCar.pos : playerBoat ? playerBoat.pos : player;
    while (this.cars.length < want) this.spawnCarNear(tpos);
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    // helicopter at wanted 3+
    if (this.wanted >= 3 && !this.heli) this.spawnHeli(tpos);
    if (this.wanted < 3 && this.heli) { this.scene.remove(this.heli.mesh); this.heli = null; }
    // police boat at wanted 4+
    if (this.wanted >= 4 && !this.boat) {
      this.boat = new Boat(this.scene, 250, 60, Math.PI, 0x11151c);
    }
    if (this.wanted < 4 && this.boat) { this.scene.remove(this.boat.mesh); this.boat = null; }
    // police cars seek the player
    for (const car of this.cars) {
      const dx = tpos.x - car.pos.x, dz = tpos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const close = d < 9;
      const input = {
        throttle: d > 6,
        brake: d < 3.5,
        left: dh > 0.06, right: dh < -0.06,
        handbrake: false, nitro: false,
      };
      car.update(dt, input, this.groundHeight, this.isWater);
      if (close && playerCar) {
        // ram: shove the player car AWAY from the cop and damage it.
        // (dx,dz) points from the cop to the player, so +push shoves away.
        // Gentle shove: a hard shove can push the player off the narrow
        // bridge into the river, which respawns the car.
        const push = 1.0;
        playerCar.pos.x += (dx / (d || 1)) * push * dt * 4;
        playerCar.pos.z += (dz / (d || 1)) * push * dt * 4;
        if (Math.random() < dt * 0.3) playerCar.damage(0.6);
      }
    }
    for (let i = 0; i < this.cars.length; i++)
      for (let j = i + 1; j < this.cars.length; j++) collideCars(this.cars[i], this.cars[j]);
    if (playerCar) for (const c of this.cars) collideCars(c, playerCar);
    // helicopter follows, spotlight tracks the player
    if (this.heli) {
      const h = this.heli;
      const tx = tpos.x - 14, tz = tpos.z - 14;
      h.pos.x += (tx - h.pos.x) * Math.min(1, dt * 0.7);
      h.pos.z += (tz - h.pos.z) * Math.min(1, dt * 0.7);
      h.pos.y = 46 + Math.sin(performance.now() * 0.001) * 1.5;
      h.rotor.rotation.y += dt * 22;
      // The heli body faces local +X, so yaw = heading - PI/2 faces the player.
      h.mesh.rotation.y = Math.atan2(tpos.x - h.pos.x, tpos.z - h.pos.z) - Math.PI / 2;
    }
    // police boat chases along the river
    if (this.boat) {
      const b = this.boat;
      const dx = tpos.x - b.pos.x, dz = tpos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - b.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      b.update(dt, { throttle: d > 12, brake: d < 6, left: dh > 0.08, right: dh < -0.08, nitro: false }, -0.6);
    }
    // wanted decays when no cop is near
    if (this.wanted > 0) {
      let near = false;
      for (const c of this.cars) if (dist2(c.pos.x, c.pos.z, tpos.x, tpos.z) < 120 * 120) near = true;
      if (this.heli) near = true;
      if (!near) { this.decayT += dt; if (this.decayT > CFG.tuning.wantedDecaySecs) { this.wanted--; this.decayT = 0; } }
      else this.decayT = 0;
    }
    // busted: a cop touching the player on foot (player is a Vector3 here)
    if (onFoot && this.wanted > 0) {
      let touching = false;
      for (const c of this.cars) if (dist2(c.pos.x, c.pos.z, player.x, player.z) < 9) touching = true;
      this.heat = touching ? this.heat + dt : 0;
    } else this.heat = 0;
    return { busted: this.heat > CFG.tuning.bustedSecs };
  }
  raise(n = 1) { this.wanted = clamp(this.wanted + n, 0, 5); this.decayT = 0; }
  set(n) { this.wanted = clamp(n, 0, 5); this.decayT = 0; }
  clear() { this.wanted = 0; this.heat = 0; }
  // Nearest 3 units with distance + tactic, for the (small) HUD panel.
  // The target may be a Car/Boat (has .pos) or a bare Vector3 (on foot).
  nearestUnits(target) {
    const tpos = target.pos || target;
    return this.cars
      .map(c => ({ name: c.unit || 'APD', d: Math.round(Math.hypot(c.pos.x - tpos.x, c.pos.z - tpos.z)), tactic: c.tactic || 'Pursuit' }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }
}
