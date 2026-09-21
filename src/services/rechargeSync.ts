import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { RechargeRequest, WalletTransaction } from '../types';
import { creditUserCloudWallet } from './walletSync';
import { processReferralRewardOnRecharge } from './referralSync';

const RECHARGE_REQUESTS_COLLECTION = 'recharge_requests';
const LOCAL_REQUESTS_KEY = 'sunosakhi_recharge_requests';

/**
 * Read all recharge requests from LocalStorage
 */
export const getLocalRechargeRequests = (): RechargeRequest[] => {
  try {
    const raw = localStorage.getItem(LOCAL_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading local recharge requests:', err);
    return [];
  }
};

/**
 * Save list of recharge requests to LocalStorage
 */
export const saveLocalRechargeRequests = (list: RechargeRequest[]): void => {
  try {
    localStorage.setItem(LOCAL_REQUESTS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving local recharge requests:', err);
  }
};

/**
 * Submit a new Wallet Recharge Request with mandatory UTR number.
 * Note: Money is NOT added to wallet here. It goes to pending status for Admin approval.
 */
export const submitRechargeRequest = async (params: {
  userId: string;
  userName?: string;
  userPhone?: string;
  amount: number;
  bonus: number;
  utr: string;
  paymentMethod?: string;
}): Promise<{ success: boolean; message: string; request?: RechargeRequest }> => {
  const cleanUtr = params.utr.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!cleanUtr || cleanUtr.length < 6) {
    return {
      success: false,
      message: 'Kripya valid 12-digit UTR / UPI Reference Number darj karein.'
    };
  }

  if (params.amount <= 0) {
    return {
      success: false,
      message: 'Kripya valid recharge amount select karein.'
    };
  }

  // Check duplicate UTR in existing requests
  const localList = getLocalRechargeRequests();
  const duplicate = localList.find(
    (r) => r.utr.toUpperCase() === cleanUtr && r.status !== 'rejected'
  );
  if (duplicate) {
    return {
      success: false,
      message: `Ye UTR (${cleanUtr}) pehle hi submit ho chuka hai (Status: ${duplicate.status.toUpperCase()}). Ek UTR ko dobara submit nahi kiya ja sakta.`
    };
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const totalBalance = parseFloat((params.amount + params.bonus).toFixed(2));

  const newRequest: RechargeRequest = {
    id: requestId,
    userId: params.userId,
    userName: params.userName || 'Caller User',
    userPhone: params.userPhone || '',
    amount: params.amount,
    bonus: params.bonus,
    totalBalance,
    utr: cleanUtr,
    paymentMethod: params.paymentMethod || 'UPI',
    status: 'pending',
    createdAt: Date.now()
  };

  // 1. Save to Local Storage immediately
  const updatedLocal = [newRequest, ...localList];
  saveLocalRechargeRequests(updatedLocal);

  // 2. Save to Cloud Firestore if active
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, RECHARGE_REQUESTS_COLLECTION, requestId), newRequest);
    } catch (err) {
      console.warn('Could not sync recharge request to firestore:', err);
    }
  }

  return {
    success: true,
    message: `✅ Recharge request UTR (${cleanUtr}) ke sath submit ho gayi hai! Admin verification ke baad balance aapke wallet me credit ho jayega.`,
    request: newRequest
  };
};

/**
 * Fetch all recharge requests (Firestore + LocalStorage merged)
 */
export const fetchAllRechargeRequests = async (): Promise<RechargeRequest[]> => {
  const map: Record<string, RechargeRequest> = {};

  // 1. Read Local Storage
  const localList = getLocalRechargeRequests();
  localList.forEach((r) => {
    map[r.id] = r;
  });

  // 2. Read Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDocs(collection(db, RECHARGE_REQUESTS_COLLECTION));
      snap.forEach((docSnap) => {
        const data = docSnap.data() as RechargeRequest;
        const id = data.id || docSnap.id;
        map[id] = { ...data, id };
      });
    } catch (err) {
      console.warn('Error reading recharge requests from firestore:', err);
    }
  }

  return Object.values(map).sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Subscribe to all recharge requests in real time (for Admin Panel)
 */
export const subscribeToAllRechargeRequests = (
  onUpdate: (requests: RechargeRequest[]) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) {
    // Return current local requests
    onUpdate(getLocalRechargeRequests().sort((a, b) => b.createdAt - a.createdAt));
    return null;
  }

  try {
    const colRef = collection(db, RECHARGE_REQUESTS_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snap) => {
        const list: RechargeRequest[] = [];
        snap.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as RechargeRequest), id: docSnap.id });
        });
        // Merge with local if any missing
        const localList = getLocalRechargeRequests();
        const map: Record<string, RechargeRequest> = {};
        localList.forEach((r) => { map[r.id] = r; });
        list.forEach((r) => { map[r.id] = r; });
        const merged = Object.values(map).sort((a, b) => b.createdAt - a.createdAt);
        saveLocalRechargeRequests(merged);
        onUpdate(merged);
      },
      (err) => {
        console.warn('Error listening to recharge requests:', err);
        onUpdate(getLocalRechargeRequests().sort((a, b) => b.createdAt - a.createdAt));
      }
    );
  } catch (err) {
    console.warn('Could not subscribe to recharge requests:', err);
    onUpdate(getLocalRechargeRequests());
    return null;
  }
};

/**
 * Subscribe to current user's recharge requests in real time (for Wallet Modal History)
 */
export const subscribeToUserRechargeRequests = (
  userId: string,
  onUpdate: (requests: RechargeRequest[]) => void
): Unsubscribe | null => {
  const getFilteredLocal = () => {
    return getLocalRechargeRequests()
      .filter((r) => r.userId === userId || r.userId === 'caller_' + userId || userId === 'caller_' + r.userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  };

  if (!isFirebaseConfigured() || !db) {
    onUpdate(getFilteredLocal());
    return null;
  }

  try {
    const colRef = collection(db, RECHARGE_REQUESTS_COLLECTION);
    return onSnapshot(
      colRef,
      (snap) => {
        const list: RechargeRequest[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as RechargeRequest;
          if (data.userId === userId || data.userId === 'caller_' + userId || userId === 'caller_' + data.userId) {
            list.push({ ...data, id: docSnap.id });
          }
        });
        // Merge with local
        const localItems = getFilteredLocal();
        const map: Record<string, RechargeRequest> = {};
        localItems.forEach((r) => { map[r.id] = r; });
        list.forEach((r) => { map[r.id] = r; });
        const sorted = Object.values(map).sort((a, b) => b.createdAt - a.createdAt);
        onUpdate(sorted);
      },
      () => {
        onUpdate(getFilteredLocal());
      }
    );
  } catch {
    onUpdate(getFilteredLocal());
    return null;
  }
};

/**
 * Admin Action: Approve Recharge Request and manually credit user wallet.
 */
export const approveRechargeRequest = async (
  requestId: string,
  adminNote = 'Admin Verified & Approved'
): Promise<{ success: boolean; message: string; request?: RechargeRequest }> => {
  const all = await fetchAllRechargeRequests();
  const req = all.find((r) => r.id === requestId);

  if (!req) {
    return { success: false, message: 'Recharge request record nahi mila.' };
  }

  if (req.status === 'approved') {
    return { success: false, message: 'Ye request pehle se Approved hai.' };
  }

  // Update request state
  const updatedReq: RechargeRequest = {
    ...req,
    status: 'approved',
    reviewedAt: Date.now(),
    reviewedBy: 'Admin',
    adminNote
  };

  // 1. Credit the User's Wallet
  const tx: WalletTransaction = {
    id: `tx-recharge-${Date.now()}`,
    type: 'credit',
    amount: updatedReq.totalBalance,
    description: `✅ Admin Approved Recharge (₹${updatedReq.amount} + ₹${updatedReq.bonus} bonus • UTR: ${updatedReq.utr})`,
    timestamp: Date.now()
  };

  await creditUserCloudWallet(updatedReq.userId, updatedReq.totalBalance, tx);

  // 2. Process referral bonus reward for referrer if applicable
  processReferralRewardOnRecharge(updatedReq.userId, updatedReq.amount, (rewardCoins, refCode) => {
    console.log(`🎉 ₹${rewardCoins} Coins referral bonus processed for ${refCode}!`);
  });

  // 3. Save updated request to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, RECHARGE_REQUESTS_COLLECTION, updatedReq.id), updatedReq, { merge: true });
    } catch (err) {
      console.warn('Could not update approved request in firestore:', err);
    }
  }

  // 4. Save to Local Storage
  const updatedLocal = all.map((r) => (r.id === updatedReq.id ? updatedReq : r));
  saveLocalRechargeRequests(updatedLocal);

  return {
    success: true,
    message: `🎉 UTR ${updatedReq.utr} verify ho gaya! User (${updatedReq.userPhone || updatedReq.userId}) ke wallet me ₹${updatedReq.totalBalance} successfully credit ho gaye.`,
    request: updatedReq
  };
};

/**
 * Admin Action: Reject Recharge Request with reason.
 */
export const rejectRechargeRequest = async (
  requestId: string,
  reason: string
): Promise<{ success: boolean; message: string; request?: RechargeRequest }> => {
  const all = await fetchAllRechargeRequests();
  const req = all.find((r) => r.id === requestId);

  if (!req) {
    return { success: false, message: 'Recharge request record nahi mila.' };
  }

  const updatedReq: RechargeRequest = {
    ...req,
    status: 'rejected',
    reviewedAt: Date.now(),
    reviewedBy: 'Admin',
    rejectReason: reason.trim() || 'Payment not verified / Invalid UTR'
  };

  // 1. Save updated request to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, RECHARGE_REQUESTS_COLLECTION, updatedReq.id), updatedReq, { merge: true });
    } catch (err) {
      console.warn('Could not update rejected request in firestore:', err);
    }
  }

  // 2. Save to Local Storage
  const updatedLocal = all.map((r) => (r.id === updatedReq.id ? updatedReq : r));
  saveLocalRechargeRequests(updatedLocal);

  return {
    success: true,
    message: `❌ Recharge request UTR ${updatedReq.utr} reject kar di gayi hai (Reason: ${updatedReq.rejectReason}).`,
    request: updatedReq
  };
};
