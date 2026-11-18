// Save: autosave + slots in localStorage.
const KEY = 'aurelia-delta-save-v1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      money: p.money, rep: p.rep, mission: G.missions.index,
      health: p.health, armour: p.armour,
      x: p.pos.x, z: p.pos.z, day: G.time.day, t: G.time.t,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
