// Prozeduraler Klang (Web Audio): Stationsbrummen, Wind, Oberflaechen-Toene. Keine Audiodateien noetig.
let ctx = null, master = null, volume = 0.5;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return true;
  } catch (e) {
    ctx = null;
    return false;
  }
}

function ambient() {
  // Tiefes Brummen aus zwei leicht verstimmten Oszillatoren
  const drone = ctx.createGain();
  drone.gain.value = 0.06;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 320;
  [55, 55.7, 82.4].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 2 ? 'sine' : 'sawtooth';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = i === 2 ? 0.5 : 0.3;
    o.connect(g).connect(lp);
    o.start();
  });
  // langsame Bewegung im Filter
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  lp.connect(drone).connect(master);

  // Wind / Luftstrom aus gefiltertem Rauschen
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 500;
  bp.Q.value = 0.6;
  const ng = ctx.createGain();
  ng.gain.value = 0.05;
  noise.connect(bp).connect(ng).connect(master);
  noise.start();
}

function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const Audio = {
  start(vol) {
    volume = vol;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!this._ambient) { ambient(); this._ambient = true; }
  },
  setVolume(v) { volume = v; if (master) master.gain.value = v; },
  blip(freq = 600, dur = 0.05) { tone(freq, dur, 'triangle', 0.08); },
  chime(mul = 1) { [523, 659, 784].forEach((f, i) => tone(f * mul * 0.5, 0.6, 'sine', 0.07, i * 0.07)); },
  whoosh(dur = 0.8) { tone(180, dur, 'sawtooth', 0.04, 0, 60); tone(90, dur, 'sine', 0.06, 0, 40); },
  sweep(dur = 1) { tone(300, dur, 'sine', 0.06, 0, 1600); }
};
