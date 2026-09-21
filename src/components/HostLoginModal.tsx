import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  KeyRound,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  HelpCircle,
  Copy,
  LogIn
} from 'lucide-react';
import { useHost } from '../context/HostContext';
import { sendRealSmsOtp, verifyRealSmsOtp } from '../services/smsOtpService';

type ModalTab = 'login' | 'register' | 'forgot';

export const HostLoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    closeLoginModal,
    sendHostOtp,
    verifyHostOtp,
    loginWithOtp,
    loginWithPassword,
    checkPhoneExists,
    registerHost,
    recoverPassword,
    recoverHostAccountDetails
  } = useHost();

  const [activeTab, setActiveTab] = useState<ModalTab>('login');

  // Login State
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('otp');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register State
  const [regStep, setRegStep] = useState<'phone' | 'otp' | 'details'>('phone');
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState(22);
  const [regCity, setRegCity] = useState('Delhi');
  const [regLanguage, setRegLanguage] = useState('Hindi');
  const [regPassword, setRegPassword] = useState('');
  const [regBio, setRegBio] = useState('');

  // Forgot Password State
  const [forgotStep, setForgotStep] = useState<'phone' | 'otp' | 'recovered' | 'new_password'>('phone');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveredHostPassword, setRecoveredHostPassword] = useState<string>('');
  const [showRecoveredPassword, setShowRecoveredPassword] = useState<boolean>(true);
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);

  // Common UI State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  if (!isLoginModalOpen) return null;

  const resetAllStates = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(false);
  };

  const switchTab = (tab: ModalTab) => {
    setActiveTab(tab);
    resetAllStates();
  };

  // -------------------------------------------------------------
  // 1. LOGIN HANDLERS
  // -------------------------------------------------------------
  const handleSendLoginOtp = () => {
    setErrorMsg(null);
    const isEmail = loginPhone.includes('@');
    if (!isEmail && (!loginPhone || loginPhone.replace(/\D/g, '').length < 10)) {
      setErrorMsg('Kripya valid 10-digit mobile number ya email dalein.');
      return;
    }
    const clean = isEmail ? loginPhone.trim().toLowerCase() : loginPhone.replace(/\D/g, '');
    const res = sendHostOtp(clean);
    const code = res?.otp || '123456';
    setLoginOtp(code);
    setSuccessMsg(`⚡ OTP Code: ${code} (Niche box me code enter ho chuka hai, ya 123456 dalein)`);
    setTimer(60);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllStates();
    setLoading(true);

    try {
      const isEmail = loginPhone.includes('@');
      const clean = isEmail ? loginPhone.trim().toLowerCase() : loginPhone.replace(/\D/g, '');
      if (loginMethod === 'password') {
        if (!loginPassword) {
          setErrorMsg('Kripya apna password dalein.');
          setLoading(false);
          return;
        }
        const res = await loginWithPassword(clean, loginPassword);
        if (!res.success) {
          setErrorMsg(res.error || 'Galat password ya mobile number/email.');
        }
      } else {
        if (!loginOtp) {
          setErrorMsg('Kripya 6-digit OTP darj karein.');
          setLoading(false);
          return;
        }
        const res = await loginWithOtp(clean, loginOtp);
        if (!res.success) {
          setErrorMsg(res.error || 'Galat OTP code.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login me samasya aayi.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 2. REGISTRATION HANDLERS (1 Mobile / Email = 1 Account + OTP)
  // -------------------------------------------------------------
  const handleCheckAndSendRegOtp = async () => {
    resetAllStates();
    const isEmail = regPhone.includes('@');
    const cleaned = isEmail ? regPhone.trim().toLowerCase() : regPhone.replace(/\D/g, '');
    if (!isEmail && cleaned.length !== 10) {
      setErrorMsg('Kripya 10-digit ka valid Indian mobile number darj karein.');
      return;
    }
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setErrorMsg('Kripya valid email address darj karein.');
      return;
    }

    setLoading(true);
    // Strict uniqueness check: Only ONE account per mobile number/email
    const exists = await checkPhoneExists(cleaned);
    setLoading(false);

    if (exists) {
      setErrorMsg(`⚠️ ${isEmail ? 'Email' : 'Mobile number'} ${cleaned} pehle se registered hai! Ek ID se sirf ek hi account ban sakta hai. Kripya Login karein.`);
      return;
    }

    // Send OTP
    const res = sendHostOtp(cleaned);
    const code = res?.otp || '123456';
    setRegOtp(code);
    setSuccessMsg(`⚡ OTP Code: ${code} (Niche box me code enter ho chuka hai, ya 123456 dalein)`);
    setRegStep('otp');
    setTimer(60);
  };

  const handleVerifyRegOtp = () => {
    resetAllStates();
    if (!regOtp || regOtp.length < 4) {
      setErrorMsg('Kripya 6-digit OTP code dalein.');
      return;
    }
    const isValid = verifyHostOtp(regPhone, regOtp);
    if (!isValid) {
      setErrorMsg('Galat OTP! Kripya sahi OTP code darj karein.');
      return;
    }
    setSuccessMsg('✅ Mobile number OTP successfully verified! Ab profile details bharein.');
    setRegStep('details');
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllStates();

    if (!regName.trim()) {
      setErrorMsg('Kripya apna poora naam likhein.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMsg('Password kam se kam 4 characters ka hona chahiye.');
      return;
    }

    setLoading(true);
    const res = await registerHost({
      phone: regPhone,
      name: regName,
      password: regPassword,
      city: regCity,
      languages: [regLanguage, 'English'],
      age: Number(regAge),
      bio: regBio || `Namaste! Main ${regName} hoon, SunoSakhi par aapse baatein karne ke liye available hoon.`
    });
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Registration failed.');
    } else {
      setSuccessMsg('🎉 Host Account successfully registered! Welcome to SunoSakhi!');
    }
  };

  // -------------------------------------------------------------
  // 3. FORGOT PASSWORD HANDLERS (Mobile Lookup + OTP + Reset)
  // -------------------------------------------------------------
  const handleForgotSendOtp = async () => {
    resetAllStates();
    const cleaned = forgotPhone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setErrorMsg('Kripya 10-digit mobile number dalein.');
      return;
    }

    setLoading(true);
    const exists = await checkPhoneExists(cleaned);
    if (!exists) {
      setLoading(false);
      setErrorMsg(`Mobile number ${cleaned} system me nahi mila. Kripya pehle register karein.`);
      return;
    }

    const res = await sendRealSmsOtp(cleaned, 'host-login-recaptcha-container');
    setLoading(false);
    if (res.success) {
      setForgotOtp(res.otp || '');
      setSuccessMsg(
        res.isRealSms
          ? `📲 Registered mobile par recovery OTP SMS bhej diya gaya hai. Kripya SMS check karein.`
          : `⚡ Recovery OTP: ${res.otp || '123456'} (Niche enter karke verify karein)`
      );
      setForgotStep('otp');
      setTimer(60);
    } else {
      setErrorMsg(res.message || 'OTP bhejne me samasya aayi.');
    }
  };

  const handleForgotVerifyOtp = async () => {
    resetAllStates();
    setLoading(true);
    const otpRes = await verifyRealSmsOtp(forgotPhone, forgotOtp);
    if (!otpRes.success) {
      setLoading(false);
      setErrorMsg('Galat OTP code! Kripya dobara check karein.');
      return;
    }

    const rec = await recoverHostAccountDetails(forgotPhone);
    setLoading(false);
    if (rec.success && rec.password) {
      setRecoveredHostPassword(rec.password);
      setForgotStep('recovered');
      setSuccessMsg('🎉 OTP Verified! Aapka password mil gaya hai (niche check karein).');
    } else {
      setForgotStep('new_password');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllStates();

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Naya password kam se kam 4 characters ka hona chahiye.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Dono password match nahi kar rahe hain.');
      return;
    }

    setLoading(true);
    const res = await recoverPassword(forgotPhone, newPassword);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Password reset me error aayi.');
    } else {
      setSuccessMsg('✅ Password successfully badal diya gaya hai! Ab aap login kar sakte hain.');
      setLoginPhone(forgotPhone);
      setLoginPassword(newPassword);
      setTimeout(() => {
        setActiveTab('login');
        setForgotStep('phone');
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-[#140822] border border-pink-500/40 shadow-2xl p-5 sm:p-6 text-white overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-pink-500/20 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-md">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-1.5">
                Host Portal • SunoSakhi
              </h3>
              <p className="text-[11px] text-pink-300">
                {activeTab === 'login'
                  ? 'Apne Host Account me login karein'
                  : activeTab === 'register'
                  ? 'Naya Host Account banayein (1 Mobile = 1 Account)'
                  : 'Mobile OTP se Password Recover Karein'}
              </p>
            </div>
          </div>
          <button
            onClick={closeLoginModal}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-2xl border border-pink-500/20 my-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => switchTab('login')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'login'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchTab('register')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Host Bano ✨
          </button>
          <button
            type="button"
            onClick={() => switchTab('forgot')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'forgot'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Forgot Pwd
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto pr-1">

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message Alert */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 1: LOGIN                                                    */}
          {/* ============================================================== */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1 flex items-center justify-between">
                  <span>Registered Mobile ya Email</span>
                  <span className="text-[10px] text-pink-400 font-bold">
                    {loginPhone.includes('@') ? 'Email' : '10 Digits'}
                  </span>
                </label>
                <div className="relative flex items-center">
                  {!loginPhone.includes('@') && (
                    <span className="absolute left-3 text-xs text-pink-400 font-bold">+91</span>
                  )}
                  {loginPhone.includes('@') && (
                    <Mail className="absolute left-3 w-3.5 h-3.5 text-pink-400" />
                  )}
                  <input
                    type="text"
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value.trim())}
                    placeholder="10-digit number ya email ID"
                    className={`w-full ${loginPhone.includes('@') ? 'pl-9' : 'pl-12'} pr-3 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs font-mono tracking-wider focus:outline-none focus:border-pink-500`}
                  />
                </div>
              </div>

              {/* Toggle: Password vs OTP */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Login Using</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('password')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      loginMethod === 'password'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-black/30 border-white/10 text-gray-400'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('otp')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      loginMethod === 'otp'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-black/30 border-white/10 text-gray-400'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Mobile OTP</span>
                  </button>
                </div>
              </div>

              {loginMethod === 'password' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-300">Host Password</label>
                    <button
                      type="button"
                      onClick={() => switchTab('forgot')}
                      className="text-[11px] text-pink-400 hover:text-pink-300 underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Apna password dalein"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-300">Enter 6-Digit OTP</label>
                    <button
                      type="button"
                      onClick={handleSendLoginOtp}
                      disabled={timer > 0}
                      className="text-[11px] text-pink-400 hover:text-pink-300 font-bold underline disabled:text-gray-500"
                    >
                      {timer > 0 ? `Resend in ${timer}s` : 'Send SMS OTP'}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit OTP code"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white font-mono tracking-widest text-sm focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Login & Open Host Dashboard</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className="text-xs text-pink-400 hover:text-pink-300 font-bold"
                >
                  Nayi Sakhi hain? Yahan Register Karein ➔
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* TAB 2: REGISTER (1 Mobile = 1 Account + OTP Verification)        */}
          {/* ============================================================== */}
          {activeTab === 'register' && (
            <div className="space-y-4">
              {/* Step Tracker */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 border-b border-white/10 pb-2">
                <span className={regStep === 'phone' ? 'text-pink-400 font-bold' : 'text-gray-500'}>
                  1. Mobile Number
                </span>
                <span>➔</span>
                <span className={regStep === 'otp' ? 'text-pink-400 font-bold' : 'text-gray-500'}>
                  2. OTP Verify
                </span>
                <span>➔</span>
                <span className={regStep === 'details' ? 'text-pink-400 font-bold' : 'text-gray-500'}>
                  3. Host Profile
                </span>
              </div>

              {/* Step 1: Mobile Number / Email & Strict Uniqueness Check */}
              {regStep === 'phone' && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-[11px] text-pink-200">
                    🛡️ <strong>Rule:</strong> Ek Mobile Number ya Email ID se sirf <strong>1 Host Account</strong> register ho sakta hai. Verify karne ke liye OTP aayega.
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1 flex items-center justify-between">
                      <span>Aapka Mobile Number ya Email ID</span>
                      <span className="text-[10px] text-pink-400 font-bold">
                        {regPhone.includes('@') ? 'Email' : '10 Digits'}
                      </span>
                    </label>
                    <div className="relative flex items-center">
                      {!regPhone.includes('@') && (
                        <span className="absolute left-3 text-xs text-pink-400 font-bold">+91</span>
                      )}
                      {regPhone.includes('@') && (
                        <Mail className="absolute left-3 w-3.5 h-3.5 text-pink-400" />
                      )}
                      <input
                        type="text"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value.trim())}
                        placeholder="Mobile number ya email@domain.com"
                        className={`w-full ${regPhone.includes('@') ? 'pl-9' : 'pl-12'} pr-3 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs font-mono tracking-wider focus:outline-none focus:border-pink-500`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckAndSendRegOtp}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Verify Karein & OTP Bhejo</span>
                  </button>
                </div>
              )}

              {/* Step 2: OTP Verification */}
              {regStep === 'otp' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">
                      OTP Sent to: <strong>{regPhone.includes('@') ? regPhone : `+91 ${regPhone}`}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRegStep('phone')}
                      className="text-[11px] text-pink-400 underline font-semibold"
                    >
                      Change ID
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-300">6-Digit OTP Darj Karein</label>
                      <button
                        type="button"
                        onClick={handleCheckAndSendRegOtp}
                        disabled={timer > 0}
                        className="text-[11px] text-pink-400 hover:text-pink-300 font-bold underline disabled:text-gray-500"
                      >
                        {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={regOtp}
                      onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white font-mono tracking-widest text-base text-center focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyRegOtp}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify OTP & Aage Badhein</span>
                  </button>
                </div>
              )}

              {/* Step 3: Complete Profile Details */}
              {regStep === 'details' && (
                <form onSubmit={handleCompleteRegistration} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Sakhi Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Aarohi Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Age</label>
                      <input
                        type="number"
                        min={18}
                        max={60}
                        value={regAge}
                        onChange={(e) => setRegAge(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">City</label>
                      <input
                        type="text"
                        value={regCity}
                        onChange={(e) => setRegCity(e.target.value)}
                        placeholder="e.g. Mumbai / Delhi"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Primary Language</label>
                    <select
                      value={regLanguage}
                      onChange={(e) => setRegLanguage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                    >
                      <option value="Hindi">Hindi</option>
                      <option value="Punjabi">Punjabi</option>
                      <option value="Bhojpuri">Bhojpuri</option>
                      <option value="Marathi">Marathi</option>
                      <option value="Bengali">Bengali</option>
                      <option value="English">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Set Host Password * (Login ke liye)
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Short Bio</label>
                    <textarea
                      rows={2}
                      value={regBio}
                      onChange={(e) => setRegBio(e.target.value)}
                      placeholder="Aapke bare me 1-2 lines (optional)"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span>Host Account Create Karein & Dashboard Kholein</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: FORGOT PASSWORD (Mobile Lookup + OTP + Reset)             */}
          {/* ============================================================== */}
          {activeTab === 'forgot' && (
            <div className="space-y-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200">
                🔑 Apne registered mobile number par OTP mangwayein aur naya password set karein.
              </div>

              {forgotStep === 'phone' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Registered Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-pink-400 font-bold">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={forgotPhone}
                        onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="10-digit mobile number"
                        className="w-full pl-12 pr-3 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs font-mono tracking-wider focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleForgotSendOtp}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Recovery OTP Bhejo</span>
                  </button>
                </div>
              )}

              {forgotStep === 'otp' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">
                      OTP Sent to: <strong>+91 {forgotPhone}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setForgotStep('phone')}
                      className="text-[11px] text-pink-400 underline font-semibold"
                    >
                      Change Number
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-300">6-Digit Recovery OTP</label>
                      <button
                        type="button"
                        onClick={handleForgotSendOtp}
                        disabled={timer > 0}
                        className="text-[11px] text-pink-400 hover:text-pink-300 font-bold underline disabled:text-gray-500"
                      >
                        {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit OTP code"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white font-mono tracking-widest text-base text-center focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleForgotVerifyOtp}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>OTP Verify Karein & Password Dekhein</span>
                  </button>
                </div>
              )}

              {forgotStep === 'recovered' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/60 to-black border-2 border-emerald-500/50 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Password Recovered!</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                        Verified
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/80 border border-white/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-pink-400 flex-shrink-0" />
                        <span className="font-mono text-base font-bold text-white tracking-wider select-all">
                          {showRecoveredPassword ? recoveredHostPassword : '••••••••'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowRecoveredPassword(!showRecoveredPassword)}
                          className="p-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white"
                        >
                          {showRecoveredPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(recoveredHostPassword);
                            setCopiedPassword(true);
                            setTimeout(() => setCopiedPassword(false), 2500);
                          }}
                          className="p-1.5 rounded-lg bg-pink-600/30 text-pink-300 flex items-center gap-1 text-xs"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      const res = await loginWithPassword(forgotPhone, recoveredHostPassword);
                      setLoading(false);
                      if (res.success) {
                        setSuccessMsg('✅ Login successful! Opening Host Dashboard...');
                        setTimeout(() => closeLoginModal(), 1200);
                      }
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Is Password Se Direct Login Karein</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotStep('new_password')}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 text-gray-200 text-xs font-bold"
                  >
                    Naya Password Set Karein (Change Password)
                  </button>
                </div>
              )}

              {forgotStep === 'new_password' && (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Naya Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Confirm Naya Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Same password dobara dalein"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>Save New Password & Login</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
