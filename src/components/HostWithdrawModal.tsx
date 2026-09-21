import React, { useState } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Building2,
  Sparkles,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { useHost } from '../context/HostContext';
import { HostPayoutRecord } from '../types';

const UPI_APPS = [
  { name: 'Google Pay (GPay)', icon: '🔵', handle: '@okhdfcbank' },
  { name: 'Paytm', icon: '🟦', handle: '@paytm' },
  { name: 'PhonePe', icon: '🟣', handle: '@ybl' },
  { name: 'BHIM / Other UPI', icon: '🇮🇳', handle: '@upi' }
];

export const HostWithdrawModal: React.FC = () => {
  const {
    isWithdrawModalOpen,
    closeWithdrawModal,
    hostProfile,
    payoutHistory,
    submitWithdrawal
  } = useHost();

  const [activeTab, setActiveTab] = useState<'withdraw' | 'history'>('withdraw');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [amount, setAmount] = useState<string>('500');
  const [upiId, setUpiId] = useState<string>(hostProfile.upiId || '');
  const [panNumber, setPanNumber] = useState<string>(
    hostProfile.verification?.panNumber || (hostProfile as any).panNumber || ''
  );

  // Bank Form State
  const [accountHolder, setAccountHolder] = useState<string>(hostProfile.name || '');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [confirmAccount, setConfirmAccount] = useState<string>('');
  const [ifsc, setIfsc] = useState<string>('');
  const [bankName, setBankName] = useState<string>('HDFC Bank');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<HostPayoutRecord | null>(null);

  if (!isWithdrawModalOpen) return null;

  const availableBalance = hostProfile.pendingPayout || 0;

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleWithdrawAll = () => {
    setAmount(Math.floor(availableBalance).toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Mandatory PAN Card Validation
    const cleanPan = panNumber.trim().toUpperCase();
    if (!cleanPan) {
      setErrorMsg('⚠️ PAN Card Compulsory: Payout withdrawal ke liye PAN Card number darj karna anivarya hai.');
      return;
    }
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!PAN_REGEX.test(cleanPan)) {
      setErrorMsg('⚠️ Invalid PAN Card format. Sahi 10-character PAN dalein (e.g. ABCDE1234F).');
      return;
    }

    // 2. Minimum Amount: ₹500
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 500) {
      setErrorMsg('Minimum withdrawal amount ₹500 hona anivarya hai.');
      return;
    }
    if (numAmount > availableBalance) {
      setErrorMsg(`Aapke paas sirf ₹${(availableBalance || 0).toFixed(2)} available hai.`);
      return;
    }

    if (method === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        setErrorMsg('Kripya valid UPI ID darj karein (e.g. 9876543210@paytm ya yourname@okhdfcbank).');
        return;
      }
    } else {
      if (!accountHolder.trim()) {
        setErrorMsg('Account holder ka naam dalein.');
        return;
      }
      if (!accountNumber || accountNumber.length < 8) {
        setErrorMsg('Valid bank account number dalein.');
        return;
      }
      if (accountNumber !== confirmAccount) {
        setErrorMsg('Account number confirm number se match nahi kar raha.');
        return;
      }
      if (!ifsc || ifsc.length < 5) {
        setErrorMsg('Valid 11-character IFSC code dalein.');
        return;
      }
    }

    setLoading(true);
    const res = await submitWithdrawal({
      amount: numAmount,
      method,
      upiId: method === 'upi' ? upiId : undefined,
      panNumber: cleanPan,
      bankDetails:
        method === 'bank'
          ? {
              accountHolder,
              accountNumber,
              ifsc: ifsc.toUpperCase(),
              bankName
            }
          : undefined
    });
    setLoading(false);

    if (res.success && res.record) {
      setSuccessRecord(res.record);
    } else {
      setErrorMsg(res.message || 'Withdrawal process nahi ho paya.');
    }
  };

  const handleClose = () => {
    setSuccessRecord(null);
    setErrorMsg(null);
    closeWithdrawModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-[32px] bg-gradient-to-b from-[#180929] via-[#10051d] to-[#0a0312] border border-pink-500/40 shadow-2xl overflow-hidden text-white max-h-[92vh] flex flex-col">
        {/* Top Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-pink-500/20 bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-transparent">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg sm:text-xl font-black text-white">
              Host Payment Withdrawal (60% Share)
            </h3>
          </div>
          <p className="text-xs text-pink-200/80">
            Apni earnings ko direct apne UPI ya Bank Account me withdraw karein
          </p>

          {/* Balance Cards */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 shadow">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                Available to Withdraw
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                ₹{((availableBalance ?? 0) || 0).toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#221038] border border-pink-500/30 shadow">
              <span className="text-[10px] uppercase font-bold text-pink-300 tracking-wider block">
                Lifetime 60% Earned
              </span>
              <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                ₹{((hostProfile?.netIncome ?? 0) || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Nav Tabs: Withdraw vs History */}
        <div className="flex border-b border-white/10 bg-black/40 px-5 pt-2">
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'withdraw'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            💳 Withdraw Money
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'history'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            📜 Payout History ({payoutHistory.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {successRecord ? (
            /* Success Receipt View */
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">Withdrawal Successful!</h4>
                <p className="text-xs text-emerald-300 mt-1">
                  ₹{successRecord.amount.toFixed(2)} aapke account me transfer ke liye process ho gaya hai.
                </p>
              </div>

              {/* Receipt Card */}
              <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 text-left text-xs space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between text-gray-400">
                  <span>Reference ID:</span>
                  <span className="font-mono font-bold text-white">{successRecord.referenceId}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Method:</span>
                  <span className="font-bold text-white uppercase">{successRecord.method}</span>
                </div>
                {successRecord.panNumber && (
                  <div className="flex justify-between text-gray-400">
                    <span>PAN Number:</span>
                    <span className="font-mono font-bold text-amber-300">{successRecord.panNumber} (Verified ✅)</span>
                  </div>
                )}
                {successRecord.upiId && (
                  <div className="flex justify-between text-gray-400">
                    <span>UPI ID:</span>
                    <span className="font-bold text-emerald-300">{successRecord.upiId}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Status:</span>
                  <span className="font-bold text-emerald-400">COMPLETED / PAID ✅</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Date & Time:</span>
                  <span className="text-white">{new Date(successRecord.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full max-w-sm py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs shadow-lg"
              >
                Close & View Updated Dashboard
              </button>
            </div>
          ) : activeTab === 'withdraw' ? (
            /* Withdrawal Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount Selection */}
              {/* Amount Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Withdrawal Amount (₹)
                  </label>
                  <button
                    type="button"
                    onClick={handleWithdrawAll}
                    className="text-[11px] text-pink-400 font-bold hover:underline"
                  >
                    Withdraw All (₹{((availableBalance ?? 0) || 0).toFixed(0)})
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-pink-400">₹</span>
                  <input
                    type="number"
                    min="500"
                    max={availableBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount (Min ₹500)"
                    className="w-full pl-9 pr-4 py-3 rounded-2xl bg-black/60 border border-pink-500/30 text-white font-mono text-lg font-bold focus:outline-none focus:border-pink-500 shadow-inner"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex items-center gap-2 mt-2">
                  {[500, 1000, 2000, 5000].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuickAmount(chip)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                        amount === chip.toString()
                          ? 'bg-pink-600 text-white border-pink-400'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:border-pink-500/40'
                      }`}
                    >
                      +₹{chip}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-amber-300/80 mt-1">
                  * Minimum withdrawal limit: ₹500 per day.
                </p>
              </div>

              {/* MANDATORY PAN CARD SECTION */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-black/60 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Host PAN Card (अनिवार्य / Compulsory)</span>
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-black uppercase tracking-wider">
                    COMPULSORY
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="Enter 10-digit PAN (e.g. ABCDE1234F)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-amber-500/40 text-white font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                  {panNumber && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase()) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Valid PAN
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-gray-300 leading-relaxed">
                  * Tax Compliance aur safe payout ke liye PAN Card compulsory hai. Koi bhi host withdrawal kare, unka PAN hona anivarya hai.
                </p>
              </div>

              {/* Method Selector: UPI (Google Pay, Paytm, PhonePe) vs Bank */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Payout Transfer App Chunein (Google Pay / Paytm / PhonePe)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMethod('upi')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      method === 'upi'
                        ? 'bg-gradient-to-r from-pink-900/40 to-purple-900/40 border-pink-500 text-white shadow'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-pink-400" />
                    <div>
                      <span className="block text-xs font-bold text-white">Instant UPI Transfer</span>
                      <span className="block text-[10px] text-emerald-300 font-bold">GPay, Paytm, PhonePe</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('bank')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      method === 'bank'
                        ? 'bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-emerald-500 text-white shadow'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="block text-xs font-bold text-white">Bank Account</span>
                      <span className="block text-[10px] text-emerald-300">NEFT / IMPS</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* UPI Form */}
              {method === 'upi' && (
                <div className="p-3.5 rounded-2xl bg-black/40 border border-pink-500/20 space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                      UPI ID (VPA)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. 9876543210@paytm ya aarohi@okhdfcbank"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-pink-500/30 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  {/* App handles suggestions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-400">Quick suggestions:</span>
                    {UPI_APPS.map((app) => (
                      <button
                        key={app.name}
                        type="button"
                        onClick={() => {
                          const base = upiId.includes('@') ? upiId.split('@')[0] : upiId || '9876543210';
                          setUpiId(base + app.handle);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-pink-300 border border-pink-500/20"
                      >
                        {app.icon} {app.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Account Form */}
              {method === 'bank' && (
                <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20 space-y-2.5 text-left">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-300 block mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Account holder ka poora naam"
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-emerald-500/30 text-white text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-300 block mb-1">Account Number</label>
                      <input
                        type="password"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="Account Number"
                        className="w-full px-3 py-2 rounded-xl bg-black/70 border border-emerald-500/30 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-300 block mb-1">Confirm Number</label>
                      <input
                        type="text"
                        value={confirmAccount}
                        onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ''))}
                        placeholder="Re-enter Number"
                        className="w-full px-3 py-2 rounded-xl bg-black/70 border border-emerald-500/30 text-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-300 block mb-1">IFSC Code</label>
                      <input
                        type="text"
                        maxLength={11}
                        value={ifsc}
                        onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                        placeholder="HDFC0001234"
                        className="w-full px-3 py-2 rounded-xl bg-black/70 border border-emerald-500/30 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-300 block mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="HDFC, SBI, ICICI"
                        className="w-full px-3 py-2 rounded-xl bg-black/70 border border-emerald-500/30 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || availableBalance < 500}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Confirm & Withdraw ₹{amount} (Min ₹500)</span>
              </button>

              <p className="text-[10px] text-gray-400 text-center">
                Transfer via Google Pay, Paytm, PhonePe UPI • PAN Card Verified Settlement • 0% Platform Fee
              </p>
            </form>
          ) : (
            /* Payout History Ledger */
            <div className="space-y-2.5">
              {payoutHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Abhi tak koi withdrawal history nahi hai.</p>
                </div>
              ) : (
                payoutHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {item.method === 'upi' ? <Smartphone className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">
                          Withdrawal to {item.method.toUpperCase()}
                        </h5>
                        <p className="text-[10px] text-gray-400">
                          Ref: {item.referenceId} • {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-400 block">
                        ₹{((item.amount ?? 0) || 0).toFixed(2)}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        PAID ✅
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
