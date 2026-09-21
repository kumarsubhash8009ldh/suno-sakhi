import React, { useState } from 'react';
import { X, Gift, Share2, Copy, Check, MessageCircle, Sparkles, Coins, Users, Send } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getMyReferralCode, getReferralShareUrl, REFERRAL_BONUS_COINS } from '../services/referralSync';
import { getCurrentUser } from '../services/userAuthSync';
import { useWallet } from '../context/WalletContext';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [bonusToast, setBonusToast] = useState<string | null>(null);
  const { claimShareBonus } = useWallet();

  if (!isOpen) return null;

  const currentUser = getCurrentUser();
  const refCode = getMyReferralCode(currentUser?.phone);
  const shareUrl = getReferralShareUrl(refCode);

  const shareText = `🌸 SunoSakhi App par verified sakhis ke sath friendly voice aur video baatein karein! Yahan se direct download karein aur judiye: ${shareUrl}`;

  const triggerBonusAndConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    const res = claimShareBonus();
    if (res.message) {
      setBonusToast(res.message);
      setTimeout(() => setBonusToast(null), 4500);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    triggerBonusAndConfetti();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    triggerBonusAndConfetti();
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Suno Sakhi - Official App',
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (e) {
        // User cancelled or not supported
      }
    }
    handleWhatsAppShare();
  };

  const handleWhatsAppShare = () => {
    triggerBonusAndConfetti();
    const encoded = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1b0a2a] via-[#130720] to-[#0a0312] border border-amber-500/40 shadow-2xl p-5 sm:p-6 text-white overflow-hidden max-h-[92vh] flex flex-col">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30 animate-pulse">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-1.5">
                Share Link & Get ₹{REFERRAL_BONUS_COINS} Coins
              </h3>
              <p className="text-[11px] text-amber-300">Invite Friends • Daily Free Coins</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bonus Toast Notification */}
        {bonusToast && (
          <div className="mt-3 p-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-300">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-300 animate-spin" />
            <span>{bonusToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-4">
          {/* Big Reward Badge */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-pink-500/20 border border-amber-500/40 text-center relative overflow-hidden">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Coins className="w-6 h-6 text-amber-400 animate-bounce" />
              <span className="text-3xl font-black text-amber-300 tracking-tight">
                ₹{REFERRAL_BONUS_COINS}
              </span>
              <span className="text-sm font-bold text-amber-200 uppercase">Coins Free</span>
            </div>
            <p className="text-xs text-amber-100/90 leading-relaxed font-medium">
              Link share karne par instant <strong>₹50 Free Coins</strong> aur dost ke judne par unlimited <strong>₹50 Coins Bonus</strong> paayein!
            </p>
          </div>

          {/* Referral Code Box */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Aapka Referral Code</label>
            <div className="flex items-center justify-between p-3 rounded-2xl bg-black/60 border border-amber-500/30">
              <span className="text-base font-extrabold font-mono tracking-widest text-amber-400">
                {refCode}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Big Native Share Button (WhatsApp / Apps) */}
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-amber-900/50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Share2 className="w-4 h-4 text-white animate-pulse" />
            <span>📲 Share Link Now (Claim ₹50 Coins)</span>
          </button>

          {/* 1-Click WhatsApp Share Button */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold text-xs sm:text-sm shadow-lg shadow-[#25D366]/30 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-black text-[#25D366]" />
            <span>WhatsApp Par Share Karein (Instant ₹50 Coins)</span>
          </button>

          {/* Copy Full Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all border border-white/20 active:scale-95"
          >
            <Copy className="w-4 h-4 text-pink-300" />
            <span>{copied ? '✅ Link Copied! (₹50 Credited)' : '📋 Copy Shareable Link'}</span>
          </button>

          {/* 3 Step Guide */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
            <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Kaise Kaam Karta Hai?</span>
            </h4>
            <div className="space-y-2 text-[11px] text-gray-300">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                  1
                </span>
                <span>Dost ko apna download link WhatsApp ya Social Media par share karein.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                  2
                </span>
                <span>Dost link se app register karega (Mobile + OTP se).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                  3
                </span>
                <span>Jaise hi dost pehli baar wallet me cash add karega, aapke account me <strong>₹{REFERRAL_BONUS_COINS} Coins</strong> automatic credit ho jayenge!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
