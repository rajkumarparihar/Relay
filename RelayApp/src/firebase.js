import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Replace these values with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "relay-e7436.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
  projectId: "relay-e7436",
  storageBucket: "relay-e7436.appspot.com",
  messagingSenderId: "243231221497",
  appId: "1:243231221497:web:157e8e2075fdeb997b2428"
};

// Temporary try/catch as we wait for Alaina to implement the firebase database.

let db = null;
try {
  if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
} catch (error) { 
  console.warn("Firebase running in local demo mode only:", error.message);
}

export {db};

//const app = initializeApp(firebaseConfig);
//export const db = getDatabase(app);