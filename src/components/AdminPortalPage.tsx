import React, { useState } from 'react';
import { Shield, Lock, ArrowLeft, KeyRound, AlertCircle, LogIn, Eye, EyeOff, LogOut, CheckCircle2 } from 'lucide-react';
import { AdminPanel } from './AdminPanel';
import { AdminChangePasswordModal } from './AdminChangePasswordModal';
import { AuthModal } from './AuthModal';
import { useAdmin } from '../context/AdminContext';
import { useActiveSession } from '../services/userAuthSync';
import { isAdminUser, SUPER_ADMIN_PHONE } from '../services/adminSync';

interface AdminPortalPageProps {
  onClose?: () => void;
}

export const AdminPortalPage: React.FC<AdminPortalPageProps> = ({ onClose }) => {
  const { openAdmin, settings } = useAdmin();
  const session = useActiveSession();
  const isSuperAdminAccount = isAdminUser(session?.phone);

  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const activeAdminPassword = settings.adminPassword || localStorage.getItem('sunosakhi_admin_password') || 'admin786';

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const entered = passcode.trim();

    // Verify against current dynamic admin password or master fallback
    if (entered === activeAdminPassword || entered === 'sakhi@admin2026') {
      setIsUnlocked(true);
      openAdmin();
      setPasscode('');
    } else {
      setErrorMsg('❌ Galat Admin Password! Kripya sahi password darj karein.');
    }
  };

  const handleBackToApp = () => {
    if (onClose) {
      onClose();
    } else {
      // Clear admin query params and redirect to home
      window.location.href = window.location.origin;
    }
  };

  const handleLockAdmin = () => {
    setIsUnlocked(false);
    setPasscode('');
    setErrorMsg(null);
  };

  // -------------------------------------------------------------
  // CASE 1: USER IS NOT LOGGED IN WITH 7009600157 (ACCESS BLOCKED)
  // -------------------------------------------------------------
  if (!isSuperAdminAccount) {
    return (
      <div className="min-h-screen bg-[#07030e] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#1c081e] to-[#0c0314] border border-red-500/40 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-red-600/15 blur-3xl pointer-events-none" />

          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-black uppercase tracking-wider">
            ⛔ Access Restricted
          </span>

          <h2 className="text-xl font-black text-white mt-3 mb-1">
            Super Admin Access Only
          </h2>
          <p className="text-xs text-red-200/80 leading-relaxed mb-5">
            Admin Portal sirf registered Super Admin number (<strong className="text-white font-mono">+91 {SUPER_ADMIN_PHONE}</strong>) se login hone par hi show aur open hota hai.
          </p>

          <div className="p-3.5 rounded-2xl bg-black/50 border border-red-500/30 text-left mb-6 space-y-1.5">
            <div className="text-[11px] text-gray-400">Current Login Status:</div>
            {session?.isLoggedIn ? (
              <div className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                <span>📱 Logged in as:</span>
                <span className="font-mono">{session.phone || session.name}</span>
                <span className="text-[10px] text-red-400 bg-red-950/60 px-2 py-0.5 rounded-md border border-red-800">Non-Admin</span>
              </div>
            ) : (
              <div className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                <span>⚪ Not Logged In (Aap abhi logged in nahi hain)</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-xl shadow-pink-900/50 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Login with +91 {SUPER_ADMIN_PHONE}</span>
            </button>

            <button
              type="button"
              onClick={handleBackToApp}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Public App Par Wapas Jayein</span>
            </button>
          </div>
        </div>

        {/* Auth Modal for logging in as 7009600157 */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          defaultFocus="user"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // CASE 2: LOGGED IN WITH 7009600157 AND UNLOCKED WITH PASSWORD
  // -------------------------------------------------------------
  if (isUnlocked) {
    return (
      <div className="min-h-screen bg-[#07030e] text-white flex flex-col">
        <header className="p-3.5 sm:p-4 border-b border-pink-500/30 bg-[#120620] sticky top-0 z-30 flex items-center justify-between gap-3 flex-wrap shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white">SunoSakhi Super Admin Portal</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 text-[10px] sm:text-[11px] font-black flex items-center gap-1 shadow-sm">
                  👑 Super Admin (+91 {SUPER_ADMIN_PHONE})
                </span>
              </div>
              <p className="text-[11px] text-pink-300/80">User & Host Directory • Balances • KYC • Settings</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Change Password CTA Button */}
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-bold transition-all shadow-sm"
              title="Admin Password Badlein"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-300" />
              <span>Password Badlein</span>
            </button>

            {/* Lock Admin CTA Button */}
            <button
              onClick={handleLockAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-200 hover:text-white text-xs font-bold transition-all shadow-sm"
              title="Lock Admin Panel (Next time asks for password)"
            >
              <Lock className="w-3.5 h-3.5 text-red-400" />
              <span>Lock Admin</span>
            </button>

            {/* Back to Public App Button */}
            <button
              onClick={handleBackToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-200 hover:text-white transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Public App</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-5 max-w-7xl mx-auto w-full">
          <AdminPanel
            isSuperAdmin={true}
            onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          />
        </main>

        {/* Change Password Modal */}
        <AdminChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // CASE 3: LOGGED IN WITH 7009600157 BUT REQUIRES ADMIN PASSWORD
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#090412] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#1c0c2e] to-[#10061d] border border-pink-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-pink-600/20 blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/40 mb-3">
            <Shield className="w-7 h-7" />
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black flex items-center gap-1 mb-2">
            👑 Super Admin Verified (+91 {SUPER_ADMIN_PHONE})
          </span>
          <h2 className="text-xl font-black text-white">Enter Admin Password</h2>
          <p className="text-xs text-pink-300/80 mt-1">
            Admin Panel kholne ke liye apna secret security password darj karein
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Admin Secret Password
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-pink-400 absolute left-3 pointer-events-none" />
              <input
                type={showPasscode ? 'text' : 'password'}
                required
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Secret password daalein"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-black/60 border border-pink-500/30 text-white text-sm focus:outline-none focus:border-pink-500 font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3 text-gray-400 hover:text-white"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-900/40 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Lock className="w-4 h-4" />
            <span>Unlock Admin Panel</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Encrypted Session</span>
          </span>
          <button
            onClick={handleBackToApp}
            className="text-pink-400 hover:text-pink-300 underline font-semibold"
          >
            Public App Par Wapas Jayein
          </button>
        </div>
      </div>
    </div>
  );
};
