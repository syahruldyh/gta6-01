// Boats + the TIDE system. The tide is a slow sine: the water level rises and
// falls ~0.8 m over ~4 minutes, which opens and closes the shallow delta routes
// and is shown in the HUD as TIDE: RISING / FALLING / HIGH / LOW.
import * as THREE from 'three';
import { CFG, clamp } from './config.js';

export class Tide {
  constructor(water) {
    this.water = water;
    this.t = 0;
    this.level = CFG.colors.waterY;
    this.state = 'RISING';
  }
  update(dt) {
    this.t += dt;
    const prev = this.level;
    // 240 s full cycle, amplitude 0.8 m around -0.6.
    this.level = CFG.colors.waterY + Math.sin((this.t / 240) * Math.PI * 2) * 0.8;
    const rising = this.level > prev;
    if (this.level > 0.1) this.state = 'HIGH';
    else if (this.level < -1.3) this.state = 'LOW';
    else this.state = rising ? 'RISING' : 'FALLING';
    this.water.river.position.y = this.level;
    this.water.bay.position.y = this.level;
  }
  // Shallow delta channels are only passable at HIGH tide.
  channelOpen() { return this.level > -0.2; }
}

function buildBoatMesh(color = 0xe8e8e8) {
  const g = new THREE.Group();
  const mat = (c, e = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.9, 2.1), mat(color));
  hull.position.y = 0.55; hull.castShadow = true; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 4), mat(color));
  bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(3.4, 0.55, 0); bow.castShadow = true; g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.7), mat(0x2c343c));
  deck.position.set(-0.6, 1.15, 0); deck.castShadow = true; g.add(deck);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), mat(0x1c1f24));
  engine.position.set(-2.7, 0.9, 0); g.add(engine);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.24, 0.18, 2.14), mat(0xd21f2b));
  stripe.position.y = 0.75; g.add(stripe);
  return g;
}

export class Boat {
  constructor(scene, x, z, heading, color) {
    this.mesh = buildBoatMesh(color);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.taken = false;
    scene.add(this.mesh);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = -heading;
  }
  update(dt, input, waterLevel) {
    const top = 24;
    if (input.throttle) this.speed += 11 * dt;
    else if (input.brake) this.speed -= 14 * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 4 * dt);
    this.speed = clamp(this.speed, -6, top);
    const maxSteer = 0.5 / (1 + Math.abs(this.speed) * 0.03);
    const target = (input.left ? 1 : 0) * maxSteer - (input.right ? 1 : 0) * maxSteer;
    this.steer += clamp(target - this.steer, -3 * dt, 3 * dt);
    this.heading += (this.speed / 4.5) * Math.tan(this.steer) * dt;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    // stay in the water: in the Docks stretch the river is the channel
    // x 220-280; north/south of it (and in the bay) the water is wider.
    // Scrape, don't stick: only bleed speed when actually pushing INTO the
    // wall, and scale it by dt — a per-update multiply (speed *= 0.6) runs
    // 24x a frame under fast-forward and pins the boat crawling at 0.4 m/s
    // against the bank, too slow to ever turn away.
    const vx = Math.sin(this.heading) * this.speed, vz = Math.cos(this.heading) * this.speed;
    let scraping = false;
    if (this.pos.z >= -160 && this.pos.z <= 160) {
      if (this.pos.x < 222) { this.pos.x = 222; if (vx < 0) scraping = true; }
      if (this.pos.x > 278) { this.pos.x = 278; if (vx > 0) scraping = true; }
    } else {
      if (this.pos.x < 205) { this.pos.x = 205; if (vx < 0) scraping = true; }
      if (this.pos.x > 315) { this.pos.x = 315; if (vx > 0) scraping = true; }
    }
    if (this.pos.z < -310) { this.pos.z = -310; if (vz < 0) scraping = true; }
    if (this.pos.z > 315) { this.pos.z = 315; if (vz > 0) scraping = true; }
    if (scraping) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3 * dt);
    this.pos.y = waterLevel + Math.sin(performance.now() * 0.0012 + this.pos.x * 0.05) * 0.12;
    this.mesh.position.copy(this.pos);
    // The boat model faces local +X, so yaw = heading - PI/2 maps +X to forward.
    this.mesh.rotation.y = this.heading - Math.PI / 2;
    this.mesh.rotation.z = clamp(-this.steer * this.speed * 0.02, -0.12, 0.12);
    this.mesh.rotation.x = Math.sin(performance.now() * 0.001 + this.pos.z * 0.04) * 0.03;
  }
}
export { buildBoatMesh };
