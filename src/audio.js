let actx = null;
export function audioInit() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
}

function beep(freq, dur, type, gainStart, glideTo) {
  if (!actx) return;
  const t0 = actx.currentTime, osc = actx.createOscillator(), gain = actx.createGain();
  osc.type = type || 'square'; osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
  gain.gain.setValueAtTime(gainStart != null ? gainStart : 0.12, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(actx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, gainStart, filterFreq) {
  if (!actx) return;
  const t0 = actx.currentTime, n = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, n, actx.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource(); src.buffer = buf;
  const gain = actx.createGain(); gain.gain.setValueAtTime(gainStart != null ? gainStart : 0.25, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const filt = actx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.setValueAtTime(filterFreq || 2200, t0);
  src.connect(filt).connect(gain).connect(actx.destination); src.start(t0);
}

export const sfx = {
  laser() { beep(980, 0.09, 'sawtooth', 0.07, 620); },
  hit() { beep(220, 0.08, 'square', 0.08, 90); },
  shieldHit() { beep(500, 0.12, 'sine', 0.09, 260); },
  explosion(big) { noiseBurst(big ? 0.9 : 0.45, big ? 0.45 : 0.28, big ? 900 : 1500); beep(big ? 90 : 140, big ? 0.5 : 0.25, 'triangle', 0.12, 30); },
  lock() { beep(1400, 0.05, 'sine', 0.06); },
  lockOn() { beep(1700, 0.12, 'sine', 0.1, 2200); },
  missile() { noiseBurst(0.3, 0.15, 600); beep(160, 0.3, 'sawtooth', 0.08, 340); },
  alert() { beep(700, 0.14, 'square', 0.07, 700); },
  win() { beep(660, 0.15, 'sine', 0.1, 660); setTimeout(() => beep(880, 0.25, 'sine', 0.1, 880), 140); },
  lose() { beep(220, 0.4, 'sawtooth', 0.1, 60); },
};
