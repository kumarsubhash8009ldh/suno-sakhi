// Comprehensive sound effects utility for Suno Sakhi:
// 1. Branded Suno Sakhi Caller Tune (for outgoing calls: Santoor/Flute melody + Tring-Tring ringback + Hindi welcome voice)
// 2. Loud Suno Sakhi Incoming Ringtone (for incoming calls: energetic bell melody + classic double-ring + vibration + voice alert)
// 3. Dual-engine HTML5 WAV Audio + Web Audio API synthesis + aggressive mobile autoplay unlocker.

function createCallerTuneWavBlob(): Blob | null {
  try {
    const sampleRate = 22050;
    const duration = 5.4; // 5.4s Suno Sakhi Caller Tune + Telecom Ringback cycle
    const numSamples = Math.floor(sampleRate * duration);
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Part 1 (0.0s - 3.1s): Suno Sakhi Romantic Santoor & Flute Signature Melody (Raag Pahadi / Yaman)
    const melody = [
      { start: 0.00, dur: 0.26, freq: 523.25 }, // Sa (C5)
      { start: 0.26, dur: 0.26, freq: 587.33 }, // Re (D5)
      { start: 0.52, dur: 0.30, freq: 659.25 }, // Ga (E5)
      { start: 0.82, dur: 0.28, freq: 783.99 }, // Pa (G5)
      { start: 1.10, dur: 0.32, freq: 880.00 }, // Dha (A5)
      { start: 1.42, dur: 0.40, freq: 1046.50 },// High Sa (C6)
      { start: 1.84, dur: 0.26, freq: 880.00 }, // Dha (A5)
      { start: 2.10, dur: 0.28, freq: 783.99 }, // Pa (G5)
      { start: 2.38, dur: 0.30, freq: 659.25 }, // Ga (E5)
      { start: 2.68, dur: 0.45, freq: 523.25 }, // Warm Sa (C5) sustain
    ];

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      // Melodic notes
      for (const note of melody) {
        if (t >= note.start && t < note.start + note.dur) {
          const localT = t - note.start;
          const attack = Math.min(1, localT / 0.022);
          const decay = Math.exp(-localT * 3.4);
          const vibrato = 1 + 0.0045 * Math.sin(2 * Math.PI * 5.8 * localT);
          const f = note.freq * vibrato;
          const fundamental = Math.sin(2 * Math.PI * f * t);
          const secondHarmonic = 0.36 * Math.sin(2 * Math.PI * (f * 2) * t);
          const thirdHarmonic = 0.16 * Math.sin(2 * Math.PI * (f * 3) * t);
          val += (fundamental + secondHarmonic + thirdHarmonic) * attack * decay * 0.58;
        }
      }

      // Warm ambient chord pad underneath (C4 + E4 + G4)
      if (t < 3.15) {
        const padEnv = Math.sin((Math.PI * t) / 3.15) * 0.12;
        val +=
          (Math.sin(2 * Math.PI * 261.63 * t) +
            Math.sin(2 * Math.PI * 329.63 * t) +
            Math.sin(2 * Math.PI * 392.00 * t)) *
          padEnv;
      }

      // Part 2 (3.35s - 4.55s): Classic Indian Telecom "Tring-Tring" Double Ringback (400Hz + 450Hz modulated)
      const isRing1 = t >= 3.35 && t < 3.75;
      const isRing2 = t >= 3.95 && t < 4.35;
      if (isRing1 || isRing2) {
        const mod = 0.75 + 0.25 * Math.sin(2 * Math.PI * 25 * t);
        const ringTone =
          0.5 * Math.sin(2 * Math.PI * 425 * t) +
          0.5 * Math.sin(2 * Math.PI * 450 * t);
        val += ringTone * mod * 0.42;
      }

      const sample = Math.max(-32767, Math.min(32767, Math.floor(val * 32767)));
      view.setInt16(offset, sample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    console.warn('CallerTune WAV generation error:', e);
    return null;
  }
}

function createIncomingRingtoneWavBlob(): Blob | null {
  try {
    const sampleRate = 22050;
    const duration = 3.2; // 3.2s Loud Suno Sakhi Incoming Call Ringtone cycle
    const numSamples = Math.floor(sampleRate * duration);
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Bright, energetic Suno Sakhi Incoming Bell & Marimba Ringtone
    const ringtoneNotes = [
      { start: 0.00, dur: 0.18, freq: 659.25 },  // E5
      { start: 0.18, dur: 0.18, freq: 783.99 },  // G5
      { start: 0.36, dur: 0.18, freq: 987.77 },  // B5
      { start: 0.54, dur: 0.26, freq: 1318.51 }, // E6
      { start: 0.82, dur: 0.18, freq: 1174.66 }, // D6
      { start: 1.00, dur: 0.18, freq: 987.77 },  // B5
      { start: 1.18, dur: 0.22, freq: 783.99 },  // G5
      { start: 1.42, dur: 0.36, freq: 1318.51 }, // E6 bright chime
    ];

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      for (const note of ringtoneNotes) {
        if (t >= note.start && t < note.start + note.dur) {
          const localT = t - note.start;
          const attack = Math.min(1, localT / 0.012);
          const decay = Math.exp(-localT * 4.2);
          const f = note.freq;
          const f1 = Math.sin(2 * Math.PI * f * t);
          const f2 = 0.45 * Math.sin(2 * Math.PI * (f * 2) * t);
          const f3 = 0.22 * Math.sin(2 * Math.PI * (f * 3) * t);
          val += (f1 + f2 + f3) * attack * decay * 0.72;
        }
      }

      // High-attention Dual Telephone Bell Shimmer (1.88s - 2.85s)
      const bell1 = t >= 1.88 && t < 2.30;
      const bell2 = t >= 2.42 && t < 2.85;
      if (bell1 || bell2) {
        const bellMod = 0.65 + 0.35 * Math.sin(2 * Math.PI * 22 * t);
        const bellWave =
          0.55 * Math.sin(2 * Math.PI * 880 * t) +
          0.45 * Math.sin(2 * Math.PI * 1174.66 * t);
        val += bellWave * bellMod * 0.78;
      }

      const sample = Math.max(-32767, Math.min(32767, Math.floor(val * 32767)));
      view.setInt16(offset, sample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    console.warn('IncomingRingtone WAV generation error:', e);
    return null;
  }
}

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private callerTuneAudioEl: HTMLAudioElement | null = null;
  private ringtoneAudioEl: HTMLAudioElement | null = null;
  private ringInterval: number | null = null;
  private voiceTimeout: number | null = null;
  private vibrateInterval: number | null = null;
  private isRinging: boolean = false;
  private activeMode: 'caller_tune' | 'ringtone' | null = null;
  private isUnlocked: boolean = false;
  private ringVolume: number = 1.0;
  private paymentAlarmInterval: number | null = null;
  private isPaymentAlarmActive: boolean = false;

  public setRingtoneVolume(vol: number) {
    this.ringVolume = Math.max(0, Math.min(1.5, vol));
    const clampedVol = Math.min(1.0, this.ringVolume);
    if (this.callerTuneAudioEl) {
      this.callerTuneAudioEl.volume = clampedVol;
    }
    if (this.ringtoneAudioEl) {
      this.ringtoneAudioEl.volume = clampedVol;
    }
  }

  constructor() {
    this.setupHtmlAudio();
  }

  private setupHtmlAudio() {
    if (typeof window === 'undefined') return;
    try {
      const callerTuneBlob = createCallerTuneWavBlob();
      if (callerTuneBlob) {
        const url = URL.createObjectURL(callerTuneBlob);
        this.callerTuneAudioEl = new Audio(url);
        this.callerTuneAudioEl.loop = true;
        this.callerTuneAudioEl.volume = 1.0;
        this.callerTuneAudioEl.preload = 'auto';
      }

      const ringtoneBlob = createIncomingRingtoneWavBlob();
      if (ringtoneBlob) {
        const url = URL.createObjectURL(ringtoneBlob);
        this.ringtoneAudioEl = new Audio(url);
        this.ringtoneAudioEl.loop = true;
        this.ringtoneAudioEl.volume = 1.0;
        this.ringtoneAudioEl.preload = 'auto';
      }
    } catch (e) {
      console.warn('HTMLAudio setup note:', e);
    }
  }

  public initCtx(): AudioContext | null {
    try {
      if (typeof window === 'undefined') return null;
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (e) {
      console.warn('AudioContext init note:', e);
      return null;
    }
  }

  // Aggressive unlocker called on user interaction
  public unlockAudio() {
    try {
      const ctx = this.initCtx();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(ctx.destination);
        source.start(0);
      }

      if (this.isRinging) {
        if (this.activeMode === 'ringtone' && this.ringtoneAudioEl) {
          this.ringtoneAudioEl.play().catch(() => {});
        } else if (this.activeMode === 'caller_tune' && this.callerTuneAudioEl) {
          this.callerTuneAudioEl.play().catch(() => {});
        }
      }

      this.isUnlocked = true;
    } catch (e) {
      console.warn('unlockAudio note:', e);
    }
  }

  // Speak branded Hindi voice line for Suno Sakhi Caller Tune or Incoming Ringtone
  private speakSunoSakhiVoice(text: string, pitch = 1.1, rate = 1.0) {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (this.isPaymentAlarmActive) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = Math.min(1.0, Math.max(0.3, this.ringVolume));
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            (v.lang.startsWith('hi') || v.lang.startsWith('en-IN')) &&
            /female|swara|heera|kalpana|google|lekha|neerja/i.test(v.name)
        ) ||
        voices.find((v) => v.lang.startsWith('hi') || v.lang.startsWith('en-IN')) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (preferredVoice) {
        utter.voice = preferredVoice;
      }
      window.speechSynthesis.speak(utter);
    } catch {}
  }

  // Web Audio synthesis for Outgoing Suno Sakhi Caller Tune
  private playWebAudioCallerTuneCycle() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.8 * this.ringVolume, now);
      master.connect(ctx.destination);

      // Suno Sakhi Romantic 10-note Caller Tune arpeggio + Tring-Tring ringback
      const notes = [
        { f: 523.25, delay: 0.00, dur: 0.25 }, // Sa
        { f: 587.33, delay: 0.26, dur: 0.25 }, // Re
        { f: 659.25, delay: 0.52, dur: 0.28 }, // Ga
        { f: 783.99, delay: 0.82, dur: 0.26 }, // Pa
        { f: 880.00, delay: 1.10, dur: 0.30 }, // Dha
        { f: 1046.50, delay: 1.42, dur: 0.38 },// Sa'
        { f: 880.00, delay: 1.84, dur: 0.25 }, // Dha
        { f: 783.99, delay: 2.10, dur: 0.26 }, // Pa
        { f: 659.25, delay: 2.38, dur: 0.28 }, // Ga
        { f: 523.25, delay: 2.68, dur: 0.45 }, // Sa
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const g = ctx.createGain();
        const og = ctx.createGain();

        osc.type = 'sine';
        overtone.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, now + n.delay);
        overtone.frequency.setValueAtTime(n.f * 2, now + n.delay);

        g.gain.setValueAtTime(0, now + n.delay);
        g.gain.linearRampToValueAtTime(0.7, now + n.delay + 0.022);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur);

        og.gain.setValueAtTime(0, now + n.delay);
        og.gain.linearRampToValueAtTime(0.22, now + n.delay + 0.018);
        og.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur * 0.8);

        osc.connect(g);
        overtone.connect(og);
        g.connect(master);
        og.connect(master);

        osc.start(now + n.delay);
        overtone.start(now + n.delay);
        osc.stop(now + n.delay + n.dur + 0.04);
        overtone.stop(now + n.delay + n.dur + 0.04);
      });

      // Classic Telecom Ringback Double-Tone ("Tring-Tring") at 3.35s and 3.95s
      [3.35, 3.95].forEach((ringStart) => {
        const r1 = ctx.createOscillator();
        const r2 = ctx.createOscillator();
        const rg = ctx.createGain();
        r1.type = 'sine';
        r2.type = 'sine';
        r1.frequency.setValueAtTime(425, now + ringStart);
        r2.frequency.setValueAtTime(450, now + ringStart);
        rg.gain.setValueAtTime(0, now + ringStart);
        rg.gain.linearRampToValueAtTime(0.32, now + ringStart + 0.02);
        rg.gain.setValueAtTime(0.32, now + ringStart + 0.35);
        rg.gain.linearRampToValueAtTime(0.001, now + ringStart + 0.40);
        r1.connect(rg);
        r2.connect(rg);
        rg.connect(master);
        r1.start(now + ringStart);
        r2.start(now + ringStart);
        r1.stop(now + ringStart + 0.42);
        r2.stop(now + ringStart + 0.42);
      });
    } catch (e) {
      console.warn('Web Audio caller tune cycle error:', e);
    }
  }

  // Web Audio synthesis for Incoming Suno Sakhi Ringtone (Loud & Energetic)
  private playWebAudioIncomingRingCycle() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.95 * this.ringVolume, now);
      master.connect(ctx.destination);

      const notes = [
        { f: 659.25, delay: 0.00, dur: 0.17 },  // E5
        { f: 783.99, delay: 0.18, dur: 0.17 },  // G5
        { f: 987.77, delay: 0.36, dur: 0.17 },  // B5
        { f: 1318.51, delay: 0.54, dur: 0.25 }, // E6
        { f: 1174.66, delay: 0.82, dur: 0.17 }, // D6
        { f: 987.77, delay: 1.00, dur: 0.17 },  // B5
        { f: 783.99, delay: 1.18, dur: 0.20 },  // G5
        { f: 1318.51, delay: 1.42, dur: 0.35 }, // E6
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const harmonic = ctx.createOscillator();
        const g = ctx.createGain();
        const hg = ctx.createGain();

        osc.type = 'triangle';
        harmonic.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.delay);
        harmonic.frequency.setValueAtTime(n.f * 2, now + n.delay);

        g.gain.setValueAtTime(0, now + n.delay);
        g.gain.linearRampToValueAtTime(0.85, now + n.delay + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur);

        hg.gain.setValueAtTime(0, now + n.delay);
        hg.gain.linearRampToValueAtTime(0.35, now + n.delay + 0.012);
        hg.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur * 0.75);

        osc.connect(g);
        harmonic.connect(hg);
        g.connect(master);
        hg.connect(master);

        osc.start(now + n.delay);
        harmonic.start(now + n.delay);
        osc.stop(now + n.delay + n.dur + 0.03);
        harmonic.stop(now + n.delay + n.dur + 0.03);
      });

      // Loud Dual-Bell Telephone Ring bursts (1.88s and 2.42s)
      [1.88, 2.42].forEach((bellStart) => {
        const b1 = ctx.createOscillator();
        const b2 = ctx.createOscillator();
        const bg = ctx.createGain();
        b1.type = 'triangle';
        b2.type = 'sine';
        b1.frequency.setValueAtTime(880, now + bellStart);
        b2.frequency.setValueAtTime(1174.66, now + bellStart);
        bg.gain.setValueAtTime(0, now + bellStart);
        bg.gain.linearRampToValueAtTime(0.75, now + bellStart + 0.015);
        bg.gain.setValueAtTime(0.75, now + bellStart + 0.36);
        bg.gain.linearRampToValueAtTime(0.001, now + bellStart + 0.42);
        b1.connect(bg);
        b2.connect(bg);
        bg.connect(master);
        b1.start(now + bellStart);
        b2.start(now + bellStart);
        b1.stop(now + bellStart + 0.44);
        b2.stop(now + bellStart + 0.44);
      });
    } catch (e) {
      console.warn('Web Audio incoming ringtone error:', e);
    }
  }

  // Dedicated Suno Sakhi Caller Tune (Outgoing Calls — NEVER vibrates caller's phone)
  public startCallerTune(sakhiName?: string) {
    this.startRingtone({ vibrate: false, mode: 'caller_tune', sakhiName });
  }

  // Dedicated Suno Sakhi Incoming Ringtone (Incoming Calls — Loud ring + Vibration)
  public startIncomingRingtone(callerName?: string) {
    this.startRingtone({ vibrate: true, mode: 'ringtone', sakhiName: callerName });
  }

  // Universal entry point: automatically selects Caller Tune (outgoing) vs Ringtone (incoming)
  public startRingtone(options?: {
    vibrate?: boolean;
    mode?: 'caller_tune' | 'ringtone';
    sakhiName?: string;
  }) {
    try {
      const isIncoming = options?.mode === 'ringtone' || options?.vibrate === true;
      const targetMode: 'caller_tune' | 'ringtone' = isIncoming ? 'ringtone' : 'caller_tune';

      // If already ringing in the exact same mode, just ensure audio is unlocked/playing
      if (this.isRinging && this.activeMode === targetMode) {
        const activeEl = isIncoming ? this.ringtoneAudioEl : this.callerTuneAudioEl;
        if (activeEl && activeEl.paused) {
          activeEl.play().catch(() => {});
        }
        return;
      }

      // Clean stop any previous cycle before starting fresh
      this.stopRingtone();
      this.isRinging = true;
      this.activeMode = targetMode;

      if (isIncoming) {
        // ============================================================
        // 1. INCOMING SUNO SAKHI RINGTONE (LOUD BELL + VIBRATION)
        // ============================================================
        if (this.ringtoneAudioEl) {
          this.ringtoneAudioEl.currentTime = 0;
          this.ringtoneAudioEl.volume = Math.min(1.0, this.ringVolume);
          this.ringtoneAudioEl.play().catch(() => {});
        }

        this.initCtx();
        this.playWebAudioIncomingRingCycle();

        this.voiceTimeout = window.setTimeout(() => {
          if (this.isRinging && this.activeMode === 'ringtone') {
            this.speakSunoSakhiVoice(
              'Suno Sakhi par incoming call aa rahi hai. Kripya call receive karein.',
              1.08,
              1.02
            );
          }
        }, 900);

        let cycleCount = 0;
        this.ringInterval = window.setInterval(() => {
          if (!this.isRinging || this.activeMode !== 'ringtone') return;
          cycleCount += 1;
          this.playWebAudioIncomingRingCycle();
          if (cycleCount % 3 === 0) {
            this.speakSunoSakhiVoice(
              'Suno Sakhi par incoming call aa rahi hai.',
              1.08,
              1.02
            );
          }
        }, 3200);

        const triggerVibrate = () => {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([1000, 400, 1000, 400, 1200]);
          }
        };
        triggerVibrate();
        this.vibrateInterval = window.setInterval(() => {
          if (!this.isRinging) return;
          triggerVibrate();
        }, 3000);
      } else {
        // ============================================================
        // 2. OUTGOING SUNO SAKHI CALLER TUNE (MELODY + VOICE + RINGBACK)
        // ============================================================
        if (this.callerTuneAudioEl) {
          this.callerTuneAudioEl.currentTime = 0;
          this.callerTuneAudioEl.volume = Math.min(1.0, this.ringVolume);
          this.callerTuneAudioEl.play().catch(() => {});
        }

        this.initCtx();
        this.playWebAudioCallerTuneCycle();

        // Branded Suno Sakhi Caller Tune voice welcome
        this.voiceTimeout = window.setTimeout(() => {
          if (this.isRinging && this.activeMode === 'caller_tune') {
            const partner = options?.sakhiName ? options.sakhiName : 'aapki Sakhi';
            this.speakSunoSakhiVoice(
              `Suno Sakhi mein aapka swagat hai. Dil se dil ki baat, ${partner} se aapki call connect ho rahi hai, kripya line par bane rahein.`,
              1.12,
              0.98
            );
          }
        }, 500);

        let callerCycleCount = 0;
        this.ringInterval = window.setInterval(() => {
          if (!this.isRinging || this.activeMode !== 'caller_tune') return;
          callerCycleCount += 1;
          this.playWebAudioCallerTuneCycle();
          if (callerCycleCount % 2 === 0) {
            this.speakSunoSakhiVoice(
              'Suno Sakhi caller tune... Aapki call jald hi connect hone wali hai.',
              1.12,
              0.98
            );
          }
        }, 5400);

        // Outgoing calls NEVER vibrate the caller's phone
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(0);
        }
      }
    } catch (e) {
      console.warn('startRingtone error:', e);
    }
  }

  public stopRingtone() {
    try {
      this.isRinging = false;
      this.activeMode = null;

      if (this.callerTuneAudioEl) {
        this.callerTuneAudioEl.pause();
        this.callerTuneAudioEl.currentTime = 0;
      }
      if (this.ringtoneAudioEl) {
        this.ringtoneAudioEl.pause();
        this.ringtoneAudioEl.currentTime = 0;
      }

      if (this.ringInterval) {
        clearInterval(this.ringInterval);
        this.ringInterval = null;
      }
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      if (this.vibrateInterval) {
        clearInterval(this.vibrateInterval);
        this.vibrateInterval = null;
      }

      if (!this.isPaymentAlarmActive && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    } catch (e) {
      console.warn('stopRingtone error:', e);
    }
  }

  // Uplifting chord when call connects (loud & clear)
  public playCallConnected() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.45, now + i * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.55);
      });
    } catch (e) {
      console.warn('playCallConnected error:', e);
    }
  }

  // Warm descending chime when call ends
  public playCallEnded() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [659.25, 587.33, 493.88]; // E5, D5, B4

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0.35, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
      });
    } catch (e) {
      console.warn('playCallEnded error:', e);
    }
  }

  // Beep when low balance (<1 min remaining)
  public playLowBalanceWarning() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.15);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('playLowBalanceWarning error:', e);
    }
  }

  // Coin drop / recharge success sound
  public playCoinSound() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const tones = [987.77, 1318.51]; // B5, E6

      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);

        gain.gain.setValueAtTime(0.45, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.5);
      });
    } catch (e) {
      console.warn('playCoinSound error:', e);
    }
  }

  // Crisp, musical 4-note crystal chime ring for incoming chat messages
  public playMessageReceived() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([160, 70, 200]);
      }

      const now = ctx.currentTime;
      const notes = [
        { freq: 783.99, time: 0.0, duration: 0.18, vol: 0.75 },   // G5
        { freq: 987.77, time: 0.09, duration: 0.20, vol: 0.80 },  // B5
        { freq: 1174.66, time: 0.18, duration: 0.24, vol: 0.85 }, // D6
        { freq: 1567.98, time: 0.28, duration: 0.55, vol: 0.92 }, // G6 crystal bell sustain
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const harmonic = ctx.createOscillator();
        const gain = ctx.createGain();
        const hGain = ctx.createGain();

        osc.type = 'sine';
        harmonic.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, now + note.time);
        harmonic.frequency.setValueAtTime(note.freq * 2, now + note.time);

        gain.gain.setValueAtTime(0, now + note.time);
        gain.gain.linearRampToValueAtTime(note.vol, now + note.time + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

        hGain.gain.setValueAtTime(0, now + note.time);
        hGain.gain.linearRampToValueAtTime(note.vol * 0.25, now + note.time + 0.015);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration * 0.7);

        osc.connect(gain);
        harmonic.connect(hGain);
        gain.connect(ctx.destination);
        hGain.connect(ctx.destination);

        osc.start(now + note.time);
        harmonic.start(now + note.time);
        osc.stop(now + note.time + note.duration + 0.05);
        harmonic.stop(now + note.time + note.duration + 0.05);
      });
    } catch (e) {
      console.warn('playMessageReceived error:', e);
    }
  }

  // Loud, crystal-clear 5-tone melodious Soundbox chime (Paytm / PhonePe Soundbox style)
  public playPaymentReceivedSound(amount?: number) {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: 0, dur: 0.22, vol: 0.75 },    // C5
        { freq: 659.25, time: 0.12, dur: 0.22, vol: 0.8 },  // E5
        { freq: 783.99, time: 0.24, dur: 0.25, vol: 0.85 }, // G5
        { freq: 1046.5, time: 0.36, dur: 0.35, vol: 0.9 },  // C6
        { freq: 1318.51, time: 0.52, dur: 0.5, vol: 0.95 }, // E6
        { freq: 1567.98, time: 0.68, dur: 0.7, vol: 1.0 },  // G6
        { freq: 2093.00, time: 0.84, dur: 0.9, vol: 0.85 }  // High harmonic bell
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(0, now + n.time);
        gain.gain.linearRampToValueAtTime(n.vol, now + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur + 0.05);
      });

      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(2637, now + 0.8);
      shimmerGain.gain.setValueAtTime(0, now + 0.8);
      shimmerGain.gain.linearRampToValueAtTime(0.45, now + 0.82);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(ctx.destination);
      shimmer.start(now + 0.8);
      shimmer.stop(now + 1.45);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([600, 200, 600, 200, 800]);
      }
    } catch (e) {
      console.warn('playPaymentReceivedSound error:', e);
    }
  }

  // Long looping alarm / ringtone + Voice announcement for Admin when payment is received
  public startPaymentReceivedAlarm(amount?: number, info?: string) {
    if (this.isPaymentAlarmActive) return;
    this.isPaymentAlarmActive = true;

    this.playPaymentReceivedSound(amount);

    const speakAnnouncement = () => {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const announcement = amount && amount > 0
            ? `Suno Sakhi par ${amount} rupaye ka naya payment prapt hua hai. Kripya UTR verify karein.`
            : 'Suno Sakhi par naya payment prapt hua hai. Kripya check karein.';
          const utter = new SpeechSynthesisUtterance(announcement);
          utter.rate = 1.0;
          utter.pitch = 1.05;
          utter.volume = 1.0;
          const voices = window.speechSynthesis.getVoices();
          const hiVoice = voices.find((v) => v.lang.startsWith('hi') || v.lang.startsWith('en-IN') || v.lang.startsWith('en'));
          if (hiVoice) utter.voice = hiVoice;
          window.speechSynthesis.speak(utter);
        }
      } catch (err) {
        console.warn('Speech synthesis warning:', err);
      }
    };

    setTimeout(() => {
      if (this.isPaymentAlarmActive) speakAnnouncement();
    }, 1200);

    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('💰 Naya Payment Prapt Hua! - SunoSakhi', {
          body: amount ? `₹${amount} ka payment verify karne ke liye aaya hai.` : 'Naya payment request prapt hua hai.',
          icon: '/favicon.ico'
        });
      }
    } catch {}

    let elapsed = 0;
    if (this.paymentAlarmInterval) clearInterval(this.paymentAlarmInterval);
    this.paymentAlarmInterval = window.setInterval(() => {
      if (!this.isPaymentAlarmActive) {
        if (this.paymentAlarmInterval) clearInterval(this.paymentAlarmInterval);
        return;
      }
      elapsed += 5;
      if (elapsed > 35) {
        this.stopPaymentReceivedAlarm();
        return;
      }
      this.playPaymentReceivedSound(amount);
      speakAnnouncement();
    }, 5000);
  }

  public stopPaymentReceivedAlarm() {
    this.isPaymentAlarmActive = false;
    if (this.paymentAlarmInterval) {
      clearInterval(this.paymentAlarmInterval);
      this.paymentAlarmInterval = null;
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    } catch {}
  }

  public isPaymentAlarmPlaying(): boolean {
    return this.isPaymentAlarmActive;
  }
}

export const sounds = new SoundSynthesizer();

// Global aggressive audio unlocker on user interaction (touch/click/scroll/pointer)
if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'];
  const handleGlobalUnlock = () => {
    sounds.unlockAudio();
  };
  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, handleGlobalUnlock, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sounds.initCtx();
    }
  });
}
