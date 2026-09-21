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
 * Subscribe to real-time chat messages for a specific conversation thread or Sakhi.
 */
export const subscribeToCloudChat = (
  threadOrSakhiId: string,
  onUpdate: (messages: ChatMessage[]) => void
): (() => void) => {
  const baseUrl = getApiBaseUrl();

  // 1. Load initial from localStorage cache
  try {
    const stored = localStorage.getItem(`chat_${threadOrSakhiId}`);
    if (stored) {
      onUpdate(JSON.parse(stored));
    }
  } catch {}

  let lastMessagesJson = '';

  // 2. Poll server for real-time messages across devices (fast tick updates)
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
  }, 800);

  return () => {
    clearInterval(intervalId);
  };
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
 * Send a chat message to Server and update conversation summary.
 */
export const sendCloudChatMessage = async (
  threadId: string,
  message: ChatMessage,
  _conversationMeta?: Partial<ConversationItem>
): Promise<boolean> => {
  const enrichedMessage = {
    ...message,
    senderId: message.senderId || getChatClientId()
  };

  // 1. Update local cache
  try {
    const existing = JSON.parse(localStorage.getItem(`chat_${threadId}`) || '[]');
    existing.push(enrichedMessage);
    localStorage.setItem(`chat_${threadId}`, JSON.stringify(existing));
  } catch {}

  // 2. Send to Server Backend for Cross-Device Delivery
  try {
    const baseUrl = getApiBaseUrl();
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
    console.warn('Failed to send message to server:', err);
    return false;
  }
};

/**
 * Mark all incoming messages in a thread as read (turns Single Tick into Double Blue Ticks).
 */
export const markThreadAsRead = async (
  threadId: string,
  reader: 'user' | 'sakhi'
): Promise<void> => {
  try {
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/chat/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, reader })
    });
  } catch (err) {
    console.warn('Failed to mark thread as read:', err);
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
 */
export const subscribeToHostConversations = (
  hostId: string,
  onUpdate: (conversations: ConversationItem[]) => void
): (() => void) => {
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
  const intervalId = window.setInterval(fetchConversations, 1000);

  return () => {
    clearInterval(intervalId);
  };
};

/**
 * Subscribe to all incoming conversations for a Caller (User).
 */
export const subscribeToUserConversations = (
  userPhoneOrId: string,
  onUpdate: (conversations: ConversationItem[]) => void
): (() => void) => {
  const baseUrl = getApiBaseUrl();
  const cleanPhone = String(userPhoneOrId || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone) return () => {};

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
  const intervalId = window.setInterval(fetchConversations, 1000);

  return () => {
    clearInterval(intervalId);
  };
};
