import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Sakhi, CallType, CallStatus, CallSession } from '../types';
import { useWallet } from './WalletContext';
import { useHost } from './HostContext';
import { sounds } from '../utils/soundEffects';
import { getCurrentUser, getActiveSession } from '../services/userAuthSync';
import { saveCallLog } from '../services/callLogService';
import {
  webrtcService,
  CallSessionDoc,
  subscribeToIncomingCallsForHost
} from '../services/webrtcService';
import { recordHostIncomeToCloud } from '../services/hostSync';
import { streamAudioController, routeAudioOutput } from '../utils/audioOutput';

const getGlobalCallAudio = (): HTMLAudioElement | null => {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('sunosakhi-global-call-audio') as HTMLAudioElement | null;
  if (!el) {
    el = document.createElement('audio');
    el.id = 'sunosakhi-global-call-audio';
    el.autoplay = true;
    el.setAttribute('playsinline', 'true');
    el.muted = false;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.opacity = '0.001';
    document.body.appendChild(el);
  }
  return el;
};

interface CallContextType {
  activeSakhi: Sakhi | null;
  callType: CallType;
  callStatus: CallStatus;
  durationSeconds: number;
  currentCost: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  callVolume: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCallReceiver: boolean;
  incomingCall: CallSessionDoc | null;
  lastSummary: CallSession | null;
  isSummaryOpen: boolean;
  lowBalanceWarning: boolean;
  endReason: string | null;
  startCall: (sakhi: Sakhi, type: CallType) => Promise<void>;
  cancelCalling: () => void;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => Promise<void>;
  endCall: (reason?: string) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  setSpeaker: (on: boolean) => void;
  setCallVolume: (vol: number) => void;
  volumeUp: () => void;
  volumeDown: () => void;
  switchCamera: () => Promise<boolean>;
  closeSummary: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { balance, deductLiveAmount, recordCallExpense, openWalletModal } = useWallet();
  const { isHostLoggedIn, hostProfile, recordCallIncome, userRole } = useHost();

  const [activeSakhi, setActiveSakhi] = useState<Sakhi | null>(null);
  const [callType, setCallType] = useState<CallType>('voice');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isCallReceiver, setIsCallReceiver] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [currentCost, setCurrentCost] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [callVolume, setCallVolumeState] = useState<number>(1.0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const setCallVolume = (vol: number) => {
    const clamped = Math.max(0.1, Math.min(1.5, parseFloat(vol.toFixed(2))));
    setCallVolumeState(clamped);
    streamAudioController.setVolume(clamped);
    sounds.setRingtoneVolume(isSpeakerOn ? clamped : clamped * 0.25);
    const globalAudio = getGlobalCallAudio();
    if (globalAudio) {
      routeAudioOutput(globalAudio, isSpeakerOn, clamped);
    }
  };

  const volumeUp = () => {
    setCallVolume(callVolume + 0.15);
  };

  const volumeDown = () => {
    setCallVolume(callVolume - 0.15);
  };

  const setSpeaker = (on: boolean) => {
    setIsSpeakerOn(on);
    streamAudioController.setSpeaker(on);
    sounds.setRingtoneVolume(on ? callVolume : callVolume * 0.25);
    const globalAudio = getGlobalCallAudio();
    if (globalAudio) {
      routeAudioOutput(globalAudio, on, callVolume);
    }
  };
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSessionDoc | null>(null);
  const [lastSummary, setLastSummary] = useState<CallSession | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState<boolean>(false);
  const [lowBalanceWarning, setLowBalanceWarning] = useState<boolean>(false);
  const [endReason, setEndReason] = useState<string | null>(null);

  const callingTimerRef = useRef<number | null>(null);
  const activeCallIntervalRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const costRef = useRef<number>(0);

  // Rate lookup
  const getRate = (type: CallType): number => {
    return type === 'voice' ? 5 : 10; // ₹5 for voice, ₹10 for video
  };

  // Helper to reliably detect if current user is a Host
  const checkIsHost = (sessionObj?: any) => {
    const sess = sessionObj || getActiveSession();
    return Boolean(
      userRole === 'host' ||
      isHostLoggedIn ||
      sess?.role === 'host' ||
      localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
      localStorage.getItem('sunosakhi_active_role') === 'host' ||
      (hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10)
    );
  };

  // Subscribe Receiver (Host or Caller) to real-time incoming calls with ringtone alert
  useEffect(() => {
    const session = getActiveSession();
    const currentUser = getCurrentUser();
    const receiverId = (isHostLoggedIn && hostProfile?.phone)
      ? hostProfile.phone
      : (isHostLoggedIn && hostProfile?.id)
      ? hostProfile.id
      : (session.phone || currentUser?.phone || '');

    if (!receiverId) return;

    const unsub = subscribeToIncomingCallsForHost(receiverId, (call) => {
      if (call) {
        // Trigger incoming call if not currently active
        if (callStatus === 'idle') {
          setIncomingCall(call);
        }
      } else {
        // Caller hung up or cancelled before answer
        setIncomingCall(null);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [isHostLoggedIn, hostProfile, callStatus]);

  /**
   * Start Outbound Call as Caller or Host (Host is 100% Free)
   */
  const startCall = async (sakhi: Sakhi, type: CallType) => {
    const session = getActiveSession();
    const requiredMin = getRate(type);
    const isHost = checkIsHost(session);

    // Caller requires login before initiating a call
    if (!isHost && !session.isLoggedIn) {
      alert('🔒 Call start karne ke liye pehle apna mobile number login karein!');
      window.dispatchEvent(new CustomEvent('open-user-auth', { detail: { focus: 'user' } }));
      return;
    }

    // Caller requires minimum balance; Host has ZERO charges (100% Free!)
    if (!isHost && balance < requiredMin) {
      alert(`⚠️ Call start karne ke liye kam se kam ₹${requiredMin} balance hona chahiye. Kripya apna wallet recharge karein!`);
      openWalletModal();
      return;
    }

    setIsCallReceiver(false);
    setActiveSakhi(sakhi);
    setCallType(type);
    setCallStatus('calling');
    setDurationSeconds(0);
    setCurrentCost(0);
    durationRef.current = 0;
    costRef.current = 0;
    setIsMuted(false);
    setIsVideoOff(false);
    setLowBalanceWarning(false);
    setEndReason(null);
    setRemoteStream(null);

    // Play ringing tone
    sounds.startRingtone();

    // Setup WebRTC Callbacks
    webrtcService.onRemoteStreamAvailable = (stream) => {
      setRemoteStream(stream);
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      streamAudioController.attachStream(stream);
      streamAudioController.setSpeaker(isSpeakerOn);
      streamAudioController.setVolume(callVolume);
      const globalAudio = getGlobalCallAudio();
      if (globalAudio) {
        if (globalAudio.srcObject !== stream) {
          globalAudio.srcObject = stream;
        }
        globalAudio.muted = false;
        routeAudioOutput(globalAudio, isSpeakerOn, callVolume);
        globalAudio.play().catch(() => {});
      }
    };

    webrtcService.onCallConnected = () => {
      sounds.stopRingtone();
      sounds.playCallConnected();
      setCallStatus('connected');
      if (callingTimerRef.current) {
        clearTimeout(callingTimerRef.current);
        callingTimerRef.current = null;
      }
    };

    webrtcService.onCallRejected = (reason) => {
      sounds.stopRingtone();
      sounds.playCallEnded();
      alert(reason || 'Sakhi ne call reject kar diya ya wo abhi busy hain.');
      cancelCalling();
    };

    webrtcService.onCallEnded = () => {
      endCall('remote_ended');
    };

    const callerData = {
      id: isHost
        ? (hostProfile?.phone || hostProfile?.id || session.id || 'host_' + Date.now())
        : (session.id || session.phone || 'caller_' + Date.now()),
      name: isHost
        ? (hostProfile?.name || session.name || 'Sakhi Host')
        : (session.name || 'Friendly Caller'),
      phone: isHost
        ? (hostProfile?.phone || session.phone || '')
        : (session.phone || '')
    };

    try {
      await webrtcService.startOutboundCall(callerData, sakhi, type);
      setLocalStream(webrtcService.getLocalStream());

      // Timeout after 35s if host does not answer
      callingTimerRef.current = window.setTimeout(() => {
        if (callStatus === 'calling') {
          sounds.stopRingtone();
          alert(`${sakhi.name} abhi utha nahi pa rahi hain. Kripya thodi der baad dobara call karein.`);
          cancelCalling();
        }
      }, 35000);
    } catch (err) {
      console.warn('WebRTC Call initialization error:', err);
    }
  };

  /**
   * Cancel Outbound Call while ringing
   */
  const cancelCalling = () => {
    if (activeSakhi) {
      saveCallLog({
        sakhiId: activeSakhi.id,
        sakhiName: activeSakhi.name,
        sakhiAvatar: activeSakhi.avatar,
        type: callType,
        direction: 'outgoing',
        status: 'missed',
        durationSeconds: 0,
        cost: 0,
        timestamp: Date.now()
      });
    }

    if (callingTimerRef.current) {
      clearTimeout(callingTimerRef.current);
      callingTimerRef.current = null;
    }
    sounds.stopRingtone();
    const globalAudio = getGlobalCallAudio();
    if (globalAudio) {
      try {
        globalAudio.pause();
        globalAudio.srcObject = null;
      } catch {}
    }
    streamAudioController.detach();
    webrtcService.endActiveCall();
    setCallStatus('idle');
    setIsCallReceiver(false);
    setActiveSakhi(null);
    setLocalStream(null);
    setRemoteStream(null);
  };

  /**
   * Accept Incoming Call as Host
   */
  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    setIsCallReceiver(true);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSpeakerOn(true);
    sounds.stopRingtone();
    sounds.playCallConnected();
    sounds.unlockAudio();

    const globalAudio = getGlobalCallAudio();
    if (globalAudio) {
      globalAudio.muted = false;
      globalAudio.play().catch(() => {});
    }

    webrtcService.onRemoteStreamAvailable = (stream) => {
      setRemoteStream(stream);
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      streamAudioController.attachStream(stream);
      streamAudioController.setSpeaker(isSpeakerOn);
      streamAudioController.setVolume(callVolume);
      if (globalAudio) {
        if (globalAudio.srcObject !== stream) {
          globalAudio.srcObject = stream;
        }
        globalAudio.muted = false;
        routeAudioOutput(globalAudio, isSpeakerOn, callVolume);
        globalAudio.play().catch(() => {});
      }
    };
    webrtcService.onCallEnded = () => {
      endCall('remote_ended');
    };

    try {
      await webrtcService.answerIncomingCall(incomingCall);
      setLocalStream(webrtcService.getLocalStream());

      // Create caller companion representation for host
      setActiveSakhi({
        id: incomingCall.callerId,
        name: incomingCall.callerName || 'Caller',
        age: 24,
        city: 'India',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
        videoPoster: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&auto=format&fit=crop&q=80',
        status: 'online',
        rating: 5,
        totalCalls: 1,
        languages: ['Hindi'],
        bio: 'Dil Se Baat',
        interests: ['Conversation'],
        voiceRatePerMin: 5,
        videoRatePerMin: 10,
        audioSnippet: '',
        tagline: 'SunoSakhi Caller'
      });
      setCallType(incomingCall.callType);
      setCallStatus('connected');
      setDurationSeconds(0);
      setCurrentCost(0);
      durationRef.current = 0;
      costRef.current = 0;
      setIncomingCall(null);
    } catch (err) {
      console.warn('Error accepting incoming call:', err);
    }
  };

  /**
   * Reject Incoming Call as Host
   */
  const rejectIncomingCall = async () => {
    if (!incomingCall) return;
    sounds.stopRingtone();
    saveCallLog({
      sakhiId: hostProfile?.id || 'host',
      sakhiName: incomingCall.callerName || 'Caller',
      sakhiAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      type: incomingCall.callType,
      direction: 'incoming',
      status: 'rejected',
      durationSeconds: 0,
      cost: 0,
      timestamp: Date.now()
    });
    await webrtcService.rejectIncomingCall(incomingCall.id);
    setIncomingCall(null);
  };

  // Timer & real-time deduction effect when connected
  useEffect(() => {
    if (callStatus === 'connected' && activeSakhi) {
      const rate = getRate(callType);
      const perSecRate = rate / 60; // ₹0.0833/s for voice, ₹0.1667/s for video

      activeCallIntervalRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setDurationSeconds(durationRef.current);

        // STRICT RULE: ZERO DEDUCTIONS FOR HOST!
        // Girl Host ID is 100% Free for calls. Only deduct from Caller.
        const liveSession = getActiveSession();
        const isHostSession = isCallReceiver || checkIsHost(liveSession);

        if (isHostSession) {
          if (!isCallReceiver) {
            // Host initiated outgoing call: 100% FREE!
            costRef.current = 0;
            setCurrentCost(0);
          } else {
            // Host is receiving incoming call from a caller: track caller's gross amount
            const newCost = durationRef.current * perSecRate;
            costRef.current = newCost;
            setCurrentCost(newCost);
          }
        } else {
          // Regular caller making the call: deduct live amount
          const newCost = durationRef.current * perSecRate;
          costRef.current = newCost;
          setCurrentCost(newCost);

          const deducted = deductLiveAmount(perSecRate);

          // Check low balance (< 1 min remaining)
          if (balance <= rate * 1.05 && balance > 0) {
            setLowBalanceWarning(true);
            if (durationRef.current % 15 === 0) {
              sounds.playLowBalanceWarning();
            }
          } else {
            setLowBalanceWarning(false);
          }

          // Auto disconnect when caller balance is fully exhausted
          if (!deducted || balance <= 0.05) {
            endCall('insufficient_balance');
          }
        }
      }, 1000);
    } else {
      if (activeCallIntervalRef.current) {
        clearInterval(activeCallIntervalRef.current);
        activeCallIntervalRef.current = null;
      }
    }

    return () => {
      if (activeCallIntervalRef.current) {
        clearInterval(activeCallIntervalRef.current);
        activeCallIntervalRef.current = null;
      }
    };
  }, [callStatus, activeSakhi, callType, balance, isCallReceiver]);

  /**
   * End Active Call
   */
  const endCall = (reason?: string) => {
    const session = getActiveSession();
    sounds.stopRingtone();
    if (callStatus === 'connected') {
      sounds.playCallEnded();
    }

    if (callingTimerRef.current) {
      clearTimeout(callingTimerRef.current);
      callingTimerRef.current = null;
    }
    if (activeCallIntervalRef.current) {
      clearInterval(activeCallIntervalRef.current);
      activeCallIntervalRef.current = null;
    }

    const finalDuration = durationRef.current;
    const wasReceiver = isCallReceiver;
    const isHostSession = wasReceiver || checkIsHost(session);
    const finalCost = isHostSession && !wasReceiver ? 0 : costRef.current;

    webrtcService.endActiveCall(undefined, {
      durationSeconds: finalDuration,
      cost: finalCost,
      hostId: activeSakhi?.id,
      hostPhone: activeSakhi?.phone,
      callerName: session.name,
      callType
    });

    setLocalStream(null);
    setRemoteStream(null);
    streamAudioController.detach();
    const globalAudio = getGlobalCallAudio();
    if (globalAudio) {
      try {
        globalAudio.pause();
        globalAudio.srcObject = null;
      } catch {}
    }

    if (activeSakhi && finalDuration > 0) {
      if (!isHostSession) {
        // Record caller expense (Caller pays)
        recordCallExpense(activeSakhi, callType, finalDuration, finalCost);

        // Instantly credit host commission to cloud server (sath k sath)
        const hostEarned = parseFloat(((finalCost * 0.6).toFixed(2)));
        const mins = Math.ceil(finalDuration / 60);
        recordHostIncomeToCloud(
          activeSakhi.id,
          {
            id: `call-inc-${Date.now()}`,
            type: 'call',
            description: `📞 ${callType === 'voice' ? 'Voice' : 'Video'} Call (${mins} min) from ${session.name || 'Caller'}`,
            grossAmount: parseFloat(finalCost.toFixed(2)),
            hostSharePercent: 60,
            hostEarned,
            timestamp: Date.now()
          },
          undefined,
          {
            hostPhone: activeSakhi.phone,
            durationSec: finalDuration,
            callType
          }
        );
      } else if (wasReceiver) {
        // Record host earning (60%) when host answered incoming call
        recordCallIncome(callType, finalDuration, finalCost);
      } else {
        // Host made an OUTGOING call: 100% FREE!
        console.log('🌸 [HOST OUTGOING CALL ENDED] 100% Free - zero deductions for Host ID.');
      }

      // Save to recent calls log
      saveCallLog({
        sakhiId: activeSakhi.id,
        sakhiName: activeSakhi.name,
        sakhiAvatar: activeSakhi.avatar,
        type: callType,
        direction: wasReceiver ? 'incoming' : 'outgoing',
        status: 'completed',
        durationSeconds: finalDuration,
        cost: isHostSession && !wasReceiver ? 0 : parseFloat(finalCost.toFixed(2)),
        timestamp: Date.now()
      });

      setLastSummary({
        sakhi: activeSakhi,
        type: callType,
        startTime: Date.now() - finalDuration * 1000,
        durationSeconds: finalDuration,
        ratePerMin: isHostSession && !wasReceiver ? 0 : getRate(callType),
        totalCost: isHostSession && !wasReceiver ? 0 : parseFloat(finalCost.toFixed(2))
      });
      setIsSummaryOpen(true);
    }

    if (reason === 'insufficient_balance') {
      setEndReason('insufficient_balance');
    }

    setCallStatus('idle');
    setIsCallReceiver(false);
    setActiveSakhi(null);
  };

  const toggleMute = () => {
    const muted = webrtcService.toggleMute();
    setIsMuted(muted);
  };

  const toggleVideo = () => {
    const videoOff = webrtcService.toggleVideo();
    setIsVideoOff(videoOff);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      streamAudioController.setSpeaker(next);
      sounds.setRingtoneVolume(next ? callVolume : callVolume * 0.25);
      return next;
    });
  };

  const switchCamera = async () => {
    return webrtcService.switchCamera();
  };

  const closeSummary = () => {
    setIsSummaryOpen(false);
    setLastSummary(null);
    if (endReason === 'insufficient_balance') {
      openWalletModal();
      setEndReason(null);
    }
  };

  return (
    <CallContext.Provider
      value={{
        activeSakhi,
        callType,
        callStatus,
        isCallReceiver,
        durationSeconds,
        currentCost,
        isMuted,
        isVideoOff,
        isSpeakerOn,
        callVolume,
        localStream,
        remoteStream,
        incomingCall,
        lastSummary,
        isSummaryOpen,
        lowBalanceWarning,
        endReason,
        startCall,
        cancelCalling,
        acceptIncomingCall,
        rejectIncomingCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleSpeaker,
        setSpeaker,
        setCallVolume,
        volumeUp,
        volumeDown,
        switchCamera,
        closeSummary
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
