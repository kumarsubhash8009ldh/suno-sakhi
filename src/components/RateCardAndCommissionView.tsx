import React, { useState } from 'react';
import { Phone, Video, MessageCircle, Gift, TrendingUp, ShieldCheck, ArrowRight, Zap } from 'lucide-react';
import { useHost } from '../context/HostContext';
import { useWallet } from '../context/WalletContext';

interface RateCardAndCommissionViewProps {
  onExploreSakhis: () => void;
  onOpenAuth?: (focus?: 'user' | 'host') => void;
}

export const RateCardAndCommissionView: React.FC<RateCardAndCommissionViewProps> = ({
  onExploreSakhis,
  onOpenAuth
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'rates' | 'commission'>('all');
  const { isHostLoggedIn, openLoginModal } = useHost();
  const { openWalletModal } = useWallet();

  const GIFTS_LIST = [
    { name: 'Red Rose 🌹', price: 10, hostEarns: 6 },
    { name: 'Sweet Heart 💖', price: 50, hostEarns: 30 },
    { name: 'Teddy Bear 🧸', price: 100, hostEarns: 60 },
    { name: 'Diamond Ring 💎', price: 200, hostEarns: 120 },
    { name: 'Golden Crown 👑', price: 500, hostEarns: 300 }
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold uppercase tracking-wider">
          Transparent Pricing & Earnings
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          🏷️ Rate Card & 💰 Commission Details
        </h2>
        <p className="text-xs sm:text-sm text-gray-400">
          Zero hidden charges. Transparent per-second billing for callers aur verified 60% direct kamai host ladkiyon ke liye.
        </p>

        {/* Host Free & Instant Commission Notice Box */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-pink-950/70 border border-emerald-500/40 text-left flex items-start gap-3 shadow-lg">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>🌸 Girl Host ID Policy: 100% Free (Zero Charges)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase">Free for Host</span>
            </h4>
            <p className="text-[11px] sm:text-xs text-gray-200 leading-relaxed">
              Host ladkiyon ki ID par Messages, Audio Call aur Video Call ka <strong>₹0 charge</strong> lagta hai (100% Free). Callers se milne wali <strong>60% commission sath ke sath</strong> host ke account me live update hoti hai aur UPI/Bank me withdraw ki ja sakti hai!
            </p>
          </div>
        </div>

        {/* Mobile Sub-Tab Switcher */}
        <div className="flex md:hidden items-center justify-center p-1 rounded-2xl bg-black/60 border border-pink-500/30 max-w-xs mx-auto mt-3">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'all'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveSubTab('rates')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'rates'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Rate Card
          </button>
          <button
            onClick={() => setActiveSubTab('commission')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'commission'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            60% Commission
          </button>
        </div>
      </div>

      {/* 2 Main Columns Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* COLUMN 1: CALLER RATE CARD (रेट कार्ड) */}
        {(activeSubTab === 'all' || activeSubTab === 'rates') && (
          <div className="rounded-3xl bg-[#140826]/90 border border-pink-500/30 p-5 sm:p-6 space-y-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-pink-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-pink-600/20 text-pink-400 border border-pink-500/30">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Caller Rate Card</h3>
                    <p className="text-xs text-pink-300/80">Callers ke liye audio, video aur chat dar</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-pink-500/20 text-pink-300 text-[10px] font-black border border-pink-500/30">
                  LIVE RATES
                </span>
              </div>

              {/* Rates List */}
              <div className="space-y-3">
                {/* 1. Voice Call */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-pink-500/20 flex items-center justify-between hover:border-pink-500/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Voice Call</h4>
                      <p className="text-[11px] text-gray-400">1-on-1 Private audio call (per-sec deduction)</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-black text-pink-300">₹5.00</span>
                    <span className="text-[10px] text-gray-400 block">/ minute</span>
                  </div>
                </div>

                {/* 2. Video Call */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/20 flex items-center justify-between hover:border-purple-500/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Video Call</h4>
                      <p className="text-[11px] text-gray-400">HD Private video call with camera switch</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-black text-purple-300">₹10.00</span>
                    <span className="text-[10px] text-gray-400 block">/ minute</span>
                  </div>
                </div>

                {/* 3. Sakhi Chat */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-blue-500/20 flex items-center justify-between hover:border-blue-500/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Sakhi Direct Chat</h4>
                      <p className="text-[11px] text-gray-400">Direct message with online Sakhi (110 words)</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-black text-blue-300">₹2.00</span>
                    <span className="text-[10px] text-gray-400 block">/ message</span>
                  </div>
                </div>
              </div>

              {/* Virtual Gifts Table */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-pink-400" />
                    <span>Live Virtual Gifts Price</span>
                  </span>
                  <span className="text-[10px] text-gray-400">Instant on video call</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {GIFTS_LIST.map((g) => (
                    <div key={g.name} className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                      <span className="text-gray-300 text-[11px]">{g.name}</span>
                      <span className="font-bold text-pink-300">₹{g.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={openWalletModal}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/30 transition-all"
              >
                <span>Wallet Recharge Karein & Baat Shuru Karein</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* COLUMN 2: HOST 60% COMMISSION DETAILS (कमीशन डिटेल्स) */}
        {(activeSubTab === 'all' || activeSubTab === 'commission') && (
          <div className="rounded-3xl bg-[#0b1f1c]/90 border border-emerald-500/30 p-5 sm:p-6 space-y-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Host 60% Commission</h3>
                    <p className="text-xs text-emerald-300/80">Host ladkiyon ke liye direct 60% kamai</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-black font-black text-[10px] uppercase shadow">
                  60% SHARE
                </span>
              </div>

              {/* Commission Calculation Table */}
              <div className="space-y-3">
                {/* 1. Voice Income */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span>Voice Call Income (60%)</span>
                    </h4>
                    <p className="text-[11px] text-gray-400">Total ₹5/min ➔ Host earns ₹3.00/min</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-300">₹3.00</span>
                    <span className="text-[10px] text-gray-400 block">/ min direct</span>
                  </div>
                </div>

                {/* 2. Video Income */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-teal-500/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-teal-400" />
                      <span>Video Call Income (60%)</span>
                    </h4>
                    <p className="text-[11px] text-gray-400">Total ₹10/min ➔ Host earns ₹6.00/min</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-teal-300">₹6.00</span>
                    <span className="text-[10px] text-gray-400 block">/ min direct</span>
                  </div>
                </div>

                {/* 3. Chat Income */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-cyan-500/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-cyan-400" />
                      <span>Chat Message Income (60%)</span>
                    </h4>
                    <p className="text-[11px] text-gray-400">Total ₹2/msg ➔ Host earns ₹1.20/msg</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-cyan-300">₹1.20</span>
                    <span className="text-[10px] text-gray-400 block">/ message</span>
                  </div>
                </div>
              </div>

              {/* Withdrawal Rules & Payout Policy */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Daily UPI & Bank Payout Rules</span>
                </div>
                <ul className="text-[11px] text-gray-300 space-y-1 pl-4 list-disc">
                  <li><strong>Minimum Payout:</strong> Sirf ₹100 kamaane par instant withdrawal request karein.</li>
                  <li><strong>Supported Methods:</strong> PhonePe, Google Pay, Paytm UPI ya direct Bank Account.</li>
                  <li><strong>Admin Release:</strong> Withdrawal request lagte hi UTR number ke sath payment release hota hai.</li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  if (isHostLoggedIn) {
                    onExploreSakhis();
                  } else if (onOpenAuth) {
                    onOpenAuth('host');
                  } else {
                    openLoginModal();
                  }
                }}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
              >
                <span>{isHostLoggedIn ? '🌸 Host Dashboard Kholein' : '🌸 Host Bano & 60% Kamai Shuru Karo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Quick Return */}
      <div className="text-center pt-2">
        <button
          onClick={onExploreSakhis}
          className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all"
        >
          ← Wapas Online Sakhis Par Jayein
        </button>
      </div>
    </div>
  );
};
