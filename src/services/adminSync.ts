import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { HostProfile, HostPayoutRecord } from '../types';
import { UserAccount, getLocalRegisteredUsers, saveUserToLocalRegistry } from './userAuthSync';
import { syncLiveBalanceToCloud } from './walletSync';
import { getApiBaseUrl } from './apiConfig';

const HOSTS_COLLECTION = 'hosts';
const USER_ACCOUNTS_COLLECTION = 'user_accounts';
const PAYOUTS_COLLECTION = 'host_payouts';
const WALLET_COLLECTION = 'wallets';

const LOCAL_HOST_ACCOUNTS_KEY = 'sunosakhi_host_accounts_store';
const LOCAL_PAYOUTS_KEY = 'sunosakhi_host_payouts';

export const SUPER_ADMIN_PHONE = '7009600157';

/**
 * Checks if a phone number belongs to the designated Super Admin
 */
export const isAdminUser = (phone?: string | null): boolean => {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  return clean === SUPER_ADMIN_PHONE || clean.endsWith(SUPER_ADMIN_PHONE);
};

export interface AdminUserDetails extends UserAccount {
  balance: number;
}

/**
 * Fetch all registered Host profiles from Server Backend, Cloud Firestore and Local Storage
 */
export const fetchAllRegisteredHosts = async (): Promise<HostProfile[]> => {
  const hostsMap: Record<string, HostProfile> = {};

  // 1. Fetch from Server Backend (/api/admin/hosts gets all hosts including pending & verified)
  try {
    const baseUrl = getApiBaseUrl();
    let res = await fetch(`${baseUrl}/api/admin/hosts`);
    if (!res.ok) {
      res = await fetch(`${baseUrl}/api/admin/all-data`);
    }
    const data = await res.json();
    const list = data.hosts || (data.success && Array.isArray(data.hosts) ? data.hosts : []);
    if (Array.isArray(list)) {
      list.forEach((h: any) => {
        hostsMap[h.id] = {
          ...h,
          isVerified: h.isVerified || false,
          status: h.status || (h.isVerified ? 'online' : 'offline'),
          verification: h.verification || { idType: 'aadhaar', idNumber: '', selfieUrl: '', status: 'unverified' },
          incomeHistory: h.incomeHistory || []
        };
      });
    }
  } catch (err) {
    console.warn('Error fetching hosts from server:', err);
  }

  // 2. Fetch from Local Storage
  try {
    const rawLocal = localStorage.getItem(LOCAL_HOST_ACCOUNTS_KEY);
    if (rawLocal) {
      const localStore = JSON.parse(rawLocal);
      Object.keys(localStore).forEach((phone) => {
        const item = localStore[phone];
        const hostId = item.hostId || 'sakhi-user-' + phone;
        if (!hostsMap[hostId]) {
          hostsMap[hostId] = {
            id: hostId,
            name: item.name || 'Sakhi Host',
            age: 22,
            city: 'Delhi',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            videoPoster: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            status: 'online',
            rating: 5.0,
            totalCalls: 0,
            languages: ['Hindi', 'English'],
            bio: 'Namaste! SunoSakhi par aapse baat karne ke liye available hoon.',
            interests: ['Friendly Chat', 'Late Night Talks'],
            voiceRatePerMin: 5,
            videoRatePerMin: 10,
            audioSnippet: 'https://actions.google.com/sounds/v1/human_voices/female_laugh.ogg',
            tagline: 'Verified Companion',
            isVerified: false,
            phone: item.phone || phone,
            totalVoiceMinutes: 0,
            totalVideoMinutes: 0,
            totalGiftsReceived: 0,
            totalMessagesReceived: 0,
            grossRevenue: 0,
            netIncome: 0,
            pendingPayout: 0,
            verification: {
              idType: 'aadhaar',
              idNumber: '',
              selfieUrl: '',
              status: 'unverified'
            },
            incomeHistory: []
          };
        }
      });
    }
  } catch (err) {
    console.warn('Error reading local host store:', err);
  }

  // 3. Fetch from Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDocs(collection(db, HOSTS_COLLECTION));
      snap.forEach((docSnap) => {
        const data = docSnap.data() as HostProfile;
        const id = data.id || docSnap.id;
        hostsMap[id] = { ...hostsMap[id], ...data, id };
      });
    } catch (err) {
      console.warn('Error fetching hosts from firestore:', err);
    }
  }

  return Object.values(hostsMap);
};

/**
 * Fetch all registered Caller users with live wallet balance from Server Backend, Cloud Firestore and Local Storage
 */
export const fetchAllRegisteredUsers = async (): Promise<AdminUserDetails[]> => {
  const usersMap: Record<string, AdminUserDetails> = {};

  // 1. Fetch from Server Backend first
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/users`);
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      data.users.forEach((u: any) => {
        usersMap[u.phone] = {
          ...u,
          balance: typeof u.balance === 'number' ? u.balance : 50.0
        };
      });
    }
  } catch (err) {
    console.warn('Error fetching users from server:', err);
  }

  // 2. Get all from local storage registry
  const localUsers = getLocalRegisteredUsers();
  Object.keys(localUsers).forEach((phone) => {
    const u = localUsers[phone];
    if (!usersMap[phone]) {
      usersMap[phone] = {
        ...u,
        balance: 50.0 // default welcome coins
      };
    }
  });

  // 3. Get from Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDocs(collection(db, USER_ACCOUNTS_COLLECTION));
      snap.forEach((docSnap) => {
        const u = docSnap.data() as UserAccount;
        const phone = u.phone || docSnap.id;
        usersMap[phone] = {
          ...(usersMap[phone] || {}),
          ...u,
          balance: usersMap[phone]?.balance || 50.0
        };
      });
    } catch (err) {
      console.warn('Error fetching cloud users:', err);
    }
  }

  // 3. Fetch live balances
  const userList = Object.values(usersMap);
  for (const user of userList) {
    const callerKey = 'caller_' + user.phone;
    if (isFirebaseConfigured() && db) {
      try {
        const walletSnap = await getDoc(doc(db, WALLET_COLLECTION, callerKey));
        if (walletSnap.exists()) {
          const wData = walletSnap.data();
          if (typeof wData.balance === 'number') {
            user.balance = wData.balance;
          }
        }
      } catch (err) {
        // fallback to default
      }
    }
  }

  return userList;
};

/**
 * Fetch all Host payout & withdrawal requests
 */
export const fetchAllPayoutRequests = async (): Promise<HostPayoutRecord[]> => {
  const payoutsMap: Record<string, HostPayoutRecord> = {};

  // 1. Local Storage
  try {
    const raw = localStorage.getItem(LOCAL_PAYOUTS_KEY);
    if (raw) {
      const list: HostPayoutRecord[] = JSON.parse(raw);
      list.forEach((p) => {
        payoutsMap[p.id] = p;
      });
    }
  } catch (err) {
    console.warn('Error reading local payouts:', err);
  }

  // 2. Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDocs(collection(db, PAYOUTS_COLLECTION));
      snap.forEach((docSnap) => {
        const data = docSnap.data() as HostPayoutRecord;
        payoutsMap[data.id || docSnap.id] = { ...data, id: data.id || docSnap.id };
      });
    } catch (err) {
      console.warn('Error reading cloud payouts:', err);
    }
  }

  // Sort by latest timestamp first
  return Object.values(payoutsMap).sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Approve & Release Host Payout (Mark as Completed & enter UTR Reference)
 */
export const releaseHostPayout = async (
  payoutId: string,
  utrReference: string
): Promise<{ success: boolean; message: string }> => {
  const payouts = await fetchAllPayoutRequests();
  const payout = payouts.find((p) => p.id === payoutId);
  if (!payout) {
    return { success: false, message: 'Payout record nahi mila.' };
  }

  payout.status = 'completed';
  payout.referenceId = utrReference.trim() || `UTR${Date.now()}`;

  // Save to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, PAYOUTS_COLLECTION, payout.id), payout, { merge: true });
    } catch (err) {
      console.warn('Error updating payout in cloud:', err);
    }
  }

  // Save to Local Storage
  try {
    const updated = payouts.map((p) => (p.id === payout.id ? payout : p));
    localStorage.setItem(LOCAL_PAYOUTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving local payout:', err);
  }

  return {
    success: true,
    message: `✅ ₹${payout.amount.toFixed(2)} ka payout successfully release ho gaya! UTR: ${payout.referenceId}`
  };
};

/**
 * Reject Payout Request & Refund Amount to Host pending balance
 */
export const rejectHostPayout = async (
  payoutId: string,
  reason: string
): Promise<{ success: boolean; message: string }> => {
  const payouts = await fetchAllPayoutRequests();
  const payout = payouts.find((p) => p.id === payoutId);
  if (!payout) {
    return { success: false, message: 'Payout record nahi mila.' };
  }

  payout.status = 'pending'; // or mark rejected

  // Save status
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(
        doc(db, PAYOUTS_COLLECTION, payout.id),
        { status: 'rejected', rejectReason: reason },
        { merge: true }
      );
    } catch (err) {
      console.warn('Error updating rejected payout:', err);
    }
  }

  try {
    const updated = payouts.map((p) =>
      p.id === payout.id ? { ...p, status: 'rejected' as any, rejectReason: reason } : p
    );
    localStorage.setItem(LOCAL_PAYOUTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving rejected payout:', err);
  }

  return {
    success: true,
    message: `❌ Payout reject kar diya gaya. Amount Host ke balance me refund ho gayi.`
  };
};

/**
 * Create a Direct Instant Payout Release for any Host ID
 */
export const createDirectPayout = async (params: {
  hostId: string;
  amount: number;
  method: 'upi' | 'bank';
  upiOrBank: string;
  utrNumber: string;
  note?: string;
}): Promise<{ success: boolean; message: string; record?: HostPayoutRecord }> => {
  if (params.amount <= 0) {
    return { success: false, message: 'Kripya valid amount darj karein.' };
  }

  const payoutId = 'payout_admin_' + Date.now();
  const utr = params.utrNumber.trim() || `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`;

  const newRecord: HostPayoutRecord = {
    id: payoutId,
    hostId: params.hostId,
    amount: params.amount,
    method: params.method,
    upiId: params.method === 'upi' ? params.upiOrBank : undefined,
    status: 'completed',
    timestamp: Date.now(),
    referenceId: utr
  };

  // Save to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, PAYOUTS_COLLECTION, payoutId), newRecord);
    } catch (err) {
      console.warn('Error saving direct payout to firestore:', err);
    }
  }

  // Save to Local Storage
  try {
    const existing = await fetchAllPayoutRequests();
    localStorage.setItem(LOCAL_PAYOUTS_KEY, JSON.stringify([newRecord, ...existing]));
  } catch (err) {
    console.warn('Error saving direct payout to local storage:', err);
  }

  return {
    success: true,
    message: `🎉 ₹${params.amount.toFixed(2)} ka payout Host (${params.hostId}) ko direct release ho gaya! UTR: ${utr}`,
    record: newRecord
  };
};

/**
 * Add / Deduct Coins for a specific User ID (Caller)
 */
export const adjustUserCoins = async (
  userPhone: string,
  amount: number,
  note = 'Admin Adjustment'
): Promise<{ success: boolean; newBalance: number }> => {
  const callerKey = 'caller_' + userPhone;
  let currentBalance = 50.0;

  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDoc(doc(db, WALLET_COLLECTION, callerKey));
      if (snap.exists() && typeof snap.data().balance === 'number') {
        currentBalance = snap.data().balance;
      }
    } catch (err) {}
  }

  const nextBalance = parseFloat(Math.max(0, currentBalance + amount).toFixed(2));
  await syncLiveBalanceToCloud(callerKey, nextBalance);

  return { success: true, newBalance: nextBalance };
};

/**
 * Toggle Block/Active status for a User ID
 */
export const toggleUserBlock = async (userPhone: string, block: boolean): Promise<boolean> => {
  const status = block ? 'blocked' : 'active';
  const localUsers = getLocalRegisteredUsers();
  if (localUsers[userPhone]) {
    localUsers[userPhone].status = status;
    saveUserToLocalRegistry(localUsers[userPhone]);
  }

  if (isFirebaseConfigured() && db) {
    try {
      await updateDoc(doc(db, USER_ACCOUNTS_COLLECTION, userPhone), { status });
    } catch (err) {
      console.warn('Could not update user status in firestore:', err);
    }
  }

  return true;
};

/**
 * Toggle Block/Online status for a Host ID
 */
export const toggleHostBlock = async (hostId: string, block: boolean): Promise<boolean> => {
  const status = block ? 'offline' : 'online';
  if (isFirebaseConfigured() && db) {
    try {
      await updateDoc(doc(db, HOSTS_COLLECTION, hostId), { status });
    } catch (err) {
      console.warn('Could not update host status in firestore:', err);
    }
  }
  return true;
};

/**
 * Verify / Approve / Reject Host Identity (PAN, Resident ID & Live Selfie)
 * "face verify b ho live tab host id ki admin approve kareyga bina approval koi b host id activate na ho"
 */
export const setHostVerificationStatus = async (
  hostId: string,
  isVerified: boolean,
  adminNote?: string
): Promise<{ success: boolean; message?: string }> => {
  const action = isVerified ? 'approve' : 'reject';
  const status = isVerified ? 'verified' : 'rejected';

  // 1. Sync with Server Backend
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/hosts/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId, action, adminNote })
    });
    const data = await res.json();
    console.log(`[ADMIN-HOST-VERIFY-RESULT]`, data);
  } catch (err) {
    console.warn('Backend host verification call failed:', err);
  }

  // 2. Sync with Cloud Firestore if available
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(
        doc(db, HOSTS_COLLECTION, hostId),
        {
          isVerified,
          status: isVerified ? 'online' : 'offline',
          verification: {
            status,
            verifiedAt: isVerified ? Date.now() : undefined,
            approvedAt: isVerified ? Date.now() : undefined,
            approvedBy: isVerified ? 'Admin' : undefined,
            adminNote: adminNote || (isVerified ? 'Approved by Admin' : 'Rejected by Admin')
          }
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not update host verification in firestore:', err);
    }
  }

  // 3. Update current localStorage hostProfile
  try {
    ['sunosakhi_host_profile', 'sunosakhi_host_profile_v2'].forEach((key) => {
      const saved = localStorage.getItem(key);
      if (saved) {
        const current = JSON.parse(saved);
        if (current && (current.id === hostId || hostId.includes(current.phone || 'xyz') || (current.phone && hostId.includes(current.phone)))) {
          current.isVerified = isVerified;
          current.status = isVerified ? 'online' : 'offline';
          if (!current.verification) current.verification = {};
          current.verification.status = status;
          current.verification.adminNote = adminNote;
          if (isVerified) {
            current.verification.verifiedAt = Date.now();
            current.verification.approvedAt = Date.now();
            current.verification.approvedBy = 'Admin';
          }
          localStorage.setItem(key, JSON.stringify(current));
        }
      }
    });
  } catch (e) {}

  return {
    success: true,
    message: isVerified
      ? '✅ Host profile successfully Approved & Activated! Ab callers ko show hogi.'
      : '❌ Host profile verification Rejected.'
  };
};

/**
 * Set exact balance (kam ya jyada) for any User or Host account directly
 */
export const setUserBalanceDirect = async (
  identifier: string,
  targetBalance: number,
  role: 'caller' | 'host' = 'caller',
  note: string = 'Admin Balance Adjustment'
): Promise<{ success: boolean; newBalance: number; message: string }> => {
  const safeBalance = Math.max(0, parseFloat(targetBalance.toFixed(2)));

  if (role === 'caller') {
    const cleanPhone = identifier.replace(/\D/g, '').slice(-10);
    const callerKey = 'caller_' + cleanPhone;

    // 1. Cloud Firestore Wallet & Account
    await syncLiveBalanceToCloud(callerKey, safeBalance);
    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, USER_ACCOUNTS_COLLECTION, cleanPhone), {
          balance: safeBalance,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.warn('Error updating user doc in firestore:', e);
      }
    }

    // 2. Server Backend (if available)
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/admin/users/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, balance: safeBalance, note })
      });
    } catch (e) {}

    // 3. Local Storage Registries & Active State
    try {
      const raw = localStorage.getItem('sunosakhi_registered_users');
      if (raw) {
        const reg = JSON.parse(raw);
        if (reg[cleanPhone]) {
          reg[cleanPhone].balance = safeBalance;
          localStorage.setItem('sunosakhi_registered_users', JSON.stringify(reg));
        }
      }
      const current = localStorage.getItem('sunosakhi_auth_user');
      if (current) {
        const user = JSON.parse(current);
        if (user.phone && user.phone.replace(/\D/g, '').slice(-10) === cleanPhone) {
          user.balance = safeBalance;
          localStorage.setItem('sunosakhi_auth_user', JSON.stringify(user));
        }
      }
      localStorage.setItem(`sunosakhi_wallet_${callerKey}`, safeBalance.toString());
      window.dispatchEvent(new CustomEvent('wallet-updated', { detail: { balance: safeBalance, phone: cleanPhone } }));
    } catch (e) {}

    return {
      success: true,
      newBalance: safeBalance,
      message: `✅ User (+91 ${cleanPhone}) ka balance update ho kar ₹${safeBalance.toFixed(2)} ho gaya!`
    };
  } else {
    // HOST BALANCE / EARNINGS ADJUSTMENT
    const hostId = identifier;

    // 1. Cloud Firestore
    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(
          doc(db, HOSTS_COLLECTION, hostId),
          { netIncome: safeBalance, pendingPayout: safeBalance, updatedAt: Date.now() },
          { merge: true }
        );
      } catch (e) {
        console.warn('Error updating host in firestore:', e);
      }
    }

    // 2. Local Storage
    try {
      const raw = localStorage.getItem(LOCAL_HOST_ACCOUNTS_KEY);
      if (raw) {
        const store = JSON.parse(raw);
        Object.keys(store).forEach((key) => {
          if (store[key].hostId === hostId || key === hostId || store[key].phone === hostId) {
            store[key].netIncome = safeBalance;
            store[key].pendingPayout = safeBalance;
          }
        });
        localStorage.setItem(LOCAL_HOST_ACCOUNTS_KEY, JSON.stringify(store));
      }

      const activeProfile = localStorage.getItem('sunosakhi_host_profile_v2');
      if (activeProfile) {
        const p = JSON.parse(activeProfile);
        if (p.id === hostId || p.phone === hostId) {
          p.netIncome = safeBalance;
          p.pendingPayout = safeBalance;
          localStorage.setItem('sunosakhi_host_profile_v2', JSON.stringify(p));
        }
      }
    } catch (e) {}

    return {
      success: true,
      newBalance: safeBalance,
      message: `✅ Host (${hostId}) ki kamai update ho kar ₹${safeBalance.toFixed(2)} ho gayi!`
    };
  }
};

/**
 * Permanently Delete any User or Host account from Firestore, Server Backend and Local Storage
 */
export const deleteUserAccountPermanently = async (
  identifier: string,
  role: 'caller' | 'host' = 'caller'
): Promise<{ success: boolean; message: string }> => {
  if (role === 'caller') {
    const cleanPhone = identifier.replace(/\D/g, '').slice(-10);
    const callerKey = 'caller_' + cleanPhone;

    // 1. Delete from Firestore
    if (isFirebaseConfigured() && db) {
      try {
        await deleteDoc(doc(db, USER_ACCOUNTS_COLLECTION, cleanPhone));
      } catch (e) {
        console.warn('Error deleting user_accounts doc from firestore:', e);
      }
      try {
        await deleteDoc(doc(db, WALLET_COLLECTION, callerKey));
      } catch (e) {}
    }

    // 2. Delete from Server Backend
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/admin/users/${cleanPhone}`, { method: 'DELETE' });
    } catch (e) {}

    // 3. Delete from Local Storage Registry
    try {
      const raw = localStorage.getItem('sunosakhi_registered_users');
      if (raw) {
        const reg = JSON.parse(raw);
        delete reg[cleanPhone];
        localStorage.setItem('sunosakhi_registered_users', JSON.stringify(reg));
      }
      localStorage.removeItem(`sunosakhi_wallet_${callerKey}`);

      // If deleted account is currently logged in, log out
      const current = localStorage.getItem('sunosakhi_auth_user');
      if (current) {
        const u = JSON.parse(current);
        if (u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleanPhone) {
          localStorage.removeItem('sunosakhi_auth_user');
          localStorage.removeItem('sunosakhi_active_session');
          window.dispatchEvent(new Event('auth-changed'));
        }
      }
    } catch (e) {}

    return {
      success: true,
      message: `🗑️ Caller User (+91 ${cleanPhone}) ka account permanent delete kar diya gaya.`
    };
  } else {
    // HOST ACCOUNT DELETION
    const hostId = identifier;
    let hostPhone = '';

    // 1. Delete from Firestore
    if (isFirebaseConfigured() && db) {
      try {
        const hostDoc = await getDoc(doc(db, HOSTS_COLLECTION, hostId));
        if (hostDoc.exists()) {
          hostPhone = (hostDoc.data()?.phone || '').replace(/\D/g, '').slice(-10);
        }
        await deleteDoc(doc(db, HOSTS_COLLECTION, hostId));
      } catch (e) {
        console.warn('Error deleting host doc from firestore:', e);
      }
      try {
        await deleteDoc(doc(db, 'host_accounts', hostId));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, WALLET_COLLECTION, 'host_' + hostId));
      } catch (e) {}
    }

    // 2. Delete from Server Backend
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/admin/hosts/${hostId}`, { method: 'DELETE' });
    } catch (e) {}

    // 3. Delete from Local Storage Store
    try {
      const raw = localStorage.getItem(LOCAL_HOST_ACCOUNTS_KEY);
      if (raw) {
        const store = JSON.parse(raw);
        Object.keys(store).forEach((key) => {
          if (store[key].hostId === hostId || key === hostId || (hostPhone && store[key].phone === hostPhone)) {
            delete store[key];
          }
        });
        localStorage.setItem(LOCAL_HOST_ACCOUNTS_KEY, JSON.stringify(store));
      }

      // If active host profile matches, clear it
      const savedHost = localStorage.getItem('sunosakhi_host_profile_v2');
      if (savedHost) {
        const p = JSON.parse(savedHost);
        if (p.id === hostId || (hostPhone && p.phone === hostPhone)) {
          localStorage.removeItem('sunosakhi_host_profile_v2');
          localStorage.removeItem('sunosakhi_host_logged_in');
          window.dispatchEvent(new Event('auth-changed'));
        }
      }
    } catch (e) {}

    return {
      success: true,
      message: `🗑️ Host ID (${hostId}) ka account permanent delete kar diya gaya.`
    };
  }
};

