import * as THREE from 'three';
import { camera } from './scene.js';
import { clamp, lerp, TAU, projectToScreen, forwardFromYawPitch, UP } from './utils.js';
import { player, game, enemies, wingmen, landmarks, liveWingmen, liveFreighters, floaters, setFloaters } from './state.js';
import { mouse } from './input.js';

export function comm(msg) {
  const el = document.getElementById('comms');
  const d = document.createElement('div'); d.className = 'comm-msg'; d.textContent = msg;
  el.appendChild(d); setTimeout(() => d.remove(), 3100);
}
export function floatText(pos, text, color) { floaters.push({ pos: pos.clone(), text, color: color || '#eafcff', life: 1.0 }); }

// Fighters/wingmen show as {class name, callsign}; capital ships (proper
// names) show as {proper name, class}; freighters have no class at all, so
// they just show their name with no subtitle.
export function targetLabels(t) {
  if (t.kind === 'capital') return { primary: t.name, secondary: t.klass };
  if (t.klass) return { primary: t.klass, secondary: t.name };
  return { primary: t.name, secondary: '' };
}
export function targetHullPct(t) {
  return t.kind === 'capital' ? t.core.hp / t.core.hpMax : t.hull / t.hullMax;
}

// A blocking "incoming transmission" dialog for mission-stage changes (new
// wave, sector clear, boss contact) -- unlike comm()'s transient toasts, this
// pauses play (see game.paused in main.js's loop) until the player acks it.
const alertOverlay = document.getElementById('alertOverlay');
export function showAlert(msg) {
  game.paused = true;
  document.getElementById('alertMsg').textContent = msg;
  alertOverlay.hidden = false;
}
function hideAlert() {
  alertOverlay.hidden = true;
  game.paused = false;
}
document.getElementById('alertOkBtn').addEventListener('click', hideAlert);
document.addEventListener('keydown', e => {
  if (!alertOverlay.hidden && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
    e.preventDefault();
    hideAlert();
  }
});

export function cycleTarget() {
  const live = enemies.filter(e => e.alive).sort((a, b) => player.pos.distanceTo(a.pos) - player.pos.distanceTo(b.pos));
  if (live.length === 0) { game.target = null; comm('NO CONTACTS IN RANGE'); return; }
  let idx = game.target ? live.indexOf(game.target) : -1;
  idx = (idx + 1) % live.length;
  game.target = live[idx]; game.targetSub = null; game.lockTarget = null; game.lockProgress = 0;
  comm('TARGET: ' + (game.target.kind === 'capital' ? game.target.name : game.target.klass).toUpperCase());
}
export function cycleFriendlyTarget() {
  const live = [...liveWingmen(), ...liveFreighters()].sort((a, b) => player.pos.distanceTo(a.pos) - player.pos.distanceTo(b.pos));
  if (live.length === 0) { comm('NO FRIENDLY CONTACTS'); return; }
  let idx = (game.target && !game.target.kind) ? live.indexOf(game.target) : -1;
  idx = (idx + 1) % live.length;
  game.target = live[idx]; game.targetSub = null; game.lockTarget = null; game.lockProgress = 0;
  comm('TARGET: ' + game.target.name.toUpperCase());
}
export function cycleSubsystem() {
  const t = game.target;
  if (!t || !t.alive || t.kind !== 'capital') return;
  if (game.targetSub === null) game.targetSub = 0;
  else { game.targetSub++; if (game.targetSub >= t.subsystems.length) game.targetSub = null; }
}

export function nearestEnemyToCrosshair(w, h, maxPx) {
  let best = null, bestD = maxPx;
  for (const e of enemies) {
    if (!e.alive) continue;
    const s = projectToScreen(camera, e.pos, w, h);
    if (s.behind) continue;
    const d = Math.hypot(s.x - mouse.x, s.y - mouse.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function nearestHoverTarget(w, h, maxPx) {
  let best = null, bestD = maxPx;
  for (const t of [...enemies, ...liveWingmen(), ...liveFreighters()]) {
    if (!t.alive) continue;
    const s = projectToScreen(camera, t.pos, w, h);
    if (s.behind) continue;
    const d = Math.hypot(s.x - mouse.x, s.y - mouse.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}
export function drawHoverTooltip(w, h) {
  const tip = document.getElementById('hoverTooltip');
  const t = nearestHoverTarget(w, h, 40);
  if (!t) { tip.hidden = true; return; }
  tip.hidden = false;
  const isHostile = !!t.kind;
  tip.classList.toggle('hostile', isHostile);
  tip.classList.toggle('friendly', !isHostile);
  const labels = targetLabels(t);
  document.getElementById('hoverName').textContent = labels.primary;
  const classEl = document.getElementById('hoverClass');
  classEl.textContent = labels.secondary;
  classEl.style.display = labels.secondary ? 'block' : 'none';
  const hpct = clamp(targetHullPct(t), 0, 1);
  const fill = document.getElementById('hoverHullFill');
  fill.style.width = (hpct * 100) + '%';
  fill.style.background = hpct > 0.5 ? 'linear-gradient(90deg,#0a5a34,var(--hull-ok))' : hpct > 0.22 ? 'linear-gradient(90deg,#6a4a10,var(--hull-warn))' : 'linear-gradient(90deg,#6a1010,var(--hull-crit))';
  document.getElementById('hoverHullText').textContent = Math.round(hpct * 100) + '% HULL';
  tip.style.transform = 'translate(' + (mouse.x + 16) + 'px,' + (mouse.y + 16) + 'px)';
}

let currentObjectiveLabel = 'NAV';
export function getObjective() {
  const cap = enemies.find(e => e.kind === 'capital' && e.alive);
  if (cap) { currentObjectiveLabel = 'CRUISER'; return cap.pos; }
  if (landmarks.length) { currentObjectiveLabel = 'CONVOY'; return landmarks[0].pos; }
  return null;
}

export function drawNavMarker(w, h) {
  const navEl = document.getElementById('navMarker');
  const diamond = document.getElementById('navDiamond');
  const arrow = document.getElementById('navArrow');
  const label = document.getElementById('navLabel');
  const objective = getObjective();
  if (!objective || !game.running) { navEl.style.display = 'none'; return; }
  navEl.style.display = 'block';
  const s = projectToScreen(camera, objective, w, h);
  const cx = w / 2, cy = h / 2;
  const margin = 46;
  const onScreen = !s.behind && s.x > margin && s.x < w - margin && s.y > margin && s.y < h - margin;
  let ex, ey, ang;
  if (onScreen) {
    ex = s.x; ey = s.y;
    diamond.style.display = 'block'; arrow.style.display = 'none';
  } else {
    let dx = s.x - cx, dy = s.y - cy;
    if (s.behind) { dx = -dx; dy = -dy; }
    ang = Math.atan2(dy, dx);
    const R = Math.min(w, h) / 2 - 48;
    ex = cx + Math.cos(ang) * R; ey = cy + Math.sin(ang) * R;
    diamond.style.display = 'none'; arrow.style.display = 'block';
    arrow.style.transform = 'rotate(' + (ang * 180 / Math.PI + 90) + 'deg)';
  }
  navEl.style.transform = 'translate(' + ex + 'px,' + ey + 'px)';
  const distM = Math.round(player.pos.distanceTo(objective));
  label.textContent = currentObjectiveLabel + ' ' + distM + 'M';
}

export function drawTargetRing(w, h) {
  const ring = document.getElementById('targetRing');
  const dirEl = document.getElementById('targetDirMarker');
  const arrow = document.getElementById('targetArrow');
  const t = game.target;
  if (!t || !t.alive) { ring.style.display = 'none'; dirEl.style.display = 'none'; return; }
  const s = projectToScreen(camera, t.pos, w, h);
  const cx = w / 2, cy = h / 2;
  const margin = 40;
  const onScreen = !s.behind && s.x > margin && s.x < w - margin && s.y > margin && s.y < h - margin;
  if (onScreen) {
    ring.style.display = 'block';
    ring.style.transform = 'translate(' + s.x + 'px,' + s.y + 'px)';
    dirEl.style.display = 'none';
  } else {
    ring.style.display = 'none';
    let dx = s.x - cx, dy = s.y - cy;
    if (s.behind) { dx = -dx; dy = -dy; }
    const ang = Math.atan2(dy, dx);
    const R = Math.min(w, h) / 2 - 42;
    const ex = cx + Math.cos(ang) * R, ey = cy + Math.sin(ang) * R;
    dirEl.style.display = 'block';
    dirEl.style.transform = 'translate(' + ex + 'px,' + ey + 'px)';
    arrow.style.transform = 'rotate(' + (ang * 180 / Math.PI + 90) + 'deg)';
  }
}

let bracketEls = null;
export function drawLockBracket(w, h) {
  const box = document.getElementById('lockBox');
  if (!bracketEls) {
    bracketEls = [];
    for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'lock-bracket'; box.appendChild(d); bracketEls.push(d); }
  }
  const t = game.lockTarget;
  if (mouse.rdown && t && t.alive) {
    const s = projectToScreen(camera, t.pos, w, h);
    const sizeBase = game.lockProgress >= 1 ? 22 : lerp(40, 22, game.lockProgress);
    const positions = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = positions[i];
      bracketEls[i].style.left = (s.x + sx * sizeBase - 4) + 'px';
      bracketEls[i].style.top = (s.y + sy * sizeBase - 4) + 'px';
      bracketEls[i].classList.toggle('visible', !s.behind);
    }
  } else {
    for (const el of bracketEls) el.classList.remove('visible');
  }
}

export function drawCrosshair() {
  document.getElementById('crosshair').style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
}

let floaterEls = [];
export function drawFloaters(w, h) {
  for (const el of floaterEls) el.remove();
  floaterEls = [];
  for (const f of floaters) {
    const s = projectToScreen(camera, f.pos, w, h);
    if (s.behind) continue;
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.font = '600 12px Orbitron, sans-serif';
    el.style.color = f.color;
    el.style.opacity = clamp(f.life, 0, 1);
    el.style.pointerEvents = 'none';
    el.style.zIndex = 9;
    el.textContent = f.text;
    document.getElementById('hud').appendChild(el);
    floaterEls.push(el);
  }
}

export function tickFloaters(dt) {
  for (const f of floaters) { f.life -= dt * 0.9; f.pos.y += dt * 4; }
  setFloaters(floaters.filter(f => f.life > 0));
}

const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');
export function drawRadar() {
  const rw = radarCanvas.width, rh = radarCanvas.height;
  radarCtx.clearRect(0, 0, rw, rh);
  radarCtx.strokeStyle = 'rgba(77,232,255,0.25)';
  radarCtx.beginPath(); radarCtx.arc(rw / 2, rh / 2, Math.min(rw, rh) / 2 - 4, 0, TAU); radarCtx.stroke();
  radarCtx.beginPath(); radarCtx.moveTo(rw / 2, 4); radarCtx.lineTo(rw / 2, rh - 4); radarCtx.moveTo(4, rh / 2); radarCtx.lineTo(rw - 4, rh / 2); radarCtx.stroke();
  const range = 1600, maxR = Math.min(rw, rh) / 2 - 6, scale = maxR / range;
  const yaw = player.yaw;
  for (const e of enemies) {
    if (!e.alive) continue;
    const rel = e.pos.clone().sub(player.pos);
    const rx = rel.x * Math.cos(-yaw) - rel.z * Math.sin(-yaw);
    const rz = rel.x * Math.sin(-yaw) + rel.z * Math.cos(-yaw);
    let px = rx * scale, py = rz * scale;
    const d = Math.hypot(px, py);
    if (d > maxR) { px = px / d * maxR; py = py / d * maxR; }
    radarCtx.fillStyle = e.kind === 'capital' ? '#ff8f5a' : '#ff5d5d';
    radarCtx.beginPath(); radarCtx.arc(rw / 2 + px, rh / 2 + py, e.kind === 'capital' ? 4 : 2.4, 0, TAU); radarCtx.fill();
  }
  for (const l of liveFreighters()) {
    const rel = l.pos.clone().sub(player.pos);
    const rx = rel.x * Math.cos(-yaw) - rel.z * Math.sin(-yaw);
    const rz = rel.x * Math.sin(-yaw) + rel.z * Math.cos(-yaw);
    let px = rx * scale, py = rz * scale;
    const d = Math.hypot(px, py);
    if (d > maxR) { px = px / d * maxR; py = py / d * maxR; }
    radarCtx.fillStyle = '#6dffb0';
    radarCtx.beginPath(); radarCtx.arc(rw / 2 + px, rh / 2 + py, 3, 0, TAU); radarCtx.fill();
  }
  for (const wm of liveWingmen()) {
    const rel = wm.pos.clone().sub(player.pos);
    const rx = rel.x * Math.cos(-yaw) - rel.z * Math.sin(-yaw);
    const rz = rel.x * Math.sin(-yaw) + rel.z * Math.cos(-yaw);
    let px = rx * scale, py = rz * scale;
    const d = Math.hypot(px, py);
    if (d > maxR) { px = px / d * maxR; py = py / d * maxR; }
    radarCtx.fillStyle = '#bfe0ff';
    radarCtx.beginPath(); radarCtx.arc(rw / 2 + px, rh / 2 + py, 2.2, 0, TAU); radarCtx.fill();
  }
  radarCtx.fillStyle = '#8ff0ff';
  radarCtx.beginPath(); radarCtx.arc(rw / 2, rh / 2, 3, 0, TAU); radarCtx.fill();
}

export function updateHUD() {
  const sp = player.vel.length();
  document.getElementById('bar-speed').style.width = clamp(sp / 150 * 100, 0, 100) + '%';
  document.getElementById('speed-val').textContent = Math.round(sp);
  document.getElementById('bar-boost').style.width = clamp(player.boost / player.boostMax * 100, 0, 100) + '%';
  const driftForward = forwardFromYawPitch(player.yaw, player.pitch);
  const driftRight = new THREE.Vector3().crossVectors(driftForward, UP).normalize();
  const vFwd = player.vel.dot(driftForward), vRight = player.vel.dot(driftRight);
  const driftMax = 150; // matches the un-boosted max speed clamp in main.js
  const dx = clamp(vRight / driftMax, -1, 1), dy = clamp(-vFwd / driftMax, -1, 1);
  const dot = document.getElementById('drift-dot');
  dot.style.left = (50 + dx * 44) + '%';
  dot.style.top = (50 + dy * 44) + '%';
  document.getElementById('bar-weapon').style.width = clamp(player.weaponEnergy / player.weaponEnergyMax * 100, 0, 100) + '%';
  document.getElementById('missile-count').textContent = player.missiles;
  const wingAlive = liveWingmen();
  document.getElementById('wing-count').textContent = wingAlive.length > 0 ? wingAlive.map(w => w.name.replace('Alpha ', 'A')).join(' ') : 'LOST';
  const hf = document.getElementById('hull-fill');
  const hpct = player.hull / player.hullMax;
  hf.style.width = clamp(hpct * 100, 0, 100) + '%';
  hf.style.background = hpct > 0.5 ? 'linear-gradient(90deg,#0a5a34,var(--hull-ok))' : hpct > 0.22 ? 'linear-gradient(90deg,#6a4a10,var(--hull-warn))' : 'linear-gradient(90deg,#6a1010,var(--hull-crit))';

  for (const q of ['front', 'back', 'left', 'right']) {
    const el = document.getElementById('sq-' + q);
    const pct = clamp(player.shields[q] / player.shieldMax, 0, 1);
    el.style.opacity = 0.18 + pct * 0.75;
    el.style.background = pct > 0 ? 'rgba(90,209,255,' + (0.25 + pct * 0.5) + ')' : 'rgba(120,40,40,.35)';
  }

  const tp = document.getElementById('panel-target');
  if (game.target && game.target.alive) {
    tp.classList.add('active');
    const labels = targetLabels(game.target);
    document.getElementById('t-name').textContent = labels.primary;
    document.getElementById('t-class').textContent = labels.secondary;
    let hullPct;
    if (game.target.kind === 'capital') {
      if (game.targetSub != null && game.target.subsystems[game.targetSub]) {
        const s = game.target.subsystems[game.targetSub];
        hullPct = s.alive ? s.hp / s.hpMax : 0;
        document.getElementById('t-sub').textContent = 'SUBSYSTEM: ' + s.name.toUpperCase() + (s.alive ? '' : ' (DESTROYED)');
      } else {
        hullPct = game.target.core.hp / game.target.core.hpMax;
        document.getElementById('t-sub').textContent = 'TARGETING CORE HULL';
      }
    } else {
      hullPct = game.target.hull / game.target.hullMax;
      document.getElementById('t-sub').textContent = '';
    }
    document.getElementById('t-hullfill').style.width = clamp(hullPct * 100, 0, 100) + '%';
    document.getElementById('t-dist').textContent = Math.round(player.pos.distanceTo(game.target.pos)) + ' m';
  } else {
    tp.classList.remove('active');
  }
}
