import { Capacitor } from '@capacitor/core';
import { Geolocation, Position, WatchPositionCallback } from '@capacitor/geolocation';

export interface SimpleCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/**
 * Request location permissions safely across both Web and Native Android.
 */
export const requestDeviceLocationPermission = async (): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted') return true;
      const requested = await Geolocation.requestPermissions();
      return requested.location === 'granted';
    } else {
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        const query = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return query.state === 'granted' || query.state === 'prompt';
      }
      return true;
    }
  } catch (e) {
    console.warn("Location permission check exception:", e);
    return true; // Fall back to attempting direct fetch
  }
};

/**
 * Get current position with automatic fallback between Native Capacitor Geolocation and Web Geolocation.
 */
export const getDeviceCurrentPosition = async (timeoutMs: number = 10000): Promise<SimpleCoords> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await requestDeviceLocationPermission();
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 10000
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null
      };
    } catch (nativeErr) {
      console.warn("Native getCurrentPosition failed, falling back to navigator.geolocation:", nativeErr);
    }
  }

  // Web or fallback
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return reject(new Error("Geolocation is not supported."));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 5000
      }
    );
  });
};

/**
 * Continuous GPS tracking watch listener that works seamlessly on both Web and Native Android APK.
 */
export const watchDevicePosition = (
  onPosition: (coords: SimpleCoords) => void,
  onError: (err: any) => void
): (() => void) => {
  let isCancelled = false;
  let nativeWatchId: string | null = null;
  let webWatchId: number | null = null;

  if (Capacitor.isNativePlatform()) {
    Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      (pos: Position | null, err?: any) => {
        if (isCancelled) return;
        if (err) {
          console.warn("Capacitor watchPosition error:", err);
          onError(err);
          return;
        }
        if (pos) {
          onPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null
          });
        }
      }
    ).then((watchId) => {
      if (isCancelled) {
        Geolocation.clearWatch({ id: watchId });
      } else {
        nativeWatchId = watchId;
      }
    }).catch((e) => {
      console.warn("Failed to start Capacitor watchPosition, falling back to Web Geolocation:", e);
      if (!isCancelled && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        webWatchId = navigator.geolocation.watchPosition(
          (pos) => onPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null
          }),
          onError,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );
      }
    });
  } else {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => onPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null
        }),
        onError,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    } else {
      onError(new Error("Geolocation unsupported in this environment."));
    }
  }

  return () => {
    isCancelled = true;
    if (nativeWatchId) {
      Geolocation.clearWatch({ id: nativeWatchId }).catch(() => {});
    }
    if (webWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(webWatchId);
    }
  };
};
