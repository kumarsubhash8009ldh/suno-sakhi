// Comprehensive sound effects utility with loud dual-engine ringtone,
// Web Audio API synthesis, HTML5 audio fallback, and aggressive mobile autoplay unlocker.

function createRingtoneWavBlob(): Blob | null {
  try {
    const sampleRate = 22050;
    const duration = 2.4; // 2.4s cycle
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
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      // Phase 1 (0.0s - 0.6s): Melodic smartphone bell chime (E6, G#6, B6, E7)
      if (t < 0.6) {
        const step = Math.floor(t / 0.15);
        const stepT = t % 0.15;
        const freqs = [1318.5, 1661.2, 1975.5, 2637.0];
        const f = freqs[Math.min(step, 3)];
        const decay = Math.exp(-stepT * 14);
        val += (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t)) * decay * 0.85;
      }
      // Phase 2 (0.7s - 1.5s): High-power Telephony Bell (853Hz + 960Hz) with 20Hz vibration tremolo
      else if (t >= 0.7 && t < 1.5) {
        const bellT = t - 0.7;
        const decay = Math.exp(-bellT * 1.8);
        const tremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 20 * t);
        const f1 = Math.sin(2 * Math.PI * 853 * t);
        const f2 = Math.sin(2 * Math.PI * 960 * t);
        const f3 = 0.4 * Math.sin(2 * Math.PI * 1706 * t);
        val += (f1 + f2 + f3) * 0.55 * decay * tremolo;
      }
      // Phase 3 (1.5s - 2.4s): Natural silence pause before loop

      const sample = Math.max(-32767, Math.min(32767, Math.floor(val * 32767)));
      view.setInt16(offset, sample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    console.warn('WAV generation error:', e);
    return null;
  }
}

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private ringInterval: number | null = null;
  private vibrateInterval: number | null = null;
  private isRinging: boolean = false;
  private isUnlocked: boolean = false;
  private ringVolume: number = 1.0;
  private paymentAlarmInterval: number | null = null;
  private isPaymentAlarmActive: boolean = false;

  public setRingtoneVolume(vol: number) {
    this.ringVolume = Math.max(0, Math.min(1.5, vol));
    if (this.audioEl) {
      this.audioEl.volume = Math.min(1.0, this.ringVolume);
    }
  }

  constructor() {
    this.setupHtmlAudio();
  }

  private setupHtmlAudio() {
    if (typeof window === 'undefined') return;
    try {
      const wavBlob = createRingtoneWavBlob();
      if (wavBlob) {
        const url = URL.createObjectURL(wavBlob);
        this.audioEl = new Audio(url);
        this.audioEl.loop = true;
        this.audioEl.volume = 1.0;
        this.audioEl.preload = 'auto';
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
        // Play silent 1-sample buffer to permanently unlock hardware audio pipeline
        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(ctx.destination);
        source.start(0);
      }

      if (this.audioEl) {
        this.audioEl.load();
        // If currently supposed to be ringing, start playing HTMLAudio immediately
        if (this.isRinging) {
          this.audioEl.play().catch(() => {});
        }
      }

      this.isUnlocked = true;
    } catch (e) {
      console.warn('unlockAudio note:', e);
    }
  }

  // Web Audio synth burst (loud & crisp)
  private playWebAudioRingCycle() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // Volume master gain for mobile speakers / earpiece
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.9 * this.ringVolume, now);
      master.connect(ctx.destination);

      // Phase 1: 4 rapid ascending notes
      const notes = [
        { f: 1318.5, delay: 0.0, dur: 0.14 },
        { f: 1661.2, delay: 0.15, dur: 0.14 },
        { f: 1975.5, delay: 0.30, dur: 0.14 },
        { f: 2637.0, delay: 0.45, dur: 0.2 },
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, now + n.delay);

        g.gain.setValueAtTime(0, now + n.delay);
        g.gain.linearRampToValueAtTime(0.85, now + n.delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur);

        osc.connect(g);
        g.connect(master);
        osc.start(now + n.delay);
        osc.stop(now + n.delay + n.dur + 0.05);
      });

      // Phase 2: Telephony Bell (853Hz + 960Hz) at 0.7s
      const bellStart = now + 0.7;
      const bellDur = 0.75;
      const bOsc1 = ctx.createOscillator();
      const bOsc2 = ctx.createOscillator();
      const bOsc3 = ctx.createOscillator();
      const bGain = ctx.createGain();

      bOsc1.type = 'sine';
      bOsc2.type = 'sine';
      bOsc3.type = 'triangle';
      bOsc1.frequency.setValueAtTime(853, bellStart);
      bOsc2.frequency.setValueAtTime(960, bellStart);
      bOsc3.frequency.setValueAtTime(1706, bellStart);

      bGain.gain.setValueAtTime(0, bellStart);
      bGain.gain.linearRampToValueAtTime(0.75, bellStart + 0.04);
      bGain.gain.exponentialRampToValueAtTime(0.001, bellStart + bellDur);

      bOsc1.connect(bGain);
      bOsc2.connect(bGain);
      bOsc3.connect(bGain);
      bGain.connect(master);

      bOsc1.start(bellStart);
      bOsc2.start(bellStart);
      bOsc3.start(bellStart);
      bOsc1.stop(bellStart + bellDur + 0.05);
      bOsc2.stop(bellStart + bellDur + 0.05);
      bOsc3.stop(bellStart + bellDur + 0.05);
    } catch (e) {
      console.warn('Web Audio ring cycle error:', e);
    }
  }

  // Realistic phone ringtone. Outgoing calls NEVER vibrate the caller's phone!
  public startRingtone(options?: { vibrate?: boolean }) {
    try {
      this.isRinging = true;

      // 1. Trigger HTML5 audio loop (primary engine for mobile background & native media)
      if (this.audioEl) {
        this.audioEl.currentTime = 0;
        this.audioEl.volume = this.ringVolume;
        this.audioEl.play().catch((err) => {
          console.warn('HTMLAudio play note (will play upon tap):', err);
        });
      }

      // 2. Trigger Web Audio API synthesis
      this.initCtx();
      this.playWebAudioRingCycle();

      if (this.ringInterval) {
        clearInterval(this.ringInterval);
      }
      this.ringInterval = window.setInterval(() => {
        if (!this.isRinging) return;
        this.playWebAudioRingCycle();
      }, 2500);

      // 3. Vibration: Strictly opt-in (defaults to false).
      // IMPORTANT: When a user makes an outgoing call (voice or video), the caller's phone must NEVER vibrate!
      const shouldVibrate = options?.vibrate === true;
      if (shouldVibrate) {
        const triggerVibrate = () => {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([1000, 400, 1000, 400, 1200]);
          }
        };
        triggerVibrate();

        if (this.vibrateInterval) {
          clearInterval(this.vibrateInterval);
        }
        this.vibrateInterval = window.setInterval(() => {
          if (!this.isRinging) return;
          triggerVibrate();
        }, 3000);
      } else {
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

      // 1. Stop HTML5 audio
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      }

      // 2. Clear Web Audio intervals
      if (this.ringInterval) {
        clearInterval(this.ringInterval);
        this.ringInterval = null;
      }

      // 3. Stop vibration
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

  // Crisp, loud, pleasant notification chime for incoming chat message (WhatsApp/iPhone tone style)
  public playMessageReceived() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Hardware vibration on mobile
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 80, 150]);
      }

      const now = ctx.currentTime;
      // High-clarity two-tone bell chime: C6 (1046.5Hz) followed by G6 (1568Hz) with volume 0.7
      const notes = [
        { freq: 1046.5, time: 0, duration: 0.16, vol: 0.65 },
        { freq: 1567.98, time: 0.12, duration: 0.38, vol: 0.7 },
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        gain.gain.setValueAtTime(0, now + note.time);
        gain.gain.linearRampToValueAtTime(note.vol, now + note.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + note.time);
        osc.stop(now + note.time + note.duration + 0.05);
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
      // Resonant 6-bell melodic fanfare (C5, E5, G5, C6, E6, G6) + metallic sparkle
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

      // Cash register harmonic shimmer (2637Hz & 3136Hz)
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

      // Hardware vibration on mobile
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

    // 1. Play immediate soundbox chime
    this.playPaymentReceivedSound(amount);

    // 2. Speak announcement via Web Speech API (Paytm/PhonePe Soundbox style announcement)
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

    // Small delay so initial bell chime finishes before speech starts
    setTimeout(() => {
      if (this.isPaymentAlarmActive) speakAnnouncement();
    }, 1200);

    // 3. Show system push notification on desktop/mobile
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('💰 Naya Payment Prapt Hua! - SunoSakhi', {
          body: amount ? `₹${amount} ka payment verify karne ke liye aaya hai.` : 'Naya payment request prapt hua hai.',
          icon: '/favicon.ico'
        });
      }
    } catch {}

    // 4. Repeat alarm cycle every 5 seconds for a long ringtone (up to 35 seconds max)
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

  // Stop the payment alarm / ringtone immediately
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

  // Resume when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sounds.initCtx();
    }
  });
}
