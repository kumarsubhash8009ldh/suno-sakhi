import {
  collection,
  doc,
  getDoc,
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
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
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

/**
 * Tracks all call IDs that this client has initiated, answered, rejected, or ended
 * so they can NEVER reappear as ghost incoming calls.
 */
const handledCallIds = new Set<string>();

export const markCallAsHandled = (callId?: string | null): void => {
  if (callId) {
    handledCallIds.add(callId);
  }
};

export const isCallHandled = (callId?: string | null): boolean => {
  if (!callId) return false;
  return handledCallIds.has(callId);
};

function sanitizeCandidate(cand: RTCIceCandidate): Record<string, any> {
  return {
    candidate: cand.candidate || '',
    sdpMid: cand.sdpMid ?? null,
    sdpMLineIndex: cand.sdpMLineIndex ?? null,
    usernameFragment: cand.usernameFragment ?? null
  };
}

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

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

function setNativeCallAudioMode(inCall: boolean, speakerOn: boolean = true) {
  try {
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.AndroidSecurity && typeof win.AndroidSecurity.setCallAudioMode === 'function') {
        win.AndroidSecurity.setCallAudioMode(inCall, speakerOn);
      }
    }
  } catch {}
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private activeCallId: string | null = null;
  private unsubscribers: (() => void)[] = [];
  private intervals: number[] = [];
  private disconnectTimer: number | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private hasNotifiedConnected: boolean = false;

  // Callbacks
  public onRemoteStreamAvailable: ((stream: MediaStream) => void) | null = null;
  public onLocalStreamUpdated: ((stream: MediaStream) => void) | null = null;
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

    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.currentFacingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        }),
        6000
      );
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        newVideoTrack.enabled = true;
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
        if (currentVideoTrack) {
          currentVideoTrack.stop();
          this.localStream.removeTrack(currentVideoTrack);
        }
        this.localStream.addTrack(newVideoTrack);
        const updatedStream = new MediaStream(this.localStream.getTracks());
        this.localStream = updatedStream;
        if (this.onLocalStreamUpdated) {
          this.onLocalStreamUpdated(updatedStream);
        }
        return true;
      }
    } catch (err) {
      console.warn('Switch camera error:', err);
    }
    return false;
  }

  /**
   * Fast & reliable camera + microphone acquisition with quick fallback
   * so outbound & inbound calls never hang waiting for busy camera hardware.
   */
  public async getMediaStream(callType: CallType): Promise<MediaStream> {
    // Stop any previous leftover tracks before acquiring fresh stream for this call
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.localStream = null;
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
        console.warn('Primary getUserMedia failed, falling back to audio / basic constraints:', firstErr);
        // Immediately try audio-only (+ synthetic video if video call) so mic works even when camera is busy/missing
        try {
          const audioOnlyStream = await withTimeout(
            navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
            2500
          );
          audioOnlyStream.getTracks().forEach((t) => {
            t.enabled = true;
          });
          if (callType === 'video') {
            this.addSyntheticVideoTrack(audioOnlyStream);
          }
          this.localStream = audioOnlyStream;
          return audioOnlyStream;
        } catch (audioErr) {
          console.warn('Audio-only fallback failed:', audioErr);
        }
      }
    }

    // Last-resort synthetic stream so WebRTC signaling still completes
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

  private notifyConnectedOnce() {
    if (!this.hasNotifiedConnected) {
      this.hasNotifiedConnected = true;
      setNativeCallAudioMode(true, true);
      if (this.onCallConnected) {
        this.onCallConnected();
      }
    }
  }

  private attachTrackReceiver(pc: RTCPeerConnection, callId: string) {
    const remoteTracksMap = new Map<string, MediaStreamTrack>();

    const publishRemoteStream = () => {
      if (this.activeCallId !== callId) return;

      // Also collect all receiver tracks from peerConnection
      pc.getReceivers().forEach((receiver) => {
        if (receiver.track && receiver.track.readyState !== 'ended') {
          receiver.track.enabled = true;
          remoteTracksMap.set(receiver.track.id, receiver.track);
        }
      });

      const activeTracks = Array.from(remoteTracksMap.values()).filter(
        (t) => t.readyState !== 'ended'
      );

      if (activeTracks.length > 0) {
        activeTracks.forEach((t) => {
          t.enabled = true;
        });
        // Always instantiate a new MediaStream so React state updates when 2nd track (video) arrives
        const freshStream = new MediaStream(activeTracks);
        this.remoteStream = freshStream;
        if (this.onRemoteStreamAvailable) {
          this.onRemoteStreamAvailable(freshStream);
        }
      }
    };

    pc.ontrack = (event) => {
      if (this.activeCallId !== callId) return;
      if (event.track) {
        event.track.enabled = true;
        remoteTracksMap.set(event.track.id, event.track);

        event.track.onunmute = () => {
          publishRemoteStream();
        };
      }
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          t.enabled = true;
          remoteTracksMap.set(t.id, t);
          t.onunmute = () => {
            publishRemoteStream();
          };
        });
      }
      publishRemoteStream();
    };

    pc.onconnectionstatechange = () => {
      if (this.activeCallId !== callId) return;
      const state = pc.connectionState;
      if (state === 'connected') {
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
        this.notifyConnectedOnce();
        publishRemoteStream();
      } else if (state === 'failed' || state === 'closed') {
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
        if (this.onCallEnded) {
          this.onCallEnded();
        }
      } else if (state === 'disconnected') {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = window.setTimeout(() => {
          if (
            this.activeCallId === callId &&
            this.peerConnection &&
            (this.peerConnection.connectionState === 'disconnected' ||
              this.peerConnection.connectionState === 'failed')
          ) {
            if (this.onCallEnded) {
              this.onCallEnded();
            }
          }
        }, 7000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.activeCallId !== callId) return;
      const iceState = pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
        this.notifyConnectedOnce();
        publishRemoteStream();
      } else if (iceState === 'failed') {
        try {
          if (typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
        } catch {}
      }
    };
  }

  /**
   * Start Outbound Call as Caller (Cloud Firestore Signaling)
   */
  public async startOutboundCall(
    caller: { id: string; name: string; phone?: string; email?: string },
    sakhi: Sakhi,
    callType: CallType
  ): Promise<string> {
    this.cleanup();

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeCallId = callId;
    this.hasNotifiedConnected = false;
    markCallAsHandled(callId);

    const rawHostDigits = String(sakhi.phone || '').replace(/\D/g, '');
    const idHostDigits = String(sakhi.id || '').startsWith('user_') ? '' : String(sakhi.id || '').replace(/\D/g, '');
    const cleanHostPhone =
      rawHostDigits.length >= 10
        ? rawHostDigits.slice(-10)
        : idHostDigits.length >= 10
        ? idHostDigits.slice(-10)
        : '';

    const rawCallerDigits = String(caller.phone || '').replace(/\D/g, '');
    const idCallerDigits = String(caller.id || '').startsWith('user_') ? '' : String(caller.id || '').replace(/\D/g, '');
    const cleanCallerPhone =
      rawCallerDigits.length >= 10
        ? rawCallerDigits.slice(-10)
        : idCallerDigits.length >= 10
        ? idCallerDigits.slice(-10)
        : '';

    const initialCallDoc: CallSessionDoc = {
      id: callId,
      callerId: caller.id,
      callerName: caller.name,
      callerPhone: cleanCallerPhone,
      sakhiId: sakhi.id,
      sakhiPhone: cleanHostPhone,
      sakhiEmail: (sakhi.email || '').toLowerCase().trim(),
      sakhiName: sakhi.name,
      sakhiAvatar: sakhi.avatar || '',
      callType,
      status: 'ringing',
      callerCandidates: [],
      calleeCandidates: [],
      createdAt: Date.now()
    };

    let isDocCreated = false;
    const queuedCandidates: Record<string, any>[] = [];
    let candidateBatchTimer: any = null;
    const addedCalleeCandidates = new Set<string>();
    const pendingCalleeCandidates: any[] = [];
    let isRemoteDescSet = false;
    let pendingRemoteAnswer: RTCSessionDescriptionInit | null = null;

    const flushCandidates = async () => {
      if (
        queuedCandidates.length === 0 ||
        !isDocCreated ||
        this.activeCallId !== callId ||
        !isFirebaseConfigured() ||
        !db
      ) {
        return;
      }
      const toSend = queuedCandidates.splice(0, queuedCandidates.length);
      try {
        await updateDoc(doc(db, 'calls', callId), {
          callerCandidates: arrayUnion(...toSend)
        });
      } catch (e) {
        console.warn('Caller ICE candidate flush error:', e);
      }
    };

    const drainCalleeCandidates = async () => {
      const pc = this.peerConnection;
      if (!pc || !isRemoteDescSet || this.activeCallId !== callId) return;
      while (pendingCalleeCandidates.length > 0) {
        const c = pendingCalleeCandidates.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {}
      }
    };

    const applyRemoteAnswerIfReady = async (answerSdp: RTCSessionDescriptionInit) => {
      const pc = this.peerConnection;
      if (!pc || isRemoteDescSet || this.activeCallId !== callId) return;
      if (pc.signalingState !== 'have-local-offer') {
        pendingRemoteAnswer = answerSdp;
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
        isRemoteDescSet = true;
        pendingRemoteAnswer = null;
        await drainCalleeCandidates();
      } catch (sdpErr) {
        console.warn('Caller set remote description error:', sdpErr);
      }
    };

    // 1. Write 'ringing' call session to Cloud Firestore IMMEDIATELY (<100ms) so Receiver's phone rings right away!
    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, 'calls', callId), stripUndefined(initialCallDoc));
        if (this.activeCallId !== callId) {
          await setDoc(
            doc(db, 'calls', callId),
            { status: 'ended', endedAt: Date.now() },
            { merge: true }
          );
          this.cleanup();
          return callId;
        }
        isDocCreated = true;
      } catch (err) {
        console.warn('Error saving initial call session in Firestore:', err);
      }

      // Attach listener right away so fast reject / answer is never missed
      const unsub = onSnapshot(doc(db, 'calls', callId), async (docSnap) => {
        if (!docSnap.exists() || this.activeCallId !== callId) return;
        const session = docSnap.data() as CallSessionDoc;

        // Rejected or Busy
        if (session.status === 'rejected' || session.status === 'busy') {
          const cb = this.onCallRejected;
          this.cleanup();
          if (cb) {
            cb('Sakhi ne call decline kar di ya wo abhi busy hain.');
          }
          return;
        }

        // Ended by remote party
        if (session.status === 'ended') {
          const cb = this.onCallEnded;
          this.cleanup();
          if (cb) {
            cb();
          }
          return;
        }

        // Callee Picked Up (Connected)
        if (session.status === 'connected') {
          this.notifyConnectedOnce();
        }

        if (session.answer && !isRemoteDescSet) {
          await applyRemoteAnswerIfReady(session.answer);
        }

        // Callee ICE Candidates
        if (Array.isArray(session.calleeCandidates)) {
          for (const c of session.calleeCandidates) {
            if (!c || !c.candidate) continue;
            const key = c.candidate;
            if (!addedCalleeCandidates.has(key)) {
              addedCalleeCandidates.add(key);
              if (isRemoteDescSet && this.peerConnection?.currentRemoteDescription) {
                try {
                  await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
                } catch {}
              } else {
                pendingCalleeCandidates.push(c);
              }
            }
          }
        }
      });

      this.unsubscribers.push(unsub);
    }

    // 2. Acquire local camera & microphone stream
    const localStream = await this.getMediaStream(callType);

    if (this.activeCallId !== callId) {
      this.cleanup();
      return callId;
    }

    if (this.onLocalStreamUpdated && localStream) {
      this.onLocalStreamUpdated(localStream);
    }

    // 3. Setup RTCPeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    const hasAudioTrack = Boolean(localStream && localStream.getAudioTracks().length > 0);
    const hasVideoTrack = Boolean(localStream && localStream.getVideoTracks().length > 0);

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
      });
    }

    try {
      if (!hasAudioTrack) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      if (callType === 'video' && !hasVideoTrack) {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }
    } catch {}

    this.attachTrackReceiver(pc, callId);

    pc.onicecandidate = (event) => {
      if (this.activeCallId !== callId) return;
      if (event.candidate && event.candidate.candidate) {
        queuedCandidates.push(sanitizeCandidate(event.candidate));
        if (isDocCreated) {
          if (candidateBatchTimer) clearTimeout(candidateBatchTimer);
          candidateBatchTimer = setTimeout(flushCandidates, 80);
        }
      }
    };

    // 4. Create Offer SDP & publish to Firestore
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video'
    });

    if (this.activeCallId !== callId) {
      this.cleanup();
      return callId;
    }

    await pc.setLocalDescription(offer);

    if (this.activeCallId !== callId) {
      this.cleanup();
      return callId;
    }

    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(
          doc(db, 'calls', callId),
          {
            offer: {
              type: offer.type,
              sdp: offer.sdp
            }
          },
          { merge: true }
        );
        isDocCreated = true;
        flushCandidates();
      } catch (err) {
        console.warn('Error updating offer SDP in Firestore:', err);
      }
    }

    if (pendingRemoteAnswer && !isRemoteDescSet) {
      await applyRemoteAnswerIfReady(pendingRemoteAnswer);
    }

    return callId;
  }

  /**
   * Answer Incoming Call as Host or Caller Receiver
   */
  public async answerIncomingCall(callSession: CallSessionDoc): Promise<boolean> {
    this.cleanup();
    const callId = callSession.id;
    this.activeCallId = callId;
    this.hasNotifiedConnected = false;
    markCallAsHandled(callId);

    const addedCallerCandidates = new Set<string>();
    const pendingCallerCandidates: any[] = [];
    let isRemoteDescSet = false;
    let isNegotiatingAnswer = false;
    let latestOffer = callSession.offer;

    const queueCallerCandidates = (candidates?: any[]) => {
      if (!Array.isArray(candidates)) return;
      for (const c of candidates) {
        if (!c || !c.candidate) continue;
        const cKey = c.candidate;
        if (!addedCallerCandidates.has(cKey)) {
          addedCallerCandidates.add(cKey);
          pendingCallerCandidates.push(c);
        }
      }
    };

    queueCallerCandidates(callSession.callerCandidates);

    // 1. Immediately check Firestore & mark call 'connected' so Caller knows Receiver picked up right away
    if (isFirebaseConfigured() && db) {
      try {
        const snap = await getDoc(doc(db, 'calls', callId));
        if (snap.exists()) {
          const freshData = snap.data() as CallSessionDoc;
          if (freshData.status === 'ended' || freshData.status === 'rejected') {
            const cb = this.onCallEnded;
            this.cleanup();
            if (cb) cb();
            return false;
          }
          if (freshData.offer) {
            latestOffer = freshData.offer;
          }
          queueCallerCandidates(freshData.callerCandidates);
        }

        if (this.activeCallId !== callId) {
          this.cleanup();
          return false;
        }

        // Notify caller immediately that call is picked up
        await setDoc(
          doc(db, 'calls', callId),
          {
            status: 'connected',
            connectedAt: Date.now()
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Initial answer status update note:', err);
      }
    }

    if (this.activeCallId !== callId) {
      this.cleanup();
      return false;
    }

    // 2. Acquire Receiver's camera & microphone stream
    const callType = callSession.callType;
    const localStream = await this.getMediaStream(callType);

    if (this.activeCallId !== callId) {
      this.cleanup();
      return false;
    }

    if (this.onLocalStreamUpdated && localStream) {
      this.onLocalStreamUpdated(localStream);
    }

    // 3. Setup RTCPeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    const hasAudioTrack = Boolean(localStream && localStream.getAudioTracks().length > 0);
    const hasVideoTrack = Boolean(localStream && localStream.getVideoTracks().length > 0);

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
      });
    }

    try {
      if (!hasAudioTrack) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      if (callType === 'video' && !hasVideoTrack) {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }
    } catch {}

    this.attachTrackReceiver(pc, callId);

    // Capture Callee ICE Candidates and batch push to Firestore
    const calleeQueuedCandidates: Record<string, any>[] = [];
    let calleeBatchTimer: any = null;

    const flushCalleeCandidates = async () => {
      if (
        calleeQueuedCandidates.length === 0 ||
        this.activeCallId !== callId ||
        !isFirebaseConfigured() ||
        !db
      ) {
        return;
      }
      const toSend = calleeQueuedCandidates.splice(0, calleeQueuedCandidates.length);
      try {
        await updateDoc(doc(db, 'calls', callId), {
          calleeCandidates: arrayUnion(...toSend)
        });
      } catch (e) {
        console.warn('Callee ICE candidate flush error:', e);
      }
    };

    pc.onicecandidate = (event) => {
      if (this.activeCallId !== callId) return;
      if (event.candidate && event.candidate.candidate) {
        calleeQueuedCandidates.push(sanitizeCandidate(event.candidate));
        if (calleeBatchTimer) clearTimeout(calleeBatchTimer);
        calleeBatchTimer = setTimeout(flushCalleeCandidates, 80);
      }
    };

    const drainCallerCandidates = async () => {
      if (!pc || !isRemoteDescSet || this.activeCallId !== callId) return;
      while (pendingCallerCandidates.length > 0) {
        const c = pendingCallerCandidates.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {}
      }
    };

    const handleRemoteOfferAndCreateAnswer = async (offerSdp: RTCSessionDescriptionInit) => {
      if (isRemoteDescSet || isNegotiatingAnswer || this.activeCallId !== callId || !pc) return;
      isNegotiatingAnswer = true;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
        isRemoteDescSet = true;
        await drainCallerCandidates();

        if (this.activeCallId !== callId) return;
        const answer = await pc.createAnswer();
        if (this.activeCallId !== callId) return;
        await pc.setLocalDescription(answer);

        if (isFirebaseConfigured() && db && this.activeCallId === callId) {
          await setDoc(
            doc(db, 'calls', callId),
            {
              status: 'connected',
              answer: { type: answer.type, sdp: answer.sdp },
              connectedAt: Date.now()
            },
            { merge: true }
          );
          flushCalleeCandidates();
        }
      } catch (err) {
        console.warn('Error negotiating remote offer / answer on Firestore:', err);
      } finally {
        isNegotiatingAnswer = false;
      }
    };

    // 4. Attach real-time listener for Caller offer (if arriving right after pickup), Caller ICE candidates & hangup
    if (isFirebaseConfigured() && db) {
      const unsub = onSnapshot(doc(db, 'calls', callId), async (docSnap) => {
        if (!docSnap.exists() || this.activeCallId !== callId) return;
        const data = docSnap.data() as CallSessionDoc;

        if (data.status === 'ended' || data.status === 'rejected') {
          const cb = this.onCallEnded;
          this.cleanup();
          if (cb) cb();
          return;
        }

        if (data.offer && !isRemoteDescSet) {
          latestOffer = data.offer;
          await handleRemoteOfferAndCreateAnswer(data.offer);
        }

        if (Array.isArray(data.callerCandidates)) {
          for (const c of data.callerCandidates) {
            if (!c || !c.candidate) continue;
            const cKey = c.candidate;
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

    // 5. If Offer SDP is already present, set Remote Offer & Create Answer immediately
    if (latestOffer && !isRemoteDescSet) {
      await handleRemoteOfferAndCreateAnswer(latestOffer);
    }

    if (this.activeCallId === callId) {
      this.notifyConnectedOnce();
    }

    return true;
  }

  /**
   * Reject Incoming Call
   */
  public async rejectIncomingCall(callId: string): Promise<void> {
    if (!callId) return;
    markCallAsHandled(callId);
    if (this.activeCallId === callId) {
      this.cleanup();
    }
    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(
          doc(db, 'calls', callId),
          {
            status: 'rejected',
            endedAt: Date.now()
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Error rejecting incoming call:', err);
      }
    }
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
      skipStatusUpdate?: boolean;
    }
  ): Promise<void> {
    const id = callId || this.activeCallId;
    if (id) {
      markCallAsHandled(id);
    }
    this.cleanup();
    if (id && !details?.skipStatusUpdate && isFirebaseConfigured() && db) {
      try {
        const cleanDetails = details ? stripUndefined(details) : {};
        delete cleanDetails.skipStatusUpdate;
        await setDoc(
          doc(db, 'calls', id),
          {
            status: 'ended',
            endedAt: Date.now(),
            ...cleanDetails
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Error marking call ended in Firestore:', err);
      }
    }
  }

  /**
   * Toggle Audio Mute
   */
  public toggleMute(muted?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const nextEnabled = muted !== undefined ? !muted : !audioTracks[0].enabled;
      audioTracks.forEach((t) => {
        t.enabled = nextEnabled;
      });
      return !nextEnabled;
    }
    return false;
  }

  /**
   * Toggle Video On/Off
   */
  public toggleVideo(off?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const nextEnabled = off !== undefined ? !off : !videoTracks[0].enabled;
      videoTracks.forEach((t) => {
        t.enabled = nextEnabled;
      });
      return !nextEnabled;
    }
    return false;
  }

  /**
   * Full cleanup of peer connection, streams and listeners
   */
  public cleanup(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

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
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
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
    this.hasNotifiedConnected = false;
    setNativeCallAudioMode(false, false);
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

const stripIdentityPrefix = (raw: string): string => {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(sakhi-user-|sakhi-host-|sakhi-email-|host_|host-|caller-|caller_|user_|user-|email_|email-)+/, '');
};

/**
 * Real-time listener for incoming calls for a logged-in Host or Caller.
 * Supports multiple receiver identifiers (phone, hostId, callerId, email),
 * is 100% immune to clock skew between devices, and filters out handled, stale, or cancelled calls immediately.
 */
export const subscribeToIncomingCallsForHost = (
  receiverInput: string | string[],
  onIncomingCall: (call: CallSessionDoc | null) => void
): (() => void) => {
  const rawList = Array.isArray(receiverInput) ? receiverInput : [receiverInput];
  const receiverIds = new Set<string>();
  const receiverCoreSlugs = new Set<string>();
  const receiverPhones = new Set<string>();
  const receiverEmails = new Set<string>();

  const registerSlugVariants = (slug: string) => {
    const clean = slug.trim().toLowerCase();
    if (!clean) return;
    receiverCoreSlugs.add(clean);
    receiverIds.add(clean);
    receiverIds.add(`sakhi-host-${clean}`);
    receiverIds.add(`sakhi-email-${clean}`);
    receiverIds.add(`sakhi-user-${clean}`);
    receiverIds.add(`host_${clean}`);
    receiverIds.add(`caller-${clean}`);
    receiverIds.add(`caller_${clean}`);
    receiverIds.add(`user_${clean}`);
    receiverIds.add(`email_${clean}`);
  };

  rawList.forEach((item) => {
    if (!item) return;
    const trimmed = String(item).trim();
    if (!trimmed) return;
    receiverIds.add(trimmed);
    receiverIds.add(trimmed.toLowerCase());

    const stripped = stripIdentityPrefix(trimmed);
    if (stripped) {
      registerSlugVariants(stripped.replace(/[^a-z0-9_]/g, '_'));
    }

    if (trimmed.includes('@')) {
      const emailClean = trimmed.toLowerCase();
      receiverEmails.add(emailClean);
      const slug = emailClean.replace(/[^a-z0-9]/g, '_');
      registerSlugVariants(slug);
    } else if (!trimmed.toLowerCase().startsWith('user_')) {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        receiverPhones.add(last10);
        registerSlugVariants(last10);
      }
    }
  });

  if (
    receiverIds.size === 0 &&
    receiverCoreSlugs.size === 0 &&
    receiverPhones.size === 0 &&
    receiverEmails.size === 0
  ) {
    return () => {};
  }

  if (isFirebaseConfigured() && db) {
    try {
      const callsCol = collection(db, 'calls');
      let currentCallId = '';
      let isInitialSnapshot = true;
      const firstSeenAtMap = new Map<string, number>();
      const expiryTimers = new Map<string, number>();

      const clearAllExpiryTimers = () => {
        expiryTimers.forEach((timerId) => clearTimeout(timerId));
        expiryTimers.clear();
      };

      const unsub = onSnapshot(
        callsCol,
        (snapshot) => {
          const now = Date.now();
          const matchingCalls: CallSessionDoc[] = [];

          // Track newly added/modified ringing calls on receiver's own clock (100% immune to sender clock skew)
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const cData = change.doc.data() as CallSessionDoc;
              if (cData && cData.status === 'ringing' && !firstSeenAtMap.has(change.doc.id)) {
                if (isInitialSnapshot) {
                  // On initial page load, only accept pre-existing ringing calls created within 60s of local clock;
                  // auto-clean old abandoned 'ringing' docs so they never block future calls
                  const ageDiff = Math.abs(now - (cData.createdAt || 0));
                  if (ageDiff <= 60000) {
                    firstSeenAtMap.set(change.doc.id, now);
                  } else {
                    markCallAsHandled(change.doc.id);
                    if (db) {
                      setDoc(
                        doc(db, 'calls', change.doc.id),
                        { status: 'ended', endedAt: now },
                        { merge: true }
                      ).catch(() => {});
                    }
                  }
                } else {
                  // Real-time incoming call event while app is open -> always record current receiver timestamp!
                  firstSeenAtMap.set(change.doc.id, now);
                }
              }
            }
          });
          isInitialSnapshot = false;

          snapshot.forEach((docSnap) => {
            const call = docSnap.data() as CallSessionDoc;
            if (!call || call.status !== 'ringing') return;

            if (isCallHandled(docSnap.id)) {
              return;
            }

            if (webrtcService.getActiveCallId() && webrtcService.getActiveCallId() === docSnap.id) {
              return;
            }

            const firstSeenAt = firstSeenAtMap.get(docSnap.id) ?? now;
            if (!firstSeenAtMap.has(docSnap.id)) {
              firstSeenAtMap.set(docSnap.id, firstSeenAt);
            }

            // Expire ringing call after 50 seconds measured on receiver's own local clock
            if (now - firstSeenAt > 50000) {
              markCallAsHandled(docSnap.id);
              if (db) {
                setDoc(
                  doc(db, 'calls', docSnap.id),
                  { status: 'ended', endedAt: now },
                  { merge: true }
                ).catch(() => {});
              }
              return;
            }

            const callSakhiId = String(call.sakhiId || '').trim();
            const callSakhiSlug = stripIdentityPrefix(callSakhiId).replace(/[^a-z0-9_]/g, '_');
            const callSakhiEmail = String(call.sakhiEmail || '').trim().toLowerCase();
            const callSakhiEmailSlug = callSakhiEmail ? callSakhiEmail.replace(/[^a-z0-9]/g, '_') : '';
            const rawCallHostDigits = String(call.sakhiPhone || '').replace(/\D/g, '');
            const idCallHostDigits = callSakhiId.toLowerCase().startsWith('user_')
              ? ''
              : callSakhiId.replace(/\D/g, '');
            const callHostPhone =
              rawCallHostDigits.length >= 10
                ? rawCallHostDigits.slice(-10)
                : idCallHostDigits.length >= 10
                ? idCallHostDigits.slice(-10)
                : '';

            const isCalleeMatch =
              (callSakhiId &&
                (receiverIds.has(callSakhiId) || receiverIds.has(callSakhiId.toLowerCase()))) ||
              (callSakhiSlug && receiverCoreSlugs.has(callSakhiSlug)) ||
              (callSakhiEmailSlug && receiverCoreSlugs.has(callSakhiEmailSlug)) ||
              (callHostPhone && receiverPhones.has(callHostPhone)) ||
              (callSakhiEmail && receiverEmails.has(callSakhiEmail));

            if (isCalleeMatch) {
              matchingCalls.push({ ...call, id: docSnap.id });

              // Arm a local timeout so the modal closes automatically after 50s if unanswered
              if (!expiryTimers.has(docSnap.id)) {
                const remainingMs = Math.max(1000, 50500 - (now - firstSeenAt));
                const timerId = window.setTimeout(() => {
                  expiryTimers.delete(docSnap.id);
                  markCallAsHandled(docSnap.id);
                  if (currentCallId === docSnap.id) {
                    currentCallId = '';
                    onIncomingCall(null);
                  }
                }, remainingMs);
                expiryTimers.set(docSnap.id, timerId);
              }
            }
          });

          // Sort by most recently seen on receiver's own clock (tie-break by createdAt)
          matchingCalls.sort((a, b) => {
            const seenDiff = (firstSeenAtMap.get(b.id) || 0) - (firstSeenAtMap.get(a.id) || 0);
            if (seenDiff !== 0) return seenDiff;
            return (b.createdAt || 0) - (a.createdAt || 0);
          });

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

      return () => {
        clearAllExpiryTimers();
        unsub();
      };
    } catch (err) {
      console.warn('Error subscribing to incoming calls in Firestore:', err);
    }
  }

  return () => {};
};
