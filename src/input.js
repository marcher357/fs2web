import { canvas } from './scene.js';
import { game } from './state.js';
import { cycleTarget, cycleSubsystem } from './hud.js';
import { tryFireMissile } from './combat.js';

export const keys = Object.create(null);
export const mouse = { x: 0, y: 0, smx: 0, smy: 0, down: false, rdown: false, hasMoved: false };

document.addEventListener('keydown', e => {
  // Tab is deliberately not used for anything: browsers (especially inside an iframe,
  // which is how this page is hosted) often refuse to let content override Tab's
  // focus-navigation even with preventDefault(), so it's an unreliable game key.
  if (['KeyT', 'KeyQ', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'KeyT' && game.running) cycleTarget();
  if (e.code === 'KeyQ' && game.running) cycleSubsystem();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  mouse.hasMoved = true;
});
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) mouse.rdown = true;
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) { if (mouse.rdown) tryFireMissile(); mouse.rdown = false; }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
