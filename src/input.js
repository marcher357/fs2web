import { canvas } from './scene.js';
import { game, player } from './state.js';
import { clamp } from './utils.js';
import { cycleTarget, cycleSubsystem } from './hud.js';
import { tryFireMissile } from './combat.js';

export const keys = Object.create(null);
export const mouse = { x: 0, y: 0, smx: 0, smy: 0, down: false, rdown: false, hasMoved: false };

// The steering scheme reads cursor offset from screen center as a turn rate,
// which invites moving the mouse far from center -- easy to drift the real
// cursor off the edge of the canvas (or the browser window) while playing,
// after which clicks land outside the game and stop registering entirely.
// Pointer Lock captures the OS cursor into the canvas once play starts so it
// physically can't leave; we fall back to normal absolute-position tracking
// whenever it isn't engaged (before first click, or if the browser/embedding
// context denies it, or the player releases it with Escape).
export function requestPointerLock() {
  if (document.pointerLockElement === canvas || !canvas.requestPointerLock) return;
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && typeof p.catch === 'function') p.catch(() => { try { canvas.requestPointerLock(); } catch (e) {} });
  } catch (e) {}
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    const r = canvas.getBoundingClientRect();
    mouse.x = r.width / 2;
    mouse.y = r.height / 2;
  }
});

document.addEventListener('keydown', e => {
  // Tab is deliberately not used for anything: browsers (especially inside an iframe,
  // which is how this page is hosted) often refuse to let content override Tab's
  // focus-navigation even with preventDefault(), so it's an unreliable game key.
  if (['KeyT', 'KeyQ', 'KeyM', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Backspace'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'KeyT' && game.running) cycleTarget();
  if (e.code === 'KeyQ' && game.running) cycleSubsystem();
  if (e.code === 'Backspace' && game.running) player.vel.set(0, 0, 0);
  if (e.code === 'KeyM' && game.running && game.target && game.target.alive) player.vel.copy(game.target.vel);
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas) {
    const r = canvas.getBoundingClientRect();
    // Clamp generously past the edges rather than to them -- the steering math
    // already clamps the normalized turn axis to +/-1, so this only needs to
    // keep the (invisible, locked) virtual cursor from drifting unboundedly,
    // not to reproduce the exact canvas bounds.
    mouse.x = clamp(mouse.x + e.movementX, -r.width * 0.5, r.width * 1.5);
    mouse.y = clamp(mouse.y + e.movementY, -r.height * 0.5, r.height * 1.5);
  } else {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  mouse.hasMoved = true;
});
canvas.addEventListener('mousedown', e => {
  requestPointerLock();
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) mouse.rdown = true;
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) { if (mouse.rdown) tryFireMissile(); mouse.rdown = false; }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
