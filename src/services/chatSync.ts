import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, increment } from 'firebase/firestore';
import {
  ref as rtdbRef,
  set as rtdbSet,
  update as rtdbUpdate,
  get as rtdbGet,
  onValue as rtdbOnValue,
  increment as rtdbIncrement
} from 'firebase/database';
import { db, rtdb, isFirebaseConfigured } from './firebase';
import { ChatMessage, ConversationItem } from '../types';
import { getApiBaseUrl, hasExternalApiBackend } from './apiConfig';

const CONVERSATIONS_COLLECTION = 'conversations';
const RTDB_CONVERSATIONS_META = 'conversations_meta';
const RTDB_CONVERSATIONS_MESSAGES = 'conversations_messages';

// Instant cross-tab & same-device real-time chat channel (<1ms latency)
const chatBroadcastChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('sunosakhi_realtime_chat_v2')
    : null;

/**
 * Helper to strip undefined fields before writing to Firebase (prevents FirebaseError: Unsupported field value: undefined)
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

  const lower = raw.toLowerCase();
  const stripped = lower.replace(
    /^(sakhi-user-|sakhi-host-|sakhi-email-|host_|host-|caller-|caller_|user_|user-|email_|email-)+/,
    ''
  );

  // If it contains '@' or letters (e.g. angelbathla05_gmail_com, drishti_a1426_gmail_com), preserve the normalized slug
  if (
    stripped.includes('@') ||
    /[a-z]/.test(stripped)
  ) {
    return stripped.replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  }

  // Otherwise check if it contains a valid 10-digit phone number
  const digits = stripped.replace(/\D/g, '');
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
  if (digits.length > 10 && !lower.startsWith('user_') && !lower.startsWith('client_') && !lower.startsWith('msg_')) {
    return digits.slice(-10);
  }

  return stripped.replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
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
 * so messages are always received even if one side initiated with swapped order or email slugs containing underscores.
 */
export const getCandidateThreadIds = (threadId: string): string[] => {
  const clean = String(threadId || '').trim();
  if (!clean) return [];
  const candidates = new Set<string>([clean]);

  const addPairVariants = (a: string, b: string) => {
    if (!a || !b) return;
    candidates.add(`chat_${a}_${b}`);
    candidates.add(`chat_${b}_${a}`);
    candidates.add(`${a}_${b}`);
    candidates.add(`${b}_${a}`);
  };

  const withoutPrefix = clean.startsWith('chat_') ? clean.slice(5) : clean;
  const parts = withoutPrefix.split('_');

  if (parts.length === 2 && parts[0] && parts[1]) {
    addPairVariants(parts[0], parts[1]);
  } else if (parts.length > 2) {
    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];
    // Case 1: trailing numeric phone/ID (e.g. angelbathla05_gmail_com_8290778573)
    if (/^\d{7,15}$/.test(lastPart)) {
      addPairVariants(parts.slice(0, -1).join('_'), lastPart);
    }
    // Case 2: leading numeric phone/ID (e.g. 8290778573_angelbathla05_gmail_com)
    if (/^\d{7,15}$/.test(firstPart)) {
      addPairVariants(firstPart, parts.slice(1).join('_'));
    }
    // Case 3: two email slugs joined by underscore (e.g. user1_gmail_com_user2_gmail_com)
    const emailSplitMatch = withoutPrefix.match(/^(.+?_(?:com|in|org|net|co|io|edu|me))_(.+)$/);
    if (emailSplitMatch && emailSplitMatch[1] && emailSplitMatch[2]) {
      addPairVariants(emailSplitMatch[1], emailSplitMatch[2]);
    }
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
 * Listens across Firebase Realtime Database (<25ms), BroadcastChannel (<1ms), and Cloud Firestore across candidate thread IDs.
 */
export const subscribeToCloudChat = (
  threadOrSakhiId: string,
  onUpdate: (messages: ChatMessage[]) => void
): (() => void) => {
  if (!threadOrSakhiId) return () => {};

  const candidateIds = getCandidateThreadIds(threadOrSakhiId);
  const candidateSet = new Set(candidateIds);
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

  // 1. Deliver cached messages immediately
  try {
    const cachedMsgs: ChatMessage[] = [];
    candidateIds.forEach((cid) => {
      const stored = localStorage.getItem(`chat_${cid}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: ChatMessage) => {
            if (m && m.text) {
              cachedMsgs.push(m);
            }
          });
        }
      }
    });
    if (cachedMsgs.length > 0) {
      threadMsgsMap['local_cache'] = cachedMsgs;
      publishMerged();
    }
  } catch {}

  // 2. BroadcastChannel listener for instant <1ms cross-tab updates
  if (chatBroadcastChannel) {
    const bcHandler = (ev: MessageEvent) => {
      const payload = ev.data;
      if (payload?.type === 'NEW_MESSAGE' && payload.message && candidateSet.has(payload.threadId)) {
        const currentList = threadMsgsMap[`bc_${payload.threadId}`] || [];
        threadMsgsMap[`bc_${payload.threadId}`] = [...currentList, payload.message];
        publishMerged();
      }
    };
    chatBroadcastChannel.addEventListener('message', bcHandler);
    unsubs.push(() => chatBroadcastChannel.removeEventListener('message', bcHandler));
  }

  // 3. Firebase Realtime Database (RTDB) low-latency listeners (<25ms)
  if (rtdb) {
    candidateIds.forEach((cid) => {
      try {
        const msgRef = rtdbRef(rtdb!, `${RTDB_CONVERSATIONS_MESSAGES}/${cid}`);
        const unsubRtdb = rtdbOnValue(
          msgRef,
          (snapshot) => {
            const val = snapshot.val();
            const rtdbMsgs: ChatMessage[] = [];
            if (val && typeof val === 'object') {
              Object.entries(val).forEach(([msgKey, rawMsg]: [string, any]) => {
                if (rawMsg && rawMsg.text) {
                  rtdbMsgs.push({
                    ...rawMsg,
                    id: rawMsg.id || msgKey
                  });
                }
              });
            }
            threadMsgsMap[`rtdb_${cid}`] = rtdbMsgs;
            publishMerged();
          },
          (err) => {
            console.warn('RTDB chat listener note:', err);
          }
        );
        unsubs.push(unsubRtdb);
      } catch (e) {
        console.warn('Error attaching RTDB chat listener:', e);
      }
    });
  }

  // 4. Direct Cloud Firestore onSnapshot Listeners across candidate thread IDs
  if (isFirebaseConfigured() && db) {
    try {
      candidateIds.forEach((cid) => {
        const messagesRef = collection(db!, CONVERSATIONS_COLLECTION, cid, 'messages');
        const unsubFs = onSnapshot(
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
            threadMsgsMap[`fs_${cid}`] = cloudMsgs;
            publishMerged();
          },
          () => {}
        );
        unsubs.push(unsubFs);
      });
    } catch (err) {
      console.warn('Error initiating Firestore chat listener:', err);
    }
  }

  // 5. Fallback: Optional Polling ONLY if a custom external backend URL is configured
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
            threadMsgsMap['api_poll'] = data.messages;
            publishMerged();
          }
        }
      } catch (err) {}
    }, 1500);

    unsubs.push(() => clearInterval(intervalId));
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};

/**
 * Send a chat message to Firebase Realtime Database, BroadcastChannel, and Cloud Firestore simultaneously.
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

  const hostKey = extractChatParticipantKey((_conversationMeta as any)?.hostPhone || _conversationMeta?.sakhiId || '');
  const callerKey = extractChatParticipantKey((_conversationMeta as any)?.callerPhone || _conversationMeta?.callerId || '');
  const cleanMsgData = stripUndefined(enrichedMessage as Record<string, any>);
  const cleanMeta = stripUndefined((_conversationMeta || {}) as Record<string, any>);

  const metaPayload = {
    ...cleanMeta,
    threadId,
    hostPhone: hostKey || cleanMeta.hostPhone || '',
    callerPhone: callerKey || cleanMeta.callerPhone || '',
    lastMessage: enrichedMessage.text,
    lastSender: enrichedMessage.sender,
    updatedAt: enrichedMessage.timestamp || Date.now()
  };

  // 1. Update local cache immediately
  try {
    const existing: ChatMessage[] = JSON.parse(localStorage.getItem(`chat_${threadId}`) || '[]');
    const filtered = existing.filter((m) => m.id !== msgId);
    filtered.push(enrichedMessage);
    localStorage.setItem(`chat_${threadId}`, JSON.stringify(filtered));
  } catch {}

  // 2. Broadcast across local tabs/windows in <1ms
  try {
    chatBroadcastChannel?.postMessage({
      type: 'NEW_MESSAGE',
      threadId,
      message: enrichedMessage,
      meta: metaPayload
    });
  } catch {}

  const writePromises: Promise<any>[] = [];

  // 3. Primary Real-Time Sync: Firebase Realtime Database (<25ms)
  if (rtdb) {
    const rtdbMsgPromise = rtdbSet(
      rtdbRef(rtdb, `${RTDB_CONVERSATIONS_MESSAGES}/${threadId}/${msgId}`),
      cleanMsgData
    );
    const rtdbMetaPromise = rtdbUpdate(
      rtdbRef(rtdb, `${RTDB_CONVERSATIONS_META}/${threadId}`),
      {
        ...metaPayload,
        unreadCount: rtdbIncrement(1)
      }
    );
    writePromises.push(rtdbMsgPromise, rtdbMetaPromise);
  }

  // 4. Secondary Cloud Sync: Cloud Firestore
  if (isFirebaseConfigured() && db) {
    const fsMsgPromise = setDoc(
      doc(db, CONVERSATIONS_COLLECTION, threadId, 'messages', msgId),
      cleanMsgData
    );
    const fsMetaPromise = setDoc(
      doc(db, CONVERSATIONS_COLLECTION, threadId),
      {
        ...metaPayload,
        unreadCount: increment(1)
      },
      { merge: true }
    );
    writePromises.push(fsMsgPromise, fsMetaPromise);
  }

  if (writePromises.length > 0) {
    const results = await Promise.allSettled(writePromises);
    const anySucceeded = results.some((r) => r.status === 'fulfilled');
    if (anySucceeded) {
      return true;
    }
  }

  // 5. Fallback: Post to local/custom backend if configured
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
 * Mark all incoming messages in a thread as read without creating empty ghost documents.
 */
export const markThreadAsRead = async (
  threadId: string,
  _reader: 'user' | 'sakhi'
): Promise<void> => {
  if (!threadId) return;

  const candidateIds = getCandidateThreadIds(threadId);

  try {
    chatBroadcastChannel?.postMessage({
      type: 'MARK_READ',
      threadId
    });
  } catch {}

  if (rtdb) {
    try {
      await Promise.allSettled(
        candidateIds.map(async (cid) => {
          const metaRef = rtdbRef(rtdb!, `${RTDB_CONVERSATIONS_META}/${cid}`);
          const snap = await rtdbGet(metaRef);
          if (snap.exists()) {
            await rtdbUpdate(metaRef, { unreadCount: 0 });
          }
        })
      );
    } catch {}
  }

  if (isFirebaseConfigured() && db) {
    try {
      await Promise.allSettled(
        candidateIds.map((cid) =>
          updateDoc(doc(db!, CONVERSATIONS_COLLECTION, cid), { unreadCount: 0 }).catch(() => {})
        )
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
 * Listens across Firebase Realtime Database (`conversations_meta`), BroadcastChannel, and Cloud Firestore `conversations`.
 */
export const subscribeToHostConversations = (
  hostInput: string | string[],
  onUpdate: (conversations: ConversationItem[]) => void
): (() => void) => {
  const rawList = (Array.isArray(hostInput) ? hostInput : [hostInput])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (rawList.length === 0) return () => {};

  const hostRawSet = new Set<string>(rawList);
  const hostKeySet = new Set<string>();
  rawList.forEach((item) => {
    const k = extractChatParticipantKey(item);
    if (k) hostKeySet.add(k);
  });
  const primaryHostKey = Array.from(hostKeySet)[0] || extractChatParticipantKey(rawList[0]);
  const primaryHostId = rawList[0];

  const sourceDocs: Record<string, Record<string, any>> = {
    rtdb: {},
    fs: {},
    bc: {}
  };
  const unsubs: (() => void)[] = [];

  const recomputeAndPublish = () => {
    const combinedDocs = new Map<string, any>();
    ['fs', 'rtdb', 'bc'].forEach((sourceKey) => {
      const mapObj = sourceDocs[sourceKey] || {};
      Object.entries(mapObj).forEach(([docId, c]) => {
        if (!c || !c.lastMessage) return;
        const existing = combinedDocs.get(docId);
        if (!existing || (c.updatedAt || 0) >= (existing.updatedAt || 0)) {
          combinedDocs.set(docId, c);
        }
      });
    });

    const dedupByPeer = new Map<string, ConversationItem>();
    combinedDocs.forEach((c, docId) => {
      const threadStr = String(c.threadId || docId);
      const itemHostKey = extractChatParticipantKey(c.hostPhone || c.sakhiId || '');
      const itemCallerKey = extractChatParticipantKey(c.callerPhone || c.callerId || '');

      let isDirectHostMatch = Boolean(c.sakhiId && hostRawSet.has(c.sakhiId));
      let isReverseMatch = false;

      hostKeySet.forEach((hk) => {
        if (
          itemHostKey === hk ||
          threadStr.startsWith(`chat_${hk}_`) ||
          threadStr.startsWith(`${hk}_`)
        ) {
          isDirectHostMatch = true;
        }
        if (itemCallerKey === hk || threadStr.endsWith(`_${hk}`)) {
          isReverseMatch = true;
        }
      });

      if (isDirectHostMatch || isReverseMatch) {
        const peerKey = isDirectHostMatch
          ? (itemCallerKey || c.callerId || docId)
          : (itemHostKey || c.sakhiId || docId);

        // Ignore self-chats where host and caller are the exact same key
        if (hostKeySet.has(peerKey) && itemHostKey === itemCallerKey) return;

        const item: ConversationItem = {
          threadId: c.threadId || docId,
          sakhiId: isDirectHostMatch ? (c.sakhiId || primaryHostId) : (`sakhi-user-${primaryHostKey}`),
          sakhiName: isDirectHostMatch ? c.sakhiName : c.callerName,
          sakhiAvatar: c.sakhiAvatar,
          hostPhone: primaryHostKey,
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
  };

  // 1. BroadcastChannel listener
  if (chatBroadcastChannel) {
    const bcHandler = (ev: MessageEvent) => {
      const payload = ev.data;
      if (payload?.type === 'NEW_MESSAGE' && payload.meta && payload.threadId) {
        const prev = sourceDocs.bc[payload.threadId] || {};
        sourceDocs.bc[payload.threadId] = {
          ...prev,
          ...payload.meta,
          unreadCount: (prev.unreadCount || 0) + 1
        };
        recomputeAndPublish();
      } else if (payload?.type === 'MARK_READ' && payload.threadId) {
        if (sourceDocs.bc[payload.threadId]) {
          sourceDocs.bc[payload.threadId].unreadCount = 0;
        }
        if (sourceDocs.rtdb[payload.threadId]) {
          sourceDocs.rtdb[payload.threadId].unreadCount = 0;
        }
        if (sourceDocs.fs[payload.threadId]) {
          sourceDocs.fs[payload.threadId].unreadCount = 0;
        }
        recomputeAndPublish();
      }
    };
    chatBroadcastChannel.addEventListener('message', bcHandler);
    unsubs.push(() => chatBroadcastChannel.removeEventListener('message', bcHandler));
  }

  // 2. Firebase Realtime Database (RTDB) listener
  if (rtdb) {
    try {
      const metaRef = rtdbRef(rtdb, RTDB_CONVERSATIONS_META);
      const unsubRtdb = rtdbOnValue(
        metaRef,
        (snapshot) => {
          const val = snapshot.val();
          const nextMap: Record<string, any> = {};
          if (val && typeof val === 'object') {
            Object.entries(val).forEach(([docId, c]: [string, any]) => {
              if (c && c.lastMessage) {
                nextMap[docId] = c;
              }
            });
          }
          sourceDocs.rtdb = nextMap;
          recomputeAndPublish();
        },
        (err) => {
          console.warn('RTDB host conversations listener note:', err);
        }
      );
      unsubs.push(unsubRtdb);
    } catch (e) {
      console.warn('Error subscribing to RTDB host conversations:', e);
    }
  }

  // 3. Direct Cloud Firestore onSnapshot
  if (isFirebaseConfigured() && db) {
    try {
      const convCol = collection(db, CONVERSATIONS_COLLECTION);
      const unsubFs = onSnapshot(
        convCol,
        (snapshot) => {
          const nextMap: Record<string, any> = {};
          snapshot.forEach((docSnap) => {
            const c = docSnap.data() as any;
            if (!c || !c.lastMessage) {
              if (db && c && !c.lastMessage && Object.keys(c).length <= 2) {
                deleteDoc(doc(db, CONVERSATIONS_COLLECTION, docSnap.id)).catch(() => {});
              }
              return;
            }
            nextMap[docSnap.id] = c;
          });
          sourceDocs.fs = nextMap;
          recomputeAndPublish();
        },
        () => {}
      );
      unsubs.push(unsubFs);
    } catch (err) {
      console.warn('Error subscribing to host conversations:', err);
    }
  }

  // 4. Fallback to custom backend ONLY if configured
  if (hasExternalApiBackend()) {
    const baseUrl = getApiBaseUrl();
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/chat/conversations?hostId=${encodeURIComponent(primaryHostId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          onUpdate(data.conversations);
        }
      } catch (err) {}
    };

    fetchConversations();
    const intervalId = window.setInterval(fetchConversations, 1500);
    unsubs.push(() => clearInterval(intervalId));
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};

/**
 * Subscribe to all incoming conversations for a Caller (User).
 * Listens across Firebase Realtime Database (`conversations_meta`), BroadcastChannel, and Cloud Firestore `conversations`.
 */
export const subscribeToUserConversations = (
  userInput: string | string[],
  onUpdate: (conversations: ConversationItem[]) => void
): (() => void) => {
  const rawList = (Array.isArray(userInput) ? userInput : [userInput])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (rawList.length === 0) return () => {};

  const callerRawSet = new Set<string>(rawList);
  const callerKeySet = new Set<string>();
  rawList.forEach((item) => {
    const k = extractChatParticipantKey(item);
    if (k) callerKeySet.add(k);
  });
  const primaryCallerKey = Array.from(callerKeySet)[0] || extractChatParticipantKey(rawList[0]);

  const sourceDocs: Record<string, Record<string, any>> = {
    rtdb: {},
    fs: {},
    bc: {}
  };
  const unsubs: (() => void)[] = [];

  const recomputeAndPublish = () => {
    const combinedDocs = new Map<string, any>();
    ['fs', 'rtdb', 'bc'].forEach((sourceKey) => {
      const mapObj = sourceDocs[sourceKey] || {};
      Object.entries(mapObj).forEach(([docId, c]) => {
        if (!c || !c.lastMessage) return;
        const existing = combinedDocs.get(docId);
        if (!existing || (c.updatedAt || 0) >= (existing.updatedAt || 0)) {
          combinedDocs.set(docId, c);
        }
      });
    });

    const dedupByPeer = new Map<string, ConversationItem>();
    combinedDocs.forEach((c, docId) => {
      const threadStr = String(c.threadId || docId);
      const itemCallerKey = extractChatParticipantKey(c.callerPhone || c.callerId || '');
      const itemHostKey = extractChatParticipantKey(c.hostPhone || c.sakhiId || '');

      let isDirectCallerMatch = Boolean(c.callerId && callerRawSet.has(c.callerId));
      let isReverseMatch = false;

      callerKeySet.forEach((ck) => {
        if (itemCallerKey === ck || threadStr.endsWith(`_${ck}`)) {
          isDirectCallerMatch = true;
        }
        if (
          itemHostKey === ck ||
          threadStr.startsWith(`chat_${ck}_`) ||
          threadStr.startsWith(`${ck}_`)
        ) {
          isReverseMatch = true;
        }
      });

      if (isDirectCallerMatch || isReverseMatch) {
        const peerKey = isDirectCallerMatch
          ? (itemHostKey || c.sakhiId || docId)
          : (itemCallerKey || c.callerId || docId);

        if (callerKeySet.has(peerKey) && itemHostKey === itemCallerKey) return;

        const item: ConversationItem = {
          threadId: c.threadId || docId,
          sakhiId: isDirectCallerMatch ? (c.sakhiId || `sakhi-user-${peerKey}`) : (c.callerId || `sakhi-user-${peerKey}`),
          sakhiName: isDirectCallerMatch ? (c.sakhiName || 'Sakhi') : (c.callerName || c.sakhiName || 'Sakhi'),
          sakhiAvatar: c.sakhiAvatar,
          hostPhone: isDirectCallerMatch ? (c.hostPhone || peerKey) : (c.callerPhone || peerKey),
          callerId: isDirectCallerMatch ? (c.callerId || `caller_${primaryCallerKey}`) : (`caller_${primaryCallerKey}`),
          callerName: isDirectCallerMatch ? (c.callerName || 'Caller') : (c.sakhiName || 'Caller'),
          callerPhone: primaryCallerKey,
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
  };

  // 1. BroadcastChannel listener
  if (chatBroadcastChannel) {
    const bcHandler = (ev: MessageEvent) => {
      const payload = ev.data;
      if (payload?.type === 'NEW_MESSAGE' && payload.meta && payload.threadId) {
        const prev = sourceDocs.bc[payload.threadId] || {};
        sourceDocs.bc[payload.threadId] = {
          ...prev,
          ...payload.meta,
          unreadCount: (prev.unreadCount || 0) + 1
        };
        recomputeAndPublish();
      } else if (payload?.type === 'MARK_READ' && payload.threadId) {
        if (sourceDocs.bc[payload.threadId]) {
          sourceDocs.bc[payload.threadId].unreadCount = 0;
        }
        if (sourceDocs.rtdb[payload.threadId]) {
          sourceDocs.rtdb[payload.threadId].unreadCount = 0;
        }
        if (sourceDocs.fs[payload.threadId]) {
          sourceDocs.fs[payload.threadId].unreadCount = 0;
        }
        recomputeAndPublish();
      }
    };
    chatBroadcastChannel.addEventListener('message', bcHandler);
    unsubs.push(() => chatBroadcastChannel.removeEventListener('message', bcHandler));
  }

  // 2. Firebase Realtime Database (RTDB) listener
  if (rtdb) {
    try {
      const metaRef = rtdbRef(rtdb, RTDB_CONVERSATIONS_META);
      const unsubRtdb = rtdbOnValue(
        metaRef,
        (snapshot) => {
          const val = snapshot.val();
          const nextMap: Record<string, any> = {};
          if (val && typeof val === 'object') {
            Object.entries(val).forEach(([docId, c]: [string, any]) => {
              if (c && c.lastMessage) {
                nextMap[docId] = c;
              }
            });
          }
          sourceDocs.rtdb = nextMap;
          recomputeAndPublish();
        },
        (err) => {
          console.warn('RTDB user conversations listener note:', err);
        }
      );
      unsubs.push(unsubRtdb);
    } catch (e) {
      console.warn('Error subscribing to RTDB user conversations:', e);
    }
  }

  // 3. Direct Cloud Firestore onSnapshot
  if (isFirebaseConfigured() && db) {
    try {
      const convCol = collection(db, CONVERSATIONS_COLLECTION);
      const unsubFs = onSnapshot(
        convCol,
        (snapshot) => {
          const nextMap: Record<string, any> = {};
          snapshot.forEach((docSnap) => {
            const c = docSnap.data() as any;
            if (!c || !c.lastMessage) return;
            nextMap[docSnap.id] = c;
          });
          sourceDocs.fs = nextMap;
          recomputeAndPublish();
        },
        () => {}
      );
      unsubs.push(unsubFs);
    } catch (err) {
      console.warn('Error subscribing to user conversations:', err);
    }
  }

  // 4. Fallback to custom backend ONLY if configured
  if (hasExternalApiBackend() && primaryCallerKey) {
    const baseUrl = getApiBaseUrl();
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/chat/conversations?callerPhone=${encodeURIComponent(primaryCallerKey)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          onUpdate(data.conversations);
        }
      } catch (err) {}
    };

    fetchConversations();
    const intervalId = window.setInterval(fetchConversations, 1500);
    unsubs.push(() => clearInterval(intervalId));
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};
