import React, { useState } from 'react';
import { Shield, Lock, ArrowLeft, KeyRound, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AdminPanel } from './AdminPanel';
import { useAdmin } from '../context/AdminContext';
import { useActiveSession } from '../services/userAuthSync';
import { isAdminUser, SUPER_ADMIN_PHONE } from '../services/adminSync';

interface AdminPortalPageProps {
  onClose?: () => void;
}

export const AdminPortalPage: React.FC<AdminPortalPageProps> = ({ onClose }) => {
  const { openAdmin } = useAdmin();
  const session = useActiveSession();
  const isSuperAdminAccount = isAdminUser(session?.phone);

  const [passcode, setPasscode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return isSuperAdminAccount || sessionStorage.getItem('sunosakhi_admin_session') === 'active';
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If user logs in with 7009600157, auto-unlock
  React.useEffect(() => {
    if (isSuperAdminAccount) {
      setIsUnlocked(true);
      sessionStorage.setItem('sunosakhi_admin_session', 'active');
      openAdmin();
    }
  }, [isSuperAdminAccount, openAdmin]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Secure Master Admin Passcode OR Super Admin
    if (passcode === 'admin786' || passcode === 'sakhi@admin2026' || passcode === '123456' || isSuperAdminAccount) {
      setIsUnlocked(true);
      sessionStorage.setItem('sunosakhi_admin_session', 'active');
      openAdmin();
    } else {
      setErrorMsg('Galat Admin Passcode! Kripya sahi passcode darj karein.');
    }
  };

  const handleBackToApp = () => {
    if (onClose) {
      onClose();
    } else {
      window.location.href = window.location.pathname;
    }
  };

  if (isUnlocked) {
    return (
      <div className="min-h-screen bg-[#07030e] text-white flex flex-col">
        <header className="p-4 border-b border-pink-500/30 bg-[#120620] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">SunoSakhi Master Admin Portal</h2>
                {isSuperAdminAccount && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-black flex items-center gap-1">
                    👑 Super Admin ({SUPER_ADMIN_PHONE})
                  </span>
                )}
              </div>
              <p className="text-xs text-pink-300">User & Host Directory • Balances • Account Control</p>
            </div>
          </div>
          <button
            onClick={handleBackToApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Public App Par Jayein</span>
          </button>
        </header>

        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          <AdminPanel isSuperAdmin={isSuperAdminAccount} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090412] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#1c0c2e] to-[#10061d] border border-pink-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-pink-600/15 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/40 mb-3">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white">SunoSakhi Master Admin</h2>
          <p className="text-xs text-pink-300/80 mt-1">
            Restricted Access • Enter Secret Passcode
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isSuperAdminAccount && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-amber-300">
              <span>👑 Super Admin Verified (+91 {SUPER_ADMIN_PHONE})</span>
            </p>
            <p className="text-[11px] text-amber-200/80">
              Aapka mobile number Super Admin ke roop me register hai. Passcode ki zaroorat nahi hai.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsUnlocked(true);
                sessionStorage.setItem('sunosakhi_admin_session', 'active');
                openAdmin();
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs shadow-md transition-all"
            >
              🚀 Direct Admin Kholein (No Password)
            </button>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Master Admin Passcode
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-pink-400 absolute left-3" />
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter secret passcode"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500 font-mono tracking-widest"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>Unlock Admin Portal</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
          <span>Demo Passcode: <strong>admin786</strong></span>
          <button
            onClick={handleBackToApp}
            className="text-pink-400 hover:text-pink-300 underline font-semibold"
          >
            Return to App
          </button>
        </div>
      </div>
    </div>
  );
};
