// Audio Synthesizer using Web Audio API (Zero external assets required, 100% reliable)

let audioCtx = null;
let isSoundEnabled = true;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const toggleSound = () => {
  isSoundEnabled = !isSoundEnabled;
  return isSoundEnabled;
};

export const getSoundStatus = () => isSoundEnabled;

// 1. SOLD Gavel Sound + Celebratory Trumpet chord
export const playSoldSound = () => {
  if (!isSoundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Gavel Strike: Wood impact (low thud + sharp noise burst)
  const oscThud = ctx.createOscillator();
  const gainThud = ctx.createGain();
  oscThud.type = 'triangle';
  oscThud.frequency.setValueAtTime(120, now);
  oscThud.frequency.exponentialRampToValueAtTime(35, now + 0.15);
  gainThud.gain.setValueAtTime(1.0, now);
  gainThud.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  oscThud.connect(gainThud);
  gainThud.connect(ctx.destination);
  oscThud.start(now);
  oscThud.stop(now + 0.25);

  // Second Gavel strike at +0.22s
  const oscThud2 = ctx.createOscillator();
  const gainThud2 = ctx.createGain();
  oscThud2.type = 'triangle';
  oscThud2.frequency.setValueAtTime(110, now + 0.22);
  oscThud2.frequency.exponentialRampToValueAtTime(30, now + 0.38);
  gainThud2.gain.setValueAtTime(1.2, now + 0.22);
  gainThud2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  oscThud2.connect(gainThud2);
  gainThud2.connect(ctx.destination);
  oscThud2.start(now + 0.22);
  oscThud2.stop(now + 0.45);

  // Third Gavel strike at +0.45s (SOLD!)
  const oscThud3 = ctx.createOscillator();
  const gainThud3 = ctx.createGain();
  oscThud3.type = 'triangle';
  oscThud3.frequency.setValueAtTime(140, now + 0.45);
  oscThud3.frequency.exponentialRampToValueAtTime(25, now + 0.7);
  gainThud3.gain.setValueAtTime(1.5, now + 0.45);
  gainThud3.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  oscThud3.connect(gainThud3);
  gainThud3.connect(ctx.destination);
  oscThud3.start(now + 0.45);
  oscThud3.stop(now + 0.8);

  // Fanfare celebratory chime arpeggio: C5 - E5 - G5 - C6
  const chordNotes = [523.25, 659.25, 783.99, 1046.50];
  chordNotes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noteStart = now + 0.5 + idx * 0.12;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteStart);

    gain.gain.setValueAtTime(0.3, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 0.6);
  });
};

// 2. Crisp electronic Bid Ding
export const playBidSound = () => {
  if (!isSoundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now); // A5
  osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08); // A6
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.35);
};

// 3. Unsold descending chime
export const playUnsoldSound = () => {
  if (!isSoundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.5);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.6);
};

// 4. Countdown Beep (Warm stadium countdown tick)
export const playCountdownTick = (isFinal = false) => {
  if (!isSoundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  if (isFinal) {
    osc.frequency.setValueAtTime(1046.5, now); // C6 bright start tone
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  } else {
    osc.frequency.setValueAtTime(587.33, now); // D5 tick
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + (isFinal ? 0.55 : 0.2));
};

