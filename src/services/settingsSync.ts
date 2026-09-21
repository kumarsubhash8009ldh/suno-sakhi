import { doc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { PlatformSettings } from '../types';

const SETTINGS_COLLECTION = 'settings';
const PLATFORM_DOC = 'platform';

/**
 * Subscribe to global platform settings (rates, phone, commission).
 */
export const subscribeToCloudSettings = (
  onUpdate: (settings: PlatformSettings) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, PLATFORM_DOC);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as PlatformSettings);
      }
    }, (err) => {
      console.warn('Error listening to cloud settings:', err);
    });
  } catch (err) {
    console.warn('Could not subscribe to cloud settings:', err);
    return null;
  }
};

/**
 * Save updated platform settings to Firestore.
 */
export const saveSettingsToCloud = async (
  settings: PlatformSettings
): Promise<boolean> => {
  if (!isFirebaseConfigured() || !db) return false;

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, PLATFORM_DOC);
    await setDoc(docRef, settings, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save settings to Firestore:', err);
    return false;
  }
};
