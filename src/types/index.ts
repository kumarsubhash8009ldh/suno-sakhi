export type CallType = 'voice' | 'video';

export interface Sakhi {
  id: string;
  name: string;
  age: number;
  city: string;
  avatar: string;
  videoPoster: string;
  status: 'online' | 'busy' | 'offline';
  rating: number;
  totalCalls: number;
  languages: string[];
  bio: string;
  interests: string[];
  voiceRatePerMin: number; // ₹5
  videoRatePerMin: number; // ₹10
  audioSnippet: string;
  tagline: string;
  gender?: 'female';
  isVerified?: boolean;
  upiId?: string;
  phone?: string;
  email?: string;
}

export type CallStatus = 'idle' | 'calling' | 'connected' | 'ended';

export interface CallSession {
  sakhi: Sakhi;
  type: CallType;
  startTime: number;
  durationSeconds: number;
  ratePerMin: number;
  totalCost: number;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: number;
  callType?: CallType;
  sakhiName?: string;
}

export interface RechargePack {
  id: string;
  amount: number;
  bonus: number;
  popular?: boolean;
  bestValue?: boolean;
  voiceMinutes: number;
  videoMinutes: number;
}

// Host & Gift Types
export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  description: string;
}

export interface ActiveGiftAnimation {
  id: string;
  gift: GiftItem;
  senderName: string;
  timestamp: number;
}

export interface HostIncomeRecord {
  id: string;
  type: 'call' | 'gift' | 'message' | 'incentive';
  description: string;
  grossAmount: number;
  hostSharePercent: number; // 60%
  hostEarned: number;
  timestamp: number;
  durationMinutes?: number;
  details?: string;
}

export interface HostVerificationData {
  panNumber?: string;
  panDocUrl?: string;
  residentIdType?: 'aadhaar' | 'voter' | 'passport' | 'driving_license';
  residentIdNumber?: string;
  residentDocUrl?: string;
  selfieUrl: string;
  gender?: 'female';
  status: 'unverified' | 'pending' | 'verified';
  verifiedAt?: number;
  // Backward compatibility
  idType?: string;
  idNumber?: string;
}

export interface ChatMessage {
  id: string;
  sakhiId: string;
  callerId?: string;
  callerName?: string;
  sender: 'user' | 'sakhi';
  senderId?: string;
  text: string;
  wordCount: number;
  cost: number;
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read';
}

export interface ConversationItem {
  threadId: string;
  sakhiId: string;
  sakhiName?: string;
  sakhiAvatar?: string;
  callerId: string;
  callerName: string;
  callerPhone?: string;
  lastMessage: string;
  lastSender: 'user' | 'sakhi';
  updatedAt: number;
  unreadCount?: number;
}

export interface HostProfile extends Sakhi {
  totalVoiceMinutes: number;
  totalVideoMinutes: number;
  totalGiftsReceived: number;
  totalMessagesReceived: number;
  grossRevenue: number;
  netIncome: number;
  pendingPayout: number;
  verification: HostVerificationData;
  incomeHistory: HostIncomeRecord[];
}

export interface HostAuthUser {
  phone: string;
  email: string;
  name: string;
  hostId: string;
  isLoggedIn: boolean;
}

export interface HostAccountRecord {
  phone: string;
  email?: string;
  hostId: string;
  name: string;
  password?: string;
  createdAt: number;
  lastLoginAt: number;
  activeSessionToken?: string;
}

export interface PlatformSettings {
  voiceRatePerMin: number; // ₹7
  videoRatePerMin: number; // ₹15
  sakhiChatRate: number; // ₹3
  hostIncomePercent: number; // 60%
  supportPhone: string;
  supportWhatsApp: string;
  adminUpiId?: string;
  adminUpiName?: string;
}

export interface RecentCallLog {
  id: string;
  sakhiId: string;
  sakhiName: string;
  sakhiAvatar: string;
  callerId?: string;
  callerName?: string;
  type: CallType;
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'missed' | 'rejected';
  durationSeconds: number;
  cost: number;
  timestamp: number;
}

export interface HostPayoutRecord {
  id: string;
  hostId: string;
  amount: number;
  method: 'upi' | 'bank';
  upiId?: string;
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  status: 'completed' | 'processing' | 'pending' | 'rejected';
  timestamp: number;
  referenceId: string;
}

export interface RechargeRequest {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  amount: number;
  bonus: number;
  totalBalance: number;
  utr: string; // Mandatory Bank/UPI Reference (e.g. 12 digits)
  paymentMethod: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  rejectReason?: string;
  adminNote?: string;
}

export interface IncomingMessageNotification {
  id: string;
  callerId: string;
  callerName: string;
  callerPhone?: string;
  threadId: string;
  text: string;
  timestamp: number;
  senderRole?: 'user' | 'sakhi';
  senderAvatar?: string;
  sakhiId?: string;
  sakhiName?: string;
}

