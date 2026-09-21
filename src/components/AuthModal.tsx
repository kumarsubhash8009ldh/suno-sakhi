import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  LogIn,
  UserPlus,
  LogOut
} from 'lucide-react';
import { useHost } from '../context/HostContext';
import { useWallet } from '../context/WalletContext';
import { checkHostPhoneExists } from '../services/hostAuthSync';
import {
  checkUserPhoneExists,
  registerNewUser,
  loginExistingUser,
  broadcastAuthChange,
  getActiveSession,
  logoutCurrentUser
} from '../services/userAuthSync';
import { getSavedReferredBy } from '../services/referralSync';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFocus?: 'user' | 'host';
  isForcedGate?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  isForcedGate = false
}) => {
  const { loginWithPassword, loginWithOtp, logoutHost, openLoginModal } = useHost();
  const { creditLoginBonus } = useWallet();
  const session = getActiveSession();

  // ONLY 2 OPTIONS: 'signin' or 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const closeAndNotify = () => {
    onClose();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sunosakhi-close-auth'));
    }
  };

  const isEmail = identifier.includes('@') || /[a-zA-Z]/.test(identifier);
  const isInputValid = isEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())
    : identifier.replace(/\D/g, '').length === 10;

  const getCleanIdentifier = () => {
    if (isEmail) {
      return identifier.trim().toLowerCase();
    }
    return identifier.replace(/\D/g, '');
  };

  // -------------------------------------------------------------
  // SIGN IN HANDLER (BY MOBILE NUMBER OR EMAIL)
  // -------------------------------------------------------------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const clean = getCleanIdentifier();
    if (!isInputValid) {
      setErrorMessage(
        isEmail
          ? 'Kripya valid email address darj karein (e.g. user@gmail.com).'
          : 'Kripya 10-digit valid mobile number dalein.'
      );
      return;
    }

    setLoading(true);

    try {
      // Direct login: recognizes both Host and Caller automatically
      const res = await loginExistingUser(clean);
      if (res.success) {
        if (res.isHost) {
          setSuccessMessage(`🌸 Welcome back ${res.host?.name || 'Host'}! Host Studio login ho gaya.`);
        } else {
          creditLoginBonus(res.user?.phone || res.user?.email || clean, false, false);
          setSuccessMessage(`✅ Sign In Successful! Welcome to SunoSakhi`);
        }
        broadcastAuthChange();
        setTimeout(closeAndNotify, 500);
        return;
      }

      // If not found, auto-register as Caller
      const regRes = await registerNewUser(clean);
      if (regRes.success && regRes.user) {
        creditLoginBonus(regRes.user.phone || regRes.user.email || clean, true, false);
        setSuccessMessage('🎉 Welcome to SunoSakhi! Sign In Successful.');
        broadcastAuthChange();
        setTimeout(closeAndNotify, 500);
      } else {
        setErrorMessage(regRes.error || 'Sign In me samasya aayi.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sign In me samasya aayi.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // SIGN UP HANDLER (BY MOBILE NUMBER OR EMAIL)
  // -------------------------------------------------------------
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const clean = getCleanIdentifier();
    if (!isInputValid) {
      setErrorMessage(
        isEmail
          ? 'Kripya valid email address darj karein (e.g. user@gmail.com).'
          : 'Kripya 10-digit valid mobile number dalein.'
      );
      return;
    }

    setLoading(true);

    try {
      const referredBy = getSavedReferredBy();
      const res = await registerNewUser(clean, undefined, referredBy || undefined);

      if (res.success && res.user) {
        creditLoginBonus(res.user.phone || res.user.email || clean, true, Boolean(referredBy));
        setSuccessMessage('🎉 Welcome to SunoSakhi! Sign Up Successful.');
        broadcastAuthChange();
        setTimeout(closeAndNotify, 500);
      } else {
        // If already registered, smoothly sign them in!
        const loginRes = await loginExistingUser(clean);
        if (loginRes.success) {
          if (loginRes.isHost) {
            setSuccessMessage(`🌸 Welcome back ${loginRes.host?.name || 'Host'}! Host Studio login ho gaya.`);
          } else {
            creditLoginBonus(loginRes.user?.phone || loginRes.user?.email || clean, false, false);
            setSuccessMessage('✅ Sign In Successful! Welcome Back.');
          }
          broadcastAuthChange();
          setTimeout(closeAndNotify, 500);
        } else {
          setErrorMessage(res.error || 'Sign Up me samasya aayi.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sign up me samasya aayi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-sm rounded-[32px] bg-[#1e0e33] border-2 border-pink-500 shadow-2xl shadow-pink-600/40 p-6 text-white my-auto">

        {/* Close Button: Always available so user can explore app */}
        <button
          onClick={closeAndNotify}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white border border-white/10"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-600/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Suno<span className="text-pink-400">Sakhi</span>
            </h2>
          </div>
          <p className="text-[11px] text-pink-200/80 font-medium">
            Dil Se Dil Ki Baat • 100% Private & Safe
          </p>

          {/* EXACTLY 2 OPTIONS: SIGN IN vs SIGN UP (NO OTHER LABELS) */}
          <div className="mt-4 flex p-1 rounded-2xl bg-black/70 border border-pink-500/30">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'signin'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* When user is already logged in, show active ID and prominent Logout Option */}
        {session.isLoggedIn ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/40 text-center space-y-2.5">
              <div className="w-14 h-14 mx-auto rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-purple-600 shadow-lg">
                <img
                  src={session.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'}
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black uppercase tracking-wider border border-emerald-500/30">
                  Logged In As {session.role === 'host' ? 'Host Girl' : 'Caller'}
                </span>
                <h4 className="text-base font-bold text-white mt-1.5">{session.name || 'Caller'}</h4>
                <p className="text-xs text-pink-300 font-mono">
                  {session.email || (session.phone ? `+91 ${session.phone}` : '')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (session.role === 'host') {
                  logoutHost();
                } else {
                  logoutCurrentUser();
                }
                broadcastAuthChange();
                setSuccessMessage('Aapki ID successfully logout ho gayi hai. Naya number ya email enter karein.');
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-sm shadow-xl shadow-red-900/40 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>🚪 Logout ID (Account Badlein)</span>
            </button>

            <button
              type="button"
              onClick={closeAndNotify}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-xs transition-all"
            >
              Wapas App Par Jayein
            </button>
          </div>
        ) : (
          /* Form Body: MOBILE NUMBER OR EMAIL INPUT */
          <form onSubmit={activeTab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {isEmail ? <Mail className="w-3.5 h-3.5 text-pink-400" /> : <Phone className="w-3.5 h-3.5 text-pink-400" />}
                  <span>Mobile Number ya Email ID</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {isEmail ? 'Email' : '10 Digits'}
                </span>
              </label>
              <div className="relative flex items-center">
                {!isEmail && (
                  <span className="absolute left-3.5 text-sm text-pink-400 font-bold font-mono">+91</span>
                )}
                {isEmail && (
                  <Mail className="absolute left-3.5 w-4 h-4 text-pink-400" />
                )}
                <input
                  type="text"
                  autoFocus
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.trim())}
                  placeholder="Mobile number ya email@domain.com"
                  className={`w-full ${!isEmail ? 'pl-14' : 'pl-11'} pr-4 py-3 rounded-2xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm tracking-wider focus:outline-none focus:border-pink-500 shadow-inner`}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                🔒 Apna 10-digit mobile number ya email enter karke aage badhein.
              </p>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading || !isInputValid}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'signin'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-black shadow-emerald-900/40 hover:from-emerald-400'
                  : 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white shadow-pink-900/40 hover:from-pink-500'
              }`}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>{activeTab === 'signin' ? 'Sign In' : 'Sign Up'}</span>
            </button>

            {/* Explore first / Skip button */}
            <div className="pt-2 space-y-2 text-center">
              <button
                type="button"
                onClick={closeAndNotify}
                className="w-full py-2.5 text-center text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Pehle App Explore Karein (Skip) ➔</span>
              </button>

              <div className="relative py-1 flex items-center justify-center">
                <div className="border-t border-white/10 w-full"></div>
                <span className="bg-[#1e0e33] px-2 text-[10px] text-gray-500 uppercase font-bold">ya</span>
                <div className="border-t border-white/10 w-full"></div>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeAndNotify();
                  openLoginModal();
                }}
                className="w-full py-2.5 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span>🌸 Host Portal (Host ID Login / Nayi Registration)</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
