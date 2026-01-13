// Firebase Configuration for TEXA-TOOLS
// ============================================
// PANDUAN: Untuk menggunakan Firebase project yang berbeda:
// 1. Buat project baru di https://console.firebase.google.com
// 2. Enable Authentication (Google & Email/Password)
// 3. Buat Firestore Database
// 4. Buat Realtime Database (opsional)
// 5. Copy konfigurasi ke file ini atau gunakan environment variables
// ============================================

import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  Auth
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  deleteDoc,
  getDocs,
  setDoc,
  getDoc,
  query,
  where,
  limit,
  Firestore
} from "firebase/firestore";
import { getDatabase, ref, set, Database } from "firebase/database";

const getAuthErrorMessage = (error: any, fallbackMessage: string): string => {
  const code = error?.code as string | undefined;

  if (code === 'auth/invalid-credential') return 'Email atau password salah';
  if (code === 'auth/user-not-found') return 'Email tidak terdaftar';
  if (code === 'auth/wrong-password') return 'Password salah';
  if (code === 'auth/invalid-email') return 'Format email tidak valid';
  if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Coba lagi nanti.';
  if (code === 'auth/popup-closed-by-user') return 'Popup login ditutup sebelum selesai';
  if (code === 'auth/cancelled-popup-request') return 'Permintaan login dibatalkan';
  if (code === 'auth/account-exists-with-different-credential') return 'Akun ini sudah terdaftar dengan metode login lain';
  if (code === 'auth/operation-not-allowed') return 'Metode login ini belum diaktifkan di Firebase';
  if (code === 'auth/unauthorized-domain') return 'Domain ini belum diizinkan di Firebase Auth';

  return fallbackMessage;
};

// ============================================
// FIREBASE CONFIGURATION
// ============================================
// TEXA-TOOLS menggunakan project terpisah: tekno-cfaba
// ============================================

// Primary Config - TEXA-TOOLS dedicated project (tekno-cfaba)
const PRIMARY_CONFIG = {
  apiKey: "AIzaSyCSy5pSSYWBo-uPlhvyg3VcAI1WXqLyhV8",
  authDomain: "tekno-cfaba.firebaseapp.com",
  projectId: "tekno-cfaba",
  storageBucket: "tekno-cfaba.firebasestorage.app",
  messagingSenderId: "829037498666",
  appId: "1:829037498666:web:a3712fd158f2e6adca4e53"
};

// Backup Config - old project (jangan digunakan untuk TEXA-TOOLS)
const BACKUP_CONFIG = {
  apiKey: "AIzaSyCirtabCZOy3XMnNLUc-iKIYGegZJbPqhw",
  authDomain: "tekno-335f8.firebaseapp.com",
  databaseURL: "https://tekno-335f8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tekno-335f8",
  storageBucket: "tekno-335f8.firebasestorage.app",
  messagingSenderId: "801480259453",
  appId: "1:801480259453:web:8f4b4261b18704d9cdbe14",
  measurementId: "G-9QV9LYSLJ7"
};

// ============================================
// 🔥 ACTIVE FIREBASE CONFIG
// ============================================
// Menggunakan PRIMARY_CONFIG (tekno-cfaba) untuk TEXA-TOOLS
// ============================================

const TEXA_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || PRIMARY_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || PRIMARY_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || PRIMARY_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || PRIMARY_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || PRIMARY_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || PRIMARY_CONFIG.appId
};

// ============================================
// COLLECTION NAMES (dengan prefix untuk isolasi)
// ============================================
export const COLLECTIONS = {
  USERS: 'texa_users',           // User profiles dan subscription
  CATALOG: 'texa_catalog',       // AI Tools catalog
  SETTINGS: 'texa_settings',     // Subscription settings
  TRANSACTIONS: 'texa_transactions',  // Payment transactions
  LOGS: 'texa_activity_logs'     // Activity logs
} as const;

// RTDB Paths
export const RTDB_PATHS = {
  USERS: 'texa_users',
  SESSIONS: 'texa_sessions',
  ONLINE: 'texa_online'
} as const;

// ============================================
// INITIALIZE FIREBASE
// ============================================
const app: FirebaseApp = initializeApp(TEXA_FIREBASE_CONFIG);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);

// Log active project (development only)
if (import.meta.env.DEV) {
  console.log('🔥 Firebase Project:', TEXA_FIREBASE_CONFIG.projectId);
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// User Role Type
export type UserRole = 'ADMIN' | 'MEMBER';

// User Interface
export interface TexaUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  subscriptionEnd: string | null;
  isActive: boolean;
  photoURL?: string;
  createdAt?: string;
  lastLogin?: string;
}

// Admin Emails (can be extended)
const ADMIN_EMAILS = [
  'teknoaiglobal@gmail.com',
  'teknoaurora@gmail.com',
  'admin@texa.id'
];

// Check if user is admin
const checkIfAdmin = (email: string): boolean => {
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// Create or Update User in Firestore
const saveUserToDatabase = async (firebaseUser: FirebaseUser, additionalData?: Partial<TexaUser>): Promise<TexaUser> => {
  const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  const isAdmin = checkIfAdmin(firebaseUser.email || '');
  const normalizedEmail = (firebaseUser.email || '').trim().toLowerCase();

  let preCreatedDoc: { id: string; data: Partial<TexaUser> } | null = null;
  if (normalizedEmail) {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('email', '==', normalizedEmail), limit(5));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id !== firebaseUser.uid) {
        preCreatedDoc = { id: d.id, data: d.data() as Partial<TexaUser> };
        break;
      }
    }
  }

  const userData: TexaUser = {
    id: firebaseUser.uid,
    email: normalizedEmail || firebaseUser.email || '',
    name: firebaseUser.displayName || additionalData?.name || preCreatedDoc?.data?.name || 'Pengguna Baru',
    role: isAdmin ? 'ADMIN' : 'MEMBER',
    subscriptionEnd: null,
    isActive: true,
    lastLogin: new Date().toISOString(),
    ...additionalData
  };

  if (preCreatedDoc?.data) {
    if (preCreatedDoc.data.subscriptionEnd) userData.subscriptionEnd = preCreatedDoc.data.subscriptionEnd;
    if (preCreatedDoc.data.role) userData.role = preCreatedDoc.data.role;
    if (typeof preCreatedDoc.data.isActive === 'boolean') userData.isActive = preCreatedDoc.data.isActive;
    if (preCreatedDoc.data.createdAt) userData.createdAt = preCreatedDoc.data.createdAt;
  }

  // Only add photoURL if it exists
  if (firebaseUser.photoURL) {
    userData.photoURL = firebaseUser.photoURL;
  }

  if (!userSnap.exists()) {
    // New user - create document
    userData.createdAt = userData.createdAt || new Date().toISOString();
    const cleanData = Object.fromEntries(
      Object.entries(userData).filter(([_, v]) => v !== undefined)
    );
    await setDoc(userRef, cleanData);

    // Also save to Realtime Database
    await set(ref(rtdb, `${RTDB_PATHS.USERS}/${firebaseUser.uid}`), {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      isActive: userData.isActive,
      lastLogin: userData.lastLogin
    });
  } else {
    // Existing user - update last login
    await setDoc(userRef, {
      lastLogin: userData.lastLogin,
      ...(preCreatedDoc?.data?.subscriptionEnd ? { subscriptionEnd: preCreatedDoc.data.subscriptionEnd } : {}),
      ...(preCreatedDoc?.data?.role ? { role: preCreatedDoc.data.role } : {}),
      ...(typeof preCreatedDoc?.data?.isActive === 'boolean' ? { isActive: preCreatedDoc.data.isActive } : {}),
      ...(preCreatedDoc?.data?.createdAt ? { createdAt: preCreatedDoc.data.createdAt } : {})
    }, { merge: true });

    // Update RTDB
    await set(ref(rtdb, `${RTDB_PATHS.USERS}/${firebaseUser.uid}/lastLogin`), userData.lastLogin);
  }

  if (preCreatedDoc?.id) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.USERS, preCreatedDoc.id));
    } catch {
    }
  }

  const updatedSnap = await getDoc(userRef);
  return updatedSnap.data() as TexaUser;
};

// Google Sign In
export const signInWithGoogle = async (): Promise<TexaUser> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const texaUser = await saveUserToDatabase(user);
    return texaUser;
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal login dengan Google'));
  }
};

// Email/Password Sign In
export const signInWithEmail = async (email: string, password: string): Promise<TexaUser> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    const texaUser = await saveUserToDatabase(user);
    return texaUser;
  } catch (error: any) {
    console.error('Email Sign In Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal login'));
  }
};

// Email/Password Sign Up
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<TexaUser> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    await updateProfile(user, { displayName: name });
    const texaUser = await saveUserToDatabase(user, { name });
    return texaUser;
  } catch (error: any) {
    console.error('Email Sign Up Error:', error);
    const code = error?.code as string | undefined;
    if (code === 'auth/email-already-in-use') throw new Error('Email sudah terdaftar');
    if (code === 'auth/weak-password') throw new Error('Password minimal 6 karakter');

    throw new Error(getAuthErrorMessage(error, 'Gagal mendaftar'));
  }
};

// Sign Out
export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign Out Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal logout'));
  }
};

export const sendResetPassword = async (email: string): Promise<void> => {
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Email tidak valid');
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error: any) {
    console.error('Reset Password Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal mengirim email reset password'));
  }
};

// Get Current User Data from Firestore
export const getCurrentUserData = async (uid: string): Promise<TexaUser | null> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as TexaUser;
    }
    return null;
  } catch (error) {
    console.error('Get User Data Error:', error);
    return null;
  }
};

// Auth State Observer
export const onAuthChange = (callback: (user: TexaUser | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const texaUser = await getCurrentUserData(firebaseUser.uid);
        if (texaUser) {
          callback(texaUser);
        } else {
          try {
            const newUser = await saveUserToDatabase(firebaseUser);
            callback(newUser);
          } catch (saveError) {
            console.warn('Could not save user to Firestore:', saveError);
            const fallbackUser: TexaUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Pengguna',
              role: checkIfAdmin(firebaseUser.email || '') ? 'ADMIN' : 'MEMBER',
              subscriptionEnd: null,
              isActive: true,
              photoURL: firebaseUser.photoURL || undefined,
              lastLogin: new Date().toISOString()
            };
            callback(fallbackUser);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        const fallbackUser: TexaUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Pengguna',
          role: checkIfAdmin(firebaseUser.email || '') ? 'ADMIN' : 'MEMBER',
          subscriptionEnd: null,
          isActive: true,
          photoURL: firebaseUser.photoURL || undefined,
          lastLogin: new Date().toISOString()
        };
        callback(fallbackUser);
      }
    } else {
      callback(null);
    }
  });
};

// Export config info for debugging
export const getFirebaseInfo = () => ({
  projectId: TEXA_FIREBASE_CONFIG.projectId,
  collections: COLLECTIONS,
  rtdbPaths: RTDB_PATHS
});

export default app;
