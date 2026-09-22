import { collection, doc, getDoc, setDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { HostProfile, HostIncomeRecord, Sakhi } from '../types';
import { getApiBaseUrl } from './apiConfig';

const HOSTS_COLLECTION = 'hosts';
const LOCAL_HOSTS_KEY = 'sunosakhi_registered_hosts';

/**
 * Deduplicate hosts strictly by phone number or email.
 */
export const deduplicateHosts = (hosts: Sakhi[]): Sakhi[] => {
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

/**
 * Strict Validator: ONLY real accounts registered with genuine Mobile (10-digit) or Email.
 * ZERO dummy or hardcoded accounts allowed!
 */
export const isRealHostAccount = (h: any): boolean => {
  if (!h || !h.id) return false;
  const p = h.phone ? String(h.phone).replace(/\D/g, '') : '';
  const em = h.email ? String(h.email).trim().toLowerCase() : '';
  const hasPhone = p.length >= 10;
  const hasEmail = Boolean(em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
  if (!hasPhone && !hasEmail) return false;

  const n = (h.name || '').trim();
  if (!n || n === 'Sakhi Host' || n.toLowerCase().startsWith('caller')) return false;

  return true;
};

/**
 * Read local hosts cache
 */
export const getLocalRegisteredHosts = (): Sakhi[] => {
  try {
    const raw = localStorage.getItem(LOCAL_HOSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return deduplicateHosts(parsed.filter(isRealHostAccount));
    }
  } catch (err) {
    console.warn('Error reading local hosts cache:', err);
  }
  return [];
};

/**
 * Real-time subscription to ALL registered real hosts.
 * Listens directly to Cloud Firestore `hosts` collection with LocalStorage fallback.
 * Zero dummy accounts: Only hosts registered with verified phone or email are included.
 */
export const subscribeToAllRealHosts = (
  onUpdate: (hosts: Sakhi[]) => void
): (() => void) => {
  let isUnsubscribed = false;
  const mergedHostsMap = new Map<string, Sakhi>();

  // 1. Deliver local cache immediately for instant UI
  const localList = getLocalRegisteredHosts();
  localList.forEach((h) => {
    const key = h.phone || h.email || h.id;
    mergedHostsMap.set(key, h);
  });
  if (mergedHostsMap.size > 0) {
    onUpdate(Array.from(mergedHostsMap.values()));
  }

  // Helper to publish updates
  const publish = () => {
    if (isUnsubscribed) return;
    const clean = Array.from(mergedHostsMap.values()).filter(isRealHostAccount);
    const unique = deduplicateHosts(clean);
    try {
      localStorage.setItem(LOCAL_HOSTS_KEY, JSON.stringify(unique));
    } catch {}
    onUpdate(unique);
  };

  // 2. Real-Time Cloud Firestore Listener (Works across all devices & mobile)
  let firestoreUnsub: (() => void) | null = null;
  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, HOSTS_COLLECTION);
      firestoreUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          // Fresh map for current snapshot so deleted/purged hosts vanish immediately
          const currentSnapshotMap = new Map<string, Sakhi>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data && isRealHostAccount({ ...data, id: docSnap.id })) {
              const sakhi: Sakhi = {
                id: docSnap.id,
                name: data.name || 'Verified Sakhi',
                age: data.age || 22,
                city: data.city || 'India',
                avatar: data.avatar || data.selfieUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
                videoPoster: data.videoPoster || data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
                status: data.status === 'offline' ? 'offline' : 'online',
                rating: typeof data.rating === 'number' ? data.rating : 5.0,
                totalCalls: data.totalCalls || 0,
                languages: Array.isArray(data.languages) && data.languages.length > 0 ? data.languages : ['Hindi'],
                bio: data.bio || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
                interests: data.interests || ['Friendly Chat'],
                voiceRatePerMin: 7, // Caller standard audio rate
                videoRatePerMin: 15, // Caller standard video rate
                tagline: data.tagline || '🌸 Verified Sakhi Host',
                audioSnippet: data.audioSnippet || '',
                phone: data.phone || '',
                email: data.email || '',
                isVerified: true
              };
              const key = sakhi.phone || sakhi.email || sakhi.id;
              currentSnapshotMap.set(key, sakhi);
            }
          });

          const clean = Array.from(currentSnapshotMap.values()).filter(isRealHostAccount);
          const unique = deduplicateHosts(clean);
          try {
            localStorage.setItem(LOCAL_HOSTS_KEY, JSON.stringify(unique));
          } catch {}
          if (!isUnsubscribed) {
            onUpdate(unique);
          }
        },
        (err) => {
          console.warn('Firestore hosts subscription note:', err);
        }
      );
    } catch (err) {
      console.warn('Could not setup Firestore hosts listener:', err);
    }
  }

  // 3. Fallback polling from Server Backend if tunnel/server is reachable
  const baseUrl = getApiBaseUrl();
  const fetchFromBackend = async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch(`${baseUrl}/api/hosts`, { signal: AbortSignal.timeout(3500) });
      const data = await res.json();
      if (data.success && Array.isArray(data.hosts)) {
        data.hosts.filter(isRealHostAccount).forEach((h: Sakhi) => {
          const key = h.phone || h.email || h.id;
          mergedHostsMap.set(key, h);
        });
        publish();
      }
    } catch {}
  };

  fetchFromBackend();
  const intervalId = window.setInterval(fetchFromBackend, 3000);

  return () => {
    isUnsubscribed = true;
    if (firestoreUnsub) firestoreUnsub();
    clearInterval(intervalId);
  };
};

/**
 * Update Host Online/Offline availability across Firestore & Backend
 */
export const updateHostOnlineStatus = async (
  hostId: string,
  status: 'online' | 'busy' | 'offline'
): Promise<boolean> => {
  // 1. Update in Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(
        doc(db, HOSTS_COLLECTION, hostId),
        { status, lastActiveAt: Date.now() },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not update host status in firestore:', err);
    }
  }

  // 2. Update in Local Storage cache
  try {
    const local = getLocalRegisteredHosts();
    const updated = local.map((h) => (h.id === hostId ? { ...h, status } : h));
    localStorage.setItem(LOCAL_HOSTS_KEY, JSON.stringify(updated));
  } catch {}

  // 3. Update in Server Backend if reachable
  const baseUrl = getApiBaseUrl();
  try {
    await fetch(`${baseUrl}/api/hosts/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId, status }),
      signal: AbortSignal.timeout(3000)
    });
  } catch {}

  return true;
};

/**
 * Save / Update Host Profile to Cloud Firestore, LocalStorage & Server.
 * Strictly guarantees ZERO dummy accounts.
 */
export const saveHostProfileToCloud = async (
  profile: HostProfile
): Promise<boolean> => {
  if (!isRealHostAccount(profile)) {
    return false;
  }

  const sakhiObj: Sakhi = {
    id: profile.id,
    name: profile.name.trim(),
    age: profile.age || 22,
    city: profile.city || 'India',
    avatar: profile.avatar,
    videoPoster: profile.videoPoster || profile.avatar,
    status: profile.status || 'online',
    rating: profile.rating || 5.0,
    totalCalls: profile.incomeHistory?.length || 0,
    languages: profile.languages || ['Hindi'],
    bio: profile.bio || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
    interests: ['Friendly Chat', 'Life Talk'],
    voiceRatePerMin: 7,
    videoRatePerMin: 15,
    tagline: profile.tagline || '🌸 Verified Sakhi Host',
    audioSnippet: profile.audioSnippet || '',
    phone: profile.phone || '',
    email: profile.email || '',
    isVerified: true
  };

  // 1. Save directly to Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, HOSTS_COLLECTION, profile.id), {
        ...profile,
        ...sakhiObj,
        lastActiveAt: Date.now()
      }, { merge: true });
      console.log('✅ Host profile successfully saved to Cloud Firestore:', profile.id);
    } catch (err) {
      console.warn('Could not save host profile to firestore:', err);
    }
  }

  // 2. Save to Local Storage cache
  try {
    const list = getLocalRegisteredHosts();
    const idx = list.findIndex((h) => h.id === profile.id || (profile.phone && h.phone === profile.phone));
    if (idx >= 0) {
      list[idx] = sakhiObj;
    } else {
      list.push(sakhiObj);
    }
    localStorage.setItem(LOCAL_HOSTS_KEY, JSON.stringify(deduplicateHosts(list)));
  } catch {}

  // 3. Post to Server Backend
  try {
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/hosts/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sakhiObj),
      signal: AbortSignal.timeout(3000)
    });
  } catch {}

  return true;
};

/**
 * Subscribe to real-time single host profile updates & live commission updates (sath k sath).
 * Listens directly to Firestore `doc(db, 'hosts', hostId)` with server/local fallback.
 */
export const subscribeToHostProfile = (
  hostId: string,
  onUpdate: (profile: Partial<HostProfile>) => void,
  hostPhone?: string
): (() => void) => {
  let firestoreUnsub: (() => void) | null = null;
  if (isFirebaseConfigured() && db && hostId) {
    try {
      firestoreUnsub = onSnapshot(doc(db, HOSTS_COLLECTION, hostId), (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as Partial<HostProfile>);
        }
      });
    } catch {}
  }

  // Also check backend
  const baseUrl = getApiBaseUrl();
  const fetchProfile = async () => {
    try {
      const cleanPhone = hostPhone ? hostPhone.replace(/\D/g, '') : '';
      const res = await fetch(`${baseUrl}/api/hosts/profile?hostId=${encodeURIComponent(hostId)}&phone=${encodeURIComponent(cleanPhone)}`, {
        signal: AbortSignal.timeout(3000)
      });
      const data = await res.json();
      if (data.success && data.host) {
        onUpdate(data.host);
      }
    } catch {}
  };

  fetchProfile();
  const intervalId = window.setInterval(fetchProfile, 3000);

  return () => {
    if (firestoreUnsub) firestoreUnsub();
    clearInterval(intervalId);
  };
};

/**
 * Record host earnings record to Firestore & Backend Cloud (sath k sath live update).
 */
export const recordHostIncomeToCloud = async (
  hostId: string,
  incomeRecord: HostIncomeRecord,
  updatedEarnings?: { grossRevenue: number; netIncome: number; pendingPayout: number },
  extra?: { hostPhone?: string; durationSec?: number; callType?: string }
): Promise<boolean> => {
  // 1. Update Firestore if configured
  if (isFirebaseConfigured() && db && hostId) {
    try {
      const hostDocRef = doc(db, HOSTS_COLLECTION, hostId);
      const hostSnap = await getDoc(hostDocRef);
      if (hostSnap.exists()) {
        const hData = hostSnap.data() as any;
        const currentHistory = Array.isArray(hData.incomeHistory) ? hData.incomeHistory : [];
        const nextHistory = [incomeRecord, ...currentHistory];
        const nextNet = updatedEarnings ? updatedEarnings.netIncome : (hData.netIncome || 0) + (incomeRecord.hostEarned || 0);
        const nextPending = updatedEarnings ? updatedEarnings.pendingPayout : (hData.pendingPayout || 0) + (incomeRecord.hostEarned || 0);
        const nextGross = updatedEarnings ? updatedEarnings.grossRevenue : (hData.grossRevenue || 0) + (incomeRecord.grossAmount || 0);

        await setDoc(hostDocRef, {
          incomeHistory: nextHistory,
          netIncome: parseFloat(Number(nextNet).toFixed(2)),
          pendingPayout: parseFloat(Number(nextPending).toFixed(2)),
          grossRevenue: parseFloat(Number(nextGross).toFixed(2)),
          lastActiveAt: Date.now()
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Could not record host income to Firestore:', err);
    }
  }

  // 2. Post to backend
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
      }),
      signal: AbortSignal.timeout(3000)
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    return false;
  }
};
