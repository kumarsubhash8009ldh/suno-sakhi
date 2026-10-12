import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion
} from 'firebase/firestore';
import {
  ref as dbRef,
  set as dbSet,
  update as dbUpdate,
  get as dbGet,
  onValue as dbOnValue
} from 'firebase/database';
import { db, rtdb, isFirebaseConfigured } from './firebase';
import { CallType, Sakhi } from '../types';

export interface CallSessionDoc {
  id: string;
  callerId: string;
  callerName: string;
  callerPhone?: string;
  callerEmail?: string;
  callerClientId?: string;
  sakhiId: string;
  sakhiPhone?: string;
  sakhiEmail?: string;
  sakhiName: string;
  sakhiAvatar?: string;
  callType: CallType;
  status: 'ringing' | 'connected' | 'rejected' | 'ended' | 'busy';
  offer?: any;
  answer?: any;
  callerCandidates?: any[] | Record<string, any>;
  calleeCandidates?: any[] | Record<string, any>;
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
 * Unique per-tab/per-window client ID so a tab never rings for its own outbound call,
 * while other tabs or devices ring immediately.
 */
const MY_SIGNALING_CLIENT_ID =
  typeof window !== 'undefined'
    ? (() => {
        let cid = sessionStorage.getItem('sunosakhi_call_client_id');
        if (!cid) {
          cid = 'call_client_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
          sessionStorage.setItem('sunosakhi_call_client_id', cid);
        }
        return cid;
      })()
    : 'server_client';

/**
 * Instant 0ms local BroadcastChannel for multi-tab / same-device signaling alongside Cloud RTDB
 */
const callBroadcastChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('sunosakhi_realtime_calls_v2')
    : null;

const localCallSessionsCache = new Map<string, CallSessionDoc>();
const localCallSubscribers = new Set<(callsMap: Map<string, CallSessionDoc>) => void>();

function notifyLocalCallSubscribers(updatedDoc?: CallSessionDoc) {
  if (updatedDoc && updatedDoc.id) {
    const prev = localCallSessionsCache.get(updatedDoc.id) || ({} as CallSessionDoc);
    const merged: CallSessionDoc = {
      ...prev,
      ...updatedDoc,
      callerCandidates: {
        ...(normalizeCandidatesMap(prev.callerCandidates)),
        ...(normalizeCandidatesMap(updatedDoc.callerCandidates))
      },
      calleeCandidates: {
        ...(normalizeCandidatesMap(prev.calleeCandidates)),
        ...(normalizeCandidatesMap(updatedDoc.calleeCandidates))
      }
    };
    localCallSessionsCache.set(updatedDoc.id, merged);
  }
  localCallSubscribers.forEach((cb) => {
    try {
      cb(localCallSessionsCache);
    } catch {}
  });
}

function broadcastCallUpdate(partialDoc: Partial<CallSessionDoc> & { id: string }) {
  try {
    const prev = localCallSessionsCache.get(partialDoc.id) || ({ id: partialDoc.id } as CallSessionDoc);
    const merged = { ...prev, ...partialDoc } as CallSessionDoc;
    notifyLocalCallSubscribers(merged);
    if (callBroadcastChannel) {
      callBroadcastChannel.postMessage({ type: 'CALL_UPDATE', doc: merged });
    }
  } catch {}
}

if (callBroadcastChannel) {
  callBroadcastChannel.onmessage = (ev) => {
    if (ev.data && ev.data.type === 'CALL_UPDATE' && ev.data.doc?.id) {
      notifyLocalCallSubscribers(ev.data.doc as CallSessionDoc);
    }
  };
}

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

function extractCandidatesList(raw?: any[] | Record<string, any> | null): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((c) => c && c.candidate);
  if (typeof raw === 'object') {
    return Object.values(raw).filter((c: any) => c && c.candidate);
  }
  return [];
}

function normalizeCandidatesMap(raw?: any[] | Record<string, any> | null): Record<string, any> {
  const map: Record<string, any> = {};
  const list = extractCandidatesList(raw);
  list.forEach((c, idx) => {
    if (c && c.candidate) {
      const safeKey = 'c_' + idx + '_' + String(c.candidate).replace(/[^a-zA-Z0-9]/g, '').slice(-24);
      map[safeKey] = c;
    }
  });
  return map;
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

const CALL_STATUS_RANK: Record<string, number> = {
  ringing: 1,
  connected: 2,
  rejected: 3,
  busy: 3,
  ended: 3
};

const mergeCandidates = (
  prev?: any[] | Record<string, any>,
  next?: any[] | Record<string, any>
): any[] => {
  const map = new Map<string, any>();
  for (const c of extractCandidatesList(prev)) {
    if (c && c.candidate) map.set(c.candidate, c);
  }
  for (const c of extractCandidatesList(next)) {
    if (c && c.candidate) map.set(c.candidate, c);
  }
  return Array.from(map.values());
};

const mergeCallSessionMonotonic = (
  prev: CallSessionDoc | null | undefined,
  next: CallSessionDoc
): CallSessionDoc => {
  if (!prev) return next;
  const prevRank = CALL_STATUS_RANK[prev.status] || 0;
  const nextRank = CALL_STATUS_RANK[next.status] || 0;
  const status = nextRank >= prevRank ? next.status : prev.status;

  return {
    ...prev,
    ...next,
    status,
    offer: next.offer || prev.offer,
    answer: next.answer || prev.answer,
    callerCandidates: mergeCandidates(prev.callerCandidates, next.callerCandidates),
    calleeCandidates: mergeCandidates(prev.calleeCandidates, next.calleeCandidates),
    connectedAt: next.connectedAt || prev.connectedAt,
    endedAt: next.endedAt || prev.endedAt
  };
};

/**
 * Subscribe to a single CallSessionDoc in real time across RTDB, BroadcastChannel, and Firestore.
 */
export const subscribeToCallSession = (
  callId: string,
  onUpdate: (session: CallSessionDoc | null) => void
): (() => void) => {
  if (!callId) return () => {};
  const unsubs: (() => void)[] = [];
  let mergedDoc: CallSessionDoc | null = null;

  const publish = (data: CallSessionDoc | null) => {
    if (data) {
      mergedDoc = mergeCallSessionMonotonic(mergedDoc, data);
      onUpdate(mergedDoc);
    } else if (mergedDoc) {
      onUpdate(null);
    }
  };

  // 1. Firebase Realtime Database (Primary <20ms WebSocket listener)
  if (isFirebaseConfigured() && rtdb) {
    try {
      const callRef = dbRef(rtdb, `calls/${callId}`);
      const unsubRtdb = dbOnValue(
        callRef,
        (snap) => {
          if (snap.exists()) {
            const val = snap.val() as CallSessionDoc;
            publish({ ...val, id: callId });
          } else if (mergedDoc) {
            onUpdate(null);
          }
        },
        (err) => {
          console.warn('RTDB call session listener note:', err);
        }
      );
      unsubs.push(unsubRtdb);
    } catch (e) {
      console.warn('RTDB subscribeToCallSession error:', e);
    }
  }

  // 2. Local BroadcastChannel listener
  const localHandler = (map: Map<string, CallSessionDoc>) => {
    const docData = map.get(callId);
    if (docData) {
      publish(docData);
    }
  };
  localCallSubscribers.add(localHandler);
  unsubs.push(() => localCallSubscribers.delete(localHandler));

  // 3. Secondary Cloud Firestore listener (only if available)
  if (isFirebaseConfigured() && db) {
    try {
      const unsubFs = onSnapshot(
        doc(db, 'calls', callId),
        (docSnap) => {
          if (docSnap.exists()) {
            const fsData = docSnap.data() as CallSessionDoc;
            publish({ ...fsData, id: callId });
          }
        },
        () => {}
      );
      unsubs.push(unsubFs);
    } catch {}
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};

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
   * Start Outbound Call as Caller or Host (Real-Time RTDB + BroadcastChannel + Firestore)
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
      callerEmail: (caller.email || '').toLowerCase().trim(),
      callerClientId: MY_SIGNALING_CLIENT_ID,
      sakhiId: sakhi.id,
      sakhiPhone: cleanHostPhone,
      sakhiEmail: (sakhi.email || '').toLowerCase().trim(),
      sakhiName: sakhi.name,
      sakhiAvatar: sakhi.avatar || '',
      callType,
      status: 'ringing',
      callerCandidates: {},
      calleeCandidates: {},
      createdAt: Date.now()
    };

    let isDocCreated = false;
    let candSeq = 0;
    const queuedCandidates: Record<string, any>[] = [];
    let candidateBatchTimer: any = null;
    const addedCalleeCandidates = new Set<string>();
    const pendingCalleeCandidates: any[] = [];
    let isRemoteDescSet = false;
    let isSettingRemoteAnswer = false;
    let pendingRemoteAnswer: RTCSessionDescriptionInit | null = null;

    const flushCandidates = async () => {
      if (queuedCandidates.length === 0 || !isDocCreated || this.activeCallId !== callId) {
        return;
      }
      const toSend = queuedCandidates.splice(0, queuedCandidates.length);
      const candMapUpdate: Record<string, any> = {};
      toSend.forEach((c) => {
        candSeq += 1;
        candMapUpdate[`cand_${Date.now()}_${candSeq}`] = c;
      });

      broadcastCallUpdate({
        id: callId,
        callerCandidates: candMapUpdate
      });

      if (isFirebaseConfigured() && rtdb) {
        try {
          await dbUpdate(dbRef(rtdb, `calls/${callId}/callerCandidates`), candMapUpdate);
        } catch (e) {
          console.warn('RTDB Caller ICE candidate flush error:', e);
        }
      }

      if (isFirebaseConfigured() && db) {
        updateDoc(doc(db, 'calls', callId), {
          callerCandidates: arrayUnion(...toSend)
        }).catch(() => {});
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
      if (!pc || isRemoteDescSet || isSettingRemoteAnswer || this.activeCallId !== callId) return;
      if (pc.signalingState !== 'have-local-offer') {
        pendingRemoteAnswer = answerSdp;
        return;
      }
      isSettingRemoteAnswer = true;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
        isRemoteDescSet = true;
        pendingRemoteAnswer = null;
        await drainCalleeCandidates();
      } catch (sdpErr) {
        console.warn('Caller set remote description error:', sdpErr);
      } finally {
        isSettingRemoteAnswer = false;
      }
    };

    const handleSessionUpdate = async (session: CallSessionDoc | null) => {
      if (!session || this.activeCallId !== callId) return;

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

      if (session.answer && !isRemoteDescSet && !isSettingRemoteAnswer) {
        await applyRemoteAnswerIfReady(session.answer);
      }

      // Callee ICE Candidates (supports both Array and RTDB Object map)
      const calleeCands = extractCandidatesList(session.calleeCandidates);
      for (const c of calleeCands) {
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
    };

    // 1. Attach real-time session listener BEFORE writing so ultra-fast responses are never missed
    const unsubSession = subscribeToCallSession(callId, handleSessionUpdate);
    this.unsubscribers.push(unsubSession);

    // 2. Publish 'ringing' call session IMMEDIATELY (<25ms via RTDB + BroadcastChannel)
    const cleanInitial = stripUndefined(initialCallDoc) as CallSessionDoc;
    broadcastCallUpdate(cleanInitial);

    if (isFirebaseConfigured() && rtdb) {
      try {
        await dbSet(dbRef(rtdb, `calls/${callId}`), cleanInitial);
        isDocCreated = true;
      } catch (err) {
        console.warn('Error saving initial call session in RTDB:', err);
      }
    }

    if (isFirebaseConfigured() && db) {
      setDoc(doc(db, 'calls', callId), {
        ...cleanInitial,
        callerCandidates: [],
        calleeCandidates: []
      })
        .then(() => {
          isDocCreated = true;
        })
        .catch(() => {});
    }

    isDocCreated = true;

    if (this.activeCallId !== callId) {
      this.endActiveCall(callId);
      return callId;
    }

    // 3. Acquire local camera & microphone stream
    const localStream = await this.getMediaStream(callType);

    if (this.activeCallId !== callId) {
      this.cleanup();
      return callId;
    }

    if (this.onLocalStreamUpdated && localStream) {
      this.onLocalStreamUpdated(localStream);
    }

    // 4. Setup RTCPeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
      });
    }

    this.attachTrackReceiver(pc, callId);

    pc.onicecandidate = (event) => {
      if (this.activeCallId !== callId) return;
      if (event.candidate && event.candidate.candidate) {
        queuedCandidates.push(sanitizeCandidate(event.candidate));
        if (isDocCreated) {
          if (candidateBatchTimer) clearTimeout(candidateBatchTimer);
          candidateBatchTimer = setTimeout(flushCandidates, 60);
        }
      }
    };

    // 5. Create Offer SDP & publish to RTDB + Firestore
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

    const offerPayload = {
      type: offer.type,
      sdp: offer.sdp
    };

    broadcastCallUpdate({ id: callId, offer: offerPayload });

    if (isFirebaseConfigured() && rtdb) {
      try {
        await dbUpdate(dbRef(rtdb, `calls/${callId}`), {
          offer: offerPayload
        });
      } catch (err) {
        console.warn('Error updating offer SDP in RTDB:', err);
      }
    }

    if (isFirebaseConfigured() && db) {
      setDoc(doc(db, 'calls', callId), { offer: offerPayload }, { merge: true }).catch(() => {});
    }

    flushCandidates();

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
    let calleeCandSeq = 0;

    const queueCallerCandidates = (candidates?: any[] | Record<string, any>) => {
      const list = extractCandidatesList(candidates);
      for (const c of list) {
        if (!c || !c.candidate) continue;
        const cKey = c.candidate;
        if (!addedCallerCandidates.has(cKey)) {
          addedCallerCandidates.add(cKey);
          pendingCallerCandidates.push(c);
        }
      }
    };

    queueCallerCandidates(callSession.callerCandidates);

    const connectedUpdate = {
      status: 'connected' as const,
      connectedAt: Date.now()
    };

    broadcastCallUpdate({ id: callId, ...connectedUpdate });

    // 1. Immediately check RTDB & mark call 'connected' so Caller knows Receiver picked up right away (<25ms)
    if (isFirebaseConfigured() && rtdb) {
      try {
        const snap = await dbGet(dbRef(rtdb, `calls/${callId}`));
        if (snap.exists()) {
          const freshData = snap.val() as CallSessionDoc;
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

        await dbUpdate(dbRef(rtdb, `calls/${callId}`), connectedUpdate);
      } catch (err) {
        console.warn('RTDB initial answer status update note:', err);
      }
    }

    if (isFirebaseConfigured() && db) {
      setDoc(doc(db, 'calls', callId), connectedUpdate, { merge: true }).catch(() => {});
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

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
      });
    }

    this.attachTrackReceiver(pc, callId);

    // Capture Callee ICE Candidates and batch push to RTDB + Firestore
    const calleeQueuedCandidates: Record<string, any>[] = [];
    let calleeBatchTimer: any = null;

    const flushCalleeCandidates = async () => {
      if (calleeQueuedCandidates.length === 0 || this.activeCallId !== callId) {
        return;
      }
      const toSend = calleeQueuedCandidates.splice(0, calleeQueuedCandidates.length);
      const candMapUpdate: Record<string, any> = {};
      toSend.forEach((c) => {
        calleeCandSeq += 1;
        candMapUpdate[`cand_${Date.now()}_${calleeCandSeq}`] = c;
      });

      broadcastCallUpdate({
        id: callId,
        calleeCandidates: candMapUpdate
      });

      if (isFirebaseConfigured() && rtdb) {
        try {
          await dbUpdate(dbRef(rtdb, `calls/${callId}/calleeCandidates`), candMapUpdate);
        } catch (e) {
          console.warn('RTDB Callee ICE candidate flush error:', e);
        }
      }

      if (isFirebaseConfigured() && db) {
        updateDoc(doc(db, 'calls', callId), {
          calleeCandidates: arrayUnion(...toSend)
        }).catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (this.activeCallId !== callId) return;
      if (event.candidate && event.candidate.candidate) {
        calleeQueuedCandidates.push(sanitizeCandidate(event.candidate));
        if (calleeBatchTimer) clearTimeout(calleeBatchTimer);
        calleeBatchTimer = setTimeout(flushCalleeCandidates, 60);
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

        const answerPayload = {
          status: 'connected' as const,
          answer: { type: answer.type, sdp: answer.sdp },
          connectedAt: Date.now()
        };

        broadcastCallUpdate({ id: callId, ...answerPayload });

        if (isFirebaseConfigured() && rtdb && this.activeCallId === callId) {
          await dbUpdate(dbRef(rtdb, `calls/${callId}`), answerPayload);
        }

        if (isFirebaseConfigured() && db && this.activeCallId === callId) {
          setDoc(doc(db, 'calls', callId), answerPayload, { merge: true }).catch(() => {});
        }

        flushCalleeCandidates();
      } catch (err) {
        console.warn('Error negotiating remote offer / answer:', err);
      } finally {
        isNegotiatingAnswer = false;
      }
    };

    // 4. Attach real-time listener for Caller offer, Caller ICE candidates & hangup
    const unsubSession = subscribeToCallSession(callId, async (data) => {
      if (!data || this.activeCallId !== callId) return;

      if (data.status === 'ended' || data.status === 'rejected') {
        const cb = this.onCallEnded;
        this.cleanup();
        if (cb) cb();
        return;
      }

      if (data.offer && !isRemoteDescSet && !isNegotiatingAnswer) {
        latestOffer = data.offer;
        await handleRemoteOfferAndCreateAnswer(data.offer);
      }

      const callerCands = extractCandidatesList(data.callerCandidates);
      for (const c of callerCands) {
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
    });

    this.unsubscribers.push(unsubSession);

    // 5. If Offer SDP is already present, set Remote Offer & Create Answer immediately
    if (latestOffer && !isRemoteDescSet && !isNegotiatingAnswer) {
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
    const rejectPayload = {
      status: 'rejected' as const,
      endedAt: Date.now()
    };
    broadcastCallUpdate({ id: callId, ...rejectPayload });

    if (isFirebaseConfigured() && rtdb) {
      try {
        await dbUpdate(dbRef(rtdb, `calls/${callId}`), rejectPayload);
      } catch (err) {
        console.warn('Error rejecting incoming call in RTDB:', err);
      }
    }

    if (isFirebaseConfigured() && db) {
      setDoc(doc(db, 'calls', callId), rejectPayload, { merge: true }).catch(() => {});
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
    if (id && !details?.skipStatusUpdate) {
      const cleanDetails = details ? stripUndefined(details) : {};
      delete cleanDetails.skipStatusUpdate;
      const endedPayload = {
        status: 'ended' as const,
        endedAt: Date.now(),
        ...cleanDetails
      };
      broadcastCallUpdate({ id, ...endedPayload });

      if (isFirebaseConfigured() && rtdb) {
        try {
          await dbUpdate(dbRef(rtdb, `calls/${id}`), endedPayload);
        } catch (err) {
          console.warn('Error marking call ended in RTDB:', err);
        }
      }

      if (isFirebaseConfigured() && db) {
        setDoc(doc(db, 'calls', id), endedPayload, { merge: true }).catch(() => {});
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
 * Listens simultaneously to Firebase Realtime Database (`rtdb`), BroadcastChannel, and Cloud Firestore.
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

  let currentCallId = '';
  const allCallsMap = new Map<string, CallSessionDoc>();
  const firstSeenAtMap = new Map<string, number>();
  const expiryTimers = new Map<string, number>();
  const unsubs: (() => void)[] = [];

  const clearAllExpiryTimers = () => {
    expiryTimers.forEach((timerId) => clearTimeout(timerId));
    expiryTimers.clear();
  };

  const evaluateCalls = (isInitialLoad: boolean = false) => {
    const now = Date.now();
    const matchingCalls: CallSessionDoc[] = [];

    allCallsMap.forEach((call, callId) => {
      if (!call || call.status !== 'ringing') return;

      // Never ring on the exact same browser tab/client that initiated the outbound call
      if (call.callerClientId && call.callerClientId === MY_SIGNALING_CLIENT_ID) {
        return;
      }

      if (isCallHandled(callId)) {
        return;
      }

      if (webrtcService.getActiveCallId() && webrtcService.getActiveCallId() === callId) {
        return;
      }

      if (!firstSeenAtMap.has(callId)) {
        const ageDiff = Math.abs(now - (call.createdAt || 0));
        if (isInitialLoad && ageDiff > 55000) {
          markCallAsHandled(callId);
          if (rtdb) {
            dbUpdate(dbRef(rtdb, `calls/${callId}`), { status: 'ended', endedAt: now }).catch(() => {});
          }
          return;
        }
        firstSeenAtMap.set(callId, now);
      }

      const firstSeenAt = firstSeenAtMap.get(callId) ?? now;

      // Expire ringing call after 50 seconds measured on receiver's own local clock
      if (now - firstSeenAt > 50000) {
        markCallAsHandled(callId);
        if (rtdb) {
          dbUpdate(dbRef(rtdb, `calls/${callId}`), { status: 'ended', endedAt: now }).catch(() => {});
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
        matchingCalls.push({ ...call, id: callId });

        if (!expiryTimers.has(callId)) {
          const remainingMs = Math.max(1000, 50500 - (now - firstSeenAt));
          const timerId = window.setTimeout(() => {
            expiryTimers.delete(callId);
            markCallAsHandled(callId);
            if (currentCallId === callId) {
              currentCallId = '';
              onIncomingCall(null);
            }
          }, remainingMs);
          expiryTimers.set(callId, timerId);
        }
      }
    });

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
  };

  // 1. Primary Listener: Firebase Realtime Database (`calls`)
  if (isFirebaseConfigured() && rtdb) {
    try {
      let isInitialRtdb = true;
      const callsRef = dbRef(rtdb, 'calls');
      const unsubRtdb = dbOnValue(
        callsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val() as Record<string, CallSessionDoc>;
            Object.entries(val || {}).forEach(([id, cData]) => {
              if (cData && typeof cData === 'object') {
                const prev = allCallsMap.get(id);
                allCallsMap.set(id, mergeCallSessionMonotonic(prev, { ...cData, id }));
              }
            });
          }
          evaluateCalls(isInitialRtdb);
          isInitialRtdb = false;
        },
        (err) => {
          console.warn('RTDB incoming calls listener note:', err);
        }
      );
      unsubs.push(unsubRtdb);
    } catch (err) {
      console.warn('Error subscribing to incoming calls in RTDB:', err);
    }
  }

  // 2. Local BroadcastChannel listener for 0ms same-browser multi-tab testing
  const localHandler = (cacheMap: Map<string, CallSessionDoc>) => {
    cacheMap.forEach((docData, id) => {
      const prev = allCallsMap.get(id);
      allCallsMap.set(id, mergeCallSessionMonotonic(prev, docData));
    });
    evaluateCalls(false);
  };
  localCallSubscribers.add(localHandler);
  unsubs.push(() => localCallSubscribers.delete(localHandler));

  // 3. Secondary Listener: Cloud Firestore (`calls`)
  if (isFirebaseConfigured() && db) {
    try {
      let isInitialFs = true;
      const unsubFs = onSnapshot(
        collection(db, 'calls'),
        (snapshot) => {
          snapshot.forEach((docSnap) => {
            const cData = docSnap.data() as CallSessionDoc;
            if (cData) {
              const prev = allCallsMap.get(docSnap.id);
              allCallsMap.set(docSnap.id, mergeCallSessionMonotonic(prev, { ...cData, id: docSnap.id }));
            }
          });
          evaluateCalls(isInitialFs);
          isInitialFs = false;
        },
        () => {}
      );
      unsubs.push(unsubFs);
    } catch {}
  }

  return () => {
    clearAllExpiryTimers();
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};
