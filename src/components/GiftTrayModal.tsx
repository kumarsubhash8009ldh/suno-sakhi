import React, { useState } from 'react';
import { X, Gift, Sparkles, Wallet, Heart } from 'lucide-react';
import { GIFTS_CATALOG } from '../data/gifts';
import { GiftItem } from '../types';
import { useHost } from '../context/HostContext';
import { useWallet } from '../context/WalletContext';

export const GiftTrayModal: React.FC = () => {
  const { isGiftTrayOpen, closeGiftTray, sendGift, hostProfile } = useHost();
  const { balance } = useWallet();
  const [selectedGift, setSelectedGift] = useState<GiftItem>(GIFTS_CATALOG[2]); // Teddy default
  const [comboCount, setComboCount] = useState<number>(0);

  if (!isGiftTrayOpen) return null;

  const handleSend = (gift: GiftItem) => {
    const success = sendGift(gift);
    if (success) {
      setComboCount((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-gradient-to-b from-[#1c0c2e] via-[#140822] to-[#0d0517] border-t sm:border border-pink-500/30 shadow-2xl p-5 text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                Send Live Gift to Sakhi
                <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
              </h3>
              <p className="text-[11px] text-pink-300/80">
                Host earns direct income on each gift sent!
              </p>
            </div>
          </div>
          <button
            onClick={closeGiftTray}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance bar */}
        <div className="flex items-center justify-between py-2 px-3 my-3 rounded-xl bg-black/40 border border-white/5 text-xs">
          <span className="text-gray-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-pink-400" />
            Your Balance: <strong className="text-white">₹{((balance ?? 0) || 0).toFixed(2)}</strong>
          </span>
          {comboCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-extrabold text-[11px] animate-pulse">
              🔥 x{comboCount} Combo!
            </span>
          )}
        </div>

        {/* Gifts Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5 my-2 max-h-64 overflow-y-auto pr-1">
          {GIFTS_CATALOG.map((gift) => {
            const isSelected = selectedGift.id === gift.id;
            return (
              <button
                key={gift.id}
                onClick={() => setSelectedGift(gift)}
                className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-pink-600/20 border-pink-500 shadow-lg shadow-pink-600/30 scale-105'
                    : 'bg-[#150926] border-white/5 hover:border-pink-500/30 hover:bg-[#200e3a]'
                }`}
              >
                <span className="text-3xl filter drop-shadow-md mb-1">{gift.icon}</span>
                <span className="text-[11px] font-bold text-white truncate max-w-[70px]">
                  {gift.name}
                </span>
                <span className="text-[10px] font-extrabold text-pink-300 mt-0.5">
                  ₹{gift.price}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-2 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="text-left">
            <span className="text-[10px] text-gray-400 block">Selected Gift</span>
            <span className="text-sm font-bold text-white flex items-center gap-1">
              <span>{selectedGift.icon}</span>
              <span>{selectedGift.name} (₹{selectedGift.price})</span>
            </span>
          </div>

          <button
            onClick={() => handleSend(selectedGift)}
            className="flex-1 max-w-[180px] py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-pink-900/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Send Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
