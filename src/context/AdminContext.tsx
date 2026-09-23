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
  supportPhone: '+91 7009600157',
  supportWhatsApp: '+91 7009600157',
  adminUpiId: 'sunosakhi@okaxis',
  adminUpiName: 'Suno Sakhi Official',
  adminQrCodeUrl: '',
  callHelplines: [
    { id: 'call-1', title: '24x7 Direct Phone Helpline', number: '+91 7009600157', type: 'call', isPrimary: true }
  ],
  whatsappHelplines: [
    { id: 'wa-1', title: '24x7 WhatsApp Chat Support', number: '+91 7009600157', type: 'whatsapp', isPrimary: true }
  ]
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
        const parsed = JSON.parse(saved);
        if (parsed.supportPhone === '+91 98765 43210') parsed.supportPhone = '+91 7009600157';
        if (parsed.supportWhatsApp === '+91 98765 43210') parsed.supportWhatsApp = '+91 7009600157';
        if (Array.isArray(parsed.callHelplines)) {
          parsed.callHelplines = parsed.callHelplines.map((c: any) =>
            c.number === '+91 98765 43210' ? { ...c, number: '+91 7009600157' } : c
          );
        }
        if (Array.isArray(parsed.whatsappHelplines)) {
          parsed.whatsappHelplines = parsed.whatsappHelplines.map((w: any) =>
            w.number === '+91 98765 43210' ? { ...w, number: '+91 7009600157' } : w
          );
        }
        return {
          ...defaultSettings,
          ...parsed,
          callHelplines: parsed.callHelplines || defaultSettings.callHelplines,
          whatsappHelplines: parsed.whatsappHelplines || defaultSettings.whatsappHelplines
        };
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
      let callH = cloudSettings.callHelplines;
      if (Array.isArray(callH)) {
        callH = callH.map((c: any) => c.number === '+91 98765 43210' ? { ...c, number: '+91 7009600157' } : c);
      }
      let waH = cloudSettings.whatsappHelplines;
      if (Array.isArray(waH)) {
        waH = waH.map((w: any) => w.number === '+91 98765 43210' ? { ...w, number: '+91 7009600157' } : w);
      }
      setSettings((prev) => ({
        ...prev,
        ...cloudSettings,
        supportPhone: (cloudSettings.supportPhone === '+91 98765 43210' || !cloudSettings.supportPhone) ? (prev.supportPhone || '+91 7009600157') : cloudSettings.supportPhone,
        supportWhatsApp: (cloudSettings.supportWhatsApp === '+91 98765 43210' || !cloudSettings.supportWhatsApp) ? (prev.supportWhatsApp || '+91 7009600157') : cloudSettings.supportWhatsApp,
        callHelplines: callH || prev.callHelplines || defaultSettings.callHelplines,
        whatsappHelplines: waH || prev.whatsappHelplines || defaultSettings.whatsappHelplines
      }));
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
