import { Sakhi, RechargePack } from '../types';

/**
 * Real Host Profiles Only.
 * Zero dummy accounts: All profiles are dynamically loaded in real-time from Cloud Firestore
 * based on verified host registrations via mobile phone numbers or email.
 */
export const SAKHIS_DATA: Sakhi[] = [];

/**
 * Recharge Packs with Flat 5% Extra Bonus.
 * Audio Call Rate: ₹7/min • Video Call Rate: ₹15/min
 */
export const RECHARGE_PACKS: RechargePack[] = [
  {
    id: 'pack-50',
    amount: 50,
    bonus: 2.5,
    starter: true,
    voiceMinutes: 7,
    videoMinutes: 3.5
  },
  {
    id: 'pack-100',
    amount: 100,
    bonus: 5,
    popular: true,
    voiceMinutes: 15,
    videoMinutes: 7
  },
  {
    id: 'pack-200',
    amount: 200,
    bonus: 10,
    voiceMinutes: 30,
    videoMinutes: 14
  },
  {
    id: 'pack-500',
    amount: 500,
    bonus: 25,
    bestValue: true,
    voiceMinutes: 75,
    videoMinutes: 35
  },
  {
    id: 'pack-1000',
    amount: 1000,
    bonus: 50,
    voiceMinutes: 150,
    videoMinutes: 70
  }
];
