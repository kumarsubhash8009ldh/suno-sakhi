import { HostProfile, HostIncomeRecord, Sakhi } from '../types';
import { getApiBaseUrl } from './apiConfig';

/**
 * Real-time subscription to ALL registered real hosts from Server Backend.
 * Zero dummy accounts: Only hosts registered are included.
 */
export const subscribeToAllRealHosts = (
  onUpdate: (hosts: Sakhi[]) => void
): (() => void) => {
  const baseUrl = getApiBaseUrl();

const deduplicateHosts = (hosts: Sakhi[]): Sakhi[] => {
  const map = new Map<string, Sakhi>();
  for (const h of hosts) {
    if (!h) continue;
    const p = h.phone ? String(h.phone).replace(/\D/g, '') : '';
    const em = h.email ? String(h.email).trim().toLowerCase() : '';
    const key = p ? `p_${p}` : em ? `e_${em}` : `id_${h.id}`;
    if (!map.has(key)) {
      map.set(key, h);
    }
  }
  return Array.from(map.values());
};

  // 1. Initial check from localStorage cache (purging any legacy dummy hosts)
  try {
    const local = localStorage.getItem('sunosakhi_registered_hosts');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(
          (h: any) =>
            h &&
            h.id &&
            ((h.phone && String(h.phone).replace(/\D/g, '').length >= 10) || h.email) &&
            h.name &&
            h.name.trim() !== '' &&
            h.name !== 'Sakhi Host' &&
            !h.id.startsWith('host_priya') &&
            !h.id.startsWith('host_ananya') &&
            !h.id.startsWith('real_sakhi_') &&
            h.id !== 'aarohi-1' &&
            h.name !== 'Priya Sharma' &&
            h.name !== 'Ananya Verma'
        );
        const unique = deduplicateHosts(clean);
        localStorage.setItem('sunosakhi_registered_hosts', JSON.stringify(unique));
        onUpdate(unique);
      }
    }
  } catch {}

  let lastHostsJson = '';

  const fetchHosts = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/hosts`);
      const data = await res.json();
      if (data.success && Array.isArray(data.hosts)) {
        const unique = deduplicateHosts(data.hosts);
        const json = JSON.stringify(unique);
        if (json !== lastHostsJson) {
          lastHostsJson = json;
          localStorage.setItem('sunosakhi_registered_hosts', json);
          onUpdate(unique);
        }
      }
    } catch (err) {}
  };

  fetchHosts();
  const intervalId = window.setInterval(fetchHosts, 1200);

  return () => {
    clearInterval(intervalId);
  };
};

/**
 * Update Host Online/Offline availability
 */
export const updateHostOnlineStatus = async (
  hostId: string,
  status: 'online' | 'busy' | 'offline'
): Promise<boolean> => {
  const baseUrl = getApiBaseUrl();
  try {
    await fetch(`${baseUrl}/api/hosts/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId, status })
    });
    return true;
  } catch (err) {
    console.warn('Failed to update host status:', err);
    return false;
  }
};

/**
 * Subscribe to real-time single host profile updates & live commission updates (sath k sath).
 */
export const subscribeToHostProfile = (
  hostId: string,
  onUpdate: (profile: Partial<HostProfile>) => void,
  hostPhone?: string
): (() => void) => {
  const baseUrl = getApiBaseUrl();

  const fetchProfile = async () => {
    try {
      const cleanPhone = hostPhone ? hostPhone.replace(/\D/g, '') : '';
      const res = await fetch(`${baseUrl}/api/hosts/profile?hostId=${encodeURIComponent(hostId)}&phone=${encodeURIComponent(cleanPhone)}`);
      const data = await res.json();
      if (data.success && data.host) {
        onUpdate(data.host);
        return;
      }
    } catch (err) {}

    // Fallback: search in /api/hosts
    try {
      const res = await fetch(`${baseUrl}/api/hosts`);
      const data = await res.json();
      if (data.success && Array.isArray(data.hosts)) {
        const cleanPhone = hostPhone ? hostPhone.replace(/\D/g, '') : '';
        const found = data.hosts.find((h: any) => h.id === hostId || (cleanPhone && h.phone && String(h.phone).replace(/\D/g, '') === cleanPhone));
        if (found) onUpdate(found);
      }
    } catch (err) {}
  };

  fetchProfile();
  const intervalId = window.setInterval(fetchProfile, 2000);

  return () => {
    clearInterval(intervalId);
  };
};

/**
 * Save complete host profile to Server Backend.
 */
export const saveHostProfileToCloud = async (
  profile: HostProfile
): Promise<boolean> => {
  // STRICT: Do NOT save default or unverified host profiles (Zero dummy accounts)
  if (
    !profile.id ||
    !profile.phone ||
    profile.phone.replace(/\D/g, '').length < 10 ||
    !profile.name ||
    profile.name === 'Sakhi Host' ||
    profile.name.toLowerCase().startsWith('caller')
  ) {
    return false;
  }

  const baseUrl = getApiBaseUrl();
  const sakhiObj: Sakhi = {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    city: profile.city,
    avatar: profile.avatar,
    videoPoster: profile.videoPoster || profile.avatar,
    status: profile.status || 'online',
    rating: profile.rating || 5.0,
    totalCalls: profile.incomeHistory?.length || 0,
    languages: profile.languages,
    bio: profile.bio,
    interests: ['Friendly Chat', 'Life Talk'],
    voiceRatePerMin: 5,
    videoRatePerMin: 10,
    tagline: profile.tagline,
    audioSnippet: profile.audioSnippet || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    phone: profile.phone
  };

  // Update local cache
  try {
    const localHosts = localStorage.getItem('sunosakhi_registered_hosts');
    const list: Sakhi[] = localHosts ? JSON.parse(localHosts) : [];
    const idx = list.findIndex((h) => h.id === profile.id || (profile.phone && h.phone === profile.phone));
    if (idx >= 0) {
      list[idx] = sakhiObj;
    } else {
      list.push(sakhiObj);
    }
    localStorage.setItem('sunosakhi_registered_hosts', JSON.stringify(list));
  } catch (err) {}

  // Post to server
  try {
    await fetch(`${baseUrl}/api/hosts/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sakhiObj)
    });
    return true;
  } catch (err) {
    console.warn('Failed to save host profile to server:', err);
    return false;
  }
};

/**
 * Record host earnings record to Server Cloud (sath k sath live update).
 */
export const recordHostIncomeToCloud = async (
  hostId: string,
  incomeRecord: HostIncomeRecord,
  updatedEarnings?: { grossRevenue: number; netIncome: number; pendingPayout: number },
  extra?: { hostPhone?: string; durationSec?: number; callType?: string }
): Promise<boolean> => {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/hosts/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId,
        hostPhone: extra?.hostPhone,
        incomeRecord,
        updatedEarnings,
        durationSec: extra?.durationSec,
        callType: extra?.callType
      })
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.warn('Failed to record host income to server:', err);
    return false;
  }
};
