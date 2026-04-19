import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDPnTujtH3tuu4JCI8xEGZAuQ_H1ed-mbg",
  authDomain: "gen-lang-client-0964920685.firebaseapp.com",
  projectId: "gen-lang-client-0964920685",
  storageBucket: "gen-lang-client-0964920685.firebasestorage.app",
  messagingSenderId: "591861533142",
  appId: "1:591861533142:web:28cc3c16469254b403bc77"
};

const app = initializeApp(firebaseConfig);
// Initialize Firestore with settings to prevent "offline" errors
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
