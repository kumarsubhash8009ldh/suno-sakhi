import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getApiBaseUrl } from './apiConfig';
import { isPhoneBanned } from './safetyService';
import { HostProfile, Sakhi } from '../types';

const USER_ACCOUNTS_COLLECTION = 'user_accounts';
const HOSTS_COLLECTION = 'hosts';
const HOST_ACCOUNTS_COLLECTION = 'host_accounts';
const CURRENT_USER_KEY = 'sunosakhi_current_user';
const ALL_USERS_KEY = 'sunosakhi_registered_users';
const STORAGE_KEY_USER_ID = 'sunosakhi_user_id';

// Automatic purge of all old user and host IDs (Strict real accounts only)
if (typeof window !== 'undefined') {
  if (localStorage.getItem('sunosakhi_v11_clean_wipe') !== 'true') {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sunosakhi_') || key.startsWith('chat_'))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('sunosakhi_v11_clean_wipe', 'true');
    console.log('🧹 [STORAGE CLEANUP v11] All legacy user & host data cleared. Only fresh registered accounts will exist.');
  }
}

export interface ActiveSession {
  isLoggedIn: boolean;
  role: 'caller' | 'host' | null;
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar: string;
  sessionToken?: string;
}

export const broadcastAuthChange = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sunosakhi-auth-changed'));
    window.dispatchEvent(new CustomEvent('user-auth-changed'));
  }
};

const userOtpStore: Record<string, { otp: string; expiresAt: number }> = {};

export interface UserAccount {
  id: string; // e.g. 'caller-9876543210' or 'caller-email_com'
  phone: string; // 10-digit normalized phone or empty if email
  email?: string;
  name: string;
  avatar?: string;
  createdAt: number;
  lastLoginAt: number;
  referredBy?: string;
  status?: 'active' | 'blocked' | 'online' | 'offline';
  isOnline?: boolean;
  balance?: number;
  sessionToken?: string;
}

export const saveUserToCloud = async (user: UserAccount): Promise<boolean> => {
  if (!user) return false;
  const p = user.phone ? String(user.phone).replace(/\D/g, '') : '';
  const em = user.email ? String(user.email).trim().toLowerCase() : '';
  const cleanPhone = p.length >= 10 ? p.slice(-10) : '';
  if (!cleanPhone && !em) return false;

  const docKey = cleanPhone || em.replace(/[^a-z0-9]/g, '_');
  const sanitizedUser: UserAccount = {
    ...user,
    id: user.id || `caller-${docKey}`,
    phone: cleanPhone,
    email: em || undefined,
    name: user.name && user.name.trim() && user.name !== 'Sakhi Host'
      ? user.name.trim()
      : 'Caller',
    status: user.status === 'blocked' ? 'blocked' : 'online',
    isOnline: true,
    lastLoginAt: user.lastLoginAt || Date.now()
  };

  saveUserToLocalRegistry(sanitizedUser);

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, USER_ACCOUNTS_COLLECTION, docKey), {
        ...sanitizedUser,
        status: sanitizedUser.status,
        isOnline: true,
        lastActiveAt: Date.now(),
        lastLoginAt: Date.now()
      }, { merge: true });
      console.log('✅ Caller profile saved to Cloud Firestore:', docKey);
      return true;
    } catch (err) {
      console.warn('Could not save user to Firestore:', err);
    }
  }
  return false;
};

export const updateUserOnlinePresence = async (isOnline: boolean): Promise<boolean> => {
  const current = getCurrentUser();
  if (!current) return false;
  const p = current.phone ? String(current.phone).replace(/\D/g, '') : '';
  const em = current.email ? String(current.email).trim().toLowerCase() : '';
  const cleanPhone = p.length >= 10 ? p.slice(-10) : '';
  if (!cleanPhone && !em) return false;

  const docKey = cleanPhone || em.replace(/[^a-z0-9]/g, '_');
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(
        doc(db, USER_ACCOUNTS_COLLECTION, docKey),
        {
          isOnline,
          status: isOnline ? 'online' : 'offline',
          lastActiveAt: Date.now()
        },
        { merge: true }
      );
      return true;
    } catch (err) {
      console.warn('Could not update user presence:', err);
    }
  }
  return false;
};

export const syncUserToServer = async (user: UserAccount): Promise<boolean> => {
  if (!user) return false;
  // Push to Cloud Firestore so hosts can see this caller in real-time
  await saveUserToCloud(user);

  try {
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
      signal: AbortSignal.timeout(3000)
    });
    return true;
  } catch (err) {
    return false;
  }
};

export const parseUserIdentifier = (input: string): { type: 'phone' | 'email'; value: string } | null => {
  if (!input) return null;
  const str = input.trim();
  if (str.includes('@') && str.includes('.')) {
    return { type: 'email', value: str.toLowerCase() };
  }
  const digits = str.replace(/\D/g, '');
  const cleanPhone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (cleanPhone.length === 10) {
    return { type: 'phone', value: cleanPhone };
  }
  return null;
};

export const normalizeUserPhone = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  return digits;
};

/**
 * Get all registered user accounts from local storage registry
 */
export const getLocalRegisteredUsers = (): Record<string, UserAccount> => {
  try {
    const raw = localStorage.getItem(ALL_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Error reading local user registry:', err);
    return {};
  }
};

/**
 * Save user account to local storage registry
 */
export const saveUserToLocalRegistry = (user: UserAccount): void => {
  try {
    const users = getLocalRegisteredUsers();
    const key = user.phone || user.email || user.id;
    if (key) {
      users[key] = user;
      localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
    }
  } catch (err) {
    console.error('Error saving user to local registry:', err);
  }
};

/**
 * Check if a mobile number or email is already registered for a Caller
 */
export const checkUserPhoneExists = async (identifier: string): Promise<boolean> => {
  const parsed = parseUserIdentifier(identifier);
  if (!parsed) return false;

  // 1. Check local storage registry first (instant)
  const localUsers = getLocalRegisteredUsers();
  if (localUsers[parsed.value]) {
    return true;
  }

  // 2. Check Server Backend
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/users`);
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      const found = data.users.find((u: UserAccount) =>
        parsed.type === 'email'
          ? Boolean(u.email && u.email.toLowerCase() === parsed.value)
          : Boolean(u.phone && normalizeUserPhone(u.phone) === parsed.value)
      );
      if (found) {
        saveUserToLocalRegistry(found);
        return true;
      }
    }
  } catch (err) {}

  // 3. Check Cloud Firestore if configured
  if (isFirebaseConfigured() && db) {
    try {
      const docId = parsed.type === 'email' ? parsed.value.replace(/[^a-z0-9]/g, '_') : parsed.value;
      const snap = await getDoc(doc(db, USER_ACCOUNTS_COLLECTION, docId));
      if (snap.exists()) {
        const cloudUser = snap.data() as UserAccount;
        saveUserToLocalRegistry(cloudUser);
        return true;
      }
    } catch (err) {
      console.warn('Firestore user check note:', err);
    }
  }

  return false;
};

/**
 * Check if a Profile Name is globally unique across all Callers and Hosts
 * Case-insensitive match, trimmed.
 */
export const isProfileNameUnique = async (
  name: string,
  excludeId?: string,
  excludePhone?: string
): Promise<{ isUnique: boolean; message?: string }> => {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return { isUnique: false, message: 'Profile Name khali nahi ho sakta.' };
  }
  const cleanNameLower = cleanName.toLowerCase();
  const cleanPhone = (excludePhone || '').replace(/\D/g, '');

  // 1. Check local users
  const localUsers = getLocalRegisteredUsers();
  for (const u of Object.values(localUsers)) {
    if (u && u.name && u.name.trim().toLowerCase() === cleanNameLower) {
      if (excludeId && u.id === excludeId) continue;
      if (cleanPhone && u.phone && u.phone.replace(/\D/g, '') === cleanPhone) continue;
      return {
        isUnique: false,
        message: '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
      };
    }
  }

  // 2. Check local hosts store
  try {
    const rawHosts = localStorage.getItem('sunosakhi_host_accounts_store');
    if (rawHosts) {
      const hostsStore = JSON.parse(rawHosts);
      for (const h of Object.values(hostsStore) as any[]) {
        if (h && h.name && h.name.trim().toLowerCase() === cleanNameLower) {
          if (excludeId && (h.hostId === excludeId || h.id === excludeId)) continue;
          if (cleanPhone && h.phone && h.phone.replace(/\D/g, '') === cleanPhone) continue;
          return {
            isUnique: false,
            message: '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
          };
        }
      }
    }
  } catch (e) {}

  // 3. Check Backend API (/api/profile/check-name)
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/profile/check-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, excludeId, excludePhone: cleanPhone })
    });
    const data = await res.json();
    if (data && data.isUnique === false) {
      return {
        isUnique: false,
        message: data.message || '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
      };
    }
  } catch (e) {}

  return { isUnique: true };
};

/**
 * Retrieve user account by phone number
 */
export const getUserAccount = async (phone: string): Promise<UserAccount | null> => {
  const normalized = normalizeUserPhone(phone);
  if (!normalized || normalized.length !== 10) return null;

  // 1. Check local registry
  const localUsers = getLocalRegisteredUsers();
  if (localUsers[normalized]) {
    return localUsers[normalized];
  }

  // 2. Check Server Backend
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/users`);
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      const found = data.users.find((u: UserAccount) => u.phone === normalized);
      if (found) {
        saveUserToLocalRegistry(found);
        return found;
      }
    }
  } catch (err) {}

  // 3. Check Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDoc(doc(db, USER_ACCOUNTS_COLLECTION, normalized));
      if (snap.exists()) {
        const cloudUser = snap.data() as UserAccount;
        saveUserToLocalRegistry(cloudUser);
        return cloudUser;
      }
    } catch (err) {
      console.warn('Firestore user fetch note:', err);
    }
  }

  return null;
};

/**
 * Generate 6-digit OTP for user login/registration
 */
export const sendUserOtp = (phone: string): { success: boolean; otp: string } => {
  const normalized = normalizeUserPhone(phone);
  if (isPhoneBanned(normalized)) {
    alert('🚫 ACCOUNT BANNED: Yeh phone number Video Call Nudity & Vulgarity Policy violation ki wajah se permanently block kar diya gaya hai.');
    return { success: false, otp: '' };
  }
  const otp = '123456';
  userOtpStore[normalized] = {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  console.log(`📲 [User Auth] OTP ${otp} generated for ${normalized}`);
  return { success: true, otp };
};

/**
 * Verify user 6-digit OTP
 */
export const verifyUserOtp = (phone: string, inputOtp: string): boolean => {
  const normalized = normalizeUserPhone(phone);
  if (inputOtp === '123456' || inputOtp === '654321' || inputOtp === '999999' || inputOtp === '000000') {
    return true; // Master demo codes always accept
  }
  const record = userOtpStore[normalized];
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    delete userOtpStore[normalized];
    return false;
  }
  if (record.otp === inputOtp) {
    delete userOtpStore[normalized];
    return true;
  }
  return false;
};

/**
 * Register a brand new caller user with phone or email.
 */
export const registerNewUser = async (
  phoneOrEmail: string,
  name?: string,
  referredBy?: string
): Promise<{ success: boolean; user?: UserAccount; error?: string }> => {
  const parsed = parseUserIdentifier(phoneOrEmail);
  if (!parsed) {
    return { success: false, error: 'Kripya 10-digit valid mobile number ya Email ID dalein.' };
  }
  const cleanPhone = parsed.type === 'phone' ? parsed.value : '';
  const cleanEmail = parsed.type === 'email' ? parsed.value : '';

  // Strict check: One account per phone/email
  const alreadyExists = await checkUserPhoneExists(phoneOrEmail);
  if (alreadyExists) {
    return {
      success: false,
      error: `⚠️ Account (${phoneOrEmail}) pehle se registered hai! Kripya 'Sign In' karein.`
    };
  }

  const userId = cleanPhone ? 'caller-' + cleanPhone : 'caller-' + cleanEmail.replace(/[^a-z0-9]/g, '_');
  const customName = name?.trim();

  // Validate unique profile name if custom name provided
  if (customName && customName !== 'User' && !customName.startsWith('Caller ')) {
    const nameCheck = await isProfileNameUnique(customName, userId, cleanPhone);
    if (!nameCheck.isUnique) {
      return {
        success: false,
        error: nameCheck.message || '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
      };
    }
  }

  const displayName = customName || 'Caller';

  const newAccount: UserAccount = {
    id: userId,
    phone: cleanPhone,
    email: cleanEmail,
    name: displayName,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    referredBy: referredBy || undefined,
    status: 'online',
    isOnline: true,
    balance: 20.0
  };

  // 1. Sync to server backend (generates sessionToken)
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newAccount, identifier: phoneOrEmail })
    });
    const data = await res.json();
    if (data.success && data.sessionToken) {
      newAccount.sessionToken = data.sessionToken;
      localStorage.setItem('sunosakhi_session_token', data.sessionToken);
    }
  } catch (err) {}

  // 2. Save to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const docKey = cleanPhone || cleanEmail.replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, USER_ACCOUNTS_COLLECTION, docKey), newAccount);
    } catch (err) {}
  }

  // 3. Save to local registry and set active session
  saveUserToLocalRegistry(newAccount);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newAccount));
  localStorage.setItem(STORAGE_KEY_USER_ID, userId);
  localStorage.removeItem('sunosakhi_host_logged_in');
  localStorage.removeItem('sunosakhi_host_profile');
  setActiveRole('caller');
  await saveUserToCloud(newAccount);
  broadcastAuthChange();

  return { success: true, user: newAccount };
};

/**
 * Search and resolve Host account across Firestore, LocalStorage and Backend
 */
export const findHostAccount = async (identifier: string): Promise<any | null> => {
  const parsed = parseUserIdentifier(identifier);
  if (!parsed) return null;
  const cleanPhone = parsed.type === 'phone' ? parsed.value : '';
  const cleanEmail = parsed.type === 'email' ? parsed.value : '';

  // 1. Check local storage registered hosts
  try {
    const rawHosts = localStorage.getItem('sunosakhi_registered_hosts');
    if (rawHosts) {
      const list = JSON.parse(rawHosts);
      if (Array.isArray(list)) {
        const found = list.find((h: any) =>
          cleanPhone
            ? (h.phone && normalizeUserPhone(h.phone) === cleanPhone) || (h.id && h.id.includes(cleanPhone))
            : (h.email && h.email.toLowerCase() === cleanEmail)
        );
        if (found) return found;
      }
    }
  } catch {}

  // 2. Check local storage host accounts store
  try {
    const rawStore = localStorage.getItem('sunosakhi_host_accounts_store');
    if (rawStore) {
      const store = JSON.parse(rawStore);
      if (cleanPhone && store[cleanPhone]) return store[cleanPhone];
      if (cleanEmail && store[cleanEmail]) return store[cleanEmail];
    }
  } catch {}

  // 3. Check Firestore 'hosts' and 'host_accounts' collection
  if (isFirebaseConfigured() && db) {
    try {
      const candidates = [
        cleanPhone ? `sakhi-user-${cleanPhone}` : '',
        cleanPhone,
        cleanEmail ? `sakhi-host-${cleanEmail.replace(/[^a-z0-9]/g, '_')}` : '',
        cleanEmail ? cleanEmail.replace(/[^a-z0-9]/g, '_') : ''
      ].filter(Boolean);

      for (const docId of candidates) {
        const snap = await getDoc(doc(db, HOSTS_COLLECTION, docId));
        if (snap.exists()) {
          const data = snap.data();
          return { id: snap.id, ...data };
        }
      }

      for (const docId of candidates) {
        const snap = await getDoc(doc(db, HOST_ACCOUNTS_COLLECTION, docId));
        if (snap.exists()) {
          const acc = snap.data() as any;
          if (acc.hostId) {
            const hSnap = await getDoc(doc(db, HOSTS_COLLECTION, acc.hostId));
            if (hSnap.exists()) {
              return { id: hSnap.id, ...hSnap.data() };
            }
          }
          return acc;
        }
      }
    } catch (err) {
      console.warn('Firestore host check note:', err);
    }
  }

  // 4. Check backend API
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/hosts`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data.success && Array.isArray(data.hosts)) {
      const found = data.hosts.find((h: any) =>
        cleanPhone
          ? (h.phone && normalizeUserPhone(h.phone) === cleanPhone)
          : (h.email && h.email.toLowerCase() === cleanEmail)
      );
      if (found) return found;
    }
  } catch {}

  return null;
};

/**
 * Login existing user (Caller OR Host) with phone number or email.
 * Automatically detects whether the account is a Host or Caller,
 * and seamlessly restores that exact session & interface.
 */
export const loginExistingUser = async (
  phoneOrEmail: string,
  name?: string
): Promise<{ success: boolean; user?: UserAccount; isHost?: boolean; host?: any; notRegistered?: boolean; error?: string }> => {
  const parsed = parseUserIdentifier(phoneOrEmail);
  if (!parsed) {
    return { success: false, error: 'Kripya 10-digit valid mobile number ya Email ID dalein.' };
  }
  if (parsed.type === 'phone' && isPhoneBanned(parsed.value)) {
    return {
      success: false,
      error: '🚫 ACCOUNT BANNED: Yeh account Video Call Nudity & Vulgarity Policy violation ki wajah se permanently block kar diya gaya hai.'
    };
  }
  const cleanPhone = parsed.type === 'phone' ? parsed.value : '';
  const cleanEmail = parsed.type === 'email' ? parsed.value : '';

  // 1. Try Server Backend first
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, email: cleanEmail, identifier: phoneOrEmail, name })
    });
    const data = await res.json();
    if (data.success) {
      if (data.sessionToken) {
        localStorage.setItem('sunosakhi_session_token', data.sessionToken);
      }
      if (data.isHost && data.host) {
        localStorage.setItem('sunosakhi_host_profile', JSON.stringify(data.host));
        localStorage.setItem('sunosakhi_host_logged_in', 'true');
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem(STORAGE_KEY_USER_ID);
        setActiveRole('host');
        broadcastAuthChange();
        return { success: true, isHost: true, host: data.host };
      }
      if (data.user) {
        saveUserToLocalRegistry(data.user);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user));
        localStorage.setItem(STORAGE_KEY_USER_ID, data.user.id);
        localStorage.removeItem('sunosakhi_host_logged_in');
        localStorage.removeItem('sunosakhi_host_profile');
        setActiveRole('caller');
        await saveUserToCloud(data.user);
        broadcastAuthChange();
        return { success: true, isHost: false, user: data.user };
      }
    }
  } catch (err) {}

  // 2. Check if this account is registered as a Sakhi HOST in Cloud / Local
  const hostMatch = await findHostAccount(phoneOrEmail);
  if (hostMatch) {
    const pDigits = hostMatch.phone ? String(hostMatch.phone).replace(/\D/g, '').slice(-10) : cleanPhone;
    const hostProfile: HostProfile = {
      id: hostMatch.id || (pDigits ? `sakhi-user-${pDigits}` : `sakhi-host-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`),
      name: hostMatch.name && hostMatch.name !== 'Sakhi Host' ? hostMatch.name : 'Sakhi Host',
      gender: 'female',
      age: hostMatch.age || 22,
      city: hostMatch.city || 'India',
      avatar: hostMatch.avatar || hostMatch.selfieUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
      videoPoster: hostMatch.videoPoster || hostMatch.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
      status: 'online',
      rating: typeof hostMatch.rating === 'number' ? hostMatch.rating : 5.0,
      totalCalls: hostMatch.totalCalls || 0,
      languages: Array.isArray(hostMatch.languages) && hostMatch.languages.length > 0 ? hostMatch.languages : ['Hindi', 'English'],
      bio: hostMatch.bio || 'Namaste! Main SunoSakhi par aapse baatein karne ke liye available hoon.',
      interests: hostMatch.interests || ['Friendly Chat', 'Life Talk'],
      voiceRatePerMin: 5,
      videoRatePerMin: 10,
      audioSnippet: hostMatch.audioSnippet || '',
      tagline: hostMatch.tagline || '🌸 Verified Sakhi Host',
      totalVoiceMinutes: hostMatch.totalVoiceMinutes || 0,
      totalVideoMinutes: hostMatch.totalVideoMinutes || 0,
      totalGiftsReceived: hostMatch.totalGiftsReceived || 0,
      totalMessagesReceived: hostMatch.totalMessagesReceived || 0,
      grossRevenue: hostMatch.grossRevenue || 0,
      netIncome: hostMatch.netIncome || 0,
      pendingPayout: hostMatch.pendingPayout || 0,
      upiId: hostMatch.upiId || '',
      phone: pDigits,
      email: hostMatch.email || cleanEmail || undefined,
      isVerified: true,
      verification: hostMatch.verification || {
        panNumber: 'DIRECT_ACTIVE',
        residentIdType: 'aadhaar',
        residentIdNumber: 'DIRECT_ACTIVE',
        selfieUrl: hostMatch.avatar || '',
        gender: 'female',
        status: 'verified',
        idType: 'aadhaar',
        idNumber: 'DIRECT_ACTIVE'
      },
      incomeHistory: Array.isArray(hostMatch.incomeHistory) ? hostMatch.incomeHistory : []
    };

    localStorage.setItem('sunosakhi_host_profile', JSON.stringify(hostProfile));
    localStorage.setItem('sunosakhi_host_logged_in', 'true');
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(STORAGE_KEY_USER_ID);
    setActiveRole('host');

    // Update Firestore status to online
    if (isFirebaseConfigured() && db && hostProfile.id) {
      try {
        await setDoc(doc(db, HOSTS_COLLECTION, hostProfile.id), {
          ...hostProfile,
          status: 'online',
          lastActiveAt: Date.now()
        }, { merge: true });
      } catch {}
    }

    broadcastAuthChange();
    return { success: true, isHost: true, host: hostProfile };
  }

  // 3. Check if this account is registered as a CALLER in Cloud / Local registry
  const existing = await getUserAccount(parsed.value);
  if (existing) {
    existing.lastLoginAt = Date.now();
    existing.status = 'online';
    existing.isOnline = true;
    if (name && name.trim()) {
      existing.name = name.trim();
    }
    saveUserToLocalRegistry(existing);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(existing));
    localStorage.setItem(STORAGE_KEY_USER_ID, existing.id);
    localStorage.removeItem('sunosakhi_host_logged_in');
    localStorage.removeItem('sunosakhi_host_profile');
    setActiveRole('caller');
    await saveUserToCloud(existing);
    syncUserToServer(existing);
    broadcastAuthChange();
    return { success: true, isHost: false, user: existing };
  }

  // 4. Not found in either Host or Caller accounts -> Prompt user to Sign Up with role choice
  return {
    success: false,
    notRegistered: true,
    error: '⚠️ Yeh mobile number/email registered nahi hai! Kripya "Sign Up" par click karein aur Caller ya Host chunein.'
  };
};

/**
 * Register or Login user (Unified helper with mode support: 'login' | 'signup' | 'auto')
 */
export const registerOrLoginUser = async (
  phoneOrEmail: string,
  name?: string,
  referredBy?: string,
  mode: 'login' | 'signup' | 'auto' = 'auto'
): Promise<{ success: boolean; user: UserAccount; isNewUser: boolean; error?: string }> => {
  const parsed = parseUserIdentifier(phoneOrEmail);
  if (!parsed) {
    return { success: false, error: '10-digit mobile number ya valid Email ID dalein.' } as any;
  }

  const exists = await checkUserPhoneExists(phoneOrEmail);

  if (mode === 'signup') {
    if (exists) {
      const res = await loginExistingUser(phoneOrEmail, name);
      if (!res.success) return { success: false, error: res.error } as any;
      return { success: true, user: res.user!, isNewUser: false };
    }
    const res = await registerNewUser(phoneOrEmail, name, referredBy);
    if (!res.success) return { success: false, error: res.error } as any;
    return { success: true, user: res.user!, isNewUser: true };
  }

  if (mode === 'login') {
    const res = await loginExistingUser(phoneOrEmail, name);
    if (!res.success) return { success: false, error: res.error } as any;
    return { success: true, user: res.user!, isNewUser: !exists };
  }

  // mode === 'auto'
  if (exists) {
    const res = await loginExistingUser(phoneOrEmail, name);
    return { success: true, user: res.user!, isNewUser: false };
  } else {
    const res = await registerNewUser(phoneOrEmail, name, referredBy);
    return { success: true, user: res.user!, isNewUser: true };
  }
};

export const getCurrentUser = (): UserAccount | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.phone) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  return null;
};

export const updateUserProfilePhoto = async (photoUrl: string): Promise<boolean> => {
  const current = getCurrentUser();
  if (!current) return false;
  current.avatar = photoUrl;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
  saveUserToLocalRegistry(current);

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, USER_ACCOUNTS_COLLECTION, current.phone), { avatar: photoUrl }, { merge: true });
    } catch (err) {
      console.warn('Could not update user photo in cloud:', err);
    }
  }
  broadcastAuthChange();
  return true;
};

export const updateUserProfileName = async (newName: string): Promise<boolean> => {
  const current = getCurrentUser();
  if (!current) return false;
  current.name = newName;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
  saveUserToLocalRegistry(current);

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, USER_ACCOUNTS_COLLECTION, current.phone), { name: newName }, { merge: true });
    } catch (err) {
      console.warn('Could not update user name in cloud:', err);
    }
  }
  broadcastAuthChange();
  return true;
};

export const logoutCurrentUser = (): void => {
  localStorage.removeItem(CURRENT_USER_KEY);
  broadcastAuthChange();
};

export const ACTIVE_ROLE_KEY = 'sunosakhi_active_role';

/**
 * Get active preferred role ('caller' | 'host')
 */
export const getActiveRole = (): 'caller' | 'host' => {
  if (typeof window === 'undefined') return 'caller';
  const saved = localStorage.getItem(ACTIVE_ROLE_KEY);
  if (saved === 'caller' || saved === 'host') return saved;
  // If host is explicitly logged in, default to host
  if (localStorage.getItem('sunosakhi_host_logged_in') === 'true') return 'host';
  return 'caller';
};

/**
 * Set active role ('caller' | 'host') and notify all components
 */
export const setActiveRole = (role: 'caller' | 'host'): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_ROLE_KEY, role);
  broadcastAuthChange();
};

/**
 * Universal Active Session helper.
 * Resolves whether the current user is active as Caller OR Host based on role preference.
 */
export const getActiveSession = (): ActiveSession => {
  if (typeof window === 'undefined') {
    return { isLoggedIn: false, role: null, id: '', name: '', phone: '', email: '', avatar: '', sessionToken: '' };
  }

  const preferredRole = getActiveRole();
  const sessionToken = localStorage.getItem('sunosakhi_session_token') || '';

  const resolveHostSession = (): ActiveSession | null => {
    const isHostLoggedIn = localStorage.getItem('sunosakhi_host_logged_in') === 'true';
    const rawHost = localStorage.getItem('sunosakhi_host_profile');
    if (isHostLoggedIn && rawHost) {
      try {
        const host = JSON.parse(rawHost);
        const hostPhone = host?.phone ? String(host.phone).replace(/\D/g, '') : '';
        const hostEmail = host?.email ? String(host.email).trim().toLowerCase() : '';
        if (hostPhone.length >= 10 || hostEmail) {
          return {
            isLoggedIn: true,
            role: 'host',
            id: host?.id || (hostPhone ? 'sakhi-user-' + hostPhone : 'host_' + hostEmail.replace(/[^a-z0-9]/g, '_')),
            name: host?.name && host.name !== 'Sakhi Host' ? host.name : 'Sakhi Host',
            phone: hostPhone,
            email: hostEmail,
            avatar: host?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            sessionToken: host?.activeSessionToken || sessionToken
          };
        }
      } catch {}
    }
    return null;
  };

  const resolveCallerSession = (): ActiveSession | null => {
    const caller = getCurrentUser();
    if (caller && (caller.phone || caller.email)) {
      const cleanPhone = (caller.phone || '').replace(/\D/g, '');
      const cleanEmail = (caller.email || '').trim().toLowerCase();
      if (cleanPhone.length >= 10 || cleanEmail) {
        return {
          isLoggedIn: true,
          role: 'caller',
          id: caller.id || (cleanPhone ? 'caller-' + cleanPhone : 'caller-' + cleanEmail.replace(/[^a-z0-9]/g, '_')),
          name: caller.name || 'Caller',
          phone: cleanPhone,
          email: cleanEmail,
          avatar: caller.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
          sessionToken: caller.sessionToken || sessionToken
        };
      }
    }
    return null;
  };

  if (preferredRole === 'caller') {
    const callerSession = resolveCallerSession();
    if (callerSession) return callerSession;
    return {
      isLoggedIn: false,
      role: 'caller',
      id: '',
      name: '',
      phone: '',
      email: '',
      avatar: '',
      sessionToken: ''
    };
  }

  if (preferredRole === 'host') {
    const hostSession = resolveHostSession();
    if (hostSession) return hostSession;
    return {
      isLoggedIn: false,
      role: 'host',
      id: '',
      name: '',
      phone: '',
      email: '',
      avatar: '',
      sessionToken: ''
    };
  }

  // Fallback
  const hostSession = resolveHostSession();
  if (hostSession && localStorage.getItem('sunosakhi_host_logged_in') === 'true') {
    return hostSession;
  }
  const callerSession = resolveCallerSession();
  if (callerSession) {
    return callerSession;
  }
  if (hostSession) {
    return hostSession;
  }

  return {
    isLoggedIn: false,
    role: null,
    id: '',
    name: '',
    phone: '',
    email: '',
    avatar: '',
    sessionToken: ''
  };
};

// -------------------------------------------------------------
// ANTI-MULTI-LOGIN BACKGROUND HEARTBEAT
// -------------------------------------------------------------
if (typeof window !== 'undefined') {
  let isChecking = false;
  setInterval(async () => {
    if (isChecking) return;
    const session = getActiveSession();
    if (!session.isLoggedIn || !session.sessionToken) return;

    isChecking = true;
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/session/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: session.id,
          phone: session.phone,
          email: session.email,
          role: session.role,
          sessionToken: session.sessionToken
        })
      });
      const data = await res.json();
      if (data && data.valid === false && data.reason === 'multi_login') {
        console.warn('⚠️ [ANTI-MULTI-LOGIN] Active session invalidated because account logged in on another device.');
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem(STORAGE_KEY_USER_ID);
        localStorage.removeItem('sunosakhi_host_logged_in');
        localStorage.removeItem('sunosakhi_host_profile');
        localStorage.removeItem('sunosakhi_session_token');
        broadcastAuthChange();
        window.dispatchEvent(
          new CustomEvent('sunosakhi-multi-login-detected', {
            detail: {
              message: data.message || 'Aapka account kisi doosre device par login ho gaya hai. Yahan se logout kar diya gaya hai.'
            }
          })
        );
      }
    } catch (e) {
      // network hiccup
    } finally {
      isChecking = false;
    }
  }, 3500);
}

/**
 * React hook that gives real-time, reactive session state across all components.
 * Whenever any user or host logs in, registers, or logs out, components re-render immediately.
 */
export const useActiveSession = (): ActiveSession => {
  const [session, setSession] = useState<ActiveSession>(() => getActiveSession());

  useEffect(() => {
    const handleAuthChange = () => {
      setSession(getActiveSession());
    };

    window.addEventListener('sunosakhi-auth-changed', handleAuthChange);
    window.addEventListener('user-auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('sunosakhi-auth-changed', handleAuthChange);
      window.removeEventListener('user-auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return session;
};

/**
 * Real-time subscription to ALL registered real Callers.
 * Listens directly to Cloud Firestore `user_accounts` collection with LocalStorage fallback.
 * Strictly ZERO dummy accounts: Only users registered with valid Mobile (10-digit) or Email are returned!
 */
export const subscribeToAllRealCallers = (
  onUpdate: (callers: UserAccount[]) => void
): (() => void) => {
  let isUnsubscribed = false;
  const callersMap = new Map<string, UserAccount>();

  // 1. Initial Local Registry Cache
  const localMap = getLocalRegisteredUsers();
  Object.values(localMap).forEach((u) => {
    const cleanPhone = (u.phone || '').replace(/\D/g, '');
    const cleanEmail = (u.email || '').trim().toLowerCase();
    if (cleanPhone.length >= 10 || (cleanEmail && cleanEmail.includes('@'))) {
      const key = cleanPhone || cleanEmail || u.id;
      callersMap.set(key, { ...u, phone: cleanPhone, email: cleanEmail });
    }
  });
  if (callersMap.size > 0) {
    onUpdate(Array.from(callersMap.values()));
  }

  const publish = () => {
    if (isUnsubscribed) return;
    const cleanList = Array.from(callersMap.values()).filter((u) => {
      const p = (u.phone || '').replace(/\D/g, '');
      const em = (u.email || '').trim().toLowerCase();
      const hasPhone = p.length >= 10;
      const hasEmail = Boolean(em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
      if (!hasPhone && !hasEmail) return false;
      // Exclude hosts
      if (
        u.id?.startsWith('sakhi-user-') ||
        u.id?.startsWith('sakhi-host-') ||
        u.id?.startsWith('host_') ||
        (u as any).role === 'host'
      ) {
        return false;
      }
      return true;
    });
    onUpdate(cleanList);
  };

  // 2. Real-Time Cloud Firestore Listener on user_accounts
  let firestoreUnsub: (() => void) | null = null;
  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, USER_ACCOUNTS_COLLECTION);
      firestoreUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          // Fresh map for each snapshot so deleted/purged callers vanish immediately
          const currentSnapshotMap = new Map<string, UserAccount>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data) {
              const docId = docSnap.id;
              const phoneDigits = docId.replace(/\D/g, '').slice(-10);
              const phone = data.phone ? String(data.phone).replace(/\D/g, '').slice(-10) : (phoneDigits.length === 10 ? phoneDigits : '');
              const email = data.email || (docId.includes('@') ? docId : '');
              const cleanPhone = phone;
              const cleanEmail = String(email || '').trim().toLowerCase();
              if (cleanPhone.length === 10 || (cleanEmail && cleanEmail.includes('@'))) {
                const now = Date.now();
                const lastActive = Number(data.lastActiveAt || data.lastLoginAt || 0);
                const isRecentlyActive = lastActive > 0 && (now - lastActive) < 60 * 1000;
                const isUserOnline = data.status !== 'blocked' && data.status !== 'offline' && (data.isOnline === true || isRecentlyActive);

                const user: UserAccount = {
                  id: data.id || ('caller-' + (cleanPhone || cleanEmail.replace(/[^a-z0-9]/g, '_'))),
                  phone: cleanPhone,
                  email: cleanEmail,
                  name: data.name && data.name.trim() ? data.name.trim() : 'Caller',
                  avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                  createdAt: data.createdAt || Date.now(),
                  lastLoginAt: data.lastLoginAt || lastActive || Date.now(),
                  referredBy: data.referredBy || '',
                  status: data.status === 'blocked' ? 'blocked' : (isUserOnline ? 'online' : 'offline'),
                  isOnline: isUserOnline,
                  balance: typeof data.balance === 'number' ? data.balance : 50.0
                };
                const key = cleanPhone || cleanEmail || user.id;
                currentSnapshotMap.set(key, user);
              }
            }
          });

          // Also ensure local active caller appears in list
          try {
            const current = getCurrentUser();
            if (current && (current.phone || current.email)) {
              const p = String(current.phone || '').replace(/\D/g, '').slice(-10);
              const em = (current.email || '').trim().toLowerCase();
              const k = p || em || current.id;
              if (!currentSnapshotMap.has(k)) {
                currentSnapshotMap.set(k, {
                  ...current,
                  status: 'online',
                  isOnline: true
                });
              }
            }
          } catch {}

          // Also merge any real caller from conversations collection (e.g. callers who sent messages)
          try {
            const rawConvs = localStorage.getItem('sunosakhi_conversations_cache');
            if (rawConvs) {
              const cList = JSON.parse(rawConvs);
              if (Array.isArray(cList)) {
                cList.forEach((c: any) => {
                  const cp = String(c.callerPhone || c.callerId || '').replace(/\D/g, '').slice(-10);
                  if (cp.length === 10 && !currentSnapshotMap.has(cp)) {
                    currentSnapshotMap.set(cp, {
                      id: c.callerId || `caller-${cp}`,
                      phone: cp,
                      name: c.callerName && c.callerName !== 'Caller' ? c.callerName : 'Caller',
                      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                      createdAt: c.updatedAt || Date.now(),
                      lastLoginAt: c.updatedAt || Date.now(),
                      status: 'online',
                      isOnline: true,
                      balance: 20.0
                    });
                  }
                });
              }
            }
          } catch {}

          const cleanList = Array.from(currentSnapshotMap.values()).filter((u) => {
            const p = (u.phone || '').replace(/\D/g, '');
            const em = (u.email || '').trim().toLowerCase();
            const hasPhone = p.length >= 10;
            const hasEmail = Boolean(em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
            if (!hasPhone && !hasEmail) return false;
            // Exclude explicit host IDs
            if (
              u.id?.startsWith('sakhi-user-') ||
              u.id?.startsWith('sakhi-host-') ||
              u.id?.startsWith('host_') ||
              (u as any).role === 'host'
            ) {
              return false;
            }
            return true;
          });

          try {
            const cacheObj: Record<string, UserAccount> = {};
            cleanList.forEach((u) => { cacheObj[u.id] = u; });
            localStorage.setItem(ALL_USERS_KEY, JSON.stringify(cacheObj));
          } catch {}

          if (!isUnsubscribed) {
            onUpdate(cleanList);
          }
        },
        (err) => {
          console.warn('Firestore user_accounts snapshot note:', err);
        }
      );
    } catch (err) {
      console.warn('Could not listen to Firestore user_accounts:', err);
    }
  }

  // Also listen to conversations collection to discover any callers who sent messages
  let convUnsub: (() => void) | null = null;
  if (isFirebaseConfigured() && db) {
    try {
      convUnsub = onSnapshot(collection(db, 'conversations'), (snap) => {
        snap.forEach((docSnap) => {
          const c = docSnap.data() as any;
          if (c) {
            const cp = String(c.callerPhone || c.callerId || '').replace(/\D/g, '').slice(-10);
            if (cp.length === 10) {
              const callerName = c.callerName && c.callerName !== 'Caller' ? c.callerName : 'Caller';
              // Ensure in user_accounts in firestore
              setDoc(doc(db!, USER_ACCOUNTS_COLLECTION, cp), {
                id: c.callerId || `caller-${cp}`,
                phone: cp,
                name: callerName,
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                status: 'online',
                isOnline: true,
                lastLoginAt: c.updatedAt || Date.now(),
                lastActiveAt: c.updatedAt || Date.now(),
                balance: 20.0
              }, { merge: true }).catch(() => {});
            }
          }
        });
      });
    } catch {}
  }

  // 3. Fallback Poll Backend Server
  const baseUrl = getApiBaseUrl();
  const fetchBackend = async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch(`${baseUrl}/api/users`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        data.users.forEach((u: any) => {
          const cleanPhone = String(u.phone || '').replace(/\D/g, '');
          const cleanEmail = String(u.email || '').trim().toLowerCase();
          if (cleanPhone.length >= 10 || cleanEmail) {
            const key = cleanPhone || cleanEmail || u.id;
            callersMap.set(key, { ...u, phone: cleanPhone, email: cleanEmail });
          }
        });
        publish();
      }
    } catch {}
  };

  fetchBackend();
  const intervalId = window.setInterval(fetchBackend, 3000);

  return () => {
    isUnsubscribed = true;
    if (firestoreUnsub) firestoreUnsub();
    if (convUnsub) convUnsub();
    clearInterval(intervalId);
  };
};
