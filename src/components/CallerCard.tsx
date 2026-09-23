import React from 'react';
import { Phone, Video, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { UserAccount } from '../services/userAuthSync';
import { Sakhi } from '../types';
import { useCall } from '../context/CallContext';
import { useHost } from '../context/HostContext';

interface CallerCardProps {
  caller: UserAccount;
}

export const CallerCard: React.FC<CallerCardProps> = ({ caller }) => {
  const { startCall } = useCall();
  const { openDirectChat } = useHost();

  const cleanPhone = String(caller.phone || '').replace(/\D/g, '');
  const callerName = caller.name?.trim() || `Caller ${cleanPhone.slice(-4)}`;
  const avatarUrl =
    caller.avatar ||
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';

  // Convert caller into Sakhi structure so startCall and openDirectChat work seamlessly
  const callerAsSakhi: Sakhi = {
    id: caller.id || `caller-${cleanPhone}`,
    name: callerName,
    age: 24,
    city: 'India',
    avatar: avatarUrl,
    videoPoster: avatarUrl,
    status: 'online',
    rating: 5.0,
    totalCalls: 1,
    languages: ['Hindi'],
    bio: 'Dil Se Baat • Registered Caller',
    interests: ['Friendly Chat', 'Life Talk'],
    voiceRatePerMin: 5,
    videoRatePerMin: 10,
    audioSnippet: '',
    tagline: 'Registered Caller',
    phone: cleanPhone
  };

  return (
    <div className="relative rounded-3xl bg-gradient-to-r from-[#170a2c]/90 via-[#1f0d38]/80 to-[#10061f]/90 border border-pink-500/30 p-4 sm:p-5 shadow-xl hover:border-pink-500/60 transition-all group">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Caller Details */}
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 flex-shrink-0 shadow-lg shadow-pink-900/40">
            <img
              src={avatarUrl}
              alt={callerName}
              className="w-full h-full object-cover rounded-[14px]"
            />
            {/* Online Green Indicator */}
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#170a2c] animate-pulse"
              title="Caller Online"
            ></span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-white truncate">
                {callerName}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Active Caller</span>
              </span>
            </div>

            <p className="text-xs text-pink-300/90 font-mono mt-0.5 flex items-center gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">ID:</span>
              <span className="font-bold">{caller.id || `caller-${cleanPhone.slice(-4)}`}</span>
            </p>

            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Account</span>
              </span>
              <span>•</span>
              <span className="text-purple-300">Host Free Access (₹0)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Free Voice Call, Free Video Call, Free Chat for Host */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* 1. Voice Call Button */}
          <button
            onClick={() => startCall(callerAsSakhi, 'voice')}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-lg shadow-pink-900/40 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Free Voice Call to Caller (₹0 Charges for Host)"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Voice Call</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white font-bold ml-0.5">
              Free
            </span>
          </button>

          {/* 2. Video Call Button */}
          <button
            onClick={() => startCall(callerAsSakhi, 'video')}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-900/40 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Free Video Call to Caller (₹0 Charges for Host)"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Call</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white font-bold ml-0.5">
              Free
            </span>
          </button>

          {/* 3. Direct Chat Button */}
          <button
            onClick={() => openDirectChat(callerAsSakhi)}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            title="Free Direct Chat with Caller (₹0 Charges for Host)"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chat</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white font-bold ml-0.5">
              Free
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
