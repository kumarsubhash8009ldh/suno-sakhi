import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Sakhi, CallType, CallStatus, CallSession } from '../types';
import { useWallet } from './WalletContext';
import { useHost } from './HostContext';
import { useAdmin } from './AdminContext';
import { sounds } from '../utils/soundEffects';
import { getCurrentUser, getActiveSession } from '../services/userAuthSync';
import { saveCallLog } from '../services/callLogService';
import { isUserBlocked } from '../services/safetyService';
import {
  webrtcService,
  CallSessionDoc,
  subscribeToIncomingCallsForHost
} from '../services/webrtcService';
import { recordHostIncomeToCloud, getLocalRegisteredHosts } from '../services/hostSync';
import { getHostRankTier } from '../utils/hostRankTiers';
import { streamAudioController, routeAudioOutput } from '../utils/audioOutput';
import { setVideoScreenSecurity } from '../utils/screenSecurity';

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
  forwardingNotice: string | null;
  startCall: (sakhi: Sakhi, type: CallType) => Promise<void>;
  forwardToNextHost: () => Promise<boolean>;
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
  const { settings } = useAdmin();

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
  const [forwardingNotice, setForwardingNotice] = useState<string | null>(null);

  const callingTimerRef = useRef<number | null>(null);
  const activeCallIntervalRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const costRef = useRef<number>(0);
  const isStartingCallRef = useRef<boolean>(false);
  const triedHostIdsRef = useRef<Set<string>>(new Set());
  const currentSakhiRef = useRef<Sakhi | null>(null);
  const currentCallTypeRef = useRef<CallType>('voice');

  // Helper to find the next available online Host for automatic call bypass / forwarding
  const findNextAvailableOnlineHost = (excludeSakhi?: Sakhi | null): Sakhi | null => {
    try {
      const allHosts = getLocalRegisteredHosts();
      const session = getActiveSession();
      const myPhone = String(session.phone || '').replace(/\D/g, '').slice(-10);

      if (excludeSakhi) {
        triedHostIdsRef.current.add(excludeSakhi.id);
        if (excludeSakhi.phone) {
          triedHostIdsRef.current.add(excludeSakhi.phone.replace(/\D/g, '').slice(-10));
        }
      }

      const candidates = allHosts.filter((h) => {
        if (!h || !h.id) return false;
        const hPhone = String(h.phone || h.id || '').replace(/\D/g, '').slice(-10);
        if (myPhone && hPhone === myPhone) return false;
        if (isUserBlocked(h.id)) return false;
        if (triedHostIdsRef.current.has(h.id)) return false;
        if (hPhone && triedHostIdsRef.current.has(hPhone)) return false;
        return h.status === 'online';
      });

      if (candidates.length > 0) {
        return candidates[0];
      }
      return null;
    } catch {
      return null;
    }
  };

  // Activate Android FLAG_SECURE and web anti-screenshot/recording safeguards ONLY during video calls
  useEffect(() => {
    const isVideoActive = callType === 'video' && (callStatus === 'connected' || callStatus === 'calling');
    setVideoScreenSecurity(isVideoActive);
    return () => {
      if (isVideoActive) {
        setVideoScreenSecurity(false);
      }
    };
  }, [callType, callStatus]);

  // Dynamic Rate lookup from Admin Settings (fallback ₹7 for voice, ₹15 for video)
  const getRate = (type: CallType, sakhiOverride?: Sakhi | null): number => {
    if (type === 'voice') {
      return sakhiOverride?.voiceRatePerMin || settings?.voiceRatePerMin || 7;
    }
    return sakhiOverride?.videoRatePerMin || settings?.videoRatePerMin || 15;
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
   * Dial a specific Host target and arm auto-bypass timer & rejection handler
   */
  const dialTargetSakhi = async (targetSakhi: Sakhi, type: CallType) => {
    if (callingTimerRef.current) {
      clearTimeout(callingTimerRef.current);
      callingTimerRef.current = null;
    }

    currentSakhiRef.current = targetSakhi;
    currentCallTypeRef.current = type;
    triedHostIdsRef.current.add(targetSakhi.id);
    if (targetSakhi.phone) {
      triedHostIdsRef.current.add(targetSakhi.phone.replace(/\D/g, '').slice(-10));
    }

    setActiveSakhi(targetSakhi);
    setCallType(type);
    setCallStatus('calling');

    // Ensure Suno Sakhi Caller Tune is playing
    sounds.startCallerTune(targetSakhi.name);

    const session = getActiveSession();
    const isHost = checkIsHost(session);
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
      setForwardingNotice(null);
      setCallStatus('connected');
      if (callingTimerRef.current) {
        clearTimeout(callingTimerRef.current);
        callingTimerRef.current = null;
      }
    };

    webrtcService.onCallRejected = async () => {
      // Automatic Call Bypass on Rejection / Busy!
      const nextHost = findNextAvailableOnlineHost(currentSakhiRef.current);
      if (nextHost) {
        setForwardingNotice(
          `🔄 ${currentSakhiRef.current?.name || 'Host'} abhi busy hain — Call automatic ${nextHost.name} ko forward ho rahi hai...`
        );
        await webrtcService.endActiveCall();
        await dialTargetSakhi(nextHost, currentCallTypeRef.current);
      } else {
        sounds.stopRingtone();
        sounds.playCallEnded();
        setForwardingNotice(null);
        alert('Sabhi online Hosts abhi busy hain. Kripya kuch der baad dobara call karein.');
        cancelCalling();
      }
    };

    webrtcService.onCallEnded = () => {
      endCall('remote_ended');
    };

    try {
      await webrtcService.startOutboundCall(callerData, targetSakhi, type);
      setLocalStream(webrtcService.getLocalStream());

      // Automatic Call Bypass after 18s if current Host does not pick up!
      callingTimerRef.current = window.setTimeout(async () => {
        const nextHost = findNextAvailableOnlineHost(currentSakhiRef.current);
        if (nextHost) {
          setForwardingNotice(
            `🔄 ${currentSakhiRef.current?.name || 'Host'} ne call pick nahi kiya — Call automatic ${nextHost.name} ko forward ho rahi hai...`
          );
          await webrtcService.endActiveCall();
          await dialTargetSakhi(nextHost, currentCallTypeRef.current);
        } else {
          sounds.stopRingtone();
          setForwardingNotice(null);
          alert(`${targetSakhi.name} abhi call pick nahi kar pa rahi hain aur koi doosra online host uplabdh nahi hai.`);
          cancelCalling();
        }
      }, 18000);
    } catch (err) {
      console.warn('WebRTC Call initialization error:', err);
    }
  };

  /**
   * Manually or automatically bypass current ringing host and forward to next available online host
   */
  const forwardToNextHost = async (): Promise<boolean> => {
    const nextHost = findNextAvailableOnlineHost(currentSakhiRef.current);
    if (!nextHost) {
      setForwardingNotice('⚠️ Is samay koi doosri Online Host uplabdh nahi hai.');
      return false;
    }
    setForwardingNotice(
      `🔄 Call automatic ${nextHost.name} ko forward ki ja rahi hai...`
    );
    await webrtcService.endActiveCall();
    await dialTargetSakhi(nextHost, currentCallTypeRef.current);
    return true;
  };

  /**
   * Start Outbound Call as Caller or Host (Host is 100% Free)
   */
  const startCall = async (sakhi: Sakhi, type: CallType) => {
    // Prevent duplicate simultaneous call requests
    if (callStatus !== 'idle' || isStartingCallRef.current) {
      return;
    }

    if (isUserBlocked(sakhi.id)) {
      alert('🚫 Aapne is user ko block kiya hua hai. Call karne ke liye pehle Settings se Unblock karein.');
      return;
    }

    const session = getActiveSession();
    const requiredMin = getRate(type, sakhi);
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

    isStartingCallRef.current = true;
    triedHostIdsRef.current.clear();
    setForwardingNotice(null);

    // Check if the selected Host is busy or offline -> Automatically bypass to next online Host!
    let initialTargetSakhi = sakhi;
    if (sakhi.status === 'busy' || sakhi.status === 'offline') {
      triedHostIdsRef.current.add(sakhi.id);
      if (sakhi.phone) {
        triedHostIdsRef.current.add(sakhi.phone.replace(/\D/g, '').slice(-10));
      }
      const nextOnline = findNextAvailableOnlineHost(sakhi);
      if (nextOnline) {
        initialTargetSakhi = nextOnline;
        setForwardingNotice(
          `🔄 ${sakhi.name} abhi ${sakhi.status === 'busy' ? 'busy' : 'offline'} hain — Call automatic ${nextOnline.name} ko bypass/forward ki gayi hai!`
        );
      } else if (sakhi.status === 'busy') {
        isStartingCallRef.current = false;
        alert(`📞 ${sakhi.name} abhi dusri call par busy hain aur koi anya online host uplabdh nahi hai.`);
        return;
      }
    }

    setIsCallReceiver(false);
    setDurationSeconds(0);
    setCurrentCost(0);
    durationRef.current = 0;
    costRef.current = 0;
    setIsMuted(false);
    setIsVideoOff(false);
    setLowBalanceWarning(false);
    setEndReason(null);
    setRemoteStream(null);

    try {
      await dialTargetSakhi(initialTargetSakhi, type);
    } finally {
      isStartingCallRef.current = false;
    }
  };

  /**
   * Cancel Outbound Call while ringing
   */
  const cancelCalling = () => {
    isStartingCallRef.current = false;
    setForwardingNotice(null);
    triedHostIdsRef.current.clear();
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

      // Create caller companion representation for host (including callerPhone for safety reporting)
      setActiveSakhi({
        id: incomingCall.callerId,
        name: incomingCall.callerName || 'Caller',
        phone: incomingCall.callerPhone || '',
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
        voiceRatePerMin: getRate('voice'),
        videoRatePerMin: getRate('video'),
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
      const rate = getRate(callType, activeSakhi);
      const perSecRate = rate / 60;

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
    isStartingCallRef.current = false;
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

        // Instantly credit host commission to cloud server based on host rank tier
        const mins = Math.max(1, Math.ceil(finalDuration / 60));
        const tier = getHostRankTier(activeSakhi.rating || 5.0);
        const hostEarned = callType === 'voice'
          ? parseFloat((mins * tier.voiceEarningPerMin).toFixed(2))
          : parseFloat((mins * tier.videoEarningPerMin).toFixed(2));
        const effectiveShare = finalCost > 0 ? Math.round((hostEarned / finalCost) * 100) : 50;

        recordHostIncomeToCloud(
          activeSakhi.id,
          {
            id: `call-inc-${Date.now()}`,
            type: 'call',
            description: `📞 ${callType === 'voice' ? 'Voice' : 'Video'} Call (${mins} min) from ${session.name || 'Caller'} [${tier.badge}]`,
            grossAmount: parseFloat(finalCost.toFixed(2)),
            hostSharePercent: effectiveShare,
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
        // Record host earning when host answered incoming call
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
        ratePerMin: isHostSession && !wasReceiver ? 0 : getRate(callType, activeSakhi),
        totalCost: isHostSession && !wasReceiver ? 0 : parseFloat(finalCost.toFixed(2))
      });
      setIsSummaryOpen(true);
    }

    if (reason === 'insufficient_balance') {
      setEndReason('insufficient_balance');
    }

    setForwardingNotice(null);
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
        forwardingNotice,
        startCall,
        forwardToNextHost,
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
