import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { CallType, Sakhi } from '../types';

export interface CallSessionDoc {
  id: string;
  callerId: string;
  callerName: string;
  callerPhone?: string;
  sakhiId: string;
  sakhiPhone?: string;
  sakhiEmail?: string;
  sakhiName: string;
  sakhiAvatar?: string;
  callType: CallType;
  status: 'ringing' | 'connected' | 'rejected' | 'ended' | 'busy';
  offer?: any;
  answer?: any;
  callerCandidates?: any[];
  calleeCandidates?: any[];
  createdAt: number;
  connectedAt?: number;
  endedAt?: number;
  durationSeconds?: number;
  cost?: number;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Media timeout after ${ms}ms`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private activeCallId: string | null = null;
  private unsubscribers: (() => void)[] = [];
  private intervals: number[] = [];
  private currentFacingMode: 'user' | 'environment' = 'user';

  // Callbacks
  public onRemoteStreamAvailable: ((stream: MediaStream) => void) | null = null;
  public onCallConnected: (() => void) | null = null;
  public onCallRejected: ((reason?: string) => void) | null = null;
  public onCallEnded: (() => void) | null = null;

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public getActiveCallId(): string | null {
    return this.activeCallId;
  }

  /**
   * Switch Camera between Front (user) and Rear (environment)
   */
  public async switchCamera(): Promise<boolean> {
    if (!this.localStream || !this.peerConnection) return false;
    const currentVideoTrack = this.localStream.getVideoTracks()[0];
    if (!currentVideoTrack) return false;

    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.currentFacingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        }),
        4000
      );
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
        currentVideoTrack.stop();
        this.localStream.removeTrack(currentVideoTrack);
        this.localStream.addTrack(newVideoTrack);
        return true;
      }
    } catch (err) {
      console.warn('Switch camera error:', err);
    }
    return false;
  }

  /**
   * Fast, mobile-friendly camera & microphone acquisition with 3.5s timeout fallback
   * so getUserMedia NEVER hangs call signaling on Android WebView or mobile browsers.
   */
  public async getMediaStream(callType: CallType): Promise<MediaStream> {
    try {
      if (this.localStream) {
        const liveTracks = this.localStream.getTracks().filter((t) => t.readyState === 'live');
        if (liveTracks.length > 0) {
          liveTracks.forEach((t) => {
            t.enabled = true;
          });
          return this.localStream;
        }
      }

      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await withTimeout(
            navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
              video:
                callType === 'video'
                  ? {
                      facingMode: this.currentFacingMode,
                      width: { ideal: 640 },
                      height: { ideal: 480 }
                    }
                  : false
            }),
            3500
          );
          stream.getTracks().forEach((t) => {
            t.enabled = true;
          });
          this.localStream = stream;
          return stream;
        } catch (firstErr) {
          console.warn('Primary getUserMedia failed or timed out, trying basic audio/video:', firstErr);
          try {
            const fallbackStream = await withTimeout(
              navigator.mediaDevices.getUserMedia({
                audio: true,
                video: callType === 'video'
              }),
              2500
            );
            fallbackStream.getTracks().forEach((t) => {
              t.enabled = true;
            });
            this.localStream = fallbackStream;
            return fallbackStream;
          } catch (secondErr) {
            if (callType === 'video') {
              try {
                // If camera failed/busy, still acquire microphone audio so the call connects with voice
                const audioOnlyStream = await withTimeout(
                  navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
                  2000
                );
                this.addSyntheticVideoTrack(audioOnlyStream);
                this.localStream = audioOnlyStream;
                return audioOnlyStream;
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      console.warn('Microphone/Camera fallback triggered:', err);
    }

    // Resilient Fallback: Synthesize silent audio track (+ canvas video track if video)
    try {
      const syntheticStream = new MediaStream();
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          const audioTrack = dst.stream.getAudioTracks()[0];
          if (audioTrack) syntheticStream.addTrack(audioTrack);
        }
        if (callType === 'video') {
          this.addSyntheticVideoTrack(syntheticStream);
        }
      }
      this.localStream = syntheticStream;
      return syntheticStream;
    } catch {
      const empty = new MediaStream();
      this.localStream = empty;
      return empty;
    }
  }

  private addSyntheticVideoTrack(stream: MediaStream) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#120520';
        ctx.fillRect(0, 0, 640, 480);
      }
      const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
      if (canvasStream && canvasStream.getVideoTracks()[0]) {
        stream.addTrack(canvasStream.getVideoTracks()[0]);
      }
    } catch {}
  }

  private attachTrackReceiver(pc: RTCPeerConnection) {
    pc.ontrack = (event) => {
      event.track.enabled = true;
      let stream: MediaStream;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        stream = this.remoteStream;
      }
      this.remoteStream = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      if (this.onRemoteStreamAvailable) {
        this.onRemoteStreamAvailable(stream);
      }
    };

    const syncReceiverStream = () => {
      const receivers = pc.getReceivers();
      const tracks = receivers.map((r) => r.track).filter(Boolean) as MediaStreamTrack[];
      if (tracks.length > 0) {
        tracks.forEach((t) => {
          t.enabled = true;
        });
        const stream = new MediaStream(tracks);
        this.remoteStream = stream;
        if (this.onRemoteStreamAvailable) {
          this.onRemoteStreamAvailable(stream);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (this.onCallConnected) this.onCallConnected();
        syncReceiverStream();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (this.onCallConnected) this.onCallConnected();
        syncReceiverStream();
      }
    };
  }

  /**
   * Start Outbound Call as Caller (Cloud Firestore Signaling)
   */
  public async startOutboundCall(
    caller: { id: string; name: string; phone?: string },
    sakhi: Sakhi,
    callType: CallType
  ): Promise<string> {
    this.cleanup();

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeCallId = callId;

    // 1. Get media stream (fast with 3.5s ceiling)
    const localStream = await this.getMediaStream(callType);

    // If call was cancelled while acquiring stream, stop immediately
    if (this.activeCallId !== callId) {
      return callId;
    }

    // 2. Setup RTCPeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
      });
    }

    this.attachTrackReceiver(pc);

    // Buffer ICE candidates until call doc is created and batch them cleanly
    const queuedCandidates: any[] = [];
    let isDocCreated = false;
    let candidateBatchTimer: any = null;

    const flushCandidates = async () => {
      if (queuedCandidates.length === 0 || !isDocCreated || !isFirebaseConfigured() || !db) return;
      const toSend = queuedCandidates.splice(0, queuedCandidates.length);
      try {
        await updateDoc(doc(db, 'calls', callId), {
          callerCandidates: arrayUnion(...toSend)
        });
      } catch (e) {
        console.warn('Caller ICE candidate flush error:', e);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const cJson = event.candidate.toJSON();
        queuedCandidates.push(cJson);
        if (isDocCreated) {
          if (candidateBatchTimer) clearTimeout(candidateBatchTimer);
          candidateBatchTimer = setTimeout(flushCandidates, 120);
        }
      }
    };

    // 3. Create Offer SDP
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video'
    });
    await pc.setLocalDescription(offer);

    const rawHostDigits = String(sakhi.phone || '').replace(/\D/g, '');
    const idHostDigits =
      String(sakhi.id || '').startsWith('sakhi-host-') || String(sakhi.id || '').startsWith('sakhi-email-')
        ? ''
        : String(sakhi.id || '').replace(/\D/g, '');
    const cleanHostPhone =
      rawHostDigits.length >= 10
        ? rawHostDigits.slice(-10)
        : idHostDigits.length >= 10
        ? idHostDigits.slice(-10)
        : '';
    const cleanCallerPhone = String(caller.phone || caller.id || '').replace(/\D/g, '').slice(-10);

    const callSessionDoc: CallSessionDoc = {
      id: callId,
      callerId: caller.id,
      callerName: caller.name,
      callerPhone: cleanCallerPhone,
      sakhiId: sakhi.id,
      sakhiPhone: cleanHostPhone,
      sakhiEmail: (sakhi.email || '').toLowerCase().trim(),
      sakhiName: sakhi.name,
      sakhiAvatar: sakhi.avatar,
      callType,
      status: 'ringing',
      offer: {
        type: offer.type,
        sdp: offer.sdp
      },
      callerCandidates: [...queuedCandidates],
      calleeCandidates: [],
      createdAt: Date.now()
    };

    // 4. Save call session to Cloud Firestore
    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, 'calls', callId), callSessionDoc);
        isDocCreated = true;
        flushCandidates();
      } catch (err) {
        console.warn('Error saving call session in Firestore:', err);
      }

      // 5. Listen to Call Session Doc for Answer & ICE Candidates
      const addedCalleeCandidates = new Set<string>();
      const pendingCalleeCandidates: any[] = [];
      let isRemoteDescSet = false;

      const drainCalleeCandidates = async () => {
        if (!pc || !isRemoteDescSet) return;
        while (pendingCalleeCandidates.length > 0) {
          const c = pendingCalleeCandidates.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        }
      };

      const unsub = onSnapshot(doc(db, 'calls', callId), async (docSnap) => {
        if (!docSnap.exists()) return;
        const session = docSnap.data() as CallSessionDoc;

        // Callee Answered
        if (session.status === 'connected' && session.answer) {
          if (!isRemoteDescSet && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(session.answer));
              isRemoteDescSet = true;
              await drainCalleeCandidates();
              if (this.onCallConnected) this.onCallConnected();
            } catch (sdpErr) {
              console.warn('Caller set remote description error:', sdpErr);
            }
          } else if (isRemoteDescSet) {
            if (this.onCallConnected) this.onCallConnected();
          }
        }

        // Callee ICE Candidates
        if (Array.isArray(session.calleeCandidates)) {
          for (const c of session.calleeCandidates) {
            const key = JSON.stringify(c);
            if (!addedCalleeCandidates.has(key)) {
              addedCalleeCandidates.add(key);
              if (isRemoteDescSet && pc.currentRemoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(c));
                } catch {}
              } else {
                pendingCalleeCandidates.push(c);
              }
            }
          }
        }

        // Rejected
        if (session.status === 'rejected' || session.status === 'busy') {
          if (this.onCallRejected) {
            this.onCallRejected('Sakhi ne call decline kar di ya wo abhi busy hain.');
          }
          this.cleanup();
        }

        // Ended
        if (session.status === 'ended') {
          if (this.onCallEnded) {
            this.onCallEnded();
          }
          this.cleanup();
        }
      });

      this.unsubscribers.push(unsub);
    }

    return callId;
  }

  /**
   * Answer Incoming Call as Host or Caller Receiver
   */
  public async answerIncomingCall(callSession: CallSessionDoc): Promise<boolean> {
    this.cleanup();
    this.activeCallId = callSession.id;

    const callType = callSession.callType;
    const localStream = await this.getMediaStream(callType);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
      });
    }

    this.attachTrackReceiver(pc);

    // Capture Callee ICE Candidates and batch push to Firestore
    const calleeQueuedCandidates: any[] = [];
    let calleeBatchTimer: any = null;

    const flushCalleeCandidates = async () => {
      if (calleeQueuedCandidates.length === 0 || !isFirebaseConfigured() || !db) return;
      const toSend = calleeQueuedCandidates.splice(0, calleeQueuedCandidates.length);
      try {
        await updateDoc(doc(db, 'calls', callSession.id), {
          calleeCandidates: arrayUnion(...toSend)
        });
      } catch (e) {
        console.warn('Callee ICE candidate flush error:', e);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        calleeQueuedCandidates.push(event.candidate.toJSON());
        if (calleeBatchTimer) clearTimeout(calleeBatchTimer);
        calleeBatchTimer = setTimeout(flushCalleeCandidates, 120);
      }
    };

    // 1. Seed initial Caller Candidates from callSession before setting remote description
    let isRemoteDescSet = false;
    const pendingCallerCandidates: any[] = [];
    const addedCallerCandidates = new Set<string>();

    if (Array.isArray(callSession.callerCandidates)) {
      for (const c of callSession.callerCandidates) {
        const cKey = JSON.stringify(c);
        if (!addedCallerCandidates.has(cKey)) {
          addedCallerCandidates.add(cKey);
          pendingCallerCandidates.push(c);
        }
      }
    }

    const drainCallerCandidates = async () => {
      if (!pc || !isRemoteDescSet) return;
      while (pendingCallerCandidates.length > 0) {
        const c = pendingCallerCandidates.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {}
      }
    };

    if (callSession.offer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(callSession.offer));
        isRemoteDescSet = true;
        await drainCallerCandidates();
      } catch (err) {
        console.warn('Remote offer set error on callee:', err);
      }
    }

    // 2. Create Answer SDP
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // 3. Post Answer to Cloud Firestore immediately
    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'calls', callSession.id), {
          status: 'connected',
          answer: { type: answer.type, sdp: answer.sdp },
          connectedAt: Date.now()
        });
        flushCalleeCandidates();
      } catch (err) {
        console.warn('Error answering call on Firestore:', err);
      }

      // 4. Listen for additional Caller ICE Candidates and Call End
      const unsub = onSnapshot(doc(db, 'calls', callSession.id), async (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data() as CallSessionDoc;

        if (data.status === 'ended') {
          if (this.onCallEnded) this.onCallEnded();
          this.cleanup();
          return;
        }

        if (Array.isArray(data.callerCandidates)) {
          for (const c of data.callerCandidates) {
            const cKey = JSON.stringify(c);
            if (!addedCallerCandidates.has(cKey)) {
              addedCallerCandidates.add(cKey);
              if (isRemoteDescSet && pc.currentRemoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(c));
                } catch {}
              } else {
                pendingCallerCandidates.push(c);
              }
            }
          }
        }
      });

      this.unsubscribers.push(unsub);
    }

    if (this.onCallConnected) {
      this.onCallConnected();
    }

    return true;
  }

  /**
   * Reject Incoming Call
   */
  public async rejectIncomingCall(callId: string): Promise<void> {
    if (callId && isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'calls', callId), {
          status: 'rejected',
          endedAt: Date.now()
        });
      } catch {}
    }
    this.cleanup();
  }

  /**
   * End Active Call (User or Host Hangup)
   */
  public async endActiveCall(
    callId?: string,
    details?: {
      durationSeconds?: number;
      cost?: number;
      hostId?: string;
      hostPhone?: string;
      callerName?: string;
      callType?: string;
    }
  ): Promise<void> {
    const id = callId || this.activeCallId;
    this.cleanup();
    if (id && isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'calls', id), {
          status: 'ended',
          endedAt: Date.now(),
          ...(details || {})
        });
      } catch {}
    }
  }

  /**
   * Toggle Audio Mute
   */
  public toggleMute(muted?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = muted !== undefined ? !muted : !audioTrack.enabled;
      return !audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle Video On/Off
   */
  public toggleVideo(off?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = off !== undefined ? !off : !videoTrack.enabled;
      return !videoTrack.enabled;
    }
    return false;
  }

  /**
   * Full cleanup of peer connection, streams and listeners
   */
  public cleanup(): void {
    this.unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    this.unsubscribers = [];

    this.intervals.forEach((intervalId) => {
      try {
        clearInterval(intervalId);
      } catch {}
    });
    this.intervals = [];

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.localStream = null;
    }

    this.remoteStream = null;
    this.activeCallId = null;
  }
}

export const webrtcService = new WebRTCService();

if (typeof window !== 'undefined') {
  const handlePageUnload = () => {
    const activeCallId = webrtcService.getActiveCallId();
    if (activeCallId) {
      webrtcService.endActiveCall(activeCallId);
    }
  };
  window.addEventListener('beforeunload', handlePageUnload);
  window.addEventListener('pagehide', handlePageUnload);
}

/**
 * Real-time listener for incoming calls for a logged-in Host or Caller.
 * Supports multiple receiver identifiers (phone, hostId, callerId, email) and
 * handles clock skew between devices gracefully.
 */
export const subscribeToIncomingCallsForHost = (
  receiverInput: string | string[],
  onIncomingCall: (call: CallSessionDoc | null) => void
): (() => void) => {
  const rawList = Array.isArray(receiverInput) ? receiverInput : [receiverInput];
  const receiverIds = new Set<string>();
  const receiverPhones = new Set<string>();
  const receiverEmails = new Set<string>();

  rawList.forEach((item) => {
    if (!item) return;
    const trimmed = String(item).trim();
    if (!trimmed) return;
    receiverIds.add(trimmed);
    receiverIds.add(trimmed.toLowerCase());
    if (trimmed.includes('@')) {
      const emailClean = trimmed.toLowerCase();
      receiverEmails.add(emailClean);
      const slug = emailClean.replace(/[^a-z0-9]/g, '_');
      receiverIds.add(`sakhi-host-${slug}`);
      receiverIds.add(`sakhi-email-${slug}`);
      receiverIds.add(`email_${slug}`);
    } else if (!trimmed.startsWith('sakhi-host-') && !trimmed.startsWith('sakhi-email-')) {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        receiverPhones.add(last10);
        receiverIds.add(last10);
        receiverIds.add(`sakhi-user-${last10}`);
        receiverIds.add(`caller-${last10}`);
        receiverIds.add(`caller_${last10}`);
        receiverIds.add(`user_${last10}`);
      }
    }
  });

  if (receiverIds.size === 0 && receiverPhones.size === 0 && receiverEmails.size === 0) {
    return () => {};
  }

  if (isFirebaseConfigured() && db) {
    try {
      const callsCol = collection(db, 'calls');
      let currentCallId = '';
      const ignoredStaleIds = new Set<string>();
      let isFirstSnapshot = true;

      const unsub = onSnapshot(
        callsCol,
        (snapshot) => {
          const now = Date.now();
          const matchingCalls: CallSessionDoc[] = [];

          snapshot.forEach((docSnap) => {
            const call = docSnap.data() as CallSessionDoc;
            if (!call || call.status !== 'ringing') return;

            // Ignore if THIS exact browser/app instance is the outbound caller of this call
            if (webrtcService.getActiveCallId() && webrtcService.getActiveCallId() === docSnap.id) {
              return;
            }

            // On the very first snapshot when app loads, ignore calls older than 60s
            if (isFirstSnapshot && call.createdAt && Math.abs(now - call.createdAt) > 60000) {
              ignoredStaleIds.add(docSnap.id);
              return;
            }
            if (ignoredStaleIds.has(docSnap.id)) {
              return;
            }

            const callSakhiId = String(call.sakhiId || '').trim();
            const callSakhiEmail = String(call.sakhiEmail || '').trim().toLowerCase();
            const rawCallHostDigits = String(call.sakhiPhone || '').replace(/\D/g, '');
            const idCallHostDigits =
              callSakhiId.startsWith('sakhi-host-') || callSakhiId.startsWith('sakhi-email-')
                ? ''
                : callSakhiId.replace(/\D/g, '');
            const callHostPhone =
              rawCallHostDigits.length >= 10
                ? rawCallHostDigits.slice(-10)
                : idCallHostDigits.length >= 10
                ? idCallHostDigits.slice(-10)
                : '';

            const isCalleeMatch =
              (callSakhiId && (receiverIds.has(callSakhiId) || receiverIds.has(callSakhiId.toLowerCase()))) ||
              (callHostPhone && receiverPhones.has(callHostPhone)) ||
              (callSakhiEmail && receiverEmails.has(callSakhiEmail));

            if (isCalleeMatch) {
              matchingCalls.push({ ...call, id: docSnap.id });
            }
          });

          isFirstSnapshot = false;

          // Sort by most recent createdAt so newest ringing call wins
          matchingCalls.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          const activeIncoming = matchingCalls[0] || null;

          if (activeIncoming) {
            if (currentCallId !== activeIncoming.id) {
              currentCallId = activeIncoming.id;
              onIncomingCall(activeIncoming);
            }
          } else {
            if (currentCallId) {
              currentCallId = '';
              onIncomingCall(null);
            }
          }
        },
        (err) => {
          console.warn('Firestore incoming calls listener notice:', err);
        }
      );

      return unsub;
    } catch (err) {
      console.warn('Error subscribing to incoming calls in Firestore:', err);
    }
  }

  return () => {};
};
