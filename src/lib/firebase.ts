import Constants from "expo-constants";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";

type Extra = {
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
  firebaseDatabaseUrl?: string;
};

function getExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function getFirebaseConfig() {
  const extra = getExtra();
  return {
    apiKey: extra.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: extra.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: extra.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: extra.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId:
      extra.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: extra.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    databaseURL:
      extra.firebaseDatabaseUrl || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || undefined,
  };
}

export function isFirebaseConfigured(): boolean {
  const c = getFirebaseConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

export function isRealtimeDatabaseConfigured(): boolean {
  const c = getFirebaseConfig();
  return Boolean(c.databaseURL);
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase não configurado. Copie .env.example para .env e preencha EXPO_PUBLIC_FIREBASE_*."
    );
  }
  if (!app) {
    const config = getFirebaseConfig();
    app = getApps().length ? getApp() : initializeApp(config);
  }
  return app;
}

export function getFirebaseDatabase(): Database {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase não configurado.");
  }
  if (!isRealtimeDatabaseConfigured()) {
    throw new Error(
      "Realtime Database não configurado. Defina EXPO_PUBLIC_FIREBASE_DATABASE_URL no .env (Console Firebase > Realtime Database)."
    );
  }
  if (!database) {
    database = getDatabase(getFirebaseApp());
  }
  return database;
}

export function getFirebaseStorageInstance(): FirebaseStorage {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase não configurado.");
  }
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

export function getFirebaseAuthInstance(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase não configurado. Copie .env.example para .env e preencha EXPO_PUBLIC_FIREBASE_*."
    );
  }
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}
