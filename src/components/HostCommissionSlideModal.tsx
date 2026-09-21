import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Crown,
  Coins,
  ShieldCheck,
  Phone,
  Video,
  Clock,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  Zap,
  Lock
} from 'lucide-react';

interface HostCommissionSlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBecomeHost: () => void;
}

export const HostCommissionSlideModal: React.FC<HostCommissionSlideModalProps> = ({
  isOpen,
  onClose,
  onBecomeHost
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      tag: '🔥 FLAT 60% DIRECT COMMISSION',
      tagColor: 'from-amber-500 to-orange-500 text-white',
      title: '🌸 SunoSakhi Par Host Banein - 60% Direct Kamai!',
      slogan: 'Apne Ghar Baithe Aawaz Se Kamayein ₹30,000 se ₹75,000 Har Mahine!',
      description: 'Host ladkiyon ke liye 100% FREE Registration (₹0 Fees). Dil khol kar baatein karein aur har minute ka direct cash share paayein.',
      rates: [
        { icon: <Phone className="w-4 h-4 text-pink-400" />, label: 'Voice Call', rate: '₹3.00 / min', sub: 'Caller rate ₹5 (60% Share)' },
        { icon: <Video className="w-4 h-4 text-purple-400" />, label: 'Video Call', rate: '₹6.00 / min', sub: 'Caller rate ₹10 (60% Share)' },
        { icon: <Coins className="w-4 h-4 text-amber-400" />, label: 'Chat & Gifts', rate: '₹1.20 / msg + 60%', sub: 'Direct Cash Commission' }
      ],
      highlight: '💰 Daily Potential: 2 ghante call = ₹700 - ₹1,500 daily earning!'
    },
    {
      id: 2,
      tag: '🛡️ 100% PRIVATE & ZERO RISK',
      tagColor: 'from-emerald-500 to-teal-500 text-black',
      title: 'Aapki Suraksha & Privacy Humari Sabse Badi Priority!',
      slogan: 'Personal Phone Number Kabhi Kisi Caller Ko Show Nahi Hota!',
      description: 'Bina kisi jhijhak ya darr ke kaam karein. Full respect, safety aur verified community ke sath reliable platform.',
      points: [
        '🔒 Anonymous Calling: Caller ko sirf aapka screen name aur avatar dikhta hai.',
        '🚫 Single-Tap Block & Instant Report kisi bhi unwanted caller ke liye.',
        '🌸 Only Verified Male Callers ko connect kiya jata hai balance ke sath.',
        '✨ Koi personal details ya address share karne ki zarurat nahi.'
      ],
      highlight: '👑 Izzat aur safety ke sath secure work-from-home'
    },
    {
      id: 3,
      tag: '⏰ APNA TIME, APNI MARZI',
      tagColor: 'from-pink-500 to-rose-600 text-white',
      title: 'Koi Boss Nahi, Koi Fixed Target Nahi - Azaadi Se Kaam Karein!',
      slogan: 'Jab Dil Chahe Online Aayein, Jab Dil Chahe Offline Jayein!',
      description: 'College students, housewives ya working women—apne free time ko banayein daily guaranteed income source.',
      points: [
        '🎯 Zero Daily Target, Zero Monthly Target—Full Flexibility!',
        '📱 Sirf ek normal Android/iPhone smartphone aur Internet chahiye.',
        '🛋️ Ghar par baith kar aaram se voice ya video calls receive karein.',
        '🌸 Part-time ya full-time—jitna time utna zyada direct commission!'
      ],
      highlight: '⚡ Apne schedule ke maalik khud banein!'
    },
    {
      id: 4,
      tag: '⚡ ROZANA INSTANT PAYOUT',
      tagColor: 'from-purple-500 to-indigo-600 text-white',
      title: 'Rozana Kamai, Rozana Direct Bank / UPI Mein Payout!',
      slogan: 'Aaj Ki Kamai Aaj Hi Apne UPI (PhonePe / GPay / Paytm) Mein Payein!',
      description: 'Call khatam hote hi commission aapke wallet balance mein live add hoti hai aur minimum ₹100 hote hi turant withdraw ho sakti hai.',
      points: [
        '⚡ Instant UPI Transfer: PhonePe, Google Pay, Paytm ya Bank Account.',
        '💵 Minimum ₹100 se direct withdrawal shuru.',
        '📊 Real-Time Dashboard: Har call ki second-by-second kamai live dekhein.',
        '💯 0% Platform Deduction on Payouts—60% Poora Aapka Haq!'
      ],
      highlight: '🚀 Same-day bank credit with zero delays'
    }
  ];

  // Auto-rotate slides every 4.2 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [isOpen, slides.length]);

  if (!isOpen) return null;

  const current = slides[currentSlide];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-t-[36px] sm:rounded-[36px] bg-gradient-to-b from-[#2a0b3b] via-[#1a0525] to-[#0d0214] border-t-2 sm:border-2 border-pink-500/60 p-5 sm:p-7 text-white shadow-2xl shadow-pink-900/60 flex flex-col max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
      >
        {/* Glowing Background Orbs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-pink-600/25 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-purple-600/25 blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-gradient-to-r ${current.tagColor} shadow-md uppercase tracking-wider`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{current.tag}</span>
          </span>
          <span className="text-[11px] font-bold text-pink-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-pink-400" />
            <span>Free Host ID</span>
          </span>
        </div>

        {/* Slide Title & Punchline */}
        <div className="space-y-1.5 mb-4">
          <h2 className="text-xl sm:text-2xl font-black text-white leading-snug tracking-tight">
            {current.title}
          </h2>
          <p className="text-sm font-extrabold bg-gradient-to-r from-amber-300 via-pink-300 to-rose-400 bg-clip-text text-transparent">
            {current.slogan}
          </p>
          <p className="text-xs text-gray-300 leading-relaxed pt-1">
            {current.description}
          </p>
        </div>

        {/* Slide Content Box */}
        <div className="rounded-2xl bg-black/40 border border-pink-500/30 p-4 mb-4 backdrop-blur-sm shadow-inner">
          {/* If Slide 1: Show 3 Rate Cards */}
          {current.rates && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
              {current.rates.map((r, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-gradient-to-b from-white/10 to-white/5 border border-pink-500/30 flex flex-col items-center text-center shadow"
                >
                  <div className="p-1.5 rounded-lg bg-black/50 mb-1">{r.icon}</div>
                  <span className="text-[11px] font-bold text-gray-300">{r.label}</span>
                  <span className="text-base font-black text-emerald-400">{r.rate}</span>
                  <span className="text-[10px] text-pink-300/80">{r.sub}</span>
                </div>
              ))}
            </div>
          )}

          {/* If Slide 2, 3, 4: Show Bullet Points */}
          {current.points && (
            <div className="space-y-2 mb-2">
              {current.points.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-gray-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{pt}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Highlight Strip */}
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>{current.highlight}</span>
            </span>
          </div>
        </div>

        {/* Carousel Slide Indicators (Dots & Navigation) */}
        <div className="flex items-center justify-between px-2 mb-4">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all rounded-full ${
                  currentSlide === idx
                    ? 'w-6 h-2 bg-gradient-to-r from-pink-500 to-purple-500'
                    : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                }`}
                title={`Slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Next Slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Primary High-Conversion CTA */}
          <button
            onClick={() => {
              onClose();
              onBecomeHost();
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-sm sm:text-base shadow-xl shadow-pink-600/50 flex items-center justify-center gap-2 transform active:scale-98 transition-all hover:scale-[1.02] border border-pink-300/40 animate-pulse"
          >
            <Crown className="w-5 h-5 text-amber-300" />
            <span>🌸 Abhi Host Banein - 60% Kamai Shuru Karein</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Secondary Dismiss */}
          <div className="flex items-center justify-between px-2 pt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Free • ₹0 Joining Fee</span>
            </span>
            <button
              onClick={onClose}
              className="hover:underline text-gray-400 hover:text-white"
            >
              Baad Mein Dekhein
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Floating trigger button for opening the 60% Commission Slide Popup anytime
 */
export const HostRecruitmentPill: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 text-white font-black text-xs shadow-2xl shadow-pink-900/60 border-2 border-amber-300/80 hover:scale-105 active:scale-95 transition-all animate-bounce duration-1000"
      title="Host Banein - 60% Commission Payein"
    >
      <Crown className="w-4 h-4 text-amber-300 animate-spin-slow" />
      <span className="tracking-tight">Host Banein • 60% Commission</span>
      <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] text-amber-300 uppercase">
        Join Free
      </span>
    </button>
  );
};
