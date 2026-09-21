import { Sakhi, RechargePack } from '../types';

/**
 * Real Host Profiles Only.
 * Zero dummy accounts: All profiles are dynamically loaded in real-time from Cloud Firestore
 * based on verified host registrations via mobile phone numbers.
 */
export const SAKHIS_DATA: Sakhi[] = [];

export const RECHARGE_PACKS: RechargePack[] = [
  {
    id: 'pack-50',
    amount: 50,
    bonus: 5,
    voiceMinutes: 10,
    videoMinutes: 6.25
  },
  {
    id: 'pack-100',
    amount: 100,
    bonus: 20,
    popular: true,
    voiceMinutes: 20,
    videoMinutes: 12.5
  },
  {
    id: 'pack-200',
    amount: 200,
    bonus: 50,
    voiceMinutes: 40,
    videoMinutes: 25
  },
  {
    id: 'pack-500',
    amount: 500,
    bonus: 150,
    bestValue: true,
    voiceMinutes: 100,
    videoMinutes: 62.5
  },
  {
    id: 'pack-1000',
    amount: 1000,
    bonus: 350,
    voiceMinutes: 200,
    videoMinutes: 125
  }
];
