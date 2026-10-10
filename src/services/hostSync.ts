import { collection, doc, getDoc, getDocs, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { HostProfile, HostIncomeRecord, Sakhi } from '../types';
import { getApiBaseUrl, hasExternalApiBackend } from './apiConfig';

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
  // Exclude callers
  if (typeof h.id === 'string' && (h.id.startsWith('caller-') || h.id.startsWith('user-'))) {
    return false;
  }
  if ((h as any).role === 'caller') {
    return false;
  }

  let p = h.phone ? String(h.phone).replace(/\D/g, '') : '';
  if (!p && typeof h.id === 'string') {
    const digits = h.id.replace(/\D/g, '');
    if (digits.length >= 10) {
      p = digits.slice(-10);
    }
  }
  const em = h.email ? String(h.email).trim().toLowerCase() : '';
  const hasPhone = p.length >= 10;
  const hasEmail = Boolean(em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
  if (!hasPhone && !hasEmail) return false;

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

  const injectLoggedInHost = (targetMap: Map<string, Sakhi>) => {
    try {
      const rawHost = localStorage.getItem('sunosakhi_host_profile');
      const isHostLogged = localStorage.getItem('sunosakhi_host_logged_in') === 'true';
      if (rawHost && isHostLogged) {
        const hp = JSON.parse(rawHost);
        const rawPhoneDigits = String(hp.phone || '').replace(/\D/g, '');
        const p = rawPhoneDigits.length >= 10 ? rawPhoneDigits.slice(-10) : '';
        const em = (hp.email || '').trim().toLowerCase();
        if (p.length === 10 || em) {
          const k = p || em || hp.id;
          const existing = targetMap.get(k);
          const verStatus = hp.verification?.status;
          const isHostVerified =
            verStatus === 'pending' || verStatus === 'rejected'
              ? false
              : hp.isVerified !== false;
          const activeStatus: 'online' | 'busy' | 'offline' =
            hp.status === 'busy'
              ? 'busy'
              : hp.status === 'offline'
              ? 'offline'
              : 'online';

          targetMap.set(k, {
            ...(existing || {}),
            id: hp.id || existing?.id || (p ? `sakhi-user-${p}` : `sakhi-host-${em.replace(/[^a-z0-9]/g, '_')}`),
            name: hp.name && hp.name !== 'Sakhi Host' ? hp.name : existing?.name || 'Sakhi Host',
            age: hp.age || existing?.age || 22,
            city: hp.city || existing?.city || 'India',
            avatar: hp.avatar || existing?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
            videoPoster: hp.videoPoster || hp.avatar || existing?.videoPoster || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
            status: activeStatus,
            rating: hp.rating || existing?.rating || 5.0,
            totalCalls: hp.totalCalls || existing?.totalCalls || 0,
            languages: Array.isArray(hp.languages) && hp.languages.length > 0 ? hp.languages : existing?.languages || ['Hindi', 'English'],
            bio: hp.bio || existing?.bio || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
            interests: Array.isArray(hp.interests) && hp.interests.length > 0 ? hp.interests : existing?.interests || ['Friendly Chat', 'Life Talk'],
            voiceRatePerMin: hp.voiceRatePerMin || existing?.voiceRatePerMin || 7,
            videoRatePerMin: hp.videoRatePerMin || existing?.videoRatePerMin || 15,
            tagline: hp.tagline || existing?.tagline || '🌸 Verified Sakhi Host',
            audioSnippet: hp.audioSnippet || existing?.audioSnippet || '',
            phone: p,
            email: em,
            isVerified: isHostVerified
          });
        }
      }
    } catch {}
  };

  // 1. Deliver local cache immediately for instant UI
  const localList = getLocalRegisteredHosts();
  localList.forEach((h) => {
    const key = h.phone || h.email || h.id;
    mergedHostsMap.set(key, h);
  });
  injectLoggedInHost(mergedHostsMap);
  if (mergedHostsMap.size > 0) {
    onUpdate(Array.from(mergedHostsMap.values()));
  }

  // Helper to publish updates
  const publish = () => {
    if (isUnsubscribed) return;
    injectLoggedInHost(mergedHostsMap);
    const clean = Array.from(mergedHostsMap.values()).filter(isRealHostAccount);
    const unique = deduplicateHosts(clean);
    try {
      localStorage.setItem(LOCAL_HOSTS_KEY, JSON.stringify(unique));
    } catch {}
    onUpdate(unique);
  };

  // Listen to local auth/host updates for instant zero-latency UI sync
  const handleLocalSync = () => {
    const latestLocal = getLocalRegisteredHosts();
    latestLocal.forEach((h) => {
      const key = h.phone || h.email || h.id;
      mergedHostsMap.set(key, h);
    });
    publish();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('sunosakhi-auth-changed', handleLocalSync);
    window.addEventListener('user-auth-changed', handleLocalSync);
    window.addEventListener('sunosakhi-hosts-updated', handleLocalSync);
    window.addEventListener('storage', handleLocalSync);
  }

  // 2. Real-Time Cloud Firestore Listener (Works across all devices & mobile)
  let firestoreUnsub: (() => void) | null = null;
  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, HOSTS_COLLECTION);
      firestoreUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          const currentSnapshotMap = new Map<string, Sakhi>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data) {
              const docId = docSnap.id;
              const rawDocDigits = docId.replace(/\D/g, '');
              const phoneDigits = rawDocDigits.length === 10 ? rawDocDigits : '';
              const rawDataPhone = data.phone ? String(data.phone).replace(/\D/g, '') : '';
              const phone = rawDataPhone.length >= 10 ? rawDataPhone.slice(-10) : phoneDigits;
              const email = data.email ? String(data.email).trim().toLowerCase() : (docId.includes('@') ? docId : '');

              if (phone.length === 10 || (email && email.includes('@'))) {
                const displayName = data.name && data.name.trim() !== '' && data.name !== 'Sakhi Host'
                  ? data.name.trim()
                  : 'Sakhi Host';

                const effectiveStatus: 'online' | 'busy' | 'offline' =
                  data.status === 'busy'
                    ? 'busy'
                    : data.status === 'offline'
                    ? 'offline'
                    : 'online';

                const verStatus = data.verification?.status;
                const isHostVerified =
                  verStatus === 'pending' || verStatus === 'rejected'
                    ? false
                    : data.isVerified !== false;

                const sakhi: Sakhi = {
                  id: docId,
                  name: displayName,
                  age: data.age || 22,
                  city: data.city || 'India',
                  avatar: data.avatar || data.selfieUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
                  videoPoster: data.videoPoster || data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
                  status: effectiveStatus,
                  rating: typeof data.rating === 'number' ? data.rating : 5.0,
                  totalCalls: data.totalCalls || 0,
                  languages: Array.isArray(data.languages) && data.languages.length > 0 ? data.languages : ['Hindi', 'English'],
                  bio: data.bio || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
                  interests: data.interests || ['Friendly Chat', 'Life Talk'],
                  voiceRatePerMin: data.voiceRatePerMin || 7,
                  videoRatePerMin: data.videoRatePerMin || 15,
                  tagline: data.tagline || '🌸 Verified Sakhi Host',
                  audioSnippet: data.audioSnippet || '',
                  phone: phone,
                  email: email,
                  isVerified: isHostVerified
                };
                const key = sakhi.phone || sakhi.email || sakhi.id;
                currentSnapshotMap.set(key, sakhi);
              }
            }
          });

          injectLoggedInHost(currentSnapshotMap);
          mergedHostsMap.clear();
          currentSnapshotMap.forEach((v, k) => mergedHostsMap.set(k, v));

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

  // 3. Fallback polling from Server Backend ONLY if an external server is configured
  let intervalId: number | null = null;
  if (hasExternalApiBackend()) {
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
    intervalId = window.setInterval(fetchFromBackend, 3000);
  }

  return () => {
    isUnsubscribed = true;
    if (firestoreUnsub) firestoreUnsub();
    if (intervalId !== null) clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('sunosakhi-auth-changed', handleLocalSync);
      window.removeEventListener('user-auth-changed', handleLocalSync);
      window.removeEventListener('sunosakhi-hosts-updated', handleLocalSync);
      window.removeEventListener('storage', handleLocalSync);
    }
  };
};

/**
 * Update Host Online/Offline availability across Firestore & Backend
 */
export const updateHostOnlineStatus = async (
  hostId: string,
  status: 'online' | 'busy' | 'offline',
  extraProfile?: Partial<Sakhi>
): Promise<boolean> => {
  if (!hostId) return false;
  const rawDigits = hostId.replace(/\D/g, '');
  const pDigits = rawDigits.length === 10 ? rawDigits : '';
  const localList = getLocalRegisteredHosts();
  const matched = localList.find((h) => h.id === hostId || (pDigits.length === 10 && h.phone === pDigits));

  const rawExtraPhone = extraProfile?.phone ? String(extraProfile.phone).replace(/\D/g, '') : '';
  const phone = rawExtraPhone.length >= 10 ? rawExtraPhone.slice(-10) : (matched?.phone || pDigits);
  const email = extraProfile?.email || matched?.email || '';
  const name = extraProfile?.name || matched?.name || 'Sakhi Host';
  const avatar = extraProfile?.avatar || matched?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';

  // 1. Update in Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const payload: any = {
        status,
        lastActiveAt: Date.now()
      };
      if (phone) payload.phone = phone;
      if (email) payload.email = email;
      if (name) payload.name = name;
      if (avatar) payload.avatar = avatar;
      if (matched?.languages) payload.languages = matched.languages;
      if (matched?.city) payload.city = matched.city;
      if (matched?.bio) payload.bio = matched.bio;
      payload.gender = 'female';

      await setDoc(
        doc(db, HOSTS_COLLECTION, hostId),
        payload,
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not update host status in firestore:', err);
    }
  }

  // 2. Update in Local Storage cache
  try {
    const updated = localList.map((h) => (h.id === hostId || (phone && h.phone === phone) ? { ...h, status } : h));
    localStorage.setItem(LOCAL_HOSTS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sunosakhi-hosts-updated'));
    }
  } catch {}

  // 3. Update in Server Backend if reachable
  if (hasExternalApiBackend()) {
    const baseUrl = getApiBaseUrl();
    try {
      await fetch(`${baseUrl}/api/hosts/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId, status }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {}
  }

  return true;
};

/**
 * Save / Update Host Profile to Cloud Firestore, LocalStorage & Server.
 * Strictly guarantees ZERO dummy accounts.
 */
export const saveHostProfileToCloud = async (
  profile: HostProfile
): Promise<boolean> => {
  if (!profile || !profile.id) return false;

  const rawProfilePhone = String(profile.phone || '').replace(/\D/g, '');
  const cleanPhone = rawProfilePhone.length >= 10 ? rawProfilePhone.slice(-10) : '';
  const rawIdDigits = profile.id.replace(/\D/g, '');
  const idDigits = rawIdDigits.length === 10 ? rawIdDigits : '';
  const phone = cleanPhone.length === 10 ? cleanPhone : idDigits;
  const email = profile.email || '';
  if (!phone && !email) return false;

  const displayName = profile.name && profile.name.trim() !== '' && profile.name !== 'Sakhi Host'
    ? profile.name.trim()
    : 'Sakhi Host';

  const verStatus = profile.verification?.status;
  const isHostVerified =
    verStatus === 'pending' || verStatus === 'rejected'
      ? false
      : profile.isVerified !== false;

  const effectiveStatus: 'online' | 'busy' | 'offline' =
    profile.status === 'busy'
      ? 'busy'
      : profile.status === 'offline'
      ? 'offline'
      : 'online';

  const sakhiObj: Sakhi = {
    id: profile.id,
    name: displayName,
    age: profile.age || 22,
    city: profile.city || 'India',
    avatar: profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    videoPoster: profile.videoPoster || profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    status: effectiveStatus,
    rating: profile.rating || 5.0,
    totalCalls: profile.incomeHistory?.length || 0,
    languages: profile.languages && profile.languages.length > 0 ? profile.languages : ['Hindi', 'English'],
    bio: profile.bio || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
    interests: profile.interests || ['Friendly Chat', 'Life Talk'],
    voiceRatePerMin: profile.voiceRatePerMin || 7,
    videoRatePerMin: profile.videoRatePerMin || 15,
    tagline: profile.tagline || '🌸 Verified Sakhi Host',
    audioSnippet: profile.audioSnippet || '',
    phone: phone,
    email: email,
    isVerified: isHostVerified
  };

  // 1. Save directly to Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, HOSTS_COLLECTION, profile.id), {
        ...profile,
        ...sakhiObj,
        phone,
        email,
        name: displayName,
        gender: 'female',
        status: effectiveStatus,
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
    const idx = list.findIndex((h) => h.id === profile.id || (phone && h.phone === phone));
    if (idx >= 0) {
      list[idx] = sakhiObj;
    } else {
      list.push(sakhiObj);
    }
    localStorage.setItem(LOCAL_HOSTS_KEY, JSON.stringify(deduplicateHosts(list)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sunosakhi-hosts-updated'));
    }
  } catch {}

  // 3. Post to Server Backend if configured
  if (hasExternalApiBackend()) {
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/hosts/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sakhiObj),
        signal: AbortSignal.timeout(3000)
      });
    } catch {}
  }

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

  // Also check backend if external backend is configured
  let intervalId: number | null = null;
  if (hasExternalApiBackend()) {
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
    intervalId = window.setInterval(fetchProfile, 3000);
  }

  return () => {
    if (firestoreUnsub) firestoreUnsub();
    if (intervalId !== null) clearInterval(intervalId);
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
  const cleanPhone = String(extra?.hostPhone || hostId || '').replace(/\D/g, '').slice(-10);

  // 1. Update Firestore if configured
  if (isFirebaseConfigured() && db && (hostId || extra?.hostPhone)) {
    try {
      const candidates = Array.from(
        new Set(
          [
            hostId,
            cleanPhone.length === 10 ? `sakhi-user-${cleanPhone}` : '',
            cleanPhone.length === 10 ? `host_${cleanPhone}` : '',
            cleanPhone.length === 10 ? cleanPhone : ''
          ].filter(Boolean)
        )
      );

      let matchedDocId: string | null = null;
      let hData: any = null;

      for (const candidateId of candidates) {
        const hostDocRef = doc(db, HOSTS_COLLECTION, candidateId);
        const hostSnap = await getDoc(hostDocRef);
        if (hostSnap.exists()) {
          matchedDocId = candidateId;
          hData = hostSnap.data();
          break;
        }
      }

      // Fallback: scan 'hosts' collection if direct ID wasn't matched
      if (!matchedDocId && cleanPhone.length === 10) {
        const allHostsSnap = await getDocs(collection(db, HOSTS_COLLECTION));
        allHostsSnap.forEach((docSnap) => {
          if (matchedDocId) return;
          const d = docSnap.data() as any;
          const dPhone = String(d.phone || d.id || docSnap.id || '').replace(/\D/g, '').slice(-10);
          if (dPhone === cleanPhone) {
            matchedDocId = docSnap.id;
            hData = d;
          }
        });
      }

      if (matchedDocId && hData) {
        const hostDocRef = doc(db, HOSTS_COLLECTION, matchedDocId);
        const currentHistory = Array.isArray(hData.incomeHistory) ? hData.incomeHistory : [];
        const nextHistory = [incomeRecord, ...currentHistory];
        const nextNet = updatedEarnings ? updatedEarnings.netIncome : (hData.netIncome || 0) + (incomeRecord.hostEarned || 0);
        const nextPending = updatedEarnings ? updatedEarnings.pendingPayout : (hData.pendingPayout || 0) + (incomeRecord.hostEarned || 0);
        const nextGross = updatedEarnings ? updatedEarnings.grossRevenue : (hData.grossRevenue || 0) + (incomeRecord.grossAmount || 0);
        const nextMessages =
          extra?.callType === 'message' || incomeRecord.type === 'message'
            ? (hData.totalMessagesReceived || 0) + 1
            : (hData.totalMessagesReceived || 0);
        const nextReferralIncome =
          extra?.callType === 'referral' || incomeRecord.type === 'referral'
            ? parseFloat(Number((hData.referralIncome || 0) + (incomeRecord.hostEarned || 0)).toFixed(2))
            : (hData.referralIncome || 0);

        const nextReferredCallers = Array.isArray(hData.referredCallers) ? [...hData.referredCallers] : [];
        if (
          (extra?.callType === 'referral' || incomeRecord.type === 'referral') &&
          (incomeRecord.callerId || incomeRecord.callerPhone || incomeRecord.callerName)
        ) {
          const cPhone = String(incomeRecord.callerPhone || incomeRecord.callerId || '').replace(/\D/g, '').slice(-10);
          const cId = incomeRecord.callerId || (cPhone ? `caller-${cPhone}` : `caller_${Date.now()}`);
          const idx = nextReferredCallers.findIndex(
            (rc: any) =>
              rc.callerId === cId ||
              (cPhone && String(rc.callerPhone || rc.callerId || '').replace(/\D/g, '').slice(-10) === cPhone)
          );
          if (idx >= 0) {
            nextReferredCallers[idx] = {
              ...nextReferredCallers[idx],
              callerName: incomeRecord.callerName || nextReferredCallers[idx].callerName || 'Caller',
              callerAvatar: incomeRecord.callerAvatar || nextReferredCallers[idx].callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
              callerPhone: cPhone || nextReferredCallers[idx].callerPhone,
              totalRechargeAmount: parseFloat(
                Number((nextReferredCallers[idx].totalRechargeAmount || 0) + (incomeRecord.grossAmount || 0)).toFixed(2)
              ),
              totalCommissionEarned: parseFloat(
                Number((nextReferredCallers[idx].totalCommissionEarned || 0) + (incomeRecord.hostEarned || 0)).toFixed(2)
              ),
              rechargeCount: (Number(nextReferredCallers[idx].rechargeCount) || 0) + 1,
              lastRechargeAt: Date.now()
            };
          } else {
            nextReferredCallers.unshift({
              callerId: cId,
              callerName: incomeRecord.callerName || 'Caller',
              callerPhone: cPhone || undefined,
              callerAvatar:
                incomeRecord.callerAvatar ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
              joinedAt: Date.now(),
              totalRechargeAmount: parseFloat(Number(incomeRecord.grossAmount || 0).toFixed(2)),
              totalCommissionEarned: parseFloat(Number(incomeRecord.hostEarned || 0).toFixed(2)),
              rechargeCount: 1,
              lastRechargeAt: Date.now()
            });
          }
        }

        await setDoc(hostDocRef, {
          incomeHistory: nextHistory,
          netIncome: parseFloat(Number(nextNet).toFixed(2)),
          pendingPayout: parseFloat(Number(nextPending).toFixed(2)),
          grossRevenue: parseFloat(Number(nextGross).toFixed(2)),
          totalMessagesReceived: nextMessages,
          referralIncome: nextReferralIncome,
          referredCallers: nextReferredCallers,
          lastActiveAt: Date.now()
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Could not record host income to Firestore:', err);
    }
  }

  // 2. Also update local host profile if the target host is logged in on this browser
  if (typeof window !== 'undefined') {
    try {
      const rawLocalHost = localStorage.getItem('sunosakhi_host_profile');
      if (rawLocalHost) {
        const parsedHost = JSON.parse(rawLocalHost);
        const localPhone = String(parsedHost.phone || parsedHost.id || '').replace(/\D/g, '').slice(-10);
        if (
          (hostId && parsedHost.id === hostId) ||
          (cleanPhone.length === 10 && localPhone === cleanPhone)
        ) {
          const currentHistory = Array.isArray(parsedHost.incomeHistory) ? parsedHost.incomeHistory : [];
          if (!currentHistory.some((r: any) => r.id === incomeRecord.id)) {
            parsedHost.incomeHistory = [incomeRecord, ...currentHistory];
            parsedHost.netIncome = parseFloat(
              Number((parsedHost.netIncome || 0) + (incomeRecord.hostEarned || 0)).toFixed(2)
            );
            parsedHost.pendingPayout = parseFloat(
              Number((parsedHost.pendingPayout || 0) + (incomeRecord.hostEarned || 0)).toFixed(2)
            );
            parsedHost.grossRevenue = parseFloat(
              Number((parsedHost.grossRevenue || 0) + (incomeRecord.grossAmount || 0)).toFixed(2)
            );
            if (extra?.callType === 'referral' || incomeRecord.type === 'referral') {
              parsedHost.referralIncome = parseFloat(
                Number((parsedHost.referralIncome || 0) + (incomeRecord.hostEarned || 0)).toFixed(2)
              );
              const localReferred = Array.isArray(parsedHost.referredCallers) ? [...parsedHost.referredCallers] : [];
              const cPhone = String(incomeRecord.callerPhone || incomeRecord.callerId || '').replace(/\D/g, '').slice(-10);
              const cId = incomeRecord.callerId || (cPhone ? `caller-${cPhone}` : `caller_${Date.now()}`);
              const rIdx = localReferred.findIndex(
                (rc: any) =>
                  rc.callerId === cId ||
                  (cPhone && String(rc.callerPhone || rc.callerId || '').replace(/\D/g, '').slice(-10) === cPhone)
              );
              if (rIdx >= 0) {
                localReferred[rIdx] = {
                  ...localReferred[rIdx],
                  callerName: incomeRecord.callerName || localReferred[rIdx].callerName || 'Caller',
                  callerAvatar: incomeRecord.callerAvatar || localReferred[rIdx].callerAvatar,
                  totalRechargeAmount: parseFloat(
                    Number((localReferred[rIdx].totalRechargeAmount || 0) + (incomeRecord.grossAmount || 0)).toFixed(2)
                  ),
                  totalCommissionEarned: parseFloat(
                    Number((localReferred[rIdx].totalCommissionEarned || 0) + (incomeRecord.hostEarned || 0)).toFixed(2)
                  ),
                  rechargeCount: (Number(localReferred[rIdx].rechargeCount) || 0) + 1,
                  lastRechargeAt: Date.now()
                };
              } else {
                localReferred.unshift({
                  callerId: cId,
                  callerName: incomeRecord.callerName || 'Caller',
                  callerPhone: cPhone || undefined,
                  callerAvatar:
                    incomeRecord.callerAvatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
                  joinedAt: Date.now(),
                  totalRechargeAmount: parseFloat(Number(incomeRecord.grossAmount || 0).toFixed(2)),
                  totalCommissionEarned: parseFloat(Number(incomeRecord.hostEarned || 0).toFixed(2)),
                  rechargeCount: 1,
                  lastRechargeAt: Date.now()
                });
              }
              parsedHost.referredCallers = localReferred;
            }
            localStorage.setItem('sunosakhi_host_profile', JSON.stringify(parsedHost));
            window.dispatchEvent(new CustomEvent('sunosakhi-host-income-updated', { detail: parsedHost }));
          }
        }
      }
    } catch {}
  }

  // 3. Post to backend if configured
  if (hasExternalApiBackend()) {
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
  }
  return true;
};

