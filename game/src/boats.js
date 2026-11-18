// Boats: drivable skiffs on the canal and the delta, riding the tide.
import * as THREE from 'three';
import { MAP } from './config.js';

export function makeBoatMesh(color = 0xe8e0c8) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 6.5), hullMat);
  hull.position.y = 0.45; hull.castShadow = true; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 4), hullMat);
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(0, 0.45, 4.2); g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 4.5), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  deck.position.set(0, 0.95, -0.4); g.add(deck);
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  console_.position.set(0, 1.4, 0.6); g.add(console_);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  motor.position.set(0, 0.6, -3.4); g.add(motor);
  return g;
}

export class Boat {
  constructor(x, z, heading, police = false) {
    this.mesh = makeBoatMesh(police ? 0x1a2a4a : 0xe8e0c8);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.police = police;
    this.updateMesh();
  }
  updateMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }
}

// Boat physics: throttle accelerates, steering scales with speed, scrape clamps
// directionally (a sideways scrape only kills the sideways component, never the
// forward drive) and is dt-scaled so it cannot stall the boat.
export function driveBoat(boat, input, dt, G) {
  const top = 21;
  const th = input.forward ? 1 : input.back ? -0.4 : 0;
  const target = th * top;
  boat.speed += Math.sign(target - boat.speed) * Math.min(Math.abs(target - boat.speed), 12 * dt);
  if (Math.abs(boat.speed) < 0.05 && th === 0) boat.speed = 0;
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  boat.heading += steerInput * 0.9 * Math.min(1, Math.abs(boat.speed) / 10) * dt;
  let nx = boat.pos.x + Math.sin(boat.heading) * boat.speed * dt;
  let nz = boat.pos.z + Math.cos(boat.heading) * boat.speed * dt;
  // water bounds: canal + delta; walls at canal sides and map edges
  const inCanal = nz > MAP.canalZ0 - 2 && nz < MAP.canalZ1 + 2;
  const minX = inCanal ? -MAP.half + 4 : -MAP.half + 4;
  const maxX = MAP.half - 4;
  if (nx < minX || nx > maxX) {
    // directional scrape: keep forward motion, damp the sideways component
    boat.speed *= Math.max(0, 1 - 2.5 * dt);
    nx = Math.max(minX, Math.min(maxX, nx));
  }
  if (nz < MAP.canalZ0 - 2) {
    boat.speed *= Math.max(0, 1 - 2.5 * dt);
    nz = MAP.canalZ0 - 2;
  }
  if (nz > MAP.half - 4) {
    boat.speed *= Math.max(0, 1 - 2.5 * dt);
    nz = MAP.half - 4;
  }
  boat.pos.x = nx; boat.pos.z = nz;
  // ride the tide: boat bobs on the water level
  boat.pos.y = -0.9 + G.city.tide * 1.1 + Math.sin(G.time.t * 1.4) * 0.06;
  boat.updateMesh();
}

export function spawnBoats(G) {
  G.boats = [];
  const escape = new Boat(0, 232, Math.PI);
  G.scene.add(escape.mesh);
  G.boats.push(escape);
  G.escapeBoat = escape;
  const extra = new Boat(-60, 240, 0);
  G.scene.add(extra.mesh);
  G.boats.push(extra);
}

export function nearestBoat(G, x, z, maxDist = 15) {
  let best = null, bd = maxDist * maxDist;
  for (const b of G.boats) {
    if (b.police) continue;
    const dd = (b.pos.x - x) ** 2 + (b.pos.z - z) ** 2;
    if (dd < bd) { bd = dd; best = b; }
  }
  return best;
}
