import React, { useState } from 'react';
import {
  User,
  Phone,
  Camera,
  Wallet,
  Download,
  Shield,
  LogOut,
  LogIn,
  CheckCircle2,
  Copy,
  Sparkles,
  Volume2,
  VolumeX,
  ArrowRight,
  TrendingUp,
  Globe,
  Heart,
  Check,
  Award,
  Radio,
  MessageCircle,
  Edit3
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import {
  getCurrentUser,
  logoutCurrentUser,
  updateUserProfilePhoto,
  updateUserProfileName,
  UserAccount,
  getActiveSession,
  broadcastAuthChange
} from '../services/userAuthSync';
import { isAdminUser, SUPER_ADMIN_PHONE } from '../services/adminSync';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { compressImageFile } from '../utils/imageCompressor';

interface SettingsViewProps {
  onExploreSakhis: () => void;
  onOpenAuth: (focus?: 'user' | 'host') => void;
  onOpenAdmin: () => void;
  onOpenRates: () => void;
  onOpenHelpline: () => void;
  onOpenHostDashboard?: () => void;
}

const CALLER_AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
];

const HOST_AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80'
];

const AVAILABLE_LANGUAGES = ['Hindi', 'Punjabi', 'English', 'Bhojpuri', 'Haryanvi', 'Gujarati', 'Marathi'];

export const SettingsView: React.FC<SettingsViewProps> = ({
  onExploreSakhis,
  onOpenAuth,
  onOpenAdmin,
  onOpenRates,
  onOpenHelpline,
  onOpenHostDashboard
}) => {
  const { settings } = useAdmin();
  const { balance, openWalletModal } = useWallet();
  const {
    userRole,
    setUserRole,
    hostProfile,
    isHostLoggedIn,
    logoutHost,
    registerHost,
    updateHostProfile,
    updateHostPhoto
  } = useHost();

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());
  const activeSession = getActiveSession();

  // Active Profile Mode: 'caller' or 'host'
  const [profileMode, setProfileMode] = useState<'caller' | 'host'>(() => {
    if (userRole === 'host' || isHostLoggedIn || activeSession.role === 'host') {
      return 'host';
    }
    return 'caller';
  });

  // Caller Profile State
  const [callerName, setCallerName] = useState(() => currentUser?.name || activeSession.name || 'Caller');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Host Girl Profile State
  const [hostName, setHostName] = useState(() => {
    if (hostProfile?.name && hostProfile.name !== 'Sakhi Host') return hostProfile.name;
    return currentUser?.name && currentUser.name !== 'Caller' ? currentUser.name : '';
  });
  const [hostAge, setHostAge] = useState<number>(() => hostProfile?.age || 22);
  const [hostCity, setHostCity] = useState(() => hostProfile?.city || 'Delhi');
  const [hostLanguages, setHostLanguages] = useState<string[]>(() =>
    hostProfile?.languages && hostProfile.languages.length > 0 ? hostProfile.languages : ['Hindi', 'English']
  );
  const [hostBio, setHostBio] = useState(() =>
    hostProfile?.bio || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon... 💕'
  );
  const [hostAvatar, setHostAvatar] = useState(() =>
    hostProfile?.avatar || HOST_AVATAR_PRESETS[0]
  );
  const [hostPassword, setHostPassword] = useState('sakhi123');

  // Messages & UI
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [savingHost, setSavingHost] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('sunosakhi_api_base_url') || '');
  const [serverSavedMsg, setServerSavedMsg] = useState(false);

  const userPhone = activeSession.phone || currentUser?.phone || hostProfile?.phone || '';

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveServerUrl = () => {
    if (serverUrl.trim()) {
      localStorage.setItem('sunosakhi_api_base_url', serverUrl.trim());
    } else {
      localStorage.removeItem('sunosakhi_api_base_url');
    }
    setServerSavedMsg(true);
    setTimeout(() => setServerSavedMsg(false), 2500);
  };

  const handleLogout = () => {
    if (userRole === 'host' || profileMode === 'host') {
      logoutHost();
    } else {
      logoutCurrentUser();
      setCurrentUser(null);
    }
    broadcastAuthChange();
    setStatusMessage('✅ Aapki ID successfully logout ho gayi hai.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Caller Photo Upload
  const handleCallerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsPhotoUploading(true);
      setStatusMessage(null);
      try {
        const compressed = await compressImageFile(file, 400, 0.82);
        await updateUserProfilePhoto(compressed);
        setCurrentUser(getCurrentUser());
        setStatusMessage('✅ Caller profile photo update ho gayi!');
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        console.error('Photo upload error:', err);
        setStatusMessage('⚠️ Photo upload me samasya aayi.');
      } finally {
        setIsPhotoUploading(false);
      }
    }
  };

  // Host Photo Upload
  const handleHostPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsPhotoUploading(true);
      setStatusMessage(null);
      try {
        const compressed = await compressImageFile(file, 400, 0.82);
        setHostAvatar(compressed);
        if (isHostLoggedIn) {
          updateHostPhoto(compressed);
        }
        setStatusMessage('✅ Host photo select ho gayi!');
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        console.error('Host photo error:', err);
        setStatusMessage('⚠️ Photo upload me samasya aayi.');
      } finally {
        setIsPhotoUploading(false);
      }
    }
  };

  // Save Caller Profile
  const handleSaveCallerProfile = async () => {
    if (!callerName.trim()) {
      setStatusMessage('⚠️ Kripya apna naam dalein.');
      return;
    }
    await updateUserProfileName(callerName.trim());
    setCurrentUser(getCurrentUser());
    setUserRole('caller');
    localStorage.setItem('sunosakhi_user_role', 'caller');
    broadcastAuthChange();
    setStatusMessage('✅ Caller Profile successfully update ho gayi!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Save / Activate Host Girl Profile
  const handleSaveHostProfile = async () => {
    if (!hostName.trim()) {
      setStatusMessage('⚠️ Kripya Host Sakhi ka naam darj karein.');
      return;
    }
    if (!userPhone || userPhone.length < 10) {
      setStatusMessage('⚠️ Mobile number nahi mila. Kripya dobara sign in karein.');
      return;
    }

    setSavingHost(true);
    setStatusMessage(null);

    try {
      const res = await registerHost({
        phone: userPhone,
        name: hostName.trim(),
        password: hostPassword || 'sakhi123',
        city: hostCity.trim() || 'Delhi',
        languages: hostLanguages.length > 0 ? hostLanguages : ['Hindi', 'English'],
        age: hostAge || 22,
        bio: hostBio.trim() || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
        avatar: hostAvatar,
        gender: 'female'
      });

      if (res.success) {
        setUserRole('host');
        localStorage.setItem('sunosakhi_user_role', 'host');
        localStorage.setItem('sunosakhi_host_logged_in', 'true');
        broadcastAuthChange();
        setStatusMessage('🎉 Mubarak! Host Girl Profile ban gayi aur activate ho gayi!');
        setTimeout(() => {
          if (onOpenHostDashboard) {
            onOpenHostDashboard();
          } else {
            onExploreSakhis();
          }
        }, 1200);
      } else {
        // Fallback: update existing host profile
        updateHostProfile({
          name: hostName.trim(),
          age: hostAge || 22,
          city: hostCity.trim() || 'Delhi',
          languages: hostLanguages,
          bio: hostBio.trim(),
          avatar: hostAvatar,
          status: 'online',
          isVerified: true
        });
        setUserRole('host');
        localStorage.setItem('sunosakhi_user_role', 'host');
        localStorage.setItem('sunosakhi_host_logged_in', 'true');
        broadcastAuthChange();
        setStatusMessage('🎉 Mubarak! Host Girl Profile update ho gayi aur online hai!');
      }
    } catch (err: any) {
      setStatusMessage('⚠️ Host profile save karne me samasya aayi: ' + (err?.message || ''));
    } finally {
      setSavingHost(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    if (hostLanguages.includes(lang)) {
      if (hostLanguages.length > 1) {
        setHostLanguages(hostLanguages.filter((l) => l !== lang));
      }
    } else {
      setHostLanguages([...hostLanguages, lang]);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="text-center max-w-xl mx-auto space-y-1.5">
        <span className="px-3.5 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Profile & Account Setup</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          👤 Apni Profile Banayein
        </h2>
        <p className="text-xs sm:text-sm text-gray-400">
          Chunein ki aap <span className="text-white font-bold">Caller</span> hain ya <span className="text-pink-400 font-bold">Host Girl</span> — aur apni profile setup karein.
        </p>
      </div>

      {/* Status Message Banner */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-lg animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* MAIN ROLE SELECTOR: CALLER vs HOST GIRL                      */}
      {/* ============================================================ */}
      <div className="p-1.5 rounded-3xl bg-black/70 border border-pink-500/30 shadow-2xl">
        <div className="grid grid-cols-2 gap-2">
          {/* 1. CALLER TAB */}
          <button
            type="button"
            onClick={() => {
              setProfileMode('caller');
              setUserRole('caller');
            }}
            className={`py-3 sm:py-4 px-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex flex-col sm:flex-row items-center justify-center gap-2 ${
              profileMode === 'caller'
                ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white shadow-lg shadow-pink-600/30 scale-[1.01]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="p-2 rounded-xl bg-white/10">
              <Phone className="w-4 h-4" />
            </div>
            <div className="text-center sm:text-left">
              <span className="block leading-tight">📞 Caller Profile</span>
              <span className="text-[10px] font-normal text-pink-200/80 block">Baat Karne Wale</span>
            </div>
          </button>

          {/* 2. HOST GIRL TAB */}
          <button
            type="button"
            onClick={() => {
              setProfileMode('host');
              setUserRole('host');
            }}
            className={`py-3 sm:py-4 px-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex flex-col sm:flex-row items-center justify-center gap-2 ${
              profileMode === 'host'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30 scale-[1.01]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="p-2 rounded-xl bg-white/10">
              <Heart className="w-4 h-4" />
            </div>
            <div className="text-center sm:text-left">
              <span className="block leading-tight">🌸 Host Girl Profile</span>
              <span className="text-[10px] font-normal text-emerald-200/80 block">Kamai Karne Wali Sakhi</span>
            </div>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION A: CALLER PROFILE VIEW & SETUP                       */}
      {/* ============================================================ */}
      {profileMode === 'caller' && (
        <div className="p-5 sm:p-7 rounded-3xl bg-[#140826]/90 border border-pink-500/30 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-pink-500/20 text-pink-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Caller Profile Settings</h3>
                <p className="text-xs text-pink-300/80">Online Sakhis se baat karne ke liye apni profile customize karein</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Caller Avatar + Photo Selector */}
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-pink-500/60 p-0.5 bg-gradient-to-tr from-pink-500 to-purple-600 shadow-xl">
                <img
                  src={currentUser?.avatar || CALLER_AVATAR_PRESETS[0]}
                  alt="Caller Profile"
                  className="w-full h-full object-cover rounded-[22px]"
                />
                {isPhotoUploading && (
                  <div className="absolute inset-0 bg-black/75 rounded-[22px] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-pink-300 animate-pulse">Saving...</span>
                  </div>
                )}
              </div>
              <label
                className="absolute -bottom-1 -right-1 p-2.5 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 hover:from-pink-500 text-white cursor-pointer shadow-lg border-2 border-[#140826] hover:scale-110 active:scale-95 transition-all"
                title="Upload Photo"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isPhotoUploading}
                  onChange={handleCallerPhotoUpload}
                />
              </label>
            </div>

            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Aapka Naam (Caller Name)</label>
                <input
                  type="text"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  placeholder="e.g. Rahul, Aman, Vicky"
                  className="w-full px-4 py-2.5 rounded-2xl bg-black/60 border border-pink-500/30 text-white text-sm focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1.5 font-mono text-pink-300">
                  <Phone className="w-3.5 h-3.5" />
                  <span>+91 {userPhone || 'Logged In'}</span>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  Verified Mobile ✅
                </span>
              </div>

              {/* Preset Avatars */}
              <div>
                <span className="text-[11px] text-gray-400 block mb-1.5">Preset Avatars me se chunein:</span>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {CALLER_AVATAR_PRESETS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={async () => {
                        await updateUserProfilePhoto(url);
                        setCurrentUser(getCurrentUser());
                        setStatusMessage('✅ Profile photo update ho gayi!');
                        setTimeout(() => setStatusMessage(null), 2500);
                      }}
                      className={`relative w-10 h-10 rounded-2xl overflow-hidden border transition-all flex-shrink-0 ${
                        currentUser?.avatar === url
                          ? 'border-pink-500 ring-2 ring-pink-500 scale-105'
                          : 'border-white/20 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveCallerProfile}
              className="w-full sm:w-auto flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 text-white font-black text-sm shadow-xl shadow-pink-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save Caller Profile</span>
            </button>

            {userRole === 'host' && (
              <button
                type="button"
                onClick={() => {
                  setUserRole('caller');
                  localStorage.setItem('sunosakhi_user_role', 'caller');
                  broadcastAuthChange();
                  setStatusMessage('✅ Switched to Caller Mode');
                  setTimeout(() => setStatusMessage(null), 2500);
                }}
                className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all"
              >
                Switch to Caller Mode
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION B: HOST GIRL PROFILE VIEW & SETUP                    */}
      {/* ============================================================ */}
      {profileMode === 'host' && (
        <div className="p-5 sm:p-7 rounded-3xl bg-[#0e1815]/95 border border-emerald-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Host Girl (Sakhi) Profile</h3>
                <p className="text-xs text-emerald-300/80">
                  Callers se audio/video calls aur chats attend karke direct kamayein!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(isHostLoggedIn || userRole === 'host') && (
                <>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Host Active</span>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Logout Host Account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Rate Card & Host Earning Badge */}
          <div className="p-3.5 rounded-2xl bg-black/60 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <span className="text-xs font-black text-white">Fixed Rates & Host Earning Share</span>
                <p className="text-[11px] text-gray-400">Har call aur message ka direct share aapke wallet me add hota hai</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                Voice ₹5/min
              </span>
              <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                Video ₹10/min
              </span>
              <span className="px-2 py-1 rounded-lg bg-pink-500/20 text-pink-300 text-[10px] font-bold">
                Chat ₹2/msg
              </span>
            </div>
          </div>

          {/* Host Girl Photo & Inputs */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Host Avatar Picker */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-emerald-500/60 p-0.5 bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-xl">
                <img
                  src={hostAvatar}
                  alt="Host Girl Photo"
                  className="w-full h-full object-cover rounded-[22px]"
                />
                {isPhotoUploading && (
                  <div className="absolute inset-0 bg-black/75 rounded-[22px] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-emerald-300 animate-pulse">Saving...</span>
                  </div>
                )}
              </div>
              <label
                className="absolute -bottom-1 -right-1 p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 text-white cursor-pointer shadow-lg border-2 border-[#0e1815] hover:scale-110 active:scale-95 transition-all"
                title="Upload Custom Photo"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isPhotoUploading}
                  onChange={handleHostPhotoUpload}
                />
              </label>
            </div>

            {/* Host Form Fields */}
            <div className="flex-1 w-full space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Host Girl Sakhi Display Name <span className="text-pink-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="e.g. Priya Sharma, Ananya, Simran"
                    className="w-full px-4 py-2.5 rounded-2xl bg-black/60 border border-emerald-500/30 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Age (18+ Mahila Only) <span className="text-pink-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={55}
                    value={hostAge}
                    onChange={(e) => setHostAge(Number(e.target.value) || 22)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-black/60 border border-emerald-500/30 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    City / Sheher
                  </label>
                  <input
                    type="text"
                    value={hostCity}
                    onChange={(e) => setHostCity(e.target.value)}
                    placeholder="e.g. Delhi, Mumbai, Jaipur"
                    className="w-full px-4 py-2.5 rounded-2xl bg-black/60 border border-emerald-500/30 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Host Mobile Number
                  </label>
                  <div className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-emerald-300 font-mono text-sm flex items-center justify-between">
                    <span>+91 {userPhone || 'Verified'}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">100% Private 🔒</span>
                  </div>
                </div>
              </div>

              {/* Languages Multi-Select Chips */}
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1.5">
                  Languages Spoken (Bhashayein)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_LANGUAGES.map((lang) => {
                    const isSelected = hostLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border border-emerald-400 shadow-sm'
                            : 'bg-black/50 text-gray-400 border border-white/10 hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bio / Description */}
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">
                  Bio / Apne Baare Me
                </label>
                <textarea
                  rows={2}
                  value={hostBio}
                  onChange={(e) => setHostBio(e.target.value)}
                  placeholder="Dil se baat karne ke liye hamesha ready... friendly & caring companion 💕"
                  className="w-full px-4 py-2.5 rounded-2xl bg-black/60 border border-emerald-500/30 text-white text-xs focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Preset Glam Host Avatars */}
              <div>
                <span className="text-[11px] text-gray-400 block mb-1.5">Host Girl Avatars me se chunein:</span>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {HOST_AVATAR_PRESETS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHostAvatar(url)}
                      className={`relative w-11 h-11 rounded-2xl overflow-hidden border transition-all flex-shrink-0 ${
                        hostAvatar === url
                          ? 'border-emerald-500 ring-2 ring-emerald-500 scale-105'
                          : 'border-white/20 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Host ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              disabled={savingHost || !hostName.trim()}
              onClick={handleSaveHostProfile}
              className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 text-black font-black text-sm shadow-xl shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingHost ? (
                <span>Saving Profile...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>🌸 Save & Activate Host Girl Profile</span>
                </>
              )}
            </button>

            {(isHostLoggedIn || userRole === 'host') && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenHostDashboard) {
                    onOpenHostDashboard();
                  } else {
                    onExploreSakhis();
                  }
                }}
                className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 text-white font-bold text-xs transition-all shadow"
              >
                📊 Open Host Dashboard
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setUserRole('caller');
                localStorage.setItem('sunosakhi_user_role', 'caller');
                broadcastAuthChange();
                setStatusMessage('✅ Switched to Caller Mode');
                setTimeout(() => setStatusMessage(null), 2500);
              }}
              className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all"
            >
              Switch to Caller Mode
            </button>
          </div>
        </div>
      )}

      {/* Wallet & Quick Action Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Wallet / Earnings Card */}
        <div className="p-5 rounded-3xl bg-black/50 border border-pink-500/20 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-pink-500/20 text-pink-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400">Coins Balance</span>
              <h4 className="text-xl font-black text-white">₹{((balance ?? 0) || 0).toFixed(2)}</h4>
            </div>
          </div>
          <button
            onClick={openWalletModal}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white text-xs font-bold shadow transition-all"
          >
            + Add Coins
          </button>
        </div>

        {/* Sound & Audio Toggle */}
        <div className="p-5 rounded-3xl bg-black/50 border border-purple-500/20 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
              {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400">Audio & Rings</span>
              <h4 className="text-sm font-bold text-white">{soundEnabled ? 'Sound Enabled' : 'Muted'}</h4>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled((p) => !p)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              soundEnabled ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-400'
            }`}
          >
            {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Backend Server Connection Settings */}
      <div className="p-5 rounded-3xl bg-black/50 border border-blue-500/30 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">🌐 Backend Server & Calling Network</h4>
              <p className="text-[11px] text-gray-400">Host sync aur WebRTC signaling backend server IP</p>
            </div>
          </div>
          {serverSavedMsg && (
            <span className="text-xs text-emerald-400 font-bold animate-pulse">Saved! ✅</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="e.g. http://192.168.1.5:5173 (khali chhodne par default localhost:5173)"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleSaveServerUrl}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow active:scale-95"
          >
            Save URL
          </button>
        </div>
      </div>

      {/* Navigation Quick Links Grid */}
      <div className="p-5 rounded-3xl bg-black/40 border border-white/10 space-y-3">
        <h4 className="text-xs uppercase font-bold text-gray-400 tracking-wider">Quick Navigation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={onOpenRates}
            className="p-3.5 rounded-2xl bg-[#160a28] hover:bg-[#200e3a] border border-pink-500/20 text-left space-y-1 transition-all group"
          >
            <span className="text-xs font-black text-pink-300 group-hover:text-white flex items-center justify-between">
              <span>🏷️ Rate Card</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
            <p className="text-[10px] text-gray-400">Voice ₹5, Video ₹10, Chat ₹2 & Host earning</p>
          </button>

          <button
            onClick={onOpenHelpline}
            className="p-3.5 rounded-2xl bg-[#0c2417] hover:bg-[#123623] border border-emerald-500/20 text-left space-y-1 transition-all group"
          >
            <span className="text-xs font-black text-emerald-300 group-hover:text-white flex items-center justify-between">
              <span>🎧 24x7 Helpline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
            <p className="text-[10px] text-gray-400">WhatsApp chat & direct calling support</p>
          </button>

          <a
            href="/download"
            download="Suno-Sakhi.apk"
            className="p-3.5 rounded-2xl bg-[#241238] hover:bg-[#321850] border border-purple-500/20 text-left space-y-1 transition-all group block"
          >
            <span className="text-xs font-black text-purple-300 group-hover:text-white flex items-center justify-between">
              <span>📥 Download APK</span>
              <Download className="w-3.5 h-3.5" />
            </span>
            <p className="text-[10px] text-gray-400">Latest Android app download (~7 MB)</p>
          </a>
        </div>

        {/* Global Logout Action Button */}
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>🚪 Logout Current ID / Switch Account</span>
        </button>
      </div>

      {/* Helpline & WhatsApp Number Direct Access Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#0d2a1b] via-[#160a2c] to-[#250d3a] border border-emerald-500/40 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>🎧 24x7 Customer Helpline & WhatsApp Numbers</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 uppercase">
                  Live Active
                </span>
              </h4>
              <p className="text-xs text-gray-300 mt-0.5">
                Calling: <strong className="font-mono text-pink-300">{settings.supportPhone || '+91 7009600157'}</strong> | WhatsApp: <strong className="font-mono text-emerald-300">{settings.supportWhatsApp || '+91 7009600157'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onOpenHelpline}
            className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>✏️ Number Badalna / Add Karna</span>
          </button>
        </div>
      </div>

      {/* Master Admin Portal Access Section */}
      {(() => {
        const session = getActiveSession();
        const isSuperAdmin = isAdminUser(session?.phone);
        return (
          <div className={`p-5 rounded-3xl border flex items-center justify-between shadow-xl transition-all ${
            isSuperAdmin
              ? 'bg-gradient-to-r from-[#2b1b05] via-[#3d1222] to-[#1f0729] border-amber-500/60 ring-1 ring-amber-500/30'
              : 'bg-gradient-to-r from-[#21092e] to-[#341144] border-pink-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl border ${
                isSuperAdmin
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-pink-500/20 text-pink-400 border-pink-500/30'
              }`}>
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white">
                    {isSuperAdmin ? '👑 Super Admin Console' : 'Master Admin Portal'}
                  </h4>
                  {isSuperAdmin && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      {SUPER_ADMIN_PHONE}
                    </span>
                  )}
                </div>
                <p className="text-xs text-pink-300/80">
                  {isSuperAdmin
                    ? 'Callers & Hosts Directory, Balances Kam/Jyada karein, Accounts Delete karein.'
                    : 'Withdrawal payments release, Host IDs & User IDs directory'}
                </p>
              </div>
            </div>
            <button
              onClick={onOpenAdmin}
              className={`px-4 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all ${
                isSuperAdmin
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-black'
                  : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white'
              }`}
            >
              {isSuperAdmin ? 'Open Admin Console' : 'Open Admin'}
            </button>
          </div>
        );
      })()}

      {/* Return to Sakhis */}
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
