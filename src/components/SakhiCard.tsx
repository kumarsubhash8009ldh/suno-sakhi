import React from 'react';
import { Phone, Video, MessageCircle, Coins, ShieldCheck } from 'lucide-react';
import { Sakhi } from '../types';
import { useCall } from '../context/CallContext';
import { useHost } from '../context/HostContext';
import { useAdmin } from '../context/AdminContext';
import { getActiveSession } from '../services/userAuthSync';
import { formatHostId } from '../utils/idFormatter';

interface SakhiCardProps {
  sakhi: Sakhi;
}

export const SakhiCard: React.FC<SakhiCardProps> = ({ sakhi }) => {
  const { startCall } = useCall();
  const { openDirectChat, isHostLoggedIn, hostProfile, userRole } = useHost();
  const { settings } = useAdmin();
  const session = getActiveSession();
  const isHostViewer = Boolean(
    session.role === 'host' ||
    userRole === 'host' ||
    isHostLoggedIn ||
    localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
    localStorage.getItem('sunosakhi_active_role') === 'host' ||
    (hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10)
  );

  const voiceRate = sakhi.voiceRatePerMin || settings?.voiceRatePerMin || 7;
  const videoRate = sakhi.videoRatePerMin || settings?.videoRatePerMin || 15;
  const chatRate = settings?.sakhiChatRate || 3;

  const isOnline = sakhi.status === 'online';
  const isTopHost = (sakhi.rating || 5) >= 4.9;
  const hostDisplayId = formatHostId(sakhi.id, sakhi.phone);

  return (
    <div className="rounded-3xl p-4 sm:p-5 bg-[#170a2c]/90 hover:bg-[#1d0d36]/90 border border-pink-500/25 hover:border-pink-500/45 shadow-xl transition-all duration-300 flex flex-col justify-between gap-4 group">
      {/* Top Row: Circular Avatar + Host Info (Matching User Screenshot) */}
      <div className="flex items-center gap-3.5">
        {/* Circular Avatar with Online Ring */}
        <div className="relative flex-shrink-0">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 ${isOnline ? 'border-emerald-500/60 shadow-lg shadow-emerald-950/50' : 'border-white/20'} shadow-md`}>
            <img
              src={sakhi.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'}
              alt={sakhi.name}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
          {/* Online status indicator dot */}
          <span
            className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#170a2c] ${
              isOnline ? 'bg-emerald-400 ring-2 ring-emerald-500/50 animate-pulse' : 'bg-gray-400'
            }`}
            title={isOnline ? '🟢 Host Online' : '⚪ Host Offline'}
          />
        </div>

        {/* Name, Age, Rating, Host ID Badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-base sm:text-lg font-bold text-white truncate flex items-center gap-1.5">
              <span>{sakhi.name}</span>
              <span className="text-xs text-pink-300 font-normal">({sakhi.age})</span>
            </h3>
            {/* Rating */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black flex-shrink-0">
              <span>★</span>
              <span>{(sakhi.rating || 5).toFixed(1)}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="px-2 py-0.5 rounded-md bg-pink-600/20 border border-pink-500/30 text-[10px] font-black text-pink-300 tracking-wider">
              Host ID: {hostDisplayId}
            </span>
            <p className="text-xs text-pink-200/80 truncate">
              • {sakhi.city || 'India'}
            </p>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {isTopHost ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-pink-300 border border-pink-500/40 text-[11px] font-bold">
                <span>👑</span>
                <span>Top Host</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold">
                <span>✨</span>
                <span>New Host</span>
              </span>
            )}

            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>🟢 Live Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                <span>Offline</span>
              </span>
            )}

            {sakhi.languages && sakhi.languages.length > 0 && (
              <span className="text-[10px] text-pink-300/70 font-medium">
                • {sakhi.languages[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Caller Rates Display Badge Strip */}
      {!isHostViewer && (
        <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2.5 rounded-2xl bg-black/50 border border-pink-500/20 text-center items-center shadow-inner">
          <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-pink-500/10 border border-pink-500/20">
            <div className="flex items-center gap-1 text-[10px] text-pink-300 font-semibold">
              <Phone className="w-3 h-3 text-pink-400" />
              <span>Voice</span>
            </div>
            <span className="text-xs font-black text-white font-mono">₹{voiceRate}/m</span>
          </div>

          <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
              <Video className="w-3 h-3 text-purple-400" />
              <span>Video</span>
            </div>
            <span className="text-xs font-black text-white font-mono">₹{videoRate}/m</span>
          </div>

          <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-1 text-[10px] text-blue-300 font-semibold">
              <MessageCircle className="w-3 h-3 text-blue-400" />
              <span>Message</span>
            </div>
            <span className="text-xs font-black text-white font-mono">₹{chatRate}/msg</span>
          </div>
        </div>
      )}

      {/* Bottom Row: 3 Action Buttons with Rates (Chat, Voice, Video) */}
      <div className="flex items-center gap-2 pt-1">
        {/* Left: Chat Button with rate */}
        <button
          type="button"
          onClick={() => openDirectChat(sakhi)}
          className="flex-1 py-2.5 px-2 rounded-2xl border border-blue-500/30 hover:border-blue-400 bg-blue-950/20 hover:bg-blue-950/40 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
          title={isHostViewer ? 'Free Chat (Host Account)' : `Direct Chat (₹${chatRate}/message)`}
        >
          <MessageCircle className="w-4 h-4 text-blue-400" />
          <span>{isHostViewer ? 'Chat (Free)' : `Chat ₹${chatRate}`}</span>
        </button>

        {/* Center: Voice Call Primary Button with rate */}
        <button
          type="button"
          onClick={() => startCall(sakhi, 'voice')}
          className="flex-1 py-2.5 px-2 rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-pink-600 hover:from-purple-600 hover:to-pink-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950/50 transition-all active:scale-95"
          title={isHostViewer ? 'Free Voice Call (Host Account)' : `Live Voice Call (₹${voiceRate}/min)`}
        >
          <Phone className="w-4 h-4 text-white" />
          <span>{isHostViewer ? 'Free Call' : `Call ₹${voiceRate}/m`}</span>
        </button>

        {/* Right: Video Call Button with rate */}
        <button
          type="button"
          onClick={() => startCall(sakhi, 'video')}
          className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 border border-pink-400/40 text-white font-black text-xs sm:text-sm shadow-md shadow-pink-950/50 flex items-center justify-center gap-1 transition-all active:scale-95"
          title={isHostViewer ? 'Free Video Call (Host Account)' : `Video Call (₹${videoRate}/min)`}
        >
          <Video className="w-4 h-4 text-white" />
          <span>{isHostViewer ? 'Free' : `₹${videoRate}/m`}</span>
        </button>
      </div>
    </div>
  );
};
