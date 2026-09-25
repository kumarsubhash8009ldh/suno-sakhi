import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletTransaction, CallType, Sakhi, RechargeRequest } from '../types';
import { sounds } from '../utils/soundEffects';
import {
  subscribeToCloudWallet,
  syncTransactionToCloud,
  syncLiveBalanceToCloud
} from '../services/walletSync';
import { isFirebaseConfigured } from '../services/firebase';
import { captureReferralFromUrl, processReferralRewardOnRecharge } from '../services/referralSync';
import {
  subscribeToUserRechargeRequests,
  submitRechargeRequest
} from '../services/rechargeSync';
import { getCurrentUser, getActiveSession, useActiveSession } from '../services/userAuthSync';

interface WalletContextType {
  balance: number;
  transactions: WalletTransaction[];
  rechargeRequests: RechargeRequest[];
  isWalletModalOpen: boolean;
  isCloudSynced: boolean;
  userId: string;
  openWalletModal: () => void;
  closeWalletModal: () => void;
  recharge: (amount: number, bonus: number) => void;
  submitRecharge: (
    amount: number,
    bonus: number,
    utr: string,
    method?: string
  ) => Promise<{ success: boolean; message: string; request?: RechargeRequest }>;
  deductLiveAmount: (amount: number) => boolean;
  recordCallExpense: (sakhi: Sakhi, callType: CallType, durationSec: number, cost: number) => void;
  resetToDefault: () => void;
  creditLoginBonus: (phone: string, isNewUser: boolean, hasReferral: boolean) => void;
  claimShareBonus: () => { success: boolean; message: string; bonus: number };
}

const STORAGE_KEY_USER_ID = 'sunosakhi_user_id';

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useActiveSession();

  const getPhoneKey = (phone: string) => `sunosakhi_wallet_bal_${phone.replace(/\D/g, '')}`;
  const getTxsKey = (phone: string) => `sunosakhi_wallet_txs_${phone.replace(/\D/g, '')}`;

  const [userId] = useState<string>(() => {
    let savedId = localStorage.getItem(STORAGE_KEY_USER_ID);
    if (!savedId) {
      savedId = 'user_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(STORAGE_KEY_USER_ID, savedId);
    }
    return savedId;
  });

  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(isFirebaseConfigured());

  // STRICT RULE: Guest/unlogged users have 0 balance. Coins only load when logged in!
  const [balance, setBalance] = useState<number>(() => {
    const s = getActiveSession();
    if (!s.isLoggedIn || !s.phone) return 0;
    const saved = localStorage.getItem(`sunosakhi_wallet_bal_${s.phone.replace(/\D/g, '')}`);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      return !isNaN(parsed) ? parsed : 20;
    }
    return 20;
  });

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    const s = getActiveSession();
    if (!s.isLoggedIn || !s.phone) return [];
    const saved = localStorage.getItem(`sunosakhi_wallet_txs_${s.phone.replace(/\D/g, '')}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: 'tx-welcome-01',
        type: 'credit',
        amount: 20,
        description: '🎁 Welcome Bonus - SunoSakhi Free Talk Time',
        timestamp: Date.now() - 3600000
      }
    ];
  });

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);

  // Function to credit Welcome Bonus (₹20) and Referral Bonus (+₹25)
  const creditLoginBonus = (phone: string, isNewUser: boolean, hasReferral: boolean, playSound: boolean = false) => {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone) return;
      const keyBal = getPhoneKey(cleanPhone);
      const keyTxs = getTxsKey(cleanPhone);

      const savedBal = localStorage.getItem(keyBal);
      if (savedBal !== null && !isNewUser) {
        // Existing user returning: load their saved balance
        const parsed = parseFloat(savedBal);
        setBalance(!isNaN(parsed) ? parsed : 0);
        const savedTxs = localStorage.getItem(keyTxs);
        if (savedTxs) {
          try { setTransactions(JSON.parse(savedTxs)); } catch {}
        }
        return;
      }

      // New user or initial login bonus credit
      const welcomeAmount = 20.0;
      const referralBonus = hasReferral ? 25.0 : 0.0;
      const totalCredit = welcomeAmount + referralBonus;

      const newTxs: WalletTransaction[] = [
        {
          id: 'tx-welcome-' + Date.now(),
          type: 'credit',
          amount: welcomeAmount,
          description: '🎁 Welcome Login Bonus - Free Talk Time',
          timestamp: Date.now()
        }
      ];

      if (hasReferral) {
        newTxs.unshift({
          id: 'tx-referral-' + Date.now(),
          type: 'credit',
          amount: referralBonus,
          description: '🤝 Referral Invite Bonus (Joined via friend invite)',
          timestamp: Date.now()
        });
      }

      setBalance(!isNaN(totalCredit) ? totalCredit : 20);
      setTransactions(newTxs);
      localStorage.setItem(keyBal, totalCredit.toString());
      localStorage.setItem(keyTxs, JSON.stringify(newTxs));
      if (playSound) {
        try {
          sounds.playCoinSound();
        } catch (e) {}
      }
    } catch (err) {
      console.warn('creditLoginBonus note:', err);
    }
  };

  // Sync balance with active session
  useEffect(() => {
    if (!session.isLoggedIn || !session.phone) {
      setBalance(0);
      setTransactions([]);
      return;
    }

    const cleanPhone = session.phone.replace(/\D/g, '');
    const keyBal = getPhoneKey(cleanPhone);
    const keyTxs = getTxsKey(cleanPhone);
    const savedBal = localStorage.getItem(keyBal);
    const savedTxs = localStorage.getItem(keyTxs);

    if (savedBal !== null) {
      const parsed = parseFloat(savedBal);
      setBalance(!isNaN(parsed) ? parsed : 0);
      if (savedTxs) {
        try {
          setTransactions(JSON.parse(savedTxs));
        } catch {}
      }
    } else {
      // Auto-credit login welcome bonus on first session detection (silent in background)
      const hasRef = Boolean(localStorage.getItem('sunosakhi_referred_by'));
      creditLoginBonus(cleanPhone, true, hasRef, false);
    }
  }, [session.isLoggedIn, session.phone]);

  // Subscribe to user's recharge requests
  useEffect(() => {
    const unsub = subscribeToUserRechargeRequests(userId, (list) => {
      setRechargeRequests(list);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [userId]);

  // Subscribe to real-time cloud wallet if Firebase is configured
  useEffect(() => {
    captureReferralFromUrl();
    if (!isFirebaseConfigured() || !session.isLoggedIn) {
      setIsCloudSynced(false);
      return;
    }

    const unsub = subscribeToCloudWallet(userId, ({ balance: cloudBal, transactions: cloudTxs }) => {
      if (cloudBal !== undefined) setBalance(cloudBal);
      if (cloudTxs && cloudTxs.length > 0) {
        setTransactions(cloudTxs);
      }
      setIsCloudSynced(true);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [userId, session.isLoggedIn]);

  // LocalStorage backups tied to current user phone
  useEffect(() => {
    if (session.isLoggedIn && session.phone) {
      const cleanPhone = session.phone.replace(/\D/g, '');
      localStorage.setItem(getPhoneKey(cleanPhone), balance.toString());
    }
  }, [balance, session.isLoggedIn, session.phone]);

  useEffect(() => {
    if (session.isLoggedIn && session.phone) {
      const cleanPhone = session.phone.replace(/\D/g, '');
      localStorage.setItem(getTxsKey(cleanPhone), JSON.stringify(transactions));
    }
  }, [transactions, session.isLoggedIn, session.phone]);

  const openWalletModal = () => setIsWalletModalOpen(true);
  const closeWalletModal = () => setIsWalletModalOpen(false);

  const recharge = (amount: number, bonus?: number) => {
    const calculatedBonus = typeof bonus === 'number' && bonus >= 0 ? bonus : parseFloat((amount * 0.05).toFixed(2));
    const totalCredit = parseFloat((amount + calculatedBonus).toFixed(2));
    const newBal = parseFloat((balance + totalCredit).toFixed(2));
    setBalance(newBal);
    sounds.playCoinSound();

    const newTx: WalletTransaction = {
      id: 'tx-' + Date.now(),
      type: 'credit',
      amount: totalCredit,
      description: `Wallet Recharge (₹${amount} + ₹${calculatedBonus} 5% Extra Bonus)`,
      timestamp: Date.now()
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Cloud sync
    syncTransactionToCloud(userId, newBal, newTx);

    // Process referral bonus (₹100 Coins) for referrer when user adds cash
    processReferralRewardOnRecharge(userId, amount, (rewardCoins, refCode) => {
      console.log(`🎉 ₹${rewardCoins} Coins referral bonus processed for ${refCode}!`);
    });
  };

  const submitRecharge = async (
    amount: number,
    bonus: number | undefined,
    utr: string,
    method = 'UPI'
  ) => {
    const caller = getCurrentUser();
    const calculatedBonus = typeof bonus === 'number' && bonus >= 0 ? bonus : parseFloat((amount * 0.05).toFixed(2));
    return await submitRechargeRequest({
      userId,
      userName: caller?.name || 'Caller User',
      userPhone: caller?.phone || '',
      amount,
      bonus: calculatedBonus,
      utr,
      paymentMethod: method
    });
  };

  const deductLiveAmount = (amount: number): boolean => {
    // STRICT RULE: Host accounts are 100% FREE! Zero charges for Girl Hosts!
    const activeSess = getActiveSession();
    const isHostActive =
      activeSess.role === 'host' ||
      localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
      localStorage.getItem('sunosakhi_active_role') === 'host';
    if (isHostActive) {
      return true;
    }

    if (balance <= 0) return false;

    const next = parseFloat(Math.max(0, balance - amount).toFixed(2));
    setBalance(next);

    // Sync tick to cloud asynchronously
    syncLiveBalanceToCloud(userId, next);
    return true;
  };

  const recordCallExpense = (sakhi: Sakhi, callType: CallType, durationSec: number, cost: number) => {
    // STRICT RULE: Never record call expense on Girl Host ID!
    const activeSess = getActiveSession();
    if (
      activeSess.role === 'host' ||
      localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
      localStorage.getItem('sunosakhi_active_role') === 'host'
    ) {
      return;
    }

    if (cost <= 0) return;
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const durationLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    const newTx: WalletTransaction = {
      id: 'tx-call-' + Date.now(),
      type: 'debit',
      amount: parseFloat(cost.toFixed(2)),
      description: `${callType === 'voice' ? '🎙️ Voice Call' : '📹 Video Call'} with ${sakhi.name} (${durationLabel})`,
      timestamp: Date.now(),
      callType,
      sakhiName: sakhi.name
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Cloud sync transaction
    syncTransactionToCloud(userId, balance, newTx);
  };

  const resetToDefault = () => {
    setBalance(20.0);
    const welcomeTx: WalletTransaction = {
      id: 'tx-welcome-01',
      type: 'credit',
      amount: 20.0,
      description: '🎁 Welcome Bonus - SunoSakhi Free Talk Time',
      timestamp: Date.now()
    };
    setTransactions([welcomeTx]);
    syncTransactionToCloud(userId, 20.0, welcomeTx);
  };

  const claimShareBonus = (): { success: boolean; message: string; bonus: number } => {
    const activeSess = getActiveSession();
    if (!activeSess.isLoggedIn || !activeSess.phone) {
      return { success: false, message: '₹50 Coins claim karne ke liye kripya pehle Mobile se Login karein.', bonus: 0 };
    }
    const cleanPhone = activeSess.phone.replace(/\D/g, '');
    const today = new Date().toISOString().slice(0, 10);
    const claimKey = `sunosakhi_share_claimed_${cleanPhone}_${today}`;

    if (localStorage.getItem(claimKey) === 'true') {
      return {
        success: false,
        message: 'Aaj ka ₹50 Share Bonus claim ho chuka hai! Har din share karke ₹50 Coins paayein.',
        bonus: 0
      };
    }

    const bonusAmount = 50;
    const newBal = parseFloat((balance + bonusAmount).toFixed(2));
    setBalance(newBal);
    sounds.playCoinSound();

    const newTx: WalletTransaction = {
      id: 'tx-share-' + Date.now(),
      type: 'credit',
      amount: bonusAmount,
      description: `🎁 Share Link Bonus (₹${bonusAmount} Free Coins)`,
      timestamp: Date.now()
    };
    setTransactions((prev) => [newTx, ...prev]);
    localStorage.setItem(claimKey, 'true');
    localStorage.setItem(getPhoneKey(cleanPhone), newBal.toString());
    syncTransactionToCloud(userId, newBal, newTx);

    return {
      success: true,
      message: `🎉 Badhai ho! ₹${bonusAmount} Coins aapke wallet me jud gaye hain!`,
      bonus: bonusAmount
    };
  };

  return (
    <WalletContext.Provider
      value={{
        balance,
        transactions,
        rechargeRequests,
        isWalletModalOpen,
        isCloudSynced,
        userId,
        openWalletModal,
        closeWalletModal,
        recharge,
        submitRecharge,
        deductLiveAmount,
        recordCallExpense,
        resetToDefault,
        creditLoginBonus,
        claimShareBonus
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

