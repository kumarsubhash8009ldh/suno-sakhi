import { Wallet, Sparkles, Plus, UserCheck, PhoneCall, TrendingUp, Headphones, Shield, LogIn, LogOut, Download, Gift, User, Clock } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { getCurrentUser, useActiveSession, logoutCurrentUser, broadcastAuthChange } from '../services/userAuthSync';

interface NavbarProps {
  onOpenHelpDesk: () => void;
  onOpenReferral?: () => void;
  onOpenAuth?: (focus?: 'user' | 'host') => void;
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenHelpDesk,
  onOpenReferral,
  onOpenAuth,
  currentTab,
  onSelectTab
}) => {
  const { balance, openWalletModal } = useWallet();
  const { userRole, setUserRole, hostProfile, isHostLoggedIn, openLoginModal, logoutHost } = useHost();
  const session = useActiveSession();

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-pink-500/20 px-3 py-2.5 sm:px-6 sm:py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand Logo & Tagline (Touch to open Main Screen) */}
        <button
          onClick={() => {
            if (onSelectTab) onSelectTab('sakhis');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 text-left cursor-pointer active:scale-95 transition-transform group"
          title="Touch to open Main Screen (All Sakhi)"
        >
          <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-pink-600 via-fuchsia-600 to-purple-600 p-[2px] shadow-lg shadow-pink-600/40 group-hover:scale-105 transition-transform">
            <img
              src="/suno-sakhi-logo-icon.png"
              alt="SunoSakhi"
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-2xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-rose-300 to-purple-300 bg-clip-text text-transparent">
                SunoSakhi
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 font-semibold">
                LIVE
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-pink-300/80 font-medium hidden md:block">
              Voice Connects Hearts ♡ • दिल से बात सिर्फ सुनो सखी के साथ
            </p>
          </div>
        </button>

        {/* Center: Desktop Navigation Tabs */}
        {onSelectTab && (
          <nav className="hidden md:flex items-center gap-1 bg-black/40 border border-pink-500/20 p-1 rounded-2xl">
            <button
              onClick={() => onSelectTab('sakhis')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentTab === 'sakhis'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {userRole === 'host' ? '👥 Callers' : '📞 All Sakhi'}
            </button>
            {userRole === 'host' && (
              <button
                onClick={() => onSelectTab('host')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'host'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                👑 Host Studio
              </button>
            )}
            <button
              onClick={() => onSelectTab('chats')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentTab === 'chats'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              💬 Chats
            </button>
            <button
              onClick={() => onSelectTab('rates')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentTab === 'rates'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              🏷️ Rate & 60%
            </button>
            <button
              onClick={() => onSelectTab('helpline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentTab === 'helpline'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              🎧 Helpline
            </button>
            <button
              onClick={() => onSelectTab('settings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentTab === 'settings'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              👤 Profile
            </button>
          </nav>
        )}

        {/* Right Section: Role Switcher, Wallet & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Role Switcher (Caller ⇄ Host) */}
          <div className="flex items-center p-0.5 sm:p-1 rounded-2xl bg-black/60 border border-pink-500/40 shadow-inner">
            <button
              onClick={() => {
                setUserRole('caller');
                if (onSelectTab) onSelectTab('sakhis');
              }}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-black transition-all ${
                userRole === 'caller'
                  ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white shadow-lg shadow-pink-600/40'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Switch to Caller Mode"
            >
              <PhoneCall className="w-3 h-3" />
              <span>Caller</span>
            </button>
            <button
              onClick={() => {
                setUserRole('host');
                if (onSelectTab) onSelectTab('host');
                if (!isHostLoggedIn) {
                  if (onOpenAuth) onOpenAuth('host');
                  else openLoginModal();
                }
              }}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-black transition-all ${
                userRole === 'host'
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/40'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Switch to Host Mode (60% Kamai & Free Calls)"
            >
              <UserCheck className="w-3 h-3" />
              <span>Host (60%)</span>
            </button>
          </div>

          {/* Caller Wallet OR Host Income & Login */}
          {userRole === 'caller' ? (
            <div className="flex items-center gap-1.5">
              {/* Share Link & Earn ₹50 Coins */}
              {onOpenReferral && (
                <button
                  type="button"
                  onClick={onOpenReferral}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-pink-500/20 hover:from-amber-500/30 hover:to-pink-500/30 border border-amber-500/50 text-amber-300 font-extrabold text-[11px] sm:text-xs shadow-md active:scale-95 transition-all"
                  title="Share Link & Earn ₹50 Coins"
                >
                  <Gift className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  <span className="hidden xs:inline">Share</span>
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-black px-1.5 py-0.2 rounded-full text-[10px] font-black shadow">
                    ₹50
                  </span>
                </button>
              )}

              <button
                onClick={openWalletModal}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-[#201035] to-[#2d1245] hover:from-[#2a1445] hover:to-[#381657] border border-pink-500/40 transition-all shadow-md group"
              >
                <div className="p-1 rounded-full bg-pink-500/20 text-pink-400 group-hover:scale-110 transition-transform">
                  <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-pink-300/80">Wallet</span>
                  <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                    ₹{((balance ?? 0) || 0).toFixed(2)}
                  </span>
                </div>
                <div className="ml-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-semibold hidden sm:flex items-center gap-0.5 shadow-sm">
                  <Plus className="w-2.5 h-2.5" />
                  <span>Add</span>
                </div>
              </button>

              {/* User Web Login/Account trigger */}
              <button
                onClick={() => (onOpenAuth ? onOpenAuth('user') : openLoginModal())}
                className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                  session.isLoggedIn
                    ? 'bg-blue-950/70 hover:bg-blue-900/70 text-blue-300 border-blue-500/40'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/50 animate-pulse'
                }`}
                title="Web Login & Account"
              >
                {session.isLoggedIn && session.avatar ? (
                  <img
                    src={session.avatar}
                    alt="Profile"
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-blue-400 flex-shrink-0"
                  />
                ) : (
                  <LogIn className="w-3.5 h-3.5 text-white" />
                )}
                <span>{session.isLoggedIn ? (session.name ? session.name.split(' ')[0] : 'Account') : 'Web Login'}</span>
              </button>

              {/* Caller Logout Button */}
              {session.isLoggedIn && (
                <button
                  onClick={() => {
                    logoutCurrentUser();
                    broadcastAuthChange();
                  }}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1 shadow transition-all active:scale-95"
                  title="Logout Caller ID"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 shadow-md">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300">
                  ₹{((hostProfile?.netIncome ?? 0) || 0).toFixed(2)}
                </span>
              </div>

              {isHostLoggedIn ? (
                <button
                  onClick={logoutHost}
                  className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-900/50 flex items-center gap-1"
                  title="Logout Host"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              ) : (
                <button
                  onClick={() => (onOpenAuth ? onOpenAuth('host') : openLoginModal())}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
