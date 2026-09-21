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
