// Sound, all synthesised with Web Audio (no files): each career's rifle has its own report, placed
// left or right and fading with distance; footsteps, the bolt, reloads, hit ticks, the charge's
// quickening beep, the glitter blast, flashes, smoke, and round stingers. Sound starts on the
// first click (browsers require it).
const A = { ctx: null, master: null, muted: false, noise: null };

const REPORT = {
  boss: { freq: 120, cut: 2600, q: 0.8 },
  playboy: { freq: 180, cut: 3400, q: 1.6 },
  chef: { freq: 95, cut: 1900, q: 0.7 },
  teacher: { freq: 150, cut: 4200, q: 2.2 },
  office: { freq: 110, cut: 3000, q: 1.2 },
  nurse: { freq: 210, cut: 5200, q: 3 },
};

export function unlockAudio() {
  if (A.ctx) {
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  A.ctx = new Ctx();
  A.master = A.ctx.createGain();
  A.master.gain.value = A.muted ? 0 : 0.55;
  A.master.connect(A.ctx.destination);
  const len = A.ctx.sampleRate * 2;
  A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const data = A.noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  ambience();
}

export function toggleMute() {
  A.muted = !A.muted;
  if (A.master) A.master.gain.value = A.muted ? 0 : 0.55;
  return A.muted;
}

/** A gain and stereo pan for a sound at (x, z) heard by the listener. */
function place(listener, x, z, volume) {
  const ctx = A.ctx;
  const gain = ctx.createGain();
  const d = listener ? Math.hypot(x - listener.pos.x, z - listener.pos.z) : 0;
  gain.gain.value = volume / (1 + d * 0.08);
  const pan = ctx.createStereoPanner();
  if (listener && d > 0.5) {
    const rel = Math.atan2(x - listener.pos.x, z - listener.pos.z) + listener.yaw;
    pan.pan.value = Math.max(-1, Math.min(1, -Math.sin(rel)));
  }
  gain.connect(pan).connect(A.master);
  return gain;
}

function noise(out, at, length, cutoff, type = 'lowpass', q = 1) {
  const src = A.ctx.createBufferSource();
  src.buffer = A.noise;
  const f = A.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = cutoff;
  f.Q.value = q;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(1, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + length);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random());
  src.stop(at + length + 0.05);
}

function tone(out, at, freq, length, type = 'sine', vol = 0.4, slide = 0) {
  const o = A.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), at + length);
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + length + 0.05);
}

function ambience() {
  const src = A.ctx.createBufferSource();
  src.buffer = A.noise;
  src.loop = true;
  const f = A.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 380;
  const g = A.ctx.createGain();
  g.gain.value = 0.05;
  src.connect(f).connect(g).connect(A.master);
  src.start();
}

/** Plays the sounds for a step's events, heard by listener (the soldier whose view is shown). */
export function playEvents(world, events, listener) {
  if (!A.ctx || A.muted) return;
  const now = A.ctx.currentTime;
  let steps = 0;
  for (const e of events) {
    if (e.type === 'shot') {
      const s = world.soldiers[e.id];
      const r = REPORT[s.role.id];
      const near = s === listener;
      const out = place(listener, s.pos.x, s.pos.z, near ? 0.9 : 1.6);
      noise(out, now, near ? 0.35 : 0.6, r.cut, 'lowpass', r.q);
      tone(out, now, r.freq, 0.25, 'sine', 0.7, 0.4);
      if (near && s.gun.def.rpm < 60) tone(out, now + 0.45, 900, 0.05, 'square', 0.08); // the bolt
    } else if (e.type === 'step' && steps < 2) {
      const s = world.soldiers[e.id];
      if (s === listener) continue;
      steps++;
      noise(place(listener, e.x, e.z, 0.5), now, 0.07, 700, 'bandpass', 2);
    } else if (e.type === 'hit' && e.shooter === listener.id) {
      tone(A.master, now + 0.02, e.head ? 1600 : 900, 0.08, 'triangle', 0.25);
      if (e.head) tone(A.master, now + 0.06, 2400, 0.12, 'triangle', 0.2);
    } else if (e.type === 'hit' && e.victim === listener.id) {
      noise(A.master, now, 0.18, 400, 'lowpass');
    } else if (e.type === 'reload' && e.id === listener.id) {
      tone(A.master, now, 500, 0.05, 'square', 0.08);
      tone(A.master, now + 0.5, 700, 0.05, 'square', 0.08);
    } else if (e.type === 'dry' && e.id === listener.id) {
      tone(A.master, now, 1200, 0.03, 'square', 0.05);
    } else if (e.type === 'planted') {
      tone(A.master, now, 880, 0.2, 'square', 0.12);
      tone(A.master, now + 0.25, 1320, 0.3, 'square', 0.12);
    } else if (e.type === 'detonated') {
      const out = place(listener, e.x, e.z, 2.2);
      noise(out, now, 1.4, 900);
      for (let i = 0; i < 6; i++) tone(out, now + i * 0.08, 600 + i * 220, 0.3, 'triangle', 0.15);
    } else if (e.type === 'combo') {
      const out = place(listener, e.x, e.z, 2);
      (e.team === 'def' ? [523, 659, 784, 1046, 1318] : [196, 247, 294, 392, 494]).forEach((f, i) => tone(out, now + i * 0.06, f, 0.5, 'sawtooth', 0.09));
      noise(out, now, 0.8, 1800, 'bandpass', 0.8);
    } else if (e.type === 'defused') {
      [660, 880, 1100].forEach((f, i) => tone(A.master, now + i * 0.1, f, 0.25, 'triangle', 0.15));
    } else if (e.type === 'burst') {
      const out = place(listener, e.x, e.z, 1.3);
      if (e.kind === 'flash') noise(out, now, 0.25, 5000, 'highpass');
      else if (e.kind === 'smoke' || e.kind === 'slow') noise(out, now, 1.2, e.kind === 'slow' ? 900 : 600);
      else if (e.kind === 'frag') {
        noise(out, now, 0.9, 700);
        for (let i = 0; i < 5; i++) tone(out, now + 0.05 + i * 0.06, 2600 + i * 300, 0.08, 'triangle', 0.08);
      } else if (e.kind === 'fire') noise(out, now, 1.6, 1400, 'bandpass', 0.6);
      else if (e.kind === 'charm') [880, 1175, 1568].forEach((f, i) => tone(out, now + i * 0.07, f, 0.35, 'sine', 0.12));
    } else if (e.type === 'roundOver' || e.type === 'matchOver') {
      const won = listener && e.winner === listener.team;
      (won ? [523, 659, 784] : [392, 330, 262]).forEach((f, i) => tone(A.master, now + i * 0.15, f, 0.5, 'triangle', 0.18));
    } else if (e.type === 'live') {
      tone(A.master, now, 740, 0.15, 'square', 0.08);
    } else if (e.type === 'buy') {
      if (world.soldiers[e.id] === listener) tone(A.master, now, 1046, 0.1, 'triangle', 0.12);
    }
  }
}

/** The planted charge's beep, quickening as the timer runs down. */
export function chargeBeep(world, listener, dt) {
  if (!A.ctx || A.muted || world.bomb.state !== 'planted') return;
  A.beep = (A.beep || 0) - dt;
  if (A.beep > 0) return;
  A.beep = Math.max(0.12, world.bomb.timer / 40);
  tone(place(listener, world.bomb.x, world.bomb.z, 1.2), A.ctx.currentTime, 1900, 0.06, 'square', 0.15);
}
