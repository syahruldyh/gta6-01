// Audio: all WebAudio synth — engine hum, siren, radio jingles, gunshots. No files.
import { RADIO } from './config.js';

export function initAudio(G) {
  G.audio = {
    ctx: null, master: null, engine: null, engineGain: null, siren: null, sirenGain: null,
    station: 0, started: false,
    sfx(name) { sfx(G, name); },
    setStation(i) { G.radio.station = ((i % RADIO.length) + RADIO.length) % RADIO.length; },
  };
  G.radio = { station: 0 };
}

function ensureCtx(G) {
  const a = G.audio;
  if (a.ctx) return true;
  try {
    a.ctx = new (window.AudioContext || window.webkitAudioContext)();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.35;
    a.master.connect(a.ctx.destination);
    // engine: low sawtooth + lowpass
    a.engine = a.ctx.createOscillator();
    a.engine.type = 'sawtooth';
    a.engine.frequency.value = 60;
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    a.engineGain = a.ctx.createGain(); a.engineGain.gain.value = 0;
    a.engine.connect(lp); lp.connect(a.engineGain); a.engineGain.connect(a.master);
    a.engine.start();
    // siren: two-tone triangle, slow LFO
    a.siren = a.ctx.createOscillator();
    a.siren.type = 'triangle';
    a.siren.frequency.value = 700;
    a.sirenGain = a.ctx.createGain(); a.sirenGain.gain.value = 0;
    const lfo = a.ctx.createOscillator();
    lfo.frequency.value = 0.8;
    const lfoGain = a.ctx.createGain(); lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(a.siren.frequency);
    a.siren.connect(a.sirenGain); a.sirenGain.connect(a.master);
    a.siren.start(); lfo.start();
    a.started = true;
    return true;
  } catch {
    return false;
  }
}

export function updateAudio(G, dt) {
  const a = G.audio;
  if (!a.started) return;
  if (a.ctx.state === 'suspended') a.ctx.resume();
  const p = G.player;
  // engine pitch follows speed
  const spd = p.mode === 'car' && p.vehicle ? Math.abs(p.vehicle.speed) : p.mode === 'boat' && p.boat ? Math.abs(p.boat.speed) : 0;
  a.engine.frequency.value = 55 + spd * 2.2;
  a.engineGain.gain.value = p.mode === 'foot' ? 0 : 0.05 + Math.min(0.1, spd * 0.002);
  // siren when wanted >= 2
  a.sirenGain.gain.value = G.police.wanted >= 2 ? 0.035 : 0;
}

export function sfx(G, name) {
  const a = G.audio;
  if (!a.started || !ensureCtx(G)) return;
  const ctx = a.ctx;
  const t = ctx.currentTime;
  if (name === 'shot') {
    const o = ctx.createOscillator();
    o.type = 'square'; o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    o.connect(g); g.connect(a.master);
    o.start(t); o.stop(t + 0.13);
  } else if (name === 'punch') {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    o.connect(g); g.connect(a.master);
    o.start(t); o.stop(t + 0.11);
  } else if (name === 'pickup') {
    for (const [f, d] of [[660, 0], [880, 0.09]]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, t + d);
      g.gain.exponentialRampToValueAtTime(0.01, t + d + 0.18);
      o.connect(g); g.connect(a.master);
      o.start(t + d); o.stop(t + d + 0.2);
    }
  } else if (name === 'jingle') {
    // radio station jingle: three notes
    const notes = [523, 659, 784];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.1, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.25);
      o.connect(g); g.connect(a.master);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3);
    });
  }
}

export function unlockAudio(G) {
  ensureCtx(G);
}
