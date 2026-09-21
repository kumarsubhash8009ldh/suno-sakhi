import React, { useState } from 'react';
import {
  X,
  Wallet,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useWallet } from '../context/WalletContext';
import { useAdmin } from '../context/AdminContext';
import { RECHARGE_PACKS } from '../data/sakhis';
import { RechargePack, RechargeRequest } from '../types';

export const WalletModal: React.FC = () => {
  const {
    balance,
    transactions,
    rechargeRequests,
    isWalletModalOpen,
    closeWalletModal,
    submitRecharge
  } = useWallet();
  const { settings } = useAdmin();

  const [selectedPack, setSelectedPack] = useState<RechargePack>(RECHARGE_PACKS[1]); // Default ₹100
  const [step, setStep] = useState<'pack' | 'utr' | 'success'>('pack');
  const [utrInput, setUtrInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReq, setSubmittedReq] = useState<RechargeRequest | null>(null);

  const [activeTab, setActiveTab] = useState<'recharge' | 'history'>('recharge');
  const [historyTab, setHistoryTab] = useState<'requests' | 'txs'>('requests');

  if (!isWalletModalOpen) return null;

  const adminUpi = settings.adminUpiId || 'sunosakhi@okaxis';
  const adminName = settings.adminUpiName || 'Suno Sakhi Official';

  const handleCopyUpi = () => {
    try {
      navigator.clipboard.writeText(adminUpi);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleProceedToUtr = () => {
    setStep('utr');
    setSubmitError(null);
    setUtrInput('');
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const clean = utrInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean || clean.length < 6) {
      setSubmitError('Kripya valid 12-digit UTR / UPI Reference Number darj karein.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitRecharge(selectedPack.amount, selectedPack.bonus, clean, 'UPI');
      if (res.success && res.request) {
        setSubmittedReq(res.request);
        setStep('success');
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });
      } else {
        setSubmitError(res.message || 'Request submit karne me samasya aayi.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Server error, kripya dobara try karein.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingRequestsCount = rechargeRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#150a24] border border-pink-500/30 shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="relative p-5 border-b border-pink-500/20 flex items-center justify-between bg-gradient-to-r from-[#200d36] to-[#140822]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-pink-500/20 border border-pink-500/40 text-pink-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">SunoSakhi Wallet</h2>
              <p className="text-xs text-pink-300/80">Voice ₹5/min • Video ₹10/min</p>
            </div>
          </div>
          <button
            onClick={closeWalletModal}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance Card */}
        <div className="p-5 bg-gradient-to-br from-[#260f3d] via-[#1a0b2c] to-[#12071f] border-b border-pink-500/20">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-pink-300/70">Current Balance</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black text-white">₹{((balance ?? 0) || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-gray-400 block">Available Talk Time</span>
              <div className="flex flex-col gap-0.5 mt-1 text-xs">
                <span className="text-pink-300 font-semibold">
                  🎙️ ~{Math.floor(balance / 5)} mins Voice
                </span>
                <span className="text-purple-300 font-semibold">
                  📹 ~{Math.floor(balance / 8)} mins Video
                </span>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-black/40 p-1 mt-4 border border-white/5">
            <button
              onClick={() => {
                setActiveTab('recharge');
                setStep('pack');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'recharge'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Add Money / Recharge
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Passbook & History</span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-black rounded-full text-[10px] font-extrabold animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'recharge' ? (
            step === 'pack' ? (
              /* STEP 1: SELECT PACK */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Step 1: Select Top-Up Pack
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Extra Bonus Included
                  </span>
                </div>

                {/* Pack list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RECHARGE_PACKS.map((pack) => {
                    const isSelected = selectedPack.id === pack.id;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setSelectedPack(pack)}
                        className={`relative p-3.5 rounded-2xl text-left border transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#381657] to-[#250d3a] border-pink-500 shadow-lg shadow-pink-900/30 ring-1 ring-pink-500'
                            : 'bg-[#1b0d2e]/70 border-white/10 hover:border-pink-500/40'
                        }`}
                      >
                        {pack.popular && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-[10px] font-extrabold text-white uppercase tracking-wider shadow">
                            Most Popular
                          </span>
                        )}
                        {pack.bestValue && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-extrabold text-white uppercase tracking-wider shadow">
                            Best Value
                          </span>
                        )}

                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-black text-white">₹{pack.amount}</span>
                          {pack.bonus > 0 && (
                            <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-700/40">
                              +₹{pack.bonus} Free
                            </span>
                          )}
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-gray-300 space-y-0.5">
                          <p className="text-pink-300">🎙️ {pack.voiceMinutes} mins Voice Call</p>
                          <p className="text-purple-300">📹 {pack.videoMinutes} mins Video Call</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Info Notice about Manual Verification */}
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200/90 leading-relaxed">
                    <strong className="text-amber-300 font-bold block mb-0.5">
                      ⚠️ Suraksha Suchna (No Automatic Add):
                    </strong>
                    Wallet me bina UTR verification ke automatic paise add nahi hote. Payment karke 12-digit UTR enter karein, Admin dwara verify hone par balance credit ho jayega.
                  </div>
                </div>

                {/* Continue to Pay Action Button */}
                <button
                  onClick={handleProceedToUtr}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-pink-900/50 flex items-center justify-center gap-2 transition-all glow-btn"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    Pay ₹{selectedPack.amount} & Enter UTR (Get ₹{selectedPack.amount + selectedPack.bonus}) ➔
                  </span>
                </button>
              </div>
            ) : step === 'utr' ? (
              /* STEP 2: PAYMENT DETAILS & UTR ENTRY */
              <div className="space-y-4 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => setStep('pack')}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Wapas Pack Select Karein</span>
                </button>

                {/* Selected Amount Banner */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#2c1044] to-[#1a092c] border border-pink-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400">Total Payable Amount</span>
                    <p className="text-2xl font-black text-white">₹{selectedPack.amount}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-400">Total Coins to Receive</span>
                    <p className="text-lg font-black text-emerald-300">
                      ₹{selectedPack.amount + selectedPack.bonus} Coins
                    </p>
                  </div>
                </div>

                {/* Official UPI ID Card */}
                <div className="p-4 rounded-2xl bg-black/60 border border-pink-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">
                      Official Admin UPI ID:
                    </span>
                    <span className="text-[11px] text-pink-300 font-mono">{adminName}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#1b0a2c] border border-pink-500/30">
                    <span className="font-mono text-sm sm:text-base font-black text-pink-300 tracking-wider select-all">
                      {adminUpi}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        copied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-pink-600 hover:bg-pink-500 text-white shadow'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy UPI</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Direct App Button */}
                  <a
                    href={`upi://pay?pa=${adminUpi}&pn=${encodeURIComponent(adminName)}&am=${selectedPack.amount}&cu=INR`}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>⚡ Pay via UPI App (GPay / PhonePe / Paytm)</span>
                  </a>
                </div>

                {/* Steps Instruction */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs text-gray-300">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Payment Process Kaise Karein:</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-300">
                    <li>Upar diye gaye UPI ID par ₹{selectedPack.amount} bhejein.</li>
                    <li>Payment success hone par apne app me se <strong>12-digit UTR / UPI Ref No.</strong> copy karein.</li>
                    <li>Neeche UTR number darj karke <strong>"Submit for Verification"</strong> dabayein.</li>
                  </ol>
                </div>

                {/* UTR Form */}
                <form onSubmit={handleSubmitUtr} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-200 block mb-1">
                      Enter 12-Digit UTR / UPI Reference No. <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={utrInput}
                      onChange={(e) => {
                        setUtrInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                        setSubmitError(null);
                      }}
                      placeholder="e.g. 423589123456"
                      className="w-full px-4 py-3 rounded-xl bg-black/70 border border-pink-500/50 text-white text-sm font-mono tracking-widest focus:outline-none focus:border-pink-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      ⚠️ Bina sahi UTR number ke payment verify nahi ho payega.
                    </p>
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !utrInput.trim()}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                        <span>Submitting UTR...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit UTR for Admin Verification</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* STEP 3: SUBMISSION SUCCESS SCREEN */
              <div className="p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-white">Recharge Request Submitted!</h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Aapka UTR number Admin verification ke liye submit ho gaya hai.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-black/50 border border-white/10 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Recharge Pack:</span>
                    <span className="font-bold text-white">₹{selectedPack.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coins to Add:</span>
                    <span className="font-bold text-emerald-400">₹{selectedPack.amount + selectedPack.bonus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Submitted UTR:</span>
                    <span className="font-mono font-bold text-pink-300">{submittedReq?.utr || utrInput}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-gray-400">Current Status:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase animate-pulse flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Pending Admin Verification</span>
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400">
                  Admin dwara bank account me UTR confirm hote hi aapke wallet me paise automatically credit ho jayenge (Samay: 5-15 minute).
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('history');
                      setHistoryTab('requests');
                      setStep('pack');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs"
                  >
                    Track Status in History
                  </button>
                  <button
                    onClick={closeWalletModal}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )
          ) : (
            /* PASSBOOK & HISTORY TAB */
            <div className="space-y-3">
              {/* Sub tabs: Recharge Requests vs Call Transactions */}
              <div className="flex rounded-xl bg-black/50 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setHistoryTab('requests')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    historyTab === 'requests'
                      ? 'bg-pink-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>Recharge Requests ({rechargeRequests.length})</span>
                  {pendingRequestsCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('txs')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === 'txs'
                      ? 'bg-pink-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Call Transactions ({transactions.length})
                </button>
              </div>

              {historyTab === 'requests' ? (
                /* RECHARGE REQUESTS LIST */
                <div className="space-y-2.5">
                  {rechargeRequests.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-black/30 border border-white/10">
                      <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-60" />
                      <p className="text-sm text-gray-400">Abhi tak koi recharge request submit nahi ki gayi hai.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('recharge');
                          setStep('pack');
                        }}
                        className="mt-3 px-4 py-1.5 rounded-xl bg-pink-600 text-white text-xs font-bold"
                      >
                        Recharge Karein
                      </button>
                    </div>
                  ) : (
                    rechargeRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-2xl bg-[#1b0d2e]/90 border border-white/10 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                              <Wallet className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">
                                ₹{req.amount} Top-Up {req.bonus > 0 ? `(+₹${req.bonus} Bonus)` : ''}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                                {new Date(req.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {/* Status badge */}
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : req.status === 'rejected'
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            }`}
                          >
                            {req.status === 'approved' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved</span>
                              </>
                            ) : req.status === 'rejected' ? (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                <span>Rejected</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>Pending Verification</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* UTR & details */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-gray-400">UTR / Ref: </span>
                            <span className="font-mono font-bold text-pink-300 select-all">{req.utr}</span>
                          </div>
                          <span className="font-black text-emerald-400">
                            {req.status === 'approved' ? `+₹${req.totalBalance} Added` : `₹${req.totalBalance}`}
                          </span>
                        </div>

                        {req.status === 'rejected' && req.rejectReason && (
                          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                            <strong>Reason:</strong> {req.rejectReason}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* TRANSACTIONS LIST */
                <div className="space-y-2">
                  {transactions.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-8">No transactions yet</p>
                  ) : (
                    transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#1b0d2e]/80 border border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-xl ${
                              tx.type === 'credit'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                            }`}
                          >
                            {tx.type === 'credit' ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{tx.description}</p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            tx.type === 'credit' ? 'text-emerald-400' : 'text-pink-400'
                          }`}
                        >
                          {tx.type === 'credit' ? `+₹${((tx.amount ?? 0) || 0).toFixed(2)}` : `-₹${((tx.amount ?? 0) || 0).toFixed(2)}`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

