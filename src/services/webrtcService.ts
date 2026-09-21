import { CallType, Sakhi } from '../types';
import { getApiBaseUrl } from './apiConfig';

export interface CallSessionDoc {
  id: string;
  callerId: string;
  callerName: string;
  callerPhone?: string;
  sakhiId: string;
  sakhiName: string;
  sakhiAvatar?: string;
  callType: CallType;
  status: 'ringing' | 'connected' | 'rejected' | 'ended' | 'busy';
  offer?: any;
  answer?: any;
  createdAt: number;
  connectedAt?: number;
  endedAt?: number;
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
      // Fallback: try audio-only if video failed
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
   * Start Outbound Call as Caller
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

    // Buffer ICE candidates until callId is established on backend
    const queuedCandidates: any[] = [];
    let isCallStartedOnServer = false;
    const baseUrl = getApiBaseUrl();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const cJson = event.candidate.toJSON();
        if (isCallStartedOnServer) {
          fetch(`${baseUrl}/api/calls/candidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callId, role: 'caller', candidate: cJson })
          }).catch(() => {});
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
        console.warn('WebRTC connection dropped/failed');
      }
    };

    // 3. Create Offer SDP
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video'
    });
    await pc.setLocalDescription(offer);

    const callSessionDoc: CallSessionDoc = {
      id: callId,
      callerId: caller.id,
      callerName: caller.name,
      callerPhone: caller.phone || '',
      sakhiId: sakhi.id,
      sakhiName: sakhi.name,
      sakhiAvatar: sakhi.avatar,
      callType,
      status: 'ringing',
      offer: {
        type: offer.type,
        sdp: offer.sdp
      },
      createdAt: Date.now()
    };

    // 4. Save call session to Server
    try {
      await fetch(`${baseUrl}/api/calls/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callSessionDoc)
      });
      isCallStartedOnServer = true;

      // Flush any ICE candidates gathered while saving session
      if (queuedCandidates.length > 0) {
        for (const candidate of queuedCandidates) {
          fetch(`${baseUrl}/api/calls/candidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callId, role: 'caller', candidate })
          }).catch(() => {});
        }
        queuedCandidates.length = 0;
      }
    } catch (err) {
      console.warn('Error starting call on server:', err);
    }

    // 5. Poll server for Answer & Call status
    let isConnected = false;
    const addedCandidates = new Set<string>();
    const pollInterval = window.setInterval(async () => {
      try {
        const res = await fetch(`${baseUrl}/api/calls/session?callId=${callId}`);
        const data = await res.json();
        if (!data.success || !data.session) return;

        const session: CallSessionDoc = data.session;
        if (session.status === 'connected' && session.answer) {
          if (!pc.currentRemoteDescription && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(session.answer));
            } catch (sdpErr) {
              console.warn('Remote description error:', sdpErr);
            }
          }

          // Fetch Callee ICE candidates only when remote description is set
          if (pc.remoteDescription) {
            const cRes = await fetch(`${baseUrl}/api/calls/candidates?callId=${callId}&forRole=caller`);
            const cData = await cRes.json();
            if (cData.candidates && Array.isArray(cData.candidates)) {
              for (const c of cData.candidates) {
                const cStr = JSON.stringify(c);
                if (!addedCandidates.has(cStr)) {
                  addedCandidates.add(cStr);
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(c));
                  } catch (iceErr) {}
                }
              }
            }
          }

          if (!isConnected) {
            isConnected = true;
            if (this.onCallConnected) {
              this.onCallConnected();
            }
          }
        } else if (session.status === 'rejected') {
          clearInterval(pollInterval);
          if (this.onCallRejected) {
            this.onCallRejected('Sakhi ne call reject kar diya ya busy hain.');
          }
          this.cleanup();
        } else if (session.status === 'ended') {
          clearInterval(pollInterval);
          if (this.onCallEnded) {
            this.onCallEnded();
          }
          this.cleanup();
        }
      } catch (err) {
        console.warn('Call session poll error:', err);
      }
    }, 700);

    this.intervals.push(pollInterval);

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

    const baseUrl = getApiBaseUrl();

    // Immediately capture Callee ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        fetch(`${baseUrl}/api/calls/candidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: callSession.id, role: 'callee', candidate: event.candidate.toJSON() })
        }).catch(() => {});
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

    // 1. Set Remote Description from Offer
    if (callSession.offer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(callSession.offer));
      } catch (err) {
        console.warn('Remote offer set error:', err);
      }
    }

    // 2. Create Answer SDP
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // 3. Post Answer to Server
    try {
      await fetch(`${baseUrl}/api/calls/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: callSession.id,
          answer: { type: answer.type, sdp: answer.sdp }
        })
      });
    } catch (err) {
      console.warn('Error answering call on server:', err);
    }

    // 5. Poll for caller ICE candidates & call termination
    const addedCallerCandidates = new Set<string>();
    const hostPollInterval = window.setInterval(async () => {
      try {
        const res = await fetch(`${baseUrl}/api/calls/session?callId=${callSession.id}`);
        const data = await res.json();
        if (data.session && data.session.status === 'ended') {
          clearInterval(hostPollInterval);
          if (this.onCallEnded) this.onCallEnded();
          this.cleanup();
          return;
        }

        const cRes = await fetch(`${baseUrl}/api/calls/candidates?callId=${callSession.id}&forRole=callee`);
        const cData = await cRes.json();
        if (cData.candidates && pc.remoteDescription) {
          for (const c of cData.candidates) {
            const cStr = JSON.stringify(c);
            if (!addedCallerCandidates.has(cStr)) {
              addedCallerCandidates.add(cStr);
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
          }
        }
      } catch (err) {}
    }, 800);

    this.intervals.push(hostPollInterval);

    if (this.onCallConnected) {
      this.onCallConnected();
    }

    return true;
  }

  /**
   * Reject Incoming Call
   */
  public async rejectIncomingCall(callId: string): Promise<void> {
    const baseUrl = getApiBaseUrl();
    try {
      await fetch(`${baseUrl}/api/calls/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, reason: 'rejected' })
      });
    } catch (err) {}
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
    if (id) {
      const baseUrl = getApiBaseUrl();
      try {
        await fetch(`${baseUrl}/api/calls/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: id,
            reason: 'ended',
            durationSeconds: details?.durationSeconds,
            cost: details?.cost,
            hostId: details?.hostId,
            hostPhone: details?.hostPhone,
            callerName: details?.callerName,
            callType: details?.callType
          })
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
   * Full cleanup of peer connection, streams and polling intervals
   */
  public cleanup(): void {
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
      const baseUrl = getApiBaseUrl();
      const payload = JSON.stringify({ callId: activeCallId, reason: 'ended' });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${baseUrl}/api/calls/end`, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(`${baseUrl}/api/calls/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
      webrtcService.cleanup();
    }
  };
  window.addEventListener('beforeunload', handlePageUnload);
  window.addEventListener('pagehide', handlePageUnload);
}

/**
 * Real-time listener for incoming calls for a logged-in Host (Sakhi).
 */
export const subscribeToIncomingCallsForHost = (
  hostId: string,
  onIncomingCall: (call: CallSessionDoc | null) => void
): (() => void) => {
  if (!hostId) return () => {};

  const baseUrl = getApiBaseUrl();
  let lastReceivedCallId = '';

  const intervalId = window.setInterval(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/calls/incoming?hostId=${encodeURIComponent(hostId)}`);
      const data = await res.json();
      if (data.success) {
        if (data.call && data.call.id !== lastReceivedCallId) {
          lastReceivedCallId = data.call.id;
          onIncomingCall(data.call);
        } else if (!data.call && lastReceivedCallId) {
          // Caller ended or cancelled the call before answer
          lastReceivedCallId = '';
          onIncomingCall(null);
        }
      }
    } catch (err) {}
  }, 750);

  return () => {
    clearInterval(intervalId);
  };
};
