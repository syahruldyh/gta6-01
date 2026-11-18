// Combat: fists / pistol / SMG / shotgun, hitscan shots, guard NPCs, damage.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { damagePlayer } from './police.js';
import { makePedMesh } from './pedestrians.js';
import { RNG } from './random.js';

export function initCombat(G) {
  G.combat = { cooldown: 0, tracer: null, muzzle: 0 };
  // a thin tracer line reused for every shot
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  G.combat.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
  G.scene.add(G.combat.tracer);
}

function fireTracer(G, from, to) {
  const t = G.combat.tracer;
  t.geometry.setFromPoints([from, to]);
  t.material.opacity = 0.9;
  G.combat.muzzle = 0.12;
}

export function shoot(G) {
  const p = G.player;
  const c = G.combat;
  if (c.cooldown > 0 || p.mode !== 'foot' && p.mode !== 'car') return;
  const w = WEAPONS[p.weapon];
  if (!w || w.mag === 0) return; // fists: handled by melee below
  if (p.ammo[p.weapon] <= 0) {
    // auto reload from reserve
    const w2 = WEAPONS[p.weapon];
    const take = Math.min(w2.mag, p.reserve[p.weapon]);
    if (take > 0) { p.reserve[p.weapon] -= take; p.ammo[p.weapon] = take; }
    return;
  }
  p.ammo[p.weapon]--;
  c.cooldown = p.weapon === 2 ? 0.09 : p.weapon === 3 ? 0.7 : 0.28;
  const from = p.pos.clone(); from.y += 1.4;
  const dir = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  const to = from.clone().addScaledVector(dir, w.range);
  fireTracer(G, from, to);
  G.audio.sfx('shot');
  // hit the nearest guard roughly in front
  const m = G.missions;
  for (const g of m.guards) {
    if (g.dead) continue;
    const gx = g.x - p.pos.x, gz = g.z - p.pos.z;
    const d = Math.hypot(gx, gz);
    if (d > w.range) continue;
    const ang = Math.atan2(gx, gz);
    let dh = ang - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    if (Math.abs(dh) < 0.35) {
      g.health -= w.damage;
      if (g.health <= 0) { g.dead = true; if (g.mesh) g.mesh.visible = false; G.hud.floatText('GUARD DOWN'); }
    }
  }
  // shooting a cop raises wanted
  if (G.police.wanted < 5 && Math.random() < 0.5) {
    G.police.wanted = Math.min(5, G.police.wanted + 1);
    G.player.wanted = G.police.wanted;
  }
}

export function melee(G) {
  const p = G.player;
  const c = G.combat;
  if (c.cooldown > 0) return;
  c.cooldown = 0.5;
  const m = G.missions;
  for (const g of m.guards) {
    if (g.dead) continue;
    const d = Math.hypot(g.x - p.pos.x, g.z - p.pos.z);
    if (d < 2.4) {
      g.health -= 12;
      if (g.health <= 0) { g.dead = true; if (g.mesh) g.mesh.visible = false; }
    }
  }
  G.audio.sfx('punch');
}

export function renderGuards(G) {
  const m = G.missions;
  if (m.guards.length && !m.guards[0].mesh) {
    const rng = new RNG(G.seed + 41);
    for (const g of m.guards) {
      const mesh = makePedMesh(rng);
      mesh.position.set(g.x, 0, g.z);
      mesh.scale.set(1.15, 1.15, 1.15);
      G.scene.add(mesh);
      g.mesh = mesh;
    }
  }
  // guards shoot back when the player is near
  for (const g of m.guards) {
    if (g.dead || !g.mesh) continue;
    const d = Math.hypot(g.x - G.player.pos.x, g.z - G.player.pos.z);
    if (d < 26 && Math.random() < 0.01) {
      damagePlayer(G, 4);
      G.hud.floatText('HIT -4');
    }
  }
}

export function updateCombat(G, dt) {
  const c = G.combat;
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.muzzle > 0) {
    c.muzzle -= dt;
    if (c.muzzle <= 0) c.tracer.material.opacity = 0;
  }
}
