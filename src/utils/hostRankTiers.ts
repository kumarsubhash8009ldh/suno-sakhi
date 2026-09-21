export interface HostRankTier {
  rank: number;
  title: string;
  minStars: number;
  maxStars: number;
  voiceEarningPerMin: number;
  videoEarningPerMin: number;
  chatEarningPerMsg: number;
  badge: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export const HOST_RANK_TIERS: HostRankTier[] = [
  {
    rank: 1,
    title: 'Top Star Sakhi',
    minStars: 3.0,
    maxStars: 5.0,
    voiceEarningPerMin: 3.0,
    videoEarningPerMin: 7.0,
    chatEarningPerMsg: 1.5,
    badge: '🥇 Rank 1',
    colorClass: 'text-amber-300',
    bgClass: 'bg-amber-500/20',
    borderClass: 'border-amber-500/40'
  },
  {
    rank: 2,
    title: 'Rising Star Sakhi',
    minStars: 2.0,
    maxStars: 2.99,
    voiceEarningPerMin: 2.0,
    videoEarningPerMin: 5.0,
    chatEarningPerMsg: 1.5,
    badge: '🥈 Rank 2',
    colorClass: 'text-slate-300',
    bgClass: 'bg-slate-500/20',
    borderClass: 'border-slate-400/40'
  },
  {
    rank: 3,
    title: 'Starter Sakhi',
    minStars: 1.0,
    maxStars: 1.99,
    voiceEarningPerMin: 1.5,
    videoEarningPerMin: 3.5,
    chatEarningPerMsg: 1.5,
    badge: '🥉 Rank 3',
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-700/20',
    borderClass: 'border-amber-700/40'
  }
];

export function getHostRankTier(rating: number = 5.0): HostRankTier {
  const score = typeof rating === 'number' && !isNaN(rating) ? rating : 5.0;
  if (score >= 3.0) return HOST_RANK_TIERS[0];
  if (score >= 2.0) return HOST_RANK_TIERS[1];
  return HOST_RANK_TIERS[2];
}
