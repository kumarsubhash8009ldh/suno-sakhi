import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'suno-sakhi-63040';
const defaultRtdbUrl = `https://${projectId}-default-rtdb.firebaseio.com`;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || defaultRtdbUrl,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Check if credentials have been filled in
export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.trim() !== '' &&
    !firebaseConfig.apiKey.includes('your_api_key')
  );
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      db = getFirestore(app);
    }
    try {
      rtdb = getDatabase(app, firebaseConfig.databaseURL);
    } catch (rtdbErr) {
      console.warn('⚠️ Error initializing Realtime Database:', rtdbErr);
    }
    auth = getAuth(app);
    console.log('✅ Firebase initialized successfully (Realtime Database + Firestore cloud sync mode).');
  } catch (err) {
    console.warn('⚠️ Error initializing Firebase. Falling back to local offline mode:', err);
  }
} else {
  console.info('ℹ️ Firebase credentials not provided in .env yet. Running in Local Storage Fallback mode.');
}

export { app, db, rtdb, auth, firebaseConfig };
