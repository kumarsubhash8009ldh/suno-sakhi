import React from 'react';
import { Phone, MessageCircle, Zap, Headphones, User, Crown, Gift } from 'lucide-react';
import { useHost } from '../context/HostContext';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenHelpDesk?: () => void;
  onOpenAuth?: () => void;
  onOpenReferral?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenReferral
}) => {
  const { userRole } = useHost();
  const isHost = userRole === 'host';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-[#10061d]/95 backdrop-blur-xl border-t border-pink-500/20 px-1 py-1.5 shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* 1. All Sakhi (Main Screen) */}
        <button
          onClick={() => {
            onTabChange('sakhis');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-2xl transition-all ${
            currentTab === 'sakhis' ? 'text-pink-400 font-black' : 'text-gray-400 hover:text-white'
          }`}
          title="All Sakhi Main Screen"
        >
          <div className={`p-1 rounded-full ${currentTab === 'sakhis' ? 'bg-pink-500/20 text-pink-400' : ''}`}>
            <Phone className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">{isHost ? 'Callers' : 'All Sakhi'}</span>
        </button>

        {/* 2. Host Studio (Only shown in Host Mode) */}
        {isHost && (
          <button
            onClick={() => onTabChange('host')}
            className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-2xl transition-all ${
              currentTab === 'host' ? 'text-emerald-400 font-black' : 'text-emerald-300/70 hover:text-emerald-300'
            }`}
            title="Host Studio Dashboard"
          >
            <div className={`p-1 rounded-full ${currentTab === 'host' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}>
              <Crown className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Studio</span>
          </button>
        )}

        {/* 3. Chats */}
        <button
          onClick={() => onTabChange('chats')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-2xl transition-all ${
            currentTab === 'chats' ? 'text-pink-400 font-black' : 'text-gray-400 hover:text-white'
          }`}
          title="Direct Chats"
        >
          <div className={`p-1 rounded-full ${currentTab === 'chats' ? 'bg-pink-500/20 text-pink-400' : ''}`}>
            <MessageCircle className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Chats</span>
        </button>

        {/* 4. Share Link & Earn ₹50 Coins */}
        {onOpenReferral && (
          <button
            onClick={onOpenReferral}
            className="flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-2xl transition-all text-amber-400 hover:text-amber-300 active:scale-95 group"
            title="Share Link & Earn ₹50 Coins"
          >
            <div className="p-1 rounded-full bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform animate-pulse">
              <Gift className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black tracking-tight flex items-center gap-0.5">
              <span>Share</span>
              <span className="text-[9px] bg-amber-400 text-black px-1 rounded-full font-bold">50</span>
            </span>
          </button>
        )}

        {/* 5. Rate Card & Host Earnings */}
        <button
          onClick={() => onTabChange('rates')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-2xl transition-all ${
            currentTab === 'rates' ? 'text-pink-400 font-black' : 'text-gray-400 hover:text-white'
          }`}
          title="Rate Card & Host Earnings"
        >
          <div className={`p-1 rounded-full ${currentTab === 'rates' ? 'bg-pink-500/20 text-pink-400' : ''}`}>
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Rate Card</span>
        </button>

        {/* 6. Profile */}
        <button
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-2xl transition-all ${
            currentTab === 'settings' ? 'text-pink-400 font-black' : 'text-gray-400 hover:text-white'
          }`}
          title="Profile & Settings"
        >
          <div className={`p-1 rounded-full ${currentTab === 'settings' ? 'bg-pink-500/20 text-pink-400' : ''}`}>
            <User className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Profile</span>
        </button>
      </div>
    </nav>
  );
};

