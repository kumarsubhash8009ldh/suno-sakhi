import { doc, getDoc, getDocs, setDoc, collection } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { HostIncomeRecord } from '../types';
import { recordHostIncomeToCloud } from './hostSync';

const REF_STORAGE_KEY = 'sunosakhi_my_referral_code';
const REFERRED_BY_KEY = 'sunosakhi_referred_by_code';
const REFERRALS_COLLECTION = 'referrals';
const USER_ACCOUNTS_COLLECTION = 'user_accounts';
const HOSTS_COLLECTION = 'hosts';

export const REFERRAL_BONUS_COINS = 50;
export const HOST_REFERRAL_COMMISSION_PERCENT = 1; // 1% Host Invite / Recharge Bonus

/**
 * Generate or get user's persistent referral code
 */
export const getMyReferralCode = (userIdOrPhone?: string): string => {
  const cleanPhone = String(userIdOrPhone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length === 10) {
    return `SAKHI-${cleanPhone}`;
  }
  let saved = localStorage.getItem(REF_STORAGE_KEY);
  if (!saved) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    saved = 'SAKHI' + rand;
    localStorage.setItem(REF_STORAGE_KEY, saved);
  }
  return saved;
};

/**
 * Generate canonical Host Reference ID (e.g. SAKHI-9876543210)
 */
export const getHostReferenceId = (hostId?: string, hostPhone?: string): string => {
  const cleanPhone = String(hostPhone || hostId || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length === 10) {
    return `SAKHI-${cleanPhone}`;
  }
  if (hostId && hostId.trim()) {
    const cleanId = hostId.trim().toUpperCase().replace(/^SAKHI[-_]?/, '');
    return `SAKHI-${cleanId}`;
  }
  return getMyReferralCode();
};

/**
 * Generate shareable link
 */
export const getReferralShareUrl = (refCode: string): string => {
  const base =
    typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://suno-sakhi-63040.web.app';
  return `${base.replace(/\/$/, '')}/?ref=${encodeURIComponent(refCode)}`;
};

/**
 * Save referred-by code locally
 */
export const saveReferredBy = (code: string): string => {
  const cleaned = (code || '').trim().toUpperCase();
  if (typeof window !== 'undefined' && cleaned) {
    localStorage.setItem(REFERRED_BY_KEY, cleaned);
    localStorage.setItem('sunosakhi_referred_by', cleaned);
  }
  return cleaned;
};

/**
 * Check and save URL referral param (e.g. ?ref=SAKHI-9876543210)
 */
export const captureReferralFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') || params.get('refer') || params.get('invite');
  if (ref && ref.trim()) {
    const cleaned = saveReferredBy(ref);
    console.log('🎁 Captured Host/User Reference ID from URL:', cleaned);
    return cleaned;
  }
  return localStorage.getItem(REFERRED_BY_KEY) || localStorage.getItem('sunosakhi_referred_by');
};

export const getSavedReferredBy = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFERRED_BY_KEY) || localStorage.getItem('sunosakhi_referred_by');
};

/**
 * Record when a new user joins using a Host's Reference ID (increments Host's referralCount)
 */
export const registerReferralJoin = async (
  newUserPhoneOrId: string,
  referrerCode: string
): Promise<void> => {
  const cleanedRef = saveReferredBy(referrerCode);
  if (!cleanedRef) return;

  const refPhone = cleanedRef.replace(/\D/g, '').slice(-10);
  const newUserPhone = String(newUserPhoneOrId || '').replace(/\D/g, '').slice(-10);
  if (refPhone && newUserPhone && refPhone === newUserPhone) return; // Prevent self-referral

  if (isFirebaseConfigured() && db) {
    try {
      const candidates = [
        refPhone.length === 10 ? `sakhi-user-${refPhone}` : '',
        refPhone.length === 10 ? `host_${refPhone}` : '',
        refPhone.length === 10 ? refPhone : '',
        cleanedRef.toLowerCase(),
        cleanedRef
      ].filter(Boolean);

      for (const candidateId of candidates) {
        const hostRef = doc(db, HOSTS_COLLECTION, candidateId);
        const snap = await getDoc(hostRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          await setDoc(
            hostRef,
            {
              referralCount: (Number(data.referralCount) || 0) + 1,
              lastActiveAt: Date.now()
            },
            { merge: true }
          );
          break;
        }
      }
    } catch (err) {
      console.warn('Could not increment host referralCount:', err);
    }
  }
};

/**
 * Resolve which Host/Referrer referred a given user (checks LocalStorage + Firestore user_accounts)
 */
export const resolveUserReferrer = async (
  userIdOrPhone: string,
  explicitPhone?: string
): Promise<string | null> => {
  const cleanPhone = String(explicitPhone || userIdOrPhone || '').replace(/\D/g, '').slice(-10);

  // 1. Check local registered users registry
  if (typeof window !== 'undefined') {
    try {
      const rawUsers = localStorage.getItem('sunosakhi_registered_users');
      if (rawUsers) {
        const usersMap = JSON.parse(rawUsers);
        if (cleanPhone && usersMap[cleanPhone]?.referredBy) {
          return String(usersMap[cleanPhone].referredBy).trim().toUpperCase();
        }
        for (const u of Object.values(usersMap) as any[]) {
          if (
            u &&
            u.referredBy &&
            (u.id === userIdOrPhone || (cleanPhone && String(u.phone || '').slice(-10) === cleanPhone))
          ) {
            return String(u.referredBy).trim().toUpperCase();
          }
        }
      }
    } catch {}
  }

  // 2. Check Cloud Firestore user_accounts collection (essential when Admin approves a recharge)
  if (isFirebaseConfigured() && db) {
    try {
      const docCandidates = Array.from(
        new Set([cleanPhone, userIdOrPhone, cleanPhone ? `caller-${cleanPhone}` : ''].filter(Boolean))
      );
      for (const key of docCandidates) {
        const uSnap = await getDoc(doc(db, USER_ACCOUNTS_COLLECTION, key));
        if (uSnap.exists() && uSnap.data()?.referredBy) {
          return String(uSnap.data()?.referredBy).trim().toUpperCase();
        }
      }

      // Also check hosts collection in case a Host account recharged and had a referredBy code
      for (const key of docCandidates) {
        const hSnap = await getDoc(doc(db, HOSTS_COLLECTION, key));
        if (hSnap.exists() && hSnap.data()?.referredBy) {
          return String(hSnap.data()?.referredBy).trim().toUpperCase();
        }
      }
    } catch {}
  }

  // 3. Fallback to current browser's saved referral code if the current user is the one recharging
  const savedLocal = getSavedReferredBy();
  if (savedLocal) {
    return savedLocal.trim().toUpperCase();
  }

  return null;
};

/**
 * Process 1% Host Referral / Invite Commission whenever a referred user recharges their wallet!
 * Credits 1% of `rechargeAmount` directly to the referring Host's `referralIncome`, `netIncome`,
 * `pendingPayout`, and `incomeHistory` passbook in Cloud Firestore & LocalStorage.
 */
export const processReferralRewardOnRecharge = async (
  newUserPhoneOrId: string,
  rechargeAmount: number,
  onBonusCredited?: (bonusAmount: number, referrer: string) => void,
  explicitUserPhone?: string
): Promise<{ success: boolean; bonusAmount: number; referrer?: string }> => {
  if (!rechargeAmount || rechargeAmount <= 0) {
    return { success: false, bonusAmount: 0 };
  }

  const referrer = await resolveUserReferrer(newUserPhoneOrId, explicitUserPhone);
  if (!referrer) {
    return { success: false, bonusAmount: 0 };
  }

  // Calculate 1% Host Invite / Recharge Bonus
  const hostCommission = parseFloat(((rechargeAmount * HOST_REFERRAL_COMMISSION_PERCENT) / 100).toFixed(2));
  if (hostCommission <= 0) {
    return { success: false, bonusAmount: 0 };
  }

  const refPhone = referrer.replace(/\D/g, '').slice(-10);
  const cleanUserPhone = String(explicitUserPhone || newUserPhoneOrId || '').replace(/\D/g, '').slice(-10);

  // Prevent self-referral commission on the exact same phone number
  if (refPhone && cleanUserPhone && refPhone === cleanUserPhone) {
    return { success: false, bonusAmount: 0 };
  }

  const targetHostId =
    refPhone.length === 10
      ? `sakhi-user-${refPhone}`
      : referrer.replace(/^SAKHI[-_]?/i, '') || referrer;

  const maskedUser = cleanUserPhone
    ? `+91 ${cleanUserPhone.slice(0, 2)}******${cleanUserPhone.slice(-2)}`
    : newUserPhoneOrId;

  const incomeRecord: HostIncomeRecord = {
    id: `inc_ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'referral',
    description: `🤝 1% Refer Recharge Bonus (${maskedUser} Recharged ₹${rechargeAmount})`,
    grossAmount: rechargeAmount,
    hostSharePercent: HOST_REFERRAL_COMMISSION_PERCENT,
    hostEarned: hostCommission,
    timestamp: Date.now(),
    details: `Ref ID: ${referrer} • 1% Invite Bonus on ₹${rechargeAmount}`
  };

  console.log(
    `🎁 Crediting 1% Host Referral Commission (₹${hostCommission}) to Host ${targetHostId} (Ref: ${referrer}) for User ${newUserPhoneOrId} recharge of ₹${rechargeAmount}`
  );

  // 1. Credit Host Income & Passbook in Cloud Firestore + LocalStorage
  await recordHostIncomeToCloud(targetHostId, incomeRecord, undefined, {
    hostPhone: refPhone,
    callType: 'referral'
  });

  // 2. Save audit record in Firestore 'referrals' collection
  if (isFirebaseConfigured() && db) {
    try {
      const refLogId = `ref_comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, REFERRALS_COLLECTION, refLogId), {
        id: refLogId,
        referrer,
        targetHostId,
        hostPhone: refPhone,
        referredUser: newUserPhoneOrId,
        referredUserPhone: cleanUserPhone,
        rechargeAmount,
        commissionPercent: HOST_REFERRAL_COMMISSION_PERCENT,
        rewardAmount: hostCommission,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn('Error logging referral commission to Firestore:', err);
    }
  }

  if (onBonusCredited) {
    onBonusCredited(hostCommission, referrer);
  }

  return { success: true, bonusAmount: hostCommission, referrer };
};

