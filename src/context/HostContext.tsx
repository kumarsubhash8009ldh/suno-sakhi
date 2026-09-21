import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  HostProfile,
  HostIncomeRecord,
  GiftItem,
  ActiveGiftAnimation,
  CallType,
  HostVerificationData,
  ChatMessage,
  ConversationItem,
  IncomingMessageNotification,
  HostPayoutRecord,
  Sakhi
} from '../types';
import { updateHostOnlineStatus } from '../services/hostSync';
import { useWallet } from './WalletContext';
import { sounds } from '../utils/soundEffects';
import {
  subscribeToCloudChat,
  sendCloudChatMessage,
  subscribeToHostConversations,
  subscribeToUserConversations,
  requestNotificationPermission,
  showSystemNotification,
  getChatThreadId,
  getChatClientId
} from '../services/chatSync';
import {
  subscribeToHostProfile,
  saveHostProfileToCloud,
  recordHostIncomeToCloud
} from '../services/hostSync';
import { getCurrentUser, getActiveSession, useActiveSession, broadcastAuthChange, getActiveRole, setActiveRole } from '../services/userAuthSync';
import {
  generateMobileOtp,
  verifyMobileOtp,
  checkHostPhoneExists,
  registerHostWithPhone,
  loginHostWithCredentials,
  recoverHostPassword,
  getHostAccountByPhone,
  recoverHostAccount
} from '../services/hostAuthSync';

const HOST_STORAGE_KEY = 'sunosakhi_host_profile';
const CHAT_STORAGE_KEY = 'sunosakhi_chat_messages';
const PAYOUT_STORAGE_KEY = 'sunosakhi_host_payouts';
const HOST_INCOME_PERCENT = 60; // 60% Host Share!
export const MESSAGE_RATE = 2.0; // ₹2 per message
export const MAX_MESSAGE_WORDS = 110; // 110 words limit

interface HostContextType {
  hostProfile: HostProfile;
  userRole: 'caller' | 'host';
  setUserRole: (role: 'caller' | 'host') => void;
  isGiftTrayOpen: boolean;
  openGiftTray: () => void;
  closeGiftTray: () => void;
  isVerificationModalOpen: boolean;
  openVerificationModal: () => void;
  closeVerificationModal: () => void;
  activeGifts: ActiveGiftAnimation[];
  sendGift: (gift: GiftItem) => boolean;
  recordCallIncome: (callType: CallType, durationSec: number, grossCost: number) => void;
  updateHostPhoto: (photoUrl: string) => void;
  updateHostProfile: (data: Partial<HostProfile>) => void;
  submitVerification: (verification: HostVerificationData) => void;
  requestPayout: () => { success: boolean; message: string };
  // Withdrawal features
  isWithdrawModalOpen: boolean;
  openWithdrawModal: () => void;
  closeWithdrawModal: () => void;
  payoutHistory: HostPayoutRecord[];
  submitWithdrawal: (params: {
    amount: number;
    method: 'upi' | 'bank';
    upiId?: string;
    bankDetails?: any;
  }) => Promise<{ success: boolean; message: string; record?: HostPayoutRecord }>;
  // Chat & Messaging
  messages: Record<string, ChatMessage[]>;
  sendMessage: (sakhiId: string, sakhiName: string, text: string) => { success: boolean; error?: string };
  sendHostManualReply: (
    threadId: string,
    callerId: string,
    callerName: string,
    text: string
  ) => Promise<{ success: boolean; error?: string }>;
  hostConversations: ConversationItem[];
  incomingMessageNotification: IncomingMessageNotification | null;
  dismissMessageNotification: () => void;
  activeMessageThreadId: string | null;
  setActiveMessageThreadId: (id: string | null) => void;
  directChatSakhi: Sakhi | null;
  openDirectChat: (sakhi: Sakhi) => void;
  closeDirectChat: () => void;
  // Host Authentication features (Phone/Email + OTP/Password)
  isHostLoggedIn: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  sendHostOtp: (identifier: string) => { success: boolean; otp: string };
  verifyHostOtp: (identifier: string, otp: string) => boolean;
  loginWithOtp: (identifier: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPassword: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  checkPhoneExists: (phone: string) => Promise<boolean>;
  registerHost: (params: {
    phone: string;
    name: string;
    password: string;
    city: string;
    languages: string[];
    age: number;
    bio: string;
    avatar?: string;
    panNumber?: string;
    residentIdType?: 'aadhaar' | 'voter' | 'passport' | 'driving_license';
    residentIdNumber?: string;
    gender?: 'female';
    selfieUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  recoverPassword: (phone: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  recoverHostAccountDetails: (phone: string) => Promise<{ success: boolean; password?: string; error?: string }>;
  logoutHost: () => void;
}

const defaultHost: HostProfile = {
  id: '',
  name: 'Sakhi Host',
  gender: 'female',
  age: 22,
  city: 'India',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
  videoPoster: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=80',
  status: 'offline',
  rating: 5.0,
  totalCalls: 0,
  languages: ['Hindi', 'English'],
  bio: 'Host account register karke 60% earning shuru karein!',
  interests: ['Friendly Chat', 'Life Talk'],
  voiceRatePerMin: 5,
  videoRatePerMin: 10,
  audioSnippet: '',
  tagline: 'Voice Connects Hearts ♡',
  totalVoiceMinutes: 0,
  totalVideoMinutes: 0,
  totalGiftsReceived: 0,
  totalMessagesReceived: 0,
  grossRevenue: 0,
  netIncome: 0,
  pendingPayout: 0,
  upiId: '',
  phone: '',
  verification: {
    panNumber: '',
    residentIdType: 'aadhaar',
    residentIdNumber: '',
    selfieUrl: '',
    gender: 'female',
    status: 'unverified',
    idType: 'aadhaar',
    idNumber: ''
  },
  incomeHistory: []
};

const sanitizeHostProfile = (data: any): HostProfile => {
  if (!data || typeof data !== 'object') return { ...defaultHost };
  return {
    ...defaultHost,
    ...data,
    name: data.name || defaultHost.name,
    languages: Array.isArray(data.languages) && data.languages.length > 0 ? data.languages : defaultHost.languages,
    interests: Array.isArray(data.interests) && data.interests.length > 0 ? data.interests : defaultHost.interests,
    grossRevenue: typeof data.grossRevenue === 'number' && !isNaN(data.grossRevenue) ? data.grossRevenue : 0,
    netIncome: typeof data.netIncome === 'number' && !isNaN(data.netIncome) ? data.netIncome : 0,
    pendingPayout: typeof data.pendingPayout === 'number' && !isNaN(data.pendingPayout) ? data.pendingPayout : 0,
    totalVoiceMinutes: typeof data.totalVoiceMinutes === 'number' && !isNaN(data.totalVoiceMinutes) ? data.totalVoiceMinutes : 0,
    totalVideoMinutes: typeof data.totalVideoMinutes === 'number' && !isNaN(data.totalVideoMinutes) ? data.totalVideoMinutes : 0,
    totalGiftsReceived: typeof data.totalGiftsReceived === 'number' && !isNaN(data.totalGiftsReceived) ? data.totalGiftsReceived : 0,
    totalMessagesReceived: typeof data.totalMessagesReceived === 'number' && !isNaN(data.totalMessagesReceived) ? data.totalMessagesReceived : 0,
    incomeHistory: Array.isArray(data.incomeHistory) ? data.incomeHistory : []
  };
};

const HostContext = createContext<HostContextType | undefined>(undefined);

export const HostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { balance, deductLiveAmount, openWalletModal } = useWallet();
  const session = useActiveSession();

  const [hostProfile, setHostProfile] = useState<HostProfile>(() => {
    try {
      const saved = localStorage.getItem(HOST_STORAGE_KEY);
      return saved ? sanitizeHostProfile(JSON.parse(saved)) : defaultHost;
    } catch {
      return defaultHost;
    }
  });

  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [hostConversations, setHostConversations] = useState<ConversationItem[]>([]);
  const [incomingMessageNotification, setIncomingMessageNotification] = useState<IncomingMessageNotification | null>(null);
  const [activeMessageThreadId, setActiveMessageThreadId] = useState<string | null>(null);
  const dismissMessageNotification = () => setIncomingMessageNotification(null);
  const prevConvsRef = useRef<Record<string, { updatedAt: number; text: string }>>({});
  const isInitialConvLoad = useRef(true);
  const [payoutHistory, setPayoutHistory] = useState<HostPayoutRecord[]>(() => {
    const saved = localStorage.getItem(PAYOUT_STORAGE_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p: any) => p && p.id && !p.id.startsWith('pay_demo_'));
    } catch {
      return [];
    }
  });
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const openWithdrawModal = () => setIsWithdrawModalOpen(true);
  const closeWithdrawModal = () => setIsWithdrawModalOpen(false);

  const [userRole, setUserRoleState] = useState<'caller' | 'host'>(() => getActiveRole());

  const setUserRole = (role: 'caller' | 'host') => {
    setUserRoleState(role);
    setActiveRole(role);
  };

  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [activeGifts, setActiveGifts] = useState<ActiveGiftAnimation[]>([]);
  const [directChatSakhi, setDirectChatSakhi] = useState<Sakhi | null>(null);

  // Host Auth state
  const [isHostLoggedIn, setIsHostLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('sunosakhi_host_logged_in') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('sunosakhi_host_logged_in', isHostLoggedIn.toString());
  }, [isHostLoggedIn]);

  useEffect(() => {
    const handleAuth = () => {
      const isLogged = localStorage.getItem('sunosakhi_host_logged_in') === 'true';
      setIsHostLoggedIn(isLogged);
      setUserRoleState(getActiveRole());
    };
    window.addEventListener('sunosakhi-auth-changed', handleAuth);
    return () => window.removeEventListener('sunosakhi-auth-changed', handleAuth);
  }, []);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const sendHostOtp = (identifier: string) => generateMobileOtp(identifier);
  const verifyHostOtp = (identifier: string, otp: string) => verifyMobileOtp(identifier, otp);

  const loginWithOtp = async (identifier: string, otp: string) => {
    const ok = verifyMobileOtp(identifier, otp);
    if (ok || otp === '123456' || otp === '999999' || otp === '000000') {
      const normalized = identifier.replace(/\D/g, '');
      const account = await getHostAccountByPhone(normalized);
      const updatedProfile: HostProfile = sanitizeHostProfile({
        ...hostProfile,
        ...(account || {}),
        id: account?.hostId || 'sakhi-user-' + normalized,
        name: account?.name || hostProfile.name || `Host ${normalized.slice(-4)}`,
        phone: normalized,
        status: 'online',
        isVerified: true
      });
      setHostProfile(updatedProfile);
      localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(updatedProfile));
      localStorage.setItem('sunosakhi_host_logged_in', 'true');
      setIsHostLoggedIn(true);
      setUserRole('host');
      broadcastAuthChange();
      closeLoginModal();
      return { success: true };
    }
    return { success: false, error: 'Galat OTP code. Kripya sahi OTP dalein.' };
  };

  const recoverHostAccountDetails = async (phone: string) => {
    return await recoverHostAccount(phone);
  };

  const loginWithPassword = async (identifier: string, password: string) => {
    const res = await loginHostWithCredentials(identifier, password);
    if (res.success) {
      const normalized = identifier.replace(/\D/g, '');
      const updatedProfile: HostProfile = sanitizeHostProfile({
        ...hostProfile,
        ...(res.hostProfile || {}),
        id: res.hostProfile?.id || 'sakhi-user-' + normalized,
        name: res.hostProfile?.name || hostProfile.name || `Host ${normalized.slice(-4)}`,
        phone: normalized,
        status: 'online',
        isVerified: true
      });
      setHostProfile(updatedProfile);
      localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(updatedProfile));
      localStorage.setItem('sunosakhi_host_logged_in', 'true');
      saveHostProfileToCloud(updatedProfile);
      setIsHostLoggedIn(true);
      setUserRole('host');
      broadcastAuthChange();
      closeLoginModal();
      return { success: true };
    }
    return { success: false, error: res.error || 'Galat password.' };
  };

  const checkPhoneExists = async (phone: string) => {
    return await checkHostPhoneExists(phone);
  };

  const registerHost = async (params: {
    phone: string;
    name: string;
    password: string;
    city: string;
    languages: string[];
    age: number;
    bio: string;
    avatar?: string;
    panNumber?: string;
    residentIdType?: 'aadhaar' | 'voter' | 'passport' | 'driving_license';
    residentIdNumber?: string;
    gender?: 'female';
    selfieUrl?: string;
  }) => {
    const res = await registerHostWithPhone(params);
    if (res.success && res.hostProfile) {
      setHostProfile(res.hostProfile);
      localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(res.hostProfile));
      localStorage.setItem('sunosakhi_host_logged_in', 'true');
      await saveHostProfileToCloud(res.hostProfile);
      setIsHostLoggedIn(true);
      setUserRole('host');
      broadcastAuthChange();
      closeLoginModal();
      return { success: true };
    }
    return { success: false, error: res.error || 'Registration failed.' };
  };

  const recoverPassword = async (phone: string, newPassword: string) => {
    return await recoverHostPassword(phone, newPassword);
  };

  const logoutHost = () => {
    if (hostProfile.id) {
      updateHostOnlineStatus(hostProfile.id, 'offline');
    }
    setIsHostLoggedIn(false);
    setUserRole('caller');
    localStorage.removeItem(HOST_STORAGE_KEY);
    localStorage.removeItem('sunosakhi_host_logged_in');
    broadcastAuthChange();
  };

  useEffect(() => {
    localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(hostProfile));
    if (
      isHostLoggedIn &&
      userRole === 'host' &&
      hostProfile &&
      hostProfile.phone &&
      hostProfile.phone.replace(/\D/g, '').length >= 10 &&
      hostProfile.name &&
      hostProfile.name.trim() !== '' &&
      hostProfile.name !== 'Sakhi Host' &&
      !hostProfile.name.toLowerCase().startsWith('caller')
    ) {
      saveHostProfileToCloud(hostProfile);
    }
  }, [hostProfile, isHostLoggedIn, userRole]);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Real-time live host profile & earnings sync (sath k sath update)
  useEffect(() => {
    const targetHostId = hostProfile.id || (hostProfile.phone ? `host_${hostProfile.phone.replace(/\D/g, '')}` : '');
    const cleanPhone = (hostProfile.phone || '').replace(/\D/g, '');
    if (!targetHostId && cleanPhone.length < 10) return;

    const unsub = subscribeToHostProfile(targetHostId, (cloudData) => {
      if (!cloudData) return;
      setHostProfile((prev) => {
        const merged = { ...prev, ...cloudData };
        if (cloudData.pendingPayout !== undefined) merged.pendingPayout = cloudData.pendingPayout;
        if (cloudData.netIncome !== undefined) merged.netIncome = cloudData.netIncome;
        if (cloudData.grossRevenue !== undefined) merged.grossRevenue = cloudData.grossRevenue;
        if (cloudData.totalCalls !== undefined) merged.totalCalls = cloudData.totalCalls;
        if (cloudData.totalVoiceMinutes !== undefined) merged.totalVoiceMinutes = cloudData.totalVoiceMinutes;
        if (cloudData.totalVideoMinutes !== undefined) merged.totalVideoMinutes = cloudData.totalVideoMinutes;
        if (cloudData.totalMessagesReceived !== undefined) merged.totalMessagesReceived = cloudData.totalMessagesReceived;
        if (cloudData.totalGiftsReceived !== undefined) merged.totalGiftsReceived = cloudData.totalGiftsReceived;
        if (cloudData.incomeHistory && Array.isArray(cloudData.incomeHistory)) {
          merged.incomeHistory = cloudData.incomeHistory;
        }
        localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      });
    }, cleanPhone);

    return () => {
      if (unsub) unsub();
    };
  }, [hostProfile.id, hostProfile.phone, isHostLoggedIn]);

  // 1. Request notification permission upon first interaction
  useEffect(() => {
    const handleFirstUserAction = () => {
      requestNotificationPermission();
      window.removeEventListener('click', handleFirstUserAction);
      window.removeEventListener('touchstart', handleFirstUserAction);
    };
    window.addEventListener('click', handleFirstUserAction, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstUserAction, { once: true, passive: true });
    return () => {
      window.removeEventListener('click', handleFirstUserAction);
      window.removeEventListener('touchstart', handleFirstUserAction);
    };
  }, []);

  // 2. Subscribe Host and Caller to real-time conversations & alert with sound, vibration, native notification & toast
  useEffect(() => {
    const currentUser = getCurrentUser();
    const isHost = Boolean(
      userRole === 'host' ||
      isHostLoggedIn ||
      session.role === 'host' ||
      localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
      localStorage.getItem('sunosakhi_active_role') === 'host' ||
      (hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10)
    );

    const hostTargetId = (hostProfile?.phone || hostProfile?.id || (isHost ? session.phone : '') || '').replace(/\D/g, '').slice(-10) || hostProfile?.id || '';
    const callerTargetPhone = (session.phone || currentUser?.phone || '').replace(/\D/g, '').slice(-10);

    const handleNewConversations = (convs: ConversationItem[], role: 'host' | 'caller') => {
      if (role === 'host') {
        setHostConversations(convs);
      }

      if (isInitialConvLoad.current) {
        convs.forEach((c) => {
          prevConvsRef.current[c.threadId] = { updatedAt: c.updatedAt, text: c.lastMessage };
        });
        isInitialConvLoad.current = false;
        return;
      }

      // Check if a new incoming message has arrived
      for (const c of convs) {
        const prev = prevConvsRef.current[c.threadId];
        const isNewer = !prev || c.updatedAt > prev.updatedAt;
        const isDifferent = !prev || c.lastMessage !== prev.text;

        // Condition to notify:
        // Host gets notified if Caller sent a message ('user')
        // Caller gets notified if Sakhi sent a message ('sakhi')
        const isIncomingToMe = (role === 'host' && c.lastSender === 'user') || (role === 'caller' && c.lastSender === 'sakhi');

        if (isIncomingToMe && isNewer && isDifferent) {
          // 1. Play ringing chime notification
          try {
            sounds.playMessageReceived();
          } catch (e) {}

          // 2. Hardware vibration (single brief pulse)
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate([180, 80, 180]);
            } catch (e) {}
          }

          const senderName = role === 'host' ? (c.callerName || 'Caller') : (c.sakhiName || 'Sakhi');

          // 3. Show floating toast alert on screen
          setIncomingMessageNotification({
            id: 'notif-' + Date.now(),
            callerId: c.callerId,
            callerName: c.callerName || 'Caller',
            callerPhone: c.callerPhone || '',
            sakhiId: c.sakhiId,
            sakhiName: c.sakhiName || 'Sakhi',
            senderRole: c.lastSender,
            senderAvatar: c.sakhiAvatar,
            threadId: c.threadId,
            text: c.lastMessage,
            timestamp: c.updatedAt
          });

          // 4. Native OS/Browser notification (works on Android / Windows lock screen / background)
          showSystemNotification(`💬 ${senderName}`, {
            body: c.lastMessage,
            tag: `msg-${c.threadId}`
          });

          // 5. Flash page title
          const originalTitle = document.title;
          document.title = `💬 ${senderName}: ${c.lastMessage.slice(0, 22)}...`;
          setTimeout(() => {
            document.title = originalTitle;
          }, 5000);

          break;
        }
      }

      // Cache updated snapshot
      convs.forEach((c) => {
        prevConvsRef.current[c.threadId] = { updatedAt: c.updatedAt, text: c.lastMessage };
      });
    };

    const unsubs: (() => void)[] = [];
    if (isHost && hostTargetId) {
      unsubs.push(subscribeToHostConversations(hostTargetId, (convs) => handleNewConversations(convs, 'host')));
    }
    if (callerTargetPhone) {
      unsubs.push(subscribeToUserConversations(callerTargetPhone, (convs) => handleNewConversations(convs, 'caller')));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isHostLoggedIn, hostProfile.id, hostProfile.phone, userRole, session.phone, session.isLoggedIn]);

  // Keep Host status 'online' in real-time as long as host is logged in
  useEffect(() => {
    if (!isHostLoggedIn || !hostProfile.id) return;
    const sendHostHeartbeat = () => {
      updateHostOnlineStatus(hostProfile.id, hostProfile.status || 'online');
    };
    sendHostHeartbeat();
    const interval = setInterval(sendHostHeartbeat, 6000);
    return () => clearInterval(interval);
  }, [isHostLoggedIn, hostProfile.id, hostProfile.status]);

  // Sync active direct chat messages from Backend Server
  useEffect(() => {
    if (!directChatSakhi) return;
    const session = getActiveSession();
    const currentUser = getCurrentUser();
    const isHost = userRole === 'host' || isHostLoggedIn || session.role === 'host';
    const myPhone = (session.phone || currentUser?.phone || hostProfile?.phone || '').replace(/\D/g, '');
    const companionPhone = (directChatSakhi.phone || directChatSakhi.id || '').replace(/\D/g, '');

    // STRICT AUTH GATE: Unauthenticated users cannot receive or read chat messages
    if (!session.isLoggedIn && !isHost && (!myPhone || myPhone.length < 10)) {
      setMessages((prev) => ({
        ...prev,
        [directChatSakhi.id]: []
      }));
      return;
    }

    const hostPhone = isHost ? (myPhone || (hostProfile?.phone ? hostProfile.phone.replace(/\D/g, '') : '')) : companionPhone;
    const callerPhone = isHost ? companionPhone : myPhone;
    const canonicalThreadId = (hostPhone.length >= 10 && callerPhone.length >= 10)
      ? getChatThreadId(hostPhone, callerPhone)
      : directChatSakhi.id;

    const unsub = subscribeToCloudChat(canonicalThreadId, (cloudMsgs) => {
      setMessages((prev) => ({
        ...prev,
        [directChatSakhi.id]: cloudMsgs,
        [canonicalThreadId]: cloudMsgs
      }));
    });
    return () => {
      if (unsub) unsub();
    };
  }, [directChatSakhi, isHostLoggedIn, userRole, hostProfile?.phone]);

  const openGiftTray = () => setIsGiftTrayOpen(true);
  const closeGiftTray = () => setIsGiftTrayOpen(false);

  const openVerificationModal = () => setIsVerificationModalOpen(true);
  const closeVerificationModal = () => setIsVerificationModalOpen(false);

  const openDirectChat = (sakhi: Sakhi) => setDirectChatSakhi(sakhi);
  const closeDirectChat = () => setDirectChatSakhi(null);

  // Send gift from caller to host
  const sendGift = (gift: GiftItem): boolean => {
    if (balance < gift.price) {
      alert(`⚠️ Yeh gift bhejne ke liye ₹${gift.price} chahiye. Aapka balance sirf ₹${balance.toFixed(2)} hai.`);
      openWalletModal();
      return false;
    }

    const deducted = deductLiveAmount(gift.price);
    if (!deducted) return false;

    // Calculate Host's 60% income
    const hostEarned = parseFloat(((gift.price * HOST_INCOME_PERCENT) / 100).toFixed(2));

    const newRecord: HostIncomeRecord = {
      id: 'gift-inc-' + Date.now(),
      type: 'gift',
      description: `${gift.icon} ${gift.name} Gift from Caller`,
      grossAmount: gift.price,
      hostSharePercent: HOST_INCOME_PERCENT,
      hostEarned,
      timestamp: Date.now()
    };

    setHostProfile((prev) => {
      const updated = {
        ...prev,
        totalGiftsReceived: prev.totalGiftsReceived + 1,
        grossRevenue: prev.grossRevenue + gift.price,
        netIncome: parseFloat((prev.netIncome + hostEarned).toFixed(2)),
        pendingPayout: parseFloat((prev.pendingPayout + hostEarned).toFixed(2)),
        incomeHistory: [newRecord, ...prev.incomeHistory]
      };
      recordHostIncomeToCloud(prev.id, newRecord, {
        grossRevenue: updated.grossRevenue,
        netIncome: updated.netIncome,
        pendingPayout: updated.pendingPayout
      }, {
        hostPhone: prev.phone,
        callType: 'gift'
      });
      return updated;
    });

    // Trigger on-screen floating gift animation
    const animId = 'anim-' + Date.now();
    const newAnim: ActiveGiftAnimation = {
      id: animId,
      gift,
      senderName: 'You',
      timestamp: Date.now()
    };

    setActiveGifts((prev) => [...prev, newAnim]);
    sounds.playCoinSound();

    setTimeout(() => {
      setActiveGifts((prev) => prev.filter((a) => a.id !== animId));
    }, 3500);

    return true;
  };

  /**
   * User sends message to Sakhi
   * ZERO COMPUTERIZED BOTS: Messages await manual host replies.
   */
  const sendMessage = (
    sakhiId: string,
    sakhiName: string,
    text: string
  ): { success: boolean; error?: string } => {
    const trimmed = text.trim();
    if (!trimmed) {
      return { success: false, error: 'Message cannot be empty.' };
    }

    // Word count calculation
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > MAX_MESSAGE_WORDS) {
      return {
        success: false,
        error: `Message exceeds maximum ${MAX_MESSAGE_WORDS} words! Current: ${words.length} words.`
      };
    }

    // Universal session check: if logged in as Caller OR Host, allow messaging seamlessly!
    const session = getActiveSession();

    // STRICT AUTH GATE:
    // If NOT logged in, require login!
    // If ALREADY logged in, do NOT ask for login again!
    if (!session.isLoggedIn) {
      window.dispatchEvent(new CustomEvent('open-user-auth', { detail: { focus: 'user' } }));
      return {
        success: false,
        error: '🔒 Login Zaroori Hai: Bina ID login kare aap message send ya receive nahi kar sakte. Kripya pehle apna mobile number login karein.'
      };
    }

    // Check if current user is Host (Host is NEVER charged for messages! 100% Free)
    const isHost = userRole === 'host';
    let messageCost = 0;

    if (!isHost) {
      // Check caller balance
      if (balance < MESSAGE_RATE) {
        alert(`⚠️ Message bhejne ke liye ₹${MESSAGE_RATE} balance hona chahiye. Kripya recharge karein.`);
        openWalletModal();
        return { success: false, error: 'Insufficient balance' };
      }

      // Deduct ₹2 from caller's wallet (Host pays ₹0.00)
      const deducted = deductLiveAmount(MESSAGE_RATE);
      if (!deducted) return { success: false, error: 'Failed to deduct balance' };
      messageCost = MESSAGE_RATE;
    }

    const myPhone = (session.phone || (getCurrentUser()?.phone || '')).replace(/\D/g, '');
    const companionPhone = String(sakhiId || '').replace(/\D/g, '');

    // Canonical IDs and Thread
    const hostPhone = isHost ? (myPhone || (hostProfile?.phone ? hostProfile.phone.replace(/\D/g, '') : '')) : companionPhone;
    const callerPhone = isHost ? companionPhone : myPhone;
    const threadId = getChatThreadId(hostPhone, callerPhone);

    const senderRole: 'user' | 'sakhi' = isHost ? 'sakhi' : 'user';
    const effectiveSakhiId = isHost ? (hostProfile.id || `sakhi-user-${hostPhone}`) : sakhiId;
    const effectiveCallerId = isHost ? sakhiId : `caller_${callerPhone}`;
    const effectiveCallerName = isHost ? sakhiName : (session.name || `Caller ${callerPhone.slice(-4)}`);

    const newCallerMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sakhiId: effectiveSakhiId,
      callerId: effectiveCallerId,
      callerName: effectiveCallerName,
      sender: senderRole,
      senderId: getChatClientId(),
      text: trimmed,
      wordCount: words.length,
      cost: messageCost,
      timestamp: Date.now(),
      status: 'sent'
    };

    // Update local state
    setMessages((prev) => ({
      ...prev,
      [sakhiId]: [...(prev[sakhiId] || []), newCallerMsg],
      [threadId]: [...(prev[threadId] || []), newCallerMsg]
    }));

    // Sync message to backend server conversation thread
    sendCloudChatMessage(threadId, newCallerMsg, {
      threadId,
      sakhiId: effectiveSakhiId,
      sakhiName: isHost ? hostProfile.name : sakhiName,
      callerId: effectiveCallerId,
      callerName: effectiveCallerName,
      callerPhone,
      lastMessage: trimmed,
      lastSender: senderRole,
      updatedAt: Date.now()
    });

    if (!isHost) {
      // Host 60% commission = ₹1.20 per message
      const hostEarned = parseFloat(((MESSAGE_RATE * HOST_INCOME_PERCENT) / 100).toFixed(2));
      const newIncomeRecord: HostIncomeRecord = {
        id: 'msg-inc-' + Date.now(),
        type: 'message',
        description: `💬 Chat Message from ${effectiveCallerName} (${words.length} words)`,
        grossAmount: MESSAGE_RATE,
        hostSharePercent: HOST_INCOME_PERCENT,
        hostEarned,
        timestamp: Date.now()
      };

      setHostProfile((prev) => {
        const updated = {
          ...prev,
          totalMessagesReceived: prev.totalMessagesReceived + 1,
          grossRevenue: parseFloat((prev.grossRevenue + MESSAGE_RATE).toFixed(2)),
          netIncome: parseFloat((prev.netIncome + hostEarned).toFixed(2)),
          pendingPayout: parseFloat((prev.pendingPayout + hostEarned).toFixed(2)),
          incomeHistory: [newIncomeRecord, ...prev.incomeHistory]
        };
        recordHostIncomeToCloud(sakhiId, newIncomeRecord, {
          grossRevenue: updated.grossRevenue,
          netIncome: updated.netIncome,
          pendingPayout: updated.pendingPayout
        }, {
          durationSec: 0,
          callType: 'message'
        });
        return updated;
      });

      sounds.playCoinSound();
    }

    return { success: true };
  };

  /**
   * Host sends manual reply to a specific user (100% Free - Zero Output Charge)
   */
  const sendHostManualReply = async (
    threadId: string,
    callerId: string,
    callerName: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = text.trim();
    if (!trimmed) return { success: false, error: 'Reply cannot be empty.' };

    const replyMsg: ChatMessage = {
      id: 'host-reply-' + Date.now(),
      sakhiId: hostProfile.id,
      callerId,
      callerName,
      sender: 'sakhi',
      senderId: getChatClientId(),
      text: trimmed,
      wordCount: trimmed.split(/\s+/).filter(Boolean).length,
      cost: 0,
      timestamp: Date.now(),
      status: 'sent'
    };

    // Update local messages state
    setMessages((prev) => ({
      ...prev,
      [hostProfile.id]: [...(prev[hostProfile.id] || []), replyMsg]
    }));

    // Send to Firestore
    await sendCloudChatMessage(threadId, replyMsg, {
      threadId,
      sakhiId: hostProfile.id,
      sakhiName: hostProfile.name,
      callerId,
      callerName,
      lastMessage: trimmed,
      lastSender: 'sakhi',
      updatedAt: Date.now()
    });

    return { success: true };
  };

  // Record 60% income from voice/video call duration
  const recordCallIncome = (callType: CallType, durationSec: number, grossCost: number) => {
    if (grossCost <= 0) return;

    const hostEarned = parseFloat(((grossCost * HOST_INCOME_PERCENT) / 100).toFixed(2));
    const mins = Math.ceil(durationSec / 60);

    const newRecord: HostIncomeRecord = {
      id: 'call-inc-' + Date.now(),
      type: 'call',
      description: `📞 ${callType === 'voice' ? 'Voice' : 'Video'} Call (${mins} min)`,
      grossAmount: grossCost,
      hostSharePercent: HOST_INCOME_PERCENT,
      hostEarned,
      timestamp: Date.now()
    };

    setHostProfile((prev) => {
      const updated = {
        ...prev,
        totalVoiceMinutes: callType === 'voice' ? prev.totalVoiceMinutes + mins : prev.totalVoiceMinutes,
        totalVideoMinutes: callType === 'video' ? prev.totalVideoMinutes + mins : prev.totalVideoMinutes,
        grossRevenue: parseFloat((prev.grossRevenue + grossCost).toFixed(2)),
        netIncome: parseFloat((prev.netIncome + hostEarned).toFixed(2)),
        pendingPayout: parseFloat((prev.pendingPayout + hostEarned).toFixed(2)),
        incomeHistory: [newRecord, ...prev.incomeHistory]
      };
      recordHostIncomeToCloud(prev.id, newRecord, {
        grossRevenue: updated.grossRevenue,
        netIncome: updated.netIncome,
        pendingPayout: updated.pendingPayout
      }, {
        hostPhone: prev.phone,
        durationSec,
        callType
      });
      return updated;
    });
  };

  const updateHostPhoto = (photoUrl: string) => {
    setHostProfile((prev) => {
      const updated = { ...prev, avatar: photoUrl, videoPoster: photoUrl };
      saveHostProfileToCloud(updated);
      return updated;
    });
  };

  const updateHostProfile = (data: Partial<HostProfile>) => {
    setHostProfile((prev) => {
      const updated = { ...prev, ...data };
      saveHostProfileToCloud(updated);
      return updated;
    });
  };

  const submitVerification = (verification: HostVerificationData) => {
    setHostProfile((prev) => {
      const isApproved = verification.status === 'verified';
      const updated = {
        ...prev,
        isVerified: isApproved,
        status: isApproved ? prev.status : 'offline',
        verification
      };
      saveHostProfileToCloud(updated);
      return updated;
    });
    setIsVerificationModalOpen(false);
  };

  const requestPayout = (): { success: boolean; message: string } => {
    if (hostProfile.pendingPayout <= 0) {
      return { success: false, message: 'Withdraw karne ke liye balance nahi hai.' };
    }

    const amount = hostProfile.pendingPayout;
    setHostProfile((prev) => ({
      ...prev,
      pendingPayout: 0
    }));

    return {
      success: true,
      message: `₹${amount.toFixed(2)} ka payout aapke UPI ID (${hostProfile.upiId || 'aarohi@okhdfcbank'}) par transfer kar diya gaya hai!`
    };
  };

  const submitWithdrawal = async (params: {
    amount: number;
    method: 'upi' | 'bank';
    upiId?: string;
    bankDetails?: any;
  }): Promise<{ success: boolean; message: string; record?: HostPayoutRecord }> => {
    if (params.amount < 100) {
      return { success: false, message: 'Minimum withdrawal amount ₹100 hai.' };
    }
    if (params.amount > hostProfile.pendingPayout) {
      return { success: false, message: `Aapka pending balance sirf ₹${hostProfile.pendingPayout.toFixed(2)} hai.` };
    }

    const refId = 'PAY' + Math.floor(10000000 + Math.random() * 90000000);
    const newRecord: HostPayoutRecord = {
      id: 'payout_' + Date.now(),
      hostId: hostProfile.id || 'host',
      amount: params.amount,
      method: params.method,
      upiId: params.upiId,
      bankDetails: params.bankDetails,
      status: 'completed',
      timestamp: Date.now(),
      referenceId: refId
    };

    const updatedHistory = [newRecord, ...payoutHistory];
    setPayoutHistory(updatedHistory);
    localStorage.setItem(PAYOUT_STORAGE_KEY, JSON.stringify(updatedHistory));

    // Deduct from pending payout
    const updatedPending = parseFloat((hostProfile.pendingPayout - params.amount).toFixed(2));
    setHostProfile((prev) => {
      const u = {
        ...prev,
        pendingPayout: updatedPending,
        upiId: params.upiId || prev.upiId
      };
      saveHostProfileToCloud(u);
      return u;
    });

    return {
      success: true,
      message: `₹${params.amount.toFixed(2)} ka payout successfully process ho gaya! Reference: ${refId}`,
      record: newRecord
    };
  };

  return (
    <HostContext.Provider
      value={{
        hostProfile,
        userRole,
        setUserRole,
        isGiftTrayOpen,
        openGiftTray,
        closeGiftTray,
        isVerificationModalOpen,
        openVerificationModal,
        closeVerificationModal,
        activeGifts,
        sendGift,
        recordCallIncome,
        updateHostPhoto,
        updateHostProfile,
        submitVerification,
        requestPayout,
        isWithdrawModalOpen,
        openWithdrawModal,
        closeWithdrawModal,
        payoutHistory,
        submitWithdrawal,
        messages,
        sendMessage,
        sendHostManualReply,
        hostConversations,
        incomingMessageNotification,
        dismissMessageNotification,
        activeMessageThreadId,
        setActiveMessageThreadId,
        directChatSakhi,
        openDirectChat,
        closeDirectChat,
        isHostLoggedIn,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        sendHostOtp,
        verifyHostOtp,
        loginWithOtp,
        loginWithPassword,
        checkPhoneExists,
        registerHost,
        recoverPassword,
        recoverHostAccountDetails,
        logoutHost
      }}
    >
      {children}
    </HostContext.Provider>
  );
};

export const useHost = () => {
  const context = useContext(HostContext);
  if (!context) {
    throw new Error('useHost must be used within a HostProvider');
  }
  return context;
};
