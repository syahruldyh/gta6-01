// Combat: 4 weapons (FISTS / PISTOL / SMG / SHOTGUN), ammo + reload, shooting
// by raycast from the camera through the crosshair, health / armour, and the
// armed foes that appear in the NIGHT MARKET job.
import * as THREE from 'three';
import { CFG, clamp } from './config.js';
import { mulberry32, range } from './random.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.weapons = CFG.weapons.map(w => ({ ...w, inMag: w.mag, reserve: w.ammo }));
    this.current = 0;
    this.cooldown = 0;
    this.reloadT = 0;
    this.health = 100;
    this.armour = 50;
    this.foes = [];
    this.ray = new THREE.Raycaster();
    this.tracer = null;
  }
  get weapon() { return this.weapons[this.current]; }
  select(i) {
    if (i >= 0 && i < this.weapons.length && this.reloadT <= 0) { this.current = i; this.cooldown = 0.1; }
  }
  reload() {
    const w = this.weapon;
    if (w.mag < 0 || this.reloadT > 0 || w.inMag >= w.mag || w.reserve <= 0) return;
    this.reloadT = 1.1;
  }
  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const w = this.weapon;
        const need = w.mag - w.inMag, take = Math.min(need, w.reserve);
        w.inMag += take; w.reserve -= take;
      }
    }
    if (this.tracer) {
      this.tracer.material.opacity -= dt * 4;
      if (this.tracer.material.opacity <= 0) { this.scene.remove(this.tracer); this.tracer = null; }
    }
    for (const f of this.foes) {
      if (f.hp <= 0) continue;
      f.shootT -= dt;
      // foes walk toward the player and shoot
      const dx = f.target.x - f.mesh.position.x, dz = f.target.z - f.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 6) {
        f.mesh.position.x += (dx / d) * 2.2 * dt;
        f.mesh.position.z += (dz / d) * 2.2 * dt;
        // The foe's gun is on local +Z, so yaw = atan2(dx,dz) faces the player.
        f.mesh.rotation.y = Math.atan2(dx, dz);
      }
      if (f.shootT <= 0 && d < 40) {
        f.shootT = range(Math.random, 1.2, 2.2);
        return { foeShot: true, from: f.mesh.position.clone() };
      }
    }
    return null;
  }
  // Fire from `origin` along `dir`. Returns what was hit, if anything.
  fire(origin, dir, targets) {
    const w = this.weapon;
    if (this.cooldown > 0 || this.reloadT > 0) return null;
    if (w.mag >= 0 && w.inMag <= 0) { this.reload(); return { empty: true }; }
    this.cooldown = 1 / w.rate;
    if (w.mag >= 0) w.inMag--;
    const pellets = w.pellets || 1;
    let hit = null;
    for (let p = 0; p < pellets; p++) {
      const d2 = dir.clone();
      d2.x += (Math.random() - 0.5) * 0.03; d2.y += (Math.random() - 0.5) * 0.03; d2.z += (Math.random() - 0.5) * 0.03;
      d2.normalize();
      this.ray.set(origin, d2);
      this.ray.far = w.range;
      const hits = this.ray.intersectObjects(targets, false);
      if (hits.length) {
        const h = hits[0];
        if (!hit || h.distance < hit.distance) hit = h;
      }
    }
    // tracer line
    const end = hit ? hit.point : origin.clone().add(dir.clone().multiplyScalar(w.range));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    if (this.tracer) this.scene.remove(this.tracer);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(this.tracer);
    return hit ? { hit, weapon: w } : { miss: true };
  }
  damage(amount) {
    // armour absorbs first
    const toArmour = Math.min(this.armour, amount * 0.6);
    this.armour -= toArmour;
    this.health -= (amount - toArmour);
    this.health = Math.max(0, this.health);
    return this.health <= 0;
  }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
  addAmmo(id, n) {
    const w = this.weapons.find(x => x.id === id);
    if (w && w.mag >= 0) w.reserve += n;
  }
  // Spawn armed foes for the NIGHT MARKET job around (x,z).
  spawnFoes(x, z, n, target) {
    const rng = mulberry32(555);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0x1c1f24 }));
      body.position.y = 0.95; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc9a06a }));
      head.position.y = 1.78; g.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0x11151c }));
      gun.position.set(0.3, 1.2, 0.4); g.add(gun);
      const fx = x + range(rng, -12, 12), fz = z + range(rng, -12, 12);
      g.position.set(fx, 0, fz);
      this.scene.add(g);
      this.foes.push({ mesh: g, hp: 60, shootT: range(rng, 0.5, 1.5), target });
    }
  }
  clearFoes() {
    for (const f of this.foes) this.scene.remove(f.mesh);
    this.foes = [];
  }
  foeHitMeshes() { return this.foes.filter(f => f.hp > 0).map(f => f.mesh); }
}
