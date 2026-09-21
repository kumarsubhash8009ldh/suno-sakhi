import React from 'react';
import {
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  ExternalLink,
  Sparkles,
  Smartphone
} from 'lucide-react';

interface ApkInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkInstallGuideModal: React.FC<ApkInstallGuideModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-[32px] bg-gradient-to-b from-[#240c38] via-[#160624] to-[#0a0210] border-2 border-pink-500/60 p-5 sm:p-6 text-white shadow-2xl shadow-pink-900/60 max-h-[92vh] overflow-y-auto"
      >
        {/* Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-600/25 blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="p-2 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <Download className="w-5 h-5 animate-bounce" />
          </span>
          <div>
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 uppercase">
              Latest Version (29 MB)
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              APK Download & Install Guide
            </h2>
          </div>
        </div>

        <p className="text-xs text-gray-300 mb-4 leading-relaxed">
          Agar aapke phone par APK download ya install hone mein problem aa rahi hai, toh neeche diye gaye <strong className="text-pink-300">3 aasan steps</strong> follow karein:
        </p>

        {/* 3 Step Cards */}
        <div className="space-y-3 mb-5">
          {/* Step 1: Uninstall Old Version */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-red-500/30 flex items-start gap-3 shadow-inner">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0 mt-0.5">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                <span>Step 1: Purana App Uninstall Karein</span>
                <span className="text-[9px] bg-red-600/40 text-red-200 px-1.5 py-0.5 rounded-full font-black">Most Important</span>
              </h4>
              <p className="text-[11px] text-gray-300 leading-snug">
                Agar aapke phone mein pehle se purana SunoSakhi install hai, toh pehle use phone se <strong>Delete / Uninstall</strong> kar dein. Purane app ke rehte naya version <em>'App Not Installed'</em> bolkar fail ho jata hai.
              </p>
            </div>
          </div>

          {/* Step 2: Chrome Unknown Source Permission */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/30 flex items-start gap-3 shadow-inner">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-300">
                Step 2: "Allow Unknown Apps" ON Karein
              </h4>
              <p className="text-[11px] text-gray-300 leading-snug">
                File download hone ke baad jab aap use tap karenge, Chrome puchega: <em>'For your security...'</em>. Wahan <strong>Settings</strong> par tap karke <strong>'Allow from this source' (इस स्रोत से अनुमति दें)</strong> ko ON karein.
              </p>
            </div>
          </div>

          {/* Step 3: Google Play Protect Bypass */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/30 flex items-start gap-3 shadow-inner">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-purple-300">
                Step 3: "Install Anyway" Par Tap Karein
              </h4>
              <p className="text-[11px] text-gray-300 leading-snug">
                Kyunki ye official direct APK hai, Google Play Protect warning dikha sakta hai. Wahan <strong>'More details' (अधिक विवरण)</strong> par tap karein aur neeche <strong>'Install anyway' (फिर भी इंस्टॉल करें)</strong> par click karein.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <a
            href="/suno-sakhi.apk"
            download="suno-sakhi.apk"
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-pink-600/40 flex items-center justify-center gap-2 transition-all border border-pink-300/30"
          >
            <Download className="w-4 h-4" />
            <span>Dubara Download Karein (Direct APK 29 MB)</span>
          </a>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Bina Install Kiye Web Par Hi Chalayein (Same Speed)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
