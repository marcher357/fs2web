import { player, game, enemies, clearScene } from './state.js';
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

export function updateMissionFlow(dt) {
  if (game.stage === 'wave1') {
    game.waveTimer -= dt;
    if (game.waveTimer <= 0) {
      spawnFighter(player.pos.x + 140, player.pos.y + 10, player.pos.z - 260);
      spawnFighter(player.pos.x - 150, player.pos.y - 10, player.pos.z - 220);
      spawnFighter(player.pos.x + 30, player.pos.y + 20, player.pos.z - 340);
      game.stage = 'wave1-active';
      showAlert('WAVE 1: NTF HOSTILES INBOUND');
    }
  } else if (game.stage === 'wave1-active') {
    if (enemies.length > 0 && enemies.every(e => !e.alive)) { game.stage = 'wave2'; game.waveTimer = 2.2; showAlert('SECTOR CLEAR. STANDBY.'); }
  } else if (game.stage === 'wave2') {
    game.waveTimer -= dt;
    if (game.waveTimer <= 0) {
      spawnFighter(player.pos.x + 160, player.pos.y + 10, player.pos.z - 260);
      spawnFighter(player.pos.x - 140, player.pos.y - 20, player.pos.z - 300);
      spawnFighter(player.pos.x + 20, player.pos.y + 30, player.pos.z - 420);
      spawnFighter(player.pos.x - 40, player.pos.y - 10, player.pos.z - 200, true);
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
