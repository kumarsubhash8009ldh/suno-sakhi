# 🔥 Suno Sakhi - Firebase Cloud Data Sync Setup Guide

Ye guide aapko **3 minutes** me Google Firebase par free backend database setup karne me madad karegi.

---

## 📌 Step 1: Firebase Project Banayein (100% Free)

1. Browser me **[console.firebase.google.com](https://console.firebase.google.com/)** open karein.
2. Apne Google account se sign in karein.
3. **"Add project"** / **"Create a project"** par click karein.
4. Project ka naam rakhein: `suno-sakhi` (ya apni pasand ka koi bhi naam).
5. Google Analytics disable ya enable karke **"Create Project"** par click karein.
6. Kuch seconds wait karein aur **"Continue"** dabayein.

---

## 📌 Step 2: Web App Create Karein & Keys Copy Karein

1. Firebase Project Overview dashboard par **Web icon (`</>`)** par click karein.
2. App nickname me likhein: `suno-sakhi-web`.
3. *"Also set up Firebase Hosting"* ko uncheck rehne dein aur **"Register app"** dabayein.
4. Aapko screen par ek code block dikhega jisme `firebaseConfig` hoga:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "suno-sakhi-xxx.firebaseapp.com",
  projectId: "suno-sakhi-xxx",
  storageBucket: "suno-sakhi-xxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123def456"
};
```

---

## 📌 Step 3: Project Ki `.env` File Me Keys Paste Karein

Aapke project folder me `.env` file ko open karein:
`C:\Users\Subhash\.gemini\antigravity\scratch\suno-sakhi\.env`

In values ko replace karein:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=suno-sakhi-xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=suno-sakhi-xxx
VITE_FIREBASE_STORAGE_BUCKET=suno-sakhi-xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123def456
```

---

## 📌 Step 4: Cloud Firestore Database Enable Karein

1. Firebase Console ke left sidebar me **Build** -> **Firestore Database** par click karein.
2. **"Create database"** button dabayein.
3. Database location: **asia-south1 (Mumbai)** select karein (India ke liye sabse fast response milega).
4. Security Rules me: **"Start in test mode"** select karein (taaki shuru me bina permission error ke live read/write ho sake).
5. **"Enable"** par click karein.

---

## 📌 Step 5: Verify Karein!

1. Dev server start karein (`cmd.exe /c "npm run dev"`).
2. App me Admin icon (shield 🛡️) par click karein.
3. **"☁️ Cloud Sync"** tab par jayein.
4. Aapko **"LIVE CLOUD CONNECTED"** ka green badge dikhai dega!
5. Ab aap kisi bhi mobile ya laptop se app open karenge, toh:
   - Wallet recharge balance live sync hoga.
   - Host earnings aur calls sync honge.
   - Chat messages real-time me aayenge aur jayenge!

---

### 🛡️ Production Security Rules (Jab App Launch Ho Jaye):
Firebase Console -> Firestore Database -> Rules tab me ye paste karein:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Test mode (change to auth-based in production)
    }
  }
}
```
