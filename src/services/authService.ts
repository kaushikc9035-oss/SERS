import { Capacitor } from '@capacitor/core';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  signInWithCredential,
  signOut as fbSignOut, 
  signInAnonymously as fbSignInAnonymously,
  User 
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth } from '../firebase';

/**
 * Robust cross-platform sign in handler.
 * On Native Android APK: Uses native Google Sign-In via @capacitor-firebase/authentication
 * to prevent WebView popup blocks / disallowed useragent errors.
 * On Web: Uses standard signInWithPopup / GoogleAuthProvider.
 */
export const signInWithGoogleCrossPlatform = async (): Promise<User | null> => {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FirebaseAuthentication.signInWithGoogle();
        if (result.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const userCredential = await signInWithCredential(auth, credential);
          return userCredential.user;
        } else if (result.user) {
          return auth.currentUser;
        }
      } catch (nativeErr: any) {
        console.warn("Native Google Sign-In attempt error:", nativeErr);
        // Fallback to signInWithRedirect or popup in webview if native credentials aren't ready
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          const res = await signInWithPopup(auth, provider);
          return res.user;
        } catch (popupErr) {
          console.warn("Popup sign-in fallback error in APK:", popupErr);
          throw nativeErr;
        }
      }
    } else {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(auth, provider);
      return res.user;
    }
  } catch (error: any) {
    console.error("Sign in failed:", error);
    throw error;
  }
  return auth.currentUser;
};

/**
 * Sign out cleanly on both Native and Web platforms
 */
export const signOutCrossPlatform = async (): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut().catch(() => {});
    }
    await fbSignOut(auth);
  } catch (error) {
    console.warn("Sign out error:", error);
    await fbSignOut(auth);
  }
};
