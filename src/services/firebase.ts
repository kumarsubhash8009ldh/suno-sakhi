import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
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
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('✅ Firebase initialized successfully in Suno Sakhi cloud sync mode.');
  } catch (err) {
    console.warn('⚠️ Error initializing Firebase. Falling back to local offline mode:', err);
  }
} else {
  console.info('ℹ️ Firebase credentials not provided in .env yet. Running in Local Storage Fallback mode.');
}

export { app, db, auth, firebaseConfig };
