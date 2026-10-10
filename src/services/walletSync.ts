import { doc, getDoc, setDoc, collection, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { WalletTransaction } from '../types';

const WALLET_COLLECTION = 'wallets';
const TX_COLLECTION = 'transactions';
const USER_ACCOUNTS_COLLECTION = 'user_accounts';

export interface CloudWalletData {
  balance: number;
  updatedAt: number;
  lastTxId?: string;
}

/**
 * Extract 10-digit normalized phone from a userId or phone string if present.
 */
export const extractPhoneFromId = (userIdOrPhone?: string, explicitPhone?: string): string => {
  if (explicitPhone) {
    const clean = explicitPhone.replace(/\D/g, '');
    if (clean.length >= 10) return clean.slice(-10);
  }
  if (!userIdOrPhone) return '';
  const digits = userIdOrPhone.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '';
};

/**
 * Get canonical primary wallet doc ID ('caller_<10digit>' when phone is known).
 */
export const getCanonicalWalletId = (userId: string, phone?: string): string => {
  const cleanPhone = extractPhoneFromId(userId, phone);
  if (cleanPhone.length === 10) {
    return `caller_${cleanPhone}`;
  }
  return userId;
};

/**
 * Update local storage wallet keys & notify active tabs/components in the same browser.
 */
export const updateLocalWalletCache = (
  userId: string,
  newBalance: number,
  transaction?: WalletTransaction,
  phone?: string
): void => {
  if (typeof window === 'undefined') return;
  const cleanPhone = extractPhoneFromId(userId, phone);
  const rounded = parseFloat(Number(newBalance).toFixed(2));

  try {
    if (cleanPhone.length === 10) {
      localStorage.setItem(`sunosakhi_wallet_bal_${cleanPhone}`, rounded.toString());
      localStorage.setItem(`sunosakhi_wallet_caller_${cleanPhone}`, rounded.toString());
      if (transaction) {
        const keyTxs = `sunosakhi_wallet_txs_${cleanPhone}`;
        const rawTxs = localStorage.getItem(keyTxs);
        const txs: WalletTransaction[] = rawTxs ? JSON.parse(rawTxs) : [];
        if (!txs.some((t) => t.id === transaction.id)) {
          localStorage.setItem(keyTxs, JSON.stringify([transaction, ...txs]));
        }
      }
    }

    const currentLocalUserId = localStorage.getItem('sunosakhi_user_id') || '';
    const currentLocalPhone = extractPhoneFromId(currentLocalUserId);
    if (
      currentLocalUserId === userId ||
      (cleanPhone && currentLocalPhone === cleanPhone)
    ) {
      localStorage.setItem('sunosakhi_wallet_balance', rounded.toString());
      if (transaction) {
        const rawTxs = localStorage.getItem('sunosakhi_wallet_txs');
        const txs: WalletTransaction[] = rawTxs ? JSON.parse(rawTxs) : [];
        if (!txs.some((t) => t.id === transaction.id)) {
          localStorage.setItem('sunosakhi_wallet_txs', JSON.stringify([transaction, ...txs]));
        }
      }
    }

    window.dispatchEvent(
      new CustomEvent('sunosakhi-wallet-updated', {
        detail: {
          userId,
          phone: cleanPhone,
          balance: rounded,
          transaction
        }
      })
    );
  } catch (err) {
    console.warn('Local wallet cache update note:', err);
  }
};

/**
 * Subscribe to real-time wallet balance and recent transactions from Firestore.
 * Listens to both canonical `wallets/caller_<phone>` and legacy `wallets/<userId>` documents.
 */
export const subscribeToCloudWallet = (
  userId: string,
  onUpdate: (data: { balance: number; transactions: WalletTransaction[] }) => void,
  phone?: string
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db || !userId) return null;

  try {
    const cleanPhone = extractPhoneFromId(userId, phone);
    const canonicalId = getCanonicalWalletId(userId, cleanPhone);

    const walletDocRef = doc(db, WALLET_COLLECTION, canonicalId);
    const txColRef = collection(db, WALLET_COLLECTION, canonicalId, TX_COLLECTION);
    const txQuery = query(txColRef, orderBy('timestamp', 'desc'), limit(50));

    let currentBalance: number | null = null;
    let lastUpdatedAt = 0;
    let currentTxs: WalletTransaction[] = [];

    const handleBalanceSnapshot = (bal: number, updatedAt: number = Date.now()) => {
      if (typeof bal === 'number' && !isNaN(bal) && updatedAt >= lastUpdatedAt) {
        lastUpdatedAt = updatedAt;
        currentBalance = parseFloat(bal.toFixed(2));
        onUpdate({ balance: currentBalance, transactions: currentTxs });
      }
    };

    const unsubs: Unsubscribe[] = [];

    // 1. Primary canonical wallet doc listener
    unsubs.push(
      onSnapshot(walletDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CloudWalletData;
          if (typeof data.balance === 'number') {
            handleBalanceSnapshot(data.balance, data.updatedAt || Date.now());
          }
        }
      })
    );

    // 2. If userId differs from canonicalId (e.g. 'caller-9876543210' vs 'caller_9876543210'), listen to it too
    if (userId !== canonicalId) {
      unsubs.push(
        onSnapshot(doc(db, WALLET_COLLECTION, userId), (snap) => {
          if (snap.exists()) {
            const data = snap.data() as CloudWalletData;
            if (typeof data.balance === 'number') {
              handleBalanceSnapshot(data.balance, data.updatedAt || Date.now());
            }
          }
        })
      );
    }

    // 3. Transactions listener on canonical wallet
    unsubs.push(
      onSnapshot(txQuery, (snap) => {
        const txList: WalletTransaction[] = [];
        snap.forEach((d) => {
          txList.push(d.data() as WalletTransaction);
        });
        currentTxs = txList;
        if (currentBalance !== null) {
          onUpdate({ balance: currentBalance, transactions: currentTxs });
        }
      })
    );

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  } catch (err) {
    console.warn('Could not subscribe to cloud wallet:', err);
    return null;
  }
};

/**
 * Sync wallet transaction (recharge / call expense / gift debit) to Firestore.
 */
export const syncTransactionToCloud = async (
  userId: string,
  newBalance: number,
  transaction: WalletTransaction,
  phone?: string
): Promise<boolean> => {
  const cleanPhone = extractPhoneFromId(userId, phone);
  const canonicalId = getCanonicalWalletId(userId, cleanPhone);
  const rounded = parseFloat(Number(newBalance).toFixed(2));

  updateLocalWalletCache(canonicalId, rounded, transaction, cleanPhone);

  if (!isFirebaseConfigured() || !db) return false;

  try {
    const now = Date.now();
    const walletDocRef = doc(db, WALLET_COLLECTION, canonicalId);
    await setDoc(
      walletDocRef,
      {
        balance: rounded,
        updatedAt: now,
        lastTxId: transaction.id,
        phone: cleanPhone || undefined
      },
      { merge: true }
    );

    const txDocRef = doc(db, WALLET_COLLECTION, canonicalId, TX_COLLECTION, transaction.id);
    await setDoc(txDocRef, transaction);

    // Also keep user_accounts/<phone>.balance in sync for Admin Directory & Host Callers view
    if (cleanPhone.length === 10) {
      await setDoc(
        doc(db, USER_ACCOUNTS_COLLECTION, cleanPhone),
        {
          balance: rounded,
          updatedAt: now
        },
        { merge: true }
      );
    }

    return true;
  } catch (err) {
    console.error('Failed to sync wallet transaction to Firebase:', err);
    return false;
  }
};

/**
 * Sync live balance deduction (e.g. during call ticking).
 */
export const syncLiveBalanceToCloud = async (
  userId: string,
  newBalance: number,
  phone?: string
): Promise<boolean> => {
  const cleanPhone = extractPhoneFromId(userId, phone);
  const canonicalId = getCanonicalWalletId(userId, cleanPhone);
  const rounded = parseFloat(Number(newBalance).toFixed(2));

  if (!isFirebaseConfigured() || !db) return false;

  try {
    const now = Date.now();
    const walletDocRef = doc(db, WALLET_COLLECTION, canonicalId);
    await setDoc(
      walletDocRef,
      {
        balance: rounded,
        updatedAt: now
      },
      { merge: true }
    );

    if (cleanPhone.length === 10) {
      await setDoc(
        doc(db, USER_ACCOUNTS_COLLECTION, cleanPhone),
        {
          balance: rounded,
          updatedAt: now
        },
        { merge: true }
      );
    }
    return true;
  } catch (err) {
    // Non-critical, ignore transient live tick failures
    return false;
  }
};

/**
 * Admin action: Credit a specific user's cloud wallet balance and log credit transaction.
 */
export const creditUserCloudWallet = async (
  userId: string,
  amountToAdd: number,
  transaction: WalletTransaction,
  phone?: string
): Promise<{ success: boolean; newBalance: number }> => {
  const cleanPhone = extractPhoneFromId(userId, phone);
  const canonicalId = getCanonicalWalletId(userId, cleanPhone);
  let currentBalance = 20.0; // default base if not set

  // Check local cache first as baseline fallback
  if (typeof window !== 'undefined' && cleanPhone.length === 10) {
    const localBal = localStorage.getItem(`sunosakhi_wallet_bal_${cleanPhone}`);
    if (localBal !== null && !isNaN(parseFloat(localBal))) {
      currentBalance = parseFloat(localBal);
    }
  }

  // 1. If Firestore configured, read and update Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const walletDocRef = doc(db, WALLET_COLLECTION, canonicalId);
      const snap = await getDoc(walletDocRef);
      if (snap.exists() && typeof snap.data().balance === 'number') {
        currentBalance = snap.data().balance;
      } else if (userId !== canonicalId) {
        const altSnap = await getDoc(doc(db, WALLET_COLLECTION, userId));
        if (altSnap.exists() && typeof altSnap.data().balance === 'number') {
          currentBalance = altSnap.data().balance;
        } else if (cleanPhone.length === 10) {
          const accSnap = await getDoc(doc(db, USER_ACCOUNTS_COLLECTION, cleanPhone));
          if (accSnap.exists() && typeof accSnap.data().balance === 'number') {
            currentBalance = accSnap.data().balance;
          }
        }
      }

      const newBal = parseFloat((currentBalance + amountToAdd).toFixed(2));
      const now = Date.now();

      await setDoc(
        walletDocRef,
        {
          balance: newBal,
          updatedAt: now,
          lastTxId: transaction.id,
          phone: cleanPhone || undefined
        },
        { merge: true }
      );

      if (userId && userId !== canonicalId) {
        await setDoc(
          doc(db, WALLET_COLLECTION, userId),
          {
            balance: newBal,
            updatedAt: now,
            lastTxId: transaction.id
          },
          { merge: true }
        );
      }

      if (cleanPhone.length === 10) {
        await setDoc(
          doc(db, USER_ACCOUNTS_COLLECTION, cleanPhone),
          {
            balance: newBal,
            updatedAt: now
          },
          { merge: true }
        );
      }

      const txDocRef = doc(db, WALLET_COLLECTION, canonicalId, TX_COLLECTION, transaction.id);
      await setDoc(txDocRef, transaction);

      updateLocalWalletCache(canonicalId, newBal, transaction, cleanPhone);

      return { success: true, newBalance: newBal };
    } catch (err) {
      console.error('Error crediting cloud wallet:', err);
    }
  }

  // Fallback to local storage update
  try {
    const newBal = parseFloat((currentBalance + amountToAdd).toFixed(2));
    updateLocalWalletCache(canonicalId, newBal, transaction, cleanPhone);
    return { success: true, newBalance: newBal };
  } catch (err) {
    return { success: false, newBalance: currentBalance };
  }
};


