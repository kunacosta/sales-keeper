import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Detect if the configuration is still a placeholder
const isPlaceholder = 
  !firebaseConfig.apiKey || 
  firebaseConfig.apiKey.includes('placeholder') || 
  firebaseConfig.apiKey === '';

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Export the Firebase instances, with firestoreDatabaseId specified to target the dedicated database
export const db = isPlaceholder ? null : getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = isPlaceholder ? null : getAuth(app);
export { isPlaceholder };
export default app;
