import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { WalletTransaction } from '../types';

const WALLET_COLLECTION = 'wallets';
const TX_COLLECTION = 'transactions';

export interface CloudWalletData {
  balance: number;
  updatedAt: number;
  lastTxId?: string;
}

/**
 * Subscribe to real-time wallet balance and recent transactions from Firestore.
 */
export const subscribeToCloudWallet = (
  userId: string,
  onUpdate: (data: { balance: number; transactions: WalletTransaction[] }) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  try {
    const walletDocRef = doc(db, WALLET_COLLECTION, userId);
    const txColRef = collection(db, WALLET_COLLECTION, userId, TX_COLLECTION);
    const txQuery = query(txColRef, orderBy('timestamp', 'desc'), limit(50));

    let currentBalance: number | null = null;
    let currentTxs: WalletTransaction[] = [];

    const unsubWallet = onSnapshot(walletDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CloudWalletData;
        currentBalance = data.balance;
        if (currentBalance !== null) {
          onUpdate({ balance: currentBalance, transactions: currentTxs });
        }
      }
    });

    const unsubTxs = onSnapshot(txQuery, (snap) => {
      const txList: WalletTransaction[] = [];
      snap.forEach((d) => {
        txList.push(d.data() as WalletTransaction);
      });
      currentTxs = txList;
      if (currentBalance !== null) {
        onUpdate({ balance: currentBalance, transactions: currentTxs });
      }
    });

    return () => {
      unsubWallet();
      unsubTxs();
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
  transaction: WalletTransaction
): Promise<boolean> => {
  if (!isFirebaseConfigured() || !db) return false;

  try {
    const walletDocRef = doc(db, WALLET_COLLECTION, userId);
    await setDoc(
      walletDocRef,
      {
        balance: newBalance,
        updatedAt: Date.now(),
        lastTxId: transaction.id
      },
      { merge: true }
    );

    const txDocRef = doc(db, WALLET_COLLECTION, userId, TX_COLLECTION, transaction.id);
    await setDoc(txDocRef, transaction);
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
  newBalance: number
): Promise<boolean> => {
  if (!isFirebaseConfigured() || !db) return false;

  try {
    const walletDocRef = doc(db, WALLET_COLLECTION, userId);
    await updateDoc(walletDocRef, {
      balance: newBalance,
      updatedAt: Date.now()
    });
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
  transaction: WalletTransaction
): Promise<{ success: boolean; newBalance: number }> => {
  let currentBalance = 50.0; // default base if not set

  // 1. If Firestore configured, read and update Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const walletDocRef = doc(db, WALLET_COLLECTION, userId);
      const snap = await getDoc(walletDocRef);
      if (snap.exists() && typeof snap.data().balance === 'number') {
        currentBalance = snap.data().balance;
      }
      const newBal = parseFloat((currentBalance + amountToAdd).toFixed(2));

      await setDoc(
        walletDocRef,
        {
          balance: newBal,
          updatedAt: Date.now(),
          lastTxId: transaction.id
        },
        { merge: true }
      );

      const txDocRef = doc(db, WALLET_COLLECTION, userId, TX_COLLECTION, transaction.id);
      await setDoc(txDocRef, transaction);

      // Check if this is current local user session
      const currentLocalUserId = localStorage.getItem('sunosakhi_user_id');
      if (currentLocalUserId === userId || currentLocalUserId === 'caller_' + userId || userId === 'caller_' + currentLocalUserId) {
        localStorage.setItem('sunosakhi_wallet_balance', newBal.toString());
        try {
          const rawTxs = localStorage.getItem('sunosakhi_wallet_txs');
          const txs: WalletTransaction[] = rawTxs ? JSON.parse(rawTxs) : [];
          localStorage.setItem('sunosakhi_wallet_txs', JSON.stringify([transaction, ...txs]));
        } catch {}
      }

      return { success: true, newBalance: newBal };
    } catch (err) {
      console.error('Error crediting cloud wallet:', err);
    }
  }

  // Fallback to local storage update
  try {
    const saved = localStorage.getItem('sunosakhi_wallet_balance');
    const cur = saved !== null ? parseFloat(saved) : 50.0;
    const newBal = parseFloat((cur + amountToAdd).toFixed(2));
    localStorage.setItem('sunosakhi_wallet_balance', newBal.toString());

    const rawTxs = localStorage.getItem('sunosakhi_wallet_txs');
    const txs: WalletTransaction[] = rawTxs ? JSON.parse(rawTxs) : [];
    localStorage.setItem('sunosakhi_wallet_txs', JSON.stringify([transaction, ...txs]));

    return { success: true, newBalance: newBal };
  } catch (err) {
    return { success: false, newBalance: currentBalance };
  }
};

