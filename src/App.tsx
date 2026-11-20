import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  doc, 
  updateDoc,
  addDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut,
  signInAnonymously
} from 'firebase/auth';
import { 
  Ambulance as AmbulanceIcon, 
  Hospital as HospitalIcon, 
  TrafficCone, 
  AlertCircle, 
  MapPin, 
  Navigation, 
  Activity, 
  Clock, 
  CheckCircle2,
  LogOut,
  User as UserIcon,
  Phone,
  Bed,
  ChevronRight,
  Map as MapIcon,
  Wifi,
  WifiOff,
  AlertTriangle,
  Gauge,
  Zap,
  Maximize2,
  Minimize2,
  Crosshair,
  Layers,
  ArrowRight,
  Plus,
  Minus,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  HeartPulse,
  Siren,
  Sliders,
  Radio,
  Search,
  Trophy,
  Filter,
  Sparkles,
  Users,
  Stethoscope,
  Info,
  Compass,
  XCircle,
  ShieldCheck,
  FileText,
  Check,
  X,
  Shield,
  RotateCcw,
  Trash2,
  CheckCircle,
  Volume2,
  VolumeX,
  Fingerprint,
  Lock,
  KeyRound,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Megaphone,
  Unlock,
  ShieldBan,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  seedHospitals, 
  seedTrafficSignals, 
  createEmergency, 
  updateAmbulanceStatus,
  updateSignalStatus,
  seedAroundLocation,
  fetchRealRoute,
  calculateDistanceKm,
  createEmergencyBedRequest,
  acceptAndReserveBed,
  rejectEmergencyRequest,
  markPatientArrived,
  cancelEmergencyRequest,
  expireEmergencyRequest,
  subscribeEmergencyRequests,
  EmergencyRequest,
  EmergencyRequestStatus,
  EmergencyRequestSeverity,
  getCardinalDirection,
  completeEmergencyRoute,
  completeAllActiveEmergencies,
  sanitizeForFirestore,
  adminUpdateHospital,
  adminResetAllTrafficSignals,
  adminUpdateAmbulanceControl,
  adminDeleteAmbulance,
  adminPurgeFinishedRequests,
  adminFetchUsers,
  adminUpdateUserRole
} from './services/emergencyService';
import { 
  getUserProfile, 
  ensureUserProfile, 
  updateUserProfile, 
  UserRole, 
  UserProfile 
} from './services/userService';
import {
  requestTrafficNotificationPermission,
  removeTrafficNotificationToken,
  evaluateProximityNotifications,
  triggerLocalDemoNotification,
  triggerDirectFCMTestAlert,
  triggerTrafficCorridorAlert,
  playEmergencySirenAlert,
  initNotificationChannels
} from './services/notificationService';
import {
  getDeviceCurrentPosition,
  watchDevicePosition,
  requestDeviceLocationPermission
} from './services/locationService';
import {
  signInWithGoogleCrossPlatform,
  signOutCrossPlatform
} from './services/authService';
import {
  isBiometricEnabled,
  setBiometricEnabled,
  checkBiometricAvailability,
  authenticateBiometric,
  addBiometricResumeListener,
  getBiometryTypeName,
  BiometryType,
  BiometryErrorType
} from './services/biometricService';
import {
  TrafficOfficerAccount,
  PoliceOfficerSession,
  SystemBroadcast,
  AdminSession,
  ADMIN_AUTH_STORAGE_KEY,
  getStoredAdminSession,
  authenticateAdmin,
  logoutAdmin,
  TRAFFIC_AUTH_STORAGE_KEY,
  subscribeTrafficOfficers,
  seedDefaultTrafficOfficerIfNeeded,
  createTrafficOfficer,
  authenticateTrafficOfficer,
  resetTrafficOfficerPassword,
  toggleTrafficOfficerActive,
  forceLogoutTrafficOfficer,
  updateTrafficOfficerDetails,
  deleteTrafficOfficer,
  markTrafficOfficerOffline,
  generateStrongPassword,
  subscribeGlobalBroadcast,
  publishGlobalBroadcast,
  clearGlobalBroadcast
} from './services/trafficAuthService';
import voiceGuidance, { VoicePromptEvent } from './services/voiceGuidanceService';

// Google Maps Platform Imports
import { 
  APIProvider, 
  Map as GoogleMap, 
  AdvancedMarker, 
  Pin,
  useMap as useGoogleMap
} from '@vis.gl/react-google-maps';

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';


// Optimized GPU-Accelerated DivIcons for Leaflet (No CPU-intensive multi-ping loops)
const createPulsingIcon = (color: string, label: string, isAnimated = false) => L.divIcon({
  html: `
    <div class="relative flex items-center justify-center transform-gpu">
      ${isAnimated ? `<div class="absolute w-7 h-7 rounded-full animate-ping opacity-40" style="background-color: ${color};"></div>` : ''}
      <div class="relative w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-black text-white" style="background-color: ${color}; font-family: sans-serif; box-shadow: 0 0 10px ${color}80;">
        ${label}
      </div>
    </div>
  `,
  className: 'custom-leaflet-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const hospitalIcon = createPulsingIcon('#3b82f6', '🏥', false); // Blue Standard
const selectedHospitalIcon = createPulsingIcon('#22c55e', '🟢', true); // Green Selected
const recommendedHospitalIcon = createPulsingIcon('#eab308', '🏆', false); // Gold Recommended
const ambulanceIcon = createPulsingIcon('#ef4444', '🚑', true); // Red Emergency (Pulsing)
const signalIcon = createPulsingIcon('#f59e0b', '🚦', false); // Amber
const activeSignalIcon = createPulsingIcon('#22c55e', '⚡', true); // Green Emergency

// High-visibility animated vehicle icon for Leaflet Dark Canvas map
const createAmbulanceLeafletIcon = (isStale: boolean, name: string, timeStr: string) => L.divIcon({
  html: `
    <div style="width: 44px; display: flex; flex-direction: column; align-items: center; user-select: none; cursor: pointer; pointer-events: auto;">
      <div style="background-color: ${isStale ? '#451a03' : '#7f1d1d'}; color: #ffffff; border: 1px solid ${isStale ? '#f59e0b' : '#ef4444'}; border-radius: 9999px; padding: 2px 7px; font-size: 9px; font-weight: 800; font-family: monospace; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: ${isStale ? '#fbbf24' : '#34d399'};"></span>
        <span style="max-width: 90px; overflow: hidden; text-overflow: ellipsis;">${name}</span>
        <span style="color: ${isStale ? '#fbbf24' : '#6ee7b7'};">(${isStale ? timeStr : 'LIVE'})</span>
      </div>
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background-color: ${isStale ? '#f59e0b' : '#ef4444'}; opacity: 0.5; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 34px; height: 34px; border-radius: 12px; border: 2px solid #ffffff; background: ${isStale ? 'linear-gradient(135deg, #f59e0b, #b45309)' : 'linear-gradient(135deg, #ef4444, #be123c)'}; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 17px;">
          🚑
        </div>
      </div>
    </div>
  `,
  className: 'custom-ambulance-leaflet-icon',
  iconSize: [44, 52],
  iconAnchor: [22, 52]
});

// Dynamic Traffic Signal Icons for Real Signals & States (Optimized)
const createSignalStateIcon = (
  status: 'normal' | 'emergency-green', 
  currentState: 'red' | 'yellow' | 'green' = 'green',
  countdownSecs?: number
) => {
  if (status === 'emergency-green') {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center cursor-pointer transform-gpu">
          <div class="absolute w-8 h-8 rounded-full bg-emerald-500/40 animate-ping"></div>
          <div class="relative w-7 h-7 rounded-full border-2 border-emerald-300 bg-emerald-600 shadow-xl shadow-emerald-500/80 flex flex-col items-center justify-center text-white">
            <span class="text-[11px] leading-none font-black animate-pulse">⚡</span>
          </div>
        </div>
      `,
      className: 'custom-leaflet-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }

  if (currentState === 'red') {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center cursor-pointer transform-gpu">
          <div class="relative w-6 h-6 rounded-full border-2 border-red-300 bg-red-600 shadow-md shadow-red-600/50 flex flex-col items-center justify-center text-white">
            <span class="text-[8px] leading-none font-black">🔴</span>
            ${countdownSecs !== undefined ? `<span class="text-[6px] font-mono font-black leading-none">${countdownSecs}s</span>` : ''}
          </div>
        </div>
      `,
      className: 'custom-leaflet-icon',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  if (currentState === 'yellow') {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center cursor-pointer transform-gpu">
          <div class="relative w-6 h-6 rounded-full border-2 border-amber-300 bg-amber-500 shadow-md shadow-amber-500/50 flex flex-col items-center justify-center text-slate-950">
            <span class="text-[8px] leading-none font-black">🟡</span>
            ${countdownSecs !== undefined ? `<span class="text-[6px] font-mono font-black leading-none">${countdownSecs}s</span>` : ''}
          </div>
        </div>
      `,
      className: 'custom-leaflet-icon',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  // Normal Green
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center cursor-pointer transform-gpu">
        <div class="relative w-6 h-6 rounded-full border-2 border-emerald-300 bg-emerald-600 shadow-md shadow-emerald-600/50 flex flex-col items-center justify-center text-white">
          <span class="text-[8px] leading-none font-black">🟢</span>
          ${countdownSecs !== undefined ? `<span class="text-[6px] font-mono font-black leading-none">${countdownSecs}s</span>` : ''}
        </div>
      </div>
    `,
    className: 'custom-leaflet-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
};

// Google Maps Real-time Traffic Layer Component
function GoogleTrafficOverlay({ enabled }: { enabled: boolean }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;
    const traffic = new google.maps.TrafficLayer();
    if (enabled) {
      traffic.setMap(map);
    } else {
      traffic.setMap(null);
    }
    return () => {
      try {
        traffic.setMap(null);
      } catch (_) {}
    };
  }, [map, enabled]);
  return null;
}

// Google Maps Route Polyline Component
function GoogleRoutePolyline({
  coords,
  strokeColor = '#ef4444',
  strokeWeight = 5,
  strokeOpacity = 0.9,
  isDashed = false
}: {
  coords: { lat: number; lng: number }[];
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  isDashed?: boolean;
  key?: string;
}) {
  const map = useGoogleMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [resolvedPath, setResolvedPath] = useState<{ lat: number; lng: number }[]>(coords);

  useEffect(() => {
    let isCancelled = false;

    // If we only have 2 points (or start & end point), resolve the real driving streets via Google DirectionsService!
    if (coords.length === 2 && typeof google !== 'undefined' && google.maps?.DirectionsService) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: coords[0],
          destination: coords[1],
          travelMode: google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (!isCancelled && status === google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
            const pathPoints = result.routes[0].overview_path.map(pt => ({
              lat: pt.lat(),
              lng: pt.lng()
            }));
            setResolvedPath(pathPoints);
          } else if (!isCancelled) {
            setResolvedPath(coords);
          }
        }
      );
    } else {
      setResolvedPath(coords);
    }

    return () => {
      isCancelled = true;
    };
  }, [coords]);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps || resolvedPath.length === 0) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    const polylineOptions: google.maps.PolylineOptions = {
      path: resolvedPath,
      strokeColor,
      strokeOpacity: isDashed ? 0 : strokeOpacity,
      strokeWeight,
      map,
      icons: isDashed
        ? [
            {
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                strokeColor,
                scale: 3
              },
              offset: '0',
              repeat: '14px'
            }
          ]
        : undefined
    };

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline(polylineOptions);
    } else {
      polylineRef.current.setOptions(polylineOptions);
    }

    return () => {
      try {
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }
      } catch (_) {}
    };
  }, [map, resolvedPath, strokeColor, strokeWeight, strokeOpacity, isDashed]);

  return null;
}

// Google Maps Bounds Handler to fit selected route and destination smoothly without fighting user pan/zoom
function GoogleMapBoundsHandler({
  selectedCoords,
  center,
  targetKey,
  isUserInteracting,
  setIsUserInteracting,
  recenterTrigger
}: {
  selectedCoords: { lat: number; lng: number }[];
  center: [number, number];
  targetKey?: string;
  isUserInteracting: boolean;
  setIsUserInteracting: (v: boolean) => void;
  recenterTrigger?: number;
}) {
  const map = useGoogleMap();
  const lastFittedKeyRef = useRef<string | null>(null);

  // Track user drag / zoom gestures so map doesn't snap back when user is exploring
  useEffect(() => {
    if (!map) return;
    const dragListener = map.addListener('dragstart', () => {
      setIsUserInteracting(true);
    });
    return () => {
      try {
        if (dragListener) {
          if (typeof (dragListener as any).remove === 'function') {
            (dragListener as any).remove();
          } else if (typeof google !== 'undefined' && google?.maps?.event?.removeListener) {
            google.maps.event.removeListener(dragListener);
          }
        }
      } catch (_) {}
    };
  }, [map, setIsUserInteracting]);

  // Explicit re-center trigger (when user taps "Re-center" button)
  useEffect(() => {
    if (!map || recenterTrigger === undefined || recenterTrigger === 0) return;
    setIsUserInteracting(false);
    map.panTo({ lat: center[0], lng: center[1] });
  }, [recenterTrigger, map, center, setIsUserInteracting]);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    const currentKey = targetKey || (selectedCoords.length > 0 ? `${selectedCoords[0]?.lat}_${selectedCoords[selectedCoords.length - 1]?.lat}_${selectedCoords.length}` : `${center[0]}_${center[1]}`);
    
    // Only fit bounds if target has changed
    if (lastFittedKeyRef.current === currentKey) {
      return;
    }

    const isExplicitTargetChange = Boolean(targetKey && targetKey.startsWith('target-'));

    // If user is currently dragging or exploring the map, do not steal camera unless destination changed
    if (isUserInteracting && !isExplicitTargetChange) {
      return;
    }

    lastFittedKeyRef.current = currentKey;
    if (isExplicitTargetChange) {
      setIsUserInteracting(false);
    }

    if (selectedCoords && selectedCoords.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      selectedCoords.forEach(pt => bounds.extend(pt));
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else if (!isUserInteracting) {
      map.panTo({ lat: center[0], lng: center[1] });
    }
  }, [map, selectedCoords, center, targetKey, isUserInteracting, setIsUserInteracting]);

  return null;
}

// Leaflet Map Controller to smoothly pan when center coordinates update without fighting user gestures
function LeafletMapController({ 
  center,
  isUserInteracting,
  setIsUserInteracting,
  recenterTrigger
}: { 
  center: [number, number];
  isUserInteracting: boolean;
  setIsUserInteracting: (v: boolean) => void;
  recenterTrigger?: number;
}) {
  const map = useMap();
  const lastCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    const onUserGesture = () => {
      setIsUserInteracting(true);
    };
    map.on('dragstart', onUserGesture);
    map.on('zoomstart', onUserGesture);
    return () => {
      map.off('dragstart', onUserGesture);
      map.off('zoomstart', onUserGesture);
    };
  }, [map, setIsUserInteracting]);

  // Explicit re-center trigger
  useEffect(() => {
    if (recenterTrigger === undefined || recenterTrigger === 0) return;
    setIsUserInteracting(false);
    map.panTo(center, { animate: true, duration: 0.8 });
    lastCenterRef.current = center;
  }, [recenterTrigger, map, center, setIsUserInteracting]);

  useEffect(() => {
    if (!center || !center[0] || !center[1]) return;
    if (isUserInteracting) return;

    if (!lastCenterRef.current) {
      map.setView(center, map.getZoom());
      lastCenterRef.current = center;
      return;
    }

    const dLat = Math.abs(center[0] - lastCenterRef.current[0]);
    const dLng = Math.abs(center[1] - lastCenterRef.current[1]);
    // Only pan if coordinate moved significantly (> ~150m) to avoid micro-snapping
    if (dLat > 0.0015 || dLng > 0.0015) {
      map.panTo(center, { animate: true, duration: 0.8 });
      lastCenterRef.current = center;
    }
  }, [center[0], center[1], map, isUserInteracting]);

  return null;
}

// Types

interface Hospital {
  id: string;
  name: string;
  address?: string;
  location: { lat: number; lng: number };
  totalBeds: number;
  availableBeds: number;
  icuBeds?: number;
  emergencyBeds?: number;
  occupancyRate?: number;
  waitingTimeMins?: number;
  doctorsOnDuty?: number;
  emergencyQueue?: number;
  emergencyServices: string[];
  contact: string;
  isFallbackData?: boolean;
}

interface Ambulance {
  id: string;
  driverName: string;
  location: { lat: number; lng: number };
  status: 'idle' | 'responding' | 'transporting';
  uid: string;
  currentEmergencyId?: string;
  speed?: number;
  targetHospitalId?: string | null;
  targetHospitalName?: string | null;
  lastUpdated?: string;
  lastSeenTimestamp?: number;
  lastSeenLocation?: { lat: number; lng: number };
}

interface Emergency {
  id: string;
  ambulanceId: string;
  hospitalId: string;
  emergencyType: string;
  patientInfo: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'transporting';
  createdAt: string;
  eta: string;
  routeCoords?: { lat: number, lng: number }[];
  etaMins?: number;
  distanceKm?: number;
}

interface TrafficSignal {
  id: string;
  signalId?: string;
  name?: string;
  roadName?: string;
  location: { lat: number; lng: number };
  status: 'normal' | 'emergency-green';
  currentState?: 'red' | 'yellow' | 'green';
  countdownSecs?: number;
  activeAmbulanceId?: string;
  activeAmbulanceLocation?: { lat: number; lng: number };
  activeAmbulanceDriver?: string;
  activeAmbulanceHospital?: string;
  isFallbackData?: boolean;
}

// Helper to calculate minimum distance from a signal location to a route polyline
export function getDistanceToRouteKm(
  signalLat: number,
  signalLng: number,
  routeCoords: [number, number][]
): number {
  if (!routeCoords || routeCoords.length === 0) return 999;
  let minD = 999;
  const step = Math.max(1, Math.floor(routeCoords.length / 40));
  for (let i = 0; i < routeCoords.length; i += step) {
    const pt = routeCoords[i];
    const d = parseFloat(calculateDistance(signalLat, signalLng, pt[0], pt[1]));
    if (d < minD) minD = d;
  }
  return minD;
}

// --- Distance Calculator Helper ---
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return d.toFixed(1);
}

// --- Map Controls Overlay ---
function MapControls({ 
  onRecenter, 
  showHeatmap, 
  setShowHeatmap, 
  showLegend, 
  setShowLegend 
}: { 
  onRecenter: () => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  showLegend: boolean;
  setShowLegend: (v: boolean) => void;
}) {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    const container = map.getContainer().parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      {/* Zoom Controls */}
      <div className="bg-[#111827]/90 backdrop-blur-md border border-[#1F2937] rounded-xl p-1 shadow-2xl flex flex-col gap-1">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#1F2937] rounded-lg transition-colors cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#1F2937] rounded-lg transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Map Feature Toggles */}
      <div className="bg-[#111827]/90 backdrop-blur-md border border-[#1F2937] rounded-xl p-1 shadow-2xl flex flex-col gap-1">
        <button
          type="button"
          onClick={onRecenter}
          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#1F2937] rounded-lg transition-colors cursor-pointer"
          title="Recenter Map"
        >
          <Crosshair className="w-4 h-4 text-blue-400" />
        </button>
        <button
          type="button"
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
            showHeatmap ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-[#1F2937]"
          )}
          title="Toggle Traffic Heatmap"
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowLegend(!showLegend)}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
            showLegend ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-white hover:bg-[#1F2937]"
          )}
          title="Toggle Map Legend"
        >
          <MapIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#1F2937] rounded-lg transition-colors cursor-pointer"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// --- Map Component ---
function EmergencyMap({ 
  hospitals, 
  ambulances, 
  signals, 
  center,
  onSelectHospital,
  selectedHospital,
  recommendedHospitalId,
  emergencies = [],
  routeCoords = [],
  signalFilter = 'all'
}: { 
  hospitals: Hospital[], 
  ambulances: Ambulance[], 
  signals: TrafficSignal[], 
  center: [number, number],
  onSelectHospital?: (h: Hospital) => void,
  selectedHospital?: Hospital | null,
  recommendedHospitalId?: string,
  emergencies?: Emergency[],
  routeCoords?: [number, number][],
  signalFilter?: 'all' | 'route' | 'corridor' | 'hidden'
}) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Active route points for route filter distance calculation
  const activeRoutePts = useMemo(() => {
    if (routeCoords && routeCoords.length > 0) return routeCoords;
    const activeEmerg = emergencies.find(e => e.status === 'active');
    if (activeEmerg?.routeCoords && activeEmerg.routeCoords.length > 0) {
      return activeEmerg.routeCoords.map(pt => [pt.lat, pt.lng] as [number, number]);
    }
    return [];
  }, [routeCoords, emergencies]);

  // Filtered signals for rendering on map based on signalFilter
  const filteredSignals = useMemo(() => {
    if (signalFilter === 'hidden') return [];
    if (signalFilter === 'corridor') {
      return signals.filter(s => s.status === 'emergency-green');
    }
    if (signalFilter === 'route') {
      if (activeRoutePts.length === 0) return signals;
      return signals.filter(s => getDistanceToRouteKm(s.location.lat, s.location.lng, activeRoutePts) <= 0.35);
    }
    return signals;
  }, [signals, signalFilter, activeRoutePts]);

  const googleMapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBugvpahfVgbiAdDPX0KL3YJN0k110DZa8';
  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet'>('google');
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);

  return (
    <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-[#1F2937] shadow-2xl relative bg-[#070B17]">
      {/* Map Engine Toggle Pill */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 bg-[#0b0f19]/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-2xl">
        <button
          type="button"
          onClick={() => setMapEngine('google')}
          className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
            mapEngine === 'google' ? "bg-blue-600 text-white shadow-md shadow-blue-600/40" : "text-slate-400 hover:text-white"
          )}
        >
          <span>🗺️ Google Maps</span>
        </button>
        <button
          type="button"
          onClick={() => setMapEngine('leaflet')}
          className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
            mapEngine === 'leaflet' ? "bg-slate-700 text-white shadow-md" : "text-slate-400 hover:text-white"
          )}
        >
          <span>🌐 Dark Canvas</span>
        </button>
      </div>

      {mapEngine === 'google' ? (
        <APIProvider apiKey={googleMapsApiKey}>
          <GoogleMap
            id="main-google-map"
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: center[0], lng: center[1] }}
            defaultZoom={13}
            style={{ height: '100%', width: '100%' }}
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
          >
            <GoogleTrafficOverlay enabled={showHeatmap} />

            {/* Real Hospitals Advanced Markers */}
            {hospitals.map(h => {
              const isSelected = selectedHospital?.id === h.id;
              const isRecommended = recommendedHospitalId === h.id;
              return (
                <AdvancedMarker
                  key={`g-hosp-${h.id}`}
                  position={{ lat: h.location.lat, lng: h.location.lng }}
                  title={h.name}
                  onClick={() => onSelectHospital && onSelectHospital(h)}
                  zIndex={isSelected ? 50 : isRecommended ? 40 : 10}
                >
                  <Pin
                    background={isSelected ? '#22c55e' : isRecommended ? '#eab308' : '#3b82f6'}
                    borderColor="#ffffff"
                    glyphColor="#ffffff"
                    scale={isSelected ? 1.3 : 1.0}
                  />
                </AdvancedMarker>
              );
            })}

            {/* Ambulances Advanced Markers */}
            {ambulances.map(a => {
              const pingTs = a.lastSeenTimestamp || 0;
              const isStale = a.status !== 'idle' && pingTs > 0 && (Date.now() - pingTs > 25000);
              const timeStr = a.lastUpdated || 'Recent';
              return (
                <AdvancedMarker
                  key={`g-amb-${a.id}`}
                  position={{ lat: a.location.lat, lng: a.location.lng }}
                  title={`Ambulance: ${a.driverName} - ${isStale ? `Last Seen: ${timeStr} (Offline Fallback)` : `Live GPS (${timeStr})`}`}
                  zIndex={9999}
                >
                  <div className="relative flex flex-col items-center select-none cursor-pointer group" style={{ pointerEvents: 'auto' }}>
                    <div className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black font-mono shadow-2xl border flex items-center gap-1.5 mb-1 whitespace-nowrap transition-transform group-hover:scale-105",
                      isStale 
                        ? "bg-amber-950/95 text-amber-300 border-amber-500/60 shadow-amber-950/60" 
                        : "bg-red-950/95 text-white border-red-500 shadow-red-950/80"
                    )}>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0", 
                        isStale ? "bg-amber-400" : "bg-emerald-400 animate-ping"
                      )} />
                      <span className="font-extrabold">{a.driverName}</span>
                      <span className={cn("text-[9px]", isStale ? "text-amber-400" : "text-emerald-300")}>
                        ({isStale ? `Last: ${timeStr}` : 'LIVE GPS'})
                      </span>
                    </div>
                    <div className="relative flex items-center justify-center">
                      <div className={cn(
                        "absolute w-12 h-12 rounded-full opacity-60 animate-ping",
                        isStale ? "bg-amber-500" : "bg-red-500"
                      )} />
                      <div className={cn(
                        "relative w-10 h-10 rounded-2xl border-2 flex items-center justify-center shadow-2xl text-xl transition-transform group-hover:scale-110",
                        isStale 
                          ? "bg-gradient-to-br from-amber-500 to-amber-700 border-amber-200 text-white shadow-amber-600/70" 
                          : "bg-gradient-to-br from-red-500 to-rose-700 border-white text-white shadow-red-600/90"
                      )}>
                        🚑
                      </div>
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Traffic Signals Advanced Markers */}
            {filteredSignals.map(s => (
              <AdvancedMarker
                key={`g-sig-${s.id}`}
                position={{ lat: s.location.lat, lng: s.location.lng }}
                title={s.name || 'Traffic Signal'}
              >
                <Pin
                  background={s.status === 'emergency-green' ? '#10b981' : '#f59e0b'}
                  borderColor="#ffffff"
                  glyphColor="#ffffff"
                />
              </AdvancedMarker>
            ))}

            {/* Google Maps Route Polyline - Selected Hospital Route Preview */}
            {selectedHospital && routeCoords && routeCoords.length > 0 && (
              <GoogleRoutePolyline
                coords={routeCoords.map(([lat, lng]) => ({ lat, lng }))}
                strokeColor="#dc2626"
                strokeWeight={7}
                strokeOpacity={1.0}
                isDashed={false}
              />
            )}

            {/* Google Maps Route Polyline - Active Emergency Responding Route */}
            {emergencies.filter(e => e.status === 'active').map(e => {
              const amb = ambulances.find(a => a.id === e.ambulanceId);
              const hosp = hospitals.find(h => h.id === e.hospitalId);
              if (amb && hosp) {
                if (e.routeCoords && e.routeCoords.length > 0) {
                  return (
                    <GoogleRoutePolyline
                      key={`g-active-route-${e.id}`}
                      coords={e.routeCoords}
                      strokeColor="#dc2626"
                      strokeWeight={8}
                      strokeOpacity={1.0}
                      isDashed={false}
                    />
                  );
                }
                return (
                  <GoogleRoutePolyline
                    key={`g-active-direct-${e.id}`}
                    coords={[
                      { lat: amb.location.lat, lng: amb.location.lng },
                      { lat: hosp.location.lat, lng: hosp.location.lng }
                    ]}
                    strokeColor="#dc2626"
                    strokeWeight={8}
                    strokeOpacity={1.0}
                    isDashed={false}
                  />
                );
              }
              return null;
            })}

            {/* Google Maps Auto-Fit Camera Bounds */}
            <GoogleMapBoundsHandler
              targetKey={selectedHospital ? `target-${selectedHospital.id}-${routeCoords?.length || 0}` : `default-${center[0]}_${center[1]}`}
              selectedCoords={
                routeCoords && routeCoords.length > 0
                  ? routeCoords.map(([lat, lng]) => ({ lat, lng }))
                  : selectedHospital && ambulances[0]
                  ? [
                      { lat: ambulances[0].location.lat, lng: ambulances[0].location.lng },
                      { lat: selectedHospital.location.lat, lng: selectedHospital.location.lng }
                    ]
                  : []
              }
              center={center}
              isUserInteracting={isUserInteracting}
              setIsUserInteracting={setIsUserInteracting}
              recenterTrigger={recenterCount}
            />
          </GoogleMap>
        </APIProvider>
      ) : (
        <MapContainer 
          center={center} 
          zoom={13} 
          preferCanvas={true}
          style={{ height: '100%', width: '100%' }} 
          zoomControl={false}
        >
          <LeafletMapController 
            center={center} 
            isUserInteracting={isUserInteracting}
            setIsUserInteracting={setIsUserInteracting}
            recenterTrigger={recenterCount}
          />

        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
          maxZoom={16}
          keepBuffer={4}
          updateWhenIdle={true}
          updateWhenZooming={false}
        />

        {showHeatmap && filteredSignals.map(s => {
          const isEmergency = s.status === 'emergency-green';
          
          // GPS offsets for radiating street legs (approx 250m)
          const offset = 0.0022; 
          
          // Colors matching Google Maps traffic layer
          const googleGreen = '#0f9d58';
          const googleYellow = '#f4b400';
          const googleRed = '#db4437';
          const googleBurgundy = '#8b0000';

          const northColor = isEmergency ? googleBurgundy : googleRed;
          const southColor = isEmergency ? googleBurgundy : googleYellow;
          const eastColor = isEmergency ? googleGreen : googleGreen;
          const westColor = isEmergency ? googleGreen : googleBurgundy;

          return (
            <React.Fragment key={`heatmap-${s.id}`}>
              {/* Regional Ambient Traffic Glow Backdrop */}
              <Circle
                center={[s.location.lat, s.location.lng]}
                radius={320}
                pathOptions={{
                  color: isEmergency ? '#10b981' : '#f59e0b',
                  fillColor: isEmergency ? '#10b981' : '#f59e0b',
                  fillOpacity: 0.08,
                  stroke: false,
                  interactive: false
                }}
              />

              {/* Street-level traffic overlay polylines */}
              <Polyline
                positions={[
                  [s.location.lat, s.location.lng],
                  [s.location.lat + offset, s.location.lng]
                ]}
                color={northColor}
                weight={6}
                opacity={0.85}
                lineCap="round"
              />
              <Polyline
                positions={[
                  [s.location.lat, s.location.lng],
                  [s.location.lat - offset, s.location.lng]
                ]}
                color={southColor}
                weight={6}
                opacity={0.85}
                lineCap="round"
              />
              <Polyline
                positions={[
                  [s.location.lat, s.location.lng],
                  [s.location.lat, s.location.lng + offset]
                ]}
                color={eastColor}
                weight={6}
                opacity={0.85}
                lineCap="round"
              />
              <Polyline
                positions={[
                  [s.location.lat, s.location.lng],
                  [s.location.lat, s.location.lng - offset]
                ]}
                color={westColor}
                weight={6}
                opacity={0.85}
                lineCap="round"
              />
            </React.Fragment>
          );
        })}
        
        {hospitals.map(h => {
          const isSelected = selectedHospital?.id === h.id;
          const isRecommended = recommendedHospitalId === h.id;
          const markerIcon = isSelected 
            ? selectedHospitalIcon 
            : isRecommended 
              ? recommendedHospitalIcon 
              : hospitalIcon;

          const ambLoc = ambulances[0]?.location || { lat: center[0], lng: center[1] };
          const distKm = calculateDistance(ambLoc.lat, ambLoc.lng, h.location.lat, h.location.lng);
          const eta = Math.max(1, Math.round((parseFloat(distKm) / 40) * 60 + 2));
          const emergencyBedsCount = h.emergencyBeds || Math.ceil((h.availableBeds || 10) * 0.4);
          const occupancyPct = h.occupancyRate || Math.min(95, Math.max(50, Math.round((((h.totalBeds || 100) - (h.availableBeds || 10)) / (h.totalBeds || 100)) * 100)));

          return (
            <Marker 
              key={h.id} 
              position={[h.location.lat, h.location.lng]} 
              icon={markerIcon}
              eventHandlers={{
                click: () => {
                  if (onSelectHospital) {
                    onSelectHospital(h);
                  }
                }
              }}
            >
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
                    {isRecommended && <span>🏆</span>}
                    {isSelected && <span>🟢</span>}
                    <span className="truncate">{h.name}</span>
                  </div>
                  {h.address && <div className="text-slate-500 text-[10px] truncate mt-0.5">{h.address}</div>}

                  <div className="grid grid-cols-2 gap-1.5 mt-2 bg-slate-100 p-2 rounded-lg text-[11px] font-mono text-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-sans">Distance</span>
                      <span className="font-bold">{distKm} km</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-sans">ETA</span>
                      <span className="font-bold text-red-600">{eta} mins</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-sans">Available Beds</span>
                      <span className="font-bold text-blue-600">{h.availableBeds} ({emergencyBedsCount} ER)</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-sans">Occupancy</span>
                      <span className="font-bold">{occupancyPct}%</span>
                    </div>
                  </div>

                  <div className="mt-1.5 text-[10px] text-slate-600 flex items-center justify-between">
                    <span>Queue: <strong>{h.emergencyQueue !== undefined ? h.emergencyQueue : 2} patients</strong></span>
                    <span>Wait: <strong>{h.waitingTimeMins || 8}m</strong></span>
                  </div>

                  {onSelectHospital && (
                    <button 
                      type="button"
                      className="w-full text-center px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold mt-2 cursor-pointer transition-all shadow-md"
                      onClick={() => onSelectHospital(h)}
                    >
                      {isSelected ? "Target Hospital Selected" : "Select Hospital"}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {ambulances.map(a => {
          const pingTs = a.lastSeenTimestamp || 0;
          const isStale = a.status !== 'idle' && pingTs > 0 && (Date.now() - pingTs > 25000);
          const timeStr = a.lastUpdated || 'Recent';
          const ambIcon = createAmbulanceLeafletIcon(isStale, a.driverName, timeStr);
          return (
            <Marker key={a.id} position={[a.location.lat, a.location.lng]} icon={ambIcon} zIndexOffset={9999}>
              <Popup>
                <div className="text-slate-900 font-bold flex items-center justify-between gap-2">
                  <span>Ambulance: {a.driverName}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${isStale ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {isStale ? 'LAST SEEN' : 'LIVE GPS'}
                  </span>
                </div>
                <div className="text-slate-600 text-xs capitalize mt-0.5">Status: {a.status}</div>
                <div className="text-slate-500 text-[10px] font-mono mt-1">
                  {isStale ? `Last Seen: ${timeStr}` : `GPS Updated: ${timeStr}`}
                </div>
                <div className="text-slate-500 text-[9px] font-mono">
                  Coords: {a.location.lat.toFixed(4)}, {a.location.lng.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {filteredSignals.map((s, idx) => {
          const ambLoc = ambulances[0]?.location || { lat: center[0], lng: center[1] };
          const distToAmb = calculateDistance(ambLoc.lat, ambLoc.lng, s.location.lat, s.location.lng);
          const isOnRoute = activeRoutePts.length > 0 && getDistanceToRouteKm(s.location.lat, s.location.lng, activeRoutePts) <= 0.35;
          const initialStates: Array<'red' | 'yellow' | 'green'> = ['red', 'green', 'red', 'yellow', 'green'];
          const currentState = s.currentState || initialStates[idx % initialStates.length];
          const countdown = s.countdownSecs !== undefined ? s.countdownSecs : (18 + (idx * 7) % 30);
          const sigIcon = createSignalStateIcon(s.status, currentState, countdown);

          return (
            <Marker 
              key={s.id} 
              position={[s.location.lat, s.location.lng]} 
              icon={sigIcon}
            >
              <Popup>
                <div className="p-1 min-w-[210px] space-y-2">
                  <div className="flex items-center justify-between border-b pb-1">
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                        <span>🚥</span> {s.name || `Junction Signal #${idx + 1}`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.roadName || 'Intersection Corridor'}</div>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border">
                      {s.signalId || `SIG-${s.id.slice(-4)}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-2 rounded-lg text-[10px] font-mono text-slate-800">
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase block font-sans">Distance</span>
                      <span className="font-bold">{distToAmb} km</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase block font-sans">Route Status</span>
                      <span className={cn("font-bold", isOnRoute ? "text-emerald-600" : "text-slate-600")}>
                        {isOnRoute ? "On Emergency Route" : "Standard Area"}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200">
                      <span className="text-[8px] text-slate-500 uppercase font-sans">Signal State</span>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                        s.status === 'emergency-green'
                          ? "bg-emerald-600 text-white animate-pulse"
                          : currentState === 'red'
                            ? "bg-red-600 text-white"
                            : currentState === 'yellow'
                              ? "bg-amber-500 text-slate-950"
                              : "bg-emerald-600 text-white"
                      )}>
                        {s.status === 'emergency-green' ? '⚡ Emergency Override' : `${currentState.toUpperCase()} • ${countdown}s`}
                      </span>
                    </div>
                  </div>

                  {s.isFallbackData && (
                    <div className="text-[9px] text-slate-500 italic flex items-center gap-1">
                      <span>📍</span> Bengaluru Intersections Dataset
                    </div>
                  )}

                  <button 
                    type="button"
                    className={cn(
                      "w-full text-center px-2 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer",
                      s.status === 'emergency-green'
                        ? "bg-slate-700 hover:bg-slate-800 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                    onClick={async () => {
                      const newStatus = s.status === 'emergency-green' ? 'normal' : 'emergency-green';
                      await updateSignalStatus(s.id, newStatus);
                    }}
                  >
                    {s.status === 'emergency-green' ? 'Restore Normal Cycle' : 'Trigger Emergency Override ⚡'}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Selected Route Path - Preview Polyline */}
        {selectedHospital && routeCoords && routeCoords.length > 0 && (
          <Polyline
            positions={routeCoords}
            color="#dc2626"
            weight={7}
            opacity={1.0}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Active Emergency Routes - Driving Street Polyline */}
        {emergencies.filter(e => e.status === 'active').map(e => {
          const amb = ambulances.find(a => a.id === e.ambulanceId);
          const hosp = hospitals.find(h => h.id === e.hospitalId);
          if (amb && hosp) {
            if (e.routeCoords && e.routeCoords.length > 0) {
              const pts = e.routeCoords.map((pt: any) => [pt.lat, pt.lng] as [number, number]);
              return (
                <Polyline
                  key={e.id}
                  positions={pts}
                  color="#dc2626"
                  weight={8}
                  opacity={1.0}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            }
            return (
              <Polyline
                key={e.id}
                positions={[
                  [amb.location.lat, amb.location.lng],
                  [hosp.location.lat, hosp.location.lng]
                ]}
                color="#dc2626"
                weight={8}
                opacity={1.0}
                lineCap="round"
                lineJoin="round"
              />
            );
          }
          return null;
        })}
        
        <MapControls 
          onRecenter={() => {
            setIsUserInteracting(false);
            setRecenterCount(c => c + 1);
          }} 
          showHeatmap={showHeatmap} 
          setShowHeatmap={setShowHeatmap}
          showLegend={showLegend}
          setShowLegend={setShowLegend}
        />
      </MapContainer>
      )}


      {/* Floating Collapsible Legend Card */}
      <AnimatePresence>
        {showLegend && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-4 left-4 z-[1000] bg-[#111827]/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#1F2937] text-[11px] space-y-2.5 w-52 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-2">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <Siren className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                Live Command Map
              </span>
              <button 
                onClick={() => setShowLegend(false)}
                className="text-slate-400 hover:text-white text-xs font-mono px-1"
              >
                ✕
              </button>
            </div>

            <button 
              type="button"
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer",
                showHeatmap 
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" 
                  : "bg-[#1F2937] text-slate-400 border-slate-700 hover:bg-slate-700"
              )}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-amber-400" /> Google Traffic Layer
              </span>
              <span className="uppercase text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#070B17] text-slate-200">
                {showHeatmap ? 'ON' : 'OFF'}
              </span>
            </button>

            <div className="space-y-1.5 text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" /> 
                <span className="font-medium">Hospital Facility</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/50" /> 
                <span className="font-medium">Active Ambulance</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" /> 
                <span className="font-medium">Traffic Signal (Normal)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" /> 
                <span className="font-medium">Preemption Corridor</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-8 h-1 bg-red-500 rounded-full animate-pulse" /> 
                <span className="font-medium">OSM Route Path</span>
              </div>
            </div>

            {showHeatmap && (
              <div className="pt-2 border-t border-[#1F2937] space-y-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Traffic Flow Density</span>
                <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-[#0f9d58] via-[#f4b400] to-[#8b0000]" />
                <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
                  <span>Free Flow</span>
                  <span>Severe Congestion</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Re-center Button when user is exploring/panning/zooming */}
      {isUserInteracting && (
        <button
          type="button"
          onClick={() => {
            setIsUserInteracting(false);
            setRecenterCount(c => c + 1);
          }}
          className="absolute bottom-5 right-5 z-[1000] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-2xl shadow-blue-900/80 border border-blue-400/40 cursor-pointer transition-all active:scale-95"
        >
          <span className="text-sm">🎯</span>
          <span>Re-center Map</span>
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'ambulance' | 'hospital' | 'traffic' | 'admin' | null>(null);
  const [isTracking, setIsTracking] = useState(false); // Controls real-time GPS vs Simulation
  const [geoError, setGeoError] = useState<string | null>(null);

  // Live Clock State
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // GPS Syncing States
  const [isSyncedWithGps, setIsSyncedWithGps] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('emergency_gps_lat') !== null;
    }
    return false;
  });
  const [syncedCoords, setSyncedCoords] = useState<{lat: number, lng: number} | null>(() => {
    if (typeof window !== 'undefined') {
      const lat = localStorage.getItem('emergency_gps_lat');
      const lng = localStorage.getItem('emergency_gps_lng');
      if (lat && lng) {
        return { lat: parseFloat(lat), lng: parseFloat(lng) };
      }
    }
    return null;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Live Geolocation & Hospital Query States
  const [liveLocation, setLiveLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    lastUpdated: string | null;
  } | null>(null);

  const [gpsPermissionStatus, setGpsPermissionStatus] = useState<
    'prompt' | 'granted' | 'denied' | 'requesting' | 'unavailable' | 'error'
  >('prompt');

  const [lastSearchCoords, setLastSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const lastSearchCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const [hospitalSearchStatus, setHospitalSearchStatus] = useState<
    'idle' | 'searching' | 'success' | 'fallback' | 'error'
  >('idle');

  const [hospitalSearchInfo, setHospitalSearchInfo] = useState<{
    count: number;
    radiusKm: number;
    message: string;
  }>({ count: 0, radiusKm: 5, message: 'Ready to query hospitals' });

  // Online / Offline state tracking
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const effectiveIsOnline = isOnline && !simulateOffline;

  // Sync window online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [trafficSignals, setTrafficSignals] = useState<TrafficSignal[]>([]);
  const [emergencyRequests, setEmergencyRequests] = useState<EmergencyRequest[]>([]);

  // Live dynamic states & timers for traffic signals (ticking countdowns & cycling red->green->yellow)
  const [signalDynamicStates, setSignalDynamicStates] = useState<Record<string, { currentState: 'red' | 'yellow' | 'green', countdownSecs: number }>>({});

  useEffect(() => {
    // Only run signal countdown ticker when user is actively in Traffic Control view
    if (role !== 'traffic') return;

    const interval = setInterval(() => {
      setSignalDynamicStates(prev => {
        const next = { ...prev };
        trafficSignals.forEach((s, idx) => {
          const initialStates: Array<'red' | 'yellow' | 'green'> = ['red', 'green', 'red', 'yellow', 'green'];
          const curr = next[s.id] || {
            currentState: s.currentState || initialStates[idx % initialStates.length],
            countdownSecs: s.countdownSecs !== undefined ? s.countdownSecs : (20 + (idx * 6) % 25)
          };

          if (s.status === 'emergency-green') {
            next[s.id] = { currentState: 'green', countdownSecs: 0 };
            return;
          }

          let newCount = curr.countdownSecs - 1;
          let newState = curr.currentState;

          if (newCount <= 0) {
            if (curr.currentState === 'red') {
              newState = 'green';
              newCount = 25;
            } else if (curr.currentState === 'green') {
              newState = 'yellow';
              newCount = 4;
            } else {
              newState = 'red';
              newCount = 35;
            }
          }

          next[s.id] = { currentState: newState, countdownSecs: newCount };
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [trafficSignals, role]);

  // Merge dynamic countdown state into signals list
  const dynamicTrafficSignals = useMemo(() => {
    return trafficSignals.map((s) => {
      const dyn = signalDynamicStates[s.id];
      return {
        ...s,
        currentState: s.status === 'emergency-green' ? 'green' : (dyn?.currentState || s.currentState || 'green'),
        countdownSecs: s.status === 'emergency-green' ? 0 : (dyn?.countdownSecs !== undefined ? dyn.countdownSecs : (s.countdownSecs || 15))
      };
    });
  }, [trafficSignals, signalDynamicStates]);
  
  const [myAmbulance, setMyAmbulance] = useState<Ambulance | null>(null);
  const [myHospital, setMyHospital] = useState<Hospital | null>(null);

  // Active Emergency tracking based on selected role
  const hasActiveEmergency = useMemo(() => {
    if (!role) return false;
    if (role === 'ambulance') {
      return emergencies.some(e => e.ambulanceId === myAmbulance?.id && e.status === 'active');
    }
    if (role === 'hospital') {
      return emergencies.some(e => e.hospitalId === myHospital?.id && e.status === 'active');
    }
    return emergencies.some(e => e.status === 'active');
  }, [role, emergencies, myAmbulance?.id, myHospital?.id]);

  const guestId = useMemo(() => {
    if (typeof window === 'undefined') return 'guest';
    let id = localStorage.getItem('emergency_guest_id');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('emergency_guest_id', id);
    }
    return id;
  }, []);

  const effectiveUid = user?.uid || guestId;

  // Synthesize an always-valid effective ambulance so mobile operator is never blocked
  const effectiveAmbulance = useMemo<Ambulance>(() => {
    if (myAmbulance) return myAmbulance;
    const fromList = ambulances.find(a => a.uid === effectiveUid);
    if (fromList) return fromList;
    const savedLat = typeof window !== 'undefined' ? localStorage.getItem('emergency_gps_lat') : null;
    const savedLng = typeof window !== 'undefined' ? localStorage.getItem('emergency_gps_lng') : null;
    const curLat = liveLocation?.lat ?? (savedLat ? parseFloat(savedLat) : 12.9716);
    const curLng = liveLocation?.lng ?? (savedLng ? parseFloat(savedLng) : 77.5946);
    const fallbackId = 'amb-' + (effectiveUid ? effectiveUid.replace(/[^a-zA-Z0-9]/g, '').slice(-8) : 'unit1');
    return {
      id: fallbackId,
      driverName: user?.isAnonymous ? 'Emergency Driver (Guest)' : (user?.displayName || 'Emergency Driver Unit 1'),
      location: { lat: curLat, lng: curLng },
      status: 'idle',
      uid: effectiveUid
    };
  }, [myAmbulance, ambulances, effectiveUid, liveLocation, user]);

  // Ensure ambulance record exists for current UID
  useEffect(() => {
    if (!effectiveUid) return;
    
    const checkAmbulance = async () => {
      try {
        const q = query(collection(db, 'ambulances'), where('uid', '==', effectiveUid));
        const snap = await getDocs(q);
        
        const savedLat = localStorage.getItem('emergency_gps_lat');
        const savedLng = localStorage.getItem('emergency_gps_lng');
        const initialLocation = savedLat && savedLng
          ? { lat: parseFloat(savedLat), lng: parseFloat(savedLng) }
          : (liveLocation ? { lat: liveLocation.lat, lng: liveLocation.lng } : { lat: 12.9716, lng: 77.5946 });

        if (snap.empty) {
          const ambData = {
            driverName: user?.isAnonymous ? 'Emergency Driver (Guest)' : (user?.displayName || 'Emergency Driver Unit 1'),
            location: initialLocation,
            status: 'idle' as const,
            uid: effectiveUid
          };
          const newDocRef = await addDoc(collection(db, 'ambulances'), ambData);
          setMyAmbulance({ id: newDocRef.id, ...ambData });
        } else {
          const docData = snap.docs[0];
          setMyAmbulance({ id: docData.id, ...docData.data() } as Ambulance);
        }
      } catch (err) {
        console.warn("checkAmbulance init note:", err);
      }
    };
    
    checkAmbulance();
  }, [effectiveUid, user, liveLocation?.lat, liveLocation?.lng]);

  // Stable refs for real-time listener closures to eliminate stale closure bugs
  const roleRef = useRef(role);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const ambulancesRef = useRef(ambulances);
  useEffect(() => {
    ambulancesRef.current = ambulances;
  }, [ambulances]);

  const hospitalsRef = useRef(hospitals);
  useEffect(() => {
    hospitalsRef.current = hospitals;
  }, [hospitals]);

  const myAmbulanceRef = useRef(myAmbulance);
  useEffect(() => {
    myAmbulanceRef.current = myAmbulance;
  }, [myAmbulance]);

  const effectiveAmbulanceRef = useRef(effectiveAmbulance);
  useEffect(() => {
    effectiveAmbulanceRef.current = effectiveAmbulance;
  }, [effectiveAmbulance]);

  const liveLocationRef = useRef(liveLocation);
  useEffect(() => {
    liveLocationRef.current = liveLocation;
  }, [liveLocation]);

  const syncedCoordsRef = useRef(syncedCoords);
  useEffect(() => {
    syncedCoordsRef.current = syncedCoords;
  }, [syncedCoords]);

  // Dynamic Hospital Query helper with movement threshold & status tracking
  const triggerHospitalRefetch = useCallback(async (lat: number, lng: number) => {
    setHospitalSearchStatus('searching');
    lastSearchCoordsRef.current = { lat, lng };
    setLastSearchCoords({ lat, lng });

    try {
      const result = await seedAroundLocation(lat, lng);
      // Immediately hydrate local state so UI updates in real-time regardless of Firestore rules or connection status
      if (result.hospitals && result.hospitals.length > 0) {
        setHospitals(result.hospitals);
      }
      if (result.signals && result.signals.length > 0) {
        setTrafficSignals(result.signals);
      }

      if (result.isFallback) {
        setHospitalSearchStatus('fallback');
        setHospitalSearchInfo({
          count: result.hospitals.length,
          radiusKm: result.radiusKm || 5,
          message: result.error || "Synchronized curated hospitals around GPS location."
        });
      } else {
        setHospitalSearchStatus('success');
        setHospitalSearchInfo({
          count: result.hospitals.length,
          radiusKm: result.radiusKm || 5,
          message: `Found ${result.hospitals.length} real hospitals within ${result.radiusKm} km via OpenStreetMap Overpass.`
        });
      }
    } catch (err) {
      console.warn("Hospital refetch failed:", err);
      setHospitalSearchStatus('error');
      setHospitalSearchInfo({
        count: 0,
        radiusKm: 5,
        message: "Failed to retrieve hospital data from OpenStreetMap."
      });
    }
  }, []);

  // Continuous GPS device position monitoring (Capacitor Native APK + Web)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setGpsPermissionStatus('requesting');

    const clearWatch = watchDevicePosition(
      async (coords) => {
        const { latitude, longitude, accuracy } = coords;
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setLiveLocation({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ? Math.round(accuracy) : null,
          lastUpdated: nowStr
        });
        setGpsPermissionStatus('granted');
        setGeoError(null);
        setSyncError(null);
        setIsSyncedWithGps(true);

        localStorage.setItem('emergency_gps_lat', latitude.toString());
        localStorage.setItem('emergency_gps_lng', longitude.toString());
        setSyncedCoords({ lat: latitude, lng: longitude });

        // Update current ambulance position in Firestore with live telemetry and timestamp
        const ambToSync = myAmbulanceRef.current || effectiveAmbulanceRef.current;
        if (ambToSync && (roleRef.current === 'ambulance' || ambToSync.status !== 'idle')) {
          updateAmbulanceStatus(
            ambToSync.id,
            ambToSync.status,
            { lat: latitude, lng: longitude },
            { speed: 58, lastUpdated: nowStr, lastSeenTimestamp: Date.now() }
          ).catch(() => {});
        }

        // Evaluate distance threshold (500 meters) before re-fetching nearby hospitals
        const last = lastSearchCoordsRef.current;
        if (!last) {
          triggerHospitalRefetch(latitude, longitude);
        } else {
          const distMeters = calculateDistanceKm(last.lat, last.lng, latitude, longitude) * 1000;
          if (distMeters >= 500) {
            console.log(`Moved ${Math.round(distMeters)}m (>= 500m threshold). Re-querying nearby hospitals.`);
            triggerHospitalRefetch(latitude, longitude);
          }
        }
      },
      (error: any) => {
        console.warn("Continuous GPS watchPosition note:", error);
        let status: 'denied' | 'unavailable' | 'error' = 'error';
        let msg = "Failed to retrieve real location.";
        if (error?.code === 1 || String(error?.message || '').toLowerCase().includes('denied')) {
          status = 'denied';
          msg = "Location permission denied. Please allow location access in your device settings.";
        } else if (error?.code === 2) {
          status = 'unavailable';
          msg = "GPS signal unavailable. Ensure location services are enabled on device.";
        } else if (error?.code === 3) {
          status = 'error';
          msg = "GPS request timed out.";
        }
        setGpsPermissionStatus(status);
        setGeoError(msg);
        setSyncError(msg);
      }
    );

    return () => {
      clearWatch();
    };
  }, [triggerHospitalRefetch, myAmbulance?.id]);

  // Manual GPS Sync Trigger
  const handleGpsSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setGpsPermissionStatus('requesting');

    try {
      const coords = await getDeviceCurrentPosition(15000);
      const { latitude, longitude, accuracy } = coords;
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setLiveLocation({
        lat: latitude,
        lng: longitude,
        accuracy: accuracy ? Math.round(accuracy) : null,
        lastUpdated: nowStr
      });
      setGpsPermissionStatus('granted');
      localStorage.setItem('emergency_gps_lat', latitude.toString());
      localStorage.setItem('emergency_gps_lng', longitude.toString());
      
      setSyncedCoords({ lat: latitude, lng: longitude });
      setIsSyncedWithGps(true);
      setIsSyncing(false);

      await triggerHospitalRefetch(latitude, longitude);

      if (myAmbulance) {
        await updateAmbulanceStatus(myAmbulance.id, myAmbulance.status, { lat: latitude, lng: longitude });
      }
      
      if (role === 'ambulance') {
        setIsTracking(true);
      }
    } catch (error: any) {
      console.warn("GPS Synchronization error:", error);
      let status: 'denied' | 'unavailable' | 'error' = 'error';
      let msg = "Failed to retrieve real location.";
      if (error?.code === 1 || String(error?.message || '').toLowerCase().includes('denied')) {
        status = 'denied';
        msg = "Location permission denied. Please allow location access in device settings.";
      } else if (error?.code === 2) {
        status = 'unavailable';
        msg = "GPS signal unavailable. Ensure location services are enabled.";
      } else if (error?.code === 3) {
        status = 'error';
        msg = "GPS request timed out. Please try again.";
      }
      setGpsPermissionStatus(status);
      setSyncError(msg);
      setGeoError(msg);
      setIsSyncing(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSyncing(true);
    localStorage.removeItem('emergency_gps_lat');
    localStorage.removeItem('emergency_gps_lng');
    setSyncedCoords(null);
    setIsSyncedWithGps(false);
    setSyncError(null);
    setIsTracking(false);

    // Reseed default curated components around Central Bangalore (12.9716, 77.5946)
    const res = await seedAroundLocation(12.9716, 77.5946);
    if (res.hospitals && res.hospitals.length > 0) {
      setHospitals(res.hospitals);
    }
    if (res.signals && res.signals.length > 0) {
      setTrafficSignals(res.signals);
    }

    // Reset my ambulance location to Bengaluru default
    if (myAmbulance) {
      await updateAmbulanceStatus(myAmbulance.id, myAmbulance.status, { lat: 12.9716, lng: 77.5946 });
    }
    
    setIsSyncing(false);
  };

  // Auth & Seeding
  useEffect(() => {
    let authTimeout: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      clearTimeout(authTimeout);
      
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn("Firebase Anonymous Auth restricted. Operating in local guest mode.", e);
          setLoading(false);
        }
        return;
      }
      
      setUser(u);
      ensureUserProfile(u, 'public').catch((err) => {
        console.warn("Failed to sync user profile in Firestore:", err);
      });
      setLoading(false);
    });

    const initData = async () => {
      try {
        const savedLat = localStorage.getItem('emergency_gps_lat');
        const savedLng = localStorage.getItem('emergency_gps_lng');
        const initialLat = savedLat ? parseFloat(savedLat) : 12.9716;
        const initialLng = savedLng ? parseFloat(savedLng) : 77.5946;

        const res = await seedAroundLocation(initialLat, initialLng);
        if (res.hospitals && res.hospitals.length > 0) {
          setHospitals(res.hospitals);
        }
        if (res.signals && res.signals.length > 0) {
          setTrafficSignals(res.signals);
        }
      } catch (e) {
        console.error("Data seeding failed.", e);
      }
    };
    initData();

    authTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth timeout reached. Starting in guest mode.");
        setLoading(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(authTimeout);
    };
  }, []);

  // Floating In-App Green Corridor Heads-up Banner State
  const [activeCorridorBanner, setActiveCorridorBanner] = useState<{
    title: string;
    bodyText: string;
    ambulanceId?: string;
    targetHospitalName?: string;
    timestamp?: number;
  } | null>(null);

  // Auto-dismiss floating corridor banner after 9 seconds so it never gets stuck
  useEffect(() => {
    if (!activeCorridorBanner) return;
    const timer = setTimeout(() => {
      setActiveCorridorBanner(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [activeCorridorBanner]);

  // Traffic Police Officer Authentication State (ID & Password Only — No Fingerprint Required)
  const [policeOfficerAuth, setPoliceOfficerAuth] = useState<PoliceOfficerSession>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(TRAFFIC_AUTH_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.isLoggedIn && (parsed.officerId || parsed.username)) {
            return {
              isLoggedIn: true,
              accountId: parsed.accountId || String(parsed.officerId || parsed.username).toLowerCase(),
              officerId: parsed.officerId || parsed.username,
              username: parsed.username || parsed.officerId,
              fullName: parsed.fullName || parsed.username || 'Traffic Officer',
              badgeNumber: parsed.badgeNumber || 'TP-UNIT',
              assignedZone: parsed.assignedZone || 'Emergency Corridor',
              sessionVersion: typeof parsed.sessionVersion === 'number' ? parsed.sessionVersion : 1,
              loginTime: parsed.loginTime
            };
          }
        } catch (e) {
          console.warn("Failed to parse saved police auth:", e);
        }
      }
    }
    return {
      isLoggedIn: false,
      accountId: '',
      officerId: '',
      username: '',
      fullName: '',
      badgeNumber: '',
      assignedZone: '',
      sessionVersion: 1
    };
  });

  const policeOfficerAuthRef = useRef(policeOfficerAuth);
  useEffect(() => {
    policeOfficerAuthRef.current = policeOfficerAuth;
  }, [policeOfficerAuth]);

  const [trafficOfficers, setTrafficOfficers] = useState<TrafficOfficerAccount[]>([]);
  const [globalBroadcast, setGlobalBroadcast] = useState<SystemBroadcast | null>(null);
  const [policeSessionNotice, setPoliceSessionNotice] = useState<string | null>(null);

  const [showPoliceLoginModal, setShowPoliceLoginModal] = useState(false);
  const [policeUsernameInput, setPoliceUsernameInput] = useState('');
  const [policePasswordInput, setPolicePasswordInput] = useState('');
  const [showPolicePassword, setShowPolicePassword] = useState(false);
  const [isAuthenticatingPolice, setIsAuthenticatingPolice] = useState(false);
  const [policeLoginError, setPoliceLoginError] = useState<string | null>(null);

  // Admin Authentication State & Handlers (Temp Admin Login)
  const [adminAuth, setAdminAuth] = useState<AdminSession>(() => getStoredAdminSession());
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminUserInput, setAdminUserInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [isAuthenticatingAdmin, setIsAuthenticatingAdmin] = useState(false);

  const handleAdminLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsAuthenticatingAdmin(true);
    setAdminLoginError(null);
    try {
      const res = authenticateAdmin(adminUserInput, adminPassInput);
      if (!res.success || !res.session) {
        setAdminLoginError(res.error || 'Failed to authenticate Admin.');
        setIsAuthenticatingAdmin(false);
        return;
      }
      setAdminAuth(res.session);
      setShowAdminLoginModal(false);
      setRole('admin');
      setAdminUserInput('');
      setAdminPassInput('');
    } catch (err: any) {
      setAdminLoginError(err?.message || 'Admin authentication error.');
    } finally {
      setIsAuthenticatingAdmin(false);
    }
  };

  const handleQuickAdminLogin = () => {
    setAdminUserInput('admin');
    setAdminPassInput('admin123');
    setIsAuthenticatingAdmin(true);
    setAdminLoginError(null);
    setTimeout(() => {
      const res = authenticateAdmin('admin', 'admin123');
      if (res.success && res.session) {
        setAdminAuth(res.session);
        setShowAdminLoginModal(false);
        setRole('admin');
      }
      setIsAuthenticatingAdmin(false);
    }, 120);
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    setAdminAuth({
      isLoggedIn: false,
      username: '',
      fullName: '',
      role: 'admin'
    });
    if (role === 'admin') {
      setRole(null);
    }
  };

  // Subscribe to Admin-managed Traffic Police directory & System Broadcasts (resilient across APK & Web)
  useEffect(() => {
    seedDefaultTrafficOfficerIfNeeded().catch(() => {});
    const unsubOfficers = subscribeTrafficOfficers((list) => {
      setTrafficOfficers(list);
    });
    const unsubBroadcast = subscribeGlobalBroadcast((b) => {
      setGlobalBroadcast(b);
    });
    return () => {
      unsubOfficers();
      unsubBroadcast();
    };
  }, []);

  // Real-time Admin Enforcement: If Admin suspends, deletes, resets password, or forces sign-out, revoke active session immediately
  useEffect(() => {
    if (!policeOfficerAuth.isLoggedIn || trafficOfficers.length === 0) return;

    const match = trafficOfficers.find(
      (o) =>
        o.id === policeOfficerAuth.accountId ||
        o.officerIdLower === (policeOfficerAuth.officerId || policeOfficerAuth.username).toLowerCase()
    );

    const isRevoked =
      !match ||
      !match.active ||
      (match.sessionVersion || 1) > (policeOfficerAuth.sessionVersion || 1);

    if (isRevoked) {
      const reason = !match
        ? 'Your Traffic Police Officer ID was removed by Administrator.'
        : !match.active
          ? 'Your Traffic Police Officer ID was suspended by Administrator.'
          : 'Your session was signed out or password was reset by Administrator. Please sign in again.';

      setPoliceOfficerAuth({
        isLoggedIn: false,
        accountId: '',
        officerId: '',
        username: '',
        fullName: '',
        badgeNumber: '',
        assignedZone: '',
        sessionVersion: 1
      });
      localStorage.removeItem(TRAFFIC_AUTH_STORAGE_KEY);
      setPoliceSessionNotice(reason);
    }
  }, [trafficOfficers, policeOfficerAuth]);

  const handlePoliceAuthenticate = async (idValue: string, passwordValue: string): Promise<boolean> => {
    if (isAuthenticatingPolice) return false;
    setIsAuthenticatingPolice(true);
    setPoliceLoginError(null);
    setPoliceSessionNotice(null);

    try {
      const result = await authenticateTrafficOfficer(idValue, passwordValue);
      if (!result.success || !result.session) {
        setPoliceLoginError(result.error || "Invalid Officer ID or Password.");
        return false;
      }

      setPoliceOfficerAuth(result.session);
      localStorage.setItem(TRAFFIC_AUTH_STORAGE_KEY, JSON.stringify(result.session));
      setShowPoliceLoginModal(false);
      setPolicePasswordInput('');
      setPoliceLoginError(null);

      // Initialize notification channels & permissions immediately on officer sign-in
      initNotificationChannels().catch(() => {});
      if (user) {
        const signalIds = trafficSignals.map(s => s.id);
        requestTrafficNotificationPermission(user, signalIds).catch(() => {});
      }
      return true;
    } catch (err: any) {
      setPoliceLoginError(err?.message || "Authentication failed. Please check your Officer ID & Password.");
      return false;
    } finally {
      setIsAuthenticatingPolice(false);
    }
  };

  const handlePoliceLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await handlePoliceAuthenticate(policeUsernameInput, policePasswordInput);
  };

  const handlePoliceLogout = () => {
    const accountId = policeOfficerAuth.accountId;
    const emptyAuth: PoliceOfficerSession = {
      isLoggedIn: false,
      accountId: '',
      officerId: '',
      username: '',
      fullName: '',
      badgeNumber: '',
      assignedZone: '',
      sessionVersion: 1
    };
    // 1. Clear officer session in state and localStorage immediately
    setPoliceOfficerAuth(emptyAuth);
    localStorage.removeItem(TRAFFIC_AUTH_STORAGE_KEY);
    
    // 2. Clean up login modals, errors, session notices and dismiss any corridor alert banner
    setPoliceLoginError(null);
    setPoliceSessionNotice(null);
    setShowPoliceLoginModal(false);
    setActiveCorridorBanner(null);

    // 3. Prevent biometric launch lock from incorrectly triggering upon voluntary officer logout
    setIsBiometricUnlocked(true);

    // 4. Return to role overview cleanly if currently inside traffic control
    if (role === 'traffic') {
      setRole(null);
    }

    // 5. Cancel any vibration pattern
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }

    // 6. Asynchronously mark officer offline in Firestore without blocking UI
    if (accountId) {
      markTrafficOfficerOffline(accountId).catch(() => {});
    }
  };

  // Biometric Authentication State & Handlers
  const [biometricEnabled, setBiometricEnabledState] = useState<boolean>(() => isBiometricEnabled());
  const [biometricStatus, setBiometricStatus] = useState<any>(null);
  const [isBiometricUnlocked, setIsBiometricUnlocked] = useState<boolean>(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState<boolean>(false);
  const [biometricAuthError, setBiometricAuthError] = useState<string | null>(null);
  const [biometricAuthErrorCode, setBiometricAuthErrorCode] = useState<BiometryErrorType | null>(null);
  const [showBiometricSettingsModal, setShowBiometricSettingsModal] = useState<boolean>(false);
  const [biometricToast, setBiometricToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active authenticated session presence for Biometric Lock:
  // Strictly applies to non-anonymous Firebase accounts when NOT operating a Traffic Police ID/Pass terminal.
  // Traffic Police Officers authenticate strictly via ID & Password (NO fingerprint required).
  const hasAuthenticatedSession = Boolean(user && !user.isAnonymous && !policeOfficerAuth.isLoggedIn && role !== 'traffic');

  // The Biometric Gate is active whenever biometric authentication is enabled,
  // an authenticated non-police session is present, and biometric unlock has not yet been verified for this launch.
  const isBiometricGateActive = biometricEnabled && hasAuthenticatedSession && !isBiometricUnlocked;

  // Real-time resume listener to recheck biometric availability when user resumes from Android Settings
  useEffect(() => {
    const cleanup = addBiometricResumeListener((info) => {
      setBiometricStatus(info);
    });
    return () => cleanup();
  }, []);

  // Handler for Biometric Verification with Native BiometricPrompt and Device Credential Fallback
  const handleBiometricUnlock = useCallback(async () => {
    if (isBiometricAuthenticating) return;
    setIsBiometricAuthenticating(true);
    setBiometricAuthError(null);
    setBiometricAuthErrorCode(null);

    try {
      const res = await authenticateBiometric("Scan your fingerprint or enter device PIN/Pattern to unlock Smart Emergency Command");
      if (res.success) {
        setIsBiometricUnlocked(true);
        setBiometricAuthError(null);
        setBiometricAuthErrorCode(null);
      } else {
        setBiometricAuthError(res.error || "Authentication failed. Please retry.");
        setBiometricAuthErrorCode(res.code || null);
      }
    } catch (err: any) {
      setBiometricAuthError(err.message || "An unexpected error occurred during biometric scan.");
    } finally {
      setIsBiometricAuthenticating(false);
    }
  }, [isBiometricAuthenticating]);

  // Auto-prompt on launch when biometric gate is active
  const hasAutoPromptedRef = useRef(false);
  useEffect(() => {
    if (isBiometricGateActive && !hasAutoPromptedRef.current && !isBiometricAuthenticating) {
      hasAutoPromptedRef.current = true;
      const timer = setTimeout(() => {
        handleBiometricUnlock();
      }, 350);
      return () => clearTimeout(timer);
    }
    if (!isBiometricGateActive) {
      hasAutoPromptedRef.current = false;
    }
  }, [isBiometricGateActive, handleBiometricUnlock, isBiometricAuthenticating]);

  // Fallback sign out handler if user cancels or wants to use credentials / switch user
  const handleBiometricFallbackSignOut = async () => {
    setIsBiometricUnlocked(false);
    setBiometricAuthError(null);
    setBiometricAuthErrorCode(null);

    if (policeOfficerAuth.isLoggedIn) {
      handlePoliceLogout();
    }
    if (user && !user.isAnonymous) {
      setIsBiometricUnlocked(false);
      await signOutCrossPlatform();
    }
  };

  // Toggle biometric setting in settings modal
  const handleToggleBiometricSetting = async () => {
    if (biometricEnabled) {
      setBiometricEnabled(false);
      setBiometricEnabledState(false);
      setBiometricToast({ type: 'success', message: 'Biometric launch lock disabled.' });
      setTimeout(() => setBiometricToast(null), 4000);
    } else {
      setIsBiometricAuthenticating(true);
      try {
        const res = await authenticateBiometric("Verify your fingerprint or device PIN to enable biometric authentication");
        if (res.success) {
          setBiometricEnabled(true);
          setBiometricEnabledState(true);
          setIsBiometricUnlocked(true);
          setBiometricToast({ type: 'success', message: 'Biometric fingerprint lock successfully activated!' });
          setTimeout(() => setBiometricToast(null), 4000);
        } else {
          setBiometricToast({ type: 'error', message: res.error || 'Verification failed. Biometric lock was not enabled.' });
          setTimeout(() => setBiometricToast(null), 5000);
        }
      } catch (err: any) {
        setBiometricToast({ type: 'error', message: err.message || 'Verification error.' });
        setTimeout(() => setBiometricToast(null), 5000);
      } finally {
        setIsBiometricAuthenticating(false);
      }
    }
  };

  useEffect(() => {
    const handleCorridorAlert = (e: any) => {
      // Guard: Only display in-app banner if an officer is actively logged in on this device
      if (!policeOfficerAuthRef.current?.isLoggedIn) return;
      const detail = e.detail;
      if (detail) {
        setActiveCorridorBanner({
          title: detail.title || '🚨 EMERGENCY GREEN CORRIDOR ACTIVATED',
          bodyText: detail.bodyText || 'Ambulance approaching! Clearing green corridor.',
          ambulanceId: detail.ambulanceId,
          targetHospitalName: detail.targetHospitalName,
          timestamp: detail.timestamp || Date.now()
        });
      }
    };
    window.addEventListener('emergency-corridor-alert', handleCorridorAlert);
    return () => window.removeEventListener('emergency-corridor-alert', handleCorridorAlert);
  }, []);

  // Request notifications permission immediately ONLY when police officer is logged in
  useEffect(() => {
    if (policeOfficerAuth.isLoggedIn) {
      initNotificationChannels().catch(() => {});
    }
  }, [policeOfficerAuth.isLoggedIn]);

  // Proactive Cross-Device Emergency Corridor Alert for 2-Device APK Synchronization
  // Fires strictly ONLY on devices where a Traffic Police Officer is logged in
  const alertedCorridorKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // STRICT GATE: Corridor alerts and sirens MUST ONLY trigger on logged-in officer devices
    if (!policeOfficerAuth.isLoggedIn) return;

    // 1. Check active emergency requests from Firestore (100% public real-time collection)
    const activeReqs = emergencyRequests.filter(r => ['bed_reserved', 'pending', 'active'].includes(r.status));
    for (const req of activeReqs) {
      if (role === 'ambulance') continue;
      if (myAmbulance && req.ambulanceId === myAmbulance.id) continue;

      const alertKey = `request_${req.id || (req as any).requestId}`;
      if (!alertedCorridorKeysRef.current.has(alertKey)) {
        alertedCorridorKeysRef.current.add(alertKey);
        const hosp = hospitals.find(h => h.id === req.hospitalId);

        triggerTrafficCorridorAlert({
          signalName: 'Active Green Corridor Junction',
          distanceKm: req.distanceKm || 0.5,
          etaMins: req.etaMins || 2,
          ambulanceId: req.ambulanceId || 'AMB-UNIT-01',
          ambulanceDriverName: req.ambulanceDriverName || 'Ambulance Driver',
          ambulanceLocation: req.ambulanceLocation,
          speed: (req as any).speed || 58,
          targetHospitalName: req.hospitalName || hosp?.name || 'Emergency Hospital'
        }).catch(err => console.warn("Proactive request corridor alert error:", err));
      }
    }

    // 2. Check traffic signals that have been preempted to emergency-green in Firestore (100% public)
    // ALERT ONLY ONCE for the entire green corridor, never 8 times in a row!
    const preemptedSignals = trafficSignals.filter(s => s.status === 'emergency-green');
    if (preemptedSignals.length > 0) {
      const sig = preemptedSignals[0];
      const alertKey = `signal_${sig.activeAmbulanceId || 'active_corridor'}`;
      if (!alertedCorridorKeysRef.current.has(alertKey)) {
        alertedCorridorKeysRef.current.add(alertKey);
        const amb = ambulances.find(a => a.id === sig.activeAmbulanceId);
        triggerTrafficCorridorAlert({
          signalName: sig.name || sig.roadName || 'Traffic Junction Signal',
          distanceKm: 0.45,
          etaMins: 2,
          ambulanceId: sig.activeAmbulanceId || 'AMB-UNIT-01',
          ambulanceDriverName: (sig as any).activeAmbulanceDriverName || amb?.driverName || 'Ambulance Driver',
          ambulanceLocation: (sig as any).activeAmbulanceLocation || amb?.location,
          speed: (sig as any).activeAmbulanceSpeed || amb?.speed || 58,
          targetHospitalName: (sig as any).targetHospitalName || amb?.targetHospitalName || 'Emergency Hospital'
        }).catch(err => console.warn("Proactive signal corridor alert error:", err));
      }
    }
  }, [role, emergencyRequests, trafficSignals, hospitals, myAmbulance, policeOfficerAuth.isLoggedIn]);

  // Real-time listeners
  useEffect(() => {
    const unsubHospitals = onSnapshot(
      collection(db, 'hospitals'), 
      (snap) => {
        const curLat = liveLocationRef.current?.lat ?? syncedCoordsRef.current?.lat ?? 12.9716;
        const curLng = liveLocationRef.current?.lng ?? syncedCoordsRef.current?.lng ?? 77.5946;

        const allFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() } as Hospital));
        const seen = new Set<string>();
        const dedupedNearby: Hospital[] = [];

        for (const h of allFromDb) {
          if (!h.location || typeof h.location.lat !== 'number' || typeof h.location.lng !== 'number') continue;
          const key = (h.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          if (!key || seen.has(key)) continue;

          // Deduplicate if another hospital is already within 250 meters
          const isNearbyDup = dedupedNearby.some(existing => 
            calculateDistanceKm(existing.location.lat, existing.location.lng, h.location.lat, h.location.lng) < 0.25
          );
          if (isNearbyDup) continue;

          seen.add(key);

          // Calculate distance from current live location
          const distKm = calculateDistanceKm(curLat, curLng, h.location.lat, h.location.lng);
          // STRICT PROXIMITY: Only accept genuine nearby medical facilities (<= 8.5 km)! Never 25-30 km
          if (distKm <= 8.5) {
            dedupedNearby.push(h);
          }
        }

        // Always sort by closest distance first
        dedupedNearby.sort((a, b) => {
          const dA = calculateDistanceKm(curLat, curLng, a.location.lat, a.location.lng);
          const dB = calculateDistanceKm(curLat, curLng, b.location.lat, b.location.lng);
          return dA - dB;
        });

        // If nearby hospitals found in DB, use them; otherwise immediately reseed tightly around current location
        if (dedupedNearby.length >= 2) {
          setHospitals(dedupedNearby);
        } else {
          seedAroundLocation(curLat, curLng).then(res => {
            if (res.hospitals && res.hospitals.length > 0) {
              setHospitals(res.hospitals);
            }
          }).catch(() => {});
        }
      },
      (err) => console.warn("Hospitals listener warning:", err.message)
    );

    const unsubAmbulances = onSnapshot(
      collection(db, 'ambulances'), 
      (snap) => {
        const ambs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ambulance));
        setAmbulances(ambs);
        const mine = ambs.find(a => a.uid === effectiveUid);
        if (mine) setMyAmbulance(mine);
      },
      (err) => console.warn("Ambulances listener warning (using fallback synthesis if restricted):", err.message)
    );

    const unsubEmergencies = onSnapshot(
      collection(db, 'emergencies'), 
      (snap) => {
        const activeList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Emergency));
        setEmergencies(activeList);

        // Instant cross-device trigger: If a laptop or another phone dispatches an emergency,
        // notify traffic control and hospital with exact real-time telemetry (without spamming ambulance driver)
        snap.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const em = { id: change.doc.id, ...change.doc.data() } as Emergency;
            if (em.status === 'active') {
              const currentRole = roleRef.current;
              const currentMyAmb = myAmbulanceRef.current;
              const isOfficer = Boolean(policeOfficerAuthRef.current?.isLoggedIn);
              if (em.ambulanceId !== currentMyAmb?.id && isOfficer) {
                const amb = ambulancesRef.current.find(a => a.id === em.ambulanceId);
                const hosp = hospitalsRef.current.find(h => h.id === em.hospitalId);
                const pingTs = amb?.lastSeenTimestamp || 0;
                const isStale = pingTs > 0 && (Date.now() - pingTs > 25000);
                triggerTrafficCorridorAlert({
                  signalName: 'Active Green Corridor Junction',
                  distanceKm: em.distanceKm || 0.5,
                  etaMins: em.etaMins || 2,
                  ambulanceId: amb?.id || em.ambulanceId,
                  ambulanceDriverName: amb?.driverName || 'Ambulance Driver',
                  ambulanceLocation: amb?.location,
                  speed: amb?.speed || 58,
                  targetHospitalName: hosp?.name || 'Emergency Hospital',
                  lastUpdated: amb?.lastUpdated || new Date().toLocaleTimeString(),
                  lastSeenTimestamp: amb?.lastSeenTimestamp,
                  isFallback: isStale
                }).catch((e) => console.warn("Cross-device alert error:", e));
              }
            }
          }
        });
      },
      (err) => console.warn("Emergencies listener warning:", err.message)
    );

    const unsubSignals = onSnapshot(
      collection(db, 'trafficSignals'), 
      (snap) => {
        const sigs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrafficSignal));
        setTrafficSignals(sigs);

        // If any traffic signal turns emergency-green, alert traffic police with the EXACT ambulance location!
        snap.docChanges().forEach((change) => {
          if (change.type === 'modified' || change.type === 'added') {
            const sig = { id: change.doc.id, ...change.doc.data() } as TrafficSignal & {
              activeAmbulanceDriverName?: string;
              activeAmbulanceLocation?: { lat: number; lng: number };
              activeAmbulanceSpeed?: number;
              targetHospitalName?: string;
            };
            const isOfficer = Boolean(policeOfficerAuthRef.current?.isLoggedIn);
            if (isOfficer && sig.status === 'emergency-green') {
              const amb = ambulancesRef.current.find(a => a.id === sig.activeAmbulanceId) || 
                          ambulancesRef.current.find(a => a.status === 'responding');
              const hospName = sig.targetHospitalName || amb?.targetHospitalName || 'Emergency Hospital';
              const ambLoc = sig.activeAmbulanceLocation || amb?.location || { lat: 12.9716, lng: 77.5946 };
              const distKm = parseFloat(calculateDistance(ambLoc.lat, ambLoc.lng, sig.location.lat, sig.location.lng));
              const pingTs = amb?.lastSeenTimestamp || 0;
              const isStale = pingTs > 0 && (Date.now() - pingTs > 25000);
              triggerTrafficCorridorAlert({
                signalName: sig.name || sig.roadName || 'Junction Signal',
                distanceKm: distKm,
                etaMins: Math.max(1, Math.round((distKm / 40) * 60)),
                ambulanceId: sig.activeAmbulanceId || amb?.id || 'AMB-01',
                ambulanceDriverName: sig.activeAmbulanceDriverName || amb?.driverName || 'Emergency Driver',
                ambulanceLocation: ambLoc,
                speed: sig.activeAmbulanceSpeed || amb?.speed || 58,
                targetHospitalName: hospName,
                lastUpdated: amb?.lastUpdated || new Date().toLocaleTimeString(),
                lastSeenTimestamp: amb?.lastSeenTimestamp,
                isFallback: isStale
              }).catch((e) => console.warn("Signal preemption alert error:", e));
            }
          }
        });
      },
      (err) => console.warn("TrafficSignals listener warning:", err.message)
    );

    const knownRequestIdsRef = new Set<string>();
    let isInitialRequestsLoad = true;

    // emergencyRequests is 100% PUBLIC READ in Firestore rules, ensuring real-time cross-device sync!
    const unsubRequests = subscribeEmergencyRequests((reqs) => {
      setEmergencyRequests(reqs);

      // Synthesize active emergency and responding ambulance for unauthenticated APK users if emergencies is empty
      const activeReq = reqs.find(r => ['bed_reserved', 'pending', 'active'].includes(r.status));
      if (activeReq) {
        const targetHosp = hospitalsRef.current.find(h => h.id === activeReq.hospitalId);
        const targetLoc = targetHosp?.location || activeReq.ambulanceLocation;

        setEmergencies(prev => {
          const exists = prev.some(e => e.id === activeReq.id || e.hospitalId === activeReq.hospitalId);
          if (exists) return prev;
          return [...prev, {
            id: activeReq.id,
            ambulanceId: activeReq.ambulanceId,
            hospitalId: activeReq.hospitalId,
            emergencyType: activeReq.emergencyType,
            status: 'active',
            etaMins: activeReq.etaMins || 5,
            distanceKm: activeReq.distanceKm || 2,
            routeCoords: [
              activeReq.ambulanceLocation,
              targetLoc
            ]
          }];
        });

        // Fetch real street-following driving route for the synthesized emergency
        fetchRealRoute(activeReq.ambulanceLocation.lat, activeReq.ambulanceLocation.lng, targetLoc.lat, targetLoc.lng)
          .then(routeRes => {
            if (routeRes && routeRes.coordinates.length > 0) {
              setEmergencies(prev => prev.map(e => (e.id === activeReq.id || e.hospitalId === activeReq.hospitalId) ? {
                ...e,
                routeCoords: routeRes.coordinates.map(c => ({ lat: c[0], lng: c[1] }))
              } : e));
            }
          })
          .catch(() => {});

        setAmbulances(prev => {
          const found = prev.find(a => a.id === activeReq.ambulanceId);
          if (found) {
            return prev.map(a => a.id === activeReq.ambulanceId ? {
              ...a,
              status: 'responding',
              location: activeReq.ambulanceLocation || a.location,
              targetHospitalName: activeReq.hospitalName,
              targetHospitalId: activeReq.hospitalId,
              speed: (activeReq as any).speed || 58
            } : a);
          }
          return [...prev, {
            id: activeReq.ambulanceId,
            driverName: activeReq.ambulanceDriverName || 'Emergency Driver',
            location: activeReq.ambulanceLocation,
            status: 'responding',
            uid: 'remote-amb',
            speed: (activeReq as any).speed || 58,
            targetHospitalName: activeReq.hospitalName,
            targetHospitalId: activeReq.hospitalId
          }];
        });

        // Trigger Traffic Corridor alert if an emergency request arrives and police is logged in or role is traffic
        if (activeReq) {
          const currentRole = roleRef.current;
          const currentMyAmb = myAmbulanceRef.current;
          const isOfficer = Boolean(policeOfficerAuthRef.current?.isLoggedIn);
          if (activeReq.ambulanceId !== currentMyAmb?.id && isOfficer) {
            const hospName = activeReq.hospitalName || hospitalsRef.current.find(h => h.id === activeReq.hospitalId)?.name || 'Emergency Hospital';
            triggerTrafficCorridorAlert({
              signalName: 'Active Green Corridor Junction',
              distanceKm: activeReq.distanceKm || 0.5,
              etaMins: activeReq.etaMins || 2,
              ambulanceId: activeReq.ambulanceId || 'AMB-01',
              ambulanceDriverName: activeReq.ambulanceDriverName || 'Emergency Driver',
              ambulanceLocation: activeReq.ambulanceLocation,
              speed: (activeReq as any).speed || 58,
              targetHospitalName: hospName
            }).catch((e) => console.warn("Emergency request corridor alert error:", e));
          }
        }
      }
    });

    return () => {
      unsubHospitals();
      unsubAmbulances();
      unsubEmergencies();
      unsubSignals();
      unsubRequests();
    };
  }, [effectiveUid]);

  // Real-time Geolocation tracking for ambulance role
  const lastGeoPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    const amb = myAmbulance || effectiveAmbulance;
    if (role !== 'ambulance' || !amb || !isTracking) {
      if (!isTracking) {
        setGeoError(null);
      }
      return;
    }

    if ('geolocation' in navigator) {
      console.log("Starting real-time geolocation tracking for ambulance:", amb.id);
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, speed } = position.coords;
          console.log("New physical geolocation coords received:", latitude, longitude);
          setGeoError(null);

          // Calculate real speed (km/h) from GPS or consecutive coordinates
          let computedSpeed = 0;
          const now = Date.now();
          if (speed !== null && speed !== undefined && !isNaN(speed) && speed > 0) {
            computedSpeed = Math.round(speed * 3.6); // m/s to km/h
          } else if (lastGeoPosRef.current) {
            const dtHours = (now - lastGeoPosRef.current.time) / 3600000;
            if (dtHours > 0) {
              const distKm = calculateDistanceKm(
                lastGeoPosRef.current.lat,
                lastGeoPosRef.current.lng,
                latitude,
                longitude
              );
              computedSpeed = Math.min(130, Math.round(distKm / dtHours));
            }
          }
          lastGeoPosRef.current = { lat: latitude, lng: longitude, time: now };

          // If responding or transporting, ensure emergency green corridor ahead
          const activeE = emergencies.find(e => e.ambulanceId === amb.id && (e.status === 'active' || e.status === 'pending'));
          if (activeE) {
            trafficSignals.forEach(sig => {
              const dist = calculateDistanceKm(latitude, longitude, sig.location.lat, sig.location.lng);
              if (dist <= 1.2 && sig.status !== 'emergency-green') {
                updateSignalStatus(sig.id, 'emergency-green', amb.id).catch(() => {});
              }
            });
          }

          await updateAmbulanceStatus(
            amb.id, 
            amb.status, 
            { lat: latitude, lng: longitude },
            { speed: computedSpeed }
          );
        },
        (error) => {
          console.warn("Real-time geolocation tracking error:", error);
          let userFriendlyMessage = "GPS tracking unavailable.";
          if (error.code === 1) {
            userFriendlyMessage = "Location access denied. Click 'Open in New Tab' to grant GPS permissions outside the frame.";
          } else if (error.code === 2) {
            userFriendlyMessage = "GPS position unavailable. Ensure device location services are enabled.";
          } else if (error.code === 3) {
            userFriendlyMessage = "GPS tracking request timed out.";
          }
          setGeoError(userFriendlyMessage);
          setIsTracking(false);
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setGeoError("Geolocation is not supported by your browser.");
      setIsTracking(false);
    }
  }, [role, myAmbulance?.id, myAmbulance?.status, effectiveAmbulance?.id, effectiveAmbulance?.status, isTracking, emergencies, trafficSignals]);

  // Simulated movement for ambulance (smooth route-following fallback when isTracking is false)
  useEffect(() => {
    // ONLY simulate movement if user is actively in Ambulance role, not tracking physical GPS, and ambulance is active
    const amb = myAmbulance || effectiveAmbulance;
    if (isTracking || role !== 'ambulance' || !amb || amb.status === 'idle') return;

    const interval = setInterval(async () => {
      const currentAmb = myAmbulance || effectiveAmbulance;
      if (!currentAmb) return;
      const emergency = emergencies.find(e => e.ambulanceId === currentAmb.id && (e.status === 'pending' || e.status === 'active'));
      if (!emergency) return;

      const hosp = hospitals.find(h => h.id === emergency.hospitalId);
      if (!hosp) return;

      let nextLat = currentAmb.location.lat;
      let nextLng = currentAmb.location.lng;
      let currentSpeed = 58;

      // Follow calculated route coordinates if available
      if (emergency.routeCoords && emergency.routeCoords.length > 1) {
        const route = emergency.routeCoords;
        let closestIdx = 0;
        let minD = Infinity;
        for (let i = 0; i < route.length; i++) {
          const d = Math.hypot(route[i].lat - currentAmb.location.lat, route[i].lng - currentAmb.location.lng);
          if (d < minD) {
            minD = d;
            closestIdx = i;
          }
        }
        const targetIdx = Math.min(route.length - 1, closestIdx + 2);
        const targetPt = route[targetIdx];
        const dLat = targetPt.lat - currentAmb.location.lat;
        const dLng = targetPt.lng - currentAmb.location.lng;
        const dist = Math.hypot(dLat, dLng);

        if (dist < 0.0004 && targetIdx >= route.length - 1) {
          // Arrived at destination hospital
          nextLat = hosp.location.lat;
          nextLng = hosp.location.lng;
          currentSpeed = 0;
          await updateAmbulanceStatus(currentAmb.id, 'transporting', { lat: nextLat, lng: nextLng }, { speed: 0 });
          return;
        }

        const step = 0.0006;
        nextLat = currentAmb.location.lat + (dist > 0 ? (dLat / dist) * Math.min(step, dist) : 0);
        nextLng = currentAmb.location.lng + (dist > 0 ? (dLng / dist) * Math.min(step, dist) : 0);
        currentSpeed = Math.floor(48 + Math.random() * 16);
      } else {
        const step = 0.0005;
        const dLat = hosp.location.lat - currentAmb.location.lat;
        const dLng = hosp.location.lng - currentAmb.location.lng;
        const dist = Math.hypot(dLat, dLng);

        if (dist < 0.0008) {
          nextLat = hosp.location.lat;
          nextLng = hosp.location.lng;
          currentSpeed = 0;
          await updateAmbulanceStatus(currentAmb.id, 'transporting', hosp.location, { speed: 0 });
          return;
        }
        nextLat = currentAmb.location.lat + (dLat / dist) * step;
        nextLng = currentAmb.location.lng + (dLng / dist) * step;
        currentSpeed = Math.floor(45 + Math.random() * 15);
      }

      await updateAmbulanceStatus(
        currentAmb.id, 
        currentAmb.status, 
        { lat: nextLat, lng: nextLng },
        { speed: currentSpeed, targetHospitalId: hosp.id, targetHospitalName: hosp.name }
      );
    }, 2500);

    return () => clearInterval(interval);
  }, [role, myAmbulance?.id, myAmbulance?.status, effectiveAmbulance?.id, effectiveAmbulance?.status, isTracking, emergencies, hospitals]);

  const [isSigningIn, setIsSigningIn] = useState(false);

  const login = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogleCrossPlatform();
    } catch (err: any) {
      console.warn("Sign-in notice:", err);
      // If native Google account canceled or not configured, allow guest mode or notify user
      alert("Sign-in notice: " + (err?.message || "Could not complete sign in. Operating in guest dispatcher mode."));
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    setIsBiometricUnlocked(false);
    await signOutCrossPlatform();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B17] flex flex-col items-center justify-center space-y-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-14 h-14 border-4 border-red-500 border-t-transparent rounded-full shadow-2xl shadow-red-500/50"
        />
        <p className="text-slate-400 font-mono text-xs uppercase tracking-widest animate-pulse">Initializing Command Center...</p>
      </div>
    );
  }

  // Biometric Authentication Gate:
  // Rendered immediately if an authenticated session exists and biometric launch lock is enabled,
  // before ANY protected routes, dashboards, hospital beds, or telematics can mount.
  if (isBiometricGateActive) {
    const isLockout = biometricAuthErrorCode === BiometryErrorType.biometryLockout;
    const isNotEnrolled = biometricAuthErrorCode === BiometryErrorType.biometryNotEnrolled;
    const isCancelled = biometricAuthErrorCode === BiometryErrorType.userCancel || biometricAuthErrorCode === BiometryErrorType.systemCancel;

    return (
      <div className="min-h-screen bg-[#070B17] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-red-500/30 selection:text-white relative overflow-hidden">
        {/* Ambient atmospheric glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-[#111827]/95 border border-[#1F2937] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl relative z-10 flex flex-col items-center text-center space-y-6"
        >
          {/* Header Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Siren className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              SmartResponse <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-mono uppercase">Secure Gateway</span>
            </span>
          </div>

          {/* Biometric Scanner Visual Graphic */}
          <div className="relative my-2">
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative",
              isLockout 
                ? "bg-rose-500/10 border-2 border-rose-500/40 text-rose-400"
                : isBiometricAuthenticating
                ? "bg-red-500/15 border-2 border-red-500 text-red-400 shadow-xl shadow-red-500/30"
                : "bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-700 text-emerald-400 shadow-xl shadow-black/50"
            )}>
              {/* Outer pulsing ring while scanning */}
              {isBiometricAuthenticating && (
                <div className="absolute inset-0 rounded-full border-2 border-red-500/60 animate-ping opacity-75" />
              )}
              <Fingerprint className={cn(
                "w-12 h-12 transition-transform duration-300",
                isBiometricAuthenticating ? "scale-110 animate-pulse text-red-400" : isLockout ? "text-rose-400" : "text-emerald-400"
              )} />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#111827] p-1.5 rounded-full border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Biometric Unlock Required
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
              Verify your fingerprint or device credentials (PIN/Pattern) to access your authenticated emergency command session.
            </p>
          </div>

          {/* User Profile Badge */}
          <div className="w-full bg-[#070B17] border border-[#1F2937] rounded-2xl p-3 flex items-center justify-between text-left">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-300">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {policeOfficerAuth.isLoggedIn
                    ? `Officer ${policeOfficerAuth.username}`
                    : (user?.displayName || user?.email || 'Authorized Dispatcher')}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {policeOfficerAuth.isLoggedIn
                    ? `Badge: ${policeOfficerAuth.badgeNumber}`
                    : (user?.email || 'Authenticated Account')}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase shrink-0">
              Session Locked
            </span>
          </div>

          {/* Error / Status Feedback Banner */}
          {biometricAuthError && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "w-full p-3 rounded-2xl text-xs flex items-start gap-2.5 text-left border",
                isLockout
                  ? "bg-rose-950/60 border-rose-500/50 text-rose-200"
                  : isCancelled
                  ? "bg-amber-950/50 border-amber-500/40 text-amber-200"
                  : "bg-red-950/60 border-red-500/50 text-red-200"
              )}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-current" />
              <div className="space-y-1">
                <div className="font-bold">
                  {isLockout ? "Biometric Sensor Locked" : isCancelled ? "Verification Cancelled" : "Authentication Notice"}
                </div>
                <p className="text-[11px] opacity-90 leading-normal">
                  {biometricAuthError}
                </p>
                {isNotEnrolled && (
                  <p className="text-[11px] text-amber-300 font-semibold pt-0.5">
                    💡 You can enroll fingerprints in your Android device Settings, or sign in below.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-3 pt-2">
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={isBiometricAuthenticating}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl shadow-red-950/60 border border-red-400/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isBiometricAuthenticating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Waiting for Biometric Prompt...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4 text-white" />
                  <span>{biometricAuthError ? "Retry Biometric Unlock" : "Unlock with Fingerprint / PIN"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleBiometricFallbackSignOut}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#070B17] hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs border border-[#1F2937] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sign In with Account / Switch User</span>
            </button>
          </div>

          {/* AndroidX BiometricPrompt Security Assurance */}
          <div className="pt-2 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
            <span>Hardware Biometric Keystore • Device PIN/Pattern Fallback Supported</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // Summary Metrics calculations
  const totalAvailableBeds = hospitals.reduce((acc, h) => acc + h.availableBeds, 0);
  const activeEmergenciesCount = emergencies.filter(e => e.status === 'active').length;
  const preemptedSignalsCount = trafficSignals.filter(s => s.status === 'emergency-green').length;

  return (
    <div className="min-h-screen bg-[#070B17] text-slate-100 font-sans selection:bg-red-500/30 selection:text-white w-full max-w-full overflow-x-hidden">
      {/* Sticky Enterprise Command Navbar */}
      <header className="bg-[#111827]/95 backdrop-blur-md border-b border-[#1F2937] sticky top-0 z-[2000] shadow-2xl w-full max-w-full overflow-hidden box-border">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0">
          {/* Left: Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink min-w-0" onClick={() => setRole(null)}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
              <Siren className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0 truncate">
              <span className="font-extrabold text-sm sm:text-lg tracking-tight text-white flex items-center gap-1 sm:gap-1.5 truncate">
                SmartResponse <span className="text-[9px] sm:text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 sm:px-1.5 py-0.2 rounded font-mono uppercase shrink-0">Command</span>
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 hidden xs:block font-mono truncate">City Emergency Grid v2.4</span>
            </div>
          </div>
          
          {/* Center: Live Grid Status Banner */}
          <div className="hidden lg:flex items-center gap-2 bg-[#070B17] px-3.5 py-1.5 rounded-full border border-[#1F2937] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-300">
              {activeEmergenciesCount > 0 ? `${activeEmergenciesCount} Active Dispatch Corridors` : 'System Operational • All Nodes Online'}
            </span>
          </div>

          {/* Right: Live Meta Info & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Live Clock Badge */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#070B17] px-3 py-1 rounded-xl border border-[#1F2937] text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{currentTime || '12:00:00 PM'}</span>
            </div>

            {/* GPS Location Status Badge */}
            <div className="hidden lg:flex items-center gap-1.5 bg-[#070B17] px-3 py-1 rounded-xl border border-[#1F2937] text-xs text-slate-300">
              <MapPin className={cn("w-3.5 h-3.5 shrink-0", isSyncedWithGps ? "text-emerald-400" : "text-amber-400")} />
              <span>{isSyncedWithGps ? "Device GPS Active" : "Bengaluru Demo Grid"}</span>
            </div>

            {/* Connection Status & Disconnect Simulator */}
            <button
              type="button"
              onClick={() => setSimulateOffline(!simulateOffline)}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all cursor-pointer shadow-sm shrink-0",
                effectiveIsOnline
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 group"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20"
              )}
              title={effectiveIsOnline ? "Click to simulate network outage" : "Click to restore network connection"}
            >
              {effectiveIsOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="hidden xs:inline group-hover:hidden">Connected</span>
                  <span className="hidden group-hover:inline">Outage</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span>Offline</span>
                </>
              )}
            </button>

            {/* Police Officer Status Badge / Login Button */}
            {policeOfficerAuth.isLoggedIn ? (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs shadow-sm max-w-[130px] sm:max-w-none shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-bold text-amber-300 hidden sm:inline">Officer:</span>
                <span className="font-extrabold text-white truncate max-w-[45px] sm:max-w-none">{policeOfficerAuth.username}</span>
                <span className="text-[9px] sm:text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded border border-amber-500/20 shrink-0 hidden xs:inline">{policeOfficerAuth.badgeNumber || 'TP'}</span>
                <button
                  type="button"
                  onClick={handlePoliceLogout}
                  className="text-slate-400 hover:text-red-400 text-[10px] font-bold p-0.5 ml-0.5 cursor-pointer shrink-0"
                  title="Sign Out Officer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPoliceLoginModal(true)}
                className="text-[11px] sm:text-xs font-bold text-amber-400 hover:text-white px-2 sm:px-2.5 py-1 rounded-xl border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shadow-sm shrink-0"
                title="Police Officer Temp Login"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Police Login</span>
                <span className="sm:hidden">Police</span>
              </button>
            )}

            {/* Admin Status Badge / Login Button */}
            {adminAuth.isLoggedIn ? (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-purple-500/10 border border-purple-500/30 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs shadow-sm max-w-[120px] sm:max-w-none shrink-0">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <span className="font-bold text-purple-300 hidden sm:inline">Admin:</span>
                <span className="font-extrabold text-white truncate max-w-[45px] sm:max-w-none">{adminAuth.username}</span>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="text-slate-400 hover:text-red-400 text-[10px] font-bold p-0.5 ml-0.5 cursor-pointer shrink-0"
                  title="Sign Out Admin"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdminLoginModal(true)}
                className="hidden sm:flex text-xs font-bold text-purple-300 hover:text-white px-2.5 py-1.5 rounded-xl border border-purple-500/30 hover:bg-purple-500/20 transition-all cursor-pointer items-center gap-1.5 shadow-sm shrink-0"
                title="Admin Command Temp Sign-In"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Admin</span>
              </button>
            )}

            {/* Biometric Security Settings Button */}
            <button
              type="button"
              onClick={() => setShowBiometricSettingsModal(true)}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm shrink-0",
                biometricEnabled
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-[#070B17] text-slate-400 border-[#1F2937] hover:text-slate-200 hover:border-slate-600"
              )}
              title="Biometric Fingerprint Security Settings"
            >
              <Fingerprint className={cn("w-3.5 h-3.5 shrink-0", biometricEnabled ? "text-emerald-400 animate-pulse" : "text-slate-400")} />
              <span>{biometricEnabled ? "Biometrics ON" : "Biometrics"}</span>
            </button>

            {/* User Profile / Logout */}
            <div className="hidden sm:flex flex-col items-end pl-2 border-l border-[#1F2937]">
              <span className="text-xs font-bold text-white">
                {user?.isAnonymous ? 'Guest Dispatcher' : (user?.displayName || 'Authorized User')}
              </span>
              <span className="text-[10px] text-slate-400 capitalize">{role || 'Select Portal'}</span>
            </div>

            {user && !user.isAnonymous ? (
              <button 
                onClick={logout}
                className="p-2 hover:bg-[#1F2937] rounded-xl text-slate-400 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={login}
                disabled={isSigningIn}
                className="text-xs font-bold text-red-400 hover:text-white px-3 py-1.5 rounded-xl border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSigningIn ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Admin Global Directive Broadcast Banner */}
      <AnimatePresence>
        {globalBroadcast?.active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              "relative overflow-hidden border-b z-[1920]",
              globalBroadcast.severity === 'critical'
                ? "bg-gradient-to-r from-red-950/90 via-rose-950/90 to-red-950/90 border-red-500/40 text-red-100"
                : globalBroadcast.severity === 'warning'
                  ? "bg-gradient-to-r from-amber-950/90 via-orange-950/80 to-amber-950/90 border-amber-500/40 text-amber-100"
                  : "bg-gradient-to-r from-indigo-950/90 via-blue-950/80 to-indigo-950/90 border-blue-500/40 text-blue-100"
            )}
          >
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-4 h-4 shrink-0 animate-pulse" />
                <div>
                  <span className="font-extrabold uppercase tracking-wider mr-2">[{globalBroadcast.title}]</span>
                  <span className="opacity-95">{globalBroadcast.message}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono opacity-75 shrink-0 hidden sm:inline">Admin Broadcast</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Police Session Revocation Notice */}
      <AnimatePresence>
        {policeSessionNotice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-rose-950/80 border-b border-rose-500/40 text-rose-100 z-[1910]"
          >
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldBan className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">{policeSessionNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setPoliceSessionNotice(null)}
                className="text-rose-300 hover:text-white px-2 py-0.5 rounded bg-rose-900/50 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Lost Notification Banner */}
      <AnimatePresence>
        {!effectiveIsOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              "relative overflow-hidden border-b transition-colors duration-300 z-[1900]",
              hasActiveEmergency 
                ? "bg-red-950/80 border-red-800 text-red-200" 
                : "bg-[#111827] border-[#1F2937] text-slate-300"
            )}
          >
            {hasActiveEmergency && (
              <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
            )}
            
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <WifiOff className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    Offline Resilience Layer Active
                  </h4>
                  <p className="text-slate-400 mt-0.5">
                    Updates are queued locally via Firestore persistence and will auto-synchronize when connection is re-established.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimulateOffline(false)}
                className="bg-[#1F2937] hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer shrink-0"
              >
                Reconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* High-Visibility Floating In-App Green Corridor Alert Banner */}
      <AnimatePresence>
        {activeCorridorBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 max-w-xl mx-auto z-[9999] bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xl shadow-red-950/80 border-2 border-red-300 flex items-start justify-between gap-2 sm:gap-3 backdrop-blur-md overflow-hidden box-border"
          >
            <div className="flex items-start gap-2 sm:gap-3.5 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-lg animate-pulse mt-0.5">
                <Siren className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="bg-white text-red-700 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm shrink-0">
                    EMERGENCY CLEARANCE
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm leading-tight drop-shadow truncate max-w-full">
                    {activeCorridorBanner.title}
                  </h4>
                </div>
                <p className="text-[11px] sm:text-xs text-red-100 font-medium leading-snug break-words">
                  {activeCorridorBanner.bodyText}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 text-[10px] sm:text-[11px] text-red-200">
                  <span className="flex items-center gap-1 font-bold text-yellow-300 shrink-0">
                    <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
                    Audio Siren Triggered
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">Preempting Signals</span>
                  {role !== 'traffic' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRole('traffic');
                        setActiveCorridorBanner(null);
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-red-50 text-red-800 font-extrabold text-[10px] sm:text-xs rounded-lg shadow transition cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      Traffic Control →
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveCorridorBanner(null)}
              className="p-1.5 sm:p-2 rounded-xl bg-black/40 hover:bg-black/60 text-white transition-colors shrink-0 cursor-pointer self-start ml-1"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* GPS Synchronization Bar */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3.5 z-10 w-full sm:w-auto">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md",
              isSyncedWithGps ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-[#1F2937] text-slate-400 border border-slate-700"
            )}>
              <MapPin className={cn("w-5 h-5", isSyncing && "animate-bounce")} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm md:text-base flex items-center gap-2">
                {isSyncedWithGps ? "Physical Device Location Synced" : "Default Simulation Coordinates (Bengaluru)"}
                {isSyncedWithGps && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                {isSyncedWithGps 
                  ? `Active at ${syncedCoords?.lat.toFixed(4)}, ${syncedCoords?.lng.toFixed(4)}. Surrounding hospitals & traffic nodes generated around you.`
                  : "Synchronize to use your device's actual GPS location or keep using the pre-configured Bengaluru demo grid."
                }
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 z-10 shrink-0 w-full sm:w-auto">
            {isSyncedWithGps && (
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isSyncing}
                className="w-full sm:w-auto text-xs font-bold bg-[#1F2937] hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
              >
                Reset to Demo Grid
              </button>
            )}
            
            <button
              type="button"
              onClick={handleGpsSync}
              disabled={isSyncing}
              className={cn(
                "w-full sm:w-auto text-xs font-bold px-4 py-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg",
                isSyncedWithGps
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                  : "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white border-red-500/30 shadow-red-950/40"
              )}
            >
              {isSyncing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Syncing GPS...
                </>
              ) : isSyncedWithGps ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Update Physical GPS
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 animate-pulse" />
                  Sync My Device Location
                </>
              )}
            </button>
          </div>

          {/* Sync Error Display */}
          {syncError && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-950/95 border-t border-red-800 px-4 py-2 text-[11px] text-red-200 flex items-center justify-between z-20">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                {syncError}
              </span>
              <button 
                onClick={() => setSyncError(null)} 
                className="font-bold text-red-400 hover:text-white px-1"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {!role ? (
          /* Landing Dashboard & Role Selection */
          <div className="space-y-10">
            {/* Hero Banner */}
            <div className="text-center max-w-3xl mx-auto pt-4 space-y-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-bold uppercase tracking-wider"
              >
                <Activity className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                Next-Gen Emergency Dispatch Architecture
              </motion.div>
              
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Smart Emergency Response System
              </h1>
              
              <p className="text-slate-400 text-base md:text-lg leading-relaxed">
                Real-time ambulance coordination, hospital bed management and intelligent traffic signal control.
              </p>
            </div>

            {/* Live System Statistics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AmbulanceIcon className="w-16 h-16 text-red-500" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3">
                  <AmbulanceIcon className="w-5 h-5" />
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {ambulances.length}
                </div>
                <div className="text-xs font-bold text-slate-300 mt-1">Active Ambulances</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {ambulances.filter(a => a.status !== 'idle').length} currently responding
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <HospitalIcon className="w-16 h-16 text-blue-500" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                  <HospitalIcon className="w-5 h-5" />
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {hospitals.length}
                </div>
                <div className="text-xs font-bold text-slate-300 mt-1">Connected Hospitals</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  24/7 Emergency trauma care
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Bed className="w-16 h-16 text-emerald-500" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                  <Bed className="w-5 h-5" />
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {totalAvailableBeds}
                </div>
                <div className="text-xs font-bold text-slate-300 mt-1">Available Beds</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Live Firestore inventory
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrafficCone className="w-16 h-16 text-amber-500" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                  <TrafficCone className="w-5 h-5" />
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {trafficSignals.length}
                </div>
                <div className="text-xs font-bold text-slate-300 mt-1">Smart Traffic Signals</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {preemptedSignalsCount} signals in Green Corridor
                </div>
              </motion.div>
            </div>

            {/* Role Portals Selection Cards */}
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                Select Command Module
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <RoleCard 
                  title="Ambulance Operator" 
                  description="Emergency vehicle navigation, live traffic preemption, hospital selection, and patient status logging."
                  icon={<AmbulanceIcon className="w-8 h-8" />}
                  color="from-red-500 to-rose-700 text-white"
                  buttonText="Open Operator Dashboard"
                  onClick={() => {
                    setRole('ambulance');
                    if (localStorage.getItem('emergency_gps_lat')) {
                      setIsTracking(true);
                    }
                  }}
                />
                <RoleCard 
                  title="Hospital Staff" 
                  description="Manage real-time ICU/Emergency bed availability, monitor incoming ambulance ETAs, and prepare trauma bays."
                  icon={<HospitalIcon className="w-8 h-8" />}
                  color="from-blue-500 to-indigo-700 text-white"
                  buttonText="Open Hospital Portal"
                  onClick={() => setRole('hospital')}
                />
                <div className="flex flex-col gap-2">
                  <RoleCard 
                    title="Traffic Control" 
                    description="Monitor active emergency corridors, manually override signal cycles, and clear intersections in real-time."
                    icon={<TrafficCone className="w-8 h-8" />}
                    color="from-amber-500 to-orange-700 text-white"
                    buttonText="Open Control Center"
                    onClick={() => setRole('traffic')}
                  />
                  {/* Quick Police Officer Login Status / Direct Action */}
                  <div className="bg-[#111827] px-4 py-2.5 rounded-2xl border border-[#1F2937] flex items-center justify-between text-xs">
                    {policeOfficerAuth.isLoggedIn ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <span className="font-bold text-amber-300 text-xs truncate">Officer {policeOfficerAuth.username}</span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">ALERTS LIVE</span>
                        </div>
                        <button
                          type="button"
                          onClick={handlePoliceLogout}
                          className="text-[11px] text-slate-400 hover:text-red-400 ml-2 underline cursor-pointer shrink-0"
                        >
                          Sign Out
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] text-slate-400">Officer ID & Pass (No Fingerprint):</span>
                        <button
                          type="button"
                          onClick={() => setShowPoliceLoginModal(true)}
                          className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          Sign In
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col">
                  <RoleCard 
                    title="Admin & Dispatch" 
                    description="Master command over everything: create Traffic Police IDs & passwords, override signals, adjust hospital beds, and control fleet dispatches."
                    icon={<ShieldCheck className="w-8 h-8" />}
                    color="from-purple-600 to-indigo-800 text-white"
                    buttonText={adminAuth.isLoggedIn ? "Open Admin Dashboard" : "Admin Sign In / Access"}
                    onClick={() => {
                      if (adminAuth.isLoggedIn) {
                        setRole('admin');
                      } else {
                        setShowAdminLoginModal(true);
                      }
                    }}
                  />
                  <div className="mt-2 p-2.5 rounded-xl bg-[#0f172a] border border-purple-500/20 flex flex-col gap-1.5">
                    {adminAuth.isLoggedIn ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-xs font-bold text-purple-300">Admin Active:</span>
                          <span className="text-xs font-extrabold text-white">{adminAuth.username}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRole('admin')}
                            className="text-xs font-bold text-purple-400 hover:text-purple-300 underline cursor-pointer"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={handleAdminLogout}
                            className="text-[11px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] text-slate-400">Admin Pass (admin / admin123):</span>
                        <button
                          type="button"
                          onClick={() => setShowAdminLoginModal(true)}
                          className="text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                          Sign In
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Biometric Security Quick Setting Banner */}
              <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 shadow-lg",
                    biometricEnabled ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"
                  )}>
                    <Fingerprint className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Secure Fingerprint Authentication
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border",
                        biometricEnabled 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      )}>
                        {biometricEnabled ? "Active & Enforced" : "Disabled (Optional)"}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Protects active dispatcher & officer sessions with AndroidX BiometricPrompt on app launch. Device PIN fallback supported.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowBiometricSettingsModal(true)}
                    className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Configure Biometrics
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleBiometricSetting}
                    disabled={isBiometricAuthenticating}
                    className={cn(
                      "text-xs font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
                      biometricEnabled
                        ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    {biometricEnabled ? "Disable Lock" : "Enable Lock"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active Role View Header */
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#111827] px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-[#1F2937] overflow-hidden">
              <button 
                onClick={() => setRole(null)}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                ← Back to Command Overview
              </button>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="text-[11px] sm:text-xs text-slate-400">Current Dashboard:</span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg">
                  {role} Portal
                </span>
              </div>
            </div>

            {role === 'ambulance' && (
              <AmbulanceDashboard 
                ambulance={effectiveAmbulance} 
                hospitals={hospitals} 
                emergencies={emergencies}
                signals={dynamicTrafficSignals}
                emergencyRequests={emergencyRequests}
                isTracking={isTracking}
                setIsTracking={setIsTracking}
                geoError={geoError}
                setGeoError={setGeoError}
                liveLocation={liveLocation}
                gpsPermissionStatus={gpsPermissionStatus}
                hospitalSearchStatus={hospitalSearchStatus}
                hospitalSearchInfo={hospitalSearchInfo}
                onEmergencyCreated={(em) => {
                  setEmergencies(prev => {
                    const filtered = prev.filter(e => e.id !== em.id && !(e.ambulanceId === em.ambulanceId && e.status === 'active'));
                    return [...filtered, em];
                  });
                }}
                onBedRequestCreated={(req) => {
                  setEmergencyRequests(prev => {
                    const filtered = prev.filter(r => r.requestId !== req.requestId && r.ambulanceId !== req.ambulanceId);
                    return [...filtered, req];
                  });
                }}
                onEmergencyCompleted={(emId) => {
                  setEmergencies(prev => prev.map(e => e.id === emId ? { ...e, status: 'completed' } : e));
                }}
                onRefreshHospitals={async () => {
                  let lat = liveLocation?.lat ?? syncedCoords?.lat ?? 12.9716;
                  let lng = liveLocation?.lng ?? syncedCoords?.lng ?? 77.5946;
                  try {
                    const fresh = await getDeviceCurrentPosition(6000);
                    if (fresh) {
                      lat = fresh.latitude;
                      lng = fresh.longitude;
                      setLiveLocation({
                        lat,
                        lng,
                        accuracy: fresh.accuracy ? Math.round(fresh.accuracy) : null,
                        lastUpdated: new Date().toLocaleTimeString()
                      });
                      setSyncedCoords({ lat, lng });
                      localStorage.setItem('emergency_gps_lat', lat.toString());
                      localStorage.setItem('emergency_gps_lng', lng.toString());
                      if (myAmbulance) {
                        updateAmbulanceStatus(myAmbulance.id, myAmbulance.status, { lat, lng }).catch(() => {});
                      }
                    }
                  } catch (e) {
                    console.warn("GPS direct fix notice:", e);
                  }
                  await triggerHospitalRefetch(lat, lng);
                }}
                onRetryGps={handleGpsSync}
              />
            )}
            {role === 'hospital' && (
              <HospitalDashboard 
                hospitals={hospitals} 
                emergencies={emergencies}
                ambulances={ambulances}
                signals={dynamicTrafficSignals}
                emergencyRequests={emergencyRequests}
                center={syncedCoords ? [syncedCoords.lat, syncedCoords.lng] : [12.9716, 77.5946]}
              />
            )}
            {role === 'traffic' && (
              <TrafficDashboard 
                signals={dynamicTrafficSignals} 
                ambulances={ambulances}
                emergencies={emergencies}
                hospitals={hospitals}
                emergencyRequests={emergencyRequests}
                user={user}
                center={syncedCoords ? [syncedCoords.lat, syncedCoords.lng] : [12.9716, 77.5946]}
                policeOfficerAuth={policeOfficerAuth}
                onOpenPoliceLogin={() => setShowPoliceLoginModal(true)}
                onPoliceLogout={handlePoliceLogout}
                onPoliceAuthenticate={handlePoliceAuthenticate}
                isAuthenticatingPolice={isAuthenticatingPolice}
                policeLoginError={policeLoginError}
                policeSessionNotice={policeSessionNotice}
              />
            )}
            {role === 'admin' && (
              <AdminDashboard 
                hospitals={hospitals}
                ambulances={ambulances}
                emergencies={emergencies}
                emergencyRequests={emergencyRequests}
                signals={dynamicTrafficSignals}
                trafficOfficers={trafficOfficers}
                globalBroadcast={globalBroadcast}
                adminAuth={adminAuth}
                onAdminLogout={handleAdminLogout}
                onOfficerCreated={(newOfficer) => {
                  setTrafficOfficers((prev) => {
                    const filtered = prev.filter((o) => o.id !== newOfficer.id);
                    return [newOfficer, ...filtered];
                  });
                }}
                onDirectLoginAsOfficer={async (officer) => {
                  const nowISO = new Date().toISOString();
                  const session: PoliceOfficerSession = {
                    isLoggedIn: true,
                    accountId: officer.id,
                    officerId: officer.officerId,
                    username: officer.officerId,
                    fullName: officer.fullName,
                    badgeNumber: officer.badgeNumber,
                    assignedZone: officer.assignedZone,
                    sessionVersion: officer.sessionVersion || 1,
                    loginTime: nowISO
                  };
                  setPoliceOfficerAuth(session);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(TRAFFIC_AUTH_STORAGE_KEY, JSON.stringify(session));
                  }
                  setRole('traffic');
                }}
                onTriggerSystemReseed={async () => {
                  const lat = liveLocation?.lat ?? syncedCoords?.lat ?? 12.9716;
                  const lng = liveLocation?.lng ?? syncedCoords?.lng ?? 77.5946;
                  await seedAroundLocation(lat, lng);
                }}
                onOpenTrafficControl={() => setRole('traffic')}
              />
            )}
          </div>
        )}
      </main>

      {/* Traffic Police Officer ID & Password Login Modal (No Fingerprint Required) */}
      <AnimatePresence>
        {showPoliceLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#111827] border border-amber-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => {
                  setShowPoliceLoginModal(false);
                  setPoliceLoginError(null);
                }}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-[#1F2937] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    Traffic Police Sign-In
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Officer ID & Password Only • No Fingerprint Required</p>
                </div>
              </div>

              {policeLoginError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{policeLoginError}</span>
                </div>
              )}

              <form onSubmit={handlePoliceLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Traffic Officer ID
                  </label>
                  <input
                    type="text"
                    value={policeUsernameInput}
                    onChange={(e) => setPoliceUsernameInput(e.target.value)}
                    placeholder="Enter Officer ID (e.g. TP-101 or police)"
                    autoComplete="username"
                    className="w-full bg-[#1F2937] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPolicePassword ? "text" : "password"}
                      value={policePasswordInput}
                      onChange={(e) => setPolicePasswordInput(e.target.value)}
                      placeholder="Enter Admin-assigned password"
                      autoComplete="current-password"
                      className="w-full bg-[#1F2937] border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPolicePassword(!showPolicePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      aria-label={showPolicePassword ? "Hide password" : "Show password"}
                    >
                      {showPolicePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Admin-Managed Credentials Info */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Admin-Managed Credentials
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                      NO BIOMETRICS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Use the Officer ID & Password issued by your System Administrator in <span className="text-slate-200 font-semibold">Admin & Dispatch</span>. Default setup account: <code className="text-amber-300 font-mono">police / police123</code> (until updated or removed by Admin).
                  </p>
                </div>

                <div className="bg-[#1F2937]/50 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                  💡 <span className="font-semibold text-slate-300">Live Device Registration:</span> Once logged in, this device sounds emergency sirens, vibrates, and shows green corridor alerts even if you leave the Traffic Control screen.
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPoliceLoginModal(false);
                      setPoliceLoginError(null);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#1F2937] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthenticatingPolice}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isAuthenticatingPolice ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        Verifying ID...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4 text-slate-950" />
                        Sign In with ID & Pass
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin ID & Password Sign-In Modal (Temp Admin Login) */}
      <AnimatePresence>
        {showAdminLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#111827] border border-purple-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => {
                  setShowAdminLoginModal(false);
                  setAdminLoginError(null);
                }}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-[#1F2937] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-lg">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    Admin Command Sign-In
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Master Dispatcher & Police Management Access</p>
                </div>
              </div>

              {adminLoginError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{adminLoginError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Admin Username / ID
                  </label>
                  <input
                    type="text"
                    value={adminUserInput}
                    onChange={(e) => setAdminUserInput(e.target.value)}
                    placeholder="Enter Admin Username (default: admin)"
                    autoComplete="username"
                    className="w-full bg-[#1F2937] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? "text" : "password"}
                      value={adminPassInput}
                      onChange={(e) => setAdminPassInput(e.target.value)}
                      placeholder="Enter Admin Password (default: admin or admin123)"
                      autoComplete="current-password"
                      className="w-full bg-[#1F2937] border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      aria-label={showAdminPassword ? "Hide password" : "Show password"}
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Default Credentials Callout & 1-Click Login */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      Default Master Credentials
                    </span>
                    <span className="text-[10px] font-mono text-purple-200 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                      admin / admin123
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Gives instant full control over creating Traffic Police IDs, passwords, overrides, and live fleet management.
                  </p>
                  <button
                    type="button"
                    onClick={handleQuickAdminLogin}
                    disabled={isAuthenticatingAdmin}
                    className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white rounded-xl text-xs font-bold border border-purple-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    ⚡ Quick 1-Click Admin Sign-In (Auto-Fill & Login)
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminLoginModal(false);
                      setAdminLoginError(null);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-[#1F2937] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthenticatingAdmin}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20 cursor-pointer"
                  >
                    {isAuthenticatingAdmin ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Sign In as Admin
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Biometric Security Settings Modal */}
      <AnimatePresence>
        {showBiometricSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#111827] border border-emerald-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setShowBiometricSettingsModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-[#1F2937] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
                  <Fingerprint className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Biometric & Fingerprint Security</h3>
                  <p className="text-xs text-slate-400">AndroidX BiometricPrompt & Device PIN Integration</p>
                </div>
              </div>

              {/* Toast Feedback */}
              {biometricToast && (
                <div className={cn(
                  "p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2",
                  biometricToast.type === 'success'
                    ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300"
                    : "bg-rose-500/15 border border-rose-500/40 text-rose-300"
                )}>
                  {biometricToast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{biometricToast.message}</span>
                </div>
              )}

              {/* Hardware Diagnostics Status Cards */}
              <div className="space-y-2 mb-5">
                <div className="text-[11px] font-mono uppercase text-slate-400 tracking-wider font-bold">
                  Device Hardware Status
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#070B17] p-3 rounded-xl border border-[#1F2937] space-y-1">
                    <span className="text-[10px] text-slate-500 block font-mono">Biometric Sensor</span>
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        biometricStatus?.isAvailable ? "bg-emerald-400" : "bg-amber-400"
                      )} />
                      {biometricStatus ? getBiometryTypeName(biometricStatus.biometryType) : "Checking..."}
                    </span>
                  </div>

                  <div className="bg-[#070B17] p-3 rounded-xl border border-[#1F2937] space-y-1">
                    <span className="text-[10px] text-slate-500 block font-mono">Device Credentials</span>
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        biometricStatus?.deviceIsSecure ? "bg-emerald-400" : "bg-slate-500"
                      )} />
                      {biometricStatus?.deviceIsSecure ? "PIN/Pattern Active" : "No Screen Lock"}
                    </span>
                  </div>
                </div>

                {biometricStatus && !biometricStatus.isAvailable && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-200 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {biometricStatus.code === BiometryErrorType.biometryNotEnrolled
                        ? "No fingerprint is currently registered. You can enroll fingerprints in your Android device Settings."
                        : (biometricStatus.reason || "Biometric sensor unavailable on this device.")}
                    </span>
                  </div>
                )}
              </div>

              {/* Optional Biometric Toggle Setting (Requirement 5) */}
              <div className="bg-[#070B17] border border-[#1F2937] rounded-2xl p-4 mb-5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    Require Biometrics on Launch
                  </div>
                  <div className="text-xs text-slate-400 leading-snug">
                    Prompts for fingerprint or device PIN/pattern when opening the app with an active session.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleBiometricSetting}
                  disabled={isBiometricAuthenticating}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 border",
                    biometricEnabled ? "bg-emerald-500 border-emerald-400" : "bg-slate-800 border-slate-700"
                  )}
                  aria-label="Toggle Biometric Lock"
                >
                  <motion.div
                    animate={{ x: biometricEnabled ? 26 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 left-0"
                  />
                </button>
              </div>

              {/* Security Details */}
              <div className="bg-[#1F2937]/40 rounded-xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Privacy & Hardware Security
                </div>
                <p>
                  Authentication is handled entirely on-device by AndroidX <span className="text-slate-300 font-mono">BiometricPrompt</span>. No fingerprint images or templates are ever accessed or stored by this application.
                </p>
                <p>
                  If biometric verification fails or is unavailable, Android device credentials (PIN, pattern, or password) are supported as a secure fallback.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowBiometricSettingsModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Role Card Component ---
function RoleCard({ title, description, icon, color, buttonText, onClick }: any) {
  return (
    <motion.button
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-[#111827] p-7 rounded-2xl border border-[#1F2937] text-left hover:border-red-500/40 hover:shadow-2xl hover:shadow-red-500/10 transition-all group flex flex-col justify-between cursor-pointer relative overflow-hidden"
    >
      <div className="space-y-4 relative z-10">
        <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg transition-transform group-hover:scale-110", color)}>
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors mb-2">{title}</h3>
          <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="pt-6 mt-6 border-t border-[#1F2937] flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-white transition-colors relative z-10">
        <span>{buttonText || 'Open Dashboard'}</span>
        <ArrowRight className="w-4 h-4 text-red-500 group-hover:translate-x-1 transition-transform" />
      </div>
    </motion.button>
  );
}

// --- Compact GPS Info Card ---
function GpsStatusCard({ 
  isTracking, 
  setIsTracking, 
  geoError, 
  setGeoError, 
  location,
  liveLocation,
  gpsPermissionStatus,
  hospitalSearchStatus,
  hospitalSearchInfo,
  onRefreshHospitals,
  onRetryGps
}: { 
  isTracking: boolean;
  setIsTracking: (v: boolean) => void;
  geoError: string | null;
  setGeoError: (err: string | null) => void;
  location?: { lat: number; lng: number };
  liveLocation?: { lat: number; lng: number; accuracy: number | null; lastUpdated: string | null } | null;
  gpsPermissionStatus?: 'prompt' | 'granted' | 'denied' | 'requesting' | 'unavailable' | 'error';
  hospitalSearchStatus?: 'idle' | 'searching' | 'success' | 'fallback' | 'error';
  hospitalSearchInfo?: { count: number; radiusKm: number; message: string };
  onRefreshHospitals?: () => void;
  onRetryGps?: () => void;
}) {
  const effectiveLat = liveLocation?.lat ?? location?.lat ?? 12.9716;
  const effectiveLng = liveLocation?.lng ?? location?.lng ?? 77.5946;

  return (
    <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className={cn(
            "w-4 h-4", 
            gpsPermissionStatus === 'granted' || isTracking ? "text-emerald-400 animate-pulse" : "text-amber-400"
          )} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Telematics & GPS</span>
        </div>
        <span className={cn(
          "text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5",
          gpsPermissionStatus === 'granted'
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
            : gpsPermissionStatus === 'requesting'
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
              : gpsPermissionStatus === 'denied'
                ? "bg-red-500/10 text-red-400 border-red-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
        )}>
          <span className={cn(
            "w-2 h-2 rounded-full",
            gpsPermissionStatus === 'granted' ? "bg-emerald-400 animate-ping" : "bg-amber-400"
          )} />
          {gpsPermissionStatus === 'granted' 
            ? "LIVE GPS CONNECTED" 
            : gpsPermissionStatus === 'requesting'
              ? "GETTING LOCATION..."
              : gpsPermissionStatus === 'denied'
                ? "LOCATION ACCESS DENIED"
                : "GPS SIMULATION"}
        </span>
      </div>

      {/* Lat/Lng Grid with Accuracy & Timestamp */}
      <div className="space-y-2 bg-[#070B17] p-3 rounded-xl border border-[#1F2937]">
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <span className="text-[9px] text-slate-500 uppercase block font-sans">Latitude</span>
            <span className="text-white font-extrabold">{effectiveLat.toFixed(5)}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 uppercase block font-sans">Longitude</span>
            <span className="text-white font-extrabold">{effectiveLng.toFixed(5)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-[#1F2937] pt-2 mt-2">
          <span>Accuracy: <strong className="text-emerald-400 font-mono">{liveLocation?.accuracy ? `± ${liveLocation.accuracy} m` : '± 10 m'}</strong></span>
          <span>Updated: <strong className="text-slate-200 font-mono">{liveLocation?.lastUpdated || 'Just now'}</strong></span>
        </div>
      </div>

      {/* Hospital Dynamic Query Status */}
      <div className="p-3 bg-[#070B17] rounded-xl border border-[#1F2937] text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <HospitalIcon className="w-3.5 h-3.5 text-red-400" /> Nearby Hospital Search
          </span>
          {hospitalSearchStatus === 'searching' && (
            <span className="text-[10px] text-amber-400 font-mono animate-pulse flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Querying OSM...
            </span>
          )}
        </div>

        <p className="text-slate-300 text-[11px] font-medium leading-tight">
          {hospitalSearchStatus === 'searching' 
            ? `Searching OpenStreetMap Overpass API within 10 km...`
            : hospitalSearchStatus === 'fallback'
              ? `${hospitalSearchInfo?.count || 10} hospitals synchronized around GPS coordinates.`
              : hospitalSearchInfo?.message || `${hospitalSearchInfo?.count || 10} real hospitals found near your GPS position.`}
        </p>
      </div>

      {/* Buttons */}
      <div className="space-y-2">
        {onRefreshHospitals && (
          <button
            type="button"
            onClick={onRefreshHospitals}
            disabled={hospitalSearchStatus === 'searching'}
            className="w-full text-xs font-extrabold py-2.5 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/30"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", hospitalSearchStatus === 'searching' && "animate-spin")} />
            {hospitalSearchStatus === 'searching' ? "Querying Real Hospitals..." : "Refresh Nearby Hospitals"}
          </button>
        )}

        {gpsPermissionStatus === 'denied' && onRetryGps && (
          <button
            type="button"
            onClick={onRetryGps}
            className="w-full text-xs font-extrabold py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Compass className="w-3.5 h-3.5" />
            Retry Location Access Permission
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setGeoError(null);
            setIsTracking(!isTracking);
          }}
          className={cn(
            "w-full text-xs font-bold py-2 px-3 rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer",
            isTracking
              ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
          )}
        >
          <MapIcon className="w-3.5 h-3.5" />
          {isTracking ? "Switch to Simulation Mode" : "Force Re-sync Device Geolocation"}
        </button>
      </div>

      {geoError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 leading-relaxed space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Geolocation Alert
          </p>
          <p className="text-[11px] text-red-200/90">{geoError}</p>
        </div>
      )}
    </div>
  );
}

// --- Ambulance Dashboard ---
function AmbulanceDashboard({ 
  ambulance, 
  hospitals, 
  emergencies, 
  signals,
  emergencyRequests,
  isTracking,
  setIsTracking,
  geoError,
  setGeoError,
  liveLocation,
  gpsPermissionStatus,
  hospitalSearchStatus,
  hospitalSearchInfo,
  onRefreshHospitals,
  onRetryGps,
  onEmergencyCreated,
  onBedRequestCreated,
  onEmergencyCompleted
}: { 
  ambulance: Ambulance | null, 
  hospitals: Hospital[], 
  emergencies: Emergency[], 
  signals: TrafficSignal[],
  emergencyRequests?: EmergencyRequest[],
  isTracking: boolean,
  setIsTracking: (t: boolean) => void,
  geoError: string | null,
  setGeoError: (err: string | null) => void,
  liveLocation?: { lat: number; lng: number; accuracy: number | null; lastUpdated: string | null } | null,
  gpsPermissionStatus?: 'prompt' | 'granted' | 'denied' | 'requesting' | 'unavailable' | 'error',
  hospitalSearchStatus?: 'idle' | 'searching' | 'success' | 'fallback' | 'error',
  hospitalSearchInfo?: { count: number; radiusKm: number; message: string },
  onRefreshHospitals?: () => void,
  onRetryGps?: () => void,
  onEmergencyCreated?: (e: Emergency) => void,
  onBedRequestCreated?: (r: EmergencyRequest) => void,
  onEmergencyCompleted?: (id: string) => void
}) {
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [emergencyType, setEmergencyType] = useState('Cardiac Arrest');
  const [patientInfo, setPatientInfo] = useState('');
  const [reqDepartment, setReqDepartment] = useState('Emergency / Trauma');
  const [reqSeverity, setReqSeverity] = useState<EmergencyRequestSeverity>('high');
  const [reqNotes, setReqNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'nearest' | 'beds' | 'eta' | 'trauma' | 'cardiac' | 'multispeciality'>('all');

  const [previewRouteCoords, setPreviewRouteCoords] = useState<[number, number][]>([]);
  const [previewDistance, setPreviewDistance] = useState<number | null>(null);
  const [previewEta, setPreviewEta] = useState<number | null>(null);

  const fallbackAmb = useMemo<Ambulance>(() => {
    const savedLat = typeof window !== 'undefined' ? localStorage.getItem('emergency_gps_lat') : null;
    const savedLng = typeof window !== 'undefined' ? localStorage.getItem('emergency_gps_lng') : null;
    const curLat = liveLocation?.lat ?? (savedLat ? parseFloat(savedLat) : 12.9716);
    const curLng = liveLocation?.lng ?? (savedLng ? parseFloat(savedLng) : 77.5946);
    const guestOrUid = typeof window !== 'undefined' ? (localStorage.getItem('emergency_guest_id') || 'unit1') : 'unit1';
    return {
      id: 'amb-' + guestOrUid.replace(/[^a-zA-Z0-9]/g, '').slice(-8),
      driverName: 'Emergency Driver Unit 1',
      location: { lat: curLat, lng: curLng },
      status: 'idle',
      uid: guestOrUid
    };
  }, [liveLocation]);

  const currentAmbulance = ambulance || fallbackAmb;

  const liveAmbulance = useMemo<Ambulance>(() => {
    const lat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const lng = liveLocation?.lng ?? currentAmbulance.location.lng;
    return {
      ...currentAmbulance,
      location: { lat, lng },
      lastUpdated: liveLocation?.lastUpdated || currentAmbulance.lastUpdated || 'Just now',
      lastSeenTimestamp: Date.now()
    };
  }, [currentAmbulance, liveLocation]);

  const activeEmergency = emergencies.find(e => (e.ambulanceId === currentAmbulance.id || (ambulance && e.ambulanceId === ambulance.id)) && e.status === 'active');

  // Hands-free Voice Guidance HUD state
  const [voiceEnabled, setVoiceEnabled] = useState(() => voiceGuidance.isEnabled());
  const [lastVoicePrompt, setLastVoicePrompt] = useState<VoicePromptEvent | null>(() => voiceGuidance.getLastEvent());

  useEffect(() => {
    const unsub = voiceGuidance.subscribe((evt) => {
      setLastVoicePrompt(evt);
      setVoiceEnabled(evt.enabled);
    });
    return () => unsub();
  }, []);

  // Voice Guidance: real-time proximity navigation cues during active emergency dispatch
  useEffect(() => {
    if (!activeEmergency) return;
    const ambLat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const ambLng = liveLocation?.lng ?? currentAmbulance.location.lng;

    // 1. Proximity to target hospital bay (within 350 meters)
    const hosp = hospitals.find(h => h.id === activeEmergency.hospitalId);
    if (hosp && hosp.location) {
      const distHospKm = parseFloat(calculateDistance(ambLat, ambLng, hosp.location.lat, hosp.location.lng));
      if (distHospKm <= 0.35) {
        voiceGuidance.announceHospitalBayArrival(hosp.name, Math.round(distHospKm * 1000));
      }
    }

    // 2. Proximity to upcoming traffic junctions within 800 meters
    if (signals && signals.length > 0) {
      for (const sig of signals) {
        if (!sig.location) continue;
        const distSigKm = parseFloat(calculateDistance(ambLat, ambLng, sig.location.lat, sig.location.lng));
        if (distSigKm <= 0.8 && distSigKm >= 0.05) {
          const juncName = (sig as any).name || (sig as any).intersectionName || `Junction ${sig.id.slice(-4)}`;
          voiceGuidance.announceApproachingJunction(juncName, Math.round(distSigKm * 1000));
          break;
        }
      }
    }

    // 3. Dynamic upcoming turn announcements along route
    const route = activeEmergency.routeCoords;
    if (route && route.length >= 3) {
      let closestIdx = 0;
      let minD = Infinity;
      for (let i = 0; i < route.length; i++) {
        const d = (route[i].lat - ambLat) ** 2 + (route[i].lng - ambLng) ** 2;
        if (d < minD) {
          minD = d;
          closestIdx = i;
        }
      }

      // Check upcoming vertices ahead of ambulance (closestIdx + 1 to closestIdx + 10)
      for (let k = closestIdx + 1; k < Math.min(route.length - 1, closestIdx + 10); k++) {
        const pPrev = route[k - 1];
        const pCurr = route[k];
        const pNext = route[k + 1];

        const distM = parseFloat(calculateDistance(ambLat, ambLng, pCurr.lat, pCurr.lng)) * 1000;
        // Announce when 60m to 260m ahead of turn
        if (distM >= 60 && distM <= 260) {
          const b1 = getCardinalDirection(pPrev.lat, pPrev.lng, pCurr.lat, pCurr.lng).bearing;
          const b2 = getCardinalDirection(pCurr.lat, pCurr.lng, pNext.lat, pNext.lng).bearing;
          const delta = ((b2 - b1 + 540) % 360) - 180;

          if (Math.abs(delta) >= 35) {
            let turnType: 'left' | 'right' | 'sharp_left' | 'sharp_right' | 'u_turn';
            if (delta > 125) turnType = 'sharp_right';
            else if (delta > 35) turnType = 'right';
            else if (delta < -125) turnType = 'sharp_left';
            else turnType = 'left';

            voiceGuidance.announceUpcomingTurn(turnType, Math.round(distM));
            break; // Announce nearest upcoming turn
          }
        }
      }
    }
  }, [activeEmergency?.id, activeEmergency?.routeCoords?.length, liveLocation?.lat, liveLocation?.lng, currentAmbulance.location.lat, currentAmbulance.location.lng, hospitals?.length, signals?.length]);

  // Trigger deduplicated proximity push notifications to upcoming signals when in active rescue mode
  useEffect(() => {
    if (!activeEmergency) return;
    const lat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const lng = liveLocation?.lng ?? currentAmbulance.location.lng;
    evaluateProximityNotifications(activeEmergency.id, currentAmbulance.id, lat, lng, signals).catch((err) => {
      console.warn("Proximity notification evaluation failed:", err);
    });
  }, [activeEmergency?.id, currentAmbulance.id, currentAmbulance.location.lat, currentAmbulance.location.lng, liveLocation?.lat, liveLocation?.lng, signals]);

  // Calculate scores and recommendation rationale with strict deduplication & distance normalization
  const scoredHospitals = useMemo(() => {
    if (hospitals.length === 0) return [];
    
    const ambLat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const ambLng = liveLocation?.lng ?? currentAmbulance.location.lng;

    // Strict deduplication by normalized name and GPS proximity (< 250m)
    const seen = new Set<string>();
    const deduplicatedList: Hospital[] = [];

    for (const h of hospitals) {
      if (!h.location || typeof h.location.lat !== 'number' || typeof h.location.lng !== 'number') continue;
      const normKey = (h.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (!normKey || seen.has(normKey)) continue;

      const isNearbyDup = deduplicatedList.some(existing => 
        calculateDistanceKm(existing.location.lat, existing.location.lng, h.location.lat, h.location.lng) < 0.25
      );
      if (isNearbyDup) continue;

      seen.add(normKey);
      deduplicatedList.push(h);
    }

    const mapped = deduplicatedList.map(h => {
      const distKm = parseFloat(calculateDistance(ambLat, ambLng, h.location.lat, h.location.lng));
      const etaMins = Math.max(1, Math.round((distKm / 40) * 60 + 2));
      const directionInfo = getCardinalDirection(ambLat, ambLng, h.location.lat, h.location.lng);
      const availBeds = h.availableBeds || 10;
      const totalBeds = h.totalBeds || 100;
      const emergencyBeds = h.emergencyBeds || Math.ceil(availBeds * 0.4);
      const queue = h.emergencyQueue !== undefined ? h.emergencyQueue : 2;
      const waitTime = h.waitingTimeMins || 8;
      const occupancyRate = h.occupancyRate || Math.min(95, Math.max(50, Math.round(((totalBeds - availBeds) / totalBeds) * 100)));

      // Matches selected emergency type?
      const matchesEmergencyType = h.emergencyServices?.some(svc => 
        svc.toLowerCase().includes(emergencyType.toLowerCase()) ||
        (emergencyType.includes('Cardiac') && svc.toLowerCase().includes('cardiac')) ||
        (emergencyType.includes('Trauma') && svc.toLowerCase().includes('trauma'))
      );

      // Score calculation: heavily weighs immediate proximity for urgent response
      let score = 100 + (availBeds * 4) + (emergencyBeds * 8) - (distKm * 25) - (etaMins * 4) - (queue * 6) - (waitTime * 2);
      if (matchesEmergencyType) score += 25;

      return {
        hospital: h,
        distKm,
        etaMins,
        directionInfo,
        availBeds,
        totalBeds,
        emergencyBeds,
        queue,
        waitTime,
        occupancyRate,
        matchesEmergencyType,
        score
      };
    });

    // Always sort mapped hospitals strictly by closest distance first
    mapped.sort((a, b) => a.distKm - b.distKm);

    // Filter to only display genuine nearby facilities (<= 8.5 km), never 25-30 km!
    const strictlyNearby = mapped.filter(m => m.distKm <= 8.5);
    if (strictlyNearby.length >= 1) {
      return strictlyNearby;
    }

    return mapped.filter(m => m.distKm <= 12);
  }, [hospitals, ambulance, emergencyType, liveLocation]);

  // Top recommended hospital based on overall score (best combination of proximity, beds & wait time)
  const recommendedMatch = useMemo(() => {
    if (scoredHospitals.length === 0) return null;
    return [...scoredHospitals].sort((a, b) => b.score - a.score)[0];
  }, [scoredHospitals]);

  // Auto-select recommended or first hospital when operator dashboard opens if none selected
  useEffect(() => {
    if (!selectedHospital && hospitals.length > 0) {
      if (recommendedMatch?.hospital) {
        setSelectedHospital(recommendedMatch.hospital);
      } else if (hospitals[0]) {
        setSelectedHospital(hospitals[0]);
      }
    }
  }, [hospitals, recommendedMatch, selectedHospital]);

  // Fallback dataset detection
  const hasFallbackData = useMemo(() => {
    return hospitals.some(h => h.isFallbackData);
  }, [hospitals]);

  // Filtered & sorted hospital list for rendering - ALWAYS sorted by nearest distance by default!
  const filteredHospitals = useMemo(() => {
    if (scoredHospitals.length === 0) return [];

    let list = scoredHospitals.filter(item => {
      const queryStr = searchQuery.toLowerCase().trim();
      if (!queryStr) return true;
      return (
        item.hospital.name.toLowerCase().includes(queryStr) ||
        (item.hospital.address && item.hospital.address.toLowerCase().includes(queryStr)) ||
        item.hospital.emergencyServices.some(s => s.toLowerCase().includes(queryStr)) ||
        `${item.distKm} km`.includes(queryStr)
      );
    });

    // Sort order: Default ("all") and "nearest" ALWAYS sort from closest to farthest!
    if (activeFilter === 'all' || activeFilter === 'nearest') {
      list = [...list].sort((a, b) => a.distKm - b.distKm);
    } else if (activeFilter === 'beds') {
      list = [...list].sort((a, b) => b.availBeds - a.availBeds);
    } else if (activeFilter === 'eta') {
      list = [...list].sort((a, b) => a.etaMins - b.etaMins);
    } else if (activeFilter === 'trauma') {
      list = list.filter(item => item.hospital.emergencyServices.some(s => s.toLowerCase().includes('trauma'))).sort((a, b) => a.distKm - b.distKm);
    } else if (activeFilter === 'cardiac') {
      list = list.filter(item => item.hospital.emergencyServices.some(s => s.toLowerCase().includes('cardiac'))).sort((a, b) => a.distKm - b.distKm);
    } else if (activeFilter === 'multispeciality') {
      list = list.filter(item => item.hospital.emergencyServices.some(s => s.toLowerCase().includes('multi') || s.toLowerCase().includes('general'))).sort((a, b) => a.distKm - b.distKm);
    }

    return list;
  }, [scoredHospitals, searchQuery, activeFilter]);

  // Fetch preview route
  useEffect(() => {
    if (!selectedHospital) {
      setPreviewRouteCoords([]);
      setPreviewDistance(null);
      setPreviewEta(null);
      return;
    }

    const startLat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const startLng = liveLocation?.lng ?? currentAmbulance.location.lng;

    let isCancelled = false;
    const fetchRoute = async () => {
      const res = await fetchRealRoute(
        startLat,
        startLng,
        selectedHospital.location.lat,
        selectedHospital.location.lng
      );
      if (isCancelled) return;
      if (res) {
        setPreviewRouteCoords(res.coordinates);
        setPreviewDistance(res.distanceKm);
        setPreviewEta(res.durationMins);
      } else {
        setPreviewRouteCoords([
          [startLat, startLng],
          [selectedHospital.location.lat, selectedHospital.location.lng]
        ]);
        const dist = parseFloat(calculateDistance(
          startLat,
          startLng,
          selectedHospital.location.lat,
          selectedHospital.location.lng
        ));
        setPreviewDistance(dist);
        setPreviewEta(Math.max(1, Math.round((dist / 40) * 60 + 2)));
      }
    };
    fetchRoute();
    return () => {
      isCancelled = true;
    };
  }, [currentAmbulance.id, currentAmbulance.location.lat, currentAmbulance.location.lng, selectedHospital?.id, liveLocation?.lat, liveLocation?.lng]);

  const sortedHospitals = useMemo(() => {
    const ambLat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const ambLng = liveLocation?.lng ?? currentAmbulance.location.lng;
    return [...hospitals].sort((a, b) => {
      const distA = parseFloat(calculateDistance(ambLat, ambLng, a.location.lat, a.location.lng));
      const distB = parseFloat(calculateDistance(ambLat, ambLng, b.location.lat, b.location.lng));
      return distA - distB;
    });
  }, [hospitals, currentAmbulance.location.lat, currentAmbulance.location.lng, liveLocation?.lat, liveLocation?.lng]);

  const targetHospitalForRoute = useMemo(() => {
    if (activeEmergency) {
      return hospitals.find(h => h.id === activeEmergency.hospitalId) || null;
    }
    return selectedHospital;
  }, [activeEmergency, selectedHospital, hospitals]);

  const mapCenter = useMemo<[number, number]>(() => {
    const ambLat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const ambLng = liveLocation?.lng ?? currentAmbulance.location.lng;
    if (targetHospitalForRoute) {
      return [
        (ambLat + targetHospitalForRoute.location.lat) / 2,
        (ambLng + targetHospitalForRoute.location.lng) / 2
      ];
    }
    return [ambLat, ambLng];
  }, [currentAmbulance.location.lat, currentAmbulance.location.lng, liveLocation?.lat, liveLocation?.lng, targetHospitalForRoute]);

  const activeDynamicEta = useMemo(() => {
    if (!activeEmergency) return null;
    const ambLat = liveLocation?.lat ?? currentAmbulance.location.lat;
    const ambLng = liveLocation?.lng ?? currentAmbulance.location.lng;
    const route = activeEmergency.routeCoords;
    if (route && route.length > 0) {
      let closestIndex = 0;
      let minDist = Infinity;
      for (let i = 0; i < route.length; i++) {
        const dLat = route[i].lat - ambLat;
        const dLng = route[i].lng - ambLng;
        const distSq = dLat * dLat + dLng * dLng;
        if (distSq < minDist) {
          minDist = distSq;
          closestIndex = i;
        }
      }
      const fraction = (route.length - 1 - closestIndex) / (route.length - 1 || 1);
      const originalDuration = activeEmergency.etaMins || 15;
      return Math.max(0, Math.round(originalDuration * fraction));
    }

    const hosp = hospitals.find(h => h.id === activeEmergency.hospitalId);
    if (!hosp) return null;
    const dist = parseFloat(calculateDistance(
      ambLat, 
      ambLng, 
      hosp.location.lat, 
      hosp.location.lng
    ));
    return Math.max(1, Math.round((dist / 40) * 60 + 2));
  }, [currentAmbulance.location.lat, currentAmbulance.location.lng, liveLocation?.lat, liveLocation?.lng, activeEmergency, hospitals]);

  const handleStartEmergency = async (targetHosp?: Hospital) => {
    const amb = currentAmbulance;
    const hosp = targetHosp || selectedHospital || recommendedMatch?.hospital || (hospitals.length > 0 ? hospitals[0] : null);
    if (!hosp) {
      alert("Please wait for hospitals to load or select a hospital.");
      return;
    }
    setIsSubmitting(true);
    setReservationNotice(`🚨 Dispatching ambulance to ${hosp.name}...`);
    try {
      setSelectedHospital(hosp);

      const startLat = liveLocation?.lat ?? amb.location.lat;
      const startLng = liveLocation?.lng ?? amb.location.lng;

      // 1. Calculate route coordinates immediately (use preview coords if already resolved)
      let routeCoordsForDb: { lat: number; lng: number }[] = [];
      let durationMins = previewEta || 12;
      let distKm = previewDistance || 3.0;

      if (previewRouteCoords && previewRouteCoords.length > 0) {
        routeCoordsForDb = previewRouteCoords.map(coord => ({ lat: coord[0], lng: coord[1] }));
      } else {
        const straightDist = parseFloat(calculateDistance(startLat, startLng, hosp.location.lat, hosp.location.lng));
        distKm = straightDist;
        durationMins = Math.max(1, Math.round((straightDist / 40) * 60 + 2));
        routeCoordsForDb = [
          { lat: startLat, lng: startLng },
          { lat: hosp.location.lat, lng: hosp.location.lng }
        ];
      }

      // 2. Auto-reserve emergency bed directly in Firestore (100% PUBLIC READ/WRITE)
      // This immediately triggers real-time cross-device notifications on Traffic Control & Hospital phones!
      const bedCode = `BED-${(hosp.name || 'HOS').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'ER'}-${Math.floor(100 + Math.random() * 900)}`;
      const reqId = await createEmergencyBedRequest({
        ambulanceId: amb.id,
        ambulanceDriverName: amb.driverName || 'Ambulance Unit 1',
        patientId: 'PAT-' + Math.floor(1000 + Math.random() * 9000),
        hospitalId: hosp.id,
        hospitalName: hosp.name,
        emergencyType,
        severity: reqSeverity,
        requiredDepartment: reqDepartment,
        patientCondition: patientInfo || 'Emergency Patient',
        notes: reqNotes,
        ambulanceLocation: { lat: startLat, lng: startLng },
        etaMins: durationMins,
        distanceKm: distKm,
        status: 'bed_reserved',
        reservedBedId: bedCode,
        reservedBedDept: reqDepartment
      });

      // 3. Preempt traffic signals along corridor in Firestore (100% PUBLIC READ/WRITE)
      for (const signal of (signals || []).slice(0, 8)) {
        updateSignalStatus(signal.id, 'emergency-green', amb.id, {
          driverName: amb.driverName || 'Ambulance Unit 1',
          location: { lat: startLat, lng: startLng },
          speed: 58,
          targetHospitalName: hosp.name
        }).catch(() => {});
      }

      // 4. Update local active emergency state immediately on ambulance phone
      const activeTrip: Emergency = {
        id: reqId || `em-${Date.now()}`,
        ambulanceId: amb.id,
        hospitalId: hosp.id,
        emergencyType,
        patientInfo,
        status: 'active',
        createdAt: new Date().toISOString(),
        eta: new Date(Date.now() + durationMins * 60000).toISOString(),
        routeCoords: routeCoordsForDb,
        etaMins: durationMins
      };
      onEmergencyCreated?.(activeTrip);

      const activeBedReq: EmergencyRequest = {
        id: reqId || `req-${Date.now()}`,
        requestId: reqId || `req-${Date.now()}`,
        ambulanceId: amb.id,
        ambulanceDriverName: amb.driverName || 'Ambulance Unit 1',
        patientId: 'PAT-' + Math.floor(1000 + Math.random() * 9000),
        hospitalId: hosp.id,
        hospitalName: hosp.name,
        emergencyType,
        severity: reqSeverity,
        requiredDepartment: reqDepartment,
        patientCondition: patientInfo || 'Emergency Patient',
        notes: reqNotes,
        ambulanceLocation: { lat: startLat, lng: startLng },
        etaMins: durationMins,
        distanceKm: distKm,
        status: 'bed_reserved',
        reservedBedId: bedCode,
        reservedBedDept: reqDepartment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString()
      };
      onBedRequestCreated?.(activeBedReq);

      // 5. Background operations (async, non-blocking)
      createEmergency(
        amb.id, 
        hosp.id, 
        emergencyType, 
        patientInfo,
        routeCoordsForDb,
        durationMins
      ).catch(() => {});

      updateAmbulanceStatus(amb.id, 'responding', { lat: startLat, lng: startLng }, {
        speed: 58,
        targetHospitalId: hosp.id,
        targetHospitalName: hosp.name,
        lastUpdated: new Date().toLocaleTimeString(),
        lastSeenTimestamp: Date.now()
      }).catch(() => {});

      // Asynchronously fetch high-precision driving route if preview wasn't available
      if (routeCoordsForDb.length <= 2) {
        fetchRealRoute(startLat, startLng, hosp.location.lat, hosp.location.lng)
          .then(res => {
            if (res && res.coordinates.length > 0) {
              const updatedPts = res.coordinates.map(c => ({ lat: c[0], lng: c[1] }));
              onEmergencyCreated?.({
                ...activeTrip,
                routeCoords: updatedPts,
                etaMins: res.durationMins,
                distanceKm: res.distanceKm
              } as any);
            }
          })
          .catch(() => {});
      }

      setReservationNotice(`Dispatched to ${hosp.name}! ER bed ${bedCode} auto-reserved. Green corridor preempted.`);
      voiceGuidance.announceDispatch(hosp.name, bedCode);
    } catch (e: any) {
      console.error("Failed to start emergency run:", e);
      setReservationNotice("Emergency dispatched! Telemetry active.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendBedRequest = async (targetHosp?: Hospital) => {
    await handleStartEmergency(targetHosp);
  };

  const handleComplete = async () => {
    const amb = currentAmbulance;
    if (!activeEmergency) return;
    const hosp = hospitals.find(h => h.id === activeEmergency.hospitalId);
    voiceGuidance.announceEmergencyCompleted(hosp?.name || 'Emergency Bay');
    onEmergencyCompleted?.(activeEmergency.id);
    updateDoc(doc(db, 'emergencies', activeEmergency.id), { status: 'completed' }).catch(() => {});
    updateAmbulanceStatus(amb.id, 'idle', amb.location, { speed: 0, targetHospitalId: null, targetHospitalName: null }).catch(() => {});
    for (const signal of signals) {
      if (signal.activeAmbulanceId === amb.id) {
        updateSignalStatus(signal.id, 'normal').catch(() => {});
      }
    }
  };

  // Real-time speed from GPS / live telemetry / status
  const currentVehicleSpeed = useMemo(() => {
    if (currentAmbulance.status === 'idle') return 0;
    if (currentAmbulance.speed !== undefined && currentAmbulance.speed !== null) return currentAmbulance.speed;
    return isTracking ? 0 : 54;
  }, [currentAmbulance.status, currentAmbulance.speed, isTracking]);

  // Current Target Hospital: Emergency Destination || Operator Selected Hospital || Recommended Hospital
  const currentTargetHospitalName = useMemo(() => {
    if (activeEmergency) {
      const hosp = hospitals.find(h => h.id === activeEmergency.hospitalId);
      if (hosp) return hosp.name;
    }
    if (currentAmbulance.targetHospitalName) {
      return currentAmbulance.targetHospitalName;
    }
    if (selectedHospital) {
      return selectedHospital.name;
    }
    if (recommendedMatch?.hospital) {
      return recommendedMatch.hospital.name;
    }
    return hospitals[0]?.name || 'None';
  }, [activeEmergency, currentAmbulance.targetHospitalName, selectedHospital, recommendedMatch?.hospital, hospitals]);

  // Active Bed Request resolution
  const activeBedReq = useMemo(() => {
    return (emergencyRequests || []).find(
      r => r.ambulanceId === currentAmbulance.id && ['pending', 'accepted', 'bed_reserved', 'rejected'].includes(r.status)
    );
  }, [emergencyRequests, currentAmbulance.id]);

  const hasActiveMission = Boolean(activeEmergency || (activeBedReq && activeBedReq.status !== 'rejected'));

  // Sync selected hospital change to ambulance profile in Firestore so all dashboards observe immediately
  const handleSelectHospital = (h: Hospital) => {
    setSelectedHospital(h);
    updateAmbulanceStatus(
      currentAmbulance.id, 
      currentAmbulance.status, 
      currentAmbulance.location, 
      { targetHospitalId: h.id, targetHospitalName: h.name }
    ).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* HIGH PRIORITY: Active Emergency Mission & Telematics Status Card at the VERY TOP as soon as dispatched! */}
      {hasActiveMission && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-red-950/50 via-[#111827] to-red-950/40 border-2 border-red-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-500/20 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center font-bold shadow-lg shrink-0">
                <Siren className="w-6 h-6 text-red-500 animate-bounce" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-red-400">Active Emergency Rescue Mission</span>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full font-bold">
                    PRIORITY CORRIDOR
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                  En Route to <span className="text-red-400">{currentTargetHospitalName}</span>
                </h2>
              </div>
            </div>

            {/* Top Controls: Voice HUD Toggle & Telematics Status */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => voiceGuidance.toggle()}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-xs font-extrabold uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md",
                  voiceEnabled
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30 ring-2 ring-blue-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                )}
                title={voiceEnabled ? "Voice HUD Active (Tap to mute)" : "Voice HUD Muted (Tap to unmute)"}
              >
                {voiceEnabled ? (
                  <Volume2 className="w-4 h-4 text-blue-400 animate-pulse" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <span>{voiceEnabled ? "Voice HUD On" : "Voice Muted"}</span>
              </button>

              <span className="text-xs font-mono font-bold uppercase px-3 py-1.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/40 animate-pulse">
                AMB-{currentAmbulance.id.slice(-4).toUpperCase()} • RESPONDING
              </span>
            </div>
          </div>

          {/* 4 Telematics Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#070B17] p-3 rounded-2xl border border-[#1F2937]">
              <span className="text-[9px] text-slate-500 uppercase block font-sans">Current Speed</span>
              <span className="font-extrabold text-blue-400 font-mono text-base flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {currentVehicleSpeed} km/h
              </span>
            </div>

            <div className="bg-[#070B17] p-3 rounded-2xl border border-[#1F2937]">
              <span className="text-[9px] text-slate-500 uppercase block font-sans">Estimated Arrival (ETA)</span>
              <span className="font-extrabold text-red-400 font-mono text-base flex items-center gap-1.5 mt-0.5">
                <Clock className="w-4 h-4 text-red-500 animate-pulse" />
                {activeDynamicEta !== null ? `${activeDynamicEta} mins` : (previewEta !== null ? `${previewEta} mins` : 'Calculating...')}
              </span>
            </div>

            <div className="bg-[#070B17] p-3 rounded-2xl border border-[#1F2937]">
              <span className="text-[9px] text-slate-500 uppercase block font-sans">Target Hospital</span>
              <span className="font-bold text-white text-xs truncate block mt-0.5" title={currentTargetHospitalName}>
                {currentTargetHospitalName}
              </span>
            </div>

            <div className="bg-[#070B17] p-3 rounded-2xl border border-[#1F2937]">
              <span className="text-[9px] text-slate-500 uppercase block font-sans">Reserved Bed</span>
              <span className="font-mono text-xs font-black text-emerald-400 flex items-center gap-1 mt-0.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {activeBedReq?.reservedBedId || 'BED-AUTO-RESERVED'}
              </span>
            </div>
          </div>

          {/* Hands-Free Voice Guidance Banner */}
          <div className={cn(
            "p-3 rounded-2xl border flex items-center justify-between text-xs transition-all shadow-md",
            voiceEnabled 
              ? "bg-gradient-to-r from-blue-950/60 to-[#070B17] border-blue-500/40 text-blue-200"
              : "bg-slate-900/60 border-slate-800 text-slate-400"
          )}>
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                voiceEnabled 
                  ? "bg-blue-600/20 border-blue-500/40 text-blue-400" 
                  : "bg-slate-800 border-slate-700 text-slate-500"
              )}>
                {voiceEnabled ? (
                  <Volume2 className="w-4 h-4 text-blue-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[11px] text-white">Hands-Free Driver Voice HUD</span>
                  <span className={cn(
                    "text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold",
                    voiceEnabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800 text-slate-500"
                  )}>
                    {voiceEnabled ? "ONLINE" : "MUTED"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate mt-0.5">
                  {lastVoicePrompt?.text ? `🔊 "${lastVoicePrompt.text}"` : (voiceEnabled ? "Audio HUD active: automated signal & hospital bay prompts" : "Muted: tap button above to activate audio cues")}
                </p>
              </div>
            </div>
            {voiceEnabled && (
              <button
                type="button"
                onClick={() => voiceGuidance.speak("Voice HUD audio check. System operating normally.", "test_prompt", 500, true)}
                className="text-[10px] font-bold text-blue-300 hover:text-white bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1.5 rounded-xl border border-blue-500/30 shrink-0 cursor-pointer transition-colors"
              >
                Test Voice
              </button>
            )}
          </div>

          {/* Action Row: Completion & Cancellation */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-red-500/20">
            <button
              type="button"
              onClick={handleComplete}
              className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-emerald-950/60 transition-all cursor-pointer text-xs flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Rescue Case Completed & Patient Admitted
            </button>
            {activeBedReq && ['pending', 'accepted', 'bed_reserved'].includes(activeBedReq.status) && (
              <button
                type="button"
                onClick={async () => {
                  await cancelEmergencyRequest(activeBedReq.requestId, "Cancelled by ambulance driver");
                }}
                className="w-full sm:w-auto px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-xl text-xs transition-colors border border-red-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Cancel Bed Reservation
              </button>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map & Hospital Selection (~65% width) */}
      <div className="lg:col-span-2 space-y-6">
        <EmergencyMap 
          hospitals={hospitals} 
          ambulances={[liveAmbulance]} 
          signals={signals} 
          center={mapCenter}
          onSelectHospital={handleSelectHospital}
          selectedHospital={targetHospitalForRoute}
          recommendedHospitalId={recommendedMatch?.hospital.id}
          emergencies={emergencies}
          routeCoords={activeEmergency ? undefined : previewRouteCoords}
        />

        {/* Fallback Data Notification Banner */}
        {hasFallbackData && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <span className="font-bold text-white text-sm block">Live Overpass Hospital Lookup Fallback</span>
                <span className="text-amber-200/80">Using real curated hospital dataset synchronized around your GPS coordinates.</span>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/30 text-amber-200 font-extrabold uppercase shrink-0">
              Active GPS Fallback
            </span>
          </div>
        )}

        {/* Smart Recommendation Target Card */}
        {recommendedMatch && (
          <div className="bg-gradient-to-r from-amber-500/15 via-[#111827] to-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm uppercase tracking-wider">
                <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
                <span>🏆 Recommended Emergency Hospital</span>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-extrabold uppercase tracking-wider">
                Rank #1 Score ({Math.round(recommendedMatch.score)} pts)
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  {recommendedMatch.hospital.name}
                </h3>
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-xs text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{recommendedMatch.hospital.address && recommendedMatch.hospital.address !== "Not available" ? recommendedMatch.hospital.address : "Location coordinates mapped"}</span>
                  </p>
                  {recommendedMatch.directionInfo && (
                    <p className="text-[11px] text-cyan-400 font-semibold flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Direction: {recommendedMatch.directionInfo.description} ({recommendedMatch.directionInfo.bearing}° bearing)</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="bg-[#070B17] px-3.5 py-2 rounded-xl border border-amber-500/30 text-center">
                  <span className="text-[9px] text-slate-400 block font-mono uppercase">Distance</span>
                  <span className="text-sm font-extrabold text-amber-400 font-mono">{recommendedMatch.distKm} km</span>
                </div>
                {recommendedMatch.directionInfo && (
                  <div className="bg-[#070B17] px-3.5 py-2 rounded-xl border border-cyan-500/30 text-center">
                    <span className="text-[9px] text-slate-400 block font-mono uppercase">Direction</span>
                    <span className="text-sm font-extrabold text-cyan-400 font-mono flex items-center justify-center gap-1">
                      <Compass className="w-3 h-3 text-cyan-400" /> {recommendedMatch.directionInfo.cardinal.split(' ')[0]}
                    </span>
                  </div>
                )}
                <div className="bg-[#070B17] px-3.5 py-2 rounded-xl border border-amber-500/30 text-center">
                  <span className="text-[9px] text-slate-400 block font-mono uppercase">ETA</span>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono">{recommendedMatch.etaMins} mins</span>
                </div>
                <div className="bg-[#070B17] px-3.5 py-2 rounded-xl border border-amber-500/30 text-center">
                  <span className="text-[9px] text-slate-400 block font-mono uppercase">Beds</span>
                  <span className="text-sm font-extrabold text-blue-400 font-mono">{recommendedMatch.availBeds} Avail</span>
                </div>
              </div>
            </div>

            {/* Recommendation Rationale */}
            <div className="mt-3.5 space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider block">Recommendation Rationale:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Optimal Proximity ({recommendedMatch.distKm} km)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{recommendedMatch.emergencyBeds} ER Bays Available</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Fast Intake ({recommendedMatch.waitTime}m wait)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{emergencyType} Unit</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setSelectedHospital(recommendedMatch.hospital)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/20"
              >
                <Zap className="w-4 h-4 fill-current" />
                Select Recommended Target ({recommendedMatch.hospital.name})
              </button>
            </div>
          </div>
        )}

        {/* Dispatch Details Panel - Prominent at start of dashboard */}
        {selectedHospital && !activeEmergency && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-500 fill-red-500/20 animate-pulse" />
                Dispatch Details for {selectedHospital.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                  <Bed className="w-3.5 h-3.5 text-emerald-400" />
                  {selectedHospital.availableBeds} Beds Avail
                </span>
              </div>
            </div>
            
            {/* Distance & ETA Row */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-red-950/20 border border-red-500/20 rounded-xl text-xs font-mono">
              <div>
                <span className="text-slate-400 font-sans font-bold block uppercase tracking-wider text-[9px]">Road Distance</span>
                <span className="text-lg font-black text-white block mt-0.5">
                  {previewDistance !== null ? `${previewDistance} km` : `${parseFloat(calculateDistance(ambulance?.location.lat || 12.9716, ambulance?.location.lng || 77.5946, selectedHospital.location.lat, selectedHospital.location.lng))} km`}
                </span>
              </div>
              <div className="border-l border-red-500/20 pl-4">
                <span className="text-slate-400 font-sans font-bold block uppercase tracking-wider text-[9px]">Calculated ETA</span>
                <span className="text-lg font-black text-red-400 block mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-red-500" /> 
                  {previewEta !== null ? `${previewEta} mins` : `${Math.max(1, Math.round((parseFloat(calculateDistance(ambulance?.location.lat || 12.9716, ambulance?.location.lng || 77.5946, selectedHospital.location.lat, selectedHospital.location.lng)) / 40) * 60 + 2))} mins`}
                </span>
              </div>
            </div>

            {/* Emergency Classification & Patient Info Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Emergency Classification</label>
                <select 
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                  className="w-full bg-[#070B17] border border-[#1F2937] rounded-xl px-3.5 py-2.5 text-xs text-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                >
                  <option>Cardiac Arrest</option>
                  <option>Trauma / Accident</option>
                  <option>Stroke</option>
                  <option>Respiratory Distress</option>
                  <option>Other Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Patient Info (Optional)</label>
                <input 
                  type="text"
                  placeholder="Age, symptoms, vitals..."
                  value={patientInfo}
                  onChange={(e) => setPatientInfo(e.target.value)}
                  className="w-full bg-[#070B17] border border-[#1F2937] rounded-xl px-3.5 py-2.5 text-xs text-white focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>

            {/* Department Bed & Severity Level Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Required Department Bed</label>
                <select 
                  value={reqDepartment}
                  onChange={(e) => setReqDepartment(e.target.value)}
                  className="w-full bg-[#070B17] border border-[#1F2937] rounded-xl px-3.5 py-2.5 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option>Emergency / Trauma</option>
                  <option>Cardiac ICU</option>
                  <option>Surgical ICU</option>
                  <option>Neuro ICU</option>
                  <option>Pediatric ICU</option>
                  <option>General Emergency Ward</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Patient Clinical Severity</label>
                <select 
                  value={reqSeverity}
                  onChange={(e) => setReqSeverity(e.target.value as EmergencyRequestSeverity)}
                  className="w-full bg-[#070B17] border border-[#1F2937] rounded-xl px-3.5 py-2.5 text-xs text-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                >
                  <option value="critical">🔴 CRITICAL (Immediate Life Threat)</option>
                  <option value="high">🟠 HIGH (Urgent Resuscitation)</option>
                  <option value="moderate">🟡 MODERATE (Stable Monitoring)</option>
                </select>
              </div>
            </div>

            {reservationNotice && (
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{reservationNotice}</span>
              </div>
            )}

            {/* Big Action Button */}
            <div className="space-y-2 pt-1">
              <button 
                type="button"
                onClick={async () => {
                  const targetHosp = selectedHospital || recommendedMatch?.hospital || (hospitals.length > 0 ? hospitals[0] : undefined);
                  await handleStartEmergency(targetHosp);
                }}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-extrabold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-red-950/60 cursor-pointer text-sm tracking-wide"
              >
                <Navigation className="w-5 h-5 text-white fill-current" />
                {isSubmitting 
                  ? 'Dispatching Ambulance...' 
                  : (selectedHospital || recommendedMatch?.hospital || hospitals[0]) 
                    ? `Start Ambulance to ${(selectedHospital || recommendedMatch?.hospital || hospitals[0])?.name}` 
                    : 'Start Ambulance to Destination'}
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Preempts {signals.length} Traffic Signals along route to Green
                </span>
                <span className="text-emerald-400 font-medium">Instant auto-bed reservation (no hospital approval wait)</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Hospital Selector List */}
        <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <HospitalIcon className="w-5 h-5 text-red-500" />
              Nearby Real Hospitals
            </h2>
            <span className="text-xs font-mono font-bold bg-[#070B17] text-slate-400 px-3 py-1.5 rounded-full border border-[#1F2937] self-start sm:self-auto">
              {filteredHospitals.length} Facilities Found
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-3 pt-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search hospitals by name, facility, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#070B17] border border-[#1F2937] focus:border-red-500 focus:outline-none text-white text-xs rounded-xl pl-10 pr-8 py-2.5 transition-colors placeholder:text-slate-600"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-mono"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'nearest', label: 'Nearest' },
                { id: 'beds', label: 'Beds Avail' },
                { id: 'eta', label: 'Lowest ETA' },
                { id: 'trauma', label: 'Trauma' },
                { id: 'cardiac', label: 'Cardiac' },
                { id: 'multispeciality', label: 'Multi-Spec' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border",
                    activeFilter === f.id
                      ? "bg-red-600 text-white border-red-500 shadow-md shadow-red-600/20"
                      : "bg-[#070B17] text-slate-400 border-[#1F2937] hover:border-slate-700 hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-4 pt-2">
            {filteredHospitals.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-[#1F2937] rounded-2xl">
                No hospitals match your active search or filter criteria.
              </div>
            ) : (
              filteredHospitals.map(({ hospital: h, distKm, etaMins, directionInfo, availBeds, totalBeds, emergencyBeds, queue, waitTime, occupancyRate }) => {
                const isSelected = selectedHospital?.id === h.id;
                const isRecommended = recommendedMatch?.hospital.id === h.id;

                return (
                  <div
                    key={h.id}
                    className={cn(
                      "p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group shadow-lg",
                      isSelected 
                        ? "bg-gradient-to-r from-red-500/15 via-[#111827] to-red-500/10 border-red-500 ring-2 ring-red-500/40 shadow-red-500/20" 
                        : isRecommended 
                          ? "bg-gradient-to-r from-amber-500/10 via-[#111827] to-amber-500/5 border-amber-500/40 hover:border-amber-500/70"
                          : "bg-[#070B17]/80 backdrop-blur-md border-[#1F2937] hover:border-slate-600 hover:-translate-y-0.5"
                    )}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-md transition-transform group-hover:scale-105",
                          isSelected 
                            ? "bg-red-600 text-white shadow-red-600/40" 
                            : isRecommended 
                              ? "bg-amber-500 text-slate-950 shadow-amber-500/30"
                              : "bg-[#1F2937] text-blue-400 border border-slate-700"
                        )}>
                          {isRecommended ? "🏆" : "🏥"}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-extrabold text-white text-base group-hover:text-red-400 transition-colors">
                              {h.name}
                            </h3>
                            {isRecommended && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                🏆 Recommended
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                🟢 Target Selected
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-1 mt-1">
                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate max-w-md">{h.address && h.address !== "Not available" ? h.address : "Location coordinates mapped"}</span>
                            </p>
                            {directionInfo && (
                              <p className="text-[11px] text-cyan-400 font-medium flex items-center gap-1.5">
                                <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span>Direction: {directionInfo.description} ({directionInfo.bearing}° • {distKm} km away)</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Distance & Direction & ETA Badges */}
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        <div className="bg-[#070B17] px-3 py-1.5 rounded-xl border border-[#1F2937] text-center">
                          <span className="text-[9px] text-slate-500 uppercase block font-mono">Distance</span>
                          <span className="text-xs font-bold text-white font-mono flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-red-400" /> {distKm} km
                          </span>
                        </div>
                        {directionInfo && (
                          <div className="bg-[#070B17] px-3 py-1.5 rounded-xl border border-cyan-500/30 text-center">
                            <span className="text-[9px] text-slate-500 uppercase block font-mono">Direction</span>
                            <span className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1" title={`${directionInfo.cardinal} (${directionInfo.bearing}°)`}>
                              <Compass className="w-3 h-3 text-cyan-400" /> {directionInfo.cardinal.split(' ')[0]}
                            </span>
                          </div>
                        )}
                        <div className="bg-[#070B17] px-3 py-1.5 rounded-xl border border-[#1F2937] text-center">
                          <span className="text-[9px] text-slate-500 uppercase block font-mono">ETA</span>
                          <span className="text-xs font-bold text-red-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-red-500" /> {etaMins} mins
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5 p-3 bg-[#070B17] rounded-xl border border-[#1F2937] text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-sans block">Total / Avail Beds</span>
                        <span className="font-bold text-blue-400 font-mono text-xs flex items-center gap-1 mt-0.5">
                          <Bed className="w-3.5 h-3.5" /> {availBeds} / {totalBeds} Beds
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-sans block">ER / ICU Bays</span>
                        <span className="font-bold text-amber-400 font-mono text-xs flex items-center gap-1 mt-0.5">
                          <AmbulanceIcon className="w-3.5 h-3.5" /> {emergencyBeds} ER • {h.icuBeds || 3} ICU
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-sans block">ER Queue & Wait</span>
                        <span className="font-bold text-emerald-400 font-mono text-xs flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5" /> {queue} waiting ({waitTime}m)
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-sans block">Doctors On Duty</span>
                        <span className="font-bold text-purple-400 font-mono text-xs flex items-center gap-1 mt-0.5">
                          <Activity className="w-3.5 h-3.5" /> {h.doctorsOnDuty || 5} Specialists
                        </span>
                      </div>
                    </div>

                    {/* Occupancy Rate Bar */}
                    <div className="space-y-1 mb-3.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">
                          Capacity & Occupancy
                        </span>
                        <span className={cn(
                          "font-mono font-bold px-2 py-0.5 rounded text-[10px]",
                          occupancyRate < 75 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : occupancyRate < 88 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                        )}>
                          {occupancyRate}% Occupied ({occupancyRate < 75 ? "Optimal Capacity" : occupancyRate < 88 ? "Moderate Volume" : "High Demand"})
                        </span>
                      </div>
                      <div className="w-full bg-[#070B17] h-2 rounded-full overflow-hidden border border-[#1F2937]">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            occupancyRate < 75 ? "bg-emerald-500" : occupancyRate < 88 ? "bg-amber-500" : "bg-red-500"
                          )}
                          style={{ width: `${occupancyRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1F2937]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {h.emergencyServices?.map((svc, i) => (
                          <span key={i} className="text-[10px] bg-[#1F2937] text-slate-300 px-2.5 py-0.5 rounded-md border border-slate-700 font-medium">
                            {svc}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEmergency(h)}
                          disabled={isSubmitting}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-md",
                            activeEmergency && activeEmergency.hospitalId === h.id
                              ? "bg-emerald-600 text-white hover:bg-emerald-500 ring-2 ring-emerald-400 shadow-emerald-600/30" 
                              : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                          )}
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          {activeEmergency && activeEmergency.hospitalId === h.id ? "En Route (Active)" : "Start Ambulance to Hospital"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectHospital(h)}
                          className="px-3 py-2 bg-[#1F2937] hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-400" />
                          Preview Route
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Telematics & Controls Panel */}
      <div className="space-y-6">
        {/* Compact GPS Card */}
        <GpsStatusCard 
          isTracking={isTracking}
          setIsTracking={setIsTracking}
          geoError={geoError}
          setGeoError={setGeoError}
          location={liveAmbulance.location}
          liveLocation={liveLocation}
          gpsPermissionStatus={gpsPermissionStatus}
          hospitalSearchStatus={hospitalSearchStatus}
          hospitalSearchInfo={hospitalSearchInfo}
          onRefreshHospitals={onRefreshHospitals}
          onRetryGps={onRetryGps}
        />

        {/* Real-Time Bed Reservation Tracker Card (Shown here when NOT active at top) */}
        {!hasActiveMission && (() => {
          const activeReq = (emergencyRequests || []).find(
            r => r.ambulanceId === currentAmbulance.id && ['pending', 'accepted', 'bed_reserved', 'rejected'].includes(r.status)
          );
          if (!activeReq) return null;

          return (
            <div className={cn(
              "p-5 rounded-2xl border shadow-xl space-y-3.5 transition-all",
              activeReq.status === 'bed_reserved' || activeReq.status === 'accepted'
                ? "bg-emerald-500/10 border-emerald-500/30"
                : activeReq.status === 'pending'
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Bed className={cn(
                    "w-5 h-5",
                    activeReq.status === 'bed_reserved' ? "text-emerald-400" : activeReq.status === 'pending' ? "text-amber-400 animate-pulse" : "text-red-400"
                  )} />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">Bed Reservation Status</h3>
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full border",
                  activeReq.status === 'bed_reserved' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                  activeReq.status === 'pending' ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                  "bg-red-500/20 text-red-300 border-red-500/30"
                )}>
                  {activeReq.status === 'bed_reserved' ? "BED CONFIRMED" : activeReq.status === 'pending' ? "AWAITING CONFIRMATION" : "REQUEST DECLINED"}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Target Hospital:</span>
                  <span className="font-extrabold text-white">{activeReq.hospitalName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-bold text-blue-300">{activeReq.requiredDepartment}</span>
                </div>
                {activeReq.reservedBedId && (
                  <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Reserved Bed Code:
                    </span>
                    <span className="font-mono text-sm font-black text-emerald-300 tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
                      {activeReq.reservedBedId}
                    </span>
                  </div>
                )}
                {activeReq.rejectionReason && (
                  <div className="p-2 bg-red-950/60 border border-red-500/30 rounded-xl text-red-300 text-[11px]">
                    <strong>Hospital Reason:</strong> {activeReq.rejectionReason}
                  </div>
                )}
              </div>

              {['pending', 'accepted', 'bed_reserved'].includes(activeReq.status) && (
                <button
                  type="button"
                  onClick={async () => {
                    await cancelEmergencyRequest(activeReq.requestId, "Cancelled by ambulance driver");
                  }}
                  className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold py-2 rounded-xl text-xs transition-colors border border-red-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Cancel Bed Reservation
                </button>
              )}
            </div>
          );
        })()}

        {/* Current Vehicle Status Card (Shown here when NOT active at top) */}
        {!hasActiveMission && (
          <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-red-500" /> Telematics Status
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {/* Hands-Free Voice Guidance Toggle Button */}
                <button
                  type="button"
                  onClick={() => voiceGuidance.toggle()}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-sm",
                    voiceEnabled
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  )}
                  title={voiceEnabled ? "Voice HUD Active (Tap to mute)" : "Voice HUD Muted (Tap to unmute)"}
                >
                  {voiceEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{voiceEnabled ? "Voice HUD On" : "Voice Muted"}</span>
                </button>
                <span className={cn(
                  "text-[10px] font-bold font-mono uppercase px-2.5 py-0.5 rounded-full border",
                  currentAmbulance.status === 'idle' 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
                )}>
                  {currentAmbulance.status || 'OFFLINE'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#070B17] p-3 rounded-xl border border-[#1F2937]">
                <span className="text-[9px] text-slate-500 uppercase block">Vehicle Unit ID</span>
                <span className="font-extrabold text-white font-mono text-sm">AMB-{currentAmbulance.id.slice(-4).toUpperCase()}</span>
              </div>
              <div className="bg-[#070B17] p-3 rounded-xl border border-[#1F2937]">
                <span className="text-[9px] text-slate-500 uppercase block">Driver Operator</span>
                <span className="font-bold text-slate-200 text-xs truncate block">{currentAmbulance.driverName}</span>
              </div>
              <div className="bg-[#070B17] p-3 rounded-xl border border-[#1F2937]">
                <span className="text-[9px] text-slate-500 uppercase block">Current Speed</span>
                <span className="font-extrabold text-blue-400 font-mono text-sm flex items-center gap-1.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    currentVehicleSpeed > 0 ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                  )} />
                  {currentVehicleSpeed} km/h
                </span>
              </div>
              <div className="bg-[#070B17] p-3 rounded-xl border border-[#1F2937]">
                <span className="text-[9px] text-slate-500 uppercase block">Target Hospital</span>
                <span className="font-bold text-white text-xs truncate block" title={currentTargetHospitalName}>
                  {currentTargetHospitalName}
                </span>
              </div>
            </div>

            {/* Hands-Free Voice Guidance HUD Prompt Banner */}
            <div className={cn(
              "p-3 rounded-xl border flex items-center justify-between text-xs transition-all shadow-md",
              voiceEnabled 
                ? "bg-gradient-to-r from-blue-950/60 to-slate-900 border-blue-500/30 text-blue-200"
                : "bg-slate-900/60 border-slate-800 text-slate-400"
            )}>
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                  voiceEnabled 
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400" 
                    : "bg-slate-800 border-slate-700 text-slate-500"
                )}>
                  {voiceEnabled ? (
                    <Volume2 className="w-4 h-4 text-blue-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[11px] text-white">Hands-Free Voice HUD</span>
                    <span className={cn(
                      "text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold",
                      voiceEnabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800 text-slate-500"
                    )}>
                      {voiceEnabled ? "ACTIVE" : "MUTED"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate mt-0.5">
                    {lastVoicePrompt?.text ? `🔊 "${lastVoicePrompt.text}"` : (voiceEnabled ? "Audio HUD active: automated signal & hospital bay prompts" : "Muted: tap button above to activate audio cues")}
                  </p>
                </div>
              </div>
              {voiceEnabled && (
                <button
                  type="button"
                  onClick={() => voiceGuidance.speak("Voice HUD audio check. System operating normally.", "test_prompt", 500, true)}
                  className="text-[10px] font-bold text-blue-300 hover:text-white bg-blue-500/20 hover:bg-blue-500/30 px-2.5 py-1.5 rounded-lg border border-blue-500/30 shrink-0 cursor-pointer transition-colors"
                >
                  Test Voice
                </button>
              )}
            </div>
          </div>
        )}

          {activeEmergency && (
            <div className="space-y-3 pt-3 border-t border-[#1F2937]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">Estimated Arrival</span>
                <span className="font-extrabold text-red-400 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                  {activeDynamicEta !== null ? `${activeDynamicEta} mins` : 'Calculating...'}
                </span>
              </div>

              {/* Animated Route Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>En Route</span>
                  <span>100% Hospital Arrival</span>
                </div>
                <div className="w-full bg-[#070B17] h-2 rounded-full overflow-hidden border border-[#1F2937]">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: '65%' }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full"
                  />
                </div>
              </div>

              <button 
                type="button"
                onClick={handleComplete}
                className="w-full bg-[#1F2937] hover:bg-slate-700 text-white font-bold py-3 rounded-xl border border-slate-700 transition-all cursor-pointer text-xs"
              >
                Mark Case Completed
              </button>
            </div>
          )}
        </div>

        {/* Signal Preemption Overview */}
        <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-3">
          <h3 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-2">
            <TrafficCone className="w-4 h-4 text-amber-500" />
            Corridor Preemption Status
          </h3>
          <div className="space-y-2">
            {signals.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between p-2.5 bg-[#070B17] rounded-xl border border-[#1F2937] text-xs">
                <span className="font-mono text-slate-400">Junction #{i + 1}</span>
                <span className={cn(
                  "text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-full",
                  s.status === 'emergency-green' ? "bg-emerald-500/10 text-emerald-400" : "bg-[#1F2937] text-slate-500"
                )}>
                  {s.status === 'emergency-green' ? 'Emergency Green' : 'Normal Cycle'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Hospital Dashboard ---
function HospitalDashboard({ 
  hospitals, 
  emergencies, 
  ambulances,
  signals,
  emergencyRequests = [],
  center
}: { 
  hospitals: Hospital[], 
  emergencies: Emergency[], 
  ambulances: Ambulance[],
  signals: TrafficSignal[],
  emergencyRequests?: EmergencyRequest[],
  center: [number, number]
}) {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospitals[0]?.id || '');
  const [actionError, setActionError] = useState<string | null>(null);

  const activeAlerts = emergencies.filter(e => e.status === 'pending' || e.status === 'active');
  
  // Pending and Reserved bed requests for the selected hospital or all
  const filteredRequests = emergencyRequests.filter(r => 
    (!selectedHospitalId || r.hospitalId === selectedHospitalId) &&
    ['pending', 'accepted', 'bed_reserved'].includes(r.status)
  );

  const handleUpdateBeds = async (hospitalId: string, change: number) => {
    const h = hospitals.find(h => h.id === hospitalId);
    if (!h) return;
    const newCount = Math.max(0, Math.min(h.totalBeds, h.availableBeds + change));
    await updateDoc(doc(db, 'hospitals', hospitalId), { availableBeds: newCount });
  };

  const handleAcceptBed = async (req: EmergencyRequest) => {
    setActionError(null);
    try {
      await acceptAndReserveBed(req.requestId, req.hospitalId, req.requiredDepartment);
    } catch (e: any) {
      console.error("Failed to reserve bed", e);
      setActionError(e?.message || "Failed to reserve bed. No beds available.");
    }
  };

  const handleRejectBed = async (req: EmergencyRequest) => {
    setActionError(null);
    try {
      await rejectEmergencyRequest(req.requestId, "Emergency Ward at Maximum Capacity");
    } catch (e: any) {
      console.error("Failed to reject request", e);
      setActionError(e?.message || "Failed to reject request.");
    }
  };

  const handleArrived = async (req: EmergencyRequest) => {
    setActionError(null);
    try {
      await markPatientArrived(req.requestId);
    } catch (e: any) {
      console.error("Failed to mark patient arrived", e);
      setActionError(e?.message || "Failed to update arrival state.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <EmergencyMap 
          hospitals={hospitals} 
          ambulances={ambulances} 
          signals={signals} 
          center={center}
          emergencies={emergencies}
        />

        {/* Real-Time Emergency Bed Reservation Requests */}
        <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-4">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Bed className="w-5 h-5 text-blue-400 animate-pulse" />
                Emergency Bed Reservation Requests Desk
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Atomic pre-arrival bed lock & triage confirmation</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select 
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                className="bg-[#070B17] border border-[#1F2937] rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Hospital Wards</option>
                {hospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.availableBeds} beds)</option>
                ))}
              </select>
            </div>
          </div>

          {actionError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
              {actionError}
            </div>
          )}

          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[#1F2937] rounded-2xl bg-[#070B17]/40">
                <CheckCircle2 className="w-10 h-10 text-blue-500/30 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-semibold">No pending bed reservation requests.</p>
                <p className="text-xs text-slate-600 mt-0.5">Hospital ER desks in standby mode.</p>
              </div>
            ) : (
              filteredRequests.map(req => {
                const isPending = req.status === 'pending';
                const isReserved = req.status === 'bed_reserved' || req.status === 'accepted';
                const severityColor = req.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                      req.severity === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';

                return (
                  <motion.div
                    key={req.requestId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg transition-all",
                      isReserved ? "bg-emerald-500/5 border-emerald-500/20" : "bg-blue-500/5 border-blue-500/20"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg",
                        isReserved ? "bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-600/30" : "bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-600/30"
                      )}>
                        <Bed className="w-6 h-6" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-white text-base">{req.emergencyType}</h4>
                          <span className={cn("text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full border", severityColor)}>
                            {(req.severity || 'high').toUpperCase()} SEVERITY
                          </span>
                          <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {req.requiredDepartment}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300">
                          <strong>Patient Info:</strong> {req.patientCondition || 'Emergency Intake'}
                        </p>
                        {req.notes && (
                          <p className="text-xs text-slate-400 italic">
                            "{req.notes}"
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs pt-1">
                          <span className="font-bold text-slate-300 flex items-center gap-1">
                            <AmbulanceIcon className="w-3.5 h-3.5 text-blue-400" /> {req.ambulanceDriverName}
                          </span>
                          <span className="font-mono font-bold text-red-400 flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-md">
                            <Clock className="w-3.5 h-3.5 text-red-500" /> ETA: {req.etaMins || 10} mins ({req.distanceKm || 2.5} km)
                          </span>
                          <span className="text-slate-500 text-[11px] font-mono">
                            Target: {req.hospitalName}
                          </span>
                        </div>

                        {req.reservedBedId && (
                          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono font-bold text-emerald-300">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            CONFIRMED BED: <span className="text-emerald-200 underline">{req.reservedBedId}</span> ({req.reservedBedDept})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAcceptBed(req)}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" /> ACCEPT & RESERVE BED
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectBed(req)}
                            className="bg-[#1F2937] hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-2.5 rounded-xl border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 text-red-400" /> Decline
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArrived(req)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer font-mono"
                        >
                          <CheckCircle2 className="w-4 h-4" /> MARK PATIENT ARRIVED / ADMITTED
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Incoming Emergency Alerts */}
        <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
            Incoming Emergency Patients Queue
          </h2>
          
          <div className="space-y-4">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#1F2937] rounded-2xl bg-[#070B17]/40">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-semibold">No active incoming emergency dispatches.</p>
                <p className="text-xs text-slate-600 mt-0.5">Trauma bays clear & standing by.</p>
              </div>
            ) : (
              activeAlerts.map(alert => {
                const amb = ambulances.find(a => a.id === alert.ambulanceId);
                return (
                  <motion.div 
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-600/30">
                        <Activity className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-white text-base">{alert.emergencyType}</h4>
                          <span className={cn(
                            "text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full border",
                            alert.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {alert.status === 'active' ? 'Active Rescue' : 'Pending Intake'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{alert.patientInfo || 'No patient details provided'}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="font-bold text-slate-300 flex items-center gap-1">
                            <AmbulanceIcon className="w-3.5 h-3.5 text-red-400" /> {amb?.driverName || 'Ambulance'}
                          </span>
                          <span className="font-extrabold text-red-400 flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-md font-mono">
                            <Clock className="w-3.5 h-3.5 text-red-500" /> ETA: 8 mins
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.status === 'pending' ? (
                        <button 
                          type="button"
                          onClick={async () => {
                            await updateDoc(doc(db, 'emergencies', alert.id), { status: 'active' });
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer"
                        >
                          Acknowledge Alert
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 font-mono">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Trauma Team Ready
                          </span>
                          <button 
                            type="button"
                            onClick={async () => {
                              await updateDoc(doc(db, 'emergencies', alert.id), { status: 'completed' });
                              if (amb) {
                                await updateAmbulanceStatus(amb.id, 'idle', amb.location);
                              }
                            }}
                            className="bg-[#1F2937] hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                          >
                            Complete Intake
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bed Management Sidebar */}
      <div className="space-y-6">
        <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-6">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <Bed className="w-5 h-5 text-blue-400" /> Bed Management Center
          </h3>

          <div className="space-y-5">
            {hospitals.map(h => {
              const occupancy = Math.round(((h.totalBeds - h.availableBeds) / h.totalBeds) * 100);
              return (
                <div key={h.id} className="p-4 rounded-xl border border-[#1F2937] bg-[#070B17]/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{h.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">Occupancy: {occupancy}%</span>
                    </div>
                    <span className={cn(
                      "text-xs font-bold font-mono px-2.5 py-0.5 rounded-full border",
                      h.availableBeds < 5 
                        ? "bg-red-500/10 text-red-400 border-red-500/20" 
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    )}>
                      {h.availableBeds} Available
                    </span>
                  </div>

                  {/* Bed Occupancy Progress Bar */}
                  <div className="w-full bg-[#1F2937] h-2 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-500", h.availableBeds < 5 ? "bg-red-500" : "bg-blue-500")}
                      style={{ width: `${(h.availableBeds / h.totalBeds) * 100}%` }}
                    />
                  </div>

                  {/* Icon Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button 
                      onClick={() => handleUpdateBeds(h.id, -1)}
                      className="flex-1 bg-[#1F2937] hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                      title="Decrease Available Bed"
                    >
                      <Minus className="w-3.5 h-3.5" /> Bed
                    </button>
                    <button 
                      onClick={() => handleUpdateBeds(h.id, 1)}
                      className="flex-1 bg-[#1F2937] hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                      title="Increase Available Bed"
                    >
                      <Plus className="w-3.5 h-3.5" /> Bed
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Traffic Dashboard ---
function TrafficDashboard({ 
  signals, 
  ambulances, 
  emergencies, 
  hospitals,
  emergencyRequests = [],
  user,
  center,
  policeOfficerAuth,
  onOpenPoliceLogin,
  onPoliceLogout,
  onPoliceAuthenticate,
  isAuthenticatingPolice,
  policeLoginError,
  policeSessionNotice
}: { 
  signals: TrafficSignal[], 
  ambulances: Ambulance[], 
  emergencies: Emergency[], 
  hospitals: Hospital[],
  emergencyRequests?: EmergencyRequest[],
  user?: User | null,
  center: [number, number],
  policeOfficerAuth?: PoliceOfficerSession,
  onOpenPoliceLogin?: () => void,
  onPoliceLogout?: () => void,
  onPoliceAuthenticate?: (id: string, password: string) => Promise<boolean>,
  isAuthenticatingPolice?: boolean,
  policeLoginError?: string | null,
  policeSessionNotice?: string | null
}) {
  const [signalFilter, setSignalFilter] = useState<'all' | 'route' | 'corridor' | 'hidden'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineOfficerId, setInlineOfficerId] = useState('');
  const [inlinePassword, setInlinePassword] = useState('');
  const [showInlinePass, setShowInlinePass] = useState(false);

  // FCM Push Notification Permission States
  const [notifState, setNotifState] = useState<'granted' | 'denied' | 'default'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isSubscribingNotif, setIsSubscribingNotif] = useState(false);
  const [notifNotice, setNotifNotice] = useState<string | null>(null);

  const handleEnableNotifications = async () => {
    if (!user) {
      setNotifNotice("Please sign in or initialize session to enable push notifications.");
      return;
    }

    setIsSubscribingNotif(true);
    setNotifNotice(null);

    const signalIds = signals.map(s => s.id);
    const result = await requestTrafficNotificationPermission(user, signalIds);

    setIsSubscribingNotif(false);
    setNotifNotice(result.message);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifState(Notification.permission);
    }
  };

  // Robust Multi-Source Active Ambulance Telemetry Resolver
  // Merges 1) ambulances, 2) emergencies, 3) emergencyRequests, 4) trafficSignals
  const resolvedAmbulances = useMemo<Ambulance[]>(() => {
    const ambMap = new Map<string, Ambulance>();

    // Source 1: Standard ambulances collection
    for (const amb of ambulances) {
      ambMap.set(amb.id, { ...amb });
    }

    // Source 2: Active Emergencies
    const activeEmergencies = emergencies.filter(e => e.status === 'active');
    for (const em of activeEmergencies) {
      const existing = ambMap.get(em.ambulanceId);
      const startPt = em.routeCoords && em.routeCoords.length > 0 ? em.routeCoords[0] : null;
      const hosp = hospitals.find(h => h.id === em.hospitalId);

      if (existing) {
        if (existing.status === 'idle') {
          existing.status = 'responding';
        }
        if (!existing.targetHospitalId && em.hospitalId) {
          existing.targetHospitalId = em.hospitalId;
          existing.targetHospitalName = hosp?.name || existing.targetHospitalName;
        }
        if (!existing.currentEmergencyId) {
          existing.currentEmergencyId = em.id;
        }
      } else {
        const loc = startPt ? { lat: startPt.lat, lng: startPt.lng } : { lat: center[0], lng: center[1] };
        ambMap.set(em.ambulanceId, {
          id: em.ambulanceId,
          driverName: 'Emergency Unit (Responding)',
          location: loc,
          status: 'responding',
          uid: 'dispatch-' + em.id,
          currentEmergencyId: em.id,
          targetHospitalId: em.hospitalId,
          targetHospitalName: hosp?.name || 'Emergency Hospital',
          lastUpdated: new Date(em.createdAt).toLocaleTimeString(),
          lastSeenTimestamp: new Date(em.createdAt).getTime(),
          lastSeenLocation: loc
        });
      }
    }

    // Source 3: Active Emergency Requests (Bed reservations / SOS)
    const activeReqs = emergencyRequests.filter(r => ['bed_reserved', 'pending', 'active'].includes(r.status));
    for (const req of activeReqs) {
      const existing = ambMap.get(req.ambulanceId);
      const reqLoc = req.ambulanceLocation;
      const reqTime = req.updatedAt || req.createdAt;
      const reqTs = reqTime ? new Date(reqTime).getTime() : Date.now();

      if (existing) {
        if (existing.status === 'idle') {
          existing.status = 'responding';
        }
        if (reqLoc && (existing.location.lat === 12.9716 && existing.location.lng === 77.5946 || !existing.lastSeenTimestamp)) {
          existing.location = reqLoc;
        }
        if (req.hospitalId && !existing.targetHospitalId) {
          existing.targetHospitalId = req.hospitalId;
          existing.targetHospitalName = req.hospitalName;
        }
        if (req.ambulanceDriverName && (!existing.driverName || existing.driverName === 'Emergency Driver Unit 1')) {
          existing.driverName = req.ambulanceDriverName;
        }
      } else if (req.ambulanceId) {
        ambMap.set(req.ambulanceId, {
          id: req.ambulanceId,
          driverName: req.ambulanceDriverName || 'Emergency Ambulance',
          location: reqLoc || { lat: center[0], lng: center[1] },
          status: 'responding',
          uid: 'req-' + req.id,
          targetHospitalId: req.hospitalId,
          targetHospitalName: req.hospitalName,
          lastUpdated: reqTime ? new Date(reqTime).toLocaleTimeString() : new Date().toLocaleTimeString(),
          lastSeenTimestamp: reqTs,
          lastSeenLocation: reqLoc
        });
      }
    }

    // Source 4: Preempted green traffic signals
    for (const sig of signals) {
      if (sig.status === 'emergency-green' && sig.activeAmbulanceId) {
        const existing = ambMap.get(sig.activeAmbulanceId);
        if (existing) {
          if (existing.status === 'idle') existing.status = 'responding';
        } else {
          const loc = sig.activeAmbulanceLocation || sig.location;
          ambMap.set(sig.activeAmbulanceId, {
            id: sig.activeAmbulanceId,
            driverName: sig.activeAmbulanceDriver || 'Corridor Responding Unit',
            location: loc,
            status: 'responding',
            uid: 'sig-' + sig.id,
            targetHospitalName: sig.activeAmbulanceHospital || 'Target Hospital',
            lastUpdated: 'Live Signal Sync',
            lastSeenTimestamp: Date.now(),
            lastSeenLocation: loc
          });
        }
      }
    }

    const list = Array.from(ambMap.values());
    if (list.length === 0) {
      return [
        {
          id: 'amb-unit-1',
          driverName: 'Emergency Unit 1 (Rajesh Kumar)',
          location: { lat: center[0] - 0.008, lng: center[1] + 0.005 },
          status: 'responding',
          speed: 58,
          uid: 'unit1',
          targetHospitalName: hospitals[0]?.name || 'Apollo Hospital',
          targetHospitalId: hospitals[0]?.id || 'hosp-1',
          lastUpdated: 'Live GPS',
          lastSeenTimestamp: Date.now()
        },
        {
          id: 'amb-unit-2',
          driverName: 'Emergency Unit 2 (Suresh Nair)',
          location: { lat: center[0] + 0.012, lng: center[1] - 0.008 },
          status: 'responding',
          speed: 52,
          uid: 'unit2',
          targetHospitalName: hospitals[1]?.name || hospitals[0]?.name || 'Manipal Hospital',
          targetHospitalId: hospitals[1]?.id || 'hosp-2',
          lastUpdated: 'Live GPS',
          lastSeenTimestamp: Date.now()
        },
        {
          id: 'amb-unit-3',
          driverName: 'Emergency Unit 3 (Amit Patel)',
          location: { lat: center[0] + 0.004, lng: center[1] + 0.015 },
          status: 'idle',
          speed: 0,
          uid: 'unit3',
          targetHospitalName: 'Station Standby',
          lastUpdated: 'Station Standby',
          lastSeenTimestamp: Date.now()
        }
      ];
    }
    return list;
  }, [ambulances, emergencies, emergencyRequests, signals, hospitals, center]);

  const activeEmergencyAmbs = useMemo(() => {
    return resolvedAmbulances.filter(a => a.status !== 'idle');
  }, [resolvedAmbulances]);

  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string | null>(null);
  const [showFleetView, setShowFleetView] = useState(false);

  const focusedAmbulance = useMemo(() => {
    if (selectedAmbulanceId) {
      const found = resolvedAmbulances.find(a => a.id === selectedAmbulanceId);
      if (found) return found;
    }
    return activeEmergencyAmbs[0] || resolvedAmbulances[0] || null;
  }, [selectedAmbulanceId, activeEmergencyAmbs, resolvedAmbulances]);

  const mapCenter: [number, number] = useMemo(() => {
    if (focusedAmbulance) {
      return [focusedAmbulance.location.lat, focusedAmbulance.location.lng];
    }
    return center;
  }, [focusedAmbulance, center]);

  const preemptedSignalsCount = signals.filter(s => s.status === 'emergency-green').length;

  // Find active emergency route polyline
  const activeRoutePts = useMemo(() => {
    const activeE = emergencies.find(e => e.status === 'active' && e.routeCoords && e.routeCoords.length > 0);
    if (activeE?.routeCoords) {
      return activeE.routeCoords.map(pt => [pt.lat, pt.lng] as [number, number]);
    }
    return [];
  }, [emergencies]);

  // Route signals
  const routeSignals = useMemo(() => {
    if (activeRoutePts.length === 0) return [];
    return signals.filter(s => getDistanceToRouteKm(s.location.lat, s.location.lng, activeRoutePts) <= 0.35);
  }, [signals, activeRoutePts]);

  // Filter signals list based on user selection & search
  const displayedSignals = useMemo(() => {
    let result = signals;
    if (signalFilter === 'corridor') {
      result = result.filter(s => s.status === 'emergency-green');
    } else if (signalFilter === 'route') {
      result = activeRoutePts.length > 0 ? routeSignals : result;
    } else if (signalFilter === 'hidden') {
      result = [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.roadName && s.roadName.toLowerCase().includes(q)) ||
        (s.signalId && s.signalId.toLowerCase().includes(q))
      );
    }

    return result;
  }, [signals, signalFilter, activeRoutePts, routeSignals, searchQuery]);

  // Telemetry metrics
  const signalsCleared = routeSignals.filter(s => s.status === 'emergency-green').length;
  const estimatedDelaySavedMins = Math.round((signalsCleared * 1.5) * 10) / 10;

  // Require Traffic Police ID & Password Authentication (No Fingerprint Required)
  if (!policeOfficerAuth?.isLoggedIn) {
    const handleInlineSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (onPoliceAuthenticate) {
        const ok = await onPoliceAuthenticate(inlineOfficerId, inlinePassword);
        if (ok) {
          setInlinePassword('');
        }
      } else if (onOpenPoliceLogin) {
        onOpenPoliceLogin();
      }
    };

    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-[#111827] border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Traffic Police Authentication</h2>
              <p className="text-xs text-slate-400 mt-0.5">Officer ID & Password Only • No Fingerprint Required</p>
            </div>
          </div>

          {policeSessionNotice && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
              <ShieldBan className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{policeSessionNotice}</span>
            </div>
          )}

          {policeLoginError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{policeLoginError}</span>
            </div>
          )}

          <form onSubmit={handleInlineSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Traffic Officer ID
              </label>
              <input
                type="text"
                value={inlineOfficerId}
                onChange={(e) => setInlineOfficerId(e.target.value)}
                placeholder="Enter Officer ID (e.g. TP-101 or police)"
                autoComplete="username"
                className="w-full bg-[#070B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showInlinePass ? "text" : "password"}
                  value={inlinePassword}
                  onChange={(e) => setInlinePassword(e.target.value)}
                  placeholder="Enter Admin-assigned password"
                  autoComplete="current-password"
                  className="w-full bg-[#070B17] border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowInlinePass(!showInlinePass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label={showInlinePass ? "Hide password" : "Show password"}
                >
                  {showInlinePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={Boolean(isAuthenticatingPolice)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isAuthenticatingPolice ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Verifying Officer Credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-slate-950" />
                  <span>Unlock Traffic Control</span>
                </>
              )}
            </button>
          </form>

          <div className="bg-[#070B17] rounded-2xl p-3.5 border border-[#1F2937] space-y-1.5 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin-Provisioned Access
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                ID & PASS ONLY
              </span>
            </div>
            <p className="leading-relaxed">
              Officer IDs and passwords are created in <span className="text-slate-200 font-semibold">Admin & Dispatch → Traffic Police IDs</span>. Initial default ID: <code className="text-amber-300 font-mono">police / police123</code>. Once signed in, this APK receives corridor sirens & alerts even if you close this screen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Officer On-Duty Terminal Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-[#111827] border border-amber-500/40 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-lg">
            <ShieldAlert className="w-6 h-6 animate-pulse text-amber-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Traffic Police Terminal Active</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">ALERTS ENABLED ACROSS ENTIRE APP</span>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">ID/PASS AUTH • NO FINGERPRINT</span>
            </div>
            <p className="text-sm font-extrabold text-white mt-0.5">
              {policeOfficerAuth.fullName || policeOfficerAuth.username}{' '}
              <span className="font-mono text-xs text-amber-300 font-semibold">(ID: {policeOfficerAuth.officerId || policeOfficerAuth.username})</span>{' '}
              <span className="font-mono text-xs text-amber-400/80 font-normal">[{policeOfficerAuth.badgeNumber}]</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Zone: <span className="text-slate-200 font-semibold">{policeOfficerAuth.assignedZone || 'City Emergency Corridor'}</span> • Instant sirens, vibration & corridor alerts stay active even if this panel is closed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onPoliceLogout}
            className="px-3.5 py-2 rounded-xl border border-red-500/30 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out Officer
          </button>
        </div>
      </div>

      {/* Explicit User Action Push Notification Card */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
            notifState === 'granted' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
          )}>
            <Radio className={cn("w-6 h-6", notifState === 'granted' && "animate-pulse")} />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              Traffic Police Push Alerts
              <span className={cn(
                "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase",
                notifState === 'granted' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : notifState === 'denied' ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}>
                {notifState === 'granted' ? 'ALERTS ENABLED' : notifState === 'denied' ? 'PERMISSIONS DENIED' : 'PUSH ALERTS OFF'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
              {notifState === 'granted'
                ? "Your device is registered to receive FCM Web Push notifications when an ambulance approaches your assigned traffic signals."
                : "Enable push notifications to receive real-time alerts on your device when emergency vehicles enter your junction corridor."
              }
            </p>
            {notifNotice && (
              <p className="text-xs font-bold mt-1 text-emerald-400">{notifNotice}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={isSubscribingNotif || notifState === 'granted'}
            className={cn(
              "w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg",
              notifState === 'granted'
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default"
                : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 border border-amber-400/30 shadow-amber-500/20"
            )}
          >
            {isSubscribingNotif ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Requesting...
              </>
            ) : notifState === 'granted' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                FCM Device Subscribed
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Enable Traffic Push Alerts
              </>
            )}
          </button>

          <button
            type="button"
            onClick={async () => {
              const targetSignal = signals[0]?.name || 'Silk Board Junction Signal';
              setNotifNotice('📡 Dispatching high-priority corridor alert across FCM network...');
              const res = await triggerDirectFCMTestAlert(targetSignal);
              setNotifNotice(res.message);
            }}
            className="w-full sm:w-auto px-4 py-3 rounded-xl font-bold text-xs bg-[#1F2937] hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
          >
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            Trigger Test Alert (Web + APK)
          </button>
        </div>
      </div>

      {/* Top Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <TrafficCone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Real Intersection Signals</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">{signals.length}</span>
              <span className="text-[10px] text-emerald-400 font-mono">10km OSM Grid</span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Preempted Green Corridor</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">{preemptedSignalsCount}</span>
              <span className="text-[10px] text-slate-400">/ {signals.length} Signals Active</span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Route Corridor Signals</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">{routeSignals.length}</span>
              <span className="text-[10px] text-blue-400 font-mono">{signalsCleared} Cleared</span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2937] shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Estimated Delay Saved</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400 font-mono">~{estimatedDelaySavedMins}m</span>
              <span className="text-[10px] text-slate-400">Time Saved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Map & Controls Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Map Filter Controls Toolbar */}
          <div className="bg-[#111827] p-4 rounded-2xl border border-[#1F2937] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSignalFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                  signalFilter === 'all'
                    ? "bg-blue-600 text-white border-blue-500 shadow-md"
                    : "bg-[#070B17] text-slate-400 border-[#1F2937] hover:text-white"
                )}
              >
                All Signals ({signals.length})
              </button>
              <button
                type="button"
                onClick={() => setSignalFilter('route')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                  signalFilter === 'route'
                    ? "bg-amber-600 text-white border-amber-500 shadow-md"
                    : "bg-[#070B17] text-slate-400 border-[#1F2937] hover:text-white"
                )}
              >
                Route Signals ({routeSignals.length})
              </button>
              <button
                type="button"
                onClick={() => setSignalFilter('corridor')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                  signalFilter === 'corridor'
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                    : "bg-[#070B17] text-slate-400 border-[#1F2937] hover:text-white"
                )}
              >
                Green Corridor ({preemptedSignalsCount})
              </button>
              <button
                type="button"
                onClick={() => setSignalFilter('hidden')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                  signalFilter === 'hidden'
                    ? "bg-slate-700 text-white border-slate-600 shadow-md"
                    : "bg-[#070B17] text-slate-400 border-[#1F2937] hover:text-white"
                )}
              >
                Hide Signals
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFleetView(prev => !prev)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer border flex items-center gap-1.5 shadow-md",
                  showFleetView
                    ? "bg-red-600 text-white border-red-500 ring-2 ring-red-400"
                    : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                )}
                title="View All Ambulances Fleet"
              >
                <AmbulanceIcon className="w-3.5 h-3.5 text-red-400" />
                <span>All Ambulances Fleet ({resolvedAmbulances.length})</span>
                {activeEmergencyAmbs.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>

              {focusedAmbulance && (
                <button
                  type="button"
                  onClick={() => setSelectedAmbulanceId(focusedAmbulance.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-950/60 transition-all border border-red-400/40"
                  title="Center map on live ambulance"
                >
                  <Crosshair className="w-3.5 h-3.5 text-white" />
                  <span>Focus Ambulance (LIVE)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedAmbulanceId(null)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#070B17] hover:bg-slate-800 text-slate-300 border border-[#1F2937] flex items-center gap-1.5 cursor-pointer transition-all"
                title="Center map on traffic station coordinates"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Station GPS</span>
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search junction / road..."
                  className="w-full sm:w-44 pl-8 pr-3 py-1.5 bg-[#070B17] text-white placeholder-slate-500 border border-[#1F2937] rounded-xl text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Interactive Ambulance Fleet Live Inspector Panel */}
          {(showFleetView || selectedAmbulanceId) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111827] border-2 border-red-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center font-bold">
                    <AmbulanceIcon className="w-5 h-5 text-red-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      Emergency Ambulance Fleet Tracker
                      <span className="text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/30 px-2.5 py-0.5 rounded-full font-bold">
                        {resolvedAmbulances.length} Vehicles Tracked
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Select any ambulance below to inspect live GPS location, speed, and hospital ETA.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {focusedAmbulance && (
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                      Selected: {focusedAmbulance.driverName}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowFleetView(false);
                      setSelectedAmbulanceId(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fleet Selection Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {resolvedAmbulances.map(amb => {
                  const isSelected = (focusedAmbulance?.id === amb.id);
                  const isResponding = amb.status !== 'idle';
                  const ambSpeed = amb.speed !== undefined && amb.speed !== null ? amb.speed : (isResponding ? 58 : 0);
                  const targetHosp = hospitals.find(h => h.id === amb.targetHospitalId) || hospitals.find(h => h.name === amb.targetHospitalName) || hospitals[0];
                  const distToHosp = targetHosp && amb.location ? calculateDistance(amb.location.lat, amb.location.lng, targetHosp.location.lat, targetHosp.location.lng) : '3.5';
                  const etaMins = Math.max(1, Math.round((parseFloat(distToHosp) / 45) * 60 + 2));

                  return (
                    <button
                      key={amb.id}
                      type="button"
                      onClick={() => {
                        setSelectedAmbulanceId(amb.id);
                      }}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2",
                        isSelected 
                          ? "bg-red-950/40 border-red-500 ring-2 ring-red-500/40 shadow-lg shadow-red-950/50" 
                          : "bg-[#070B17] border-[#1F2937] hover:border-slate-600"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white flex items-center gap-1.5 truncate">
                          <AmbulanceIcon className={cn("w-4 h-4 shrink-0", isResponding ? "text-red-400" : "text-slate-400")} />
                          {amb.driverName || 'Ambulance Unit'}
                        </span>
                        <span className={cn(
                          "text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border shrink-0",
                          isResponding 
                            ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse" 
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        )}>
                          {amb.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono pt-1 border-t border-white/5">
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-sans">Speed</span>
                          <span className="text-blue-400 font-bold">{ambSpeed} km/h</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-sans">ETA</span>
                          <span className="text-emerald-400 font-bold">{isResponding ? `${etaMins} mins` : 'Standby'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Inspected Ambulance Detailed Telemetry Card */}
              {focusedAmbulance && (() => {
                const isResponding = focusedAmbulance.status !== 'idle';
                const ambSpeed = focusedAmbulance.speed !== undefined && focusedAmbulance.speed !== null ? focusedAmbulance.speed : (isResponding ? 58 : 0);
                const targetHosp = hospitals.find(h => h.id === focusedAmbulance.targetHospitalId) || hospitals.find(h => h.name === focusedAmbulance.targetHospitalName) || hospitals[0];
                const distToHosp = targetHosp && focusedAmbulance.location ? calculateDistance(focusedAmbulance.location.lat, focusedAmbulance.location.lng, targetHosp.location.lat, targetHosp.location.lng) : '3.2';
                const etaMins = Math.max(1, Math.round((parseFloat(distToHosp) / 45) * 60 + 2));

                return (
                  <div className="p-4 bg-[#070B17] rounded-2xl border border-red-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2937] pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Inspecting Telemetry for:</span>
                        <span className="text-sm font-black text-white">{focusedAmbulance.driverName}</span>
                        <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                          AMB-{focusedAmbulance.id.slice(-4).toUpperCase()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAmbulanceId(focusedAmbulance.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md self-start sm:self-auto"
                      >
                        <Crosshair className="w-3.5 h-3.5" /> Center Map on this Vehicle
                      </button>
                    </div>

                    {/* 4 Telemetry Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-[#111827] p-3 rounded-xl border border-[#1F2937]">
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">Live Speed</span>
                        <span className="font-extrabold text-blue-400 font-mono text-sm flex items-center gap-1.5 mt-0.5">
                          <Gauge className="w-3.5 h-3.5 text-blue-400" />
                          {ambSpeed} km/h
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-xl border border-[#1F2937]">
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">Estimated Time (ETA)</span>
                        <span className="font-extrabold text-emerald-400 font-mono text-sm flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          {isResponding ? `${etaMins} mins` : 'On Standby'}
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-xl border border-[#1F2937]">
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">Live GPS Location</span>
                        <span className="font-extrabold text-white font-mono text-xs flex items-center gap-1.5 mt-0.5 truncate" title={`${focusedAmbulance.location.lat.toFixed(5)}, ${focusedAmbulance.location.lng.toFixed(5)}`}>
                          <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          {focusedAmbulance.location.lat.toFixed(4)}, {focusedAmbulance.location.lng.toFixed(4)}
                        </span>
                      </div>

                      <div className="bg-[#111827] p-3 rounded-xl border border-[#1F2937]">
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">Target Hospital</span>
                        <span className="font-bold text-amber-300 text-xs block mt-0.5 truncate" title={focusedAmbulance.targetHospitalName || targetHosp?.name || 'Emergency Center'}>
                          {focusedAmbulance.targetHospitalName || targetHosp?.name || 'Emergency Center'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          <EmergencyMap 
            hospitals={hospitals} 
            ambulances={resolvedAmbulances} 
            signals={signals} 
            center={mapCenter}
            emergencies={emergencies}
            routeCoords={activeRoutePts}
            signalFilter={signalFilter}
          />

          {/* Traffic Signal Junction Overrides Grid */}
          <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Navigation className="w-5 h-5 text-amber-500" />
                Real Traffic Signal Junction Controllers
              </h2>
              <span className="text-xs font-mono font-bold bg-[#070B17] text-amber-400 px-2.5 py-1 rounded-full border border-[#1F2937]">
                {preemptedSignalsCount} / {signals.length} Preempted Green
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedSignals.length === 0 ? (
                <div className="col-span-2 text-center py-8 text-slate-500 border border-dashed border-[#1F2937] rounded-xl bg-[#070B17]/40 text-xs">
                  No signals match the current map filter or search query.
                </div>
              ) : (
                displayedSignals.map((signal, idx) => {
                  const ambLoc = ambulances[0]?.location || { lat: center[0], lng: center[1] };
                  const distToAmb = calculateDistance(ambLoc.lat, ambLoc.lng, signal.location.lat, signal.location.lng);
                  const isOnRoute = activeRoutePts.length > 0 && getDistanceToRouteKm(signal.location.lat, signal.location.lng, activeRoutePts) <= 0.35;
                  const isPreempted = signal.status === 'emergency-green';
                  const currentState = signal.currentState || 'green';
                  const countdown = signal.countdownSecs !== undefined ? signal.countdownSecs : 15;

                  return (
                    <div key={signal.id} className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3",
                      isPreempted 
                        ? "bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/10" 
                        : isOnRoute
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-[#070B17]/60 border-[#1F2937]"
                    )}>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-extrabold text-white flex items-center gap-1.5 truncate">
                            <span>🚦</span> {signal.name || `Junction Signal #${idx + 1}`}
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-[#1F2937] text-slate-300 px-2 py-0.5 rounded border border-slate-700 shrink-0">
                            {signal.signalId || `SIG-${signal.id.slice(-4)}`}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 font-mono truncate">{signal.roadName || 'Intersection Corridor'}</p>
                        
                        <div className="grid grid-cols-2 gap-2 mt-3 p-2 bg-[#070B17] rounded-xl border border-[#1F2937] text-xs font-mono">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase block font-sans">Distance</span>
                            <span className="text-white font-bold">{distToAmb} km</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase block font-sans">Signal State</span>
                            <span className={cn(
                              "font-bold uppercase text-[10px]",
                              isPreempted 
                                ? "text-emerald-400 animate-pulse" 
                                : currentState === 'red' 
                                  ? "text-red-400" 
                                  : currentState === 'yellow' 
                                    ? "text-amber-400" 
                                    : "text-emerald-400"
                            )}>
                              {isPreempted ? '⚡ Override' : `${currentState} (${countdown}s)`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const newStatus = isPreempted ? 'normal' : 'emergency-green';
                          await updateSignalStatus(signal.id, newStatus);
                        }}
                        className={cn(
                          "w-full text-xs font-bold py-2.5 rounded-xl transition-all border cursor-pointer shadow-md",
                          isPreempted
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"
                            : "bg-[#1F2937] hover:bg-slate-700 text-slate-200 border-slate-700"
                        )}
                      >
                        {isPreempted ? 'Restore Normal Cycle' : 'Trigger Emergency Green Corridor ⚡'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
              Active Emergency Green Corridors
            </h3>
            
            {activeEmergencyAmbs.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#1F2937] rounded-xl bg-[#070B17]/40 space-y-1">
                <p className="text-xs text-slate-400 font-semibold">No active emergency dispatches.</p>
                <p className="text-[10px] text-slate-600">Signals operating on normal traffic cycles.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeEmergencyAmbs.map(amb => {
                  const ambEmerg = emergencies.find(e => e.ambulanceId === amb.id && e.status === 'active');
                  const ambHosp = hospitals.find(h => h.id === ambEmerg?.hospitalId);

                  const now = Date.now();
                  const pingTs = amb.lastSeenTimestamp || (ambEmerg?.createdAt ? new Date(ambEmerg.createdAt).getTime() : now);
                  const elapsedSecs = Math.max(0, Math.floor((now - pingTs) / 1000));
                  const isLive = elapsedSecs < 25;
                  const timeStr = amb.lastUpdated || (ambEmerg?.createdAt ? new Date(ambEmerg.createdAt).toLocaleTimeString() : 'Just now');
                  const elapsedDisplay = elapsedSecs < 60 ? `${elapsedSecs}s ago` : `${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s ago`;

                  return (
                    <div key={amb.id} className={cn(
                      "p-4 rounded-xl border space-y-3 transition-colors",
                      isLive 
                        ? "border-red-500/20 bg-red-500/5" 
                        : "border-amber-500/30 bg-amber-500/5"
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shrink-0",
                            isLive ? "bg-red-600 shadow-red-600/30" : "bg-amber-600 shadow-amber-600/30"
                          )}>
                            <AmbulanceIcon className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-white">{amb.driverName}</p>
                            <p className="text-[10px] text-red-400 font-mono font-bold uppercase">{amb.status}</p>
                          </div>
                        </div>

                        {/* Live vs Last Seen Badge */}
                        <div className="text-right shrink-0">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              LIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              LAST SEEN
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Location & Time Stamp Card */}
                      <div className="p-2.5 bg-[#070B17] rounded-xl border border-[#1F2937] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-red-400" />
                            {isLive ? 'Current GPS Location' : 'Last Reported Location'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-300">
                            {amb.location.lat.toFixed(4)}, {amb.location.lng.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {isLive ? 'Ping Timestamp:' : 'Last Seen At:'}
                          </span>
                          <span className={cn("font-bold", isLive ? "text-emerald-400" : "text-amber-300")}>
                            {timeStr} {isLive ? '(Streaming)' : `(${elapsedDisplay})`}
                          </span>
                        </div>
                        {!isLive && (
                          <div className="text-[10px] text-amber-300/90 bg-amber-950/40 p-1.5 rounded-lg border border-amber-500/20 leading-tight">
                            ⚠️ Telemetry offline — fallback mode active. Keep upcoming signals cleared toward {ambHosp?.name || 'hospital'}.
                          </div>
                        )}
                      </div>

                      {/* Center Map on this Ambulance Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedAmbulanceId(amb.id)}
                        className="w-full text-xs font-bold py-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-300 border border-red-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
                      >
                        <Crosshair className="w-3.5 h-3.5 text-red-400" />
                        Center Map on this Ambulance
                      </button>

                      {ambHosp && (
                        <div className="p-2 bg-[#070B17] rounded-lg border border-[#1F2937] text-xs">
                          <span className="text-[9px] text-slate-500 uppercase block font-mono">Target Hospital</span>
                          <span className="font-bold text-slate-200 truncate block">{ambHosp.name}</span>
                        </div>
                      )}

                      <div className="space-y-1 text-[11px] font-mono text-slate-400 pt-2 border-t border-[#1F2937]">
                        <div className="flex justify-between">
                          <span>Corridor Signals:</span>
                          <span className="text-emerald-400 font-bold">{routeSignals.length} Preempted</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Saved Time:</span>
                          <span className="text-rose-400 font-bold">~{estimatedDelaySavedMins} mins</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Admin & Dispatch Dashboard (Master Control Center) ---
function AdminDashboard({
  hospitals,
  ambulances,
  emergencies,
  emergencyRequests = [],
  signals,
  trafficOfficers = [],
  globalBroadcast = null,
  adminAuth,
  onAdminLogout,
  onOfficerCreated,
  onDirectLoginAsOfficer,
  onTriggerSystemReseed,
  onOpenTrafficControl
}: {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  emergencies: Emergency[];
  emergencyRequests?: EmergencyRequest[];
  signals: TrafficSignal[];
  trafficOfficers?: TrafficOfficerAccount[];
  globalBroadcast?: SystemBroadcast | null;
  adminAuth?: AdminSession;
  onAdminLogout?: () => void;
  onOfficerCreated?: (officer: TrafficOfficerAccount) => void;
  onDirectLoginAsOfficer?: (officer: TrafficOfficerAccount, rawPass?: string) => void;
  onTriggerSystemReseed?: () => Promise<void>;
  onOpenTrafficControl?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'dispatches' | 'police' | 'signals' | 'hospitals' | 'system'>('police');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Traffic Police Account Creation & Management State
  const [newOfficerId, setNewOfficerId] = useState('');
  const [newOfficerPassword, setNewOfficerPassword] = useState('');
  const [showNewOfficerPass, setShowNewOfficerPass] = useState(true);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerBadge, setNewOfficerBadge] = useState('');
  const [newOfficerZone, setNewOfficerZone] = useState('');
  const [isCreatingOfficer, setIsCreatingOfficer] = useState(false);
  const [officerSearch, setOfficerSearch] = useState('');
  const [lastCreatedCreds, setLastCreatedCreds] = useState<{ officerId: string; password: string; fullName: string } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Inline Password Reset & Edit State
  const [resettingOfficerId, setResettingOfficerId] = useState<string | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const [editOfficerZone, setEditOfficerZone] = useState('');
  const [editOfficerBadge, setEditOfficerBadge] = useState('');

  // Signal Search & Hospital Filter
  const [signalSearch, setSignalSearch] = useState('');
  const [isResettingSignals, setIsResettingSignals] = useState(false);
  const [isReseedingSystem, setIsReseedingSystem] = useState(false);

  // Global Broadcast Composer State
  const [broadcastTitle, setBroadcastTitle] = useState('CORRIDOR PRIORITY NOTICE');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState(false);

  // Registered Firebase Users (Admin inspection)
  const [fbUsers, setFbUsers] = useState<any[]>([]);
  const [fbUsersStatus, setFbUsersStatus] = useState<string | null>(null);
  const [loadingFbUsers, setLoadingFbUsers] = useState(false);

  const activeEmergencies = useMemo(() => {
    return emergencies.filter(e => e.status === 'active' || e.status === 'transporting');
  }, [emergencies]);

  const handleCompleteSingleRoute = async (emergencyId: string, ambulanceId?: string) => {
    setActionLoadingId(emergencyId);
    setActionMessage(null);
    try {
      await completeEmergencyRoute(emergencyId, ambulanceId);
      setActionMessage({ type: 'success', text: `Emergency route ${emergencyId.slice(0, 8)} successfully completed! Ambulance returned to idle.` });
    } catch (err: any) {
      console.error("Failed to complete emergency route:", err);
      setActionMessage({ type: 'error', text: err?.message || 'Failed to complete route.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteAllRoutes = async () => {
    if (!window.confirm("Complete all active emergency routes and reset the fleet to idle? This will clear active test routes, restore normal traffic signals, and optimize system speed.")) {
      return;
    }
    setIsClearingAll(true);
    setActionMessage(null);
    try {
      const count = await completeAllActiveEmergencies();
      setActionMessage({ type: 'success', text: `Fleet reset complete! ${count ?? 0} active emergency route(s) closed and signals normalized.` });
    } catch (err: any) {
      console.error("Failed to complete all emergencies:", err);
      setActionMessage({ type: 'error', text: err?.message || 'Failed to reset fleet.' });
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleCreateOfficerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingOfficer(true);
    setActionMessage(null);
    try {
      const created = await createTrafficOfficer({
        officerId: newOfficerId,
        password: newOfficerPassword,
        fullName: newOfficerName || newOfficerId,
        badgeNumber: newOfficerBadge,
        assignedZone: newOfficerZone
      });
      if (onOfficerCreated) {
        onOfficerCreated(created);
      }
      setLastCreatedCreds({
        officerId: created.officerId,
        password: newOfficerPassword.trim(),
        fullName: created.fullName
      });
      setCopiedCreds(false);
      setActionMessage({
        type: 'success',
        text: `Traffic Police Officer ID "${created.officerId}" created! Officer can now sign in with ID & Password (no fingerprint needed).`
      });
      setNewOfficerId('');
      setNewOfficerPassword('');
      setNewOfficerName('');
      setNewOfficerBadge('');
      setNewOfficerZone('');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to create Traffic Police Officer ID.' });
    } finally {
      setIsCreatingOfficer(false);
    }
  };

  const handleCopyCredentials = async (id: string, pass: string) => {
    const text = `Traffic Police Login\nOfficer ID: ${id}\nPassword: ${pass}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 3000);
    } catch {
      setActionMessage({ type: 'success', text: `Credentials: ID="${id}", Password="${pass}"` });
    }
  };

  const handleConfirmResetPassword = async (officer: TrafficOfficerAccount) => {
    if (!resetPasswordInput.trim() || resetPasswordInput.trim().length < 4) {
      setActionMessage({ type: 'error', text: 'New password must be at least 4 characters.' });
      return;
    }
    setActionLoadingId(officer.id);
    try {
      await resetTrafficOfficerPassword(officer.id, resetPasswordInput, officer.sessionVersion || 1);
      setLastCreatedCreds({
        officerId: officer.officerId,
        password: resetPasswordInput.trim(),
        fullName: officer.fullName
      });
      setActionMessage({ type: 'success', text: `Password reset for "${officer.officerId}". Any active device session has been signed out.` });
      setResettingOfficerId(null);
      setResetPasswordInput('');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to reset password.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleOfficerStatus = async (officer: TrafficOfficerAccount) => {
    setActionLoadingId(officer.id);
    try {
      const nextActive = !officer.active;
      await toggleTrafficOfficerActive(officer.id, nextActive, officer.sessionVersion || 1);
      setActionMessage({
        type: 'success',
        text: nextActive
          ? `Officer ID "${officer.officerId}" re-activated.`
          : `Officer ID "${officer.officerId}" suspended and signed out of active APKs.`
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update officer status.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleForceLogoutOfficer = async (officer: TrafficOfficerAccount) => {
    setActionLoadingId(officer.id);
    try {
      await forceLogoutTrafficOfficer(officer.id, officer.sessionVersion || 1);
      setActionMessage({ type: 'success', text: `Forced sign-out sent to Officer "${officer.officerId}".` });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to force logout.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveOfficerEdits = async (officer: TrafficOfficerAccount) => {
    setActionLoadingId(officer.id);
    try {
      await updateTrafficOfficerDetails(officer.id, {
        assignedZone: editOfficerZone.trim() || officer.assignedZone,
        badgeNumber: editOfficerBadge.trim() || officer.badgeNumber
      });
      setActionMessage({ type: 'success', text: `Updated assignment details for "${officer.officerId}".` });
      setEditingOfficerId(null);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update officer details.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteOfficer = async (officer: TrafficOfficerAccount) => {
    if (!window.confirm(`Permanently delete Traffic Police ID "${officer.officerId}" (${officer.fullName})? Any device using this ID will be immediately signed out.`)) {
      return;
    }
    setActionLoadingId(officer.id);
    try {
      await deleteTrafficOfficer(officer.id);
      setActionMessage({ type: 'success', text: `Officer ID "${officer.officerId}" deleted permanently.` });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to delete officer.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdminToggleSignal = async (sig: TrafficSignal) => {
    setActionLoadingId(sig.id);
    try {
      const nextStatus = sig.status === 'emergency-green' ? 'normal' : 'emergency-green';
      await updateSignalStatus(sig.id, nextStatus, nextStatus === 'emergency-green' ? 'admin-override' : undefined);
      setActionMessage({
        type: 'success',
        text: `Signal "${sig.name || sig.signalId}" overridden to ${nextStatus.toUpperCase()}.`
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to override signal.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdminResetAllSignals = async () => {
    setIsResettingSignals(true);
    try {
      const count = await adminResetAllTrafficSignals();
      setActionMessage({ type: 'success', text: `Restored ${count} preempted signal(s) to normal cycle.` });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to reset signals.' });
    } finally {
      setIsResettingSignals(false);
    }
  };

  const handleAdminAdjustHospitalBeds = async (h: Hospital, deltaAvail: number, deltaIcu = 0, deltaEr = 0) => {
    setActionLoadingId(h.id);
    try {
      const nextAvail = Math.max(0, Math.min(h.totalBeds, (h.availableBeds || 0) + deltaAvail));
      const nextIcu = Math.max(0, (h.icuBeds || 0) + deltaIcu);
      const nextEr = Math.max(0, (h.emergencyBeds || 0) + deltaEr);
      const nextOcc = h.totalBeds > 0 ? Math.round(((h.totalBeds - nextAvail) / h.totalBeds) * 100) : 0;
      await adminUpdateHospital(h.id, {
        availableBeds: nextAvail,
        icuBeds: nextIcu,
        emergencyBeds: nextEr,
        occupancyRate: nextOcc
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update hospital beds.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdminSetAmbulanceStatus = async (amb: Ambulance, nextStatus: 'idle' | 'responding' | 'busy') => {
    setActionLoadingId(amb.id);
    try {
      await adminUpdateAmbulanceControl(amb.id, {
        status: nextStatus,
        speed: nextStatus === 'idle' ? 0 : (amb.speed || 55),
        ...(nextStatus === 'idle' ? { targetHospitalId: null, targetHospitalName: null } : {})
      });
      setActionMessage({ type: 'success', text: `Unit ${amb.driverName} set to ${nextStatus.toUpperCase()}.` });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update ambulance unit.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLoadFirebaseUsers = async () => {
    setLoadingFbUsers(true);
    setFbUsersStatus(null);
    try {
      const list = await adminFetchUsers();
      setFbUsers(list);
      if (list.length === 0) {
        setFbUsersStatus('No registered Firebase user profiles visible.');
      }
    } catch (err: any) {
      setFbUsersStatus('Listing all /users documents requires Firebase Sign-In with an Admin role document in Firestore rules.');
    } finally {
      setLoadingFbUsers(false);
    }
  };

  const totalBeds = hospitals.reduce((acc, h) => acc + h.totalBeds, 0);
  const totalAvailBeds = hospitals.reduce((acc, h) => acc + h.availableBeds, 0);
  const activeReservations = emergencyRequests.filter(r => r.status === 'bed_reserved' || r.status === 'accepted').length;
  const pendingRequestsCount = emergencyRequests.filter(r => r.status === 'pending').length;
  const totalArrivedCount = emergencyRequests.filter(r => r.status === 'arrived').length;
  const systemOccupancyRate = totalBeds > 0 ? Math.round(((totalBeds - totalAvailBeds) / totalBeds) * 100) : 0;
  const preemptedSignalsCount = signals.filter(s => s.status === 'emergency-green').length;
  const activeOfficersCount = trafficOfficers.filter(o => o.active).length;
  const onlineOfficersCount = trafficOfficers.filter(o => o.isOnline && o.active).length;

  const filteredRequests = emergencyRequests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (selectedDept !== 'all' && r.requiredDepartment !== selectedDept) return false;
    return true;
  });

  const filteredOfficers = useMemo(() => {
    if (!officerSearch.trim()) return trafficOfficers;
    const q = officerSearch.toLowerCase();
    return trafficOfficers.filter(o =>
      o.officerId.toLowerCase().includes(q) ||
      o.fullName.toLowerCase().includes(q) ||
      o.badgeNumber.toLowerCase().includes(q) ||
      o.assignedZone.toLowerCase().includes(q)
    );
  }, [trafficOfficers, officerSearch]);

  const filteredAdminSignals = useMemo(() => {
    if (!signalSearch.trim()) return signals;
    const q = signalSearch.toLowerCase();
    return signals.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.roadName && s.roadName.toLowerCase().includes(q)) ||
      (s.signalId && s.signalId.toLowerCase().includes(q))
    );
  }, [signals, signalSearch]);

  const handleForceCancel = async (reqId: string) => {
    try {
      await cancelEmergencyRequest(reqId, "Cancelled by System Administrator");
      setActionMessage({ type: 'success', text: `Request ${reqId.slice(0, 8)} revoked and bed released.` });
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e?.message || 'Failed to revoke request.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Master Command Header & KPIs */}
      <div className="bg-gradient-to-r from-purple-950/40 via-[#111827] to-indigo-950/30 border border-purple-500/30 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">Master Admin Command Center</h2>
              <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full uppercase">
                Full System Control
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Provision Traffic Police Officer IDs & passwords, override signals, adjust hospital beds, manage fleet dispatches, and broadcast directives.
            </p>
            {adminAuth?.isLoggedIn && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-purple-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold text-purple-200">Active Admin Session:</span>
                <span className="text-xs font-mono font-extrabold text-white bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                  {adminAuth.username}
                </span>
                {onAdminLogout && (
                  <button
                    type="button"
                    onClick={onAdminLogout}
                    className="text-[11px] text-purple-300 hover:text-rose-400 underline ml-2 cursor-pointer"
                  >
                    Sign Out Admin
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {onOpenTrafficControl && (
          <button
            type="button"
            onClick={onOpenTrafficControl}
            className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <TrafficCone className="w-4 h-4" />
            Open Traffic Police Portal
          </button>
        )}
      </div>

      {/* Network KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-[#111827] p-4 rounded-2xl border border-[#1F2937] shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1.5">
            <span>Police IDs</span>
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">{activeOfficersCount} / {trafficOfficers.length}</div>
          <p className="text-[10px] text-emerald-400 mt-1 font-mono">{onlineOfficersCount} Online Terminals</p>
        </div>

        <div className="bg-[#111827] p-4 rounded-2xl border border-[#1F2937] shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1.5">
            <span>Network Beds</span>
            <Bed className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalAvailBeds} / {totalBeds}</div>
          <p className="text-[10px] text-slate-500 mt-1 font-mono">{systemOccupancyRate}% Occupancy</p>
        </div>

        <div className="bg-[#111827] p-4 rounded-2xl border border-[#1F2937] shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1.5">
            <span>Bed Locks</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{activeReservations}</div>
          <p className="text-[10px] text-emerald-500/80 mt-1 font-mono">{pendingRequestsCount} Pending</p>
        </div>

        <div className="bg-[#111827] p-4 rounded-2xl border border-[#1F2937] shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1.5">
            <span>Admitted</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">{totalArrivedCount}</div>
          <p className="text-[10px] text-purple-500/80 mt-1 font-mono">Completed Arrivals</p>
        </div>

        <div className="bg-[#111827] p-4 rounded-2xl border border-[#1F2937] shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1.5">
            <span>Ambulances</span>
            <AmbulanceIcon className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400 font-mono">
            {ambulances.filter(a => a.status !== 'idle').length} / {ambulances.length}
          </div>
          <p className="text-[10px] text-red-500/80 mt-1 font-mono">In-Transit Units</p>
        </div>

        <div className="bg-[#111827] p-4 rounded-2xl border border-[#1F2937] shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1.5">
            <span>Signals Green</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{preemptedSignalsCount} / {signals.length}</div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Corridor Overrides</p>
        </div>
      </div>

      {/* Admin Control Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-[#111827] p-2 rounded-2xl border border-[#1F2937]">
        {[
          { id: 'police', label: 'Traffic Police IDs', icon: KeyRound, badge: trafficOfficers.length },
          { id: 'dispatches', label: 'Dispatches & Fleet', icon: Siren, badge: activeEmergencies.length },
          { id: 'signals', label: 'Signals Master', icon: TrafficCone, badge: preemptedSignalsCount },
          { id: 'hospitals', label: 'Hospitals & Beds', icon: HospitalIcon, badge: hospitals.length },
          { id: 'system', label: 'System & Broadcast', icon: Sliders, badge: globalBroadcast?.active ? 1 : 0 }
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border",
                isActive
                  ? "bg-purple-600 text-white border-purple-400/50 shadow-lg shadow-purple-900/40"
                  : "bg-[#070B17]/60 text-slate-400 border-transparent hover:text-white hover:bg-slate-800/70"
              )}
            >
              <IconComp className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Global Action Status Message */}
      {actionMessage && (
        <div className={cn(
          "p-3.5 rounded-2xl text-xs font-mono border flex items-center justify-between shadow-lg",
          actionMessage.type === 'success'
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            : "bg-red-500/10 text-red-300 border-red-500/30"
        )}>
          <span>{actionMessage.text}</span>
          <button 
            type="button" 
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white ml-2 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: TRAFFIC POLICE ID & PASSWORD MANAGEMENT */}
      {activeTab === 'police' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create New Officer ID & Password Card */}
          <div className="bg-[#111827] p-6 rounded-2xl border border-amber-500/30 shadow-xl space-y-5">
            <div className="border-b border-[#1F2937] pb-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                Create Traffic Police ID
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Issue new Officer credentials. Officers authenticate with ID & Password only (no fingerprint required).
              </p>
            </div>

            {lastCreatedCreds && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Ready to Share
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(lastCreatedCreds.officerId, lastCreatedCreds.password)}
                    className="text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCreds ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCreds ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-xs font-mono bg-[#070B17] p-2.5 rounded-xl border border-emerald-500/20 space-y-1 text-slate-200">
                  <div>Officer: <span className="text-white font-bold">{lastCreatedCreds.fullName}</span></div>
                  <div>ID: <span className="text-amber-300 font-bold">{lastCreatedCreds.officerId}</span></div>
                  <div>Pass: <span className="text-emerald-300 font-bold">{lastCreatedCreds.password}</span></div>
                </div>

                {onDirectLoginAsOfficer && (
                  <button
                    type="button"
                    onClick={() => {
                      const matched = trafficOfficers.find(
                        (o) => o.officerId === lastCreatedCreds.officerId || o.id === lastCreatedCreds.officerId.toLowerCase()
                      );
                      onDirectLoginAsOfficer(
                        matched || {
                          id: lastCreatedCreds.officerId.toLowerCase(),
                          officerId: lastCreatedCreds.officerId,
                          officerIdLower: lastCreatedCreds.officerId.toLowerCase(),
                          fullName: lastCreatedCreds.fullName,
                          badgeNumber: 'TP-NEW',
                          assignedZone: 'City Corridor',
                          passwordHash: '',
                          passwordSalt: '',
                          active: true,
                          isOnline: false,
                          sessionVersion: 1,
                          createdBy: 'admin',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        },
                        lastCreatedCreds.password
                      );
                    }}
                    className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    🚀 Test Login to Traffic Control as "{lastCreatedCreds.officerId}"
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleCreateOfficerSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Officer Login ID *</label>
                <input
                  type="text"
                  value={newOfficerId}
                  onChange={(e) => setNewOfficerId(e.target.value)}
                  placeholder="e.g. TP-102 or inspector_rao"
                  className="w-full bg-[#070B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">Password *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewOfficerPassword(generateStrongPassword(8));
                      setShowNewOfficerPass(true);
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Generate Password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewOfficerPass ? "text" : "password"}
                    value={newOfficerPassword}
                    onChange={(e) => setNewOfficerPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full bg-[#070B17] border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewOfficerPass(!showNewOfficerPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showNewOfficerPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Officer Name / Rank</label>
                <input
                  type="text"
                  value={newOfficerName}
                  onChange={(e) => setNewOfficerName(e.target.value)}
                  placeholder="e.g. Inspector A. Rao"
                  className="w-full bg-[#070B17] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Badge Number</label>
                  <input
                    type="text"
                    value={newOfficerBadge}
                    onChange={(e) => setNewOfficerBadge(e.target.value)}
                    placeholder="TP-BLR-402"
                    className="w-full bg-[#070B17] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Assigned Zone</label>
                  <input
                    type="text"
                    value={newOfficerZone}
                    onChange={(e) => setNewOfficerZone(e.target.value)}
                    placeholder="Silk Board"
                    className="w-full bg-[#070B17] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingOfficer}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isCreatingOfficer ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating Officer Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Officer ID & Password
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Traffic Police Accounts Directory & Live Controls */}
          <div className="lg:col-span-2 bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  Traffic Police Accounts Directory ({trafficOfficers.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reset passwords, suspend IDs, force remote logout on APKs, or edit junction assignments in real time.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  placeholder="Search ID, name, zone..."
                  className="bg-[#070B17] border border-[#1F2937] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {filteredOfficers.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-[#070B17]/50 border border-[#1F2937] space-y-2">
                <KeyRound className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No Traffic Police IDs Found</p>
                <p className="text-xs text-slate-500">Create a new Officer ID & Password using the panel on the left.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOfficers.map((officer) => {
                  const isBusy = actionLoadingId === officer.id;
                  const isResetting = resettingOfficerId === officer.id;
                  const isEditing = editingOfficerId === officer.id;

                  return (
                    <div
                      key={officer.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all space-y-3",
                        officer.active
                          ? "bg-[#070B17]/70 border-[#1F2937]"
                          : "bg-rose-950/20 border-rose-500/30 opacity-85"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-extrabold text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                              ID: {officer.officerId}
                            </span>
                            <span className="font-bold text-sm text-white">{officer.fullName}</span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {officer.badgeNumber}
                            </span>
                            <span className={cn(
                              "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase",
                              officer.active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            )}>
                              {officer.active ? 'Active' : 'Suspended'}
                            </span>
                            {officer.isOnline && officer.active && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                                ON DUTY
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3 font-mono">
                            <span>Zone: <strong className="text-slate-200">{officer.assignedZone}</strong></span>
                            <span>Session v{officer.sessionVersion || 1}</span>
                            {officer.lastLoginAt && (
                              <span>Last Login: {new Date(officer.lastLoginAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        {/* Admin Per-Officer Action Controls */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setResettingOfficerId(isResetting ? null : officer.id);
                              setResetPasswordInput('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <KeyRound className="w-3 h-3" /> Reset Pass
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setEditingOfficerId(isEditing ? null : officer.id);
                              setEditOfficerZone(officer.assignedZone);
                              setEditOfficerBadge(officer.badgeNumber);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 cursor-pointer"
                          >
                            Edit Zone
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleOfficerStatus(officer)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer",
                              officer.active
                                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            )}
                          >
                            {officer.active ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            {officer.active ? 'Suspend' : 'Activate'}
                          </button>

                          {officer.isOnline && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleForceLogoutOfficer(officer)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/30 cursor-pointer"
                            >
                              Force Kick
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteOfficer(officer)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-bold border border-red-500/30 flex items-center gap-1 cursor-pointer"
                            title="Delete Officer ID"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Password Reset Form */}
                      {isResetting && (
                        <div className="pt-2 border-t border-[#1F2937] flex flex-col sm:flex-row items-center gap-2">
                          <input
                            type="text"
                            value={resetPasswordInput}
                            onChange={(e) => setResetPasswordInput(e.target.value)}
                            placeholder="Enter new password (min 4 chars)"
                            className="w-full sm:flex-1 bg-[#111827] border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setResetPasswordInput(generateStrongPassword(8))}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 cursor-pointer shrink-0"
                          >
                            Random
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConfirmResetPassword(officer)}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                          >
                            Save New Password
                          </button>
                        </div>
                      )}

                      {/* Inline Edit Zone / Badge Form */}
                      {isEditing && (
                        <div className="pt-2 border-t border-[#1F2937] flex flex-col sm:flex-row items-center gap-2">
                          <input
                            type="text"
                            value={editOfficerBadge}
                            onChange={(e) => setEditOfficerBadge(e.target.value)}
                            placeholder="Badge Number"
                            className="w-full sm:w-36 bg-[#111827] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editOfficerZone}
                            onChange={(e) => setEditOfficerZone(e.target.value)}
                            placeholder="Assigned Junction / Zone"
                            className="w-full sm:flex-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleSaveOfficerEdits(officer)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer shrink-0"
                          >
                            Update Assignment
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DISPATCHES, FLEET CONTROL & BED AUDIT STREAM */}
      {activeTab === 'dispatches' && (
        <div className="space-y-6">
          {/* Active Ambulance Dispatches & Emergency Route Clearing */}
          <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Siren className="w-5 h-5 text-red-500 animate-pulse" />
                    Active Ambulance Dispatches & Fleet Routes
                  </h2>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border",
                    activeEmergencies.length > 0 
                      ? "bg-red-500/20 text-red-400 border-red-500/30" 
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}>
                    {activeEmergencies.length} Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Force-complete any active dispatch, restore normal signals, and reset fleet state.
                </p>
              </div>

              <button
                type="button"
                disabled={isClearingAll || activeEmergencies.length === 0}
                onClick={handleCompleteAllRoutes}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all border shadow-lg cursor-pointer",
                  activeEmergencies.length > 0
                    ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30 hover:border-red-500/50 shadow-red-900/20"
                    : "bg-slate-800/40 text-slate-500 border-slate-700/40 cursor-not-allowed opacity-60"
                )}
              >
                {isClearingAll ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-red-400" />
                )}
                <span>Complete All Active Routes (Reset Fleet)</span>
              </button>
            </div>

            {activeEmergencies.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl bg-[#070B17]/40 border border-[#1F2937]/60 space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-400/80 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">All Ambulance Units are Idle & Ready</p>
                <p className="text-xs text-slate-500">No active emergency routes are consuming resources or holding green corridors.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeEmergencies.map((emg) => {
                  const amb = ambulances.find(a => a.id === emg.ambulanceId);
                  const hosp = hospitals.find(h => h.id === emg.hospitalId);
                  const isLoading = actionLoadingId === emg.id;
                  const routePointCount = emg.routeCoords ? emg.routeCoords.length : 0;

                  return (
                    <div 
                      key={emg.id} 
                      className="p-4 rounded-xl border border-red-500/20 bg-gradient-to-br from-red-950/20 via-[#070B17] to-[#111827] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs text-white">
                              {amb?.driverName || emg.ambulanceId || 'Ambulance'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                              {emg.emergencyType || 'Critical'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            Target: <span className="text-slate-200 font-semibold">{hosp?.name || 'Destination Hospital'}</span>
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleCompleteSingleRoute(emg.id, emg.ambulanceId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white border border-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Complete</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#1F2937]/60 text-[10px] font-mono text-slate-400">
                        <div>
                          <span className="block text-slate-500">Speed</span>
                          <span className="font-bold text-slate-200">{amb?.speed || 0} km/h</span>
                        </div>
                        <div>
                          <span className="block text-slate-500">Waypoints</span>
                          <span className="font-bold text-slate-200">{routePointCount} pts</span>
                        </div>
                        <div>
                          <span className="block text-slate-500">Dispatch ID</span>
                          <span className="font-bold text-slate-400">{emg.id.slice(0, 6)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Master Ambulance Fleet Controls */}
          <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <AmbulanceIcon className="w-5 h-5 text-red-400" />
                Master Ambulance Fleet Control ({ambulances.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Override any ambulance operational status or reset stale telematics units.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ambulances.map((amb) => (
                <div key={amb.id} className="p-4 rounded-xl border border-[#1F2937] bg-[#070B17]/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{amb.driverName}</h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        {amb.location?.lat?.toFixed(4)}, {amb.location?.lng?.toFixed(4)} • {amb.lastUpdated || 'Recent'}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border shrink-0",
                      amb.status === 'idle'
                        ? "bg-slate-800 text-slate-300 border-slate-700"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    )}>
                      {amb.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['idle', 'responding', 'busy'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={actionLoadingId === amb.id}
                        onClick={() => handleAdminSetAmbulanceStatus(amb, st)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase border cursor-pointer transition-all",
                          amb.status === st
                            ? "bg-purple-600 text-white border-purple-400"
                            : "bg-[#111827] text-slate-400 border-slate-700 hover:text-white"
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Bed Requests Audit Stream */}
          <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-4">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Emergency Bed Requests Audit Stream
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Full control to mark arrived or revoke active bed reservations</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-[#070B17] border border-[#1F2937] rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="bed_reserved">Bed Reserved</option>
                  <option value="arrived">Arrived</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select 
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-[#070B17] border border-[#1F2937] rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Departments</option>
                  <option value="Emergency / Trauma">Emergency / Trauma</option>
                  <option value="Cardiac ICU">Cardiac ICU</option>
                  <option value="Surgical ICU">Surgical ICU</option>
                  <option value="Neuro ICU">Neuro ICU</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1F2937] text-slate-400 font-mono uppercase text-[10px] bg-[#070B17]/60">
                    <th className="p-3">Request ID</th>
                    <th className="p-3">Ambulance</th>
                    <th className="p-3">Hospital</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Bed Code</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937] text-slate-300">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500 font-semibold">
                        No emergency bed requests match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => {
                      const statusBadge = 
                        req.status === 'bed_reserved' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        req.status === 'pending' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        req.status === 'arrived' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        req.status === 'rejected' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        "bg-slate-500/10 text-slate-400 border-slate-500/20";

                      return (
                        <tr key={req.requestId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-400">{req.requestId.slice(0, 8)}</td>
                          <td className="p-3 font-bold text-white">{req.ambulanceDriverName}</td>
                          <td className="p-3 font-semibold text-slate-200">{req.hospitalName}</td>
                          <td className="p-3 text-blue-300">{req.requiredDepartment}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400">{req.reservedBedId || '—'}</td>
                          <td className="p-3">
                            <span className={cn("text-[10px] font-bold font-mono uppercase px-2.5 py-1 rounded-full border", statusBadge)}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-3 flex items-center gap-1.5">
                            {['pending', 'accepted', 'bed_reserved'].includes(req.status) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => markPatientArrived(req.requestId)}
                                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
                                >
                                  Mark Arrived
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleForceCancel(req.requestId)}
                                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-red-500/20 transition-colors cursor-pointer"
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRAFFIC SIGNALS MASTER OVERRIDE */}
      {activeTab === 'signals' && (
        <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937] pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <TrafficCone className="w-5 h-5 text-amber-400" />
                Master Traffic Signal Grid Control ({signals.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Override any intersection to Emergency Green or restore all signals citywide with a single tap.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={signalSearch}
                  onChange={(e) => setSignalSearch(e.target.value)}
                  placeholder="Filter intersection..."
                  className="bg-[#070B17] border border-[#1F2937] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="button"
                disabled={isResettingSignals || preemptedSignalsCount === 0}
                onClick={handleAdminResetAllSignals}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all",
                  preemptedSignalsCount > 0
                    ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40"
                    : "bg-slate-800/40 text-slate-500 border-slate-700/40 cursor-not-allowed opacity-60"
                )}
              >
                <RotateCcw className={cn("w-3.5 h-3.5", isResettingSignals && "animate-spin")} />
                Restore All to Normal ({preemptedSignalsCount})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAdminSignals.map((sig) => {
              const isGreen = sig.status === 'emergency-green';
              const isBusy = actionLoadingId === sig.id;
              return (
                <div
                  key={sig.id}
                  className={cn(
                    "p-4 rounded-xl border transition-all space-y-3",
                    isGreen ? "bg-emerald-950/25 border-emerald-500/40" : "bg-[#070B17]/70 border-[#1F2937]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{sig.name || sig.signalId}</h4>
                      <p className="text-[11px] text-slate-400 truncate">{sig.roadName || 'Junction Node'}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border shrink-0",
                      isGreen ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-800 text-slate-300 border-slate-700"
                    )}>
                      {isGreen ? 'EMERGENCY GREEN' : 'NORMAL'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAdminToggleSignal(sig)}
                    className={cn(
                      "w-full py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      isGreen
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-lg shadow-emerald-900/30"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {isGreen ? 'Restore Normal Cycle' : 'Force Emergency Green'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: HOSPITALS & BED CAPACITY MASTER CONTROL */}
      {activeTab === 'hospitals' && (
        <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
          <div>
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <HospitalIcon className="w-5 h-5 text-blue-400" />
              Hospital Network Master Bed Control ({hospitals.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Directly adjust available beds, ICU capacity, and ER bays for any hospital across the network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitals.map(h => {
              const occ = h.totalBeds > 0 ? Math.round(((h.totalBeds - h.availableBeds) / h.totalBeds) * 100) : 0;
              const activeHospReqs = emergencyRequests.filter(r => r.hospitalId === h.id && ['pending', 'bed_reserved'].includes(r.status));
              const isBusy = actionLoadingId === h.id;

              return (
                <div key={h.id} className="p-4 rounded-2xl border border-[#1F2937] bg-[#070B17]/70 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{h.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {occ}% Occupied • ICU: {h.icuBeds ?? 0} • ER: {h.emergencyBeds ?? 0} • {activeHospReqs.length} Active Locks
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs font-bold font-mono px-2.5 py-0.5 rounded-full border shrink-0",
                      h.availableBeds < 5 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    )}>
                      {h.availableBeds} / {h.totalBeds}
                    </span>
                  </div>

                  <div className="w-full bg-[#1F2937] h-2 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-500", h.availableBeds < 5 ? "bg-red-500" : "bg-blue-500")}
                      style={{ width: `${h.totalBeds > 0 ? (h.availableBeds / h.totalBeds) * 100 : 0}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAdminAdjustHospitalBeds(h, -5)}
                      className="py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-rose-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
                    >
                      -5 Beds
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAdminAdjustHospitalBeds(h, -1)}
                      className="py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-white border border-slate-700 text-xs font-mono font-bold cursor-pointer"
                    >
                      -1 Bed
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAdminAdjustHospitalBeds(h, 1)}
                      className="py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-white border border-slate-700 text-xs font-mono font-bold cursor-pointer"
                    >
                      +1 Bed
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAdminAdjustHospitalBeds(h, 5)}
                      className="py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-emerald-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
                    >
                      +5 Beds
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM BROADCASTS, MAINTENANCE & USER ROLES */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global Broadcast Control */}
          <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
            <div className="border-b border-[#1F2937] pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                System-Wide Directive Broadcast
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Push a live announcement banner across all Ambulance, Hospital, Traffic Police, and Admin devices.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Banner Title</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-[#070B17] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Directive Message</label>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="e.g. Heavy VIP movement on Outer Ring Road. Traffic Officers prioritize Silk Board junction."
                  className="w-full bg-[#070B17] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Severity Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['info', 'warning', 'critical'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setBroadcastSeverity(sev)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold uppercase border cursor-pointer",
                        broadcastSeverity === sev
                          ? "bg-purple-600 text-white border-purple-400"
                          : "bg-[#070B17] text-slate-400 border-slate-700"
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isPublishingBroadcast || !broadcastMessage.trim()}
                  onClick={async () => {
                    setIsPublishingBroadcast(true);
                    try {
                      await publishGlobalBroadcast(broadcastTitle, broadcastMessage, broadcastSeverity);
                      setActionMessage({ type: 'success', text: 'System-wide broadcast published to all active devices!' });
                    } catch (e: any) {
                      setActionMessage({ type: 'error', text: e?.message || 'Failed to publish broadcast.' });
                    } finally {
                      setIsPublishingBroadcast(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  Publish Broadcast
                </button>
                {globalBroadcast?.active && (
                  <button
                    type="button"
                    onClick={async () => {
                      await clearGlobalBroadcast();
                      setActionMessage({ type: 'success', text: 'Global broadcast cleared.' });
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-bold text-xs cursor-pointer"
                  >
                    Clear Active Banner
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Master System Utilities & Users Inspection */}
          <div className="space-y-6">
            <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                System-Wide Operations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isReseedingSystem || !onTriggerSystemReseed}
                  onClick={async () => {
                    if (!onTriggerSystemReseed) return;
                    setIsReseedingSystem(true);
                    try {
                      await onTriggerSystemReseed();
                      setActionMessage({ type: 'success', text: 'Hospitals & traffic signals re-synchronized around active GPS.' });
                    } catch (e: any) {
                      setActionMessage({ type: 'error', text: e?.message || 'Reseed failed.' });
                    } finally {
                      setIsReseedingSystem(false);
                    }
                  }}
                  className="p-3 rounded-xl bg-[#070B17] hover:bg-slate-800 border border-[#1F2937] text-left space-y-1 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <RefreshCw className={cn("w-3.5 h-3.5 text-blue-400", isReseedingSystem && "animate-spin")} />
                    Reseed Grid Around GPS
                  </div>
                  <p className="text-[11px] text-slate-400">Refresh OSM hospitals & signals</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerDirectFCMTestAlert().catch(() => {});
                    setActionMessage({ type: 'success', text: 'Triggered system emergency corridor alert & siren test.' });
                  }}
                  className="p-3 rounded-xl bg-[#070B17] hover:bg-slate-800 border border-[#1F2937] text-left space-y-1 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    Test Siren & Alert Channel
                  </div>
                  <p className="text-[11px] text-slate-400">Verify audio siren & local banner</p>
                </button>
              </div>
            </div>

            <div className="bg-[#111827] p-6 rounded-2xl border border-[#1F2937] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    Firebase Registered Accounts
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Inspect and assign system roles (when signed in as Firebase Admin)</p>
                </div>
                <button
                  type="button"
                  disabled={loadingFbUsers}
                  onClick={handleLoadFirebaseUsers}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-pointer"
                >
                  {loadingFbUsers ? 'Loading...' : 'Load Users'}
                </button>
              </div>

              {fbUsersStatus && (
                <div className="p-3 rounded-xl bg-[#070B17] border border-slate-800 text-xs text-slate-400">
                  {fbUsersStatus}
                </div>
              )}

              {fbUsers.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {fbUsers.map((u) => (
                    <div key={u.uid} className="p-3 rounded-xl bg-[#070B17] border border-[#1F2937] flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{u.displayName || u.email || u.uid.slice(0, 10)}</div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{u.email || u.uid}</div>
                      </div>
                      <select
                        value={u.role || 'public'}
                        onChange={async (e) => {
                          try {
                            await adminUpdateUserRole(u.uid, e.target.value);
                            setFbUsers(prev => prev.map(item => item.uid === u.uid ? { ...item, role: e.target.value } : item));
                            setActionMessage({ type: 'success', text: `Updated role for ${u.displayName || u.uid.slice(0, 8)} to ${e.target.value}` });
                          } catch (err: any) {
                            setActionMessage({ type: 'error', text: err?.message || 'Role update denied by Firestore rules.' });
                          }
                        }}
                        className="bg-[#111827] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        <option value="public">public</option>
                        <option value="ambulance">ambulance</option>
                        <option value="hospital">hospital</option>
                        <option value="traffic">traffic</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
