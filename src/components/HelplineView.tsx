import React from 'react';
import { Headphones, MessageCircle, Phone, ShieldCheck, Lock, Clock, HeartHandshake, ArrowRight, HelpCircle, ExternalLink } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

interface HelplineViewProps {
  onExploreSakhis: () => void;
}

export const HelplineView: React.FC<HelplineViewProps> = ({ onExploreSakhis }) => {
  const { settings } = useAdmin();

  const whatsappList = (settings.whatsappHelplines && settings.whatsappHelplines.length > 0)
    ? settings.whatsappHelplines
    : [{ id: 'wa-default', title: '24x7 WhatsApp Chat Support', number: settings.supportWhatsApp || '+91 98765 43210', type: 'whatsapp' as const, isPrimary: true }];

  const callList = (settings.callHelplines && settings.callHelplines.length > 0)
    ? settings.callHelplines
    : [{ id: 'call-default', title: 'Direct Phone Helpline', number: settings.supportPhone || '+91 98765 43210', type: 'call' as const, isPrimary: true }];

  const handleWhatsApp = (num: string) => {
    const clean = num.replace(/\D/g, '');
    const text = encodeURIComponent('Namaste SunoSakhi Support! Mujhe sahayata chahiye.');
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
  };

  const handleCall = (num: string) => {
    const clean = num.replace(/[^\d+]/g, '');
    window.location.href = `tel:${clean}`;
  };

  const FAQS = [
    {
      q: 'Kya meri call aur chat 100% private rehti hai?',
      a: 'Haan, SunoSakhi par sabhi voice aur video calls peer-to-peer encrypted hain. Aapka mobile number kabhi bhi kisi ke sath share nahi kiya jata.'
    },
    {
      q: 'Wallet recharge kaise karein?',
      a: 'Top bar me Wallet button par click karein aur UPI (PhonePe, Google Pay, Paytm) se 1-tap me coins add karein.'
    },
    {
      q: 'Host ladki apni kamai withdraw kaise kare?',
      a: 'Host dashboard me Withdraw button par click karke apna UPI ID ya Bank details daalein. Minimum ₹100 hone par instant payout request karein.'
    },
    {
      q: 'Agar OTP aane me samasya ho to kya karein?',
      a: 'Hamare gateway par screen par instant OTP badge dikhta hai jise aap 1-tap me Auto-fill karke bina delay ke login kar sakte hain.'
    }
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
          24x7 Customer Care
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          🎧 SunoSakhi 24x7 Help Line & Support
        </h2>
        <p className="text-xs sm:text-sm text-gray-400">
          Hamari support team aapki sahayata ke liye 24 ghante uplabdh hai. Niche diye gaye verified numbers par WhatsApp ya direct call karein.
        </p>
      </div>

      {/* Main Support Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WhatsApp Channels Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black uppercase text-emerald-300 tracking-wider">
              WhatsApp Support Channels ({whatsappList.length})
            </span>
          </div>

          {whatsappList.map((wa) => (
            <div
              key={wa.id}
              className="p-5 rounded-3xl bg-gradient-to-b from-[#0c2e1b] to-[#071d11] border border-emerald-500/40 shadow-xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  {wa.isPrimary && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-bold uppercase">
                      Primary
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{wa.title}</h3>
                  <p className="text-sm font-mono font-black text-emerald-300 mt-0.5">{wa.number}</p>
                  <p className="text-[11px] text-emerald-300/80">Average reply: Under 2 mins</p>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Payment enquiry, recharge status, host verification ya queries ke liye seedha WhatsApp karein.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleWhatsApp(wa.number)}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Message Bhejein</span>
              </button>
            </div>
          ))}
        </div>

        {/* Direct Phone Helpline Channels Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Phone className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-black uppercase text-pink-300 tracking-wider">
              Phone Helpline Channels ({callList.length})
            </span>
          </div>

          {callList.map((ph) => (
            <div
              key={ph.id}
              className="p-5 rounded-3xl bg-gradient-to-b from-[#1c0f33] to-[#110722] border border-pink-500/40 shadow-xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  {ph.isPrimary && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/30 text-pink-200 border border-pink-500/40 font-bold uppercase">
                      Toll-Free
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{ph.title}</h3>
                  <p className="text-sm font-mono font-black text-pink-300 mt-0.5">{ph.number}</p>
                  <p className="text-[11px] text-pink-300/80">Calling Support: 24 Hours Active</p>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Urgent help ya instant grievance redressing ke liye customer support par seedha call karein.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCall(ph.number)}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-950/60 transition-all active:scale-95"
              >
                <Phone className="w-4 h-4" />
                <span>Abhi Call Karein</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Safety & Trust Badges */}
      <div className="p-4 sm:p-5 rounded-3xl bg-black/50 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-gray-300">100% End-to-End Encrypted Baatein</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Lock className="w-5 h-5 text-pink-400 flex-shrink-0" />
          <span className="text-gray-300">Zero Mobile Number Disclosure</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span className="text-gray-300">24x7 Round-The-Clock Moderation</span>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#140826]/70 border border-pink-500/20 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-pink-400" />
          <span>Aksar Pooche Jaane Wale Sawal (FAQ)</span>
        </h3>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-pink-300">{faq.q}</h4>
              <p className="text-xs text-gray-300 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Back Button */}
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
