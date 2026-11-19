import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';

export type UserRole = 'ambulance' | 'hospital' | 'traffic' | 'admin' | 'public';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  hospitalId?: string;
  ambulanceId?: string;
  trafficSignalIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Fetch trusted user profile from server-controlled /users/{uid} document
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }
};

/**
 * Ensure a user profile exists in Firestore.
 * Standard user creation defaults role to 'public' unless pre-approved.
 * Role field cannot be updated directly by client once created.
 */
export const ensureUserProfile = async (
  user: User, 
  initialRole: UserRole = 'public'
): Promise<UserProfile> => {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    return existing.data() as UserProfile;
  }

  const now = new Date().toISOString();
  const newProfile: UserProfile = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || (user.isAnonymous ? 'Guest User' : 'Authorized User'),
    role: initialRole,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(userRef, newProfile);
  return newProfile;
};

/**
 * Update user metadata (non-sensitive fields only: displayName, assigned hospitalId/ambulanceId)
 */
export const updateUserProfile = async (
  uid: string, 
  updates: Partial<Omit<UserProfile, 'uid' | 'role' | 'createdAt'>>
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();
  await updateDoc(userRef, {
    ...updates,
    updatedAt: now
  });
};
