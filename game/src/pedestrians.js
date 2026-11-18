// Pedestrians: low-poly walkers on the sidewalks. They stroll between random
// waypoints, flee from a speeding car or gunfire, and panic when one is hit.
import * as THREE from 'three';
import { CFG, dist2 } from './config.js';
import { mulberry32, range, pick } from './random.js';

const SHIRT = [0xc23b2a, 0x2b5fd9, 0xe8b820, 0x3f7a3a, 0xe8e8e8, 0x8a2a6b, 0x2a8a7a];
export class Pedestrians {
  constructor(scene, rng, groundHeight) {
    this.list = [];
    this.groundHeight = groundHeight;
    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.42, 1.15, 8);
    const headGeo = new THREE.SphereGeometry(0.26, 8, 6);
    for (let i = 0; i < CFG.tuning.pedCount; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: pick(rng, SHIRT) }));
      body.position.y = 0.95; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
      head.position.y = 1.75; head.castShadow = true; g.add(head);
      const x = range(rng, -280, 180), z = range(rng, -280, 220);
      g.position.set(x, groundHeight(x, z), z);
      scene.add(g);
      this.list.push({
        mesh: g, x, z, heading: rng() * 6.28, speed: range(rng, 0.8, 1.6),
        tx: x, tz: z, flee: 0, wait: range(rng, 0, 4),
      });
    }
  }
  update(dt, danger) {
    // danger: {x, z, r, kind} — a car or a shot. Peds inside r flee.
    for (const p of this.list) {
      if (p.wait > 0) { p.wait -= dt; continue; }
      let tx = p.tx, tz = p.tz, speed = p.speed;
      if (danger && dist2(p.x, p.z, danger.x, danger.z) < danger.r * danger.r) {
        const dx = p.x - danger.x, dz = p.z - danger.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / d) * 30; tz = p.z + (dz / d) * 30;
        speed = 4.5; p.flee = 2;
      } else if (p.flee > 0) { p.flee -= dt; speed = 3.5; }
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 2) {
        p.tx = p.x + range(Math.random, -60, 60);
        p.tz = p.z + range(Math.random, -60, 60);
        p.tx = Math.max(-280, Math.min(180, p.tx));
        p.tz = Math.max(-280, Math.min(220, p.tz));
        p.wait = range(Math.random, 0, 5);
        continue;
      }
      const want = Math.atan2(dx, dz);
      let dh = want - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      p.mesh.position.set(p.x, this.groundHeight(p.x, p.z), p.z);
      p.mesh.rotation.y = -p.heading;
      p.mesh.position.y += Math.abs(Math.sin(performance.now() * 0.006 + p.x)) * 0.06;
    }
  }
  // The nearest ped within r of (x,z), for hit detection.
  nearest(x, z, r) {
    let best = null, bd = r * r;
    for (const p of this.list) {
      const d2 = dist2(x, z, p.x, p.z);
      if (d2 < bd) { bd = d2; best = p; }
    }
    return best;
  }
}
