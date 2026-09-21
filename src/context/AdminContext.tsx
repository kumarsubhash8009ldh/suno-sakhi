import React, { createContext, useContext, useState, useEffect } from 'react';
import { PlatformSettings } from '../types';
import { useWallet } from './WalletContext';
import { useHost } from './HostContext';
import { sounds } from '../utils/soundEffects';
import { subscribeToCloudSettings, saveSettingsToCloud } from '../services/settingsSync';
import { isFirebaseConfigured } from '../services/firebase';

interface AdminContextType {
  isAdminOpen: boolean;
  openAdmin: () => void;
  closeAdmin: () => void;
  settings: PlatformSettings;
  isFirebaseActive: boolean;
  updateSettings: (newSettings: Partial<PlatformSettings>) => void;
  addCoinsToUserWallet: (amount: number, note?: string) => void;
  approveHost: (hostId: string) => void;
  rejectHost: (hostId: string) => void;
}

const SETTINGS_KEY = 'sunosakhi_platform_settings';

const defaultSettings: PlatformSettings = {
  voiceRatePerMin: 7,
  videoRatePerMin: 15,
  sakhiChatRate: 3,
  hostIncomePercent: 60,
  supportPhone: '+91 98765 43210',
  supportWhatsApp: '+91 98765 43210',
  adminUpiId: 'sunosakhi@okaxis',
  adminUpiName: 'Suno Sakhi Official'
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { recharge } = useWallet();
  const { submitVerification, hostProfile } = useHost();

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isFirebaseActive] = useState<boolean>(isFirebaseConfigured());

  const [settings, setSettings] = useState<PlatformSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return defaultSettings;
  });

  // Subscribe to real-time settings from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeToCloudSettings((cloudSettings) => {
      setSettings(cloudSettings);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const openAdmin = () => setIsAdminOpen(true);
  const closeAdmin = () => setIsAdminOpen(false);

  const updateSettings = (newSettings: Partial<PlatformSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettingsToCloud(updated);
      return updated;
    });
  };

  // Master Add Coin Controller
  const addCoinsToUserWallet = (amount: number, note?: string) => {
    if (amount <= 0) return;
    recharge(amount, 0); // Adds exact coins to wallet
    sounds.playCoinSound();
  };

  const approveHost = (hostId: string) => {
    submitVerification({
      idType: hostProfile.verification?.idType || 'aadhaar',
      idNumber: hostProfile.verification?.idNumber || 'Verified-Aadhaar',
      selfieUrl: hostProfile.verification?.selfieUrl || hostProfile.avatar,
      status: 'verified',
      verifiedAt: Date.now()
    });
  };

  const rejectHost = (hostId: string) => {
    submitVerification({
      idType: hostProfile.verification?.idType || 'aadhaar',
      idNumber: hostProfile.verification?.idNumber || '',
      selfieUrl: hostProfile.verification?.selfieUrl || '',
      status: 'unverified'
    });
  };

  return (
    <AdminContext.Provider
      value={{
        isAdminOpen,
        openAdmin,
        closeAdmin,
        settings,
        isFirebaseActive,
        updateSettings,
        addCoinsToUserWallet,
        approveHost,
        rejectHost
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
