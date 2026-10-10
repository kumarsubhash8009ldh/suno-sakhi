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
 * Resolve Caller's Name & Profile Photo (Avatar) from local storage or Cloud Firestore
 */
export const resolveCallerProfileInfo = async (
  userIdOrPhone: string,
  explicitPhone?: string,
  fallbackName?: string,
  fallbackAvatar?: string
): Promise<{ callerId: string; callerName: string; callerAvatar: string; callerPhone: string }> => {
  const cleanPhone = String(explicitPhone || userIdOrPhone || '').replace(/\D/g, '').slice(-10);
  let callerName = fallbackName && fallbackName !== 'Caller User' ? fallbackName : '';
  let callerAvatar = fallbackAvatar || '';

  // 1. Check current logged-in user and local user registry
  if (typeof window !== 'undefined') {
    try {
      const rawCurrent = localStorage.getItem('sunosakhi_current_user');
      if (rawCurrent) {
        const cur = JSON.parse(rawCurrent);
        const curPhone = String(cur.phone || cur.id || '').replace(/\D/g, '').slice(-10);
        if (
          cur.id === userIdOrPhone ||
          (cleanPhone && curPhone === cleanPhone)
        ) {
          if (!callerName && cur.name) callerName = cur.name;
          if (!callerAvatar && cur.avatar) callerAvatar = cur.avatar;
        }
      }

      const rawUsers = localStorage.getItem('sunosakhi_registered_users');
      if (rawUsers) {
        const usersMap = JSON.parse(rawUsers);
        if (cleanPhone && usersMap[cleanPhone]) {
          if (!callerName && usersMap[cleanPhone].name) callerName = usersMap[cleanPhone].name;
          if (!callerAvatar && usersMap[cleanPhone].avatar) callerAvatar = usersMap[cleanPhone].avatar;
        }
        for (const u of Object.values(usersMap) as any[]) {
          if (
            u &&
            (u.id === userIdOrPhone || (cleanPhone && String(u.phone || '').slice(-10) === cleanPhone))
          ) {
            if (!callerName && u.name) callerName = u.name;
            if (!callerAvatar && u.avatar) callerAvatar = u.avatar;
          }
        }
      }
    } catch {}
  }

  // 2. Check Cloud Firestore user_accounts collection
  if ((!callerName || !callerAvatar) && isFirebaseConfigured() && db) {
    try {
      const docCandidates = Array.from(
        new Set([cleanPhone, userIdOrPhone, cleanPhone ? `caller-${cleanPhone}` : ''].filter(Boolean))
      );
      for (const key of docCandidates) {
        const uSnap = await getDoc(doc(db, USER_ACCOUNTS_COLLECTION, key));
        if (uSnap.exists()) {
          const d = uSnap.data() as any;
          if (!callerName && d?.name) callerName = d.name;
          if (!callerAvatar && d?.avatar) callerAvatar = d.avatar;
          break;
        }
      }
    } catch {}
  }

  const finalId = cleanPhone ? `caller-${cleanPhone}` : userIdOrPhone || `caller_${Date.now()}`;
  const finalName = callerName || (cleanPhone ? `Caller (${cleanPhone.slice(0, 2)}****${cleanPhone.slice(-2)})` : 'Caller');
  const finalAvatar =
    callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80';

  return {
    callerId: finalId,
    callerName: finalName,
    callerAvatar: finalAvatar,
    callerPhone: cleanPhone
  };
};

/**
 * Record when a user joins or links using a Host's Reference ID
 * Saves caller's Name & Profile Photo on the Host's `referredCallers` list and user's `referredBy`
 */
export const registerReferralJoin = async (
  newUserPhoneOrId: string,
  referrerCode: string,
  callerName?: string,
  callerAvatar?: string
): Promise<void> => {
  const cleanedRef = saveReferredBy(referrerCode);
  if (!cleanedRef) return;

  const refPhone = cleanedRef.replace(/\D/g, '').slice(-10);
  const newUserPhone = String(newUserPhoneOrId || '').replace(/\D/g, '').slice(-10);
  if (refPhone && newUserPhone && refPhone === newUserPhone) return; // Prevent self-referral

  const callerInfo = await resolveCallerProfileInfo(newUserPhoneOrId, newUserPhone, callerName, callerAvatar);

  // Also update local user registry with referredBy
  if (typeof window !== 'undefined' && newUserPhone) {
    try {
      const rawUsers = localStorage.getItem('sunosakhi_registered_users');
      const usersMap = rawUsers ? JSON.parse(rawUsers) : {};
      if (usersMap[newUserPhone]) {
        usersMap[newUserPhone].referredBy = cleanedRef;
        localStorage.setItem('sunosakhi_registered_users', JSON.stringify(usersMap));
      }
      const rawCur = localStorage.getItem('sunosakhi_current_user');
      if (rawCur) {
        const cur = JSON.parse(rawCur);
        if (String(cur.phone || '').slice(-10) === newUserPhone) {
          cur.referredBy = cleanedRef;
          localStorage.setItem('sunosakhi_current_user', JSON.stringify(cur));
        }
      }
    } catch {}
  }

  if (isFirebaseConfigured() && db) {
    try {
      // Save referredBy on user_accounts document so future recharges know the referrer
      if (newUserPhone) {
        await setDoc(
          doc(db, USER_ACCOUNTS_COLLECTION, newUserPhone),
          { referredBy: cleanedRef },
          { merge: true }
        );
      }

      const candidates = [
        refPhone.length === 10 ? `sakhi-user-${refPhone}` : '',
        refPhone.length === 10 ? `host_${refPhone}` : '',
        refPhone.length === 10 ? refPhone : '',
        cleanedRef.toLowerCase(),
        cleanedRef
      ].filter(Boolean);

      let matchedHostId: string | null = null;
      let hostData: any = null;

      for (const candidateId of candidates) {
        const hostRef = doc(db, HOSTS_COLLECTION, candidateId);
        const snap = await getDoc(hostRef);
        if (snap.exists()) {
          matchedHostId = candidateId;
          hostData = snap.data();
          break;
        }
      }

      if (!matchedHostId && refPhone.length === 10) {
        const allHostsSnap = await getDocs(collection(db, HOSTS_COLLECTION));
        allHostsSnap.forEach((docSnap) => {
          if (matchedHostId) return;
          const d = docSnap.data() as any;
          const dPhone = String(d.phone || d.id || docSnap.id || '').replace(/\D/g, '').slice(-10);
          if (dPhone === refPhone) {
            matchedHostId = docSnap.id;
            hostData = d;
          }
        });
      }

      if (matchedHostId && hostData) {
        const hostRef = doc(db, HOSTS_COLLECTION, matchedHostId);
        const existingList = Array.isArray(hostData.referredCallers) ? [...hostData.referredCallers] : [];
        const existingIdx = existingList.findIndex(
          (rc: any) =>
            rc.callerId === callerInfo.callerId ||
            (callerInfo.callerPhone &&
              String(rc.callerPhone || rc.callerId || '').replace(/\D/g, '').slice(-10) === callerInfo.callerPhone)
        );
        if (existingIdx >= 0) {
          existingList[existingIdx] = {
            ...existingList[existingIdx],
            callerName: callerInfo.callerName || existingList[existingIdx].callerName,
            callerAvatar: callerInfo.callerAvatar || existingList[existingIdx].callerAvatar
          };
        } else {
          existingList.unshift({
            callerId: callerInfo.callerId,
            callerName: callerInfo.callerName,
            callerPhone: callerInfo.callerPhone,
            callerAvatar: callerInfo.callerAvatar,
            joinedAt: Date.now(),
            totalRechargeAmount: 0,
            totalCommissionEarned: 0,
            rechargeCount: 0
          });
        }

        await setDoc(
          hostRef,
          {
            referralCount: existingList.length,
            referredCallers: existingList,
            lastActiveAt: Date.now()
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Could not register referral join in Firestore:', err);
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
 * Process 1% Host Referral / Invite Commission whenever a referred caller adds payment (recharges)!
 * Credits 1% of `rechargeAmount` directly to the referring Host's `referralIncome`, `netIncome`,
 * `pendingPayout`, `referredCallers`, and `incomeHistory` passbook (with Caller's Name & Profile Photo).
 */
export const processReferralRewardOnRecharge = async (
  newUserPhoneOrId: string,
  rechargeAmount: number,
  onBonusCredited?: (bonusAmount: number, referrer: string) => void,
  explicitUserPhone?: string,
  callerMeta?: {
    callerName?: string;
    callerAvatar?: string;
    explicitReferrer?: string;
    utrOrTxId?: string;
  }
): Promise<{ success: boolean; bonusAmount: number; referrer?: string }> => {
  if (!rechargeAmount || rechargeAmount <= 0) {
    return { success: false, bonusAmount: 0 };
  }

  // Deduplicate by UTR / Transaction ID if provided so the same payment is never credited twice
  if (callerMeta?.utrOrTxId && typeof window !== 'undefined') {
    const dedupKey = `sunosakhi_ref_comm_paid_${callerMeta.utrOrTxId}`;
    if (localStorage.getItem(dedupKey) === 'true') {
      return { success: false, bonusAmount: 0 };
    }
  }

  const referrer =
    (callerMeta?.explicitReferrer && callerMeta.explicitReferrer.trim().toUpperCase()) ||
    (await resolveUserReferrer(newUserPhoneOrId, explicitUserPhone));
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

  // Resolve Caller's Name & Profile Photo (Avatar)
  const callerInfo = await resolveCallerProfileInfo(
    newUserPhoneOrId,
    cleanUserPhone,
    callerMeta?.callerName,
    callerMeta?.callerAvatar
  );

  const targetHostId =
    refPhone.length === 10
      ? `sakhi-user-${refPhone}`
      : referrer.replace(/^SAKHI[-_]?/i, '') || referrer;

  const incomeRecord: HostIncomeRecord = {
    id: `inc_ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'referral',
    description: `🤝 1% Refer Bonus: ${callerInfo.callerName} added ₹${rechargeAmount}`,
    grossAmount: rechargeAmount,
    hostSharePercent: HOST_REFERRAL_COMMISSION_PERCENT,
    hostEarned: hostCommission,
    timestamp: Date.now(),
    details: `Caller: ${callerInfo.callerName} • Ref ID: ${referrer} • 1% Commission on ₹${rechargeAmount}`,
    callerId: callerInfo.callerId,
    callerName: callerInfo.callerName,
    callerAvatar: callerInfo.callerAvatar,
    callerPhone: callerInfo.callerPhone
  };

  console.log(
    `🎁 Crediting 1% Host Referral Commission (₹${hostCommission}) to Host ${targetHostId} (Ref: ${referrer}) from Caller ${callerInfo.callerName} recharge of ₹${rechargeAmount}`
  );

  // Mark UTR / Transaction ID as credited locally
  if (callerMeta?.utrOrTxId && typeof window !== 'undefined') {
    localStorage.setItem(`sunosakhi_ref_comm_paid_${callerMeta.utrOrTxId}`, 'true');
  }

  // 1. Credit Host Income, Referred Callers Profile & Passbook in Cloud Firestore + LocalStorage
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
        referredUser: callerInfo.callerId,
        referredUserName: callerInfo.callerName,
        referredUserAvatar: callerInfo.callerAvatar,
        referredUserPhone: callerInfo.callerPhone,
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

