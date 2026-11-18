// Keyboard + mouse. WASD drive/walk, mouse look on foot, F enter/steal,
// E interact, click shoot, 1-4 weapons, R reload, Shift nitro, N radio,
// M map (toggles the minimap size), Esc pause. Also exposes a scripted
// input object the shots.js autopilot writes into.
import { clamp } from './config.js';

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;
    this.onKey = null; // (code, down) -> void, set by main.js
    this.onClick = null;
    this.onWheel = null;
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.onKey) this.onKey(e.code, true);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; if (this.onKey) this.onKey(e.code, false); });
    canvas.addEventListener('mousedown', e => {
      this.mouseDown = true;
      if (this.onClick) this.onClick(e.button);
      if (!this.locked && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
  }
  // Driving / walking intent for this frame.
  drive() {
    return {
      throttle: !!(this.keys['KeyW'] || this.keys['ArrowUp']),
      brake: !!(this.keys['KeyS'] || this.keys['ArrowDown']),
      left: !!(this.keys['KeyA'] || this.keys['ArrowLeft']),
      right: !!(this.keys['KeyD'] || this.keys['ArrowRight']),
      handbrake: !!this.keys['Space'],
      nitro: !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']),
    };
  }
  walk() {
    return {
      fwd: (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0),
      strafe: (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0),
      run: !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']),
    };
  }
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
}
