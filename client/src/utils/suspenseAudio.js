// Cinematic Web Audio Suspense Engine & Anthem Controller for HFPL 2027 Jersey Reveal
import iplSongUrl from 'virtual:ipl-song';

class SuspenseAudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.droneGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.anthemAudio = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
      if (iplSongUrl) {
        this.anthemAudio = new Audio(iplSongUrl);
        this.anthemAudio.loop = true;
        this.anthemAudio.volume = 0;
      }
      this.initialized = true;
    } catch {
      // AudioContext may be blocked before gesture
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { });
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.anthemAudio) {
      this.anthemAudio.muted = muted;
    }
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setValueAtTime(muted ? 0 : 0.22, this.ctx.currentTime);
    }
    if (this.ambBus && this.ctx) {
      this.ambBus.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  // Distant stadium crowd: looping brown/pink noise through a band-pass, with slow swells
  startStadiumAmbience(level = 0.075, fadeIn = 5) {
    this.resume();
    if (!this.ctx || this.ambSrc) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) {          // brown-ish noise = far-away crowd murmur
          last = (last + 0.035 * (Math.random() * 2 - 1)) / 1.035;
          d[i] = last * 3.2;
        }
      }
      this.ambSrc = ctx.createBufferSource();
      this.ambSrc.buffer = buf;
      this.ambSrc.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass'; band.frequency.value = 520; band.Q.value = 0.6;
      const air = ctx.createBiquadFilter();
      air.type = 'lowpass'; air.frequency.value = 1600;
      this.ambGain = ctx.createGain();
      this.ambGain.gain.setValueAtTime(0.0001, t);
      this.ambGain.gain.linearRampToValueAtTime(level, t + fadeIn);
      this.ambLevel = level;
      // slow crowd swells
      this.ambLfo = ctx.createOscillator();
      this.ambLfo.frequency.value = 0.09;
      const depth = ctx.createGain();
      depth.gain.value = level * 0.35;
      this.ambLfo.connect(depth);
      depth.connect(this.ambGain.gain);
      this.ambBus = ctx.createGain();
      this.ambBus.gain.value = this.isMuted ? 0 : 1;
      this.ambSrc.connect(band); band.connect(air); air.connect(this.ambGain);
      this.ambGain.connect(this.ambBus); this.ambBus.connect(ctx.destination);
      this.ambSrc.start(t); this.ambLfo.start(t);
    } catch { }
  }

  // crowd lifts for a moment (the reveal), then settles back
  swellStadium(peak = 2.4, hold = 1.2, settle = 4) {
    if (!this.ctx || !this.ambGain) return;
    const t = this.ctx.currentTime, g = this.ambGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.ambLevel * peak, t + 0.6);
    g.linearRampToValueAtTime(this.ambLevel * peak, t + 0.6 + hold);
    g.linearRampToValueAtTime(this.ambLevel, t + 0.6 + hold + settle);
  }

  stopStadiumAmbience(fade = 1.5) {
    if (!this.ctx || !this.ambSrc) return;
    const src = this.ambSrc, lfo = this.ambLfo, g = this.ambGain;
    this.ambSrc = this.ambLfo = this.ambGain = null;
    try {
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + fade);
      src.stop(t + fade + 0.1); lfo.stop(t + fade + 0.1);
    } catch { }
  }

  // Logo reveal: deep clean hit + bright airy shimmer chord + crowd lift
  playLogoReveal() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      this.playImpact(34, 3.2, 0.9);
      [196, 293.7, 392, 587.3, 784].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i < 2 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(f, t);
        o.detune.setValueAtTime((i % 2 ? 4 : -4), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07 / (1 + i * 0.35), t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 4.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 4.6);
      });
      this.playWhoosh(1.2, 0.12);
      this.swellStadium();
    } catch { }
  }

  // Deep Sub-Bass Heartbeat / Cinematic Impact
  playImpact(pitch = 55, duration = 1.2, volume = 0.65) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch * 1.5, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.45, t + duration * 0.8);

      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + duration);

      // Low transient click / thud
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(pitch * 3, t);
      snapOsc.frequency.exponentialRampToValueAtTime(30, t + 0.08);

      snapGain.gain.setValueAtTime(volume * 0.4, t);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      snapOsc.connect(snapGain);
      snapGain.connect(this.ctx.destination);

      snapOsc.start(t);
      snapOsc.stop(t + 0.08);
    } catch { }
  }

  // Subtle airy whoosh for text line entry
  playWhoosh(duration = 0.8, volume = 0.25) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.exponentialRampToValueAtTime(1400, t + duration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(200, t + duration);
      filter.Q.value = 3.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume, t + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(t);
      noise.stop(t + duration);
    } catch { }
  }

  // Cinematic suspense ambient drone (running during the 10-second opening)
  startSuspenseDrone() {
    this.resume();
    if (!this.ctx || this.droneOsc1) return;

    try {
      const t = this.ctx.currentTime;
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.001, t);
      this.droneGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.22, t + 2.0);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, t);
      filter.frequency.linearRampToValueAtTime(260, t + 8.0);

      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc2 = this.ctx.createOscillator();

      this.droneOsc1.type = 'sawtooth';
      this.droneOsc1.frequency.setValueAtTime(45, t); // F1 sub
      this.droneOsc2.type = 'sine';
      this.droneOsc2.frequency.setValueAtTime(45.6, t); // binaural beating

      this.droneOsc1.connect(filter);
      this.droneOsc2.connect(filter);
      filter.connect(this.droneGain);
      this.droneGain.connect(this.ctx.destination);

      this.droneOsc1.start(t);
      this.droneOsc2.start(t);
    } catch { }
  }

  stopSuspenseDrone() {
    if (!this.ctx || !this.droneGain) return;
    try {
      const t = this.ctx.currentTime;
      this.droneGain.gain.linearRampToValueAtTime(0.001, t + 0.8);
      setTimeout(() => {
        if (this.droneOsc1) {
          try { this.droneOsc1.stop(); this.droneOsc1.disconnect(); } catch { }
          this.droneOsc1 = null;
        }
        if (this.droneOsc2) {
          try { this.droneOsc2.stop(); this.droneOsc2.disconnect(); } catch { }
          this.droneOsc2 = null;
        }
      }, 900);
    } catch { }
  }

  // Tension Riser (8.0s - 10.0s)
  playTensionRiser(duration = 2.0, volume = 0.45) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(360, t + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, t);
      filter.frequency.exponentialRampToValueAtTime(1200, t + duration);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(volume, t + duration * 0.9);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration + 0.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + duration + 0.1);
    } catch { }
  }

  // Climax Reveal Horn / Impact (at 10.0s transition to jerseys)
  playClimaxHorn() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      // Multi-oscillator brass chord
      [110, 164.8, 220].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 2.5);
      });
      this.playImpact(40, 2.0, 0.9);
    } catch { }
  }

  // Triumphant Anthem (fades in as team reveals start and for final reveal)
  startAnthem(targetVolume = 0.65, fadeDuration = 2.0) {
    if (!this.anthemAudio) return;
    try {
      this.anthemAudio.muted = this.isMuted;
      this.anthemAudio.currentTime = 0;
      this.anthemAudio.volume = 0;
      const p = this.anthemAudio.play();
      if (p !== undefined) {
        p.catch(() => { });
      }
      this.fadeAnthem(targetVolume, fadeDuration);
    } catch { }
  }

  fadeAnthem(targetVol, duration = 1.5) {
    if (!this.anthemAudio) return;
    const steps = 15;
    const startVol = this.anthemAudio.volume;
    const delta = (targetVol - startVol) / steps;
    const interval = (duration * 1000) / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (!this.anthemAudio) {
        clearInterval(timer);
        return;
      }
      this.anthemAudio.volume = Math.max(0, Math.min(1, startVol + delta * currentStep));
      if (currentStep >= steps) {
        this.anthemAudio.volume = targetVol;
        clearInterval(timer);
      }
    }, interval);
  }

  stopAll() {
    this.stopSuspenseDrone();
    this.stopStadiumAmbience(0.4);
    if (this.anthemAudio) {
      try {
        this.anthemAudio.pause();
        this.anthemAudio.currentTime = 0;
      } catch { }
    }
  }
}

export const suspenseAudio = new SuspenseAudioManager();
