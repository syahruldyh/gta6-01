// HUD: DOM panels + a canvas minimap. Simplified on purpose (Sol's review):
// the big readable elements are the wanted stars, the speed, the district
// minimap and the TIDE label. The APD panel, dialog, weapon slots and radio
// are small lines. The HUD frames the action, it never covers the subject.
import { CFG, districtAt } from './config.js';

function el(tag, cls, parent, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export class HUD {
  constructor(root) {
    this.root = root;
    const style = document.createElement('style');
    style.textContent = `
      #hud{position:fixed;inset:0;pointer-events:none;font-family:'Segoe UI',Arial,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);z-index:5}
      .panel{background:rgba(10,14,20,.62);border:1px solid rgba(255,255,255,.22);border-radius:8px;padding:8px 11px;backdrop-filter:blur(2px)}
      #mission{position:absolute;top:12px;left:12px;max-width:340px}
      #mission .t{font-weight:800;font-size:15px;letter-spacing:.4px;color:#ffd970}
      #mission .o{font-size:13px;margin-top:2px}
      #mission .s{font-size:11px;color:#cfe0f0;margin-top:3px}
      #status{position:absolute;top:12px;right:12px;text-align:right}
      #status .day{font-size:12px;color:#cfe0f0}
      #status .money{font-size:20px;font-weight:800;color:#8aff9a}
      #status .stars{font-size:26px;color:#ff2a2a;letter-spacing:2px;line-height:1.1}
      #status .tide{font-size:15px;font-weight:800;color:#7fd4ff;margin-top:2px}
      #apd{position:absolute;top:132px;left:12px;font-size:11px;color:#ffb0b0;max-width:230px}
      #lower{position:absolute;left:12px;bottom:12px}
      #minimap{width:150px;height:150px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(10,16,22,.7);display:block}
      #district{font-size:12px;font-weight:700;color:#ffd970;margin-top:4px;text-align:center}
      .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.25);margin-top:3px;overflow:hidden;width:150px}
      .bar>i{display:block;height:100%}
      #vitals{position:absolute;right:12px;bottom:12px;text-align:right}
      #vitals .car{font-size:14px;font-weight:800}
      #vitals .speed{font-size:42px;font-weight:900;line-height:1;color:#fff}
      #vitals .speed small{font-size:13px;color:#cfe0f0}
      #vitals .sub{font-size:11px;color:#cfe0f0}
      #weapons{font-size:11px;color:#d8e4f0;margin-top:2px}
      #radio{font-size:11px;color:#ffd970}
      #dialog{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);max-width:560px;text-align:center;font-size:14px}
      #dialog b{color:#ffd970}
      #toast{position:absolute;left:50%;top:18%;transform:translateX(-50%);font-size:22px;font-weight:900;color:#ffd970;text-align:center}
      #floaters{position:absolute;left:50%;top:38%;transform:translateX(-50%);font-size:18px;font-weight:800;color:#8aff9a;text-align:center}
      #cross{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid rgba(255,255,255,.85);border-radius:50%;display:none}
      #controls{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);font-size:10px;color:rgba(255,255,255,.55);white-space:nowrap}
      #screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(ellipse at 50% 30%,rgba(20,30,50,.25),rgba(5,8,14,.82));z-index:10;pointer-events:auto;text-align:center;color:#fff}
      #screen h1{font-size:56px;margin:0;letter-spacing:6px;color:#ffd970;text-shadow:0 3px 18px rgba(0,0,0,.9)}
      #screen h2{font-size:17px;margin:6px 0 18px;font-weight:400;color:#e8eef5}
      #screen .tag{font-size:13px;color:#7fd4ff;letter-spacing:2px}
      .btn{display:block;width:280px;margin:7px auto;padding:11px 0;background:rgba(255,217,112,.92);color:#16202e;border:0;border-radius:8px;font-size:16px;font-weight:800;cursor:pointer}
      .btn.alt{background:rgba(255,255,255,.16);color:#fff}
      .btn:hover{filter:brightness(1.12)}
      #screen .fine{font-size:11px;color:rgba(255,255,255,.6);margin-top:14px}
    `;
    document.head.appendChild(style);
    const hud = el('div', '', root); hud.id = 'hud';
    this.hudEl = hud;
    this.mission = el('div', 'panel', hud); this.mission.id = 'mission';
    this.missionT = el('div', 't', this.mission);
    this.missionO = el('div', 'o', this.mission);
    this.missionS = el('div', 's', this.mission);
    const status = el('div', 'panel', hud); status.id = 'status';
    this.day = el('div', 'day', status);
    this.money = el('div', 'money', status);
    this.stars = el('div', 'stars', status);
    this.tide = el('div', 'tide', status);
    this.apd = el('div', 'panel', hud); this.apd.id = 'apd';
    const lower = el('div', '', hud); lower.id = 'lower';
    this.map = el('canvas', '', lower); this.map.id = 'minimap';
    this.map.width = 150; this.map.height = 150;
    this.district = el('div', '', lower); this.district.id = 'district';
    this.hpBar = el('div', 'bar', lower); this.hpFill = el('i', '', this.hpBar);
    this.hpFill.style.background = '#4ade80';
    this.arBar = el('div', 'bar', lower); this.arFill = el('i', '', this.arBar);
    this.arFill.style.background = '#7fb4ff';
    this.rep = el('div', 'sub', lower);
    const vitals = el('div', 'panel', hud); vitals.id = 'vitals';
    this.carName = el('div', 'car', vitals);
    this.speed = el('div', 'speed', vitals);
    this.nitroBar = el('div', 'bar', vitals); this.nitroFill = el('i', '', this.nitroBar);
    this.nitroFill.style.background = '#ff9a3c';
    this.weapons = el('div', '', vitals); this.weapons.id = 'weapons';
    this.radio = el('div', '', vitals); this.radio.id = 'radio';
    this.dialog = el('div', 'panel', hud); this.dialog.id = 'dialog';
    this.toast = el('div', '', hud); this.toast.id = 'toast';
    this.floaters = el('div', '', hud); this.floaters.id = 'floaters';
    this.cross = el('div', '', hud); this.cross.id = 'cross';
    this.controls = el('div', '', hud); this.controls.id = 'controls';
    this.controls.textContent = 'WASD drive / walk · SPACE handbrake · F enter / steal car · E interact · CLICK shoot · 1-4 weapons · R reload · SHIFT nitro · N radio · M map · ESC pause';
    this.screen = el('div', '', root); this.screen.id = 'screen';
    this.mapCtx = this.map.getContext('2d');
    this.floatT = 0;
  }
  showScreen(html) { this.screen.style.display = 'flex'; this.screen.innerHTML = html; }
  hideScreen() { this.screen.style.display = 'none'; }
  setHudVisible(v) { this.hudEl.style.display = v ? 'block' : 'none'; }
  setToast(text, secs = 3) { this.toast.textContent = text; this.toastT = secs; }
  addFloater(text) {
    this.floaters.textContent = text;
    this.floatT = 2.2;
  }
  update(dt, s) {
    // s: {mission, wanted, money, day, time, tide, apd, health, armour, rep,
    //     repMax, district, car, speed, nitro, weapons, weaponIdx, radio, dialog,
    //     onFoot, map:{player, police, target, heading}}
    this.missionT.textContent = s.mission.label;
    this.missionO.textContent = s.mission.objective;
    this.missionS.textContent = `${s.mission.stage} · ${s.mission.next} · ${s.mission.timer}`;
    this.day.textContent = `DAY ${s.day} · ${s.time}`;
    this.money.textContent = '$' + s.money.toLocaleString('en-US');
    this.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 5 - s.wanted));
    this.stars.style.opacity = s.wanted > 0 ? '1' : '0.35';
    this.tide.textContent = 'TIDE: ' + s.tide;
    this.apd.innerHTML = s.apd.units > 0
      ? `APD — ${s.apd.units} UNITS · CODE ${s.wanted}<br>${s.apd.nearest}`
      : 'APD — CLEAR';
    this.district.textContent = s.district;
    this.hpFill.style.width = s.health + '%';
    this.arFill.style.width = s.armour + '%';
    this.rep.textContent = `REP ${s.repLevel} · ${s.rep}/${s.repMax}`;
    this.carName.textContent = s.car;
    this.speed.innerHTML = `${Math.round(s.speed * 3.6)} <small>KM/H</small>`;
    this.nitroFill.style.width = s.nitro + '%';
    this.weapons.textContent = s.weapons;
    this.radio.textContent = s.radio;
    this.dialog.style.display = s.dialog ? 'block' : 'none';
    if (s.dialog) this.dialog.innerHTML = s.dialog;
    this.cross.style.display = s.onFoot ? 'block' : 'none';
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast.textContent = ''; }
    if (this.floatT > 0) { this.floatT -= dt; if (this.floatT <= 0) this.floaters.textContent = ''; }
    this.drawMap(s.map);
  }
  drawMap(m) {
    const g = this.mapCtx, S = 150, C = S / 2;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#101c26'; g.fillRect(0, 0, S, S);
    const toMap = (x, z) => [C + (x / 640) * S, C + (z / 640) * S];
    // water
    g.fillStyle = '#1d5a74';
    let [x0, y0] = toMap(200, -320); g.fillRect(x0, 0, S - x0, S);
    [x0, y0] = toMap(-320, 240); g.fillRect(0, y0, S, S - y0);
    // districts (faint)
    for (const d of CFG.districts) {
      const [ax, ay] = toMap(d.x0, d.z0), [bx, by] = toMap(d.x1, d.z1);
      g.fillStyle = d.color + '44'; g.fillRect(ax, ay, bx - ax, by - ay);
    }
    // roads
    g.strokeStyle = 'rgba(220,225,230,0.75)'; g.lineWidth = 1.4;
    for (const x of CFG.streetsNS) { const [ax] = toMap(x, 0); g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, S); g.stroke(); }
    for (const z of CFG.streetsEW) { const [, ay] = toMap(0, z); g.beginPath(); g.moveTo(0, ay); g.lineTo(S, ay); g.stroke(); }
    // bridge
    g.strokeStyle = '#ffd970'; g.lineWidth = 2;
    let [ax, ay] = toMap(180, 0), [bx, by] = toMap(300, 0);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    // mission target
    if (m.target) {
      const [tx, ty] = toMap(m.target[0], m.target[1]);
      g.fillStyle = '#ffd970';
      g.save(); g.translate(tx, ty); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore();
    }
    // police dots
    g.fillStyle = '#ff4040';
    for (const p of m.police) { const [px, py] = toMap(p[0], p[1]); g.beginPath(); g.arc(px, py, 2.6, 0, Math.PI * 2); g.fill(); }
    // player arrow
    const [px, py] = toMap(m.player[0], m.player[1]);
    g.save(); g.translate(px, py); g.rotate(m.heading);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
    g.restore();
  }
}
