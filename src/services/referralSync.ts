import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { WalletTransaction } from '../types';

const REF_STORAGE_KEY = 'sunosakhi_my_referral_code';
const REFERRED_BY_KEY = 'sunosakhi_referred_by_code';
const REFERRALS_COLLECTION = 'referrals';
const WALLET_COLLECTION = 'wallets';

export const REFERRAL_BONUS_COINS = 50; // ₹50 Coins as requested!

/**
 * Generate or get user's persistent referral code
 */
export const getMyReferralCode = (userIdOrPhone?: string): string => {
  let saved = localStorage.getItem(REF_STORAGE_KEY);
  if (!saved) {
    if (userIdOrPhone && userIdOrPhone.length >= 4) {
      saved = 'SAKHI' + userIdOrPhone.slice(-4).toUpperCase();
    } else {
      const rand = Math.floor(1000 + Math.random() * 9000);
      saved = 'SAKHI' + rand;
    }
    localStorage.setItem(REF_STORAGE_KEY, saved);
  }
  return saved;
};

/**
 * Generate shareable link
 */
export const getReferralShareUrl = (refCode: string): string => {
  const base = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://selective-scenarios-discuss-proposition.trycloudflare.com';
  return `${base.replace(/\/$/, '')}/download?ref=${refCode}`;
};

/**
 * Check and save URL referral param (e.g. ?ref=SAKHI1234)
 */
export const captureReferralFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && ref.trim()) {
    const cleaned = ref.trim().toUpperCase();
    localStorage.setItem(REFERRED_BY_KEY, cleaned);
    console.log('🎁 Captured referral code from URL:', cleaned);
    return cleaned;
  }
  return localStorage.getItem(REFERRED_BY_KEY);
};

export const getSavedReferredBy = (): string | null => {
  return localStorage.getItem(REFERRED_BY_KEY);
};

/**
 * Process ₹100 Coin bonus when a referred user adds cash (recharges)
 */
export const processReferralRewardOnRecharge = async (
  newUserPhoneOrId: string,
  rechargeAmount: number,
  onBonusCredited?: (bonusAmount: number, referrer: string) => void
): Promise<{ success: boolean; bonusAmount: number; referrer?: string }> => {
  const referrer = getSavedReferredBy();
  if (!referrer) return { success: false, bonusAmount: 0 };

  const paidKey = `sunosakhi_ref_paid_${newUserPhoneOrId}_${referrer}`;
  if (localStorage.getItem(paidKey) === 'true') {
    return { success: false, bonusAmount: 0 }; // Already rewarded
  }

  console.log(`🎁 Processing ₹${REFERRAL_BONUS_COINS} referral bonus for referrer ${referrer} from ${newUserPhoneOrId} cash add ₹${rechargeAmount}`);

  // Cloud Firestore Sync
  if (isFirebaseConfigured() && db) {
    try {
      const refDocRef = doc(db, REFERRALS_COLLECTION, `${referrer}_${newUserPhoneOrId}`);
      const snap = await getDoc(refDocRef);
      if (!snap.exists() || !snap.data()?.rewardClaimed) {
        // Record referral bonus in Firestore
        await setDoc(refDocRef, {
          referrer,
          referredUser: newUserPhoneOrId,
          rewardAmount: REFERRAL_BONUS_COINS,
          rechargeAmount,
          rewardClaimed: true,
          timestamp: Date.now()
        }, { merge: true });

        // Credit coins to referrer wallet in Firestore
        const referrerWalletRef = doc(db, WALLET_COLLECTION, referrer);
        const wSnap = await getDoc(referrerWalletRef);
        const prevBal = wSnap.exists() ? (wSnap.data()?.balance || 0) : 0;
        await setDoc(referrerWalletRef, {
          balance: prevBal + REFERRAL_BONUS_COINS,
          updatedAt: Date.now()
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Error syncing referral to Firestore:', err);
    }
  }

  // Mark locally as paid
  localStorage.setItem(paidKey, 'true');

  // Also if the referrer is the local machine (self-test)
  const myCode = getMyReferralCode();
  if (myCode === referrer) {
    const rawBal = localStorage.getItem('sunosakhi_wallet_balance');
    const current = rawBal ? parseFloat(rawBal) : 100;
    const newBal = current + REFERRAL_BONUS_COINS;
    localStorage.setItem('sunosakhi_wallet_balance', newBal.toString());
  }

  if (onBonusCredited) {
    onBonusCredited(REFERRAL_BONUS_COINS, referrer);
  }

  return { success: true, bonusAmount: REFERRAL_BONUS_COINS, referrer };
};
