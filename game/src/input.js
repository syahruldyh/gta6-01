// Input: keyboard + mouse look, with edge-triggered action keys.
export function initInput(G) {
  const input = {
    forward: false, back: false, left: false, right: false, handbrake: false,
    interact: false, shoot: false, mouseDX: 0, mouseDY: 0,
    _pressed: new Set(), _queue: [],
  };
  G.input = input;
  const map = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (map[e.code] !== undefined) { input[map[e.code]] = true; e.preventDefault(); }
    if (!e.repeat) input._queue.push(e.code);
    if (e.code === 'KeyF') input.interact = true;
  });
  window.addEventListener('keyup', (e) => {
    if (map[e.code] !== undefined) input[map[e.code]] = false;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.shoot = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.shoot = false;
  });
  window.addEventListener('mousemove', (e) => {
    input.mouseDX += e.movementX || 0;
    input.mouseDY += e.movementY || 0;
  });
  return input;
}

// Returns and clears the codes pressed since the last call.
export function pressedKeys(G) {
  const q = G.input._queue;
  G.input._queue = [];
  return q;
}
