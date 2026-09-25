import React from 'react';
import { Phone, Video, MessageCircle, Coins, ShieldCheck } from 'lucide-react';
import { Sakhi } from '../types';
import { useCall } from '../context/CallContext';
import { useHost } from '../context/HostContext';
import { getActiveSession } from '../services/userAuthSync';
import { formatHostId } from '../utils/idFormatter';

interface SakhiCardProps {
  sakhi: Sakhi;
}

export const SakhiCard: React.FC<SakhiCardProps> = ({ sakhi }) => {
  const { startCall } = useCall();
  const { openDirectChat, isHostLoggedIn, hostProfile, userRole } = useHost();
  const session = getActiveSession();
  const isHostViewer = Boolean(
    session.role === 'host' ||
    userRole === 'host' ||
    isHostLoggedIn ||
    localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
    localStorage.getItem('sunosakhi_active_role') === 'host' ||
    (hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10)
  );

  const isOnline = sakhi.status !== 'offline';
  const isTopHost = (sakhi.rating || 5) >= 4.9;
  const hostDisplayId = formatHostId(sakhi.id, sakhi.phone);

  return (
    <div className="rounded-3xl p-4 sm:p-5 bg-[#170a2c]/90 hover:bg-[#1d0d36]/90 border border-pink-500/25 hover:border-pink-500/45 shadow-xl transition-all duration-300 flex flex-col justify-between gap-4 group">
      {/* Top Row: Circular Avatar + Host Info (Matching User Screenshot) */}
      <div className="flex items-center gap-3.5">
        {/* Circular Avatar with Online Ring */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-pink-500/40 shadow-md">
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
              isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-pink-400'
            }`}
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

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Available</span>
            </span>

            {sakhi.languages && sakhi.languages.length > 0 && (
              <span className="text-[10px] text-pink-300/70 font-medium">
                • {sakhi.languages[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: 2 Action Buttons (Chat & Voice Call) */}
      <div className="flex items-center gap-2.5 pt-1">
        {/* Left: Chat Outline Button */}
        <button
          type="button"
          onClick={() => openDirectChat(sakhi)}
          className="flex-1 py-2.5 px-3 rounded-2xl border border-pink-500/30 hover:border-pink-400 bg-white/5 hover:bg-white/10 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
          title={isHostViewer ? 'Free Chat (Host Account)' : 'Direct Chat'}
        >
          <MessageCircle className="w-4 h-4 text-pink-400" />
          <span>{isHostViewer ? 'Chat (Free)' : 'Chat'}</span>
        </button>

        {/* Right: Voice Call Primary Pill Button */}
        <button
          type="button"
          onClick={() => startCall(sakhi, 'voice')}
          className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-pink-600 hover:from-purple-600 hover:to-pink-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 transition-all active:scale-95"
          title={isHostViewer ? 'Free Voice Call (Host Account)' : 'Live Voice Call (₹7.00/min)'}
        >
          <Coins className="w-4 h-4 text-amber-300" />
          <span>{isHostViewer ? 'Free Call' : '₹7/min'}</span>
          <Phone className="w-4 h-4 text-white" />
        </button>

        {/* Optional Video Call Icon Button */}
        <button
          type="button"
          onClick={() => startCall(sakhi, 'video')}
          className="p-2.5 rounded-2xl bg-pink-600/30 hover:bg-pink-600/50 border border-pink-500/40 text-pink-300 hover:text-white transition-all active:scale-95 flex items-center gap-1"
          title={isHostViewer ? 'Free Video Call (Host Account)' : 'Video Call (₹15.00/min)'}
        >
          <Video className="w-4 h-4" />
          <span className="text-[10px] font-bold sm:inline">{isHostViewer ? 'Free' : '₹15'}</span>
        </button>
      </div>
    </div>
  );
};
