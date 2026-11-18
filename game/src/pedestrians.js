// Pedestrians: walkers on the sidewalks who flee when a car or a gun comes close.
import * as THREE from 'three';
import { MAP } from './config.js';
import { RNG } from './random.js';

const SKIN = [0xd8a077, 0xb87a52, 0x8a5a3a, 0xe8c8a8];
const SHIRTS = [0xe84a5a, 0x3fa7d6, 0xf2b705, 0x7ac74f, 0x9a6ad6, 0xe8e8e8, 0xff7a3c];

export function makePedMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: SKIN[rng.int(0, SKIN.length - 1)] });
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[rng.int(0, SHIRTS.length - 1)] });
  const legs = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
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

export function spawnPeds(G) {
  const rng = new RNG(G.seed + 23);
  G.peds = [];
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-260, 260);
    const z = rng.range(-260, 140);
    const mesh = makePedMesh(rng);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.peds.push({
      mesh, pos: mesh.position, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2), target: null, flee: 0, state: 'walk',
      seed: rng.range(0, 100),
    });
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    // flee if the player (car or armed) is close
    const dx = ped.pos.x - p.pos.x, dz = ped.pos.z - p.pos.z;
    const d2 = dx * dx + dz * dz;
    const danger = (p.mode !== 'foot' && d2 < 400) || (p.mode === 'foot' && p.weapon > 0 && d2 < 900);
    if (danger) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.heading = Math.atan2(dx, dz);
      ped.speed = 5.5;
    } else {
      ped.speed = 1.6 + Math.sin(G.time.t * 0.5 + ped.seed) * 0.4;
      // pick a new sidewalk waypoint when close to the current one
      if (!ped.target || (ped.pos.x - ped.target[0]) ** 2 + (ped.pos.z - ped.target[1]) ** 2 < 4) {
        const rx = MAP.roadsX[Math.floor(Math.random() * MAP.roadsX.length)];
        const rz = MAP.roadsZ[Math.floor(Math.random() * MAP.roadsZ.length)];
        ped.target = [rx + 9, rz + 9];
      }
      const want = Math.atan2(ped.target[0] - ped.pos.x, ped.target[1] - ped.pos.z);
      let dh = want - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += Math.max(-2 * dt, Math.min(2 * dt, dh));
    }
    ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
    ped.pos.x = Math.max(-270, Math.min(270, ped.pos.x));
    ped.pos.z = Math.max(-270, Math.min(150, ped.pos.z));
    ped.mesh.rotation.y = ped.heading;
    // walk bob
    ped.mesh.position.y = Math.abs(Math.sin(G.time.t * 6 + ped.seed)) * 0.06;
  }
}
