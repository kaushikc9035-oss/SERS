import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  BiometricAuth,
  BiometryType,
  BiometryErrorType,
  AndroidBiometryStrength,
  CheckBiometryResult,
  BiometryError
} from '@aparajita/capacitor-biometric-auth';

export const BIOMETRIC_ENABLED_KEY = 'smart_emergency_biometric_enabled';

export interface BiometricAuthResponse {
  success: boolean;
  error?: string;
  code?: BiometryErrorType;
}

/**
 * Check whether the user has toggled ON the biometric authentication requirement in settings.
 */
export const isBiometricEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
};

/**
 * Enable or disable biometric authentication requirement.
 */
export const setBiometricEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
  } else {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  }
};

/**
 * Check device biometric hardware capabilities, enrollment status, and device credential security.
 */
export const checkBiometricAvailability = async (): Promise<CheckBiometryResult> => {
  try {
    const result = await BiometricAuth.checkBiometry();
    return result;
  } catch (error: any) {
    console.warn("Failed to check biometry status:", error);
    return {
      isAvailable: false,
      strongBiometryIsAvailable: false,
      biometryType: BiometryType.none,
      biometryTypes: [],
      deviceIsSecure: false,
      reason: error?.message || 'Biometrics not available on this platform.',
      code: BiometryErrorType.biometryNotAvailable
    };
  }
};

/**
 * Prompt the user for Android native fingerprint or biometric authentication with device credential fallback.
 * Uses AndroidX BiometricPrompt under the hood with allowDeviceCredential = true.
 */
export const authenticateBiometric = async (customReason?: string): Promise<BiometricAuthResponse> => {
  try {
    await BiometricAuth.authenticate({
      reason: customReason || "Authenticate to unlock Smart Emergency Command Grid",
      cancelTitle: "Cancel",
      allowDeviceCredential: true, // Enables native PIN/pattern/password fallback
      androidTitle: "Smart Emergency Security",
      androidSubtitle: "Scan your fingerprint or use device PIN/Pattern",
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak
    });

    return { success: true };
  } catch (error: any) {
    console.warn("Biometric authentication error:", error);
    const code: BiometryErrorType = error?.code || BiometryErrorType.none;
    let message = error?.message || 'Biometric authentication failed.';

    switch (code) {
      case BiometryErrorType.userCancel:
        message = 'Authentication cancelled by user.';
        break;
      case BiometryErrorType.systemCancel:
        message = 'Authentication was interrupted by the system.';
        break;
      case BiometryErrorType.biometryLockout:
        message = 'Biometric sensor locked due to multiple failed attempts. Please unlock using your device PIN/Pattern or wait a moment.';
        break;
      case BiometryErrorType.biometryNotEnrolled:
        message = 'No fingerprint is enrolled on this device. Please register a fingerprint in Android Settings.';
        break;
      case BiometryErrorType.biometryNotAvailable:
        message = 'Biometric authentication hardware is not available on this device.';
        break;
      case BiometryErrorType.passcodeNotSet:
      case BiometryErrorType.noDeviceCredential:
        message = 'No device screen lock (PIN, pattern, or password) is set on this device.';
        break;
      case BiometryErrorType.authenticationFailed:
        message = 'Fingerprint not recognized. Please try again or use your backup credential.';
        break;
      default:
        break;
    }

    return {
      success: false,
      error: message,
      code
    };
  }
};

/**
 * Listen for app resume events (e.g., when returning from Android Settings after enrolling a fingerprint)
 * to immediately re-evaluate biometric availability in the UI.
 */
export const addBiometricResumeListener = (
  callback: (info: CheckBiometryResult) => void
): (() => void) => {
  let isCleanedUp = false;
  let pluginHandle: any = null;
  let appListenerHandle: any = null;

  // 1. Initial check & plugin native resume listener
  checkBiometricAvailability().then(async (initial) => {
    if (isCleanedUp) return;
    callback(initial);

    try {
      pluginHandle = await BiometricAuth.addResumeListener((info) => {
        if (!isCleanedUp) {
          callback(info);
        }
      });
    } catch (e) {
      console.warn("Could not attach BiometricAuth resume listener:", e);
    }
  });

  // 2. Fallback using @capacitor/app appStateChange listener
  App.addListener('appStateChange', async (state) => {
    if (isCleanedUp) return;
    if (state.isActive) {
      const refreshed = await checkBiometricAvailability();
      callback(refreshed);
    }
  }).then((handle) => {
    appListenerHandle = handle;
  }).catch(() => {});

  // Cleanup handler
  return () => {
    isCleanedUp = true;
    if (pluginHandle && typeof pluginHandle.remove === 'function') {
      pluginHandle.remove().catch(() => {});
    }
    if (appListenerHandle && typeof appListenerHandle.remove === 'function') {
      appListenerHandle.remove().catch(() => {});
    }
  };
};

/**
 * Helper to display human-readable biometry hardware type
 */
export const getBiometryTypeName = (type: BiometryType): string => {
  switch (type) {
    case BiometryType.fingerprintAuthentication:
      return 'Fingerprint Scanner';
    case BiometryType.faceAuthentication:
    case BiometryType.faceId:
      return 'Face Recognition';
    case BiometryType.touchId:
      return 'Touch ID';
    case BiometryType.irisAuthentication:
      return 'Iris Scanner';
    case BiometryType.none:
      return 'None';
    default:
      return 'Biometric Hardware';
  }
};

export { BiometryType, BiometryErrorType };
