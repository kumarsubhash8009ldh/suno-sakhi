import { RecentCallLog, CallType } from '../types';

const RECENT_CALLS_STORAGE_KEY = 'sunosakhi_recent_calls';

export const getRecentCalls = (): RecentCallLog[] => {
  try {
    const raw = localStorage.getItem(RECENT_CALLS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out any legacy demo calls (zero dummy accounts/logs)
    const realCalls = parsed.filter(
      (c: any) => c && c.id && !c.id.startsWith('rc_demo_') && c.sakhiId !== 'aarohi-1' && c.sakhiId !== 'priya-2' && c.sakhiId !== 'simran-3'
    );
    return realCalls;
  } catch {
    return [];
  }
};

export const saveCallLog = (log: Omit<RecentCallLog, 'id'>): RecentCallLog => {
  const newLog: RecentCallLog = {
    ...log,
    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  };

  try {
    const existing = getRecentCalls();
    const updated = [newLog, ...existing].slice(0, 50); // Keep last 50 calls
    localStorage.setItem(RECENT_CALLS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving recent call log:', err);
  }

  return newLog;
};

export const clearRecentCalls = (): void => {
  localStorage.setItem(RECENT_CALLS_STORAGE_KEY, JSON.stringify([]));
};
