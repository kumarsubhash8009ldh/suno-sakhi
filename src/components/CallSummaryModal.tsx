import React, { useState } from 'react';
import { Star, CheckCircle, Clock, Heart, AlertCircle, Sparkles } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { useActiveSession } from '../services/userAuthSync';

export const CallSummaryModal: React.FC = () => {
  const { lastSummary, isSummaryOpen, closeSummary, endReason } = useCall();
  const { balance } = useWallet();
  const { isHostLoggedIn, hostProfile, userRole } = useHost();
  const session = useActiveSession();
  const [rating, setRating] = useState<number>(5);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  const isHost = Boolean(
    session.role === 'host' ||
    userRole === 'host' ||
    isHostLoggedIn ||
    localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
    localStorage.getItem('sunosakhi_active_role') === 'host' ||
    (hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10)
  );

  if (!isSummaryOpen || !lastSummary) return null;

  const mins = Math.floor(lastSummary.durationSeconds / 60);
  const secs = lastSummary.durationSeconds % 60;
  const timeFormatted = `${mins}m ${secs}s`;

  const handleSubmit = () => {
    setFeedbackSubmitted(true);
    setTimeout(() => {
      closeSummary();
      setFeedbackSubmitted(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1b0d2e] via-[#150a24] to-[#0c0515] border border-pink-500/40 shadow-2xl p-6 text-white text-center">
        {/* Top Companion Avatar */}
        <div className="relative mx-auto w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-pink-500 to-purple-600 shadow-xl shadow-pink-600/40 -mt-10">
          <img
            src={lastSummary.sakhi.avatar}
            alt={lastSummary.sakhi.name}
            className="w-full h-full rounded-full object-cover"
          />
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-pink-500 text-white shadow">
            <Heart className="w-3.5 h-3.5 fill-white" />
          </div>
        </div>

        {/* Low balance indicator message */}
        {endReason === 'insufficient_balance' && (
          <div className="mt-4 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 justify-center">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Balance khatam hone par call disconnect hui.</span>
          </div>
        )}

        <h3 className="text-xl font-bold mt-3">Call Summary</h3>
        <p className="text-xs text-pink-300 font-medium">
          {lastSummary.type === 'voice' ? '🎙️ Live Voice Call' : '📹 Live Video Call'} with {lastSummary.sakhi.name}
        </p>

        {/* Stats Grid */}
        <div className={`grid grid-cols-2 gap-3 my-4 p-3.5 rounded-2xl bg-black/40 border ${isHost ? 'border-emerald-500/30' : 'border-white/5'} text-left`}>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Duration</span>
            <div className="flex items-center gap-1 text-sm font-bold text-white mt-0.5">
              <Clock className="w-3.5 h-3.5 text-pink-400" />
              <span>{timeFormatted}</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">{isHost ? 'Host Rate' : 'Applied Rate'}</span>
            <span className={`text-sm font-bold mt-0.5 block ${isHost ? 'text-emerald-300' : 'text-pink-300'}`}>
              {isHost ? '₹0/min (FREE)' : `₹${lastSummary.ratePerMin}/min`}
            </span>
          </div>
          <div className="col-span-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                {isHost ? 'Host Call Charges' : 'Total Deducted'}
              </span>
              <span className={`text-lg font-black ${isHost ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isHost ? '₹0.00 (Zero Charges)' : `-₹${((lastSummary?.totalCost ?? 0) || 0).toFixed(2)}`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                {isHost ? 'Account Status' : 'Remaining Balance'}
              </span>
              {isHost ? (
                <span className="text-xs font-bold text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 inline-block mt-1">
                  100% Free Host
                </span>
              ) : (
                <span className="text-sm font-bold text-emerald-400">
                  ₹{((balance ?? 0) || 0).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating Stars */}
        <div className="my-3">
          <p className="text-xs text-gray-300 mb-2">Aapko baat karke kaisa laga?</p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="p-1 text-yellow-400 hover:scale-125 transition-transform"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          className="w-full mt-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-pink-900/40 transition-all flex items-center justify-center gap-1.5"
        >
          {feedbackSubmitted ? (
            <>
              <CheckCircle className="w-4 h-4 text-white" />
              <span>Thank You!</span>
            </>
          ) : (
            <span>Continue</span>
          )}
        </button>
      </div>
    </div>
  );
};
