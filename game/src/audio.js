// All sound is synthesised with WebAudio: engine hum, siren, radio loops
// (one chord arpeggio per station, different scales/tempos), gunshots, UI.
// No audio files, no network. Starts on the first user gesture.
import { CFG } from './config.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.station = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioTimer = null;
    this.radioStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine: sawtooth through a lowpass, pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // siren: two alternating tones
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.startRadio();
    } catch { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  setEngine(speedNorm, on) {
    if (!this.ctx) return;
    this.engineOsc.frequency.value = 50 + speedNorm * 140;
    this.engineGain.gain.value = on ? 0.05 + speedNorm * 0.05 : 0;
  }
  setSiren(on, t) {
    if (!this.ctx) return;
    this.sirenGain.gain.value = on ? 0.045 : 0;
    if (on) this.sirenOsc.frequency.value = (Math.floor(t * 1.6) % 2 === 0) ? 660 : 880;
  }
  blip(freq = 880, dur = 0.08, vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  shot() {
    if (!this.ctx || this.muted) return;
    const len = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.3;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  // Radio: a looping bass + arpeggio from the station's scale. Cheap, no files.
  startRadio() {
    if (this.radioTimer) return;
    const stepMs = 60000 / 96 / 2;
    this.radioTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const st = CFG.radio[this.station];
      const scale = st.scale;
      const step = this.radioStep++;
      const beat = step % 16;
      const root = 110;
      const note = (deg, oct = 0) => root * Math.pow(2, (scale[deg % scale.length] + 12 * oct) / 12);
      if (beat % 4 === 0) this.tone(note(0, 0), 0.22, 0.10, 'triangle');
      if (beat % 2 === 0) this.tone(note((beat / 2) % 5, 1), 0.16, 0.05, 'sine');
      if (beat === 0 || beat === 10) this.tone(note(0, 0) / 2, 0.3, 0.08, 'sawtooth');
    }, stepMs);
  }
  tone(freq, dur, vol, type) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  nextStation() {
    this.station = (this.station + 1) % CFG.radio.length;
    this.radioStep = 0;
    this.blip(660, 0.1, 0.1);
    return CFG.radio[this.station];
  }
  stationText() {
    const st = CFG.radio[this.station];
    return `${st.name} · ${st.show} — "${st.song}" — ${st.band}`;
  }
}
