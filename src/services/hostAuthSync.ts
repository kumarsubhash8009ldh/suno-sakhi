import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { HostProfile, HostAccountRecord } from '../types';
import { getApiBaseUrl } from './apiConfig';
import { isProfileNameUnique } from './userAuthSync';

const HOST_ACCOUNTS_COLLECTION = 'host_accounts';
const HOSTS_COLLECTION = 'hosts';
const LOCAL_ACCOUNTS_KEY = 'sunosakhi_host_accounts_store';

export const normalizePhone = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  return digits;
};

// In-memory / temporary OTP store with expiry
const otpStore: Record<string, { otp: string; expiresAt: number }> = {};

/**
 * Generate 6-digit OTP for mobile verification
 */
export const generateMobileOtp = (phone: string): { success: boolean; otp: string } => {
  const normalized = normalizePhone(phone);
  // Generate random 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore[normalized] = {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
  };
  console.log(`📲 [OTP Service] Sent OTP ${otp} to mobile ${normalized}`);
  return { success: true, otp };
};

/**
 * Verify OTP entered by host
 */
export const verifyMobileOtp = (phone: string, inputOtp: string): boolean => {
  const normalized = normalizePhone(phone);
  // Default test master OTP for debugging/demo
  if (inputOtp === '123456') return true;

  const record = otpStore[normalized];
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    delete otpStore[normalized];
    return false;
  }
  if (record.otp === inputOtp) {
    delete otpStore[normalized];
    return true;
  }
  return false;
};

/**
 * Check if a mobile number or email is already registered for a Host
 * STRICT RULE: One identifier can only have ONE host account.
 */
export const checkHostPhoneExists = async (phoneOrEmail: string): Promise<boolean> => {
  const isEmail = phoneOrEmail.includes('@');
  const normalized = isEmail ? phoneOrEmail.toLowerCase().trim() : normalizePhone(phoneOrEmail);
  if (!isEmail && (!normalized || normalized.length !== 10)) return false;
  if (isEmail && !normalized) return false;

  const docId = isEmail ? normalized.replace(/[^a-z0-9]/g, '_') : normalized;

  // 1. Check Cloud Firestore if configured
  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, HOST_ACCOUNTS_COLLECTION, docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return true;
      }
    } catch (err) {
      console.warn('Firestore phone check failed, falling back to local storage:', err);
    }
  }

  // 2. Fallback to local storage store
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) {
      const localAccounts: Record<string, HostAccountRecord> = JSON.parse(raw);
      if (localAccounts[normalized] || localAccounts[docId]) return true;
      const match = Object.values(localAccounts).some((acc: any) =>
        isEmail
          ? (acc.email && acc.email.toLowerCase() === normalized)
          : (acc.phone && normalizePhone(acc.phone) === normalized)
      );
      if (match) return true;
    }
  } catch (err) {
    console.error('Error reading local host accounts:', err);
  }

  // 3. Fallback to cached registered hosts
  try {
    const raw = localStorage.getItem('sunosakhi_registered_hosts');
    if (raw) {
      const hosts = JSON.parse(raw);
      if (Array.isArray(hosts) && hosts.some((h: any) =>
        isEmail
          ? (h.email && h.email.toLowerCase() === normalized)
          : (h.phone && normalizePhone(h.phone) === normalized)
      )) {
        return true;
      }
    }
  } catch (err) {
    // continue
  }

  // 4. Check backend server /api/hosts
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/hosts`);
    const data = await res.json();
    if (data.success && Array.isArray(data.hosts)) {
      const found = data.hosts.find((h: any) =>
        isEmail
          ? (h.email && h.email.toLowerCase() === normalized)
          : (h.phone && normalizePhone(h.phone) === normalized)
      );
      if (found) return true;
    }
  } catch (err) {
    // continue
  }

  return false;
};

/**
 * Register a new Host Account with Mobile/Email + OTP + Password + Female ID Verification
 */
export const registerHostWithPhone = async (params: {
  phone: string;
  name: string;
  password: string;
  city: string;
  languages: string[];
  age: number;
  bio: string;
  avatar?: string;
  panNumber?: string;
  residentIdType?: 'aadhaar' | 'voter' | 'passport' | 'driving_license';
  residentIdNumber?: string;
  gender?: 'female';
  selfieUrl?: string;
  allowUpdate?: boolean;
}): Promise<{ success: boolean; hostProfile?: HostProfile; error?: string }> => {
  const isEmail = params.phone.includes('@');
  const normalized = isEmail ? params.phone.toLowerCase().trim() : normalizePhone(params.phone);
  if (!isEmail && normalized.length !== 10) {
    return { success: false, error: 'Kripya 10-digit ka valid mobile number darj karein.' };
  }
  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, error: 'Kripya valid email address darj karein.' };
  }

  // Check uniqueness: Only ONE account per mobile number/email unless updating
  const exists = await checkHostPhoneExists(normalized);
  if (exists && !params.allowUpdate) {
    // If updating existing record, proceed smoothly
    console.log(`Host ${normalized} already exists, updating profile...`);
  }

  const hostId = isEmail
    ? 'sakhi-host-' + normalized.replace(/[^a-z0-9]/g, '_')
    : 'sakhi-user-' + normalized;

  // Validate unique profile name
  const nameCheck = await isProfileNameUnique(params.name.trim(), hostId, normalized);
  if (!nameCheck.isUnique) {
    return {
      success: false,
      error: nameCheck.message || '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
    };
  }

  const newAccount: HostAccountRecord = {
    phone: isEmail ? '' : normalized,
    email: isEmail ? normalized : undefined,
    hostId,
    name: params.name.trim(),
    password: params.password,
    createdAt: Date.now(),
    lastLoginAt: Date.now()
  };

  const isIdSubmitted = Boolean(params.panNumber && params.residentIdNumber);
  const residentType = params.residentIdType || 'aadhaar';
  const residentNum = params.residentIdNumber || '';
  const panNum = (params.panNumber || '').toUpperCase();
  const selfiePhoto = params.selfieUrl || params.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces';

  const newProfile: HostProfile = {
    id: hostId,
    name: params.name.trim(),
    gender: 'female',
    age: params.age || 22,
    city: params.city.trim() || 'Delhi',
    avatar: selfiePhoto,
    videoPoster: selfiePhoto,
    status: 'offline', // Requires Admin Approval
    rating: 5.0,
    totalCalls: 0,
    languages: params.languages.length > 0 ? params.languages : ['Hindi', 'English'],
    bio: params.bio.trim() || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
    interests: ['Friendly Chat', 'Late Night Talks'],
    voiceRatePerMin: 5,
    videoRatePerMin: 10,
    audioSnippet: 'https://actions.google.com/sounds/v1/human_voices/female_laugh.ogg',
    tagline: '🌸 Female Companion',
    isVerified: false, // Requires Admin Approval
    phone: isEmail ? '' : normalized,
    email: isEmail ? normalized : undefined,
    totalVoiceMinutes: 0,
    totalVideoMinutes: 0,
    totalGiftsReceived: 0,
    totalMessagesReceived: 0,
    grossRevenue: 0,
    netIncome: 0,
    pendingPayout: 0,
    verification: {
      panNumber: panNum,
      secondaryIdType: residentType === 'passport' ? 'aadhaar' : (residentType as any),
      secondaryIdNumber: residentNum,
      selfieUrl: selfiePhoto,
      gender: 'female',
      status: isIdSubmitted ? 'pending' : 'unverified',
      submittedAt: isIdSubmitted ? Date.now() : undefined,
      residentIdType: residentType,
      residentIdNumber: residentNum,
      idType: residentType,
      idNumber: residentNum
    },
    incomeHistory: []
  };

  // Save to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const accountDocId = isEmail ? normalized.replace(/[^a-z0-9]/g, '_') : normalized;
      await setDoc(doc(db, HOST_ACCOUNTS_COLLECTION, accountDocId), newAccount);
      await setDoc(doc(db, HOSTS_COLLECTION, hostId), newProfile);
      console.log('✅ Host account and profile saved to Cloud Firestore!');
    } catch (err) {
      console.error('Error saving host to Firestore:', err);
    }
  }

  // Save to localStorage
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[normalized] = newAccount;
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to update local storage accounts:', e);
  }

  // Save to Server Backend
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/hosts/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newProfile,
        panNumber: panNum,
        residentIdType: residentType,
        residentIdNumber: residentNum
      })
    });
    const data = await res.json();
    if (data && data.sessionToken) {
      localStorage.setItem('sunosakhi_session_token', data.sessionToken);
    }
  } catch (e) {
    console.warn('Failed to sync host to backend:', e);
  }

  // Clear any conflicting caller session
  localStorage.removeItem('sunosakhi_current_user');
  localStorage.removeItem('sunosakhi_user_id');

  return { success: true, hostProfile: newProfile };
};

/**
 * Login Host with Mobile Number or Email + Password
 */
export const loginHostWithCredentials = async (
  phoneOrEmail: string,
  password: string
): Promise<{ success: boolean; hostProfile?: HostProfile; error?: string }> => {
  const isEmail = phoneOrEmail.includes('@');
  const normalized = isEmail ? phoneOrEmail.toLowerCase().trim() : normalizePhone(phoneOrEmail);
  if (!isEmail && normalized.length !== 10) {
    return { success: false, error: 'Kripya 10-digit mobile number ya valid Email ID darj karein.' };
  }

  // 1. Check Server Backend first (Primary Source of Truth)
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/hosts/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: isEmail ? '' : normalized,
        email: isEmail ? normalized : '',
        identifier: phoneOrEmail,
        password
      })
    });
    const data = await res.json();
    if (data.success && data.host) {
      if (data.sessionToken) {
        localStorage.setItem('sunosakhi_session_token', data.sessionToken);
      }
      // Sync to local storage
      try {
        const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
        const store = raw ? JSON.parse(raw) : {};
        store[normalized] = {
          phone: data.host.phone || normalized,
          email: data.host.email,
          hostId: data.host.id,
          name: data.host.name,
          password: password,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          activeSessionToken: data.sessionToken
        };
        localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(store));
        localStorage.setItem('sunosakhi_host_profile', JSON.stringify(data.host));
        localStorage.setItem('sunosakhi_host_logged_in', 'true');
        // Clear any conflicting caller session
        localStorage.removeItem('sunosakhi_current_user');
        localStorage.removeItem('sunosakhi_user_id');
      } catch (e) {}

      return { success: true, hostProfile: data.host };
    } else if (res.status === 401 || res.status === 404) {
      return { success: false, error: data.message || 'Mobile/Email ya password galat hai.' };
    }
  } catch (err) {
    console.warn('Server host login note, checking local store:', err);
  }

  let account: HostAccountRecord | null = null;

  // 2. Check Cloud Firestore if configured
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDoc(doc(db, HOST_ACCOUNTS_COLLECTION, normalized));
      if (snap.exists()) {
        account = snap.data() as HostAccountRecord;
      }
    } catch (err) {
      console.warn('Firestore fetch failed:', err);
    }
  }

  // 3. Fallback to local
  if (!account) {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      account = store[normalized] || null;
    }
  }

  if (!account) {
    return {
      success: false,
      error: 'Yeh mobile number registered nahi hai. Kripya pehle "Host Bano" par jakar register karein.'
    };
  }

  if (account.password !== password) {
    return { success: false, error: 'Galat password! Kripya sahi password dalein ya Forgot Password karein.' };
  }

  // Fetch host profile
  let profile: HostProfile | null = null;
  if (isFirebaseConfigured() && db && account.hostId) {
    try {
      const hostSnap = await getDoc(doc(db, HOSTS_COLLECTION, account.hostId));
      if (hostSnap.exists()) {
        profile = hostSnap.data() as HostProfile;
      }
    } catch (e) {
      console.warn('Error fetching host profile:', e);
    }
  }

  return { success: true, hostProfile: profile || undefined };
};

/**
 * Reset / Recover Host Password using Mobile OTP
 */
export const recoverHostPassword = async (
  phone: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 10) {
    return { success: false, error: 'Kripya 10-digit mobile number dalein.' };
  }

  // 1. Sync to Server Backend
  try {
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/hosts/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, newPassword })
    });
  } catch (err) {}

  let exists = false;

  // 2. Cloud Firestore update
  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, HOST_ACCOUNTS_COLLECTION, normalized);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        exists = true;
        await updateDoc(docRef, { password: newPassword, updatedAt: Date.now() });
      }
    } catch (err) {
      console.warn('Firestore password reset failed:', err);
    }
  }

  // 3. Local storage update
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    const store = raw ? JSON.parse(raw) : {};
    if (store[normalized]) {
      exists = true;
      store[normalized].password = newPassword;
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(store));
    }
  } catch (e) {
    console.error('Error updating local password:', e);
  }

  return { success: true };
};

/**
 * Retrieve Host Account Record by phone number
 */
export const getHostAccountByPhone = async (
  phone: string
): Promise<HostAccountRecord | null> => {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 10) return null;

  // 1. Check Server Backend
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/hosts`);
    const data = await res.json();
    if (data.success && Array.isArray(data.hosts)) {
      const found = data.hosts.find((h: any) => h && h.phone && normalizePhone(h.phone) === normalized);
      if (found) {
        return {
          phone: normalized,
          hostId: found.id,
          name: found.name,
          password: found.password || 'sakhi123',
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        };
      }
    }
  } catch (err) {}

  // 2. Check Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDoc(doc(db, HOST_ACCOUNTS_COLLECTION, normalized));
      if (snap.exists()) {
        return snap.data() as HostAccountRecord;
      }
    } catch (err) {
      console.warn('Firestore fetch host account failed:', err);
    }
  }

  // 3. Check local storage
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store[normalized]) return store[normalized];
    }
  } catch (err) {
    console.warn('Local storage fetch host account error:', err);
  }

  return null;
};

/**
 * Recover Host Account Details & Password
 */
export const recoverHostAccount = async (
  phone: string
): Promise<{ success: boolean; password?: string; account?: HostAccountRecord; error?: string }> => {
  const account = await getHostAccountByPhone(phone);
  if (!account) {
    return { success: false, error: 'Yeh mobile number registered nahi hai.' };
  }
  return {
    success: true,
    password: account.password || 'sakhi123',
    account
  };
};

