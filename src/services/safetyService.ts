import { isFirebaseConfigured, db } from './firebase';
import { doc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { toggleUserBlock, toggleHostBlock } from './adminSync';

const NUDITY_REPORTS_KEY = 'sunosakhi_nudity_reports';
const BANNED_PHONES_KEY = 'sunosakhi_banned_phones';
const NUDITY_COLLECTION = 'nudity_reports';

export interface NudityReport {
  id: string;
  reportedByRole: 'host' | 'caller';
  reporterPhone: string;
  reporterName: string;
  offenderPhone: string;
  offenderName: string;
  offenderRole: 'host' | 'caller';
  offenderId?: string;
  reason: string;
  callType: 'video' | 'voice';
  timestamp: number;
  status: 'banned' | 'under_review' | 'resolved';
}

export const getLocalNudityReports = (): NudityReport[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NUDITY_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalNudityReport = (report: NudityReport): void => {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalNudityReports();
    const updated = [report, ...existing.filter((r) => r.id !== report.id)];
    localStorage.setItem(NUDITY_REPORTS_KEY, JSON.stringify(updated));
  } catch {}
};

export const isPhoneBanned = (phone: string): boolean => {
  if (!phone || typeof window === 'undefined') return false;
  const clean = String(phone).replace(/\D/g, '');
  const digits = clean.length === 12 && clean.startsWith('91') ? clean.slice(2) : clean;
  try {
    const raw = localStorage.getItem(BANNED_PHONES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.includes(digits);
  } catch {
    return false;
  }
};

export const banPhoneNumber = (phone: string): void => {
  if (!phone || typeof window === 'undefined') return;
  const clean = String(phone).replace(/\D/g, '');
  const digits = clean.length === 12 && clean.startsWith('91') ? clean.slice(2) : clean;
  try {
    const raw = localStorage.getItem(BANNED_PHONES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(digits)) {
      list.push(digits);
      localStorage.setItem(BANNED_PHONES_KEY, JSON.stringify(list));
    }
  } catch {}
};

export const unbanPhoneNumber = (phone: string): void => {
  if (!phone || typeof window === 'undefined') return;
  const clean = String(phone).replace(/\D/g, '');
  const digits = clean.length === 12 && clean.startsWith('91') ? clean.slice(2) : clean;
  try {
    const raw = localStorage.getItem(BANNED_PHONES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const updated = list.filter((p) => p !== digits);
    localStorage.setItem(BANNED_PHONES_KEY, JSON.stringify(updated));
  } catch {}
};

export const getBannedPhoneNumbers = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BANNED_PHONES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Submit Nudity Report & Instantly Ban Offender
 */
export const submitNudityReport = async (params: {
  reportedByRole: 'host' | 'caller';
  reporterPhone: string;
  reporterName: string;
  offenderPhone: string;
  offenderName: string;
  offenderRole: 'host' | 'caller';
  offenderId?: string;
  reason: string;
  callType?: 'video' | 'voice';
}): Promise<{ success: boolean; report: NudityReport }> => {
  const reportId = 'rep-nudity-' + Date.now();
  const report: NudityReport = {
    id: reportId,
    reportedByRole: params.reportedByRole,
    reporterPhone: params.reporterPhone,
    reporterName: params.reporterName,
    offenderPhone: params.offenderPhone,
    offenderName: params.offenderName,
    offenderRole: params.offenderRole,
    offenderId: params.offenderId,
    reason: params.reason || 'Nudity & Inappropriate Visual Exposure',
    callType: params.callType || 'video',
    timestamp: Date.now(),
    status: 'banned'
  };

  // 1. Save report locally
  saveLocalNudityReport(report);

  // 2. Add offender phone to banned blacklist
  if (params.offenderPhone) {
    banPhoneNumber(params.offenderPhone);
  }

  // 3. Mark user or host as blocked in accounts registry
  if (params.offenderRole === 'caller' && params.offenderPhone) {
    await toggleUserBlock(params.offenderPhone, true);
  } else if (params.offenderRole === 'host' && params.offenderId) {
    await toggleHostBlock(params.offenderId, true);
  }

  // 4. Save to Cloud Firestore if connected
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, NUDITY_COLLECTION, reportId), report);
    } catch (err) {
      console.warn('Could not save nudity report to firestore:', err);
    }
  }

  return { success: true, report };
};

const BLOCKED_USERS_KEY = 'sunosakhi_blocked_users';
const SAFETY_REPORTS_COLLECTION = 'safety_reports';

export const getBlockedUsers = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BLOCKED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const isUserBlocked = (targetId?: string | null): boolean => {
  if (!targetId) return false;
  const cleanId = String(targetId).trim();
  if (!cleanId) return false;
  const list = getBlockedUsers();
  if (list.includes(cleanId)) return true;
  const digits = cleanId.replace(/\D/g, '').slice(-10);
  if (digits.length === 10 && list.some((item) => item.replace(/\D/g, '').slice(-10) === digits)) {
    return true;
  }
  return false;
};

export const blockUser = (targetId: string): void => {
  if (!targetId || typeof window === 'undefined') return;
  const cleanId = String(targetId).trim();
  if (!cleanId) return;
  try {
    const list = getBlockedUsers();
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(list));
    }
  } catch {}
};

export const unblockUser = (targetId: string): void => {
  if (!targetId || typeof window === 'undefined') return;
  const cleanId = String(targetId).trim();
  const digits = cleanId.replace(/\D/g, '').slice(-10);
  try {
    const list = getBlockedUsers();
    const updated = list.filter((item) => {
      if (item === cleanId) return false;
      if (digits.length === 10 && item.replace(/\D/g, '').slice(-10) === digits) return false;
      return true;
    });
    localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(updated));
  } catch {}
};

export const submitSafetyReport = async (params: {
  targetId: string;
  targetName: string;
  reason: string;
  reporterId?: string;
  reporterPhone?: string;
}): Promise<{ success: boolean }> => {
  const reportId = 'rep-safety-' + Date.now();
  const payload = {
    id: reportId,
    targetId: params.targetId,
    targetName: params.targetName,
    reason: params.reason,
    reporterPhone: params.reporterPhone || params.reporterId || 'anonymous',
    timestamp: Date.now(),
    status: 'under_review'
  };

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, SAFETY_REPORTS_COLLECTION, reportId), payload);
    } catch (err) {
      console.warn('Could not save safety report to firestore:', err);
    }
  }

  return { success: true };
};

