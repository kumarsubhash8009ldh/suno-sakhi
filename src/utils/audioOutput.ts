/**
 * Audio Output and Speaker Routing Utility for WebRTC calls
 * Handles volume levels, Web Audio API GainNode routing, and physical audio sink routing (setSinkId)
 */

class StreamVolumeController {
  private currentStream: MediaStream | null = null;
  private currentElement: HTMLMediaElement | null = null;
  private volume: number = 1.0; // 0.1 to 1.5
  private isSpeaker: boolean = true;

  public attachStream(stream: MediaStream | null, element?: HTMLMediaElement | null) {
    if (!stream) {
      this.detach();
      return;
    }

    this.currentStream = stream;
    if (element) {
      this.currentElement = element;
    }

    // Always ensure all remote audio tracks are explicitly enabled
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = true;
    });

    if (this.currentElement) {
      // NEVER MUTE THE REMOTE AUDIO ELEMENT!
      this.currentElement.muted = false;
      this.updateVolume();

      // Trigger playback
      try {
        const p = this.currentElement.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn('Audio element play note (waiting for gesture):', err);
          });
        }
      } catch (err) {
        console.warn('Audio element play exception:', err);
      }
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0.1, Math.min(1.5, vol));
    this.updateVolume();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setSpeaker(isSpeaker: boolean) {
    this.isSpeaker = isSpeaker;
    this.updateVolume();
  }

  public getIsSpeaker(): boolean {
    return this.isSpeaker;
  }

  public updateVolume() {
    if (!this.currentElement) return;
    try {
      this.currentElement.muted = false;
      // HTMLMediaElement volume is 0.0 to 1.0
      // When speaker is ON: full volume (up to 1.0)
      // When speaker is OFF (earpiece simulation): lower volume (0.25x)
      const effectiveVol = this.isSpeaker
        ? Math.min(1.0, Math.max(0.1, this.volume))
        : Math.min(0.25, Math.max(0.05, this.volume * 0.25));

      this.currentElement.volume = effectiveVol;
    } catch (err) {
      console.warn('Error setting element volume:', err);
    }
  }

  public detach() {
    this.currentStream = null;
    this.currentElement = null;
  }

  public resume() {
    if (this.currentElement) {
      this.currentElement.muted = false;
      this.currentElement.play().catch(() => {});
    }
  }
}

export const streamAudioController = new StreamVolumeController();

export const routeAudioOutput = async (
  element: HTMLMediaElement | null,
  isSpeaker: boolean,
  volume: number = 1.0
) => {
  if (!element) return;

  try {
    // Unmute immediately
    element.muted = false;

    // Standard volume configuration
    const effectiveVol = isSpeaker
      ? Math.min(1.0, Math.max(0.1, volume))
      : Math.min(0.25, Math.max(0.05, volume * 0.25));
    element.volume = effectiveVol;

    // Ensure audio tracks are enabled if stream is present
    if (element.srcObject instanceof MediaStream) {
      element.srcObject.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      streamAudioController.attachStream(element.srcObject, element);
    }

    // Try playing
    const playPromise = element.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }

    // Hardware audio sink routing via setSinkId if supported
    const mediaEl = element as unknown as { setSinkId?: (sinkId: string) => Promise<void> };
    if (typeof mediaEl.setSinkId === 'function' && navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === 'audiooutput');

      if (outputs.length > 1) {
        if (isSpeaker) {
          // Look for external / loudspeaker
          const speaker = outputs.find(
            (d) =>
              d.label.toLowerCase().includes('speaker') ||
              d.label.toLowerCase().includes('loudspeaker') ||
              d.label.toLowerCase().includes('external')
          );
          if (speaker && speaker.deviceId) {
            await mediaEl.setSinkId(speaker.deviceId);
            return;
          }
        } else {
          // Look for earpiece / receiver / handset
          const earpiece = outputs.find(
            (d) =>
              d.label.toLowerCase().includes('earpiece') ||
              d.label.toLowerCase().includes('receiver') ||
              d.label.toLowerCase().includes('handset') ||
              d.label.toLowerCase().includes('internal')
          );
          if (earpiece && earpiece.deviceId) {
            await mediaEl.setSinkId(earpiece.deviceId);
            return;
          }
        }
      }

      // Default audio device
      await mediaEl.setSinkId('');
    }
  } catch (err) {
    console.warn('routeAudioOutput note:', err);
  }
};

