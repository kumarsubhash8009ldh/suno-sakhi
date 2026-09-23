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
  AlertOctagon,
  Trash2,
  QrCode as QrIcon,
  Upload,
  Image as ImageIcon,
  PlusCircle,
  ExternalLink,
  Download,
  Eye,
  FileText,
  Camera,
  Edit3
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { HostProfile, HostPayoutRecord, RechargeRequest, HelplineContact } from '../types';
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
  setUserBalanceDirect,
  deleteUserAccountPermanently,
  SUPER_ADMIN_PHONE,
  AdminUserDetails
} from '../services/adminSync';
import {
  fetchAllRechargeRequests,
  subscribeToAllRechargeRequests,
  approveRechargeRequest,
  rejectRechargeRequest,
  adminDirectDeposit
} from '../services/rechargeSync';
import { UpiQrScanner } from './UpiQrScanner';

interface AdminPanelProps {
  isModal?: boolean;
  onClose?: () => void;
  isSuperAdmin?: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isModal = false, onClose, isSuperAdmin = false }) => {
  const { settings, isFirebaseActive, updateSettings, closeAdmin } = useAdmin();
  const { balance } = useWallet();
  const { hostProfile } = useHost();

  const [activeTab, setActiveTab] = useState<'recharges' | 'payouts' | 'hosts' | 'users' | 'helpline' | 'analytics' | 'settings' | 'nudity'>('recharges');

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

  // Super Admin Flexible Balance Adjustment (Kam / Jyada / Exact Set)
  const [balanceTarget, setBalanceTarget] = useState<{
    id: string;
    name: string;
    phone?: string;
    role: 'caller' | 'host';
    currentBalance: number;
  } | null>(null);
  const [balanceAdjustType, setBalanceAdjustType] = useState<'add' | 'deduct' | 'exact'>('add');
  const [balanceAmountInput, setBalanceAmountInput] = useState<string>('100');
  const [balanceReasonInput, setBalanceReasonInput] = useState<string>('Admin Adjustment');

  // Super Admin Permanent Account Deletion
  const [deletingTarget, setDeletingTarget] = useState<{
    id: string;
    name: string;
    phone?: string;
    role: 'caller' | 'host';
  } | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

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
  const [adminQrCodeUrlInput, setAdminQrCodeUrlInput] = useState(settings.adminQrCodeUrl || '');
  const [isUploadingQr, setIsUploadingQr] = useState<boolean>(false);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [showDirectDepositModal, setShowDirectDepositModal] = useState<boolean>(false);

  // Helpline State
  const [callHelplines, setCallHelplines] = useState<HelplineContact[]>(
    settings.callHelplines || [
      { id: 'call-1', title: '24x7 Direct Phone Helpline', number: settings.supportPhone || '+91 7009600157', type: 'call', isPrimary: true }
    ]
  );
  const [whatsappHelplines, setWhatsappHelplines] = useState<HelplineContact[]>(
    settings.whatsappHelplines || [
      { id: 'wa-1', title: '24x7 WhatsApp Chat Support', number: settings.supportWhatsApp || '+91 7009600157', type: 'whatsapp', isPrimary: true }
    ]
  );
  const [newCallTitle, setNewCallTitle] = useState('');
  const [newCallNumber, setNewCallNumber] = useState('');
  const [newWaTitle, setNewWaTitle] = useState('');
  const [newWaNumber, setNewWaNumber] = useState('');

  // Quick Update State for Primary Helpline Numbers
  const [quickPhoneInput, setQuickPhoneInput] = useState<string>(
    settings.supportPhone || '+91 7009600157'
  );
  const [quickWaInput, setQuickWaInput] = useState<string>(
    settings.supportWhatsApp || '+91 7009600157'
  );

  // Inline Editing State for Phone Helplines
  const [editingCallId, setEditingCallId] = useState<string | null>(null);
  const [editCallTitle, setEditCallTitle] = useState<string>('');
  const [editCallNumber, setEditCallNumber] = useState<string>('');

  // Inline Editing State for WhatsApp Helplines
  const [editingWaId, setEditingWaId] = useState<string | null>(null);
  const [editWaTitle, setEditWaTitle] = useState<string>('');
  const [editWaNumber, setEditWaNumber] = useState<string>('');

  // Direct Deposit Form States
  const [depositTargetRole, setDepositTargetRole] = useState<'caller' | 'host'>('caller');
  const [depositTargetId, setDepositTargetId] = useState<string>('');
  const [depositTargetName, setDepositTargetName] = useState<string>('');
  const [depositTargetPhone, setDepositTargetPhone] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<string>('100');
  const [depositBonus, setDepositBonus] = useState<string>('5');
  const [depositMethod, setDepositMethod] = useState<'UPI' | 'Scanner' | 'Cash' | 'Manual'>('UPI');
  const [depositUtr, setDepositUtr] = useState<string>('');
  const [depositNote, setDepositNote] = useState<string>('');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState<boolean>(false);

  // Host KYC Inspection & Review Modal States
  const [reviewingHostKyc, setReviewingHostKyc] = useState<HostProfile | null>(null);
  const [kycAdminNote, setKycAdminNote] = useState<string>('');
  const [kycProcessing, setKycProcessing] = useState<boolean>(false);
  const [hostKycFilter, setHostKycFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [expandedDocImage, setExpandedDocImage] = useState<string | null>(null);

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

  useEffect(() => {
    if (settings.adminUpiId) setAdminUpiIdInput(settings.adminUpiId);
    if (settings.adminUpiName) setAdminUpiNameInput(settings.adminUpiName);
    if (settings.adminQrCodeUrl !== undefined) setAdminQrCodeUrlInput(settings.adminQrCodeUrl || '');
    if (settings.callHelplines) setCallHelplines(settings.callHelplines);
    if (settings.whatsappHelplines) setWhatsappHelplines(settings.whatsappHelplines);
    if (settings.supportPhone) setQuickPhoneInput(settings.supportPhone);
    if (settings.supportWhatsApp) setQuickWaInput(settings.supportWhatsApp);
  }, [settings]);

  // Filtered lists
  const filteredHosts = useMemo(() => {
    return hostsList.filter((h) => {
      // Filter by KYC tab
      if (hostKycFilter === 'pending' && (!h || h.isVerified || h.verification?.status !== 'pending')) {
        return false;
      }
      if (hostKycFilter === 'verified' && (!h || !h.isVerified || h.verification?.status !== 'verified')) {
        return false;
      }
      if (hostKycFilter === 'rejected' && (!h || h.verification?.status !== 'rejected')) {
        return false;
      }

      const query = hostSearch.toLowerCase().trim();
      if (!query) return true;
      return (
        (h.id || '').toLowerCase().includes(query) ||
        (h.name || '').toLowerCase().includes(query) ||
        (h.phone || '').includes(query) ||
        (h.city || '').toLowerCase().includes(query)
      );
    });
  }, [hostsList, hostSearch, hostKycFilter]);

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

  // Handler: Super Admin Flexible Balance Adjustment (Kam / Jyada / Exact)
  const handleExecuteBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceTarget) return;

    const val = parseFloat(balanceAmountInput);
    if (isNaN(val) || val < 0) {
      showToast('error', 'Kripya sahi valid amount enter karein.');
      return;
    }

    let nextBal = balanceTarget.currentBalance;
    if (balanceAdjustType === 'add') {
      nextBal = balanceTarget.currentBalance + val;
    } else if (balanceAdjustType === 'deduct') {
      nextBal = Math.max(0, balanceTarget.currentBalance - val);
    } else {
      nextBal = val;
    }

    const res = await setUserBalanceDirect(
      balanceTarget.phone || balanceTarget.id,
      nextBal,
      balanceTarget.role,
      balanceReasonInput
    );

    if (res.success) {
      showToast('success', res.message);
      setBalanceTarget(null);
      loadData();
    } else {
      showToast('error', 'Balance update nahi ho saka.');
    }
  };

  // Handler: Super Admin Permanent Account Deletion
  const handleConfirmDeleteAccount = async () => {
    if (!deletingTarget) return;
    setIsDeletingAccount(true);
    try {
      const res = await deleteUserAccountPermanently(
        deletingTarget.phone || deletingTarget.id,
        deletingTarget.role
      );
      if (res.success) {
        showToast('success', res.message);
        setDeletingTarget(null);
        loadData();
      } else {
        showToast('error', res.message);
      }
    } catch (e) {
      showToast('error', 'Account delete karte samay error aaya.');
    } finally {
      setIsDeletingAccount(false);
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

  // Handler: Toggle Host Verification
  const handleToggleHostVerification = async (h: HostProfile) => {
    const newStatus = !h.isVerified;
    await setHostVerificationStatus(h.id, newStatus);
    showToast('success', `Host (${h.name}) verification status ${newStatus ? 'Verified ✅' : 'Unverified ⚠️'} kar diya gaya!`);
    loadData();
  };

  // Handler: Approve Host KYC from Review Modal
  const handleApproveHostKyc = async (hostId: string) => {
    setKycProcessing(true);
    try {
      const res = await setHostVerificationStatus(hostId, true, kycAdminNote || 'Approved by Super Admin');
      showToast('success', res.message || 'Host successfully approved & activated!');
      setReviewingHostKyc(null);
      setKycAdminNote('');
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Host approve karne me samasya aayi.');
    } finally {
      setKycProcessing(false);
    }
  };

  // Handler: Reject Host KYC from Review Modal
  const handleRejectHostKyc = async (hostId: string) => {
    setKycProcessing(true);
    try {
      const res = await setHostVerificationStatus(hostId, false, kycAdminNote.trim() || 'Admin verification rejected');
      showToast('success', res.message || 'Host KYC reject kar di gayi.');
      setReviewingHostKyc(null);
      setKycAdminNote('');
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Host reject karne me samasya aayi.');
    } finally {
      setKycProcessing(false);
    }
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
      adminUpiName: adminUpiNameInput.trim(),
      adminQrCodeUrl: adminQrCodeUrlInput.trim(),
      callHelplines,
      whatsappHelplines,
      supportPhone: callHelplines.find((c) => c.isPrimary)?.number || callHelplines[0]?.number || settings.supportPhone || '+91 7009600157',
      supportWhatsApp: whatsappHelplines.find((w) => w.isPrimary)?.number || whatsappHelplines[0]?.number || settings.supportWhatsApp || '+91 7009600157'
    });
    showToast('success', '✅ Platform Rates, Commission, Deposit UPI, Scanner aur Helpline Numbers update ho gaye!');
  };

  // Handlers: Add / Remove Helpline Numbers
  const handleAddCallHelpline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCallNumber.trim()) {
      showToast('error', 'Kripya valid Calling Helpline number dalein.');
      return;
    }
    const newEntry: HelplineContact = {
      id: 'call-' + Date.now(),
      title: newCallTitle.trim() || 'Direct Phone Helpline',
      number: newCallNumber.trim(),
      type: 'call',
      isPrimary: callHelplines.length === 0
    };
    const updated = [...callHelplines, newEntry];
    setCallHelplines(updated);
    updateSettings({
      callHelplines: updated,
      supportPhone: updated.find((c) => c.isPrimary)?.number || updated[0].number
    });
    setNewCallTitle('');
    setNewCallNumber('');
    showToast('success', '✅ Naya Phone Helpline number add ho gaya!');
  };

  const handleRemoveCallHelpline = (id: string) => {
    if (callHelplines.length <= 1) {
      if (!window.confirm('Yeh aakhri phone helpline number hai. Kya aap ise hatana chahte hain?')) return;
    }
    const updated = callHelplines.filter((c) => c.id !== id);
    setCallHelplines(updated);
    updateSettings({
      callHelplines: updated,
      supportPhone: updated[0]?.number || ''
    });
    showToast('success', 'Phone helpline number hata diya gaya.');
  };

  const handleTogglePrimaryCall = (id: string) => {
    const updated = callHelplines.map((c) => ({
      ...c,
      isPrimary: c.id === id
    }));
    setCallHelplines(updated);
    updateSettings({
      callHelplines: updated,
      supportPhone: updated.find((c) => c.id === id)?.number || updated[0]?.number || ''
    });
    showToast('success', 'Primary calling number update ho gaya!');
  };

  const handleAddWhatsAppHelpline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newWaNumber.trim()) {
      showToast('error', 'Kripya valid WhatsApp Helpline number dalein.');
      return;
    }
    const newEntry: HelplineContact = {
      id: 'wa-' + Date.now(),
      title: newWaTitle.trim() || '24x7 WhatsApp Chat Support',
      number: newWaNumber.trim(),
      type: 'whatsapp',
      isPrimary: whatsappHelplines.length === 0
    };
    const updated = [...whatsappHelplines, newEntry];
    setWhatsappHelplines(updated);
    updateSettings({
      whatsappHelplines: updated,
      supportWhatsApp: updated.find((w) => w.isPrimary)?.number || updated[0].number
    });
    setNewWaTitle('');
    setNewWaNumber('');
    showToast('success', '✅ Naya WhatsApp Support number add ho gaya!');
  };

  const handleRemoveWhatsAppHelpline = (id: string) => {
    if (whatsappHelplines.length <= 1) {
      if (!window.confirm('Yeh aakhri WhatsApp helpline number hai. Kya aap ise hatana chahte hain?')) return;
    }
    const updated = whatsappHelplines.filter((w) => w.id !== id);
    setWhatsappHelplines(updated);
    updateSettings({
      whatsappHelplines: updated,
      supportWhatsApp: updated[0]?.number || ''
    });
    showToast('success', 'WhatsApp support number hata diya gaya.');
  };

  const handleTogglePrimaryWhatsApp = (id: string) => {
    const updated = whatsappHelplines.map((w) => ({
      ...w,
      isPrimary: w.id === id
    }));
    setWhatsappHelplines(updated);
    updateSettings({
      whatsappHelplines: updated,
      supportWhatsApp: updated.find((w) => w.id === id)?.number || updated[0]?.number || ''
    });
    showToast('success', 'Primary WhatsApp support number update ho gaya!');
  };

  // Quick 1-Click Update for Primary Calling Number
  const handleQuickUpdatePhone = () => {
    if (!quickPhoneInput.trim()) {
      showToast('error', 'Kripya valid Calling Helpline number dalein.');
      return;
    }
    const cleanNum = quickPhoneInput.trim();
    let updated: HelplineContact[];
    const primaryIndex = callHelplines.findIndex((c) => c.isPrimary);
    if (primaryIndex >= 0) {
      updated = callHelplines.map((c, i) =>
        i === primaryIndex ? { ...c, number: cleanNum } : c
      );
    } else if (callHelplines.length > 0) {
      updated = [{ ...callHelplines[0], number: cleanNum, isPrimary: true }, ...callHelplines.slice(1)];
    } else {
      updated = [{ id: 'call-' + Date.now(), title: 'Direct Phone Helpline', number: cleanNum, type: 'call', isPrimary: true }];
    }
    setCallHelplines(updated);
    updateSettings({
      callHelplines: updated,
      supportPhone: cleanNum
    });
    showToast('success', '✅ Primary Calling Helpline Number update ho gaya: ' + cleanNum);
  };

  // Quick 1-Click Update for Primary WhatsApp Number
  const handleQuickUpdateWhatsApp = () => {
    if (!quickWaInput.trim()) {
      showToast('error', 'Kripya valid WhatsApp number dalein.');
      return;
    }
    const cleanNum = quickWaInput.trim();
    let updated: HelplineContact[];
    const primaryIndex = whatsappHelplines.findIndex((w) => w.isPrimary);
    if (primaryIndex >= 0) {
      updated = whatsappHelplines.map((w, i) =>
        i === primaryIndex ? { ...w, number: cleanNum } : w
      );
    } else if (whatsappHelplines.length > 0) {
      updated = [{ ...whatsappHelplines[0], number: cleanNum, isPrimary: true }, ...whatsappHelplines.slice(1)];
    } else {
      updated = [{ id: 'wa-' + Date.now(), title: 'WhatsApp Chat Support', number: cleanNum, type: 'whatsapp', isPrimary: true }];
    }
    setWhatsappHelplines(updated);
    updateSettings({
      whatsappHelplines: updated,
      supportWhatsApp: cleanNum
    });
    showToast('success', '✅ Primary WhatsApp Number update ho gaya: ' + cleanNum);
  };

  // Start Inline Editing for Call Helpline
  const handleStartEditCall = (item: HelplineContact) => {
    setEditingCallId(item.id);
    setEditCallTitle(item.title);
    setEditCallNumber(item.number);
  };

  // Save Inline Edit for Call Helpline
  const handleSaveEditCall = (id: string) => {
    if (!editCallNumber.trim()) {
      showToast('error', 'Kripya valid Calling number dalein.');
      return;
    }
    const updated = callHelplines.map((c) =>
      c.id === id ? { ...c, title: editCallTitle.trim() || c.title, number: editCallNumber.trim() } : c
    );
    setCallHelplines(updated);
    const prim = updated.find((c) => c.isPrimary) || updated[0];
    updateSettings({
      callHelplines: updated,
      supportPhone: prim?.number || ''
    });
    setEditingCallId(null);
    showToast('success', '✅ Phone helpline number safaltapoorvak update ho gaya!');
  };

  const handleCancelEditCall = () => {
    setEditingCallId(null);
    setEditCallTitle('');
    setEditCallNumber('');
  };

  // Start Inline Editing for WhatsApp Helpline
  const handleStartEditWa = (item: HelplineContact) => {
    setEditingWaId(item.id);
    setEditWaTitle(item.title);
    setEditWaNumber(item.number);
  };

  // Save Inline Edit for WhatsApp Helpline
  const handleSaveEditWa = (id: string) => {
    if (!editWaNumber.trim()) {
      showToast('error', 'Kripya valid WhatsApp number dalein.');
      return;
    }
    const updated = whatsappHelplines.map((w) =>
      w.id === id ? { ...w, title: editWaTitle.trim() || w.title, number: editWaNumber.trim() } : w
    );
    setWhatsappHelplines(updated);
    const prim = updated.find((w) => w.isPrimary) || updated[0];
    updateSettings({
      whatsappHelplines: updated,
      supportWhatsApp: prim?.number || ''
    });
    setEditingWaId(null);
    showToast('success', '✅ WhatsApp helpline number safaltapoorvak update ho gaya!');
  };

  const handleCancelEditWa = () => {
    setEditingWaId(null);
    setEditWaTitle('');
    setEditWaNumber('');
  };

  // Handler: Upload QR Scanner Image (PhonePe/GPay Standee or Screenshot)
  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Kripya valid image file (PNG/JPG) chunein.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Image size 2MB se kam hona chahiye.');
      return;
    }

    setIsUploadingQr(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAdminQrCodeUrlInput(reader.result);
        showToast('success', 'Custom Scanner Image upload ho gayi! Live save karne ke liye "Save" button dabayein.');
      }
      setIsUploadingQr(false);
    };
    reader.onerror = () => {
      showToast('error', 'Image upload karne me error aaya.');
      setIsUploadingQr(false);
    };
    reader.readAsDataURL(file);
  };

  // Handler: Quick Save Scanner & UPI from modal or hub
  const handleQuickSaveScanner = () => {
    updateSettings({
      adminUpiId: adminUpiIdInput.trim(),
      adminUpiName: adminUpiNameInput.trim(),
      adminQrCodeUrl: adminQrCodeUrlInput.trim()
    });
    showToast('success', '✅ Deposit UPI ID aur Scanner live update ho gaye!');
    setShowScannerModal(false);
  };

  // Handler: Open Direct Deposit modal pre-filled for a user or host
  const handleOpenDirectDeposit = (target: {
    id: string;
    name: string;
    phone?: string;
    role: 'caller' | 'host';
  }) => {
    setDepositTargetRole(target.role);
    setDepositTargetId(target.id);
    setDepositTargetName(target.name);
    setDepositTargetPhone(target.phone || '');
    setDepositAmount('100');
    setDepositBonus(target.role === 'caller' ? '5' : '0');
    setDepositMethod('UPI');
    setDepositUtr('');
    setDepositNote(`Admin Direct Deposit via UPI`);
    setShowDirectDepositModal(true);
  };

  // Handler: Execute Direct Deposit
  const handleExecuteDirectDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    const bonusNum = parseFloat(depositBonus) || 0;

    if (!depositTargetId) {
      showToast('error', 'Kripya user ya host select karein.');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('error', 'Kripya valid deposit amount enter karein.');
      return;
    }

    setIsSubmittingDeposit(true);
    try {
      const res = await adminDirectDeposit({
        userId: depositTargetId,
        userName: depositTargetName,
        userPhone: depositTargetPhone,
        amount: amountNum,
        bonus: bonusNum,
        method: depositMethod,
        utr: depositUtr,
        note: depositNote || `Admin Direct Deposit (${depositMethod})`,
        role: depositTargetRole
      });

      if (res.success) {
        showToast('success', res.message);
        setShowDirectDepositModal(false);
        loadData();
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Deposit karne me error aaya.');
    } finally {
      setIsSubmittingDeposit(false);
    }
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
              label: '📥 Deposit & Recharges (जमा & स्कैनर)',
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
              id: 'helpline',
              label: '🎧 Helpline & WhatsApp Support',
              badge: callHelplines.length + whatsappHelplines.length,
              badgeClass: 'bg-emerald-600 text-white font-black'
            },
            {
              id: 'nudity',
              label: '🚨 Nudity Ban Reports',
              badge: nudityReports.length,
              badgeClass: 'bg-red-600 text-white font-black animate-pulse'
            },
            { id: 'analytics', label: '📊 Financials' },
            { id: 'settings', label: '⚙️ Settings, UPI & Scanner' }
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
                    {adminUpiIdInput || settings.adminUpiId || 'sunosakhi@okaxis'}
                  </p>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <p className="text-[11px] text-pink-300/80 truncate">
                      Receiver: {adminUpiNameInput || settings.adminUpiName || 'Suno Sakhi Official'}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-bold whitespace-nowrap">QR Ready</span>
                  </div>
                </div>
              </div>

              {/* OFFICIAL DEPOSIT SCANNER & UPI CONTROL HUB */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#210936] via-[#160624] to-[#12051e] border-2 border-pink-500/40 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  {/* Compact Live Scanner Preview */}
                  <div className="flex-shrink-0 p-2.5 rounded-2xl bg-white shadow-xl border-2 border-pink-500/50 group relative">
                    {adminQrCodeUrlInput ? (
                      <img
                        src={adminQrCodeUrlInput}
                        alt="Deposit Scanner"
                        className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-xl"
                      />
                    ) : (
                      <UpiQrScanner
                        upiId={adminUpiIdInput || 'sunosakhi@okaxis'}
                        name={adminUpiNameInput || 'Suno Sakhi Official'}
                        size={110}
                        showDetails={false}
                        showDownload={false}
                        className="!p-0 !bg-transparent !border-0 !shadow-none"
                      />
                    )}
                    <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-pink-600 text-white text-[9px] font-black uppercase shadow">
                      Live QR
                    </span>
                  </div>

                  {/* Info details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Active Deposit System</span>
                      </span>
                      <span className="text-xs text-pink-300 font-bold">
                        Scanner & UPI Payment Receiver
                      </span>
                    </div>

                    <h4 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 justify-center sm:justify-start">
                      <span>{adminUpiNameInput || 'Suno Sakhi Official'}</span>
                    </h4>

                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <span className="font-mono text-sm sm:text-base font-black text-pink-300 bg-black/60 px-3 py-1 rounded-xl border border-pink-500/30 select-all">
                        {adminUpiIdInput || 'sunosakhi@okaxis'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(adminUpiIdInput);
                            showToast('success', 'UPI ID copied to clipboard!');
                          } catch {}
                        }}
                        className="p-1.5 rounded-xl bg-pink-600/30 hover:bg-pink-600/50 text-pink-300 border border-pink-500/40"
                        title="Copy UPI ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-400">
                      Users ko recharge karte waqt ye Scanner aur UPI ID dikhega. Bank / UPI app me UTR verify karke approve karein.
                    </p>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex sm:flex-col gap-2 w-full lg:w-auto flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                  >
                    <QrIcon className="w-4 h-4" />
                    <span>⚙️ Change Scanner & UPI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (usersList.length > 0) {
                        handleOpenDirectDeposit({
                          id: usersList[0].id,
                          name: usersList[0].name,
                          phone: usersList[0].phone,
                          role: 'caller'
                        });
                      } else {
                        setShowDirectDepositModal(true);
                      }
                    }}
                    className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>➕ Manual Deposit / Credit Coins</span>
                  </button>

                  <a
                    href={`upi://pay?pa=${adminUpiIdInput}&pn=${encodeURIComponent(adminUpiNameInput)}&cu=INR`}
                    className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-pink-300" />
                    <span>⚡ Test UPI App</span>
                  </a>
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-black text-white">Registered Host Girls ({hostsList.length})</h3>
                  <p className="text-xs text-pink-300">Sabhi Host IDs, Mobile Numbers, Call Minutes aur Host Earnings</p>
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

              {/* Host KYC Status Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setHostKycFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    hostKycFilter === 'all'
                      ? 'bg-pink-600 text-white border-pink-400 shadow-md'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  All Hosts ({hostsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHostKycFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    hostKycFilter === 'pending'
                      ? 'bg-amber-500 text-black border-amber-400 font-black shadow-md'
                      : 'bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-900/40'
                  }`}
                >
                  <span>⏳ Pending KYC Approval</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[10px] font-black">
                    {hostsList.filter((h) => !h.isVerified && h.verification?.status === 'pending').length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setHostKycFilter('verified')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    hostKycFilter === 'verified'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                      : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                  }`}
                >
                  ✅ Approved ({hostsList.filter((h) => h.isVerified && h.verification?.status === 'verified').length})
                </button>
                <button
                  type="button"
                  onClick={() => setHostKycFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    hostKycFilter === 'rejected'
                      ? 'bg-red-600 text-white border-red-400 shadow-md'
                      : 'bg-red-950/40 text-red-300 border-red-500/30 hover:bg-red-900/40'
                  }`}
                >
                  ❌ Rejected ({hostsList.filter((h) => h.verification?.status === 'rejected').length})
                </button>
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
                          {host.isVerified && host.verification?.status === 'verified' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ✅ KYC Approved
                            </span>
                          ) : host.verification?.status === 'pending' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/30 text-amber-200 border border-amber-500/50 animate-pulse">
                              ⏳ KYC Pending Approval
                            </span>
                          ) : host.verification?.status === 'rejected' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                              ❌ KYC Rejected
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-500/20 text-gray-300 border border-gray-500/30">
                              ⚠️ KYC Unsubmitted
                            </span>
                          )}
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
                          <span className="text-[10px] text-gray-400 block">Host Net Earned</span>
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
                      <div className="flex items-center justify-between pt-1 gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setDirectHostId(host.id);
                            setDirectUpiOrBank(host.upiId || `${host.phone}@okaxis`);
                            setDirectAmount(host.pendingPayout > 0 ? host.pendingPayout.toString() : '500');
                            setActiveTab('payouts');
                          }}
                          className="flex-1 min-w-[100px] py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Release Payout</span>
                        </button>

                        {/* Adjust Host Balance / Earnings */}
                        <button
                          onClick={() => {
                            setBalanceTarget({
                              id: host.id,
                              name: host.name,
                              phone: host.phone,
                              role: 'host',
                              currentBalance: host.netIncome || 0
                            });
                            setBalanceAmountInput('100');
                            setBalanceAdjustType('add');
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                          title="Host Kamai / Balance Kam ya Jyada karein"
                        >
                          <Coins className="w-3.5 h-3.5 text-amber-300" />
                          <span>Bal ±</span>
                        </button>

                        {/* Direct Deposit to Host */}
                        <button
                          onClick={() =>
                            handleOpenDirectDeposit({
                              id: host.id,
                              name: host.name,
                              phone: host.phone,
                              role: 'host'
                            })
                          }
                          className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                          title="Direct Deposit / Bonus Credit via UPI or Scanner"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Deposit</span>
                        </button>

                        {/* Review Host KYC Button */}
                        <button
                          onClick={() => {
                            setReviewingHostKyc(host);
                            setKycAdminNote(host.verification?.adminNote || '');
                          }}
                          className={`py-1.5 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border shadow transition-all ${
                            host.verification?.status === 'pending'
                              ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-300 font-black animate-pulse'
                              : host.isVerified && host.verification?.status === 'verified'
                              ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/40'
                              : 'bg-pink-950/60 hover:bg-pink-900 text-pink-300 border-pink-500/30'
                          }`}
                          title="Review KYC Live Photo, PAN & Government ID"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{host.verification?.status === 'pending' ? 'Review KYC (!)' : 'Review KYC'}</span>
                        </button>

                        <button
                          onClick={() => handleToggleHostBlock(host)}
                          className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs"
                          title="Block / Unblock Host"
                        >
                          {host.status === 'offline' ? 'Unblock' : 'Block'}
                        </button>

                        {/* Delete Host Account Button */}
                        <button
                          onClick={() => setDeletingTarget({ id: host.id, name: host.name, phone: host.phone, role: 'host' })}
                          className="py-1.5 px-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1"
                          title="Permanently Delete Host Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete</span>
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
                        {/* Adjust Balance (Kam / Jyada / Set) */}
                        <button
                          onClick={() => {
                            setBalanceTarget({
                              id: u.id,
                              name: u.name,
                              phone: u.phone,
                              role: 'caller',
                              currentBalance: u.balance || 0
                            });
                            setBalanceAmountInput('100');
                            setBalanceAdjustType('add');
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                          title="Adjust User Coins (Kam / Jyada / Set)"
                        >
                          <Coins className="w-3.5 h-3.5 text-amber-300" />
                          <span>Balance Kam/Jyada</span>
                        </button>

                        {/* Direct Deposit to User */}
                        <button
                          onClick={() =>
                            handleOpenDirectDeposit({
                              id: u.id,
                              name: u.name,
                              phone: u.phone,
                              role: 'caller'
                            })
                          }
                          className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                          title="Direct Deposit / Recharge via UPI or Scanner"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>➕ Deposit</span>
                        </button>

                        <button
                          onClick={() => handleToggleUserBlock(u)}
                          className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs"
                        >
                          {u.status === 'blocked' ? 'Unblock' : 'Block'}
                        </button>

                        {/* Permanent Account Delete Button */}
                        <button
                          onClick={() => setDeletingTarget({ id: u.id, name: u.name, phone: u.phone, role: 'caller' })}
                          className="py-1.5 px-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1"
                          title="Permanently Delete Caller Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete</span>
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
                  <span className="text-xs font-bold text-emerald-300 uppercase">Host Payouts Paid</span>
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
          {/* TAB: 24x7 CUSTOMER HELPLINE & WHATSAPP SUPPORT CONTROL HUB                */}
          {/* ========================================================================= */}
          {activeTab === 'helpline' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-black/80 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      🎧 24x7 Customer Helpline & WhatsApp Support Hub
                    </h3>
                    <p className="text-xs text-gray-300 mt-0.5">
                      Direct Calling Helpline aur WhatsApp Chat Support numbers ko Add, Update (Edit), aur Remove karein.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase">
                    ⚡ Live User Sync
                  </span>
                </div>
              </div>

              {/* Quick 1-Click Update Top Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quick Phone Update */}
                <div className="p-4 rounded-3xl bg-gradient-to-b from-[#1e0e2e] to-[#12081d] border border-pink-500/30 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        ⚡ Quick Update: Primary Calling Helpline
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold uppercase">
                      Direct Dial
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Caller aur Host jab direct call button par click karte hain to is number par call lagti hai:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={quickPhoneInput}
                      onChange={(e) => setQuickPhoneInput(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="flex-1 px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-sm focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={handleQuickUpdatePhone}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow whitespace-nowrap active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Update Call Number</span>
                    </button>
                  </div>
                </div>

                {/* Quick WhatsApp Update */}
                <div className="p-4 rounded-3xl bg-gradient-to-b from-[#0e2a1b] to-[#081a10] border border-emerald-500/30 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        ⚡ Quick Update: Primary WhatsApp Support
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                      WhatsApp Chat
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    App me WhatsApp Support button par click karne par users seedha is number par connect hote hain:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={quickWaInput}
                      onChange={(e) => setQuickWaInput(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="flex-1 px-3 py-2.5 rounded-xl bg-black/60 border border-emerald-500/30 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleQuickUpdateWhatsApp}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow whitespace-nowrap active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Update WhatsApp Number</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Channels 2-Column Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COLUMN 1: CALLING HELPLINES */}
                <div className="p-5 rounded-3xl bg-gradient-to-b from-[#180a26] to-[#0f0518] border border-pink-500/30 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">
                          Direct Calling Helpline Numbers
                        </h4>
                        <span className="text-[11px] text-pink-300/80">
                          {callHelplines.length} verified phone {callHelplines.length === 1 ? 'channel' : 'channels'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Add New Calling Number */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                    <span className="text-xs font-black text-pink-300 flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5" />
                      ➕ Naya Calling Helpline Number Add Karein:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Title / Label</label>
                        <input
                          type="text"
                          value={newCallTitle}
                          onChange={(e) => setNewCallTitle(e.target.value)}
                          placeholder="e.g. 24x7 Direct Phone Helpline"
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-pink-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={newCallNumber}
                          onChange={(e) => setNewCallNumber(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddCallHelpline()}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add Calling Number</span>
                    </button>
                  </div>

                  {/* List of Calling Helpline Numbers */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                      Registered Phone Numbers ({callHelplines.length}):
                    </span>
                    {callHelplines.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-black/40 border border-dashed border-white/10 text-center text-xs text-gray-400">
                        Koi Calling Helpline number nahi hai. Kripya naya number add karein.
                      </div>
                    ) : (
                      callHelplines.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-black/40 border border-white/10 transition-all hover:border-pink-500/30"
                        >
                          {editingCallId === item.id ? (
                            /* INLINE EDIT MODE */
                            <div className="space-y-3 p-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-pink-300 flex items-center gap-1.5">
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Edit / Update Calling Number
                                </span>
                                <button
                                  type="button"
                                  onClick={handleCancelEditCall}
                                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-gray-400 block mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={editCallTitle}
                                    onChange={(e) => setEditCallTitle(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white text-xs focus:outline-none focus:border-pink-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-400 block mb-1">Phone Number</label>
                                  <input
                                    type="text"
                                    value={editCallNumber}
                                    onChange={(e) => setEditCallNumber(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-pink-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditCall(item.id)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Save & Update Number</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditCall}
                                  className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* DISPLAY MODE */
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white">{item.title}</span>
                                  {item.isPrimary && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold uppercase">
                                      Primary (Active)
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-mono font-black text-pink-300">{item.number}</p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCall(item)}
                                  className="py-1.5 px-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                                  title="Number Update / Edit Karein"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Update</span>
                                </button>
                                {!item.isPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePrimaryCall(item.id)}
                                    className="py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-bold border border-white/10 transition-all"
                                    title="Make Primary"
                                  >
                                    Set Primary
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCallHelpline(item.id)}
                                  className="p-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-white border border-red-500/30 transition-all"
                                  title="Remove Number"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUMN 2: WHATSAPP SUPPORT HELPLINES */}
                <div className="p-5 rounded-3xl bg-gradient-to-b from-[#0a1e12] to-[#051109] border border-emerald-500/30 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">
                          WhatsApp Chat Support Numbers
                        </h4>
                        <span className="text-[11px] text-emerald-300/80">
                          {whatsappHelplines.length} verified WhatsApp {whatsappHelplines.length === 1 ? 'channel' : 'channels'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Add New WhatsApp Number */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5" />
                      ➕ Naya WhatsApp Support Number Add Karein:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Title / Label</label>
                        <input
                          type="text"
                          value={newWaTitle}
                          onChange={(e) => setNewWaTitle(e.target.value)}
                          placeholder="e.g. 24x7 WhatsApp Chat Support"
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">WhatsApp Number</label>
                        <input
                          type="text"
                          value={newWaNumber}
                          onChange={(e) => setNewWaNumber(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddWhatsAppHelpline()}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add WhatsApp Number</span>
                    </button>
                  </div>

                  {/* List of WhatsApp Numbers */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                      Registered WhatsApp Numbers ({whatsappHelplines.length}):
                    </span>
                    {whatsappHelplines.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-black/40 border border-dashed border-white/10 text-center text-xs text-gray-400">
                        Koi WhatsApp Support number nahi hai. Kripya naya number add karein.
                      </div>
                    ) : (
                      whatsappHelplines.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-black/40 border border-white/10 transition-all hover:border-emerald-500/30"
                        >
                          {editingWaId === item.id ? (
                            /* INLINE EDIT MODE */
                            <div className="space-y-3 p-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Edit / Update WhatsApp Number
                                </span>
                                <button
                                  type="button"
                                  onClick={handleCancelEditWa}
                                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-gray-400 block mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={editWaTitle}
                                    onChange={(e) => setEditWaTitle(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-400 block mb-1">WhatsApp Number</label>
                                  <input
                                    type="text"
                                    value={editWaNumber}
                                    onChange={(e) => setEditWaNumber(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditWa(item.id)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Save & Update Number</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditWa}
                                  className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* DISPLAY MODE */
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white">{item.title}</span>
                                  {item.isPrimary && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                                      Primary (Active)
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-mono font-black text-emerald-300">{item.number}</p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditWa(item)}
                                  className="py-1.5 px-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                                  title="Number Update / Edit Karein"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Update</span>
                                </button>
                                {!item.isPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePrimaryWhatsApp(item.id)}
                                    className="py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-bold border border-white/10 transition-all"
                                    title="Make Primary"
                                  >
                                    Set Primary
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWhatsAppHelpline(item.id)}
                                  className="p-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-white border border-red-500/30 transition-all"
                                  title="Remove Number"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
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

                {/* QR Scanner Custom Image & Dynamic Preview */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-black/60 border border-pink-500/30 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <QrIcon className="w-4 h-4 text-pink-400" />
                        <span>Official Deposit QR Code Scanner</span>
                      </h4>
                      <p className="text-[11px] text-gray-300">
                        Aap apna official merchant QR code upload kar sakte hain, ya auto-generated dynamic UPI QR use kar sakte hain.
                      </p>
                    </div>

                    {adminQrCodeUrlInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminQrCodeUrlInput('');
                          showToast('success', 'Custom image hata di gayi. Ab Auto-Generated Dynamic UPI QR use hoga.');
                        }}
                        className="py-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-[11px] font-bold"
                      >
                        Reset to Dynamic QR
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Upload Controls */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                          Upload Merchant Scanner Image (PhonePe / GPay / Paytm standee / screenshot)
                        </label>
                        <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-pink-500/50 hover:border-pink-500 bg-pink-950/20 hover:bg-pink-950/40 text-pink-300 text-xs font-bold cursor-pointer transition-all">
                          <Upload className="w-4 h-4" />
                          <span>{isUploadingQr ? 'Uploading Image...' : '📁 Choose QR Image File (Max 2MB)'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleQrImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-300 block mb-1">
                          Or Enter Custom Image URL
                        </label>
                        <input
                          type="text"
                          value={adminQrCodeUrlInput}
                          onChange={(e) => setAdminQrCodeUrlInput(e.target.value)}
                          placeholder="https://... / data:image/png;base64,..."
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs font-mono focus:outline-none"
                        />
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300 space-y-1">
                        <p className="font-bold text-white">💡 Scanner Settings Tips:</p>
                        <p>• Agar custom image blank hogi toh system automatic dynamic UPI QR code generate karega.</p>
                        <p>• Users is scanner ko Google Pay, PhonePe, Paytm ya kisi bhi app se direct scan karke deposit kar sakenge.</p>
                      </div>
                    </div>

                    {/* Live Scanner Preview */}
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-black/40 border border-white/10">
                      <span className="text-[11px] font-bold text-pink-300 mb-2">Live Deposit Scanner Preview:</span>
                      <div className="p-3 bg-white rounded-2xl shadow-xl">
                        {adminQrCodeUrlInput ? (
                          <img
                            src={adminQrCodeUrlInput}
                            alt="Custom QR Scanner"
                            className="w-36 h-36 object-contain rounded-xl"
                          />
                        ) : (
                          <UpiQrScanner
                            upiId={adminUpiIdInput || 'sunosakhi@okaxis'}
                            name={adminUpiNameInput || 'Suno Sakhi Official'}
                            size={140}
                            showDetails={false}
                            showDownload={false}
                            className="!p-0 !bg-transparent !border-0 !shadow-none"
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-2 font-mono">{adminUpiIdInput || 'sunosakhi@okaxis'}</span>
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 🎧 24x7 CUSTOMER HELPLINE & WHATSAPP SUPPORT CONTROL HUB           */}
                {/* ================================================================= */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-black/60 border border-emerald-500/40 space-y-4">
                  <div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">
                            🎧 24x7 Customer Helpline Numbers (Call & WhatsApp Control)
                          </h4>
                          <p className="text-[11px] text-gray-300">
                            Admin yahan se Calling Helpline aur WhatsApp Support numbers Add aur Remove kar sakte hain. Yeh numbers seedha users ke Helpline page par dikhenge.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                        Live User Visible
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* LEFT: DIRECT CALLING HELPLINE NUMBERS */}
                    <div className="p-3.5 rounded-2xl bg-[#140822] border border-pink-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-pink-400" />
                          <h5 className="text-xs font-black text-white uppercase tracking-wider">
                            Phone Helpline (Calling) Numbers ({callHelplines.length})
                          </h5>
                        </div>
                      </div>

                      {/* Add New Call Number Form */}
                      <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-2">
                        <span className="text-[11px] font-bold text-pink-300 block">
                          ➕ Naya Calling Number Jodein:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newCallTitle}
                            onChange={(e) => setNewCallTitle(e.target.value)}
                            placeholder="Title (e.g. Toll-Free Care)"
                            className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none"
                          />
                          <input
                            type="text"
                            value={newCallNumber}
                            onChange={(e) => setNewCallNumber(e.target.value)}
                            placeholder="Mobile / Phone (e.g. +91 98765 43210)"
                            className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddCallHelpline()}
                          className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add Calling Number</span>
                        </button>
                      </div>

                      {/* List of Existing Call Numbers */}
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {callHelplines.length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-2">Koi phone number nahi hai. Kripya add karein.</p>
                        ) : (
                          callHelplines.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-2"
                            >
                              {editingCallId === item.id ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-pink-300">Update Calling Number:</span>
                                    <button type="button" onClick={handleCancelEditCall} className="text-gray-400 hover:text-white">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={editCallTitle}
                                    onChange={(e) => setEditCallTitle(e.target.value)}
                                    placeholder="Title"
                                    className="w-full px-2 py-1 rounded-lg bg-black/60 border border-white/20 text-white text-xs"
                                  />
                                  <input
                                    type="text"
                                    value={editCallNumber}
                                    onChange={(e) => setEditCallNumber(e.target.value)}
                                    placeholder="Number"
                                    className="w-full px-2 py-1 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditCall(item.id)}
                                      className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
                                    >
                                      Save Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditCall}
                                      className="py-1 px-2 rounded-lg bg-white/10 text-gray-300 text-[11px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-white truncate">{item.title}</span>
                                      {item.isPrimary && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold uppercase">
                                          Primary
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-mono font-bold text-pink-300">{item.number}</p>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditCall(item)}
                                      className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-white border border-blue-500/30 text-[10px] font-bold flex items-center gap-0.5"
                                      title="Update / Edit"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    {!item.isPrimary && (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePrimaryCall(item.id)}
                                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 hover:text-white"
                                        title="Make Primary"
                                      >
                                        Set Primary
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCallHelpline(item.id)}
                                      className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-white border border-red-500/30"
                                      title="Remove Number"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* RIGHT: WHATSAPP HELPLINE NUMBERS */}
                    <div className="p-3.5 rounded-2xl bg-[#0a1e12] border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <h5 className="text-xs font-black text-white uppercase tracking-wider">
                            WhatsApp Support Numbers ({whatsappHelplines.length})
                          </h5>
                        </div>
                      </div>

                      {/* Add New WhatsApp Number Form */}
                      <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-2">
                        <span className="text-[11px] font-bold text-emerald-300 block">
                          ➕ Naya WhatsApp Number Jodein:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newWaTitle}
                            onChange={(e) => setNewWaTitle(e.target.value)}
                            placeholder="Title (e.g. WhatsApp Support)"
                            className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none"
                          />
                          <input
                            type="text"
                            value={newWaNumber}
                            onChange={(e) => setNewWaNumber(e.target.value)}
                            placeholder="WhatsApp No. (e.g. +91 98765 43210)"
                            className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddWhatsAppHelpline()}
                          className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add WhatsApp Number</span>
                        </button>
                      </div>

                      {/* List of Existing WhatsApp Numbers */}
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {whatsappHelplines.length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-2">Koi WhatsApp number nahi hai. Kripya add karein.</p>
                        ) : (
                          whatsappHelplines.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-2"
                            >
                              {editingWaId === item.id ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-emerald-300">Update WhatsApp Number:</span>
                                    <button type="button" onClick={handleCancelEditWa} className="text-gray-400 hover:text-white">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={editWaTitle}
                                    onChange={(e) => setEditWaTitle(e.target.value)}
                                    placeholder="Title"
                                    className="w-full px-2 py-1 rounded-lg bg-black/60 border border-white/20 text-white text-xs"
                                  />
                                  <input
                                    type="text"
                                    value={editWaNumber}
                                    onChange={(e) => setEditWaNumber(e.target.value)}
                                    placeholder="WhatsApp Number"
                                    className="w-full px-2 py-1 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditWa(item.id)}
                                      className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
                                    >
                                      Save Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditWa}
                                      className="py-1 px-2 rounded-lg bg-white/10 text-gray-300 text-[11px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-white truncate">{item.title}</span>
                                      {item.isPrimary && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                                          Primary
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-mono font-bold text-emerald-300">{item.number}</p>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditWa(item)}
                                      className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-white border border-blue-500/30 text-[10px] font-bold flex items-center gap-0.5"
                                      title="Update / Edit"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    {!item.isPrimary && (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePrimaryWhatsApp(item.id)}
                                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 hover:text-white"
                                        title="Make Primary"
                                      >
                                        Set Primary
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveWhatsAppHelpline(item.id)}
                                      className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-white border border-red-500/30"
                                      title="Remove Number"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 text-white font-black text-xs shadow-xl shadow-pink-600/30 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Save Platform Rates, UPI, Scanner & Helpline Config</span>
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

        {/* MODAL: SUPER ADMIN FLEXIBLE BALANCE ADJUSTMENT (KAM / JYADA / SET) */}
        {balanceTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-5 rounded-3xl bg-[#180928] border border-pink-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>Adjust Account Balance (Kam / Jyada)</span>
                </h3>
                <button
                  onClick={() => setBalanceTarget(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target Account Summary */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Account Name:</span>
                  <strong className="text-white">{balanceTarget.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Account Type:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    balanceTarget.role === 'host' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {balanceTarget.role === 'host' ? 'Host Girl' : 'Caller User'}
                  </span>
                </div>
                {balanceTarget.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Mobile:</span>
                    <strong className="text-white font-mono">+91 {balanceTarget.phone}</strong>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <span className="text-gray-300 font-semibold">Current Balance:</span>
                  <strong className="text-amber-300 font-black text-sm">₹{balanceTarget.currentBalance.toFixed(2)}</strong>
                </div>
              </div>

              {/* Adjustment Type Switcher (Add / Deduct / Exact Set) */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setBalanceAdjustType('add');
                    setBalanceAmountInput('100');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    balanceAdjustType === 'add'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ➕ Jyada (Add)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBalanceAdjustType('deduct');
                    setBalanceAmountInput('50');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    balanceAdjustType === 'deduct'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ➖ Kam (Deduct)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBalanceAdjustType('exact');
                    setBalanceAmountInput(balanceTarget.currentBalance.toString());
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    balanceAdjustType === 'exact'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🎯 Exact Set
                </button>
              </div>

              <form onSubmit={handleExecuteBalanceAdjustment} className="space-y-3">
                {/* Quick Presets for Add/Deduct */}
                {balanceAdjustType === 'add' && (
                  <div className="grid grid-cols-4 gap-2">
                    {[50, 100, 250, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBalanceAmountInput(amt.toString())}
                        className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all ${
                          balanceAmountInput === amt.toString()
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>
                )}

                {balanceAdjustType === 'deduct' && (
                  <div className="grid grid-cols-4 gap-2">
                    {[50, 100, 250, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBalanceAmountInput(amt.toString())}
                        className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all ${
                          balanceAmountInput === amt.toString()
                            ? 'bg-rose-600 text-white border-rose-400'
                            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        -₹{amt}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    {balanceAdjustType === 'add'
                      ? 'Add Karne Wali Amount (₹)'
                      : balanceAdjustType === 'deduct'
                      ? 'Kam / Katne Wali Amount (₹)'
                      : 'Naya Exact Balance (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={balanceAmountInput}
                    onChange={(e) => setBalanceAmountInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-base font-bold focus:outline-none"
                  />
                </div>

                {/* Calculation preview */}
                {(() => {
                  const val = parseFloat(balanceAmountInput) || 0;
                  let calculated = balanceTarget.currentBalance;
                  if (balanceAdjustType === 'add') calculated += val;
                  else if (balanceAdjustType === 'deduct') calculated = Math.max(0, calculated - val);
                  else calculated = Math.max(0, val);
                  return (
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                      <span className="text-gray-400">Naya Balance Banega:</span>
                      <strong className="text-emerald-400 font-black text-sm">
                        ₹{calculated.toFixed(2)}
                      </strong>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Reason / Note (Optional)</label>
                  <input
                    type="text"
                    value={balanceReasonInput}
                    onChange={(e) => setBalanceReasonInput(e.target.value)}
                    placeholder="e.g. Admin Adjustment / Special Gift"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setBalanceTarget(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 text-white font-black text-xs shadow-lg"
                  >
                    Confirm & Update Balance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: PERMANENT ACCOUNT DELETION CONFIRMATION */}
        {deletingTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-md p-6 rounded-3xl bg-[#1b0816] border-2 border-red-500/60 shadow-2xl shadow-red-950/80 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/40">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Permanently Delete Account?</h3>
                  <p className="text-xs text-red-300">Irreversible Action • Data Will Be Erased</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/50 border border-red-500/30 text-xs space-y-2">
                <p className="text-gray-300">
                  Kya aap sach me is {deletingTarget.role === 'host' ? 'Host' : 'User'} ka account permanent delete karna chahte hain?
                </p>
                <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/20 space-y-1">
                  <p className="text-white font-bold">Name: {deletingTarget.name}</p>
                  {deletingTarget.phone && <p className="text-red-300 font-mono">Mobile: +91 {deletingTarget.phone}</p>}
                  <p className="text-gray-400 font-mono text-[11px]">ID: {deletingTarget.id}</p>
                </div>
                <p className="text-red-400/90 text-[11px] font-semibold">
                  ⚠️ Is account ka wallet balance, call history, chat history aur profile Firestore cloud aur local system se hamesha ke liye delete ho jayega.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setDeletingTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={handleConfirmDeleteAccount}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white font-black text-xs shadow-lg shadow-red-600/40 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingAccount ? 'Deleting...' : 'Yes, Delete Account'}</span>
                </button>
              </div>
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

        {/* MODAL: CONFIGURE DEPOSIT SCANNER & UPI */}
        {showScannerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-[#180928] border border-pink-500/50 shadow-2xl space-y-4 my-auto relative">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <QrIcon className="w-5 h-5 text-pink-400" />
                  <span>Configure Deposit Scanner & UPI</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowScannerModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Live Preview Box */}
              <div className="flex flex-col items-center p-3 rounded-2xl bg-black/50 border border-pink-500/30">
                <span className="text-xs font-bold text-pink-300 mb-2">Active Deposit Scanner:</span>
                <div className="p-3 bg-white rounded-2xl shadow-xl">
                  {adminQrCodeUrlInput ? (
                    <img
                      src={adminQrCodeUrlInput}
                      alt="Merchant QR Scanner"
                      className="w-40 h-40 object-contain rounded-xl"
                    />
                  ) : (
                    <UpiQrScanner
                      upiId={adminUpiIdInput || 'sunosakhi@okaxis'}
                      name={adminUpiNameInput || 'Suno Sakhi Official'}
                      size={150}
                      showDetails={false}
                      showDownload={false}
                      className="!p-0 !bg-transparent !border-0 !shadow-none"
                    />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className="font-mono text-sm font-black text-pink-300">{adminUpiIdInput || 'sunosakhi@okaxis'}</p>
                  <p className="text-[11px] text-gray-400">{adminUpiNameInput || 'Suno Sakhi Official'}</p>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Official Deposit UPI ID (PhonePe / GPay / Paytm)
                  </label>
                  <input
                    type="text"
                    value={adminUpiIdInput}
                    onChange={(e) => setAdminUpiIdInput(e.target.value)}
                    placeholder="e.g. sunosakhi@okaxis"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white font-mono text-xs focus:outline-none"
                  />
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
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-pink-500/30 text-white text-xs focus:outline-none"
                  />
                </div>

                {/* Upload Merchant Scanner */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Upload Custom Scanner Image (PhonePe/GPay QR Standee)
                  </label>
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-pink-500/50 hover:border-pink-500 bg-pink-950/20 text-pink-300 text-xs font-bold cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{isUploadingQr ? 'Uploading...' : '📁 Choose QR Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrImageUpload}
                        className="hidden"
                      />
                    </label>

                    {adminQrCodeUrlInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminQrCodeUrlInput('');
                          showToast('success', 'Custom image reset. Dynamic QR will be used.');
                        }}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-bold"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScannerModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickSaveScanner}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-black text-xs shadow-lg shadow-pink-600/30 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Scanner & UPI</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DIRECT MANUAL DEPOSIT (CREDIT COINS VIA UPI / SCANNER) */}
        {showDirectDepositModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-[#180928] border border-emerald-500/50 shadow-2xl space-y-4 my-auto relative">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-400" />
                  <span>Direct Deposit / Credit Coins</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDirectDepositModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteDirectDeposit} className="space-y-3.5">
                {/* Role Switcher */}
                <div className="flex p-1 rounded-xl bg-black/60 border border-white/10 gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositTargetRole('caller');
                      if (usersList.length > 0) {
                        setDepositTargetId(usersList[0].id);
                        setDepositTargetName(usersList[0].name);
                        setDepositTargetPhone(usersList[0].phone);
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                      depositTargetRole === 'caller' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Caller User (Wallet Coins)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDepositTargetRole('host');
                      if (hostsList.length > 0) {
                        setDepositTargetId(hostsList[0].id);
                        setDepositTargetName(hostsList[0].name);
                        setDepositTargetPhone(hostsList[0].phone || '');
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                      depositTargetRole === 'host' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Host Account (Kamai / Balance)
                  </button>
                </div>

                {/* Target User Selector */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Select {depositTargetRole === 'caller' ? 'Caller' : 'Host'} Account:
                  </label>
                  <select
                    value={depositTargetId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setDepositTargetId(selId);
                      if (depositTargetRole === 'caller') {
                        const found = usersList.find((u) => u.id === selId);
                        if (found) {
                          setDepositTargetName(found.name);
                          setDepositTargetPhone(found.phone || '');
                        }
                      } else {
                        const found = hostsList.find((h) => h.id === selId);
                        if (found) {
                          setDepositTargetName(found.name);
                          setDepositTargetPhone(found.phone || '');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    {depositTargetRole === 'caller'
                      ? usersList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} (+91 {u.phone}) — Bal: ₹{(u.balance || 0).toFixed(2)}
                          </option>
                        ))
                      : hostsList.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} (+91 {h.phone}) — Kamai: ₹{(h.netIncome || 0).toFixed(2)}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Amount and Quick Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-300">
                      Deposit Amount (₹) <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      Total Credit: ₹{(parseFloat(depositAmount) || 0) + (parseFloat(depositBonus) || 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {['50', '100', '250', '500', '1000'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDepositAmount(preset);
                          setDepositBonus(Math.round(parseInt(preset) * 0.05).toString());
                        }}
                        className={`py-1 rounded-lg text-xs font-bold border transition-all ${
                          depositAmount === preset
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-black/40 text-gray-300 border-white/10 hover:border-white/30'
                        }`}
                      >
                        ₹{preset}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="number"
                        min="1"
                        required
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Amount ₹"
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-emerald-500/40 text-white font-mono font-bold text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        value={depositBonus}
                        onChange={(e) => setDepositBonus(e.target.value)}
                        placeholder="Free Bonus ₹"
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-emerald-300 font-mono text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Deposit Mode / Source:
                  </label>
                  <div className="grid grid-cols-4 gap-1 text-[11px]">
                    {(['UPI', 'Scanner', 'Cash', 'Manual'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDepositMethod(m)}
                        className={`py-1.5 rounded-lg font-bold border transition-all ${
                          depositMethod === m
                            ? 'bg-pink-600 text-white border-pink-500'
                            : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {m === 'Scanner' ? '📱 Scanner' : m === 'UPI' ? '⚡ UPI' : m === 'Cash' ? '💵 Cash' : '⚙️ Manual'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UTR Reference */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Bank UTR / Transaction Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositUtr}
                    onChange={(e) => setDepositUtr(e.target.value)}
                    placeholder="e.g. 12-digit UTR from UPI App"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Admin Note
                  </label>
                  <input
                    type="text"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    placeholder="e.g. PhonePe payment verified by Admin"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                {/* Submit Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isSubmittingDeposit}
                    onClick={() => setShowDirectDepositModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDeposit}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{isSubmittingDeposit ? 'Crediting...' : 'Confirm & Deposit'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CHANGE SCANNER & UPI POPUP MODAL                                    */}
        {/* ========================================================================= */}
        {showScannerModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-3xl bg-[#190827] border border-pink-500/50 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowScannerModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 pb-3 border-b border-pink-500/20">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white shadow-lg">
                  <QrIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Official Deposit Scanner & UPI Config</h3>
                  <p className="text-xs text-pink-300/80">Admin UPI ID aur QR Scanner upload karein jo users ko recharge me dikhega</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Official Receiver Business / Merchant Name
                  </label>
                  <input
                    type="text"
                    value={adminUpiNameInput}
                    onChange={(e) => setAdminUpiNameInput(e.target.value)}
                    placeholder="e.g. Suno Sakhi Official"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Official Deposit UPI ID (PhonePe / GPay / Paytm VPA)
                  </label>
                  <input
                    type="text"
                    value={adminUpiIdInput}
                    onChange={(e) => setAdminUpiIdInput(e.target.value)}
                    placeholder="e.g. sunosakhi@okaxis / 7009600157@paytm"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Upload Scanner Image */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                    Upload Scanner Image (PhonePe / Google Pay Standee / QR Screenshot)
                  </label>
                  <label className="flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-pink-500/50 hover:border-pink-500 bg-pink-950/30 hover:bg-pink-950/50 text-pink-200 text-xs font-bold cursor-pointer transition-all">
                    <Upload className="w-4 h-4 text-pink-400" />
                    <span>{isUploadingQr ? 'Uploading Scanner...' : '📁 Choose QR Scanner Image File (Max 2MB)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {adminQrCodeUrlInput && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Custom Scanner Image Uploaded</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminQrCodeUrlInput('');
                        showToast('success', 'Custom image hata di gayi. Dynamic QR code use hoga.');
                      }}
                      className="text-xs text-red-300 hover:text-red-200 font-bold underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Live Scanner Preview */}
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-gray-300 mb-2">Live Scanner Preview (Caller View):</span>
                  <div className="p-2.5 bg-white rounded-2xl shadow-xl">
                    {adminQrCodeUrlInput ? (
                      <img
                        src={adminQrCodeUrlInput}
                        alt="Custom Deposit Scanner"
                        className="w-32 h-32 object-contain rounded-xl"
                      />
                    ) : (
                      <UpiQrScanner
                        upiId={adminUpiIdInput || 'sunosakhi@okaxis'}
                        name={adminUpiNameInput || 'Suno Sakhi Official'}
                        size={120}
                        showDetails={false}
                        showDownload={false}
                        className="!p-0 !bg-transparent !border-0 !shadow-none"
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-pink-300 font-mono mt-1.5 font-bold">
                    {adminUpiIdInput || 'sunosakhi@okaxis'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickSaveScanner}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-black text-xs shadow-lg shadow-pink-600/30 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save & Apply Live</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: KYC REVIEW & APPROVAL MODAL (Live Photo + PAN + Secondary ID)     */}
        {/* ========================================================================= */}
        {reviewingHostKyc && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="relative w-full max-w-3xl rounded-3xl bg-gradient-to-b from-[#1c081e] to-[#0a000c] border border-pink-500/40 p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setReviewingHostKyc(null);
                  setKycAdminNote('');
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-pink-500/20">
                <img
                  src={reviewingHostKyc.avatar}
                  alt={reviewingHostKyc.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-pink-500 shadow-md flex-shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-white">{reviewingHostKyc.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono font-bold">
                      Age {reviewingHostKyc.age}
                    </span>
                    {reviewingHostKyc.isVerified && reviewingHostKyc.verification?.status === 'verified' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                        ✅ Approved
                      </span>
                    ) : reviewingHostKyc.verification?.status === 'pending' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-500/50 font-bold animate-pulse">
                        ⏳ Pending Approval
                      </span>
                    ) : reviewingHostKyc.verification?.status === 'rejected' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                        ❌ Rejected
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 border border-gray-500/40 font-bold">
                        ⚠️ Unsubmitted
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-pink-400 font-bold mt-0.5">
                    Host ID: {reviewingHostKyc.id}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Mobile: <span className="font-mono text-white font-bold">+91 {reviewingHostKyc.phone}</span> • City: {reviewingHostKyc.city} • Lang: {reviewingHostKyc.languages?.join(', ')}
                  </p>
                </div>
              </div>

              {/* Policy Banner */}
              <div className="p-3 rounded-2xl bg-pink-950/40 border border-pink-500/30 text-xs text-pink-200 mb-5 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-pink-300 font-bold block">Host Verification Guidelines:</strong>
                  Host tabhi online jaa sakti hai aur calls receive kar sakti hai jab Super Admin Live Photo, PAN Card aur Secondary ID (Aadhaar / Voter / Licence) verify karke Approve kare.
                </div>
              </div>

              {/* Verification Documents 3-Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                {/* 1. Live Selfie Capture */}
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <Camera className="w-4 h-4 text-pink-400" />
                        <span>1. Live Photo</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        reviewingHostKyc.verification?.selfieUrl
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {reviewingHostKyc.verification?.selfieUrl ? 'Captured' : 'Missing'}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 mb-2">Real-time live camera selfie</p>

                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-white/10 group cursor-pointer"
                      onClick={() => {
                        const url = reviewingHostKyc.verification?.selfieUrl || reviewingHostKyc.avatar;
                        if (url) setExpandedDocImage(url);
                      }}
                    >
                      <img
                        src={reviewingHostKyc.verification?.selfieUrl || reviewingHostKyc.avatar}
                        alt="Live Selfie"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[11px] font-bold text-white bg-black/70 px-2 py-1 rounded-lg flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Zoom
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    Click image to inspect full-size
                  </p>
                </div>

                {/* 2. Mandatory PAN Card */}
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <CreditCard className="w-4 h-4 text-amber-400" />
                        <span>2. PAN Card</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        reviewingHostKyc.verification?.panDocUrl
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {reviewingHostKyc.verification?.panDocUrl ? 'Uploaded' : 'Missing'}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="text-[10px] text-gray-400 block">PAN Number:</span>
                      <span className="text-xs font-mono font-black text-amber-300 tracking-wider">
                        {reviewingHostKyc.verification?.panNumber || 'Not provided'}
                      </span>
                    </div>

                    <div
                      className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-white/10 group cursor-pointer flex items-center justify-center"
                      onClick={() => {
                        if (reviewingHostKyc.verification?.panDocUrl) {
                          setExpandedDocImage(reviewingHostKyc.verification.panDocUrl);
                        }
                      }}
                    >
                      {reviewingHostKyc.verification?.panDocUrl ? (
                        <>
                          <img
                            src={reviewingHostKyc.verification.panDocUrl}
                            alt="PAN Card"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[11px] font-bold text-white bg-black/70 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> Zoom
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-xs">
                          <FileText className="w-8 h-8 mx-auto mb-1 opacity-40" />
                          PAN Card photo nahi mili
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    Click image to inspect full-size
                  </p>
                </div>

                {/* 3. Secondary ID (1 of 3: Aadhaar / Voter / Licence) */}
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span>3. Secondary ID</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        (reviewingHostKyc.verification?.secondaryDocUrl || reviewingHostKyc.verification?.aadhaarFrontUrl)
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {(reviewingHostKyc.verification?.secondaryDocUrl || reviewingHostKyc.verification?.aadhaarFrontUrl) ? 'Uploaded' : 'Missing'}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="text-[10px] text-gray-400 block">
                        Type:{' '}
                        <strong className="text-white">
                          {reviewingHostKyc.verification?.secondaryIdType === 'aadhaar'
                            ? 'Aadhaar Card'
                            : reviewingHostKyc.verification?.secondaryIdType === 'voter'
                            ? 'Voter ID'
                            : reviewingHostKyc.verification?.secondaryIdType === 'driving_license'
                            ? 'Driving Licence'
                            : reviewingHostKyc.verification?.aadhaarNumber
                            ? 'Aadhaar Card (Legacy)'
                            : 'Not Selected'}
                        </strong>
                      </span>
                      <span className="text-xs font-mono font-black text-blue-300 tracking-wider">
                        {reviewingHostKyc.verification?.secondaryIdNumber ||
                          reviewingHostKyc.verification?.aadhaarNumber ||
                          'Not provided'}
                      </span>
                    </div>

                    <div
                      className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/60 border border-white/10 group cursor-pointer flex items-center justify-center"
                      onClick={() => {
                        const doc = reviewingHostKyc.verification?.secondaryDocUrl || reviewingHostKyc.verification?.aadhaarFrontUrl;
                        if (doc) setExpandedDocImage(doc);
                      }}
                    >
                      {(reviewingHostKyc.verification?.secondaryDocUrl || reviewingHostKyc.verification?.aadhaarFrontUrl) ? (
                        <>
                          <img
                            src={reviewingHostKyc.verification?.secondaryDocUrl || reviewingHostKyc.verification?.aadhaarFrontUrl}
                            alt="Secondary ID"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[11px] font-bold text-white bg-black/70 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> Zoom
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-xs">
                          <FileText className="w-8 h-8 mx-auto mb-1 opacity-40" />
                          Document photo nahi mili
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    Click image to inspect full-size
                  </p>
                </div>
              </div>

              {/* Female Certified & Metadata Info */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-gray-300 mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-gray-400">Female Host Certified: </span>
                  <strong className="text-emerald-400 font-bold">
                    {reviewingHostKyc.verification?.femaleCertified !== false ? '✅ Yes (Confirmed by Host)' : '❌ Not confirmed'}
                  </strong>
                </div>
                {reviewingHostKyc.verification?.submittedAt && (
                  <div className="text-[11px] text-gray-400">
                    Submitted: {new Date(reviewingHostKyc.verification.submittedAt).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Previous Note (if present) */}
              {reviewingHostKyc.verification?.adminNote && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4 text-xs">
                  <span className="text-gray-400 block mb-0.5">Previous Admin Note:</span>
                  <span className="text-white font-mono">{reviewingHostKyc.verification.adminNote}</span>
                </div>
              )}

              {/* Admin Note Input */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Admin Decision Note / Reason (Optional for approve, required for rejection):
                </label>
                <input
                  type="text"
                  value={kycAdminNote}
                  onChange={(e) => setKycAdminNote(e.target.value)}
                  placeholder="e.g. All documents verified & approved OR Photo/PAN blur hai..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={kycProcessing}
                  onClick={() => handleRejectHostKyc(reviewingHostKyc.id)}
                  className="flex-1 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{kycProcessing ? 'Processing...' : '❌ Reject KYC'}</span>
                </button>

                <button
                  type="button"
                  disabled={kycProcessing}
                  onClick={() => handleApproveHostKyc(reviewingHostKyc.id)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{kycProcessing ? 'Approving...' : '✅ Approve & Activate Host ID'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: EXPANDED DOCUMENT ZOOM MODAL                                       */}
        {/* ========================================================================= */}
        {expandedDocImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setExpandedDocImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
              <button
                type="button"
                onClick={() => setExpandedDocImage(null)}
                className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={expandedDocImage}
                alt="Document Full Preview"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl border-2 border-pink-500/60 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <p className="text-xs text-gray-400 mt-2">Click outside or press X to close</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;

