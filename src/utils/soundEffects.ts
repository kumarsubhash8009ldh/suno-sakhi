// Clean, soothing, realistic telephone & smartphone audio synthesis for Suno Sakhi:
// 1. Outgoing Call (Caller): Authentic, gentle Normal Phone Dialing Ringback Tone ("Tuuu... Tuuu...", 425Hz/450Hz comfort sine wave)
// 2. Incoming Call (Host/Receiver): Pleasant, warm Smartphone Marimba/Kalimba Ringtone (soft mid-range harmonic notes, zero harshness)
// 3. Message Notification: Soft, brief 2-note water-drop chime (gentle & non-intrusive)

/**
 * Generates a clean 4.0-second Normal Phone Call Ringback WAV ("Tuuu... Tuuu...")
 * Standard telecom comfort tone: 425 Hz + 450 Hz pure sine wave, 1.4s ON, 2.6s OFF
 */
function createNormalDialingToneWavBlob(): Blob | null {
  try {
    const sampleRate = 22050;
    const duration = 4.0; // 1.4s tone + 2.6s silence (standard mobile call ringback cadence)
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

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      // Standard Indian/International mobile ringback: two gentle pulses ("Tring-Tring" / "Tuuu-Tuuu")
      // Pulse 1: 0.10s to 0.50s, Pulse 2: 0.70s to 1.15s, Silence: 1.15s to 4.00s
      const inPulse1 = t >= 0.10 && t <= 0.50;
      const inPulse2 = t >= 0.70 && t <= 1.15;

      if (inPulse1 || inPulse2) {
        const pStart = inPulse1 ? 0.10 : 0.70;
        const pEnd = inPulse1 ? 0.50 : 1.15;
        const pLen = pEnd - pStart;
        const localT = t - pStart;

        // Smooth 30ms fade-in and fade-out to avoid any click
        const fadeIn = Math.min(1, localT / 0.03);
        const fadeOut = Math.min(1, (pLen - localT) / 0.03);
        const env = fadeIn * fadeOut;

        // Standard telecom 400Hz + 450Hz comfort sine wave
        const wave =
          0.55 * Math.sin(2 * Math.PI * 400 * t) +
          0.45 * Math.sin(2 * Math.PI * 450 * t);

        val = wave * env * 0.34;
      }

      const sample = Math.max(-32767, Math.min(32767, Math.floor(val * 32767)));
      view.setInt16(offset, sample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    console.warn('Normal dialing tone WAV generation error:', e);
    return null;
  }
}

/**
 * Generates a warm, pleasant 3.6-second Smartphone Marimba / Kalimba Ringtone WAV for Host Incoming Calls.
 * Uses soothing mid-range notes (C4 - E4 - G4 - B4 - C5 - G4 - E4) with warm wooden marimba decay.
 */
function createPleasantPhoneRingtoneWavBlob(): Blob | null {
  try {
    const sampleRate = 22050;
    const duration = 3.6;
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

    // Warm, soothing iPhone/Smartphone style Marimba pattern (G Major / E Minor pentatonic)
    const notes = [
      { start: 0.05, dur: 0.45, freq: 392.00, amp: 0.45 }, // G4
      { start: 0.27, dur: 0.45, freq: 493.88, amp: 0.48 }, // B4
      { start: 0.49, dur: 0.50, freq: 587.33, amp: 0.50 }, // D5
      { start: 0.72, dur: 0.65, freq: 659.25, amp: 0.52 }, // E5
      { start: 1.05, dur: 0.45, freq: 587.33, amp: 0.48 }, // D5
      { start: 1.28, dur: 0.50, freq: 493.88, amp: 0.46 }, // B4
      { start: 1.52, dur: 0.75, freq: 523.25, amp: 0.50 }, // C5
      { start: 1.85, dur: 0.90, freq: 392.00, amp: 0.45 }, // G4 warm sustain
    ];

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      for (const n of notes) {
        if (t >= n.start && t < n.start + n.dur) {
          const localT = t - n.start;
          // Soft 18ms attack + natural marimba exponential decay
          const attack = Math.min(1, localT / 0.018);
          const decay = Math.exp(-localT * 4.5);
          // Warm fundamental sine + subtle 4th harmonic (classic wooden marimba timbre)
          const fundamental = Math.sin(2 * Math.PI * n.freq * localT);
          const warmOctave = 0.18 * Math.sin(2 * Math.PI * (n.freq * 2) * localT) * Math.exp(-localT * 8);
          val += (fundamental + warmOctave) * attack * decay * n.amp;
        }
      }

      // Soft warm bass root note (G3 = 196Hz) for richness
      if (t >= 0.05 && t < 2.5) {
        const bassT = t - 0.05;
        const bassEnv = Math.min(1, bassT / 0.04) * Math.exp(-bassT * 1.6);
        val += Math.sin(2 * Math.PI * 196.0 * bassT) * bassEnv * 0.16;
      }

      const clamped = Math.max(-0.92, Math.min(0.92, val));
      const sample = Math.floor(clamped * 32767);
      view.setInt16(offset, sample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    console.warn('Pleasant ringtone WAV generation error:', e);
    return null;
  }
}

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private callerTuneAudioEl: HTMLAudioElement | null = null;
  private ringtoneAudioEl: HTMLAudioElement | null = null;
  private ringInterval: number | null = null;
  private vibrateInterval: number | null = null;
  private isRinging: boolean = false;
  private activeMode: 'caller_tune' | 'ringtone' | null = null;
  private ringVolume: number = 0.85;
  private paymentAlarmInterval: number | null = null;
  private isPaymentAlarmActive: boolean = false;

  public setRingtoneVolume(vol: number) {
    this.ringVolume = Math.max(0.05, Math.min(1.0, vol));
    if (this.callerTuneAudioEl) {
      this.callerTuneAudioEl.volume = Math.min(0.75, this.ringVolume);
    }
    if (this.ringtoneAudioEl) {
      this.ringtoneAudioEl.volume = Math.min(1.0, this.ringVolume);
    }
  }

  constructor() {
    this.setupHtmlAudio();
  }

  private setupHtmlAudio() {
    if (typeof window === 'undefined') return;
    try {
      const dialBlob = createNormalDialingToneWavBlob();
      if (dialBlob) {
        const url = URL.createObjectURL(dialBlob);
        this.callerTuneAudioEl = new Audio(url);
        this.callerTuneAudioEl.loop = true;
        this.callerTuneAudioEl.volume = 0.65;
        this.callerTuneAudioEl.preload = 'auto';
      }

      const ringtoneBlob = createPleasantPhoneRingtoneWavBlob();
      if (ringtoneBlob) {
        const url = URL.createObjectURL(ringtoneBlob);
        this.ringtoneAudioEl = new Audio(url);
        this.ringtoneAudioEl.loop = true;
        this.ringtoneAudioEl.volume = 0.85;
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
      return null;
    }
  }

  public unlockAudio() {
    try {
      const ctx = this.initCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (this.isRinging) {
        if (this.activeMode === 'ringtone' && this.ringtoneAudioEl && this.ringtoneAudioEl.paused) {
          this.ringtoneAudioEl.play().catch(() => {});
        } else if (this.activeMode === 'caller_tune' && this.callerTuneAudioEl && this.callerTuneAudioEl.paused) {
          this.callerTuneAudioEl.play().catch(() => {});
        }
      }
    } catch {}
  }

  // Fallback Web Audio normal dial tone ONLY if HTML5 Audio is blocked by browser policy
  private playFallbackNormalDialCycle() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      [0.1, 0.7].forEach((startOffset) => {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.type = 'sine';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(400, now + startOffset);
        o2.frequency.setValueAtTime(450, now + startOffset);
        g.gain.setValueAtTime(0.001, now + startOffset);
        g.gain.linearRampToValueAtTime(0.18 * this.ringVolume, now + startOffset + 0.03);
        g.gain.setValueAtTime(0.18 * this.ringVolume, now + startOffset + 0.36);
        g.gain.linearRampToValueAtTime(0.001, now + startOffset + 0.40);
        o1.connect(g);
        o2.connect(g);
        g.connect(ctx.destination);
        o1.start(now + startOffset);
        o2.start(now + startOffset);
        o1.stop(now + startOffset + 0.42);
        o2.stop(now + startOffset + 0.42);
      });
    } catch {}
  }

  // Fallback Web Audio soft marimba ringtone ONLY if HTML5 Audio is blocked by browser policy
  private playFallbackPleasantRingtoneCycle() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [
        { f: 392.00, d: 0.05, dur: 0.40 },
        { f: 493.88, d: 0.27, dur: 0.40 },
        { f: 587.33, d: 0.49, dur: 0.45 },
        { f: 659.25, d: 0.72, dur: 0.55 },
        { f: 587.33, d: 1.05, dur: 0.40 },
        { f: 493.88, d: 1.28, dur: 0.45 },
        { f: 523.25, d: 1.52, dur: 0.60 },
        { f: 392.00, d: 1.85, dur: 0.75 },
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.d);
        g.gain.setValueAtTime(0.001, now + n.d);
        g.gain.linearRampToValueAtTime(0.32 * this.ringVolume, now + n.d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.d + n.dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + n.d);
        osc.stop(now + n.d + n.dur + 0.03);
      });
    } catch {}
  }

  // Outgoing Call: Normal Phone Dialing Ringback ("Tuuu... Tuuu...")
  public startCallerTune(sakhiName?: string) {
    this.startRingtone({ vibrate: false, mode: 'caller_tune', sakhiName });
  }

  // Incoming Call: Pleasant Smartphone Marimba Ringtone + Gentle Vibration
  public startIncomingRingtone(callerName?: string) {
    this.startRingtone({ vibrate: true, mode: 'ringtone', sakhiName: callerName });
  }

  public startRingtone(options?: {
    vibrate?: boolean;
    mode?: 'caller_tune' | 'ringtone';
    sakhiName?: string;
  }) {
    try {
      const isIncoming = options?.mode === 'ringtone' || options?.vibrate === true;
      const targetMode: 'caller_tune' | 'ringtone' = isIncoming ? 'ringtone' : 'caller_tune';

      if (this.isRinging && this.activeMode === targetMode) {
        const activeEl = isIncoming ? this.ringtoneAudioEl : this.callerTuneAudioEl;
        if (activeEl && activeEl.paused) {
          activeEl.play().catch(() => {});
        }
        return;
      }

      this.stopRingtone();
      this.isRinging = true;
      this.activeMode = targetMode;

      if (isIncoming) {
        // Play pleasant smartphone marimba ringtone (Single clean engine, fallback only if HTML5 paused)
        if (this.ringtoneAudioEl) {
          this.ringtoneAudioEl.currentTime = 0;
          this.ringtoneAudioEl.volume = Math.min(1.0, this.ringVolume);
          this.ringtoneAudioEl.play().catch(() => {
            this.playFallbackPleasantRingtoneCycle();
          });
        } else {
          this.playFallbackPleasantRingtoneCycle();
        }

        this.ringInterval = window.setInterval(() => {
          if (!this.isRinging || this.activeMode !== 'ringtone') return;
          if (!this.ringtoneAudioEl || this.ringtoneAudioEl.paused) {
            if (this.ringtoneAudioEl) {
              this.ringtoneAudioEl.play().catch(() => {
                this.playFallbackPleasantRingtoneCycle();
              });
            } else {
              this.playFallbackPleasantRingtoneCycle();
            }
          }
        }, 3600);

        const triggerVibrate = () => {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([500, 350, 500, 1400]);
          }
        };
        triggerVibrate();
        this.vibrateInterval = window.setInterval(() => {
          if (!this.isRinging) return;
          triggerVibrate();
        }, 3200);
      } else {
        // Outgoing Call: Normal Phone Dialing Tone ("Tuuu... Tuuu...")
        if (this.callerTuneAudioEl) {
          this.callerTuneAudioEl.currentTime = 0;
          this.callerTuneAudioEl.volume = Math.min(0.75, this.ringVolume);
          this.callerTuneAudioEl.play().catch(() => {
            this.playFallbackNormalDialCycle();
          });
        } else {
          this.playFallbackNormalDialCycle();
        }

        this.ringInterval = window.setInterval(() => {
          if (!this.isRinging || this.activeMode !== 'caller_tune') return;
          if (!this.callerTuneAudioEl || this.callerTuneAudioEl.paused) {
            if (this.callerTuneAudioEl) {
              this.callerTuneAudioEl.play().catch(() => {
                this.playFallbackNormalDialCycle();
              });
            } else {
              this.playFallbackNormalDialCycle();
            }
          }
        }, 4000);

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
      if (this.vibrateInterval) {
        clearInterval(this.vibrateInterval);
        this.vibrateInterval = null;
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    } catch (e) {
      console.warn('stopRingtone error:', e);
    }
  }

  // Soft 2-note chime when call connects
  public playCallConnected() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const frequencies = [440, 587.33]; // A4 -> D5 soft connect tone

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.001, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.22, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.30);
      });
    } catch {}
  }

  // Gentle descending tone when call ends
  public playCallEnded() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [493.88, 392.00]; // B4 -> G4

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0.20, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.28);
      });
    } catch {}
  }

  // Soft beep when low balance (<1 min remaining)
  public playLowBalanceWarning() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(440, now + 0.12);

      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  // Soft coin chime
  public playCoinSound() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const tones = [587.33, 880.0]; // D5, A5

      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.25, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.30);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    } catch {}
  }

  // Pleasant, soft 2-note water-drop / marimba notification chime (WhatsApp/iMessage style, non-irritating)
  public playMessageReceived() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(70);
      }

      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: 0.0, duration: 0.14, vol: 0.26 },  // C5 warm note
        { freq: 659.25, time: 0.08, duration: 0.22, vol: 0.30 }, // E5 gentle chime
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        gain.gain.setValueAtTime(0.001, now + note.time);
        gain.gain.linearRampToValueAtTime(note.vol, now + note.time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + note.time);
        osc.stop(now + note.time + note.duration + 0.02);
      });
    } catch (e) {
      console.warn('playMessageReceived error:', e);
    }
  }

  // Pleasant 4-note chord for Admin payment notification
  public playPaymentReceivedSound(amount?: number) {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const notes = [
        { freq: 440.00, time: 0, dur: 0.20, vol: 0.35 },
        { freq: 554.37, time: 0.10, dur: 0.22, vol: 0.38 },
        { freq: 659.25, time: 0.20, dur: 0.28, vol: 0.40 },
        { freq: 880.00, time: 0.32, dur: 0.45, vol: 0.42 },
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(0.001, now + n.time);
        gain.gain.linearRampToValueAtTime(n.vol, now + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur + 0.04);
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 150, 300]);
      }
    } catch (e) {
      console.warn('playPaymentReceivedSound error:', e);
    }
  }

  public startPaymentReceivedAlarm(amount?: number, info?: string) {
    if (this.isPaymentAlarmActive) return;
    this.isPaymentAlarmActive = true;
    this.playPaymentReceivedSound(amount);

    let elapsed = 0;
    if (this.paymentAlarmInterval) clearInterval(this.paymentAlarmInterval);
    this.paymentAlarmInterval = window.setInterval(() => {
      if (!this.isPaymentAlarmActive) {
        if (this.paymentAlarmInterval) clearInterval(this.paymentAlarmInterval);
        return;
      }
      elapsed += 5;
      if (elapsed > 25) {
        this.stopPaymentReceivedAlarm();
        return;
      }
      this.playPaymentReceivedSound(amount);
    }, 5000);
  }

  public stopPaymentReceivedAlarm() {
    this.isPaymentAlarmActive = false;
    if (this.paymentAlarmInterval) {
      clearInterval(this.paymentAlarmInterval);
      this.paymentAlarmInterval = null;
    }
    try {
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
