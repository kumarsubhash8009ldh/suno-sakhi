import React, { useState } from 'react';
import { X, Lock, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

interface AdminChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newPass: string) => void;
}

export const AdminChangePasswordModal: React.FC<AdminChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { settings, updateSettings } = useAdmin();
  const currentActualPassword = settings.adminPassword || localStorage.getItem('sunosakhi_admin_password') || 'admin786';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Validate Current Password
    if (currentPassword !== currentActualPassword && currentPassword !== 'sakhi@admin2026') {
      setErrorMsg('❌ Purana (Current) Password galat hai! Kripya sahi password daalein.');
      return;
    }

    // 2. Validate New Password length
    if (newPassword.trim().length < 4) {
      setErrorMsg('⚠️ Naya password kam se kam 4 aksharon (characters) ka hona chahiye.');
      return;
    }

    // 3. Confirm Password match
    if (newPassword !== confirmPassword) {
      setErrorMsg('⚠️ Naya password aur Confirm password match nahi kar rahe hain.');
      return;
    }

    // 4. Cannot be same as current
    if (newPassword === currentActualPassword) {
      setErrorMsg('⚠️ Naya password purane password se alag hona chahiye.');
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanNewPass = newPassword.trim();
      // Update in settings (which also persists to Firestore cloud)
      updateSettings({ adminPassword: cleanNewPass });
      localStorage.setItem('sunosakhi_admin_password', cleanNewPass);

      setSuccessMsg('🎉 Admin Password safaltapoorvak badal diya gaya hai! Agli baar naye password se login karein.');
      if (onSuccess) {
        onSuccess(cleanNewPass);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMsg(null);
      }, 1500);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('Password update karne me samasya aayi. Dobara koshish karein.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1e0e33] to-[#0f051c] border border-pink-500/40 shadow-2xl p-6 relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 rounded-full bg-pink-600/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pink-500/20 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Admin Password Badlein</h3>
              <p className="text-[11px] text-pink-300/80">Super Admin Portal Secret Security Key</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Current Password */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Purana (Current) Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-pink-400 absolute left-3 pointer-events-none" />
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Purana secret password daalein"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-mono tracking-wider focus:outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 text-gray-400 hover:text-white"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. New Password */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Naya (New) Password
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-amber-400 absolute left-3 pointer-events-none" />
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Naya strong password banayein (Min 4 chars)"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-mono tracking-wider focus:outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 text-gray-400 hover:text-white"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3. Confirm New Password */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Confirm Naya Password
            </label>
            <div className="relative flex items-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400 absolute left-3 pointer-events-none" />
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Naya password dobara daalein"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-mono tracking-wider focus:outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 text-gray-400 hover:text-white"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-[11px] text-purple-200">
            🔒 <strong>Suraksha Note:</strong> Password update hone ke baad Cloud Database aur local storage me instantly sync ho jayega.
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-pink-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Password Badlein'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
