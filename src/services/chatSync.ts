import { collection, doc, setDoc, onSnapshot, increment } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { ChatMessage, ConversationItem } from '../types';
import { getApiBaseUrl, hasExternalApiBackend } from './apiConfig';

const CONVERSATIONS_COLLECTION = 'conversations';

/**
 * Helper to strip undefined fields before writing to Firestore (prevents FirebaseError: Unsupported field value: undefined)
 */
const stripUndefined = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  });
  return clean;
};

/**
 * Extracts a canonical participant key (10-digit phone number if valid, or normalized account/email key)
 */
export const extractChatParticipantKey = (idOrPhone?: string | null): string => {
  if (!idOrPhone) return '';
  const raw = String(idOrPhone).trim();
  if (!raw) return '';

  // If it looks like an email-based ID (e.g. sakhi-host-pw2173398_gmail_com or caller-abc_gmail_com), preserve the email slug
  const lower = raw.toLowerCase();
  if (lower.includes('@') || lower.includes('_gmail_') || lower.includes('_yahoo_') || lower.includes('_outlook_') || lower.includes('_hotmail_')) {
    return lower
      .replace(/^sakhi-user-/, '')
      .replace(/^sakhi-host-/, '')
      .replace(/^host_/, '')
      .replace(/^caller-/, '')
      .replace(/^caller_/, '')
      .replace(/[^a-z0-9_]/g, '_');
  }

  // Otherwise check if it contains a valid 10-digit phone number
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  // Do NOT slice 13-digit timestamps (like user_1728561234567) into fake 10-digit phone numbers
  if (digits.length > 10 && !raw.startsWith('user_') && !raw.startsWith('client_') && !raw.startsWith('msg_')) {
    return digits.slice(-10);
  }

  return lower
    .replace(/^sakhi-user-/, '')
    .replace(/^sakhi-host-/, '')
    .replace(/^host_/, '')
    .replace(/^caller-/, '')
    .replace(/^caller_/, '');
};

/**
 * Generate a consistent, canonical thread identifier between a Sakhi and a Caller.
 * Supports both 10-digit mobile numbers and email/ID-based accounts.
 */
export const getChatThreadId = (sakhiId: string, callerId: string): string => {
  const sRaw = String(sakhiId || '').trim();
  if (sRaw.startsWith('chat_') && !callerId) {
    return sRaw;
  }
  const hostKey = extractChatParticipantKey(sakhiId);
  const callerKey = extractChatParticipantKey(callerId);
  if (hostKey && callerKey) {
    return `chat_${hostKey}_${callerKey}`;
  }
  return `${sakhiId || 'host'}_${callerId || 'caller'}`;
};

/**
 * Given a threadId (e.g. `chat_A_B` or `A_B`), returns candidate thread IDs including the reverse pair
 * so messages are always received even if one side initiated with swapped order or legacy format.
 */
export const getCandidateThreadIds = (threadId: string): string[] => {
  const clean = String(threadId || '').trim();
  if (!clean) return [];
  const candidates = new Set<string>([clean]);

  const withoutPrefix = clean.startsWith('chat_') ? clean.slice(5) : clean;
  const parts = withoutPrefix.split('_');
  if (parts.length === 2 && parts[0] && parts[1]) {
    const [a, b] = parts;
    candidates.add(`chat_${a}_${b}`);
    candidates.add(`chat_${b}_${a}`);
    candidates.add(`${a}_${b}`);
    candidates.add(`${b}_${a}`);
  }
  return Array.from(candidates);
};

/**
 * Unique client / device identifier to distinguish sender vs receiver on separate devices or tabs
 */
export const getChatClientId = (): string => {
  let id = localStorage.getItem('sunosakhi_chat_client_id');
  if (!id) {
    id = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('sunosakhi_chat_client_id', id);
  }
  return id;
};

/**
 * Subscribe to real-time chat messages for a specific conversation thread or Sakhi.
 * Listens across primary and reverse/legacy thread IDs so no message is ever missed.
 */
export const subscribeToCloudChat = (
  threadOrSakhiId: string,
  onUpdate: (messages: ChatMessage[]) => void
): (() => void) => {
  if (!threadOrSakhiId) return () => {};

  const candidateIds = getCandidateThreadIds(threadOrSakhiId);

  // 1. Deliver cached messages immediately
  try {
    const mergedLocal = new Map<string, ChatMessage>();
    candidateIds.forEach((cid) => {
      const stored = localStorage.getItem(`chat_${cid}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: ChatMessage) => {
            if (m && m.text) {
              mergedLocal.set(m.id || `${m.timestamp}_${m.text}`, m);
            }
          });
        }
      }
    });
    if (mergedLocal.size > 0) {
      const sorted = Array.from(mergedLocal.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      onUpdate(sorted);
    }
  } catch {}

  // 2. Direct Cloud Firestore onSnapshot Listeners across candidate thread IDs
  if (isFirebaseConfigured() && db) {
    try {
      const threadMsgsMap: Record<string, ChatMessage[]> = {};
      const unsubs: (() => void)[] = [];

      const publishMerged = () => {
        const dedup = new Map<string, ChatMessage>();
        Object.values(threadMsgsMap).forEach((list) => {
          list.forEach((m) => {
            if (m && m.text) {
              const key = m.id || `${m.timestamp}_${m.text}`;
              dedup.set(key, m);
            }
          });
        });
        const merged = Array.from(dedup.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        try {
          localStorage.setItem(`chat_${threadOrSakhiId}`, JSON.stringify(merged));
        } catch {}
        onUpdate(merged);
      };

      candidateIds.forEach((cid) => {
        const messagesRef = collection(db!, CONVERSATIONS_COLLECTION, cid, 'messages');
        const unsub = onSnapshot(
          messagesRef,
          (snapshot) => {
            const cloudMsgs: ChatMessage[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as ChatMessage;
              if (data && data.text) {
                cloudMsgs.push({
                  ...data,
                  id: docSnap.id
                });
              }
            });
            threadMsgsMap[cid] = cloudMsgs;
            publishMerged();
          },
          (err) => {
            console.warn('Firestore chat onSnapshot note:', err);
          }
        );
        unsubs.push(unsub);
      });

      return () => {
        unsubs.forEach((u) => u());
      };
    } catch (err) {
      console.warn('Error initiating Firestore chat listener:', err);
    }
  }

  // 3. Fallback: Optional Polling ONLY if a custom external backend URL is configured
  if (hasExternalApiBackend()) {
    const baseUrl = getApiBaseUrl();
    let lastMessagesJson = '';
    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`${baseUrl}/api/chat/messages?threadId=${encodeURIComponent(threadOrSakhiId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          const json = JSON.stringify(data.messages);
          if (json !== lastMessagesJson) {
            lastMessagesJson = json;
            localStorage.setItem(`chat_${threadOrSakhiId}`, json);
            onUpdate(data.messages);
          }
        }
      } catch (err) {}
    }, 1500);

    return () => clearInterval(intervalId);
  }

  return () => {};
};

/**
 * Send a chat message to Cloud Firestore and update conversation summary.
 */
export const sendCloudChatMessage = async (
  threadId: string,
  message: ChatMessage,
  _conversationMeta?: Partial<ConversationItem>
): Promise<boolean> => {
  const msgId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const enrichedMessage: ChatMessage = {
    ...message,
    id: msgId,
    senderId: message.senderId || getChatClientId(),
    timestamp: message.timestamp || Date.now(),
    status: message.status || 'sent'
  };

  // 1. Update local cache immediately
  try {
    const existing = JSON.parse(localStorage.getItem(`chat_${threadId}`) || '[]');
    existing.push(enrichedMessage);
    localStorage.setItem(`chat_${threadId}`, JSON.stringify(existing));
  } catch {}

  // 2. Direct Cloud Firestore Storage (Syncs to all devices in <100ms)
  if (isFirebaseConfigured() && db) {
    try {
      const hostKey = extractChatParticipantKey((_conversationMeta as any)?.hostPhone || _conversationMeta?.sakhiId || '');
      const callerKey = extractChatParticipantKey((_conversationMeta as any)?.callerPhone || _conversationMeta?.callerId || '');

      const cleanMsgData = stripUndefined(enrichedMessage as Record<string, any>);

      // Save individual message to subcollection
      await setDoc(
        doc(db, CONVERSATIONS_COLLECTION, threadId, 'messages', msgId),
        cleanMsgData
      );

      const cleanMeta = stripUndefined((_conversationMeta || {}) as Record<string, any>);

      // Update conversation overview document with atomic unread count increment
      await setDoc(
        doc(db, CONVERSATIONS_COLLECTION, threadId),
        {
          ...cleanMeta,
          threadId,
          hostPhone: hostKey || cleanMeta.hostPhone || '',
          callerPhone: callerKey || cleanMeta.callerPhone || '',
          lastMessage: enrichedMessage.text,
          lastSender: enrichedMessage.sender,
          updatedAt: enrichedMessage.timestamp || Date.now(),
          unreadCount: increment(1)
        },
        { merge: true }
      );

      console.log('✅ [ChatSync] Message saved to Cloud Firestore:', threadId, msgId);
      return true;
    } catch (firestoreErr) {
      console.error('❌ Firestore send message error:', firestoreErr);
    }
  }

  // 3. Fallback: Post to local/custom backend if configured
  if (hasExternalApiBackend()) {
    const baseUrl = getApiBaseUrl();
    try {
      await fetch(`${baseUrl}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          message: enrichedMessage
        })
      });
      return true;
    } catch (err) {
      console.warn('Failed to send message to custom server:', err);
    }
  }

  return true;
};

/**
 * Mark all incoming messages in a thread as read.
 */
export const markThreadAsRead = async (
  threadId: string,
  _reader: 'user' | 'sakhi'
): Promise<void> => {
  if (!threadId) return;

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(
        doc(db, CONVERSATIONS_COLLECTION, threadId),
        { unreadCount: 0 },
        { merge: true }
      );
    } catch (err) {}
  }

  if (hasExternalApiBackend()) {
    const baseUrl = getApiBaseUrl();
    try {
      await fetch(`${baseUrl}/api/chat/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, reader: _reader })
      });
    } catch (err) {}
  }
};

/**
 * Request Browser / Device Notification permission for incoming calls and messages
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      }
      return Notification.permission === 'granted';
    }
  } catch (e) {
    console.warn('requestNotificationPermission note:', e);
  }
  return false;
};

/**
 * Display native system/browser popup notification (Works on Android / Desktop)
 */
export const showSystemNotification = (title: string, options?: NotificationOptions): void => {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/suno-sakhi-logo-icon.png',
        badge: '/suno-sakhi-logo-square.png',
        ...options
      });
    }
  } catch (e) {
    console.warn('showSystemNotification note:', e);
  }
};

/**
 * Subscribe to all incoming caller conversations for a specific Host (Sakhi).
 * Listens directly to Cloud Firestore `conversations` collection.
 */
export const subscribeToHostConversations = (
  hostId: string,
  onUpdate: (conversations: ConversationItem[]) => void
): (() => void) => {
  if (!hostId) return () => {};

  const hostKey = extractChatParticipantKey(hostId);

  // 1. Direct Cloud Firestore onSnapshot
  if (isFirebaseConfigured() && db) {
    try {
      const convCol = collection(db, CONVERSATIONS_COLLECTION);
      const unsub = onSnapshot(
        convCol,
        (snapshot) => {
          const dedupByPeer = new Map<string, ConversationItem>();
          snapshot.forEach((docSnap) => {
            const c = docSnap.data() as any;
            if (!c || !c.lastMessage) return;

            const docId = docSnap.id;
            const itemHostKey = extractChatParticipantKey(c.hostPhone || c.sakhiId || '');
            const itemCallerKey = extractChatParticipantKey(c.callerPhone || c.callerId || '');

            const isDirectHostMatch =
              c.sakhiId === hostId ||
              (hostKey && itemHostKey === hostKey) ||
              (hostKey && String(c.threadId || docId).startsWith(`chat_${hostKey}_`)) ||
              (hostKey && String(c.threadId || docId).startsWith(`${hostKey}_`));

            const isReverseMatch =
              hostKey &&
              (itemCallerKey === hostKey ||
                String(c.threadId || docId).endsWith(`_${hostKey}`));

            if (isDirectHostMatch || isReverseMatch) {
              const peerKey = isDirectHostMatch
                ? (itemCallerKey || c.callerId || docId)
                : (itemHostKey || c.sakhiId || docId);

              // Ignore self-chats where host and caller are the exact same number
              if (peerKey === hostKey && itemHostKey === itemCallerKey) return;

              const item: ConversationItem = {
                threadId: c.threadId || docId,
                sakhiId: isDirectHostMatch ? (c.sakhiId || hostId) : (`sakhi-user-${hostKey}`),
                sakhiName: isDirectHostMatch ? c.sakhiName : c.callerName,
                sakhiAvatar: c.sakhiAvatar,
                callerId: isDirectHostMatch ? (c.callerId || `caller_${peerKey}`) : (c.sakhiId || `caller_${peerKey}`),
                callerName: isDirectHostMatch ? (c.callerName || 'Caller') : (c.sakhiName || 'Caller'),
                callerPhone: isDirectHostMatch ? (c.callerPhone || peerKey) : (c.hostPhone || peerKey),
                callerAvatar: c.callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                lastMessage: c.lastMessage || '',
                lastSender: c.lastSender || 'user',
                updatedAt: c.updatedAt || Date.now(),
                unreadCount: c.unreadCount || 0
              };

              const existing = dedupByPeer.get(peerKey);
              if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
                dedupByPeer.set(peerKey, item);
              }
            }
          });

          const list = Array.from(dedupByPeer.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          onUpdate(list);
        },
        (err) => {
          console.warn('Firestore host conversations listener notice:', err);
        }
      );

      return unsub;
    } catch (err) {
      console.warn('Error subscribing to host conversations:', err);
    }
  }

  // 2. Fallback to custom backend ONLY if configured
  if (hasExternalApiBackend()) {
    const baseUrl = getApiBaseUrl();
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/chat/conversations?hostId=${encodeURIComponent(hostId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          onUpdate(data.conversations);
        }
      } catch (err) {}
    };

    fetchConversations();
    const intervalId = window.setInterval(fetchConversations, 1500);
    return () => clearInterval(intervalId);
  }

  return () => {};
};

/**
 * Subscribe to all incoming conversations for a Caller (User).
 * Listens directly to Cloud Firestore `conversations` collection.
 */
export const subscribeToUserConversations = (
  userPhoneOrId: string,
  onUpdate: (conversations: ConversationItem[]) => void
): (() => void) => {
  if (!userPhoneOrId) return () => {};

  const callerKey = extractChatParticipantKey(userPhoneOrId);

  // 1. Direct Cloud Firestore onSnapshot
  if (isFirebaseConfigured() && db) {
    try {
      const convCol = collection(db, CONVERSATIONS_COLLECTION);
      const unsub = onSnapshot(
        convCol,
        (snapshot) => {
          const dedupByPeer = new Map<string, ConversationItem>();
          snapshot.forEach((docSnap) => {
            const c = docSnap.data() as any;
            if (!c || !c.lastMessage) return;

            const docId = docSnap.id;
            const itemCallerKey = extractChatParticipantKey(c.callerPhone || c.callerId || '');
            const itemHostKey = extractChatParticipantKey(c.hostPhone || c.sakhiId || '');

            const isDirectCallerMatch =
              c.callerId === userPhoneOrId ||
              (callerKey && itemCallerKey === callerKey) ||
              (callerKey && String(c.threadId || docId).endsWith(`_${callerKey}`));

            const isReverseMatch =
              callerKey &&
              (itemHostKey === callerKey ||
                String(c.threadId || docId).startsWith(`chat_${callerKey}_`) ||
                String(c.threadId || docId).startsWith(`${callerKey}_`));

            if (isDirectCallerMatch || isReverseMatch) {
              const peerKey = isDirectCallerMatch
                ? (itemHostKey || c.sakhiId || docId)
                : (itemCallerKey || c.callerId || docId);

              if (peerKey === callerKey && itemHostKey === itemCallerKey) return;

              const item: ConversationItem = {
                threadId: c.threadId || docId,
                sakhiId: isDirectCallerMatch ? (c.sakhiId || `sakhi-user-${peerKey}`) : (c.callerId || `sakhi-user-${peerKey}`),
                sakhiName: isDirectCallerMatch ? c.sakhiName : c.callerName,
                sakhiAvatar: c.sakhiAvatar,
                callerId: isDirectCallerMatch ? (c.callerId || `caller_${callerKey}`) : (`caller_${callerKey}`),
                callerName: isDirectCallerMatch ? (c.callerName || 'Caller') : (c.sakhiName || 'Caller'),
                callerPhone: callerKey,
                lastMessage: c.lastMessage || '',
                lastSender: c.lastSender || 'sakhi',
                updatedAt: c.updatedAt || Date.now(),
                unreadCount: c.unreadCount || 0
              };

              const existing = dedupByPeer.get(peerKey);
              if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
                dedupByPeer.set(peerKey, item);
              }
            }
          });

          const list = Array.from(dedupByPeer.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          onUpdate(list);
        },
        (err) => {
          console.warn('Firestore user conversations listener notice:', err);
        }
      );

      return unsub;
    } catch (err) {
      console.warn('Error subscribing to user conversations:', err);
    }
  }

  // 2. Fallback to custom backend ONLY if configured
  if (hasExternalApiBackend() && callerKey) {
    const baseUrl = getApiBaseUrl();
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/chat/conversations?callerPhone=${encodeURIComponent(callerKey)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          onUpdate(data.conversations);
        }
      } catch (err) {}
    };

    fetchConversations();
    const intervalId = window.setInterval(fetchConversations, 1500);
    return () => clearInterval(intervalId);
  }

  return () => {};
};
