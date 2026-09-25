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
  logoutCurrentUser,
  isProfileNameUnique
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
  defaultFocus = 'user',
  isForcedGate = false
}) => {
  const { registerHost, setUserRole, logoutHost, openLoginModal } = useHost();
  const { creditLoginBonus } = useWallet();
  const session = getActiveSession();

  // ONLY 2 MAIN TABS: 'signin' or 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  // First-time signup role choice: 'caller' or 'host'
  const [signupRole, setSignupRole] = useState<'caller' | 'host'>(defaultFocus === 'host' ? 'host' : 'caller');
  const [userName, setUserName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      if (defaultFocus === 'host') {
        setSignupRole('host');
      }
    }
  }, [isOpen, defaultFocus]);

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
  // SIGN IN HANDLER (AUTO-DETECTS CALLER VS HOST)
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
      // Direct login: automatically detects whether this account is Host or Caller!
      const res = await loginExistingUser(clean);
      if (res.success) {
        if (res.isHost) {
          setUserRole('host');
          setSuccessMessage(`🌸 Welcome back ${res.host?.name || 'Host'}! Host Studio khul gaya.`);
        } else {
          setUserRole('caller');
          creditLoginBonus(res.user?.phone || res.user?.email || clean, false, false);
          setSuccessMessage(`✅ Sign In Successful! Welcome back ${res.user?.name || 'Caller'}.`);
        }
        broadcastAuthChange();
        setTimeout(closeAndNotify, 650);
        return;
      }

      if (res.notRegistered) {
        setErrorMessage(
          '⚠️ Yeh mobile number/email registered nahi hai! Kripya upar "Sign Up" par click karein aur Caller ya Host chunein.'
        );
        return;
      }

      setErrorMessage(res.error || 'Sign In me samasya aayi.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sign In me samasya aayi.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // SIGN UP HANDLER (CREATES SELECTED ROLE: CALLER OR HOST)
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
      const trimmedName = userName.trim();
      if (trimmedName) {
        const nameCheck = await isProfileNameUnique(trimmedName);
        if (!nameCheck.isUnique) {
          setErrorMessage(nameCheck.message || '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.');
          setLoading(false);
          return;
        }
      }

      if (signupRole === 'host') {
        // Register brand new Sakhi Host
        const hostName = userName.trim() || 'Sakhi Host';
        const regHostRes = await registerHost({
          phone: clean,
          name: hostName,
          password: 'sakhi' + (clean.length >= 4 ? clean.slice(-4) : '123'),
          city: 'India',
          languages: ['Hindi', 'English'],
          age: 22,
          bio: 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.'
        });

        if (regHostRes.success) {
          setUserRole('host');
          setSuccessMessage(`🌸 Welcome ${hostName}! Host account register ho gaya hai. KYC verify hone par account activate hoga.`);
          broadcastAuthChange();
          setTimeout(closeAndNotify, 700);
        } else {
          // If already registered, smoothly login as host
          const loginRes = await loginExistingUser(clean);
          if (loginRes.success && loginRes.isHost) {
            setUserRole('host');
            setSuccessMessage(`🌸 Welcome back ${loginRes.host?.name || 'Host'}! Host Studio khul gaya.`);
            broadcastAuthChange();
            setTimeout(closeAndNotify, 700);
          } else {
            setErrorMessage(regHostRes.error || 'Host account banane me samasya aayi.');
          }
        }
      } else {
        // Register brand new Caller
        const referredBy = getSavedReferredBy();
        const callerName = userName.trim() || undefined;
        const res = await registerNewUser(clean, callerName, referredBy || undefined);

        if (res.success && res.user) {
          setUserRole('caller');
          creditLoginBonus(res.user.phone || res.user.email || clean, true, Boolean(referredBy));
          setSuccessMessage('🎉 Welcome to SunoSakhi! Aapka Caller account ban gaya hai. ₹50 Free Coins add ho gaye!');
          broadcastAuthChange();
          setTimeout(closeAndNotify, 700);
        } else {
          // If already registered, sign in smoothly
          const loginRes = await loginExistingUser(clean);
          if (loginRes.success) {
            if (loginRes.isHost) {
              setUserRole('host');
              setSuccessMessage(`🌸 Welcome back ${loginRes.host?.name || 'Host'}! Host Studio khul gaya.`);
            } else {
              setUserRole('caller');
              creditLoginBonus(loginRes.user?.phone || loginRes.user?.email || clean, false, false);
              setSuccessMessage('✅ Sign In Successful! Welcome Back.');
            }
            broadcastAuthChange();
            setTimeout(closeAndNotify, 700);
          } else {
            setErrorMessage(res.error || 'Sign Up me samasya aayi.');
          }
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

        {/* Close Button */}
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

          {/* EXACTLY 2 OPTIONS: SIGN IN vs SIGN UP */}
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
          /* Form Body: SIGN IN OR SIGN UP */
          <form onSubmit={activeTab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            
            {/* SIGN UP ROLE SELECTION CARDS (CALLER VS SAKHI HOST) */}
            {activeTab === 'signup' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-pink-200 block">
                  Aap kya banna chahte hain? (Select Your Role)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Option A: Caller */}
                  <button
                    type="button"
                    onClick={() => {
                      setSignupRole('caller');
                      setErrorMessage(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      signupRole === 'caller'
                        ? 'bg-gradient-to-br from-emerald-950/90 to-teal-900/70 border-emerald-400 text-white shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/50 scale-[1.02]'
                        : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">📞</span>
                        {signupRole === 'caller' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-300/40 animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-xs font-black text-white">Caller</p>
                      <p className="text-[10px] text-emerald-300 font-medium">बात करने वाला</p>
                    </div>
                    <span className="mt-2 inline-block text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 font-black border border-emerald-500/30">
                      ₹50 Free Coins 🎁
                    </span>
                  </button>

                  {/* Option B: Host */}
                  <button
                    type="button"
                    onClick={() => {
                      setSignupRole('host');
                      setErrorMessage(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      signupRole === 'host'
                        ? 'bg-gradient-to-br from-pink-950/90 to-purple-900/70 border-pink-400 text-white shadow-lg shadow-pink-950/50 ring-2 ring-pink-500/50 scale-[1.02]'
                        : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">🌸</span>
                        {signupRole === 'host' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-400 ring-2 ring-pink-300/40 animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-xs font-black text-white">Sakhi Host</p>
                      <p className="text-[10px] text-pink-300 font-medium">सखी होस्ट</p>
                    </div>
                    <span className="mt-2 inline-block text-[9px] px-2 py-0.5 rounded-full bg-pink-500/25 text-pink-300 font-black border border-pink-500/30">
                      Host Kamai Share 👑
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Optional Name Input (During Sign Up) */}
            {activeTab === 'signup' && (
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center justify-between">
                  <span>Aapka Naam (Optional)</span>
                  <span className="text-[10px] text-gray-400">
                    {signupRole === 'host' ? 'Sakhi Name' : 'Caller Name'}
                  </span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={signupRole === 'host' ? 'e.g. Pallavi / Priya' : 'e.g. Rahul / Aman'}
                  className="w-full px-4 py-2.5 rounded-2xl bg-black/60 border border-pink-500/30 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>
            )}

            {/* Mobile Number or Email Input */}
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
                {activeTab === 'signin'
                  ? '🔒 Apna registered mobile number ya email enter karein (Auto Role Detect).'
                  : signupRole === 'host'
                  ? '🌸 Host account banate hi aapko direct kamai aur free calls access mil jayega.'
                  : '🎁 Caller banne par aapko ₹50 free bonus coins milenge.'}
              </p>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading || !isInputValid}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'signin'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-black shadow-emerald-900/40 hover:from-emerald-400'
                  : signupRole === 'host'
                  ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white shadow-pink-900/40 hover:from-pink-500'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-teal-900/40 hover:from-emerald-500'
              }`}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>
                {activeTab === 'signin'
                  ? 'Sign In (Login Karein)'
                  : signupRole === 'host'
                  ? '🌸 Sign Up As Sakhi Host (सखी होस्ट)'
                  : '📞 Sign Up As Caller (बात करने वाले)'}
              </span>
            </button>

            {/* Skip / Explore button */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={closeAndNotify}
                className="w-full py-2.5 text-center text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Pehle App Explore Karein (Skip) ➔</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

