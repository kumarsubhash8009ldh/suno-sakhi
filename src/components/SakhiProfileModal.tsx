import React, { useState } from 'react';
import {
  X,
  Phone,
  Video,
  MessageCircle,
  Heart,
  ShieldCheck,
  MapPin,
  Globe,
  Sparkles,
  Flag,
  Ban,
  CheckCircle2
} from 'lucide-react';
import { Sakhi } from '../types';
import { useCall } from '../context/CallContext';
import { useHost } from '../context/HostContext';
import { useAdmin } from '../context/AdminContext';
import { getActiveSession } from '../services/userAuthSync';
import { formatHostId } from '../utils/idFormatter';
import { blockUser, unblockUser, isUserBlocked, submitSafetyReport } from '../services/safetyService';

interface SakhiProfileModalProps {
  sakhi: Sakhi | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (sakhiId: string) => void;
}

export const SakhiProfileModal: React.FC<SakhiProfileModalProps> = ({
  sakhi,
  onClose,
  isFavorite,
  onToggleFavorite
}) => {
  const { startCall } = useCall();
  const { openDirectChat, isHostLoggedIn, hostProfile, userRole } = useHost();
  const { settings } = useAdmin();
  const session = getActiveSession();

  const [blocked, setBlocked] = useState<boolean>(() => (sakhi ? isUserBlocked(sakhi.id) : false));
  const [reportOpen, setReportOpen] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('Inappropriate behavior / Fake profile');
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  if (!sakhi) return null;

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
  const isBusy = sakhi.status === 'busy';
  const hostDisplayId = formatHostId(sakhi.id, sakhi.phone);

  const handleToggleBlock = () => {
    if (blocked) {
      unblockUser(sakhi.id);
      setBlocked(false);
    } else {
      if (window.confirm(`Kya aap ${sakhi.name} ko block karna chahte hain?`)) {
        blockUser(sakhi.id);
        setBlocked(true);
      }
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitSafetyReport({
      reporterId: session.id || session.phone || 'anonymous',
      targetId: sakhi.id,
      targetName: sakhi.name,
      reason: reportReason
    });
    setReportOpen(false);
    setReportSuccess('✅ Report submit ho gayi hai. Humari Trust & Safety team iski jaanch karegi.');
    setTimeout(() => setReportSuccess(null), 4000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-[#160a29] border border-pink-500/40 shadow-2xl overflow-hidden text-white max-h-[92vh] flex flex-col"
      >
        {/* Hero Image Header */}
        <div className="relative h-56 sm:h-64 w-full bg-[#241040] overflow-hidden flex-shrink-0">
          <img
            src={sakhi.videoPoster || sakhi.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'}
            alt={sakhi.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#160a29] via-[#160a29]/40 to-black/30" />

          {/* Top Bar Controls */}
          <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between z-10">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                isOnline
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                  : isBusy
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                  : 'bg-red-950/80 text-red-300 border-red-500/50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-500 animate-pulse' : isBusy ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span>{isOnline ? '🟢 Online' : isBusy ? '🟡 Busy on Call' : '🔴 Offline'}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleFavorite(sakhi.id)}
                className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                  isFavorite
                    ? 'bg-pink-600 text-white border-pink-400 shadow-lg shadow-pink-600/50'
                    : 'bg-black/50 text-white/80 hover:text-white border-white/20'
                }`}
                title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Name & Verified Info Overlay */}
          <div className="absolute bottom-3 inset-x-4 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-white">{sakhi.name}</h2>
                <span className="text-sm text-pink-200 font-semibold">({sakhi.age} yrs)</span>
                {sakhi.isVerified !== false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" /> Verified Host
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-pink-200/90 mt-1">
                <span className="px-2 py-0.5 rounded bg-pink-600/30 border border-pink-500/40 font-mono text-[11px] font-bold text-pink-200">
                  Host ID: {hostDisplayId}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-pink-400" />
                  {sakhi.city || 'India'}
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-1">
              <span>★</span>
              <span>{(sakhi.rating || 5.0).toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {reportSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{reportSuccess}</span>
            </div>
          )}

          {/* Bio */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300/80 block mb-1">
              About {sakhi.name}
            </span>
            <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">
              {sakhi.bio || 'Namaste! Main SunoSakhi par aapse dil se baat karne ke liye available hoon.'}
            </p>
          </div>

          {/* Languages & Interests */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-1.5">
                <Globe className="w-3 h-3 text-pink-400" /> Languages
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(sakhi.languages && sakhi.languages.length > 0 ? sakhi.languages : ['Hindi', 'English']).map((lang) => (
                  <span
                    key={lang}
                    className="px-2.5 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-200 text-[11px] font-semibold"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-purple-400" /> Interests
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(sakhi.interests && sakhi.interests.length > 0 ? sakhi.interests : ['Friendly Chat', 'Music']).map((interest) => (
                  <span
                    key={interest}
                    className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[11px] font-semibold"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Transparent Pricing Breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/25">
              <Phone className="w-4 h-4 text-pink-400 mx-auto mb-1" />
              <span className="text-[10px] text-gray-300 block">Voice Call</span>
              <span className="text-xs font-black text-white font-mono">
                {isHostViewer ? 'FREE' : `₹${voiceRate}/min`}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/25">
              <Video className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <span className="text-[10px] text-gray-300 block">Video Call</span>
              <span className="text-xs font-black text-white font-mono">
                {isHostViewer ? 'FREE' : `₹${videoRate}/min`}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/25">
              <MessageCircle className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <span className="text-[10px] text-gray-300 block">Direct Chat</span>
              <span className="text-xs font-black text-white font-mono">
                {isHostViewer ? 'FREE' : `₹${chatRate}/msg`}
              </span>
            </div>
          </div>

          {/* Primary Call & Chat Actions */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                openDirectChat(sakhi);
              }}
              className="py-3 px-3 rounded-2xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/40 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4 text-blue-400" />
              <span>Chat</span>
            </button>

            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                onClose();
                startCall(sakhi, 'voice');
              }}
              className="py-3 px-3 rounded-2xl bg-gradient-to-r from-purple-700 to-pink-600 hover:from-purple-600 hover:to-pink-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"
            >
              <Phone className="w-4 h-4" />
              <span>Voice Call</span>
            </button>

            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                onClose();
                startCall(sakhi, 'video');
              }}
              className="py-3 px-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"
            >
              <Video className="w-4 h-4" />
              <span>Video Call</span>
            </button>
          </div>

          {/* Safety Controls: Block & Report */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
            <button
              type="button"
              onClick={handleToggleBlock}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                blocked
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'hover:bg-white/5 hover:text-white border-transparent'
              }`}
            >
              <Ban className="w-3.5 h-3.5 text-red-400" />
              <span>{blocked ? 'Unblock User' : 'Block User'}</span>
            </button>

            <button
              type="button"
              onClick={() => setReportOpen(!reportOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/5 hover:text-amber-300 transition-all"
            >
              <Flag className="w-3.5 h-3.5 text-amber-400" />
              <span>Report Profile</span>
            </button>
          </div>

          {reportOpen && (
            <form onSubmit={handleReportSubmit} className="p-3 rounded-2xl bg-black/60 border border-amber-500/30 space-y-2.5">
              <label className="text-[11px] font-bold text-amber-300 block">
                Report Reason Chunein:
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#1a0b2e] border border-amber-500/30 text-white text-xs"
              >
                <option value="Inappropriate behavior / Abusive language">Inappropriate behavior / Abusive language</option>
                <option value="Fake profile / Impersonation">Fake profile / Impersonation</option>
                <option value="Asking for off-platform payments / Scam">Asking for off-platform payments / Scam</option>
                <option value="Nudity / Explicit content violation">Nudity / Explicit content violation</option>
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  Submit Report
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
