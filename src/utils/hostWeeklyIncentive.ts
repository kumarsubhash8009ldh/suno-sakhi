import { HostProfile } from '../types';

export const WEEKLY_TARGET_HOURS = 20; // 20 hours target
export const WEEKLY_TARGET_MINUTES = WEEKLY_TARGET_HOURS * 60; // 1,200 minutes
export const WEEKLY_INCENTIVE_AMOUNT = 200; // ₹200 cash incentive bonus

export interface WeeklyCallIncentiveStats {
  weekKey: string;
  weekLabel: string;
  totalMinutes: number;
  totalHours: number;
  targetHours: number;
  targetMinutes: number;
  bonusAmount: number;
  progressPercent: number;
  isEligible: boolean;
  isClaimed: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
}

/**
 * Returns ISO week key (e.g. 2026-W38)
 */
export const getCurrentWeekKey = (date = new Date()): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

/**
 * Returns start timestamp of Monday 00:00:00 for current week
 */
export const getStartOfWeekTimestamp = (date = new Date()): number => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Calculates current week's total call minutes, progress toward 20hr target, and claim status.
 */
export const calculateWeeklyCallStats = (profile: HostProfile): WeeklyCallIncentiveStats => {
  const weekKey = getCurrentWeekKey();
  const startOfWeek = getStartOfWeekTimestamp();

  // 1. Calculate call minutes recorded in the current week from incomeHistory
  const weeklyCallRecords = (profile.incomeHistory || []).filter(
    (item) => item.type === 'call' && item.timestamp >= startOfWeek
  );

  let minutesFromHistory = 0;
  weeklyCallRecords.forEach((item) => {
    if (typeof item.durationMinutes === 'number' && item.durationMinutes > 0) {
      minutesFromHistory += item.durationMinutes;
    } else {
      // Extract from description if present e.g. "Voice Call (15 min)"
      const match = item.description?.match(/\((\d+)\s*min\)/i);
      if (match && match[1]) {
        minutesFromHistory += parseInt(match[1], 10);
      } else {
        minutesFromHistory += 1;
      }
    }
  });

  // If host has total call time on profile but fewer timestamped items in this week's history,
  // we ensure cumulative total minutes are accounted for fairly:
  const totalProfileMinutes = (profile.totalVoiceMinutes || 0) + (profile.totalVideoMinutes || 0);
  const totalMinutes = Math.max(minutesFromHistory, totalProfileMinutes);
  const totalHours = parseFloat((totalMinutes / 60).toFixed(1));

  const isEligible = totalMinutes >= WEEKLY_TARGET_MINUTES;
  const progressPercent = Math.min(100, Math.round((totalMinutes / WEEKLY_TARGET_MINUTES) * 100));
  const minutesRemaining = Math.max(0, WEEKLY_TARGET_MINUTES - totalMinutes);
  const hoursRemaining = parseFloat((minutesRemaining / 60).toFixed(1));

  // Check if incentive was already claimed for this week
  const isClaimed = (profile.incomeHistory || []).some(
    (item) =>
      item.type === 'incentive' &&
      (item.id === `inc-weekly-20hr-${weekKey}` ||
        item.details === weekKey ||
        item.description?.includes(weekKey))
  );

  return {
    weekKey,
    weekLabel: `Week ${weekKey.split('-W')[1]} (${new Date(startOfWeek).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - Sun)`,
    totalMinutes,
    totalHours,
    targetHours: WEEKLY_TARGET_HOURS,
    targetMinutes: WEEKLY_TARGET_MINUTES,
    bonusAmount: WEEKLY_INCENTIVE_AMOUNT,
    progressPercent,
    isEligible,
    isClaimed,
    hoursRemaining,
    minutesRemaining
  };
};
