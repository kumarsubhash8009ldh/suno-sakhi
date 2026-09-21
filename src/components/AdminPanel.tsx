import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Coins,
  DollarSign,
  TrendingUp,
  UserCheck,
  CheckCircle2,
  XCircle,
  Settings,
  Sparkles,
  Phone,
  Video,
  MessageCircle,
  Gift,
  Cloud,
  Database,
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
  Wallet,
  User,
  CreditCard,
  ArrowRight,
  Ban,
  Check,
  X,
  Lock,
  ArrowLeft,
  ChevronRight,
  Clock,
  Copy,
  ShieldAlert,
  AlertOctagon
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { HostProfile, HostPayoutRecord, RechargeRequest } from '../types';
import {
  getLocalNudityReports,
  getBannedPhoneNumbers,
  unbanPhoneNumber,
  banPhoneNumber,
  NudityReport
} from '../services/safetyService';
import {
  fetchAllRegisteredHosts,
  fetchAllRegisteredUsers,
  fetchAllPayoutRequests,
  releaseHostPayout,
  rejectHostPayout,
  createDirectPayout,
  adjustUserCoins,
  toggleUserBlock,
  toggleHostBlock,
  setHostVerificationStatus,
  AdminUserDetails
} from '../services/adminSync';
import {
  fetchAllRechargeRequests,
  subscribeToAllRechargeRequests,
  approveRechargeRequest,
  rejectRechargeRequest
} from '../services/rechargeSync';

interface AdminPanelProps {
  isModal?: boolean;
  onClose?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isModal = false, onClose }) => {
  const { settings, isFirebaseActive, updateSettings, closeAdmin } = useAdmin();
  const { balance } = useWallet();
  const { hostProfile } = useHost();

  const [activeTab, setActiveTab] = useState<'recharges' | 'payouts' | 'hosts' | 'users' | 'analytics' | 'settings' | 'nudity'>('recharges');

  // Live Data States
  const [hostsList, setHostsList] = useState<HostProfile[]>([]);
  const [usersList, setUsersList] = useState<AdminUserDetails[]>([]);
  const [payoutsList, setPayoutsList] = useState<HostPayoutRecord[]>([]);
  const [rechargeRequestsList, setRechargeRequestsList] = useState<RechargeRequest[]>([]);
  const [nudityReports, setNudityReports] = useState<NudityReport[]>([]);
  const [bannedPhonesList, setBannedPhonesList] = useState<string[]>([]);
  const [manualBanPhone, setManualBanPhone] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Search & Filter
  const [hostSearch, setHostSearch] = useState<string>('');
  const [userSearch, setUserSearch] = useState<string>('');
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending');
  const [rechargeFilter, setRechargeFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [rechargeSearch, setRechargeSearch] = useState<string>('');

  // Success / Error alerts
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Action Modals / Forms
  const [releasingPayout, setReleasingPayout] = useState<HostPayoutRecord | null>(null);
  const [releaseUtr, setReleaseUtr] = useState<string>('');

  const [rejectModalReq, setRejectModalReq] = useState<RechargeRequest | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');
  const [actionReqId, setActionReqId] = useState<string | null>(null);

  const [coinModalUser, setCoinModalUser] = useState<AdminUserDetails | null>(null);
  const [coinAddAmount, setCoinAddAmount] = useState<string>('100');
  const [coinNote, setCoinNote] = useState<string>('Admin Manual Recharge');

  // Direct Payout Form State
  const [directHostId, setDirectHostId] = useState<string>('');
  const [directAmount, setDirectAmount] = useState<string>('');
  const [directMethod, setDirectMethod] = useState<'upi' | 'bank'>('upi');
  const [directUpiOrBank, setDirectUpiOrBank] = useState<string>('');
  const [directUtr, setDirectUtr] = useState<string>('');

  // Settings State
  const [voiceRate, setVoiceRate] = useState(settings.voiceRatePerMin);
  const [videoRate, setVideoRate] = useState(settings.videoRatePerMin);
  const [chatRate, setChatRate] = useState(settings.sakhiChatRate);
  const [hostShare, setHostShare] = useState(settings.hostIncomePercent);
  const [adminUpiIdInput, setAdminUpiIdInput] = useState(settings.adminUpiId || 'sunosakhi@okaxis');
  const [adminUpiNameInput, setAdminUpiNameInput] = useState(settings.adminUpiName || 'Suno Sakhi Official');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Load all live records
  const loadData = async () => {
    setRefreshing(true);
    try {
      const [h, u, p, r] = await Promise.all([
        fetchAllRegisteredHosts(),
        fetchAllRegisteredUsers(),
        fetchAllPayoutRequests(),
        fetchAllRechargeRequests()
      ]);
      setHostsList(h);
      setUsersList(u);
      setPayoutsList(p);
      setRechargeRequestsList(r);
      setNudityReports(getLocalNudityReports());
      setBannedPhonesList(getBannedPhoneNumbers());
      if (h.length > 0 && !directHostId) {
        setDirectHostId(h[0].id);
        setDirectUpiOrBank(h[0].upiId || `${h[0].phone}@okaxis`);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
      showToast('error', 'Data load karne me samasya aayi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to live recharge requests from Firestore/LocalStorage
    const unsub = subscribeToAllRechargeRequests((list) => {
      setRechargeRequestsList(list);
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Filtered lists
  const filteredHosts = useMemo(() => {
    return hostsList.filter((h) => {
      const query = hostSearch.toLowerCase().trim();
      if (!query) return true;
      return (
        (h.id || '').toLowerCase().includes(query) ||
        (h.name || '').toLowerCase().includes(query) ||
        (h.phone || '').includes(query) ||
        (h.city || '').toLowerCase().includes(query)
      );
    });
  }, [hostsList, hostSearch]);

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const query = userSearch.toLowerCase().trim();
      if (!query) return true;
      return (
        u.id.toLowerCase().includes(query) ||
        u.name.toLowerCase().includes(query) ||
        u.phone.includes(query)
      );
    });
  }, [usersList, userSearch]);

  const filteredPayouts = useMemo(() => {
    return payoutsList.filter((p) => {
      if (payoutFilter === 'all') return true;
      return p.status === payoutFilter;
    });
  }, [payoutsList, payoutFilter]);

  // Aggregate financial metrics
  const totalGrossIncome = useMemo(() => {
    return hostsList.reduce((acc, h) => acc + (h.grossRevenue || 0), 0) + (hostProfile?.grossRevenue || 0);
  }, [hostsList, hostProfile]);

  const totalHostNetPaid = useMemo(() => {
    return payoutsList
      .filter((p) => p.status === 'completed')
      .reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [payoutsList]);

  const totalPendingPayouts = useMemo(() => {
    const pendingReqs = payoutsList
      .filter((p) => p.status === 'pending' || p.status === 'processing')
      .reduce((acc, p) => acc + (p.amount || 0), 0);
    const hostBalances = hostsList.reduce((acc, h) => acc + (h.pendingPayout || 0), 0);
    return Math.max(pendingReqs, hostBalances);
  }, [payoutsList, hostsList]);

  // Filtered Recharge Requests
  const filteredRecharges = useMemo(() => {
    return rechargeRequestsList.filter((r) => {
      if (rechargeFilter !== 'all' && r.status !== rechargeFilter) return false;
      const query = rechargeSearch.toLowerCase().trim();
      if (!query) return true;
      return (
        (r.utr || '').toLowerCase().includes(query) ||
        (r.userPhone || '').includes(query) ||
        (r.userName || '').toLowerCase().includes(query) ||
        (r.id || '').toLowerCase().includes(query)
      );
    });
  }, [rechargeRequestsList, rechargeFilter, rechargeSearch]);

  const totalPendingRechargeAmount = useMemo(() => {
    return rechargeRequestsList
      .filter((r) => r.status === 'pending')
      .reduce((acc, r) => acc + (r.totalBalance || r.amount || 0), 0);
  }, [rechargeRequestsList]);

  const totalApprovedRechargeAmount = useMemo(() => {
    return rechargeRequestsList
      .filter((r) => r.status === 'approved')
      .reduce((acc, r) => acc + (r.totalBalance || r.amount || 0), 0);
  }, [rechargeRequestsList]);

  // Handler: Approve Recharge Request
  const handleApproveRecharge = async (req: RechargeRequest) => {
    const confirmApprove = window.confirm(
      `Kya aap is recharge request ko APPROVE karke wallet me paise add karna chahte hain?\n\nUser: ${req.userPhone || req.userName}\nCoins: ₹${req.totalBalance}\nUTR: ${req.utr}`
    );
    if (!confirmApprove) return;

    setActionReqId(req.id);
    try {
      const res = await approveRechargeRequest(req.id);
      if (res.success) {
        showToast('success', res.message);
        setRechargeRequestsList((prev) =>
          prev.map((item) => (item.id === req.id ? { ...item, status: 'approved', reviewedAt: Date.now() } : item))
        );
        // Refresh users list to reflect new wallet balances
        const updatedUsers = await fetchAllRegisteredUsers();
        setUsersList(updatedUsers);
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Approval me error aaya.');
    } finally {
      setActionReqId(null);
    }
  };

  // Handler: Reject Recharge Request
  const handleConfirmRejectRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq) return;

    const reason = rejectReasonInput.trim() || 'Payment not verified / Invalid UTR';
    setActionReqId(rejectModalReq.id);
    try {
      const res = await rejectRechargeRequest(rejectModalReq.id, reason);
      if (res.success) {
        showToast('success', res.message);
        setRechargeRequestsList((prev) =>
          prev.map((item) => (item.id === rejectModalReq.id ? { ...item, status: 'rejected', rejectReason: reason } : item))
        );
        setRejectModalReq(null);
        setRejectReasonInput('');
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Reject karne me error aaya.');
    } finally {
      setActionReqId(null);
    }
  };

  // Handler: Release Payout
  const handleConfirmReleasePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releasingPayout) return;
    const utr = releaseUtr.trim() || `UTR${Date.now()}`;
    const res = await releaseHostPayout(releasingPayout.id, utr);
    if (res.success) {
      showToast('success', res.message);
      setReleasingPayout(null);
      setReleaseUtr('');
      loadData();
    } else {
      showToast('error', res.message);
    }
  };

  // Handler: Reject Payout
  const handleRejectPayout = async (payout: HostPayoutRecord) => {
    const reason = window.prompt('Reject karne ki wajah darj karein (Reason):', 'Invalid UPI / Verification Pending');
    if (reason === null) return;
    const res = await rejectHostPayout(payout.id, reason || 'Rejected by Admin');
    if (res.success) {
      showToast('success', res.message);
      loadData();
    } else {
      showToast('error', res.message);
    }
  };

  // Handler: Direct Payout Release
  const handleCreateDirectPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(directAmount);
    if (!amt || amt <= 0) {
      showToast('error', 'Valid amount darj karein.');
      return;
    }
    if (!directHostId) {
      showToast('error', 'Host select karein.');
      return;
    }

    const res = await createDirectPayout({
      hostId: directHostId,
      amount: amt,
      method: directMethod,
      upiOrBank: directUpiOrBank.trim() || 'Direct-UPI',
      utrNumber: directUtr.trim() || `UTR${Date.now()}`
    });

    if (res.success) {
      showToast('success', res.message);
      setDirectAmount('');
      setDirectUtr('');
      loadData();
    } else {
      showToast('error', res.message);
    }
  };

  // Handler: Add Coins to User ID
  const handleAddCoinsToUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coinModalUser) return;
    const amt = parseFloat(coinAddAmount);
    if (!amt || amt <= 0) {
      showToast('error', 'Valid coin amount dalein.');
      return;
    }
    const res = await adjustUserCoins(coinModalUser.phone, amt, coinNote);
    if (res.success) {
      showToast('success', `✅ ₹${amt} coins user (+91 ${coinModalUser.phone}) ke wallet me add ho gaye! New Balance: ₹${res.newBalance.toFixed(2)}`);
      setCoinModalUser(null);
      loadData();
    } else {
      showToast('error', 'Coins add karne me samasya aayi.');
    }
  };

  // Handler: Toggle User Block
  const handleToggleUserBlock = async (u: AdminUserDetails) => {
    const shouldBlock = u.status !== 'blocked';
    const confirmMsg = shouldBlock
      ? `Kya aap User (+91 ${u.phone}) ko BLOCK karna chahte hain?`
      : `Kya aap User (+91 ${u.phone}) ko UNBLOCK karna chahte hain?`;
    if (!window.confirm(confirmMsg)) return;

    await toggleUserBlock(u.phone, shouldBlock);
    showToast('success', `User status ${shouldBlock ? 'Blocked' : 'Active'} update ho gaya!`);
    loadData();
  };

  // Handler: Toggle Host Block
  const handleToggleHostBlock = async (h: HostProfile) => {
    const isBlocked = h.status === 'offline';
    const confirmMsg = isBlocked
      ? `Kya aap Host (${h.name}) ko ACTIVE / ONLINE karna chahte hain?`
      : `Kya aap Host (${h.name}) ko INACTIVE / BLOCK karna chahte hain?`;
    if (!window.confirm(confirmMsg)) return;

    await toggleHostBlock(h.id, !isBlocked);
    showToast('success', `Host status update ho gaya!`);
    loadData();
  };

  // Handler: Toggle Host Aadhaar Verification
  const handleToggleHostVerification = async (h: HostProfile) => {
    const newStatus = !h.isVerified;
    await setHostVerificationStatus(h.id, newStatus);
    showToast('success', `Host (${h.name}) verification status ${newStatus ? 'Verified ✅' : 'Unverified ⚠️'} kar diya gaya!`);
    loadData();
  };

  // Handler: Save Platform Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      voiceRatePerMin: Number(voiceRate),
      videoRatePerMin: Number(videoRate),
      sakhiChatRate: Number(chatRate),
      hostIncomePercent: Number(hostShare),
      adminUpiId: adminUpiIdInput.trim(),
      adminUpiName: adminUpiNameInput.trim()
    });
    showToast('success', '✅ Platform Rates, Commission aur Official Deposit UPI ID update ho gaye!');
  };

  // Handler: Unban Phone Number
  const handleUnbanPhone = async (phone: string) => {
    if (!window.confirm(`Kya aap number (${phone}) se NUDITY BAN hatana chahte hain?`)) return;
    unbanPhoneNumber(phone);
    await toggleUserBlock(phone, false);
    setNudityReports(getLocalNudityReports());
    setBannedPhonesList(getBannedPhoneNumbers());
    showToast('success', `Mobile (${phone}) ko UNBAN kar diya gaya! Ab ye login kar sakte hain.`);
  };

  // Handler: Manual Ban Phone Number
  const handleManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualBanPhone.replace(/\D/g, '');
    const digits = clean.length === 12 && clean.startsWith('91') ? clean.slice(2) : clean;
    if (!digits || digits.length < 10) {
      showToast('error', 'Kripya valid mobile number dalein.');
      return;
    }
    banPhoneNumber(digits);
    await toggleUserBlock(digits, true);
    setManualBanPhone('');
    setNudityReports(getLocalNudityReports());
    setBannedPhonesList(getBannedPhoneNumbers());
    showToast('success', `Mobile (${digits}) ko ZERO TOLERANCE NUDITY BAN ke tahat blacklist kar diya gaya!`);
  };

  const containerClasses = isModal
    ? 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md'
    : 'w-full min-h-screen bg-[#08020e] text-white p-2 sm:p-6';

  const panelWrapperClasses = isModal
    ? 'relative w-full max-w-5xl rounded-3xl bg-[#0f041a] border border-pink-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white'
    : 'max-w-7xl mx-auto rounded-3xl bg-[#0f041a] border border-pink-500/30 shadow-2xl overflow-hidden flex flex-col text-white';

  return (
    <div className={containerClasses}>
      <div className={panelWrapperClasses}>
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-pink-500/20 bg-gradient-to-r from-[#1c082e] via-[#120420] to-[#090212] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/40 flex-shrink-0">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
                  SunoSakhi Owner Control Console
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold hidden sm:inline">
                  MASTER ADMIN
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-pink-300/80">
                Payment Release • Host IDs • User IDs • Live Analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-pink-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {isModal && (
              <button
                onClick={onClose || closeAdmin}
                className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Global Alert Notification Toast */}
        {toastMsg && (
          <div
            className={`mx-4 mt-3 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 animate-bounce-short ${
              toastMsg.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                : 'bg-red-500/20 border-red-500/40 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              <span>{toastMsg.text}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="p-1 hover:opacity-80">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-white/10 px-3 sm:px-5 pt-2 bg-black/40 overflow-x-auto gap-1 sm:gap-2">
          {[
            {
              id: 'recharges',
              label: '📥 Recharge Requests (जमा सत्यापन)',
              badge: rechargeRequestsList.filter((r) => r.status === 'pending').length,
              badgeClass: 'bg-amber-500 text-black font-black animate-pulse'
            },
            {
              id: 'payouts',
              label: '💳 Host Withdrawals',
              badge: payoutsList.filter((p) => p.status === 'pending').length,
              badgeClass: 'bg-pink-600 text-white font-black'
            },
            { id: 'hosts', label: '👩‍🦰 Host Directory', count: hostsList.length },
            { id: 'users', label: '👤 User Directory', count: usersList.length },
            {
              id: 'nudity',
              label: '🚨 Nudity Ban Reports',
              badge: nudityReports.length,
              badgeClass: 'bg-red-600 text-white font-black animate-pulse'
            },
            { id: 'analytics', label: '📊 Financials' },
            { id: 'settings', label: '⚙️ Settings & UPI' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 sm:px-4 text-xs font-black rounded-t-2xl transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-[#1b0a2c] text-pink-300 border-t-2 border-pink-500 shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    tab.badgeClass || 'bg-pink-600 text-white font-black'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {typeof tab.count === 'number' && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 text-[10px]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 0: RECHARGE REQUESTS (MANUAL UTR VERIFICATION & WALLET CREDIT)        */}
          {/* ========================================================================= */}
          {activeTab === 'recharges' && (
            <div className="space-y-6">
              {/* Financial Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/50 to-[#180928] border border-amber-500/40 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">Pending Recharge Requests</span>
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-2">
                    {rechargeRequestsList.filter((r) => r.status === 'pending').length}
                  </p>
                  <p className="text-[11px] text-amber-200/80 mt-1">
                    ₹{totalPendingRechargeAmount.toFixed(2)} verification awaiting
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-[#180928] border border-emerald-500/30 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">Total Approved & Credited</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-300 mt-2">
                    ₹{totalApprovedRechargeAmount.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-300 mt-1">
                    {rechargeRequestsList.filter((r) => r.status === 'approved').length} requests verified & credited
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-950/40 to-[#180928] border border-pink-500/30 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-pink-300">Active Deposit UPI ID</span>
                    <Wallet className="w-4 h-4 text-pink-400" />
                  </div>
                  <p className="text-base font-black font-mono text-white mt-2 select-all">
                    {settings.adminUpiId || 'sunosakhi@okaxis'}
                  </p>
                  <p className="text-[11px] text-pink-300/80 mt-1">
                    Receiver: {settings.adminUpiName || 'Suno Sakhi Official'}
                  </p>
                </div>
              </div>

              {/* Recharge Requests Management Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>Caller Recharge Verification & Wallet Credit</span>
                      {rechargeRequestsList.filter((r) => r.status === 'pending').length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black animate-pulse">
                          {rechargeRequestsList.filter((r) => r.status === 'pending').length} ACTION REQUIRED
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400">
                      Bank/UPI app me UTR verify karke Approve karein. Approve hone par hi user ke wallet me paise add honge.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Search by UTR or Phone */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-pink-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={rechargeSearch}
                        onChange={(e) => setRechargeSearch(e.target.value)}
                        placeholder="Search UTR, Mobile..."
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs focus:outline-none w-44 sm:w-56"
                      />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex p-1 rounded-xl bg-black/60 border border-white/10 gap-1 text-xs">
                      {(['pending', 'approved', 'rejected', 'all'] as const).map((mode) => {
                        const count =
                          mode === 'all'
                            ? rechargeRequestsList.length
                            : rechargeRequestsList.filter((r) => r.status === mode).length;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setRechargeFilter(mode)}
                            className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all text-[11px] flex items-center gap-1 ${
                              rechargeFilter === mode
                                ? 'bg-pink-600 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <span>{mode}</span>
                            <span className="opacity-75">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {filteredRecharges.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-black/30 border border-white/10">
                    <p className="text-sm text-gray-400">Koi recharge request nahi mili ({rechargeFilter}).</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRecharges.map((req) => (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                          req.status === 'pending'
                            ? 'bg-[#1b082e]/80 border-amber-500/50 shadow-lg shadow-amber-950/20'
                            : req.status === 'approved'
                            ? 'bg-black/40 border-emerald-500/30'
                            : 'bg-black/30 border-white/10 opacity-75'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
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
                                  <span>Approved & Credited</span>
                                </>
                              ) : req.status === 'rejected' ? (
                                <>
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Rejected</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Awaiting Admin Verification</span>
                                </>
                              )}
                            </span>

                            <span className="text-sm font-black text-white">
                              {req.userName || 'Caller User'}
                            </span>
                            {req.userPhone && (
                              <span className="text-xs font-mono text-pink-300 bg-pink-950/60 px-2 py-0.5 rounded-lg border border-pink-500/20">
                                📱 +91 {req.userPhone}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-gray-500">
                              ID: {req.userId}
                            </span>
                          </div>

                          {/* UTR and Amount Highlight Box */}
                          <div className="flex items-center gap-3 flex-wrap pt-1">
                            <div className="p-2 px-3 rounded-xl bg-black/60 border border-pink-500/30 flex items-center gap-2">
                              <span className="text-[11px] text-gray-400 font-semibold">12-Digit UTR:</span>
                              <span className="font-mono font-black text-pink-300 text-sm tracking-wider select-all">
                                {req.utr}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    navigator.clipboard.writeText(req.utr);
                                  } catch {}
                                  showToast('success', `UTR ${req.utr} copied!`);
                                }}
                                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                title="Copy UTR"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="p-2 px-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 flex items-center gap-2">
                              <span className="text-[11px] text-emerald-300">Amount Paid:</span>
                              <span className="font-black text-white text-sm">₹{req.amount}</span>
                              {req.bonus > 0 && (
                                <span className="text-[11px] text-emerald-400 font-bold">
                                  (+₹{req.bonus} Bonus)
                                </span>
                              )}
                              <span className="text-xs font-black text-emerald-300 border-l border-emerald-600/40 pl-2">
                                = ₹{req.totalBalance} Coins
                              </span>
                            </div>

                            <span className="text-[11px] text-gray-400">
                              Submitted: {new Date(req.createdAt).toLocaleString('en-IN')}
                            </span>
                          </div>

                          {req.status === 'rejected' && req.rejectReason && (
                            <p className="text-xs text-red-300 pt-1">
                              <strong>Rejection Reason:</strong> {req.rejectReason}
                            </p>
                          )}
                          {req.status === 'approved' && req.reviewedAt && (
                            <p className="text-[11px] text-emerald-300/80 pt-1">
                              ✓ Approved on {new Date(req.reviewedAt).toLocaleString('en-IN')} by Admin
                            </p>
                          )}
                        </div>

                        {/* Action Buttons for Pending Request */}
                        {req.status === 'pending' && (
                          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                            <button
                              type="button"
                              disabled={actionReqId === req.id}
                              onClick={() => handleApproveRecharge(req)}
                              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approve & Credit ₹{req.totalBalance}</span>
                            </button>

                            <button
                              type="button"
                              disabled={actionReqId === req.id}
                              onClick={() => {
                                setRejectModalReq(req);
                                setRejectReasonInput('Bank me payment receive nahi hua / Invalid UTR');
                              }}
                              className="px-3.5 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: PAYMENT RELEASE & WITHDRAWALS                                       */}
          {/* ========================================================================= */}
          {activeTab === 'payouts' && (
            <div className="space-y-6">
              {/* Financial Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-[#180928] border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">Pending Payouts to Release</span>
                    <CreditCard className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-2">
                    ₹{totalPendingPayouts.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-300 mt-1">Host girls waiting for withdrawal</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-[#180928] border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">Total Released (Paid)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-300 mt-2">
                    ₹{totalHostNetPaid.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-300 mt-1">Completed UPI/Bank transfers</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 to-[#180928] border border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300">Platform Share Retained</span>
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-purple-300 mt-2">
                    ₹{(totalGrossIncome * 0.4).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-300 mt-1">Company 40% margin</p>
                </div>
              </div>

              {/* Direct Instant Payout Release to Any Host */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[#140622] border border-pink-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-pink-600/30 text-pink-300">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white">Direct Payout Release (Custom Payout)</h3>
                      <p className="text-xs text-pink-300">Kisi bhi Host ID ko direct UPI/Bank transfer release karein</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30">
                    DIRECT TRANSFER
                  </span>
                </div>

                <form onSubmit={handleCreateDirectPayout} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Select Host ID</label>
                    <select
                      value={directHostId}
                      onChange={(e) => {
                        setDirectHostId(e.target.value);
                        const picked = hostsList.find(h => h.id === e.target.value);
                        if (picked) {
                          setDirectUpiOrBank(picked.upiId || `${picked.phone}@okaxis`);
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-bold focus:outline-none"
                    >
                      {hostsList.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.id}) • Pending: ₹{h.pendingPayout.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      value={directAmount}
                      onChange={(e) => setDirectAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-bold font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">UPI ID / Bank Detail</label>
                    <input
                      type="text"
                      required
                      value={directUpiOrBank}
                      onChange={(e) => setDirectUpiOrBank(e.target.value)}
                      placeholder="aarohi@okhdfcbank"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Bank UTR / Ref No.</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={directUtr}
                        onChange={(e) => setDirectUtr(e.target.value)}
                        placeholder={`UTR${Date.now().toString().slice(-6)}`}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-mono focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs shadow-lg flex-shrink-0"
                      >
                        Release
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Withdrawal Requests List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-black text-white">Host Withdrawal Requests & History</h3>
                    <p className="text-xs text-gray-400">Host girls ke withdrawal requests ko approve ya release karein</p>
                  </div>
                  {/* Filter Pills */}
                  <div className="flex p-1 rounded-xl bg-black/60 border border-white/10 gap-1 text-xs">
                    {(['pending', 'completed', 'rejected', 'all'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPayoutFilter(mode)}
                        className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                          payoutFilter === mode
                            ? 'bg-pink-600 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredPayouts.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-black/30 border border-white/10">
                    <p className="text-sm text-gray-400">Koi payout record nahi mila ({payoutFilter}).</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredPayouts.map((p) => {
                      const hostMatch = hostsList.find(h => h.id === p.hostId);
                      return (
                        <div
                          key={p.id}
                          className="p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-pink-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            <div className={`p-2.5 rounded-xl font-black text-xs ${
                              p.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : p.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                              ₹{p.amount.toFixed(2)}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-black text-white">
                                  {hostMatch?.name || p.hostId}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-mono text-pink-300">
                                  ID: {p.hostId}
                                </span>
                              </div>
                              <p className="text-xs text-gray-300 mt-0.5">
                                Mode: <strong className="text-white uppercase">{p.method}</strong> • Detail: <strong className="font-mono text-pink-200">{p.upiId || 'Bank Transfer'}</strong>
                                {(p.panNumber || hostMatch?.verification?.panNumber) && (
                                  <span> • PAN: <strong className="font-mono text-amber-300">{p.panNumber || hostMatch?.verification?.panNumber}</strong></span>
                                )}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                                <span>Date: {new Date(p.timestamp).toLocaleString('en-IN')}</span>
                                {p.referenceId && <span>Ref: <strong className="font-mono text-emerald-300">{p.referenceId}</strong></span>}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {p.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setReleasingPayout(p);
                                    setReleaseUtr(`UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`);
                                  }}
                                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Release Payment</span>
                                </button>
                                <button
                                  onClick={() => handleRejectPayout(p)}
                                  className="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-bold text-xs"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {p.status === 'completed' && (
                              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Paid & Released</span>
                              </span>
                            )}
                            {p.status === 'rejected' && (
                              <span className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                                Rejected & Refunded
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: HOST IDS DIRECTORY ("sab ki host id ki details dekh sakey")        */}
          {/* ========================================================================= */}
          {activeTab === 'hosts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-white">Registered Host Girls ({hostsList.length})</h3>
                  <p className="text-xs text-pink-300">Sabhi Host IDs, Mobile Numbers, Call Minutes aur 60% Earnings</p>
                </div>
                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={hostSearch}
                    onChange={(e) => setHostSearch(e.target.value)}
                    placeholder="Search Host ID, Name, Mobile..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {filteredHosts.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-black/30 border border-white/10">
                  <p className="text-sm text-gray-400">Koi Host ID match nahi hui.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredHosts.map((host) => (
                    <div
                      key={host.id}
                      className="p-4 rounded-2xl bg-black/50 border border-pink-500/30 hover:border-pink-500 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={host.avatar}
                            alt={host.name}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-pink-500/60 flex-shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-black text-white">{host.name}</h4>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono">
                                Age {host.age}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-pink-400 font-bold">
                              ID: {host.id}
                            </p>
                            <p className="text-xs font-mono text-gray-300">
                              Mobile: +91 {host.phone}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              City: {host.city} • Lang: {host.languages?.join(', ')}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            host.status === 'online'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {host.status}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            host.isVerified
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {host.isVerified ? '✓ Aadhaar Verified' : '⚠️ Unverified'}
                          </span>
                        </div>
                      </div>

                      {/* Performance & Earnings Metric Pills */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                        <div className="p-2 rounded-xl bg-white/5">
                          <span className="text-[10px] text-gray-400 block">Call Minutes</span>
                          <span className="text-xs font-black text-white">
                            {(host.totalVoiceMinutes || 0) + (host.totalVideoMinutes || 0)}m
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white/5">
                          <span className="text-[10px] text-gray-400 block">60% Net Earned</span>
                          <span className="text-xs font-black text-emerald-400">
                            ₹{(host.netIncome || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <span className="text-[10px] text-amber-300 block">Pending Payout</span>
                          <span className="text-xs font-black text-amber-300">
                            ₹{(host.pendingPayout || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* 20hr Weekly Long Call Incentive Status */}
                      {(() => {
                        const totalMins = (host.totalVoiceMinutes || 0) + (host.totalVideoMinutes || 0);
                        const totalHrs = (totalMins / 60).toFixed(1);
                        const is20HrReached = totalMins >= 1200;
                        return (
                          <div className={`px-2.5 py-1.5 rounded-xl text-[11px] flex items-center justify-between border ${
                            is20HrReached
                              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                              : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                          }`}>
                            <span className="font-semibold flex items-center gap-1">
                              <span>🎁 20hr Weekly Incentive:</span>
                              <strong>{totalHrs}h / 20h</strong>
                            </span>
                            <span className="font-bold">
                              {is20HrReached ? '✅ ₹200 Eligible' : `${(Math.max(0, 20 - parseFloat(totalHrs))).toFixed(1)}h baaki`}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Host Actions */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        <button
                          onClick={() => {
                            setDirectHostId(host.id);
                            setDirectUpiOrBank(host.upiId || `${host.phone}@okaxis`);
                            setDirectAmount(host.pendingPayout > 0 ? host.pendingPayout.toString() : '500');
                            setActiveTab('payouts');
                          }}
                          className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Release Payout</span>
                        </button>

                        <button
                          onClick={() => handleToggleHostVerification(host)}
                          className="py-1.5 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 font-bold text-xs"
                          title="Toggle Verification"
                        >
                          {host.isVerified ? 'Unverify' : 'Verify ID'}
                        </button>

                        <button
                          onClick={() => handleToggleHostBlock(host)}
                          className="py-1.5 px-3 rounded-xl bg-red-950/50 hover:bg-red-900/50 border border-red-500/30 text-red-300 font-bold text-xs"
                          title="Block / Unblock Host"
                        >
                          {host.status === 'offline' ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: USER IDS DIRECTORY ("sab ki user id ki details dekh sakey")        */}
          {/* ========================================================================= */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-white">Registered Caller Users ({usersList.length})</h3>
                  <p className="text-xs text-pink-300">Sabhi Caller IDs, Mobile Numbers, Coin Balances aur Last Login</p>
                </div>
                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search User ID, Name, Mobile..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-black/30 border border-white/10">
                  <p className="text-sm text-gray-400">Koi User ID match nahi hui.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-4 rounded-2xl bg-black/50 border border-blue-500/30 hover:border-blue-500 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'}
                            alt={u.name}
                            className="w-12 h-12 rounded-2xl object-cover border border-blue-400 flex-shrink-0"
                          />
                          <div>
                            <h4 className="text-sm font-black text-white">{u.name}</h4>
                            <p className="text-xs font-mono text-blue-400 font-bold">
                              ID: {u.id}
                            </p>
                            <p className="text-xs font-mono text-gray-300">
                              Mobile: +91 {u.phone}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Joined: {new Date(u.createdAt).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-black text-amber-300 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30">
                            ₹{(u.balance || 0).toFixed(2)} Coins
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            u.status === 'blocked' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {u.status || 'Active'}
                          </span>
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-2">
                        <button
                          onClick={() => {
                            setCoinModalUser(u);
                            setCoinAddAmount('100');
                          }}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                        >
                          <Coins className="w-3.5 h-3.5 text-amber-300" />
                          <span>Add Coins to Wallet</span>
                        </button>

                        <button
                          onClick={() => handleToggleUserBlock(u)}
                          className="py-1.5 px-3 rounded-xl bg-red-950/50 hover:bg-red-900/50 border border-red-500/30 text-red-300 font-bold text-xs"
                        >
                          {u.status === 'blocked' ? 'Unblock' : 'Block User'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: ANALYTICS & REVENUE                                                */}
          {/* ========================================================================= */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-[#1b0a2c] border border-pink-500/30">
                  <span className="text-xs font-bold text-pink-300 uppercase">Gross Platform Turnover</span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">₹{totalGrossIncome.toFixed(2)}</p>
                  <span className="text-[10px] text-emerald-400">Total Recharge & Call Value</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#0c2417] border border-emerald-500/30">
                  <span className="text-xs font-bold text-emerald-300 uppercase">Host 60% Payouts Paid</span>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1">₹{totalHostNetPaid.toFixed(2)}</p>
                  <span className="text-[10px] text-emerald-400">Completed Bank & UPI Transfers</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#0e1630] border border-blue-500/30">
                  <span className="text-xs font-bold text-blue-300 uppercase">Registered Callers</span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">{usersList.length}</p>
                  <span className="text-[10px] text-blue-300/80">Unique 1-Mobile Accounts</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#26101e] border border-rose-500/30">
                  <span className="text-xs font-bold text-rose-300 uppercase">Registered Hosts</span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">{hostsList.length}</p>
                  <span className="text-[10px] text-rose-300/80">Active Companion Girls</span>
                </div>
              </div>

              {/* Cloud Sync Status */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isFirebaseActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Google Cloud Firestore Connection</h4>
                    <p className="text-xs text-gray-400">
                      {isFirebaseActive ? 'Connected & Live Syncing to Cloud Database' : 'Running on High-Performance Persistent Local Storage'}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isFirebaseActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isFirebaseActive ? 'Cloud Active' : 'Local Fallback'}
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: PLATFORM SETTINGS & RATES                                          */}
          {/* ========================================================================= */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#200e36] to-[#140822] border border-pink-500/30">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-pink-400" />
                  <span>Platform Rate & Commission Controls</span>
                </h4>
                <p className="text-xs text-gray-300 mt-0.5">
                  Rates change karne par caller rates (Audio: ₹7/min, Video: ₹15/min, Chat: ₹3/msg) aur host earnings real-time update ho jayenge.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Voice Call Rate (₹ / Min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={voiceRate}
                    onChange={(e) => setVoiceRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Video Call Rate (₹ / Min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={videoRate}
                    onChange={(e) => setVideoRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Sakhi Chat Message Rate (₹ / Msg)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={chatRate}
                    onChange={(e) => setChatRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Host Income Commission Share (%)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={hostShare}
                    onChange={(e) => setHostShare(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm focus:outline-none"
                  />
                </div>

                {/* Active Weekly Promotion Card */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider">
                      Active Host Promotion Policy
                    </span>
                    <h5 className="text-xs font-bold text-white">
                      🎁 Weekly Long Call Incentive: 20hr+ Call Time = ₹200 Flat Cash Bonus
                    </h5>
                    <p className="text-[10px] text-gray-300">
                      Hosts who complete 20 hours (1,200 min) weekly call time earn ₹200 extra bonus credited directly to their pending payout wallet.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase whitespace-nowrap shadow">
                    Active ₹200
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Official Deposit UPI ID (Payment Receiver)
                  </label>
                  <input
                    type="text"
                    value={adminUpiIdInput}
                    onChange={(e) => setAdminUpiIdInput(e.target.value)}
                    placeholder="e.g. sunosakhi@okaxis"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Users will send wallet recharge payments to this UPI ID.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Official Receiver Business Name
                  </label>
                  <input
                    type="text"
                    value={adminUpiNameInput}
                    onChange={(e) => setAdminUpiNameInput(e.target.value)}
                    placeholder="e.g. Suno Sakhi Official"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white text-sm focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white font-black text-xs shadow-xl shadow-pink-600/30"
              >
                Save Platform Rates & UPI Config
              </button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: NUDITY BAN & SAFETY ENFORCEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'nudity' && (
            <div className="space-y-6">
              {/* Zero Tolerance Safety Warning Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-red-950/80 via-purple-950/60 to-black/80 border border-red-500/50 shadow-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/40 flex-shrink-0 animate-pulse">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-red-100 flex items-center gap-2">
                        <span>ZERO TOLERANCE NUDITY BAN ENFORCEMENT</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold uppercase">
                          ACTIVE 24/7
                        </span>
                      </h3>
                      <p className="text-xs text-red-300/90 leading-relaxed mt-0.5">
                        Any caller or host displaying nudity or sexual misconduct during live video calls is permanently banned. Their phone number & device fingerprint are blacklisted immediately.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-red-900/30 to-black/60 border border-red-500/30 space-y-1">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Reported Incidents</span>
                  <p className="text-2xl sm:text-3xl font-black text-red-400 font-mono">{nudityReports.length}</p>
                  <p className="text-[10px] text-red-300/70">Automatic call terminations</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/30 to-black/60 border border-purple-500/30 space-y-1">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Blacklisted Numbers</span>
                  <p className="text-2xl sm:text-3xl font-black text-purple-300 font-mono">{bannedPhonesList.length}</p>
                  <p className="text-[10px] text-purple-300/70">Blocked from OTP & login</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-black/60 border border-emerald-500/30 space-y-1">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Active Safety Policy</span>
                  <p className="text-lg sm:text-xl font-black text-emerald-400 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>STRICT BAN</span>
                  </p>
                  <p className="text-[10px] text-emerald-300/70">Video Rate ₹15/m • Audio ₹7/m</p>
                </div>
              </div>

              {/* Manual Phone Number Ban Box */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[#140826] border border-pink-500/20 space-y-3">
                <h4 className="text-xs font-black uppercase text-pink-300 tracking-wider flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-400" />
                  <span>Manual Phone Ban / Blacklist Add</span>
                </h4>
                <form onSubmit={handleManualBan} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="tel"
                    value={manualBanPhone}
                    onChange={(e) => setManualBanPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number to ban immediately (e.g. 9876543210)"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-black/60 border border-red-500/30 text-white font-mono text-sm placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 whitespace-nowrap"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Ban & Blacklist Number</span>
                  </button>
                </form>
                <p className="text-[10px] text-gray-400">
                  Banning a phone prevents them from receiving OTPs, logging in, or calling any host on SunoSakhi.
                </p>
              </div>

              {/* Blacklisted Numbers Quick Strip */}
              {bannedPhonesList.length > 0 && (
                <div className="p-4 rounded-3xl bg-black/40 border border-white/10 space-y-3">
                  <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-400" />
                    <span>Currently Blacklisted Phone Numbers ({bannedPhonesList.length})</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {bannedPhonesList.map((phone) => (
                      <div
                        key={phone}
                        className="px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs font-mono text-red-200 flex items-center gap-2"
                      >
                        <span>+91 {phone}</span>
                        <button
                          onClick={() => handleUnbanPhone(phone)}
                          className="px-2 py-0.5 rounded-lg bg-red-800/80 hover:bg-emerald-600 text-[10px] text-white font-sans font-bold transition-all"
                          title="Unban this phone number"
                        >
                          Unban
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Reports List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-pink-300 tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Nudity Incident Logs & Reports ({nudityReports.length})</span>
                </h4>

                {nudityReports.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl bg-black/40 border border-white/5 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-gray-300">No Nudity Incidents Reported Yet</p>
                    <p className="text-[11px] text-gray-500">
                      All video calls are protected by the Zero Tolerance policy and Privacy Shield.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {nudityReports.map((report) => (
                      <div
                        key={report.id}
                        className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#180928] to-black/60 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wide">
                              BANNED
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/30 text-purple-300 text-[10px] font-semibold uppercase">
                              {report.callType.toUpperCase()} CALL
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              {new Date(report.timestamp).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </span>
                          </div>

                          <div className="text-xs text-gray-200">
                            <span className="text-red-300 font-bold">Offender: </span>
                            <strong className="text-white font-mono">{report.offenderPhone || 'Hidden'}</strong>
                            {report.offenderName && <span className="text-gray-400"> ({report.offenderName})</span>}
                            <span className="text-gray-500 mx-1.5">•</span>
                            <span className="text-gray-400">Role: </span>
                            <span className="text-pink-300 uppercase font-semibold text-[10px]">{report.offenderRole}</span>
                          </div>

                          <div className="text-xs text-gray-400">
                            <span>Reported by: </span>
                            <span className="text-emerald-300 font-semibold">{report.reporterName || report.reporterPhone}</span>
                            <span className="text-gray-500"> ({report.reportedByRole})</span>
                          </div>

                          <div className="text-xs text-gray-300 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 inline-block">
                            <span className="text-gray-400 font-semibold">Reason: </span>
                            <span className="text-red-200">{report.reason}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {report.offenderPhone && (
                            <button
                              onClick={() => handleUnbanPhone(report.offenderPhone)}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-600 text-gray-200 hover:text-white text-xs font-bold transition-all"
                            >
                              Lift Ban
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL: RELEASE PAYOUT CONFIRMATION */}
        {releasingPayout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-5 rounded-3xl bg-[#180928] border border-pink-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span>Release Host Payment</span>
                </h3>
                <button
                  onClick={() => setReleasingPayout(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
                <p className="text-gray-300">Host ID: <strong className="text-pink-300 font-mono">{releasingPayout.hostId}</strong></p>
                <p className="text-gray-300">Amount: <strong className="text-emerald-300 text-base font-black">₹{releasingPayout.amount.toFixed(2)}</strong></p>
                <p className="text-gray-300">UPI / Account: <strong className="text-white font-mono">{releasingPayout.upiId || 'Bank Transfer'}</strong></p>
              </div>

              <form onSubmit={handleConfirmReleasePayout} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Bank Reference / UTR Number
                  </label>
                  <input
                    type="text"
                    required
                    value={releaseUtr}
                    onChange={(e) => setReleaseUtr(e.target.value)}
                    placeholder="e.g. UTR123456789012"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs font-mono focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    UPI app (PhonePe / GPay / Paytm) se payment karne ke baad UTR yahan enter karein.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReleasingPayout(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs shadow-lg"
                  >
                    Confirm & Mark Paid
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD COINS TO SPECIFIC USER */}
        {coinModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-5 rounded-3xl bg-[#180928] border border-pink-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>Add Coins to Caller ID</span>
                </h3>
                <button
                  onClick={() => setCoinModalUser(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1 text-xs">
                <p className="text-gray-300">User: <strong className="text-white">{coinModalUser.name}</strong></p>
                <p className="text-gray-300">User ID: <strong className="text-pink-300 font-mono">{coinModalUser.id}</strong></p>
                <p className="text-gray-300">Mobile: <strong className="text-white font-mono">+91 {coinModalUser.phone}</strong></p>
                <p className="text-gray-300">Current Balance: <strong className="text-amber-300 font-black">₹{coinModalUser.balance.toFixed(2)}</strong></p>
              </div>

              <form onSubmit={handleAddCoinsToUser} className="space-y-3">
                {/* Quick select buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 250, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCoinAddAmount(amt.toString())}
                      className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all ${
                        coinAddAmount === amt.toString()
                          ? 'bg-pink-600 text-white border-pink-400'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Coin Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={coinAddAmount}
                    onChange={(e) => setCoinAddAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Reason / Note</label>
                  <input
                    type="text"
                    value={coinNote}
                    onChange={(e) => setCoinNote(e.target.value)}
                    placeholder="e.g. Promotional Bonus / Compensation"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCoinModalUser(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 text-white font-black text-xs shadow-lg"
                  >
                    Add Coins Now
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: REJECT RECHARGE REQUEST */}
        {rejectModalReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-5 rounded-3xl bg-[#180928] border border-red-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span>Reject Recharge Request</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setRejectModalReq(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1 text-xs">
                <p className="text-gray-300">
                  User: <strong className="text-white">{rejectModalReq.userName || rejectModalReq.userId}</strong>{' '}
                  {rejectModalReq.userPhone ? `(+91 ${rejectModalReq.userPhone})` : ''}
                </p>
                <p className="text-gray-300">
                  Amount: <strong className="text-pink-300">₹{rejectModalReq.amount}</strong> (+₹{rejectModalReq.bonus} bonus)
                </p>
                <p className="text-gray-300">
                  Submitted UTR: <strong className="font-mono text-amber-300 select-all">{rejectModalReq.utr}</strong>
                </p>
              </div>

              <form onSubmit={handleConfirmRejectRecharge} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Reject Reason (Wajah darj karein) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="e.g. Bank me payment receive nahi hua / Fake UTR"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-red-500/30 text-white text-xs focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Ye reason user ko uske wallet history me dikhega.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRejectModalReq(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 text-white font-black text-xs shadow-lg"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

