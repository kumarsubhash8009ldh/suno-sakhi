import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { CallType, Sakhi } from '../types';
import { getApiBaseUrl } from './apiConfig';

export interface CallSessionDoc {
  id: string;
  callerId: string;
  callerName: string;
  callerPhone?: string;
  sakhiId: string;
  sakhiPhone?: string;
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
    { urls: 'stun:stun.cloudflare.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

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
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.currentFacingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      });
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
   * Acquire camera & microphone stream
   */
  public async getMediaStream(callType: CallType): Promise<MediaStream | null> {
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
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: callType === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: this.currentFacingMode } : false
          });
          stream.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
          this.localStream = stream;
          return stream;
        } catch (firstErr) {
          console.warn('Advanced getUserMedia failed, attempting standard constraints:', firstErr);
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video'
          });
          fallbackStream.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
          this.localStream = fallbackStream;
          return fallbackStream;
        }
      }
    } catch (err) {
      console.warn('Microphone/Camera permission not available:', err);
      if (callType === 'video') {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          audioStream.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
          this.localStream = audioStream;
          return audioStream;
        } catch {}
      }
    }
    return null;
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

    // 1. Get media stream
    const localStream = await this.getMediaStream(callType);

    // 2. Setup RTCPeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      console.log('📡 [WebRTC] Caller received remote track:', event.track.kind, event.track.id);
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

    // Buffer ICE candidates until call doc is created
    const queuedCandidates: any[] = [];
    let isDocCreated = false;

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const cJson = event.candidate.toJSON();
        if (isDocCreated && isFirebaseConfigured() && db) {
          try {
            await updateDoc(doc(db, 'calls', callId), {
              callerCandidates: arrayUnion(cJson)
            });
          } catch (e) {
            console.warn('Caller ICE candidate error:', e);
          }
        } else {
          queuedCandidates.push(cJson);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('📡 [WebRTC] Caller Connection State:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (this.onCallConnected) this.onCallConnected();
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
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('WebRTC connection failed or disconnected');
      }
    };

    // 3. Create Offer SDP
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video'
    });
    await pc.setLocalDescription(offer);

    const cleanHostPhone = String(sakhi.phone || sakhi.id || '').replace(/\D/g, '').slice(-10);
    const cleanCallerPhone = String(caller.phone || caller.id || '').replace(/\D/g, '').slice(-10);

    const callSessionDoc: CallSessionDoc = {
      id: callId,
      callerId: caller.id,
      callerName: caller.name,
      callerPhone: cleanCallerPhone,
      sakhiId: sakhi.id,
      sakhiPhone: cleanHostPhone,
      sakhiName: sakhi.name,
      sakhiAvatar: sakhi.avatar,
      callType,
      status: 'ringing',
      offer: {
        type: offer.type,
        sdp: offer.sdp
      },
      callerCandidates: queuedCandidates,
      calleeCandidates: [],
      createdAt: Date.now()
    };

    // 4. Save call session to Cloud Firestore
    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, 'calls', callId), callSessionDoc);
        isDocCreated = true;
        console.log('✅ [WebRTC] Call Session published to Cloud Firestore:', callId);
      } catch (err) {
        console.warn('Error saving call session in Firestore:', err);
      }

      // 5. Listen to Call Session Doc for Answer & ICE Candidates
      const addedCalleeCandidates = new Set<string>();
      const unsub = onSnapshot(doc(db, 'calls', callId), async (docSnap) => {
        if (!docSnap.exists()) return;
        const session = docSnap.data() as CallSessionDoc;

        // Callee Answered
        if (session.status === 'connected' && session.answer) {
          if (pc.signalingState === 'have-local-offer' && !pc.currentRemoteDescription) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(session.answer));
              console.log('📡 [WebRTC] Remote Answer description set successfully on Caller!');
              if (this.onCallConnected) this.onCallConnected();
            } catch (sdpErr) {
              console.warn('Caller set remote description error:', sdpErr);
            }
          }
        }

        // Callee ICE Candidates
        if (Array.isArray(session.calleeCandidates)) {
          for (const c of session.calleeCandidates) {
            const key = JSON.stringify(c);
            if (!addedCalleeCandidates.has(key)) {
              addedCalleeCandidates.add(key);
              try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              } catch (e) {}
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
   * Answer Incoming Call as Host (Sakhi)
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

    pc.ontrack = (event) => {
      console.log('📡 [WebRTC] Callee received remote track:', event.track.kind, event.track.id);
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

    // Capture Callee ICE Candidates and push to Firestore
    pc.onicecandidate = async (event) => {
      if (event.candidate && isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'calls', callSession.id), {
            calleeCandidates: arrayUnion(event.candidate.toJSON())
          });
        } catch (e) {}
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('📡 [WebRTC] Callee Connection State:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (this.onCallConnected) this.onCallConnected();
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
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('Callee connection state failed/disconnected');
      }
    };

    // 1. Set Remote Description from Offer
    if (callSession.offer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(callSession.offer));
        console.log('📡 [WebRTC] Callee set remote offer description');
      } catch (err) {
        console.warn('Remote offer set error on callee:', err);
      }
    }

    // 2. Create Answer SDP
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // 3. Post Answer to Cloud Firestore
    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'calls', callSession.id), {
          status: 'connected',
          answer: { type: answer.type, sdp: answer.sdp },
          connectedAt: Date.now()
        });
        console.log('✅ [WebRTC] Call Answer published to Firestore');
      } catch (err) {
        console.warn('Error answering call on Firestore:', err);
      }

      // 4. Listen for Caller ICE Candidates and Call End
      const addedCallerCandidates = new Set<string>();
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
              try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              } catch (e) {}
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
      } catch (err) {}
    }
    this.cleanup();
  }

  /**
   * End Active Call (User or Host Hangup)
   */
  public async endActiveCall(
    callId?: string,
    details?: { durationSeconds?: number; cost?: number; hostId?: string; hostPhone?: string; callerName?: string; callType?: string }
  ): Promise<void> {
    const id = callId || this.activeCallId;
    if (id && isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'calls', id), {
          status: 'ended',
          endedAt: Date.now(),
          ...(details || {})
        });
      } catch (err) {}
    }
    this.cleanup();
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
   * Full cleanup of peer connection, streams and polling/listeners
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

// Global Singleton Instance
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
 * Listens directly to Cloud Firestore `calls` collection.
 */
export const subscribeToIncomingCallsForHost = (
  receiverId: string,
  onIncomingCall: (call: CallSessionDoc | null) => void
): (() => void) => {
  if (!receiverId) return () => {};

  const cleanReceiverDigits = String(receiverId).replace(/\D/g, '').slice(-10);

  if (isFirebaseConfigured() && db) {
    try {
      const callsCol = collection(db, 'calls');
      let currentCallId = '';

      const unsub = onSnapshot(
        callsCol,
        (snapshot) => {
          let activeIncoming: CallSessionDoc | null = null;
          const now = Date.now();

          snapshot.forEach((docSnap) => {
            const call = docSnap.data() as CallSessionDoc;
            if (!call || call.status !== 'ringing') return;
            // Only trigger if initiated in the last 45 seconds
            if (call.createdAt && now - call.createdAt > 45000) return;

            const callHostDigits = String(call.sakhiPhone || call.sakhiId || '').replace(/\D/g, '').slice(-10);
            const callSakhiId = String(call.sakhiId || '');
            const callCallerDigits = String(call.callerPhone || call.callerId || '').replace(/\D/g, '').slice(-10);

            // Match host receiver (standard incoming call) or caller receiver
            const isMatch = (
              callSakhiId === receiverId ||
              (cleanReceiverDigits && callHostDigits === cleanReceiverDigits) ||
              (cleanReceiverDigits && callSakhiId.includes(cleanReceiverDigits)) ||
              (cleanReceiverDigits && callCallerDigits === cleanReceiverDigits)
            );

            if (isMatch) {
              activeIncoming = { ...call, id: docSnap.id };
            }
          });

          if (activeIncoming) {
            if (currentCallId !== (activeIncoming as CallSessionDoc).id) {
              currentCallId = (activeIncoming as CallSessionDoc).id;
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
