// Save / load in localStorage. Autosaves after each job and at the safehouse.
import { CFG } from './config.js';

const KEY = 'aurelia-delta-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.money !== 'number' || typeof s.jobIndex !== 'number') return null;
    return s;
  } catch { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money, rep: state.rep, jobIndex: state.jobIndex,
      garageColor: state.garageColor, muted: state.muted,
      best: state.best, savedAt: Date.now(),
    }));
  } catch { /* storage unavailable: the game still plays */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function freshState() {
  return {
    money: CFG.tuning.moneyStart, rep: 0, jobIndex: 0,
    garageColor: 0xd21f2b, muted: false, best: 0,
  };
}
