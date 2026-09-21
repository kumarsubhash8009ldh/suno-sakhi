import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getApiBaseUrl } from './apiConfig';
import { isPhoneBanned } from './safetyService';

const USER_ACCOUNTS_COLLECTION = 'user_accounts';
const CURRENT_USER_KEY = 'sunosakhi_current_user';
const ALL_USERS_KEY = 'sunosakhi_registered_users';
const STORAGE_KEY_USER_ID = 'sunosakhi_user_id';

// Automatic purge of all old user and host IDs (Strict real accounts only)
if (typeof window !== 'undefined') {
  if (localStorage.getItem('sunosakhi_v9_clean_wipe') !== 'true') {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sunosakhi_') || key.startsWith('chat_'))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('sunosakhi_v9_clean_wipe', 'true');
    console.log('🧹 [STORAGE CLEANUP v9] All legacy user & host data cleared. Only genuine registered accounts will exist.');
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
  status?: 'active' | 'blocked';
  balance?: number;
  sessionToken?: string;
}

export const syncUserToServer = async (user: UserAccount): Promise<boolean> => {
  if (!user || !user.phone || user.phone.length < 10) return false;
  try {
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    return true;
  } catch (err) {
    console.warn('Could not sync user to server:', err);
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
  const displayName = name?.trim() || (cleanPhone ? `Caller ${cleanPhone.slice(-4)}` : `User ${cleanEmail.split('@')[0]}`);

  const newAccount: UserAccount = {
    id: userId,
    phone: cleanPhone,
    email: cleanEmail,
    name: displayName,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    referredBy: referredBy || undefined,
    status: 'active',
    balance: 50.0
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
  broadcastAuthChange();

  return { success: true, user: newAccount };
};

/**
 * Login existing caller user with phone number or email.
 */
export const loginExistingUser = async (
  phoneOrEmail: string,
  name?: string
): Promise<{ success: boolean; user?: UserAccount; isHost?: boolean; host?: any; error?: string }> => {
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
        broadcastAuthChange();
        return { success: true, isHost: false, user: data.user };
      }
    }
  } catch (err) {}

  // 2. Check local registry
  const existing = await getUserAccount(parsed.value);
  if (existing) {
    existing.lastLoginAt = Date.now();
    if (name && name.trim()) {
      existing.name = name.trim();
    }
    saveUserToLocalRegistry(existing);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(existing));
    localStorage.setItem(STORAGE_KEY_USER_ID, existing.id);
    localStorage.removeItem('sunosakhi_host_logged_in');
    localStorage.removeItem('sunosakhi_host_profile');
    setActiveRole('caller');
    syncUserToServer(existing);
    broadcastAuthChange();
    return { success: true, isHost: false, user: existing };
  }

  // 3. Auto-create caller account if not found
  return registerNewUser(phoneOrEmail, name);
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
            name: host?.name && host.name !== 'Sakhi Host' ? host.name : `Host ${hostPhone.slice(-4) || 'Sakhi'}`,
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
          name: caller.name || (cleanPhone ? `Caller ${cleanPhone.slice(-4)}` : `User ${cleanEmail.split('@')[0]}`),
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
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data) {
              const docId = docSnap.id;
              const phone = data.phone || (/^\d{10}$/.test(docId) ? docId : '');
              const email = data.email || (docId.includes('@') ? docId : '');
              const cleanPhone = String(phone || '').replace(/\D/g, '');
              const cleanEmail = String(email || '').trim().toLowerCase();
              if (cleanPhone.length >= 10 || (cleanEmail && cleanEmail.includes('@'))) {
                const user: UserAccount = {
                  id: data.id || ('caller-' + (cleanPhone || cleanEmail.replace(/[^a-z0-9]/g, '_'))),
                  phone: cleanPhone,
                  email: cleanEmail,
                  name: data.name || (cleanPhone ? `Caller ${cleanPhone.slice(-4)}` : `User ${cleanEmail.split('@')[0]}`),
                  avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                  createdAt: data.createdAt || Date.now(),
                  lastLoginAt: data.lastLoginAt || Date.now(),
                  referredBy: data.referredBy || '',
                  status: data.status || 'active',
                  balance: typeof data.balance === 'number' ? data.balance : 50.0
                };
                const key = cleanPhone || cleanEmail || user.id;
                callersMap.set(key, user);
              }
            }
          });
          publish();
        },
        (err) => {
          console.warn('Firestore user_accounts snapshot note:', err);
        }
      );
    } catch (err) {
      console.warn('Could not listen to Firestore user_accounts:', err);
    }
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
    clearInterval(intervalId);
  };
};
