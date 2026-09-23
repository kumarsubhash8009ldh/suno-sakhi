import React, { useState, useEffect } from 'react';
import {
  Headphones,
  MessageCircle,
  Phone,
  ShieldCheck,
  Lock,
  Clock,
  HeartHandshake,
  ArrowRight,
  HelpCircle,
  ExternalLink,
  PlusCircle,
  Edit3,
  Trash2,
  Check,
  X,
  Shield,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Settings
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { useActiveSession } from '../services/userAuthSync';
import { isAdminUser, SUPER_ADMIN_PHONE } from '../services/adminSync';
import { HelplineContact } from '../types';

interface HelplineViewProps {
  onExploreSakhis: () => void;
  onOpenAdmin?: () => void;
}

export const HelplineView: React.FC<HelplineViewProps> = ({ onExploreSakhis, onOpenAdmin }) => {
  const { settings, updateSettings } = useAdmin();
  const session = useActiveSession();
  const isSuperAdminAccount = isAdminUser(session?.phone);

  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return isSuperAdminAccount || sessionStorage.getItem('sunosakhi_admin_session') === 'active';
  });

  const [showPasscodeModal, setShowPasscodeModal] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick 1-click update states
  const [quickPhoneInput, setQuickPhoneInput] = useState<string>(
    settings.supportPhone || '+91 7009600157'
  );
  const [quickWaInput, setQuickWaInput] = useState<string>(
    settings.supportWhatsApp || '+91 7009600157'
  );

  // Add new number states
  const [showAddSection, setShowAddSection] = useState<boolean>(false);
  const [newCallTitle, setNewCallTitle] = useState('');
  const [newCallNumber, setNewCallNumber] = useState('');
  const [newWaTitle, setNewWaTitle] = useState('');
  const [newWaNumber, setNewWaNumber] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNumber, setEditNumber] = useState('');

  useEffect(() => {
    if (isSuperAdminAccount) {
      setIsAdminMode(true);
      sessionStorage.setItem('sunosakhi_admin_session', 'active');
    }
  }, [isSuperAdminAccount]);

  useEffect(() => {
    if (settings.supportPhone) setQuickPhoneInput(settings.supportPhone);
    if (settings.supportWhatsApp) setQuickWaInput(settings.supportWhatsApp);
  }, [settings.supportPhone, settings.supportWhatsApp]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const whatsappList: HelplineContact[] =
    settings.whatsappHelplines && settings.whatsappHelplines.length > 0
      ? settings.whatsappHelplines
      : [
          {
            id: 'wa-default',
            title: '24x7 WhatsApp Chat Support',
            number: settings.supportWhatsApp || '+91 7009600157',
            type: 'whatsapp',
            isPrimary: true
          }
        ];

  const callList: HelplineContact[] =
    settings.callHelplines && settings.callHelplines.length > 0
      ? settings.callHelplines
      : [
          {
            id: 'call-default',
            title: 'Direct Phone Helpline',
            number: settings.supportPhone || '+91 7009600157',
            type: 'call',
            isPrimary: true
          }
        ];

  const handleWhatsApp = (num: string) => {
    const clean = num.replace(/\D/g, '');
    const text = encodeURIComponent('Namaste SunoSakhi Support! Mujhe sahayata chahiye.');
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
  };

  const handleCall = (num: string) => {
    const clean = num.replace(/[^\d+]/g, '');
    window.location.href = `tel:${clean}`;
  };

  // Admin Unlock
  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError(null);
    if (
      passcodeInput === 'admin786' ||
      passcodeInput === 'sakhi@admin2026' ||
      passcodeInput === '123456' ||
      isSuperAdminAccount
    ) {
      setIsAdminMode(true);
      sessionStorage.setItem('sunosakhi_admin_session', 'active');
      setShowPasscodeModal(false);
      setPasscodeInput('');
      showToast('success', '👑 Admin Mode On! Ab aap number add aur update kar sakte hain.');
    } else {
      setPasscodeError('Galat passcode! Kripya sahi admin passcode darj karein.');
    }
  };

  // Quick update Calling number
  const handleQuickUpdateCall = () => {
    if (!quickPhoneInput.trim()) {
      showToast('error', 'Kripya valid Calling number dalein.');
      return;
    }
    const clean = quickPhoneInput.trim();
    let updated = [...callList];
    const pIdx = updated.findIndex((c) => c.isPrimary);
    if (pIdx >= 0) {
      updated[pIdx] = { ...updated[pIdx], number: clean };
    } else if (updated.length > 0) {
      updated[0] = { ...updated[0], number: clean, isPrimary: true };
    } else {
      updated = [{ id: 'call-' + Date.now(), title: 'Direct Phone Helpline', number: clean, type: 'call', isPrimary: true }];
    }
    updateSettings({
      callHelplines: updated,
      supportPhone: clean
    });
    showToast('success', '✅ Primary Calling Number update ho gaya: ' + clean);
  };

  // Quick update WhatsApp number
  const handleQuickUpdateWhatsApp = () => {
    if (!quickWaInput.trim()) {
      showToast('error', 'Kripya valid WhatsApp number dalein.');
      return;
    }
    const clean = quickWaInput.trim();
    let updated = [...whatsappList];
    const pIdx = updated.findIndex((w) => w.isPrimary);
    if (pIdx >= 0) {
      updated[pIdx] = { ...updated[pIdx], number: clean };
    } else if (updated.length > 0) {
      updated[0] = { ...updated[0], number: clean, isPrimary: true };
    } else {
      updated = [{ id: 'wa-' + Date.now(), title: 'WhatsApp Chat Support', number: clean, type: 'whatsapp', isPrimary: true }];
    }
    updateSettings({
      whatsappHelplines: updated,
      supportWhatsApp: clean
    });
    showToast('success', '✅ Primary WhatsApp Number update ho gaya: ' + clean);
  };

  // Add new Call Number
  const handleAddCall = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCallNumber.trim()) {
      showToast('error', 'Kripya valid phone number dalein.');
      return;
    }
    const newEntry: HelplineContact = {
      id: 'call-' + Date.now(),
      title: newCallTitle.trim() || 'Direct Phone Helpline',
      number: newCallNumber.trim(),
      type: 'call',
      isPrimary: callList.length === 0
    };
    const updated = [...callList, newEntry];
    updateSettings({
      callHelplines: updated,
      supportPhone: updated.find((c) => c.isPrimary)?.number || updated[0].number
    });
    setNewCallTitle('');
    setNewCallNumber('');
    showToast('success', '✅ Naya Calling Helpline Number add ho gaya!');
  };

  // Add new WhatsApp Number
  const handleAddWa = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newWaNumber.trim()) {
      showToast('error', 'Kripya valid WhatsApp number dalein.');
      return;
    }
    const newEntry: HelplineContact = {
      id: 'wa-' + Date.now(),
      title: newWaTitle.trim() || 'WhatsApp Chat Support',
      number: newWaNumber.trim(),
      type: 'whatsapp',
      isPrimary: whatsappList.length === 0
    };
    const updated = [...whatsappList, newEntry];
    updateSettings({
      whatsappHelplines: updated,
      supportWhatsApp: updated.find((w) => w.isPrimary)?.number || updated[0].number
    });
    setNewWaTitle('');
    setNewWaNumber('');
    showToast('success', '✅ Naya WhatsApp Support Number add ho gaya!');
  };

  // Start Inline Edit
  const handleStartEdit = (item: HelplineContact) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditNumber(item.number);
  };

  // Save Inline Edit
  const handleSaveEdit = (id: string, type: 'call' | 'whatsapp') => {
    if (!editNumber.trim()) {
      showToast('error', 'Number khali nahi ho sakta.');
      return;
    }
    if (type === 'call') {
      const updated = callList.map((c) =>
        c.id === id ? { ...c, title: editTitle.trim() || c.title, number: editNumber.trim() } : c
      );
      const prim = updated.find((c) => c.isPrimary) || updated[0];
      updateSettings({
        callHelplines: updated,
        supportPhone: prim?.number || ''
      });
    } else {
      const updated = whatsappList.map((w) =>
        w.id === id ? { ...w, title: editTitle.trim() || w.title, number: editNumber.trim() } : w
      );
      const prim = updated.find((w) => w.isPrimary) || updated[0];
      updateSettings({
        whatsappHelplines: updated,
        supportWhatsApp: prim?.number || ''
      });
    }
    setEditingId(null);
    showToast('success', '✅ Number safaltapoorvak update ho gaya!');
  };

  // Remove
  const handleRemove = (id: string, type: 'call' | 'whatsapp') => {
    if (type === 'call') {
      if (callList.length <= 1) {
        if (!window.confirm('Yeh aakhri phone number hai. Kya aap ise hatana chahte hain?')) return;
      }
      const updated = callList.filter((c) => c.id !== id);
      updateSettings({
        callHelplines: updated,
        supportPhone: updated[0]?.number || ''
      });
    } else {
      if (whatsappList.length <= 1) {
        if (!window.confirm('Yeh aakhri WhatsApp number hai. Kya aap ise hatana chahte hain?')) return;
      }
      const updated = whatsappList.filter((w) => w.id !== id);
      updateSettings({
        whatsappHelplines: updated,
        supportWhatsApp: updated[0]?.number || ''
      });
    }
    showToast('success', 'Number hata diya gaya.');
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
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 shadow-2xl animate-bounce-short ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/95 border-red-500/50 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* ================================================================= */}
      {/* 👑 ADMIN HELPLINE MANAGEMENT PANEL (DIRECT ON HELPLINE VIEW)      */}
      {/* ================================================================= */}
      {isAdminMode ? (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#21092e] via-[#150a24] to-[#0a1e12] border-2 border-emerald-500/50 shadow-2xl space-y-4 ring-1 ring-emerald-500/30">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>👑 Admin Support Control Hub</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-[10px] uppercase font-bold">
                    Active
                  </span>
                </h3>
                <p className="text-xs text-gray-300">
                  Aap yahan se apna Calling Helpline aur WhatsApp number live badal (update) ya naya add kar sakte hain.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddSection(!showAddSection)}
                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{showAddSection ? 'Hide Add Form' : '➕ Naya Number Jodein'}</span>
              </button>
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white font-bold text-xs flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Full Admin Panel</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick 1-Click Update Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Quick Phone Update */}
            <div className="p-3.5 rounded-2xl bg-black/50 border border-pink-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-pink-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  ⚡ Quick Update Calling Number:
                </span>
                <span className="text-[10px] text-pink-400/80 font-mono">Current: {settings.supportPhone}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickPhoneInput}
                  onChange={(e) => setQuickPhoneInput(e.target.value)}
                  placeholder="+91 7009600157"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/70 border border-pink-500/30 text-white font-mono text-xs focus:outline-none focus:border-pink-500"
                />
                <button
                  type="button"
                  onClick={handleQuickUpdateCall}
                  className="py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs whitespace-nowrap shadow flex items-center gap-1 active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Call</span>
                </button>
              </div>
            </div>

            {/* Quick WhatsApp Update */}
            <div className="p-3.5 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" />
                  ⚡ Quick Update WhatsApp Number:
                </span>
                <span className="text-[10px] text-emerald-400/80 font-mono">Current: {settings.supportWhatsApp}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickWaInput}
                  onChange={(e) => setQuickWaInput(e.target.value)}
                  placeholder="+91 7009600157"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/70 border border-emerald-500/30 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleQuickUpdateWhatsApp}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs whitespace-nowrap shadow flex items-center gap-1 active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Add New Number Form (Expandable) */}
          {showAddSection && (
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-4 animate-in fade-in duration-200">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                ➕ Naye Numbers Add Karein:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Add Calling Number */}
                <form onSubmit={handleAddCall} className="p-3 rounded-xl bg-pink-950/20 border border-pink-500/30 space-y-2">
                  <span className="text-xs font-bold text-pink-300 block">📞 Naya Calling Number:</span>
                  <input
                    type="text"
                    value={newCallTitle}
                    onChange={(e) => setNewCallTitle(e.target.value)}
                    placeholder="Title (e.g. 24x7 Direct Phone Helpline)"
                    className="w-full px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white text-xs"
                  />
                  <input
                    type="text"
                    value={newCallNumber}
                    onChange={(e) => setNewCallNumber(e.target.value)}
                    placeholder="Mobile / Phone (e.g. +91 7009600157)"
                    className="w-full px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white font-mono text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Calling Line</span>
                  </button>
                </form>

                {/* Add WhatsApp Number */}
                <form onSubmit={handleAddWa} className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                  <span className="text-xs font-bold text-emerald-300 block">💬 Naya WhatsApp Number:</span>
                  <input
                    type="text"
                    value={newWaTitle}
                    onChange={(e) => setNewWaTitle(e.target.value)}
                    placeholder="Title (e.g. 24x7 WhatsApp Chat Support)"
                    className="w-full px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white text-xs"
                  />
                  <input
                    type="text"
                    value={newWaNumber}
                    onChange={(e) => setNewWaNumber(e.target.value)}
                    placeholder="WhatsApp No. (e.g. +91 7009600157)"
                    className="w-full px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white font-mono text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add WhatsApp Line</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Admin Login Banner for Non-Authenticated Users */
        <div className="p-4 rounded-3xl bg-gradient-to-r from-[#1c0828] to-[#0e0417] border border-pink-500/30 shadow-lg flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                👑 Admin Portal: Helpline ya WhatsApp number badalna hai?
              </h4>
              <p className="text-[11px] text-gray-400">
                Aap yahan se direct apna number update kar sakte hain ya naya number add kar sakte hain.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isSuperAdminAccount) {
                setIsAdminMode(true);
                sessionStorage.setItem('sunosakhi_admin_session', 'active');
                showToast('success', '👑 Super Admin Pehchan Liya Gaya!');
              } else {
                setShowPasscodeModal(true);
              }
            }}
            className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-black font-black text-xs shadow-md transition-all active:scale-95"
          >
            🛠️ Admin Controls Kholein
          </button>
        </div>
      )}

      {/* Main Support Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WhatsApp Channels Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black uppercase text-emerald-300 tracking-wider">
                WhatsApp Support Channels ({whatsappList.length})
              </span>
            </div>
            {isAdminMode && (
              <span className="text-[10px] text-emerald-400 font-bold uppercase">
                ✏️ Admin Editable
              </span>
            )}
          </div>

          {whatsappList.map((wa) => (
            <div
              key={wa.id}
              className="p-5 rounded-3xl bg-gradient-to-b from-[#0c2e1b] to-[#071d11] border border-emerald-500/40 shadow-xl flex flex-col justify-between space-y-4 transition-all"
            >
              {editingId === wa.id ? (
                /* INLINE EDIT FORM FOR WHATSAPP */
                <div className="space-y-3 p-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      Update WhatsApp Number
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white text-xs"
                  />
                  <input
                    type="text"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    placeholder="WhatsApp Number"
                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(wa.id, 'whatsapp')}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save & Update</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="py-2 px-3 rounded-xl bg-white/10 text-gray-300 font-bold text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* DISPLAY VIEW */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <MessageCircle className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {wa.isPrimary && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-bold uppercase">
                          Primary
                        </span>
                      )}

                      {isAdminMode && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(wa)}
                            className="py-1 px-2 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-[10px] font-bold border border-blue-500/40 flex items-center gap-1 transition-all"
                            title="Edit / Update Number"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Update</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(wa.id, 'whatsapp')}
                            className="p-1 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/40 transition-all"
                            title="Remove Number"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
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
              )}

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
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-black uppercase text-pink-300 tracking-wider">
                Phone Helpline Channels ({callList.length})
              </span>
            </div>
            {isAdminMode && (
              <span className="text-[10px] text-pink-400 font-bold uppercase">
                ✏️ Admin Editable
              </span>
            )}
          </div>

          {callList.map((ph) => (
            <div
              key={ph.id}
              className="p-5 rounded-3xl bg-gradient-to-b from-[#1c0f33] to-[#110722] border border-pink-500/40 shadow-xl flex flex-col justify-between space-y-4 transition-all"
            >
              {editingId === ph.id ? (
                /* INLINE EDIT FORM FOR CALL */
                <div className="space-y-3 p-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-pink-300 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      Update Calling Number
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white text-xs"
                  />
                  <input
                    type="text"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(ph.id, 'call')}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save & Update</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="py-2 px-3 rounded-xl bg-white/10 text-gray-300 font-bold text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* DISPLAY VIEW */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                      <Phone className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {ph.isPrimary && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/30 text-pink-200 border border-pink-500/40 font-bold uppercase">
                          Toll-Free
                        </span>
                      )}

                      {isAdminMode && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(ph)}
                            className="py-1 px-2 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-[10px] font-bold border border-blue-500/40 flex items-center gap-1 transition-all"
                            title="Edit / Update Number"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Update</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(ph.id, 'call')}
                            className="p-1 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/40 transition-all"
                            title="Remove Number"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
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
              )}

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

      {/* Passcode Unlock Modal */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#160a24] border border-pink-500/40 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-pink-400" />
                <h3 className="text-sm font-black text-white">Admin Security Access</h3>
              </div>
              <button onClick={() => setShowPasscodeModal(false)} className="p-1 hover:opacity-80">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Helpline & WhatsApp number edit karne ke liye Master Admin passcode darj karein:
            </p>

            {passcodeError && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                {passcodeError}
              </div>
            )}

            <form onSubmit={handleUnlockAdmin} className="space-y-3">
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-pink-400 absolute left-3" />
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="Admin passcode (e.g. admin786)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs focus:outline-none"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white font-bold text-xs shadow-md"
              >
                Unlock Admin Controls
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
