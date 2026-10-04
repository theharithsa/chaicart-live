import { setTelemetryUser } from "./lib/telemetry";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const localEmulators =
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_EMULATORS === "true" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const app = initializeApp({
  apiKey: localEmulators ? "demo-key" : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: localEmulators
    ? "localhost"
    : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: localEmulators
    ? "demo-chaicart"
    : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Local cache keeps the app usable through short Wi-Fi drops.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

if (localEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9195", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8185);
}

// One global subscription identifies restored, switched and signed-out sessions.
onAuthStateChanged(auth, setTelemetryUser);
