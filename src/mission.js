import * as THREE from 'three';
import { player, game, enemies, clearScene, liveFreighters } from './state.js';
import { spawnConvoy, spawnWingmen, spawnFighter, spawnCapital } from './entities.js';
import { comm, showAlert } from './hud.js';
import { sfx } from './audio.js';

export function resetGame() {
  clearScene();
  player.pos.set(0, 0, 0); player.vel.set(0, 0, 0); player.yaw = 0; player.pitch = 0;
  player.hull = player.hullMax;
  player.shields = { front: 55, back: 55, left: 55, right: 55 };
  player.shieldRegenDelay = 0;
  player.weaponEnergy = player.weaponEnergyMax;
  player.missiles = player.missilesMax;
  player.missileRegenTimer = 0;
  player.boost = player.boostMax;
  player.alive = true;
  player.group.visible = true;
  spawnConvoy();
  spawnWingmen();
  game.time = 0; game.stage = 'wave1'; game.waveTimer = 1.4;
  game.kills = 0; game.shotsFired = 0; game.shotsHit = 0;
  game.target = null; game.targetSub = null; game.lockTarget = null; game.lockProgress = 0;
  game.running = true;
  game.paused = false;
  document.getElementById('alertOverlay').hidden = true;
}

const WAVE_SPAWN_MIN_DIST = 2200, WAVE_SPAWN_MAX_DIST = 2800; // comparable to the cruiser's fixed 2600m spawn

// A random point 1000-2000m from the convoy, in a random direction -- fighters
// spawn clustered near it and fly in from there rather than appearing on top
// of the player (they already default to targeting the convoy on their own,
// see updateFighterAI in ai.js, so this just gives them distance to close).
function randomWaveOrigin() {
  const freighters = liveFreighters();
  const anchor = freighters.length ? freighters[0].pos : player.pos;
  const dist = WAVE_SPAWN_MIN_DIST + Math.random() * (WAVE_SPAWN_MAX_DIST - WAVE_SPAWN_MIN_DIST);
  const theta = Math.random() * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(theta), (Math.random() - 0.5) * 0.3, Math.sin(theta)).normalize();
  return anchor.clone().addScaledVector(dir, dist);
}
function spawnWaveAt(origin, offsets) {
  for (const [ox, oy, oz, tough] of offsets) spawnFighter(origin.x + ox, origin.y + oy, origin.z + oz, tough);
}

export function updateMissionFlow(dt) {
  if (game.stage === 'wave1') {
    game.waveTimer -= dt;
    if (game.waveTimer <= 0) {
      spawnWaveAt(randomWaveOrigin(), [[60, 10, -30], [-60, -10, 20], [10, 20, -50]]);
      game.stage = 'wave1-active';
      showAlert('WAVE 1: NTF HOSTILES INBOUND');
    }
  } else if (game.stage === 'wave1-active') {
    if (enemies.length > 0 && enemies.every(e => !e.alive)) { game.stage = 'wave2'; game.waveTimer = 2.2; comm('SECTOR CLEAR. STANDBY.'); }
  } else if (game.stage === 'wave2') {
    game.waveTimer -= dt;
    if (game.waveTimer <= 0) {
      spawnWaveAt(randomWaveOrigin(), [[70, 10, -30], [-60, -20, 30], [10, 25, -60], [-20, -10, 10, true]]);
      game.stage = 'wave2-active';
      showAlert('WAVE 2: NTF HOSTILES INBOUND');
    }
  } else if (game.stage === 'wave2-active') {
    if (enemies.length > 0 && enemies.every(e => !e.alive)) { game.stage = 'boss-intro'; game.waveTimer = 2.4; showAlert('LONG RANGE SENSORS: CRUISER CONTACT'); }
  } else if (game.stage === 'boss-intro') {
    game.waveTimer -= dt;
    if (game.waveTimer <= 0) { spawnCapital(); game.stage = 'boss-active'; }
  } else if (game.stage === 'boss-active') {
    const cap = enemies.find(e => e.kind === 'capital');
    if (cap && !cap.alive) endMission(true);
  }
}

export function endMission(won, customSub) {
  if (!game.running) return;
  game.running = false;
  const overlay = document.getElementById('endOverlay');
  const line = document.getElementById('resultLine');
  const sub = document.getElementById('resultSub');
  line.textContent = won ? 'Mission Complete' : (customSub ? 'Mission Failed' : 'Interceptor Lost');
  line.className = 'result-line ' + (won ? 'win' : 'lose');
  sub.textContent = customSub || (won ? 'NTF cruiser Ravana destroyed. Corridor is secure.' : 'Distress beacon activated. Rescue inbound.');
  document.getElementById('stat-kills').textContent = game.kills;
  const mins = Math.floor(game.time / 60), secs = Math.floor(game.time % 60);
  document.getElementById('stat-time').textContent = mins + ':' + String(secs).padStart(2, '0');
  const acc = game.shotsFired > 0 ? Math.round(100 * game.shotsHit / game.shotsFired) : 0;
  document.getElementById('stat-acc').textContent = acc + '%';
  overlay.hidden = false;
  if (won) sfx.win(); else sfx.lose();
}
