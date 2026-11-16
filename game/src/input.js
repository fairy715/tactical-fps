// Keyboard and mouse into the player's command: pointer-locked mouse look (slower through the
// scope), WASD with crouch, walk and jump, left button to fire, right button to scope, and keys
// for reload, use, buy, gear, scores and sound. One command object is reused every step.
export function createInput(canvas, handlers) {
  const keys = new Set();
  const cmd = { fwd: 0, side: 0, crouch: false, walk: false, jump: false, fire: false, firePressed: false, scope: false, reload: false, use: false, grenade: false };
  const look = { dx: 0, dy: 0 };
  let scope = false;
  let firePressed = false;
  const pulses = { reload: false, grenade: false };

  canvas.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== canvas) {
      handlers.onLockRequest();
      return;
    }
    if (e.button === 0) {
      keys.add('mouse0');
      firePressed = true;
    }
    if (e.button === 2) scope = !scope;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) keys.delete('mouse0');
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    look.dx += e.movementX;
    look.dy += e.movementY;
  });
  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (['Tab', 'Space', 'ControlLeft', 'KeyB'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === 'KeyR') pulses.reload = true;
    if (k === 'KeyG') pulses.grenade = true;
    if (k === 'KeyB') handlers.onBuy();
    if (k === 'Tab') handlers.onBoard(true);
    if (k === 'KeyM') handlers.onMute();
    if (k.startsWith('Digit')) handlers.onDigit(Number(k.slice(5)));
    if (k === 'Escape') handlers.onEscape();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'Tab') handlers.onBoard(false);
  });
  window.addEventListener('blur', () => keys.clear());

  return {
    /** Applies mouse look to the soldier and returns this step's command. */
    read(s) {
      const sens = 0.0022 / (s.scoped ? s.gun.def.zoom * 0.8 : 1);
      s.yaw -= look.dx * sens;
      s.pitch = Math.max(-1.4, Math.min(1.4, s.pitch - look.dy * sens));
      look.dx = look.dy = 0;
      cmd.fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      cmd.side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      cmd.crouch = keys.has('ControlLeft') || keys.has('KeyC');
      cmd.walk = keys.has('ShiftLeft');
      cmd.jump = keys.has('Space');
      cmd.fire = keys.has('mouse0');
      cmd.firePressed = firePressed;
      firePressed = false;
      cmd.use = keys.has('KeyE');
      if (s.gun.reloading > 0 || !s.alive) scope = false;
      cmd.scope = scope;
      cmd.reload = pulses.reload;
      cmd.grenade = pulses.grenade;
      pulses.reload = pulses.grenade = false;
      return cmd;
    },
    /** Drops the scope (the bolt cycled, or the round reset). */
    unscope() {
      scope = false;
    },
  };
}
