import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign,
  Clock,
  Gift,
  ShieldCheck,
  Camera,
  Upload,
  ArrowDownToLine,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Edit3,
  Phone,
  Video,
  MessageCircle,
  Send,
  User,
  Heart,
  AlertCircle,
  Check,
  CheckCheck,
  Users,
  Radio,
  Award,
  Star,
  Flame,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useHost } from '../context/HostContext';
import { useCall } from '../context/CallContext';
import { ConversationItem, ChatMessage, Sakhi } from '../types';
import { subscribeToCloudChat, markThreadAsRead } from '../services/chatSync';
import { updateHostOnlineStatus } from '../services/hostSync';
import { getApiBaseUrl } from '../services/apiConfig';
import { getHostRankTier } from '../utils/hostRankTiers';
import { subscribeToAllRealCallers } from '../services/userAuthSync';

import { HostWithdrawModal } from './HostWithdrawModal';
import { CreditCard } from 'lucide-react';
import { compressImageFile } from '../utils/imageCompressor';

const HOST_PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80'
];

const renderWhatsAppStatusTick = (status?: 'sent' | 'delivered' | 'read') => {
  if (status === 'read') {
    return (
      <span className="inline-flex items-center text-[#53bdeb] ml-1" title="Read (Double Blue Tick)">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center text-[#8696a0] ml-1" title="Delivered (Double Grey Tick)">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[#8696a0] ml-1" title="Sent (Single Grey Tick)">
      <Check className="w-3.5 h-3.5" />
    </span>
  );
};

export const HostDashboard: React.FC = () => {
  const {
    hostProfile,
    updateHostPhoto,
    updateHostProfile,
    openVerificationModal,
    openWithdrawModal,
    requestPayout,
    hostConversations,
    sendHostManualReply,
    activeMessageThreadId,
    setActiveMessageThreadId,
    weeklyIncentiveStats,
    claimWeeklyIncentive
  } = useHost();

  const [incentiveToast, setIncentiveToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClaimIncentive = () => {
    const res = claimWeeklyIncentive();
    if (res.success) {
      setIncentiveToast({ type: 'success', text: res.message });
    } else {
      setIncentiveToast({ type: 'error', text: res.message });
    }
    setTimeout(() => setIncentiveToast(null), 5000);
  };

  const { startCall } = useCall();
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'callers'>('overview');
  const [registeredCallers, setRegisteredCallers] = useState<any[]>([]);
  const [togglingOnline, setTogglingOnline] = useState<boolean>(false);

  // Real-time subscription to ALL real callers from Cloud Firestore & LocalStorage
  useEffect(() => {
    const unsub = subscribeToAllRealCallers((callers) => {
      setRegisteredCallers(callers);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Host calls a Caller (100% Free for Host!)
  const handleCallCaller = async (caller: any, type: 'voice' | 'video') => {
    if (!caller) return;
    const cleanPhone = String(caller.phone || '').replace(/\D/g, '');
    const callerCompanion: Sakhi = {
      id: caller.id || ('caller-' + cleanPhone),
      name: caller.name || `Caller ${cleanPhone.slice(-4) || ''}`,
      phone: cleanPhone,
      avatar: caller.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
      videoPoster: caller.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
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
    await startCall(callerCompanion, type);
  };

  // Toggle Online/Offline status
  const handleToggleOnline = async () => {
    const nextStatus = hostProfile.status === 'online' ? 'offline' : 'online';
    setTogglingOnline(true);
    try {
      await updateHostOnlineStatus(hostProfile.id, nextStatus);
      updateHostProfile({ status: nextStatus });
    } finally {
      setTogglingOnline(false);
    }
  };
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(hostProfile.name);
  const [city, setCity] = useState(hostProfile.city);
  const [bio, setBio] = useState(hostProfile.bio);
  const [tagline, setTagline] = useState(hostProfile.tagline);
  const [upiId, setUpiId] = useState(hostProfile.upiId || '');
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  // Chat Inbox State
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [activeThreadMsgs, setActiveThreadMsgs] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-select first conversation if available and none selected
  useEffect(() => {
    if (!selectedConv && hostConversations.length > 0) {
      setSelectedConv(hostConversations[0]);
    }
  }, [hostConversations, selectedConv]);

  // Jump to specific conversation thread if selected from notification toast
  useEffect(() => {
    if (activeMessageThreadId && hostConversations.length > 0) {
      const match = hostConversations.find((c) => c.threadId === activeMessageThreadId);
      if (match) {
        setSelectedConv(match);
        setActiveTab('messages');
        setActiveMessageThreadId(null);
      }
    }
  }, [activeMessageThreadId, hostConversations]);

  // Subscribe to messages of the currently selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    markThreadAsRead(selectedConv.threadId, 'sakhi');
    const unsub = subscribeToCloudChat(selectedConv.threadId, (msgs) => {
      setActiveThreadMsgs(msgs);
      markThreadAsRead(selectedConv.threadId, 'sakhi');
    });
    return () => {
      if (unsub) unsub();
    };
  }, [selectedConv]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadMsgs]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoUploading(true);
      try {
        const compressed = await compressImageFile(file, 400, 0.82);
        updateHostPhoto(compressed);
        setPhotoSuccess('Profile photo successfully badal gayi hai! ✅');
        setTimeout(() => setPhotoSuccess(null), 4000);
      } catch (err) {
        console.error('Photo upload failed:', err);
        alert('Photo process karne me samasya aayi. Kripya dusri photo chunein.');
      } finally {
        setPhotoUploading(false);
      }
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateHostProfile({
      name,
      city,
      bio,
      tagline,
      upiId
    });
    setIsEditingProfile(false);
  };

  const handlePayout = () => {
    const res = requestPayout();
    setPayoutMessage(res.message);
    setTimeout(() => setPayoutMessage(null), 5000);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplyError(null);
    if (!selectedConv) return;
    const trimmed = replyText.trim();
    if (!trimmed) return;

    setReplyLoading(true);
    const res = await sendHostManualReply(
      selectedConv.threadId,
      selectedConv.callerId,
      selectedConv.callerName,
      trimmed
    );
    setReplyLoading(false);

    if (res.success) {
      setReplyText('');
    } else {
      setReplyError(res.error || 'Failed to send reply');
    }
  };

  const hostTier = getHostRankTier(hostProfile.rating || 5.0);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner: Host Profile with Photo Update */}
      <div className="relative rounded-3xl overflow-hidden glass-card border border-pink-500/30 p-6 shadow-2xl">
        {photoSuccess && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{photoSuccess}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with tap-friendly camera badge */}
          <div className="relative group flex-shrink-0">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1 bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 shadow-xl overflow-hidden relative">
              <img
                src={hostProfile.avatar}
                alt={hostProfile.name}
                className="w-full h-full rounded-[22px] object-cover"
              />
              {photoUploading && (
                <div className="absolute inset-0 bg-black/70 rounded-[22px] flex flex-col items-center justify-center text-white">
                  <Camera className="w-6 h-6 text-pink-400 animate-bounce mb-1" />
                  <span className="text-[10px] font-bold text-pink-200">Saving...</span>
                </div>
              )}
            </div>

            {/* Always visible, tap-friendly Camera badge for mobile & desktop */}
            <label
              className="absolute -bottom-1 -left-1 p-2 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all border-2 border-[#160a28] flex items-center gap-1 z-10"
              title="Change Profile Photo (Camera / Gallery)"
            >
              <Camera className="w-4 h-4 text-white" />
              <span className="text-[10px] font-bold sm:hidden">Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={photoUploading}
                onChange={handlePhotoUpload}
              />
            </label>

            {/* Verified Host Badge */}
            <div className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-lg border-2 border-[#160a28] z-10">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified Sakhi</span>
            </div>
          </div>

          {/* Profile details */}
          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
                  {hostProfile.name}, <span className="text-pink-300 text-xl">{hostProfile.age}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-medium">
                    Host ID: SAKHI-{hostProfile?.id ? String(hostProfile.id).toUpperCase() : 'HOST'}
                  </span>
                </h1>
                <p className="text-xs text-pink-200/90 font-medium italic mt-0.5">
                  "{hostProfile.tagline || 'Voice Connects Hearts ♡'}"
                </p>

                {/* Host Rank Badge & Rates */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1 shadow-sm ${hostTier.bgClass} ${hostTier.borderClass} ${hostTier.colorClass}`}>
                    <Award className="w-3.5 h-3.5" />
                    <span>{hostTier.badge} ({hostTier.title})</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span>{(hostProfile.rating || 5.0).toFixed(1)} Rating</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                    Voice: ₹{hostTier.voiceEarningPerMin.toFixed(2)}/min • Video: ₹{hostTier.videoEarningPerMin.toFixed(2)}/min
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Online / Offline Live Availability Toggle */}
                <button
                  onClick={handleToggleOnline}
                  disabled={togglingOnline}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow transition-all ${
                    hostProfile.status === 'online'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-white/10'
                  }`}
                  title={hostProfile.status === 'online' ? 'Click to go Offline (Hidden from callers)' : 'Click to go Online (Visible to callers)'}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${hostProfile.status === 'online' ? 'bg-emerald-300 animate-ping' : 'bg-gray-400'}`}></span>
                  <span>{hostProfile.status === 'online' ? '🟢 Online (Callers Ko Show)' : '🔴 Offline (Callers Se Hide)'}</span>
                </button>
                <label className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-xs font-bold text-white border border-pink-400/40 flex items-center gap-1.5 cursor-pointer shadow transition-all">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{photoUploading ? 'Uploading...' : 'Change Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={photoUploading}
                    onChange={handlePhotoUpload}
                  />
                </label>
                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="px-3 py-1.5 rounded-xl bg-[#2a1343] hover:bg-[#38195a] text-xs font-bold text-pink-200 border border-pink-500/30 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingProfile ? 'Close Edit' : 'Edit Profile'}</span>
                </button>
                <button
                  onClick={openVerificationModal}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-xs font-bold text-emerald-300 border border-emerald-500/40 flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ID & Live Photo</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-300 max-w-2xl mt-2 leading-relaxed">
              {hostProfile.bio}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
              <span className="text-[11px] text-gray-400">Languages:</span>
              {(hostProfile.languages || ['Hindi']).map((l) => (
                <span key={l} className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-pink-300 border border-pink-500/20">
                  {l}
                </span>
              ))}
              <span className="text-gray-500">•</span>
              <span className="text-[11px] text-gray-400">City: <strong className="text-white">{hostProfile.city || 'India'}</strong></span>
              <span className="text-gray-500">•</span>
              <span className="text-[11px] text-gray-400">UPI Payout: <strong className="text-emerald-300">{hostProfile.upiId || 'Not set'}</strong></span>
            </div>
          </div>
        </div>

        {/* Inline Edit Profile Form */}
        {isEditingProfile && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {/* Quick Avatar Chooser Section inside Edit Profile */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-black/50 border border-pink-500/30 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-pink-400" />
                    Profile Photo Badlein (Custom Upload ya Avatars)
                  </h4>
                  <p className="text-[10px] text-gray-400">
                    Apni photo upload karein ya verified Sakhi avatars me se 1-tap select karein.
                  </p>
                </div>
                <label className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all flex-shrink-0 self-start sm:self-auto">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Gallery / Camera Se Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={photoUploading}
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>

              {/* Preset Avatars */}
              <div className="flex items-center gap-2.5 overflow-x-auto py-1">
                {HOST_PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      updateHostPhoto(url);
                      setPhotoSuccess('Avatar update ho gaya! ✅');
                      setTimeout(() => setPhotoSuccess(null), 3500);
                    }}
                    className={`relative w-12 h-12 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      hostProfile.avatar === url
                        ? 'border-pink-500 ring-2 ring-pink-500 scale-105'
                        : 'border-white/20 hover:border-pink-400 opacity-80 hover:opacity-100'
                    }`}
                    title={`Select Avatar ${idx + 1}`}
                  >
                    <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                    {hostProfile.avatar === url && (
                      <div className="absolute inset-0 bg-pink-600/40 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-pink-500/30 text-white text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-pink-500/30 text-white text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-pink-500/30 text-white text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">UPI ID for 60% Payouts</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-pink-500/30 text-white text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-gray-400 block mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-pink-500/30 text-white text-xs"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-xs font-bold text-white shadow"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Navigation Tabs between Overview and Live Messages */}
      <div className="flex items-center gap-3 border-b border-pink-500/20 pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/30'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Earnings & Passbook (60%)</span>
        </button>

        <button
          onClick={() => setActiveTab('callers')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all ${
            activeTab === 'callers'
              ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/30'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>👥 Registered Callers</span>
          {registeredCallers.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black">
              {registeredCallers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all ${
            activeTab === 'messages'
              ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/30'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-pink-300" />
          <span>💬 Live User Messages</span>
          {hostConversations.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black">
              {hostConversations.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: EARNINGS OVERVIEW & PASSBOOK */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div>
            {/* INCENTIVE CLAIM TOAST NOTIFICATION */}
            {incentiveToast && (
              <div
                className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 animate-bounce-short ${
                  incentiveToast.type === 'success'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{incentiveToast.text}</span>
                </div>
                <button onClick={() => setIncentiveToast(null)} className="p-1 hover:opacity-80">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* WEEKLY LONG CALL PROMOTION BANNER (20HR+ -> ₹200 BONUS) */}
            <div className="relative overflow-hidden p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950/70 via-purple-950/80 to-pink-950/70 border border-amber-500/40 shadow-2xl mb-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30 flex-shrink-0 animate-bounce-short">
                    <Flame className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-amber-200 flex items-center gap-1.5">
                        <span>WEEKLY LONG CALL INCENTIVE</span>
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-black text-[10px] uppercase shadow">
                        ₹200 CASH BONUS
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-amber-300 font-mono text-[10px]">
                        {weeklyIncentiveStats.weekLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-200 mt-0.5">
                      Is hafte <strong>20 Hours (1,200 min)</strong> total call time poora karein aur paayein extra <strong>₹200 flat incentive</strong> direct wallet mein!
                    </p>
                  </div>
                </div>

                {/* Claim Button or Status Badge */}
                <div className="self-end sm:self-center flex-shrink-0">
                  {weeklyIncentiveStats.isClaimed ? (
                    <div className="px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center gap-1.5 shadow">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>₹200 Bonus Claimed!</span>
                    </div>
                  ) : weeklyIncentiveStats.isEligible ? (
                    <button
                      onClick={handleClaimIncentive}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 text-white font-black text-xs shadow-xl shadow-emerald-500/30 animate-pulse flex items-center gap-1.5 transition-all"
                    >
                      <Gift className="w-4 h-4" />
                      <span>Claim ₹200 Incentive Now!</span>
                    </button>
                  ) : (
                    <div className="px-3.5 py-1.5 rounded-2xl bg-black/50 border border-amber-500/30 text-amber-300 font-mono text-xs text-right">
                      <span className="text-[10px] text-gray-400 block font-sans">Target Remaining:</span>
                      <strong>{weeklyIncentiveStats.hoursRemaining} hrs baaki</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar & Sub-stats */}
              <div className="space-y-1.5 bg-black/40 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Weekly Call Progress:</span>
                    <strong className="text-white font-mono">{weeklyIncentiveStats.totalHours} hrs</strong>
                    <span className="text-gray-400">/ 20.0 hrs</span>
                  </span>
                  <span className="text-amber-300 font-black font-mono">
                    {weeklyIncentiveStats.progressPercent}% Completed
                  </span>
                </div>

                <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-amber-500/30">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      weeklyIncentiveStats.isEligible
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 animate-pulse'
                        : 'bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500'
                    }`}
                    style={{ width: `${weeklyIncentiveStats.progressPercent}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                  <span>Target: 20 Hours (1,200 min) Per Week</span>
                  <span>
                    {weeklyIncentiveStats.isEligible
                      ? '🎉 20 Hour Milestone Unlocked!'
                      : `${weeklyIncentiveStats.minutesRemaining} minutes remaining to unlock ₹200`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Host Income & Earnings Overview (60% Share)</span>
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                60% Commission Rate Active
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Card 1: 60% Net Income */}
              <div className="p-4 rounded-3xl bg-gradient-to-b from-[#1c2c20] to-[#101b13] border border-emerald-500/40 shadow-xl">
                <div className="flex items-center justify-between text-emerald-300 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Your 60% Income</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-300">
                    ₹{((hostProfile?.netIncome ?? 0) || 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400/80 mt-1">
                  Calls, gifts & messages
                </p>
              </div>

              {/* Card 2: Total Call Minutes */}
              <div className="p-4 rounded-3xl bg-gradient-to-b from-[#24133d] to-[#150a24] border border-pink-500/30 shadow-xl">
                <div className="flex items-center justify-between text-pink-300 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Call Time</span>
                  <Clock className="w-4 h-4 text-pink-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {(hostProfile?.totalVoiceMinutes || 0) + (hostProfile?.totalVideoMinutes || 0)}
                  </span>
                  <span className="text-xs text-pink-200">mins</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-400 mt-1">
                  <span>🎙️ {hostProfile?.totalVoiceMinutes || 0}m</span>
                  <span>📹 {hostProfile?.totalVideoMinutes || 0}m</span>
                </div>
              </div>

              {/* Card 3: Total Gifts Received */}
              <div className="p-4 rounded-3xl bg-gradient-to-b from-[#35154c] to-[#1e0d2c] border border-purple-500/30 shadow-xl">
                <div className="flex items-center justify-between text-purple-300 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Gifts</span>
                  <Gift className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {hostProfile?.totalGiftsReceived || 0}
                  </span>
                  <span className="text-xs text-purple-200">gifts</span>
                </div>
                <p className="text-[10px] text-purple-300/80 mt-1">
                  60% on all gifts
                </p>
              </div>

              {/* Card 4: Sakhi Chat Messages Received */}
              <div className="p-4 rounded-3xl bg-gradient-to-b from-[#182042] to-[#0f142b] border border-blue-500/30 shadow-xl">
                <div className="flex items-center justify-between text-blue-300 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Sakhi Chat</span>
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {hostProfile?.totalMessagesReceived || 0}
                  </span>
                  <span className="text-xs text-blue-200">msgs</span>
                </div>
                <p className="text-[10px] text-blue-300/80 mt-1">
                  ₹1.20 (60%) per Sakhi Chat
                </p>
              </div>

              {/* Card 5: Available Payout */}
              <div className="p-4 rounded-3xl bg-gradient-to-b from-[#28163f] to-[#130822] border border-pink-500/40 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-pink-300 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Pending Payout</span>
                    <ArrowDownToLine className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      ₹{((hostProfile?.pendingPayout ?? 0) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={openWithdrawModal}
                  className="mt-2 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Withdraw (Min ₹500)</span>
                </button>
              </div>
            </div>

            {payoutMessage && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{payoutMessage}</span>
              </div>
            )}
          </div>

          {/* Verification Card & Live Photo Status */}
          <div className="p-5 rounded-3xl glass-card border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-emerald-500/60 flex-shrink-0 bg-black">
                <img
                  src={hostProfile.verification?.selfieUrl || hostProfile.avatar}
                  alt="Live Photo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">
                    Aadhaar Card Verification
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full ${hostProfile.isVerified || hostProfile.verification?.status === 'verified' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'} text-[10px] font-bold border`}>
                    {hostProfile.isVerified || hostProfile.verification?.status === 'verified' ? 'VERIFIED ✅' : 'PENDING ⚠️'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Aadhaar Card: {hostProfile.verification?.residentIdNumber || hostProfile.verification?.idNumber ? `XXXX-XXXX-${String(hostProfile.verification?.residentIdNumber || hostProfile.verification?.idNumber).slice(-4)}` : 'Aadhaar Auto-Verified'} • 18+ Female 🌸
                </p>
              </div>
            </div>

            <button
              onClick={openVerificationModal}
              className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors whitespace-nowrap"
            >
              {hostProfile.isVerified || hostProfile.verification?.status === 'verified' ? 'View Aadhaar Details' : 'Verify Aadhaar Now'}
            </button>
          </div>

          {/* Income Ledger / Passbook */}
          <div className="rounded-3xl glass-card border border-pink-500/20 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Host Income Passbook</h3>
                <p className="text-xs text-gray-400">Live record of calls, gifts and messages with 60% share calculation</p>
              </div>
              <span className="text-xs text-emerald-400 font-bold">
                Total Records: {hostProfile.incomeHistory.length}
              </span>
            </div>

            <div className="mt-4 space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {hostProfile.incomeHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-white/5 hover:border-pink-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                      {item.type === 'call' ? (
                        <Phone className="w-4 h-4" />
                      ) : item.type === 'gift' ? (
                        <Gift className="w-4 h-4" />
                      ) : item.type === 'incentive' ? (
                        <Flame className="w-4 h-4 text-amber-400" />
                      ) : (
                        <MessageCircle className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{item.description}</p>
                      <p className="text-[10px] text-gray-400">
                        Gross: ₹{(item.grossAmount || 0).toFixed(2)} • Host Cut: {item.hostSharePercent || 60}% •{' '}
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-400 block">
                      +₹{(item.hostEarned || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400">60% credited</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: REGISTERED CALLERS (DIRECT CALLS & CHAT) */}
      {activeTab === 'callers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-3xl bg-black/40 border border-pink-500/20">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>Active Callers ({registeredCallers.length})</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  100% FREE for Host
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Aap kisi bhi Caller ko direct Voice Call (📞) ya Video Call (📹) laga sakti hain — Host ID se sabhi calls aur messages 100% FREE hain!
              </p>
            </div>
            <span className="text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 text-emerald-300 font-bold self-start sm:self-auto">
              ₹0 Charges • Zero Deduction
            </span>
          </div>

          {registeredCallers.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#140826]/90 border border-pink-500/30 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-pink-600/20 border border-pink-500/40 flex items-center justify-center mx-auto mb-4 text-pink-400">
                <Users className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Abhi Koi Caller Registered Nahi Hai</h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                Jaise hi koi naya caller mobile number login karke account banayega, wo yahan live appear hoga aur aap unhe 1-tap me voice call ya video call laga sakengi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredCallers.map((caller) => {
                const cleanPhone = String(caller.phone || '').replace(/\D/g, '');
                return (
                  <div
                    key={caller.id || caller.phone}
                    className="p-4 rounded-3xl bg-gradient-to-r from-[#1c0a2e]/90 to-[#120520]/90 border border-pink-500/30 shadow-xl flex items-center justify-between gap-3 hover:border-pink-500/60 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <img
                          src={caller.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'}
                          alt={caller.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-pink-500/40"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#120520]"></span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-white truncate">{caller.name || 'Caller'}</h4>
                        <p className="text-[11px] text-gray-400 font-mono">
                          +91 {cleanPhone ? `${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}` : 'Registered'}
                        </p>
                        <span className="text-[10px] text-emerald-400 font-semibold inline-block">
                          Active Caller • Wallet: ₹{Number(caller.balance || 0).toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons: 📞 Voice, 📹 Video, 💬 Chat */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleCallCaller(caller, 'voice')}
                        className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-pink-600/40 transition-all hover:scale-105 active:scale-95"
                        title="Voice Call lagayein (100% Free)"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Voice</span>
                      </button>
                      <button
                        onClick={() => handleCallCaller(caller, 'video')}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/40 transition-all hover:scale-105 active:scale-95"
                        title="Video Call lagayein (100% Free)"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Video</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE USER MESSAGES & MANUAL CHAT INBOX */}
      {activeTab === 'messages' && (
        <div className="rounded-3xl glass-card border border-pink-500/30 overflow-hidden shadow-2xl flex flex-col md:flex-row h-[620px]">
          {/* Left Column: List of conversations */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-pink-500/20 bg-black/40 flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-pink-400" />
                  <span>Callers Inbox</span>
                </h3>
                <p className="text-[11px] text-gray-400">Manual replies earn ₹1.20/msg</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold">
                {hostConversations.length} Users
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {hostConversations.length === 0 ? (
                <div className="text-center py-16 px-4 text-gray-400">
                  <MessageCircle className="w-10 h-10 text-pink-400/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Abhi tak koi message nahi aaya.</p>
                  <p className="text-[10px] text-pink-300 mt-1">
                    Callers jab aapko direct message bhejenge, toh unka conversation yahan live appear hoga.
                  </p>
                </div>
              ) : (
                hostConversations.map((conv) => (
                  <button
                    key={conv.threadId}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${
                      selectedConv?.threadId === conv.threadId
                        ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 border border-pink-500/50 shadow'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-0.5 flex-shrink-0">
                      <div className="w-full h-full rounded-full bg-[#180928] flex items-center justify-center text-sm font-black text-pink-300">
                        {conv.callerName ? conv.callerName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">
                          {conv.callerName || 'Caller'}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 truncate mt-0.5">
                        {conv.lastSender === 'sakhi' ? 'You: ' : ''}{conv.lastMessage}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Active Conversation & Manual Reply Area */}
          <div className="flex-1 flex flex-col bg-[#11071e]">
            {selectedConv ? (
              <>
                {/* Active Chat Header */}
                <div className="p-4 border-b border-pink-500/20 bg-black/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-0.5">
                      <div className="w-full h-full rounded-full bg-[#180928] flex items-center justify-center text-xs font-black text-pink-300">
                        {selectedConv.callerName ? selectedConv.callerName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{selectedConv.callerName}</span>
                        {selectedConv.callerPhone && (
                          <span className="text-[10px] text-gray-400">({selectedConv.callerPhone})</span>
                        )}
                      </h4>
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>Direct Manual 2-Way Chat (Zero Bots)</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCallCaller({
                        id: selectedConv.callerId,
                        name: selectedConv.callerName,
                        phone: selectedConv.callerPhone
                      }, 'voice')}
                      className="px-2.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-pink-600/30 transition-all hover:scale-105 active:scale-95"
                      title="Voice Call lagayein (100% Free for Host)"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Voice</span>
                    </button>
                    <button
                      onClick={() => handleCallCaller({
                        id: selectedConv.callerId,
                        name: selectedConv.callerName,
                        phone: selectedConv.callerPhone
                      }, 'video')}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-purple-600/30 transition-all hover:scale-105 active:scale-95"
                      title="Video Call lagayein (100% Free for Host)"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Video</span>
                    </button>
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30 hidden xs:inline">
                      60% Earn
                    </span>
                  </div>
                </div>

                {/* Messages Thread (WhatsApp dark style) */}
                <div className="flex-1 p-3 sm:p-4 overflow-y-auto bg-[#0b141a]">
                  {activeThreadMsgs.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-xs">
                      Iss user ke sath baatcheet shuru karein. Host replies are 100% free with zero output charges.
                    </div>
                  ) : (
                    <div className="w-full flex flex-col space-y-2 py-1">
                      {activeThreadMsgs.map((msg) => {
                        const isSentByHost = msg.sender === 'sakhi';

                        return (
                          /* Dedicated full-width row: Right for Host, Left for Caller */
                          <div
                            key={msg.id}
                            className={`w-full flex my-1 ${isSentByHost ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`relative max-w-[85%] sm:max-w-[72%] px-3.5 py-2 shadow-md ${
                                isSentByHost
                                  ? 'bg-[#005c4b] text-white rounded-2xl rounded-tr-none ml-auto border border-emerald-500/20'
                                  : 'bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-none mr-auto border border-white/10'
                              }`}
                            >
                              {/* Sender / Receiver Label */}
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span
                                  className={`text-[10px] font-bold flex items-center gap-1 ${
                                    isSentByHost ? 'text-emerald-300' : 'text-pink-300'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isSentByHost ? 'bg-emerald-400' : 'bg-pink-400'
                                    }`}
                                  ></span>
                                  <span>{isSentByHost ? 'Aap (Host • Sender)' : `${msg.callerName || selectedConv?.callerName || 'Caller'} (Receiver)`}</span>
                                </span>
                              </div>

                              <p className="text-xs sm:text-[13px] leading-relaxed break-words select-text text-[#e9edef]">
                                {msg.text}
                              </p>

                              <div
                                className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
                                  isSentByHost ? 'text-emerald-200/75' : 'text-[#8696a0]'
                                }`}
                              >
                                {isSentByHost && <span>Host (₹0) •</span>}
                                <span>
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isSentByHost && renderWhatsAppStatusTick(msg.status)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Manual Reply Input Form */}
                <form onSubmit={handleSendReply} className="p-3 border-t border-pink-500/20 bg-black/60 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Apna manual reply likhein..."
                    className="flex-1 px-4 py-3 rounded-2xl bg-black/70 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="submit"
                    disabled={replyLoading || !replyText.trim()}
                    className="py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 text-white font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reply</span>
                  </button>
                </form>

                {replyError && (
                  <div className="px-4 py-1.5 bg-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{replyError}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                <MessageCircle className="w-12 h-12 text-pink-400/30 mb-2" />
                <p className="text-sm font-bold text-white">Koi conversation select karein</p>
                <p className="text-xs text-gray-400 mt-1">Left side se caller ko choose karein aur manual reply dein.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Host Payment Withdrawal Modal */}
      <HostWithdrawModal />
    </div>
  );
};
