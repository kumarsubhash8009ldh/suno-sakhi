import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { SakhiCard } from './components/SakhiCard';
import { CallingScreen } from './components/CallingScreen';
import { VoiceCallModal } from './components/VoiceCallModal';
import { VideoCallModal } from './components/VideoCallModal';
import { IncomingCallModal } from './components/IncomingCallModal';
import { WalletModal } from './components/WalletModal';
import { CallSummaryModal } from './components/CallSummaryModal';
import { GiftTrayModal } from './components/GiftTrayModal';
import { HostVerificationModal } from './components/HostVerificationModal';
import { DirectChatModal } from './components/DirectChatModal';
import { HostDashboard } from './components/HostDashboard';
import { AuthModal } from './components/AuthModal';
import { HostLoginModal } from './components/HostLoginModal';
import { ReferralModal } from './components/ReferralModal';
import { HelpDeskModal } from './components/HelpDeskModal';
import { AdminPortalPage } from './components/AdminPortalPage';
import { BottomNav } from './components/BottomNav';
import { RecentCallsView } from './components/RecentCallsView';
import { RateCardAndCommissionView } from './components/RateCardAndCommissionView';
import { HelplineView } from './components/HelplineView';
import { SettingsView } from './components/SettingsView';
import { HostMessageToast } from './components/HostMessageToast';
import { CallerCard } from './components/CallerCard';
import { HostCommissionSlideModal, HostRecruitmentPill } from './components/HostCommissionSlideModal';
import { ApkInstallGuideModal } from './components/ApkInstallGuideModal';
import { WalletProvider, useWallet } from './context/WalletContext';
import { CallProvider, useCall } from './context/CallContext';
import { HostProvider, useHost } from './context/HostContext';
import { AdminProvider } from './context/AdminContext';
import { Sakhi } from './types';
import { subscribeToAllRealHosts, saveHostProfileToCloud } from './services/hostSync';
import { getCurrentUser, syncUserToServer, saveUserToCloud, getActiveSession, useActiveSession, UserAccount, subscribeToAllRealCallers } from './services/userAuthSync';
import { getApiBaseUrl } from './services/apiConfig';
import { Sparkles, Phone, Video, Search, ShieldCheck, Heart, Users, MessageCircleHeart, Award, UserCheck, MessageCircle, Headphones, Shield, Shuffle, LogIn, ArrowRight, X, ShieldAlert } from 'lucide-react';

const MainContent: React.FC = () => {
  const session = useActiveSession();
  const [realSakhis, setRealSakhis] = useState<Sakhi[]>([]);
  const [registeredCallers, setRegisteredCallers] = useState<UserAccount[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<string>('sakhis');
  const [isHelpDeskOpen, setIsHelpDeskOpen] = useState<boolean>(false);
  const [multiLoginAlert, setMultiLoginAlert] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const currentSession = getActiveSession();
    // Auto-pop login modal on app open if user is not logged in!
    if (!currentSession.isLoggedIn) return true;
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('page') === 'login' ||
      params.get('page') === 'signup' ||
      params.get('login') !== null ||
      params.get('action') === 'login' ||
      params.get('auth') !== null
    ) {
      return true;
    }
    return false;
  });
  const [authFocus, setAuthFocus] = useState<'user' | 'host'>(() => {
    if (typeof window === 'undefined') return 'user';
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'host' || params.get('login') === 'host' || params.get('tab') === 'host') {
      return 'host';
    }
    return 'user';
  });
  const [isReferralModalOpen, setIsReferralModalOpen] = useState<boolean>(false);

  const { startCall } = useCall();
  const { openWalletModal } = useWallet();
  const {
    userRole,
    setUserRole,
    hostProfile,
    isHostLoggedIn,
    isLoginModalOpen,
    closeLoginModal,
    openLoginModal,
    incomingMessageNotification,
    dismissMessageNotification,
    setActiveMessageThreadId,
    openDirectChat,
    hostConversations
  } = useHost();

  const [isHostSlideOpen, setIsHostSlideOpen] = useState<boolean>(false);
  const [isApkGuideOpen, setIsApkGuideOpen] = useState<boolean>(false);

  // Auto-pop attractive 60% commission slide for callers after 3.5 seconds
  useEffect(() => {
    if (userRole === 'host' || isHostLoggedIn) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('sunosakhi_dismissed_host_slide') === 'true') return;

    const timer = window.setTimeout(() => {
      setIsHostSlideOpen(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, [userRole, isHostLoggedIn]);

  // Auto-sync any existing local user/host profiles to Firestore cloud on startup
  useEffect(() => {
    try {
      const caller = getCurrentUser();
      if (caller && (caller.phone || caller.email)) {
        saveUserToCloud(caller);
      }
      const rawHost = localStorage.getItem('sunosakhi_host_profile');
      if (rawHost) {
        const hp = JSON.parse(rawHost);
        if (hp && (hp.phone || hp.email || hp.id)) {
          saveHostProfileToCloud(hp);
        }
      }
    } catch {}
  }, []);

  // Real-time synchronization of registered hosts from Backend Server (Zero dummy accounts)
  useEffect(() => {
    const unsub = subscribeToAllRealHosts((list) => {
      setRealSakhis(list);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Real-time synchronization of registered Callers from Cloud Firestore & LocalStorage
  useEffect(() => {
    const unsub = subscribeToAllRealCallers((callers) => {
      setRegisteredCallers(callers);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    if (isLoginModalOpen) {
      setIsAuthModalOpen(false);
    }
  }, [isLoginModalOpen]);

  // Auto-close modal whenever user or host logs in
  useEffect(() => {
    if (session.isLoggedIn) {
      setIsAuthModalOpen(false);
    }
  }, [session.isLoggedIn]);

  // Global event listeners for authentication & multi-login detection
  useEffect(() => {
    const handleAuthEvent = (e: any) => {
      setAuthFocus(e?.detail?.focus || 'user');
      setIsAuthModalOpen(true);
    };
    const handleCloseAuthEvent = () => {
      setIsAuthModalOpen(false);
      closeLoginModal();
    };
    const handleMultiLogin = (e: any) => {
      const msg = e?.detail?.message || 'Aapka account kisi doosre phone par login ho gaya hai. Ek samay me sirf single phone login allowed hai.';
      setMultiLoginAlert(msg);
    };

    window.addEventListener('open-user-auth', handleAuthEvent);
    window.addEventListener('sunosakhi-close-auth', handleCloseAuthEvent);
    window.addEventListener('sunosakhi-multi-login-detected', handleMultiLogin);
    return () => {
      window.removeEventListener('open-user-auth', handleAuthEvent);
      window.removeEventListener('sunosakhi-close-auth', handleCloseAuthEvent);
      window.removeEventListener('sunosakhi-multi-login-detected', handleMultiLogin);
    };
  }, []);

  const handleCloseAuth = () => {
    setIsAuthModalOpen(false);
    closeLoginModal();
  };

  // Strictly ONLY real verified Girl Hosts (Female) registered with Mobile or Email
  const filteredSakhis = useMemo(() => {
    const myCallerPhone = String(session.phone || getCurrentUser()?.phone || '').replace(/\D/g, '').slice(-10);
    const myCallerEmail = (session.email || getCurrentUser()?.email || '').toLowerCase().trim();

    const seen = new Set<string>();
    const list = realSakhis.filter((sakhi) => {
      // Must NOT be the caller themselves
      const pDigits = String(sakhi.phone || sakhi.id || '').replace(/\D/g, '').slice(-10);
      const sEmail = (sakhi.email || '').toLowerCase().trim();
      if (myCallerPhone && pDigits === myCallerPhone) return false;
      if (myCallerEmail && sEmail === myCallerEmail) return false;

      // Must be female girl host
      if (sakhi.gender && sakhi.gender !== 'female') return false;

      const hasValidPhone = pDigits.length === 10;
      const hasValidEmail = Boolean(sakhi.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sakhi.email));
      if (!hasValidPhone && !hasValidEmail) return false;

      // Deduplication: Never display duplicate host cards
      const uniqueKey = (hasValidEmail ? sakhi.email!.toLowerCase() : '') ||
                        (hasValidPhone ? pDigits : '') ||
                        sakhi.id;
      if (seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);

      const matchesSearch =
        sakhi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sakhi.languages.some((l) => l.toLowerCase().includes(searchQuery.toLowerCase())) ||
        sakhi.interests.some((i) => i.toLowerCase().includes(searchQuery.toLowerCase())) ||
        sakhi.city.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'online') return sakhi.status === 'online';
      if (activeFilter === 'top') return sakhi.rating >= 4.9;
      if (activeFilter === 'hindi') return sakhi.languages.includes('Hindi');
      if (activeFilter === 'punjabi') return sakhi.languages.includes('Punjabi');

      return true;
    });

    // Sort: Online hosts first, then others
    return list.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return 0;
    });
  }, [realSakhis, session.phone, session.email, activeFilter, searchQuery]);

  // Filtered Callers for Host View (Strictly real online & active callers, excluding current host)
  const filteredCallers = useMemo(() => {
    const myHostPhone = String(hostProfile?.phone || session.phone || '').replace(/\D/g, '').slice(-10);
    const myHostId = hostProfile?.id || session.id || '';
    const myHostEmail = (hostProfile?.email || session.email || '').toLowerCase().trim();

    const list = registeredCallers.filter((caller) => {
      const cleanPhone = String(caller.phone || caller.id || '').replace(/\D/g, '').slice(-10);
      const cleanEmail = caller.email ? caller.email.toLowerCase().trim() : '';

      // Don't show the current host to herself
      if (myHostPhone && cleanPhone === myHostPhone) return false;
      if (myHostId && (caller.id === myHostId || caller.id === `caller-${myHostPhone}`)) return false;
      if (myHostEmail && cleanEmail === myHostEmail) return false;

      const hasValidPhone = cleanPhone.length === 10;
      const hasValidEmail = Boolean(cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));
      if (!hasValidPhone && !hasValidEmail) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const matchesName = (caller.name || '').toLowerCase().includes(q);
      const matchesPhone = cleanPhone.includes(q);
      return matchesName || matchesPhone;
    });

    // Sort: Online callers first, then recently active
    return list.sort((a, b) => {
      const aOnline = a.status === 'online' || a.isOnline;
      const bOnline = b.status === 'online' || b.isOnline;
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return (b.lastLoginAt || 0) - (a.lastLoginAt || 0);
    });
  }, [registeredCallers, hostProfile?.phone, hostProfile?.id, hostProfile?.email, session.phone, session.id, session.email, searchQuery]);

  const handleScrollToSakhis = () => {
    const el = document.getElementById('sakhis-feed');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090511] pb-24 sm:pb-12 text-slate-100">
      <Navbar
        onOpenHelpDesk={() => setIsHelpDeskOpen(true)}
        onOpenReferral={() => setIsReferralModalOpen(true)}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={(focus) => {
          setAuthFocus(focus || 'user');
          setIsAuthModalOpen(true);
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full">
        {currentTab === 'admin' ? (
          <AdminPortalPage onClose={() => setCurrentTab('sakhis')} />
        ) : currentTab === 'settings' ? (
          <SettingsView
            onExploreSakhis={() => setCurrentTab('sakhis')}
            onOpenAuth={(focus) => {
              setAuthFocus(focus || 'user');
              setIsAuthModalOpen(true);
            }}
            onOpenAdmin={() => setCurrentTab('admin')}
            onOpenRates={() => setCurrentTab('rates')}
            onOpenHelpline={() => setCurrentTab('helpline')}
            onOpenHostDashboard={() => {
              setUserRole('host');
              setCurrentTab('host');
            }}
          />
        ) : currentTab === 'rates' || currentTab === 'about' ? (
          <RateCardAndCommissionView
            onExploreSakhis={() => setCurrentTab('sakhis')}
            onOpenAuth={(focus) => {
              setAuthFocus(focus || 'user');
              setIsAuthModalOpen(true);
            }}
          />
        ) : currentTab === 'helpline' ? (
          <HelplineView onExploreSakhis={() => setCurrentTab('sakhis')} />
        ) : currentTab === 'recents' ? (
          <RecentCallsView
            onExploreSakhis={() => setCurrentTab('sakhis')}
            onlineSakhis={realSakhis.filter((s) => s.status === 'online')}
          />
        ) : currentTab === 'chats' ? (
          <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  {userRole === 'host' ? '💬 Caller Direct Chats' : '💬 Direct Sakhi Chats'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {userRole === 'host'
                    ? 'Callers ke sath chat karein (Host Account: 100% Free • ₹0 Charges)'
                    : 'Select an online Sakhi to chat (₹3/msg • 150 words limit • 100% private)'}
                </p>
              </div>
              {userRole === 'host' && (
                <button
                  onClick={() => setCurrentTab('host')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <span>Host Studio Inbox</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {userRole === 'host' ? (
              <div className="space-y-6 max-w-2xl mx-auto">
                {/* 1. Live Incoming Caller Conversations (Inbox) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-emerald-400" />
                      <span>Caller Inbox ({hostConversations.length})</span>
                      {hostConversations.some((c) => (c.unreadCount || 0) > 0) && (
                        <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black animate-pulse">
                          New Messages
                        </span>
                      )}
                    </h3>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      Manual Host Replies: 100% Free
                    </span>
                  </div>

                  {hostConversations.length === 0 ? (
                    <div className="p-6 text-center rounded-3xl bg-black/40 border border-emerald-500/20 mb-4">
                      <MessageCircle className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
                      <p className="text-xs text-gray-300 font-semibold">Abhi koi incoming message nahi aaya hai.</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Callers jab aapko message bhejenge, toh unki chat yahan sabse upar show hogi.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 mb-6">
                      {hostConversations.map((conv) => {
                        const cleanPhone = String(conv.callerPhone || conv.callerId || '').replace(/\D/g, '').slice(-10);
                        const callerName = conv.callerName && conv.callerName !== 'Caller' ? conv.callerName : `Caller ${cleanPhone.slice(-4) || ''}`;
                        const callerCompanion: Sakhi = {
                          id: conv.callerId || `caller-${cleanPhone}`,
                          name: callerName,
                          phone: cleanPhone,
                          avatar: conv.callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                          videoPoster: conv.callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                          age: 24,
                          city: 'India',
                          status: 'online',
                          rating: 5.0,
                          totalCalls: 1,
                          languages: ['Hindi'],
                          bio: 'SunoSakhi Caller',
                          interests: ['Friendly Chat'],
                          voiceRatePerMin: 5,
                          videoRatePerMin: 10,
                          audioSnippet: '',
                          tagline: 'Active Caller',
                          isVerified: true
                        };

                        return (
                          <div
                            key={conv.threadId}
                            className="p-3.5 sm:p-4 rounded-3xl bg-gradient-to-r from-[#190a2e]/95 via-[#230e3d]/90 to-[#120522]/95 border-2 border-emerald-500/40 shadow-xl flex items-center justify-between gap-3 hover:border-emerald-500/70 transition-all"
                          >
                            <div
                              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                              onClick={() => openDirectChat(callerCompanion)}
                            >
                              <div className="relative flex-shrink-0">
                                <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-emerald-500/60 p-0.5 bg-black">
                                  <img
                                    src={conv.callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'}
                                    alt={callerName}
                                    className="w-full h-full object-cover rounded-[12px]"
                                  />
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#120522] animate-pulse"></span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">
                                    {callerName}
                                  </h4>
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                                    {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-300 truncate mt-0.5">
                                  {conv.lastSender === 'sakhi' ? <span className="text-emerald-400 font-bold">You: </span> : ''}
                                  {conv.lastMessage}
                                </p>
                                {(conv.unreadCount || 0) > 0 && (
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-pink-600 text-white text-[9px] font-black animate-pulse">
                                    {conv.unreadCount} naya message
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons: Chat / Reply, Voice Call, Video Call */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => openDirectChat(callerCompanion)}
                                className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1 active:scale-95 transition-all"
                                title="Reply / Chat (100% Free for Host)"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Reply</span>
                              </button>
                              <button
                                onClick={() => startCall(callerCompanion, 'voice')}
                                className="p-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-950/40 active:scale-95 transition-all"
                                title="Voice Call (100% Free)"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => startCall(callerCompanion, 'video')}
                                className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/40 active:scale-95 transition-all"
                                title="Video Call (100% Free)"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Registered Online Callers */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-400" />
                      <span>Online Registered Callers ({filteredCallers.length})</span>
                    </h3>
                    <span className="text-[11px] text-gray-400">1-Tap Free Call / Chat</span>
                  </div>

                  {filteredCallers.length === 0 ? (
                    <div className="p-8 text-center rounded-3xl bg-black/40 border border-emerald-500/30">
                      <p className="text-sm text-gray-300">Abhi koi caller registered nahi hai.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {filteredCallers.map((caller) => (
                        <CallerCard key={caller.id || caller.phone} caller={caller} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              filteredSakhis.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-black/40 border border-pink-500/30">
                  <p className="text-sm text-gray-300">Abhi koi Sakhi online nahi hai. Kripya thodi der baad dekhein.</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto flex flex-col gap-3.5">
                  {filteredSakhis.map((sakhi) => (
                    <SakhiCard key={sakhi.id} sakhi={sakhi} />
                  ))}
                </div>
              )
            )}
          </div>
        ) : currentTab === 'host' ? (
          <HostDashboard />
        ) : userRole === 'host' ? (
          /* ========================================================================= */
          /* HOST MAIN WINDOW: SHOW REGISTERED CALLER IDs (100% FREE CALLS & CHAT)     */
          /* ========================================================================= */
          <div className="px-4 sm:px-6 my-5 max-w-4xl mx-auto">
            {/* Host Welcome & Live Earning Summary Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#16082c]/95 via-[#250d42]/90 to-[#0e041d]/95 border-2 border-emerald-500/40 p-5 sm:p-6 shadow-2xl mb-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 shadow-xl flex-shrink-0">
                    <img
                      src={hostProfile.avatar}
                      alt={hostProfile.name}
                      className="w-full h-full rounded-[14px] object-cover"
                    />
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#16082c] animate-pulse"></span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <h2 className="text-lg sm:text-xl font-black text-white">
                        Namaste {hostProfile.name || 'Sakhi Host'} 👑
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        Host Portal
                      </span>
                    </div>
                    <p className="text-xs text-emerald-300/90 mt-0.5 font-medium">
                      Host ID: Sabhi Callers ko 📞 Voice Call, 📹 Video Call aur 💬 Chat <strong>100% FREE (Zero Charges)</strong> hai!
                    </p>
                  </div>
                </div>

                {/* Quick Stats Pill */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center sm:justify-end">
                  <div className="px-3.5 py-2 rounded-2xl bg-black/40 border border-emerald-500/30 text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Pending Payout</p>
                    <p className="text-sm sm:text-base font-black text-emerald-400">
                      ₹{((hostProfile?.pendingPayout ?? 0) || 0).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentTab('host')}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <span>Host Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Caller Search Bar for Host */}
            <div className="relative mb-5 group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-emerald-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search caller by name or phone (e.g. Caller 0157, 70096...)..."
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#170a2c] border-2 border-emerald-500/40 text-white placeholder-gray-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 shadow-lg shadow-emerald-950/40 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Registered Callers Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                  <span>👥 Registered Callers</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    {filteredCallers.length} Callers
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ye sabhi callers aapki window par live hain. Direct call ya chat karein (Host Free Access)
                </p>
              </div>
            </div>

            {/* Registered Callers List */}
            {filteredCallers.length === 0 ? (
              <div className="p-8 sm:p-12 text-center rounded-3xl bg-gradient-to-b from-[#1c0d2e]/90 to-[#10061d]/90 border border-emerald-500/30 my-6 shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4 text-emerald-400">
                  <Users className="w-8 h-8 animate-pulse text-emerald-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                  {searchQuery ? 'Is search query se koi caller nahi mila' : 'Abhi Koi Caller Registered Nahi Hai'}
                </h3>
                <p className="text-gray-300 text-xs max-w-sm mx-auto mb-4">
                  {searchQuery
                    ? 'Kripya dusra mobile number ya naam search karein.'
                    : 'Jaise hi koi user caller ban kar login karega, wo aapki screen par live show hoga.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                  >
                    Search Reset Karein
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {filteredCallers.map((caller) => (
                  <CallerCard key={caller.id || caller.phone} caller={caller} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* CALLER MAIN WINDOW: SHOW ONLY VERIFIED GIRL HOSTS (FEMALE ONLY)           */
          /* ========================================================================= */
          <>
            {/* Top Poster Hero Section */}
            <HeroBanner
              onQuickCall={handleScrollToSakhis}
              onOpenReferral={() => setIsReferralModalOpen(true)}
              onOpenHostSlide={() => setIsHostSlideOpen(true)}
              onOpenApkGuide={() => setIsApkGuideOpen(true)}
            />

            {/* Profile Setup / Choice Banner */}
            <section className="px-4 sm:px-6 mt-4">
              <div className="p-3.5 sm:p-4 rounded-3xl bg-gradient-to-r from-[#1c082e]/90 via-[#270c3c]/80 to-[#100520]/90 border border-pink-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-600/30 flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <span>Apni Profile Banayein (Caller ya Host Girl)</span>
                      <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
                        Select Role
                      </span>
                    </h4>
                    <p className="text-[11px] text-gray-300">
                      Profile page par jakar chunein ki aap Caller hain ya Host Girl ban kar kamai karna chahti hain.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentTab('settings')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 text-white font-black text-xs shadow-lg shadow-pink-600/30 transition-all flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                  <span>Profile Banayein</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>

            {/* Filter & Search Bar */}
            <section className="px-4 sm:px-6 my-5">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
                {/* Prominent Name Search Bar */}
                <div className="relative w-full md:w-96 group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-pink-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search Sakhi by name (e.g. Pallavi, Neha, Priya)..."
                    className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#1a0c2e] border-2 border-pink-500/40 text-white placeholder-gray-400 text-xs sm:text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 shadow-lg shadow-purple-950/40 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none">
                  {[
                    { id: 'all', label: '✨ All Sakhis' },
                    { id: 'online', label: '🟢 Online Now' },
                    { id: 'top', label: '⭐ Top Rated' },
                    { id: 'hindi', label: '🗣️ Hindi' },
                    { id: 'punjabi', label: '🌾 Punjabi' },
                    { id: 'night', label: '🌙 Late Night' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        activeFilter === filter.id
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-900/40'
                          : 'bg-[#180d2c] text-gray-300 hover:text-white border border-white/5'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Search Result Tag */}
              {searchQuery.trim() && (
                <div className="mt-2.5 flex items-center gap-2 text-xs text-pink-300">
                  <span className="px-2.5 py-1 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center gap-1.5">
                    <span>Searching for: <strong>"{searchQuery}"</strong></span>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="hover:text-white p-0.5 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                  <span className="text-gray-400">({filteredSakhis.length} Sakhi found)</span>
                </div>
              )}
            </section>

            {/* Sakhis Grid */}
            <section id="sakhis-feed" className="px-4 sm:px-6 my-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    Verified Sakhis ({filteredSakhis.length})
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      Ready to Call
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Voice (₹7/min) • Video (₹15/min) • Sakhi Chat (₹3/msg, max 150 words) • Live Gifts
                  </p>
                </div>
              </div>

              {filteredSakhis.length === 0 ? (
                <div className="p-8 sm:p-12 text-center rounded-3xl bg-gradient-to-b from-[#1c0d2e]/90 to-[#10061d]/90 border border-pink-500/30 my-6 shadow-2xl relative overflow-hidden">
                  <div className="w-16 h-16 rounded-full bg-pink-600/20 border border-pink-500/40 flex items-center justify-center mx-auto mb-4 text-pink-400">
                    <Heart className="w-8 h-8 animate-pulse text-pink-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
                    {searchQuery ? 'Koi Sakhi nahi mili is search query ke saath' : 'Abhi Koi Real Host Online Nahi Hai'}
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed">
                    {searchQuery
                      ? 'Kripya dusra keyword dalein ya search reset karein.'
                      : 'Koi dummy profile nahi dikhai ja rahi hai. Jaise hi koi verified host apne mobile number se register ya online aayegi, wo yahan live show hogi.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {searchQuery ? (
                      <button
                        onClick={() => {
                          setActiveFilter('all');
                          setSearchQuery('');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all"
                      >
                        Reset Filters
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setAuthFocus('host');
                          setIsAuthModalOpen(true);
                        }}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-pink-600/40 transition-all flex items-center gap-2 hover:scale-105"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>🌸 Host Bano & 60% Kamai Shuru Karo</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto flex flex-col gap-3.5">
                  {filteredSakhis.map((sakhi) => (
                    <SakhiCard key={sakhi.id} sakhi={sakhi} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-pink-500/10 py-8 px-6 text-center text-xs text-gray-400">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-pink-400 text-base">SunoSakhi</span>
            <span>•</span>
            <span>Voice Connects Hearts ♡</span>
          </div>
          <p className="max-w-md text-gray-500">
            Dil se baat sirf SunoSakhi ke saath. Voice: ₹5/min • Video: ₹8/min • Sakhi Chat: ₹2/msg.
            Host Earns 60% Income. 100% Secure, Confidential, and Private.
          </p>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              onClick={() => setIsHelpDeskOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Help Desk (WhatsApp & Call)</span>
            </button>
          </div>
          <p className="text-gray-600 text-[10px]">
            © {new Date().getFullYear()} SunoSakhi Inc. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Global Modals & Call Interfaces */}
      <IncomingCallModal />
      <CallingScreen />
      <VoiceCallModal />
      <VideoCallModal />
      <WalletModal />
      <CallSummaryModal />
      <GiftTrayModal />
      <HostVerificationModal />
      <DirectChatModal />
      {/* Global Incoming Message Toast Banner */}
      <HostMessageToast
        notification={incomingMessageNotification}
        onDismiss={dismissMessageNotification}
        onOpenReply={(notif) => {
          dismissMessageNotification();
          if (notif.senderRole === 'sakhi') {
            openDirectChat({
              id: notif.sakhiId || 'sakhi-01',
              name: notif.sakhiName || 'Sakhi',
              age: 22,
              city: 'India',
              avatar: notif.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
              videoPoster: notif.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
              status: 'online',
              rating: 5,
              totalCalls: 1,
              languages: ['Hindi'],
              bio: 'Dil Se Baat',
              interests: ['Friendly Chat'],
              voiceRatePerMin: 5,
              videoRatePerMin: 10,
              audioSnippet: '',
              tagline: 'Sakhi Online'
            });
          } else {
            setUserRole('host');
            setActiveMessageThreadId(notif.threadId);
            const cleanPhone = String(notif.callerPhone || notif.callerId || '').replace(/\D/g, '').slice(-10);
            openDirectChat({
              id: notif.callerId || `caller-${cleanPhone}`,
              name: notif.callerName || `Caller ${cleanPhone.slice(-4) || ''}`,
              age: 24,
              city: 'India',
              avatar: notif.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
              videoPoster: notif.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=80',
              status: 'online',
              rating: 5,
              totalCalls: 1,
              languages: ['Hindi'],
              bio: 'SunoSakhi Caller',
              interests: ['Friendly Chat'],
              voiceRatePerMin: 5,
              videoRatePerMin: 10,
              audioSnippet: '',
              tagline: 'Active Caller',
              phone: cleanPhone
            });
          }
        }}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuth}
        defaultFocus={authFocus}
        isForcedGate={false}
      />
      <HostLoginModal />
      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />
      <HelpDeskModal isOpen={isHelpDeskOpen} onClose={() => setIsHelpDeskOpen(false)} />

      {/* 60% Commission Host Recruitment Slide Modal */}
      <HostCommissionSlideModal
        isOpen={isHostSlideOpen}
        onClose={() => {
          setIsHostSlideOpen(false);
          try {
            sessionStorage.setItem('sunosakhi_dismissed_host_slide', 'true');
          } catch {}
        }}
        onBecomeHost={() => {
          setIsHostSlideOpen(false);
          setUserRole('host');
          openLoginModal();
        }}
      />

      {/* Floating Host 60% Commission Trigger Pill */}
      {userRole !== 'host' && !isHostLoggedIn && currentTab === 'sakhis' && (
        <HostRecruitmentPill onClick={() => setIsHostSlideOpen(true)} />
      )}

      {/* APK Download & Installation Help Guide Modal */}
      <ApkInstallGuideModal
        isOpen={isApkGuideOpen}
        onClose={() => setIsApkGuideOpen(false)}
      />

      {/* Multi-Device Login Alert Modal */}
      {multiLoginAlert && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#1f0d2b] border-2 border-red-500 shadow-2xl shadow-red-600/50 p-6 text-white text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Multi-Device Login Alert</h3>
              <p className="text-xs text-red-200 mt-2 leading-relaxed">
                {multiLoginAlert}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-red-500/30 text-[11px] text-gray-300">
              🛡️ <strong>SunoSakhi Rule:</strong> Ek ID ek samay me sirf ek hi phone par login ho sakti hai.
            </div>
            <button
              type="button"
              onClick={() => {
                setMultiLoginAlert(null);
                setIsAuthModalOpen(true);
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs shadow-lg shadow-red-900/40 transition-all active:scale-95"
            >
              Dobara Login Karein
            </button>
          </div>
        </div>
      )}

      <BottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenHelpDesk={() => setIsHelpDeskOpen(true)}
        onOpenReferral={() => setIsReferralModalOpen(true)}
        onOpenAuth={() => {
          setAuthFocus('user');
          setIsAuthModalOpen(true);
        }}
      />
    </div>
  );
};

export function App() {
  const isAdmin = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('page') === 'admin' ||
    new URLSearchParams(window.location.search).get('admin') === 'portal' ||
    window.location.pathname.endsWith('/admin')
  );

  return (
    <WalletProvider>
      <HostProvider>
        <AdminProvider>
          <CallProvider>
            {isAdmin ? <AdminPortalPage /> : <MainContent />}
          </CallProvider>
        </AdminProvider>
      </HostProvider>
    </WalletProvider>
  );
}

export default App;
