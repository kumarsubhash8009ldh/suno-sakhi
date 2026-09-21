import React from 'react';
import { PhoneCall, Video, Heart, ShieldCheck, Sparkles, Mic, Download, Gift, Crown } from 'lucide-react';
import { Sakhi } from '../types';

interface HeroBannerProps {
  onQuickCall: () => void;
  onOpenReferral?: () => void;
  onOpenHostSlide?: () => void;
  onOpenApkGuide?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onQuickCall, onOpenReferral, onOpenHostSlide, onOpenApkGuide }) => {
  return (
    <div className="relative overflow-hidden rounded-3xl mx-4 sm:mx-6 my-4 bg-gradient-to-br from-[#1c0d2e] via-[#150a24] to-[#0d0617] border border-pink-500/30 p-4 sm:p-8 shadow-2xl shadow-purple-950/50">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-pink-600/15 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-purple-600/15 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left column: Branding & Pricing */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
            <span>Kuch Khaas Log Yahin Milte Hain...</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Dil Se Baat Sirf <br />
            <span className="bg-gradient-to-r from-pink-400 via-rose-300 to-purple-400 bg-clip-text text-transparent underline decoration-pink-500/40 decoration-wavy">
              SunoSakhi
            </span>{' '}
            Ke Saath ❤️
          </h1>

          <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-xl">
            Jab mann udas ho, ya koi apna baat sunne wala chahiye—humare verified Sakhis hamesha aapke saath hain. Instant 1-on-1 private voice aur video calls, bilkul transparent pricing ke saath.
          </p>

          {/* Pricing Highlight Badges */}
          <div className="grid grid-cols-2 gap-3 my-2 max-w-md">
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-[#281340]/90 to-[#1b0d2c]/90 border border-pink-500/30 shadow-lg">
              <div className="flex items-center gap-2 text-pink-400 mb-1">
                <Mic className="w-4 h-4" />
                <span className="text-xs uppercase font-bold tracking-wider">Voice Call</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-white">₹5</span>
                <span className="text-xs text-pink-200/80 font-medium">/ minute</span>
              </div>
              <p className="text-[11px] text-pink-300/60 mt-0.5">Talk Freely & Privately</p>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-[#35154c]/90 to-[#220d33]/90 border border-purple-500/30 shadow-lg">
              <div className="flex items-center gap-2 text-purple-300 mb-1">
                <Video className="w-4 h-4" />
                <span className="text-xs uppercase font-bold tracking-wider">Video Call</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-white">₹10</span>
                <span className="text-xs text-purple-200/80 font-medium">/ minute</span>
              </div>
              <p className="text-[11px] text-purple-300/60 mt-0.5">Face-to-Face Live Chat</p>
            </div>
          </div>

          {/* Action CTAs: Quick Connect & Download Android App */}
          <div className="flex flex-wrap items-center gap-3 my-1">
            <button
              onClick={onQuickCall}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-pink-600/30 flex items-center gap-2 transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Choose Your Sakhi</span>
            </button>
            <a
              href="https://clause-spencer-mill-searching.trycloudflare.com/suno-sakhi.apk"
              download="suno-sakhi.apk"
              onClick={() => {
                if (onOpenApkGuide) onOpenApkGuide();
              }}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-pink-900/50 flex items-center gap-2 transition-all hover:scale-105 border border-pink-400/30"
            >
              <Download className="w-4 h-4 text-pink-200" />
              <span>Download SunoSakhi APK</span>
            </a>
            {onOpenReferral && (
              <button
                type="button"
                onClick={onOpenReferral}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-900/40 flex items-center gap-1.5 transition-all animate-pulse"
              >
                <Gift className="w-4 h-4 text-amber-200" />
                <span>🎁 Share Link & Earn ₹50 Coins</span>
              </button>
            )}
            {onOpenHostSlide && (
              <button
                type="button"
                onClick={onOpenHostSlide}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 hover:from-amber-400 hover:to-pink-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-pink-900/50 flex items-center gap-1.5 transition-all border border-amber-300/50 hover:scale-105 active:scale-95 animate-pulse"
              >
                <Crown className="w-4 h-4 text-amber-200" />
                <span>🌸 Host Banein (60% Share)</span>
              </button>
            )}
          </div>

          {/* Key Trust Badges */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300 pt-1">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Private & Anonymous</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
              <span>No Judgements, Only Love ♡</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400 font-bold">★ 4.9/5</span>
              <span>10,000+ Happy Callers</span>
            </div>
          </div>
        </div>

        {/* Right column: Official Poster Showcase */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative group max-w-sm w-full">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-3xl blur-lg opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-slow"></div>
            <div className="relative overflow-hidden rounded-2xl border border-pink-400/40 bg-black aspect-square shadow-2xl">
              <img
                src="/suno-sakhi-banner.jpg"
                alt="SunoSakhi - Voice Connects Hearts"
                className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-4">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500 text-white uppercase tracking-wider">
                    Official SunoSakhi Poster
                  </span>
                  <p className="text-white font-bold text-sm mt-1">
                    SunoSakhi • Voice Connects Hearts ♡
                  </p>
                  <p className="text-[11px] text-pink-300 italic mt-0.5">
                    New Friends • New Stories • Same You... SunoSakhi ♡
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
