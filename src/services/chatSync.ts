import { collection, doc, setDoc, onSnapshot, getDocs, increment } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { ChatMessage, ConversationItem } from '../types';
import { getApiBaseUrl } from './apiConfig';

const CONVERSATIONS_COLLECTION = 'conversations';

/**
 * Generate a consistent, canonical thread identifier between a Sakhi and a Caller.
 * Groups by 10-digit mobile numbers so that all messages from the same user always
 * stay in the EXACT SAME message box without creating duplicate threads.
 */
export const getChatThreadId = (sakhiId: string, callerId: string): string => {
  const hostDigits = String(sakhiId || '').replace(/\D/g, '');
  const callerDigits = String(callerId || '').replace(/\D/g, '');
  if (hostDigits.length >= 10 && callerDigits.length >= 10) {
    const cleanHost = hostDigits.slice(-10);
    const cleanCaller = callerDigits.slice(-10);
    return `chat_${cleanHost}_${cleanCaller}`;
  }
  return `${sakhiId}_${callerId}`;
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
 * Uses direct Cloud Firestore listener with instant local storage fallback.
 */
export const subscribeToCloudChat = (
  threadOrSakhiId: string,
  onUpdate: (messages: ChatMessage[]) => void
): (() => void) => {
  if (!threadOrSakhiId) return () => {};

  // 1. Deliver cached messages immediately
  try {
    const stored = localStorage.getItem(`chat_${threadOrSakhiId}`);
    if (stored) {
      onUpdate(JSON.parse(stored));
    }
  } catch {}

  // 2. Direct Cloud Firestore onSnapshot Listener (Zero external server dependency)
  if (isFirebaseConfigured() && db) {
    try {
      const messagesRef = collection(db, CONVERSATIONS_COLLECTION, threadOrSakhiId, 'messages');
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

          // Sort chronologically
          cloudMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

          try {
            localStorage.setItem(`chat_${threadOrSakhiId}`, JSON.stringify(cloudMsgs));
          } catch {}

          onUpdate(cloudMsgs);
        },
        (err) => {
          console.warn('Firestore chat onSnapshot note:', err);
        }
      );

      return unsub;
    } catch (err) {
      console.warn('Error initiating Firestore chat listener:', err);
    }
  }

  // 3. Fallback: Optional Polling if a custom backend URL is configured
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
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
    }, 1200);

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
      const hostDigits = String((_conversationMeta as any)?.hostPhone || _conversationMeta?.sakhiId || threadId).replace(/\D/g, '').slice(-10);
      const callerDigits = String((_conversationMeta as any)?.callerPhone || _conversationMeta?.callerId || threadId).replace(/\D/g, '').slice(-10);

      // Save individual message to subcollection
      await setDoc(
        doc(db, CONVERSATIONS_COLLECTION, threadId, 'messages', msgId),
        enrichedMessage
      );

      // Update conversation overview document with atomic unread count increment
      await setDoc(
        doc(db, CONVERSATIONS_COLLECTION, threadId),
        {
          threadId,
          ...(_conversationMeta || {}),
          hostPhone: hostDigits,
          callerPhone: callerDigits,
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
      console.warn('Firestore send message error:', firestoreErr);
    }
  }

  // 3. Fallback: Post to local/custom backend if configured
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
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

  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
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

  const cleanHost = String(hostId).replace(/\D/g, '').slice(-10);

  // 1. Direct Cloud Firestore onSnapshot
  if (isFirebaseConfigured() && db) {
    try {
      const convCol = collection(db, CONVERSATIONS_COLLECTION);
      const unsub = onSnapshot(
        convCol,
        (snapshot) => {
          const list: ConversationItem[] = [];
          snapshot.forEach((docSnap) => {
            const c = docSnap.data() as any;
            if (!c || !c.lastMessage) return;

            const itemHostDigits = String(c.hostPhone || c.sakhiId || '').replace(/\D/g, '').slice(-10);
            const isMatch = (
              c.sakhiId === hostId ||
              (cleanHost && itemHostDigits === cleanHost) ||
              (cleanHost && String(c.threadId || '').includes(cleanHost)) ||
              (cleanHost && String(c.hostPhone || '').includes(cleanHost))
            );

            if (isMatch) {
              list.push({
                threadId: docSnap.id,
                sakhiId: c.sakhiId || hostId,
                sakhiName: c.sakhiName,
                sakhiAvatar: c.sakhiAvatar,
                callerId: c.callerId || '',
                callerName: c.callerName || 'Caller',
                callerPhone: c.callerPhone || '',
                callerAvatar: c.callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
                lastMessage: c.lastMessage || '',
                lastSender: c.lastSender || 'user',
                updatedAt: c.updatedAt || Date.now(),
                unreadCount: c.unreadCount || 0
              });
            }
          });

          // Sort by latest message first
          list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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

  // 2. Fallback to custom backend if configured
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
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

  const cleanPhone = String(userPhoneOrId).replace(/\D/g, '').slice(-10);

  // 1. Direct Cloud Firestore onSnapshot
  if (isFirebaseConfigured() && db) {
    try {
      const convCol = collection(db, CONVERSATIONS_COLLECTION);
      const unsub = onSnapshot(
        convCol,
        (snapshot) => {
          const list: ConversationItem[] = [];
          snapshot.forEach((docSnap) => {
            const c = docSnap.data() as any;
            if (!c || !c.lastMessage) return;

            const itemCallerDigits = String(c.callerPhone || c.callerId || '').replace(/\D/g, '').slice(-10);
            const isMatch = (
              cleanPhone &&
              (itemCallerDigits === cleanPhone || String(c.threadId || '').includes(cleanPhone))
            );

            if (isMatch) {
              list.push({
                threadId: docSnap.id,
                sakhiId: c.sakhiId || '',
                sakhiName: c.sakhiName,
                sakhiAvatar: c.sakhiAvatar,
                callerId: c.callerId || '',
                callerName: c.callerName || 'Caller',
                callerPhone: c.callerPhone || cleanPhone,
                lastMessage: c.lastMessage || '',
                lastSender: c.lastSender || 'sakhi',
                updatedAt: c.updatedAt || Date.now(),
                unreadCount: c.unreadCount || 0
              });
            }
          });

          list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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

  // 2. Fallback to custom backend if configured
  const baseUrl = getApiBaseUrl();
  if (baseUrl && cleanPhone) {
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/chat/conversations?callerPhone=${encodeURIComponent(cleanPhone)}`);
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
