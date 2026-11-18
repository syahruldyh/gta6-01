// HUD: the dense DOM overlay — mission panel, APD response, stars, money, tide,
// minimap, health/armour/rep, weapon slots, vehicle + speed, radio, dialog.
import { DISTRICTS, MAP, WEAPONS, RADIO } from './config.js';
import { districtAt, tideLabel } from './city.js';
import { currentJob, currentStage } from './missions.js';

const el = (tag, cls, parent, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
};

export function buildHUD(G) {
  const root = document.getElementById('hud');
  const h = { root };
  h.mission = el('div', 'panel mission', root);
  h.missionTitle = el('div', 'mtitle', h.mission);
  h.missionObj = el('div', 'mobj', h.mission);
  h.missionNext = el('div', 'mnext', h.mission);
  h.apd = el('div', 'panel apd', root);
  h.apdTitle = el('div', 'atitle', h.apd);
  h.apdUnits = el('div', 'aunits', h.apd);
  h.topRight = el('div', 'panel topright', root);
  h.clock = el('div', 'clock', h.topRight);
  h.money = el('div', 'money', h.topRight);
  h.stars = el('div', 'stars', h.topRight);
  h.tide = el('div', 'tide', h.topRight);
  h.insight = el('div', 'insight', h.topRight);
  h.weapons = el('div', 'panel weapons', root);
  h.minimapBox = el('div', 'panel minimap-box', root);
  h.minimap = el('canvas', '', h.minimapBox);
  h.minimap.width = 168; h.minimap.height = 168;
  h.district = el('div', 'district', h.minimapBox);
  h.vitals = el('div', 'vitals', h.minimapBox);
  h.dialog = el('div', 'panel dialog', root);
  h.dialogName = el('div', 'dname', h.dialog);
  h.dialogText = el('div', 'dtext', h.dialog);
  h.vehicle = el('div', 'panel vehicle', root);
  h.radio = el('div', 'radio', h.vehicle);
  h.carName = el('div', 'carname', h.vehicle);
  h.cond = el('div', 'cond', h.vehicle);
  h.speed = el('div', 'speed', h.vehicle);
  h.floats = el('div', 'floats', root);
  h.controls = el('div', 'controls', root, 'WASD drive / walk &nbsp;·&nbsp; SPACE handbrake &nbsp;·&nbsp; F enter / steal &nbsp;·&nbsp; E interact &nbsp;·&nbsp; CLICK shoot &nbsp;·&nbsp; 1–4 weapons &nbsp;·&nbsp; R reload &nbsp;·&nbsp; N radio &nbsp;·&nbsp; M map &nbsp;·&nbsp; ESC pause');
  h.locationEl = el('div', 'location-card', root);
  h.title = el('div', 'title-screen', root);
  h.title.innerHTML = `<div class="gametitle">AURELIA DELTA</div>
    <div class="gamesub">PORT AURELIA · A RIVER-DELTA PORT CITY</div>
    <div class="gamefeat">8 JOBS · 5-STAR POLICE · BOATS &amp; BRIDGES</div>
    <div class="menu"><button id="btn-continue">CONTINUE</button><button id="btn-new">NEW GAME</button></div>
    <div class="menulist">MISSIONS &nbsp;·&nbsp; GARAGE &nbsp;·&nbsp; SETTINGS</div>
    <div class="menunote">Press ENTER to start — Mara Vela, 27, getaway driver. The APD framed her. Eight jobs buy her freedom.</div>`;
  h.pause = el('div', 'pause-screen', root, '<div class="gametitle small">PAUSED</div><div class="menunote">ESC to resume · R restart mission</div>');
  h.over = el('div', 'over-screen', root);
  h.sayTimer = 0;
  h.floatTimer = 0;
  h._t = 0;
  // bound helpers so missions/combat/main can call G.hud.say(...) etc.
  h.say = (name, role, text) => say(G, name, role, text);
  h.floatText = (text) => floatText(G, text);
  h.location = (name) => locationCard(G, name);
  G.hud = h;
  // title buttons
  document.getElementById('btn-new').addEventListener('click', () => G.startNewGame());
  document.getElementById('btn-continue').addEventListener('click', () => G.startNewGame());
  return h;
}

function fmtTime(G) {
  const mins = Math.floor(G.time.t / 60) % 1440;
  const hh = String(Math.floor(mins / 60) + 17).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return hh + ':' + mm;
}

function fmtTimer(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + String(ss).padStart(2, '0');
}

export function say(G, name, role, text) {
  const h = G.hud;
  h.dialogName.textContent = name + ' — ' + role;
  h.dialogText.textContent = '\u201C' + text + '\u201D';
  h.dialog.style.opacity = '1';
  h.sayTimer = 6;
}

export function floatText(G, text) {
  const h = G.hud;
  const d = document.createElement('div');
  d.className = 'float-line';
  d.textContent = text;
  h.floats.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}

export function locationCard(G, name) {
  const h = G.hud;
  h.locationEl.textContent = name;
  h.locationEl.style.opacity = '1';
  setTimeout(() => { h.locationEl.style.opacity = '0'; }, 2600);
}

function drawMinimap(G) {
  const h = G.hud;
  const c = h.minimap.getContext('2d');
  const S = 168, half = MAP.half;
  const px = (x) => ((x + half) / (half * 2)) * S;
  const pz = (z) => ((z + half) / (half * 2)) * S;
  c.clearRect(0, 0, S, S);
  c.fillStyle = '#20242a'; c.fillRect(0, 0, S, S);
  // water
  c.fillStyle = '#1e6a8a';
  c.fillRect(0, pz(MAP.canalZ0), S, S - pz(MAP.canalZ0));
  // roads
  c.strokeStyle = '#5a5a62'; c.lineWidth = 2;
  for (const x of MAP.roadsX) { c.beginPath(); c.moveTo(px(x), pz(-280)); c.lineTo(px(x), pz(150)); c.stroke(); }
  for (const z of MAP.roadsZ) { c.beginPath(); c.moveTo(px(-280), pz(z)); c.lineTo(px(280), pz(z)); c.stroke(); }
  // bridge
  c.strokeStyle = '#ffd21f'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(px(0), pz(140)); c.lineTo(px(0), pz(240)); c.stroke();
  // objective
  const st = currentStage(G);
  if (st && G.missions.state === 'active') {
    c.fillStyle = '#ffd21f';
    c.beginPath(); c.arc(px(st.x), pz(st.z), 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffd21f'; c.beginPath(); c.arc(px(st.x), pz(st.z), 9, 0, Math.PI * 2); c.stroke();
  }
  // police
  c.fillStyle = '#4a86ff';
  for (const car of G.police.cars) {
    c.beginPath(); c.arc(px(car.pos.x), pz(car.pos.z), 3, 0, Math.PI * 2); c.fill();
  }
  if (G.police.heli) {
    c.fillStyle = '#ff5a5a';
    c.beginPath(); c.arc(px(G.police.heli.position.x), pz(G.police.heli.position.z), 4, 0, Math.PI * 2); c.fill();
  }
  // player arrow
  const p = G.player;
  c.save();
  c.translate(px(p.pos.x), pz(p.pos.z));
  c.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI);
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
  c.restore();
}

export function updateHUD(G, dt) {
  const h = G.hud;
  h.root.classList.toggle('in-title', G.mode === 'title');
  h._t -= dt;
  drawMinimap(G);
  if (h.sayTimer > 0) { h.sayTimer -= dt; if (h.sayTimer <= 0) h.dialog.style.opacity = '0'; }
  if (h._t > 0) return;
  h._t = 0.15;
  const p = G.player;
  const job = currentJob(G);
  const st = currentStage(G);
  if (job && G.missions.state === 'active') {
    h.missionTitle.textContent = `MISSION ${job.id}/8 · ${job.title}`;
    h.missionObj.textContent = (st ? st.text : '') + `   STAGE ${G.missions.stage + 1}/${job.stages.length}`;
    const next = job.stages[G.missions.stage + 1];
    h.missionNext.textContent = next ? 'NEXT: ' + next.text : 'NEXT: Job complete';
    h.missionNext.textContent += '   ·   ' + fmtTimer(G.missions.timer);
  } else if (G.missions.state === 'done') {
    h.missionTitle.textContent = 'ALL 8 JOBS COMPLETE';
    h.missionObj.textContent = 'Mara vanished into the delta. The ledger is hers.';
    h.missionNext.textContent = '';
  }
  // APD panel
  const units = G.police.units;
  h.apdTitle.textContent = `APD RESPONSE — ${units.length} UNITS · CODE ${p.wanted}`;
  h.apdUnits.innerHTML = units.slice(0, 5).map((u) => `${u.name} ${u.dist}m ${u.tactic}`).join('<br>') +
    (units.length > 5 ? `<br>+${units.length - 5} more units in the search zone` : '');
  // top right
  h.clock.textContent = `DAY ${G.time.day} · ${fmtTime(G)}`;
  h.money.textContent = '$' + p.money.toLocaleString('en-US');
  h.stars.textContent = '\u2605'.repeat(p.wanted) + '\u2606'.repeat(5 - p.wanted);
  h.tide.textContent = tideLabel(G);
  const near = units[0];
  h.insight.textContent = near ? `IN SIGHT · ${near.name}` : 'NOT SPOTTED';
  // weapons
  h.weapons.innerHTML = WEAPONS.map((w, i) => {
    const sel = i === p.weapon ? ' sel' : '';
    const ammo = w.mag === 0 ? '' : ` ${p.ammo[i]}/${p.reserve[i]}`;
    return `<span class="wslot${sel}">${i + 1} ${w.name}${ammo}</span>`;
  }).join(' ');
  // district + vitals
  h.district.textContent = districtAt(p.pos.x, p.pos.z);
  h.vitals.innerHTML = `HEALTH ${Math.round(p.health)} &nbsp; ARMOUR ${Math.round(p.armour)}<br>REP ${Math.floor(p.rep / 400) + 1} DELTA LEGEND ${Math.round(p.rep)}/2.400`;
  // vehicle panel
  const stn = RADIO[G.radio.station];
  h.radio.textContent = `${stn.name} · ${stn.song} — ${stn.band}`;
  if (p.mode === 'car' && p.vehicle) {
    h.carName.textContent = p.vehicle.def.name + (p.vehicle.stolen ? '  ·  VEHICLE STOLEN' : '');
    h.cond.textContent = `CONDITION ${Math.round(p.vehicle.condition || 82)}% · NITRO ${Math.round(p.nitro)}%`;
    h.speed.textContent = Math.round(Math.abs(p.vehicle.speed) * 3.6) + ' KM/H';
  } else if (p.mode === 'boat' && p.boat) {
    h.carName.textContent = 'DELTA SKIFF';
    h.cond.textContent = `TIDE ${G.city.tide > 0.5 ? 'RISING' : 'FALLING'} · BOAT ${Math.round(p.boat.speed * 3.6)} KM/H`;
    h.speed.textContent = Math.round(Math.abs(p.boat.speed) * 3.6) + ' KM/H';
  } else {
    h.carName.textContent = 'ON FOOT — MARA VELA';
    h.cond.textContent = 'FISTS READY';
    h.speed.textContent = Math.round(p.speed * 3.6) + ' KM/H';
  }
  // overlays
  h.title.style.display = G.mode === 'title' ? 'flex' : 'none';
  h.pause.style.display = G.mode === 'pause' ? 'flex' : 'none';
  if (G.mode === 'wasted') {
    h.over.style.display = 'flex';
    h.over.innerHTML = '<div class="gametitle small">WASTED</div><div class="menunote">Mara was busted by the APD. Press ENTER to retry the job.</div>';
  } else if (G.mode === 'complete') {
    h.over.style.display = 'flex';
    h.over.innerHTML = '<div class="gametitle small">VANISHED</div><div class="menunote">All 8 jobs complete. Mara disappeared into the delta with the ledger.</div>';
  } else {
    h.over.style.display = 'none';
  }
}
