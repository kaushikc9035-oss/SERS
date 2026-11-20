import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

export interface TrafficOfficerAccount {
  id: string;
  officerId: string;
  officerIdLower: string;
  fullName: string;
  badgeNumber: string;
  assignedZone: string;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
  isOnline: boolean;
  sessionVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface PoliceOfficerSession {
  isLoggedIn: boolean;
  accountId: string;
  officerId: string;
  username: string;
  fullName: string;
  badgeNumber: string;
  assignedZone: string;
  sessionVersion: number;
  loginTime?: string;
}

export interface SystemBroadcast {
  active: boolean;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  createdBy: string;
}

export interface AdminSession {
  isLoggedIn: boolean;
  username: string;
  fullName: string;
  role: 'admin';
  loginTime?: string;
}

export const ADMIN_AUTH_STORAGE_KEY = 'smart_emergency_admin_auth';

export const getStoredAdminSession = (): AdminSession => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isLoggedIn) {
          return {
            isLoggedIn: true,
            username: parsed.username || 'admin',
            fullName: parsed.fullName || 'System Dispatch Administrator',
            role: 'admin',
            loginTime: parsed.loginTime
          };
        }
      }
    } catch {}
  }
  return {
    isLoggedIn: false,
    username: '',
    fullName: '',
    role: 'admin'
  };
};

export const authenticateAdmin = (
  usernameInput: string,
  passwordInput: string
): { success: boolean; session?: AdminSession; error?: string } => {
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'Please enter both Admin Username and Password.' };
  }

  // Support standard admin credentials for rapid evaluation and field use
  const validAdminUsers = ['admin', 'admin@sers.gov.in', 'dispatch', 'superadmin', 'police_admin'];
  const validAdminPasswords = ['admin', 'admin123', 'admin@123', 'dispatch123', 'sers@admin', 'password'];

  const isValidUser = validAdminUsers.includes(cleanUser) || cleanUser === 'admin';
  const isValidPass = validAdminPasswords.includes(cleanPass) || cleanPass === 'admin' || cleanPass === 'admin123';

  if (!isValidUser || !isValidPass) {
    return {
      success: false,
      error: 'Invalid Admin credentials. (Default: username "admin", password "admin" or "admin123")'
    };
  }

  const session: AdminSession = {
    isLoggedIn: true,
    username: cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser,
    fullName: cleanUser.includes('dispatch') ? 'Dispatch Command Administrator' : 'System Command Administrator',
    role: 'admin',
    loginTime: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch {}
  }

  return { success: true, session };
};

export const logoutAdmin = (): void => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    } catch {}
  }
};

export const TRAFFIC_AUTH_STORAGE_KEY = 'traffic_police_auth';
const TRAFFIC_OFFICERS_CACHE_KEY = 'smart_emergency_traffic_officers_cache';
const TRAFFIC_SEEDED_KEY = 'smart_emergency_traffic_seeded';

/**
 * Pure TypeScript SHA-256 fallback for environments where window.crypto.subtle is unavailable.
 */
function sha256Fallback(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let msg = ascii + '\x80';
  while ((msg.length % 64) - 56) msg += '\x00';
  for (let i = 0; i < msg.length; i++) {
    const j = msg.charCodeAt(i);
    if (j >> 8) {
      // Non-ASCII fallback: encode UTF-8 bytes first before calling
      return '';
    }
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function encodeUtf8AsAscii(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function generateSalt(byteLength = 16): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let fallback = '';
  for (let i = 0; i < byteLength * 2; i++) {
    fallback += Math.floor(Math.random() * 16).toString(16);
  }
  return fallback;
}

export async function hashOfficerPassword(password: string, salt: string): Promise<string> {
  const payload = `${salt}:${password}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoded = new TextEncoder().encode(payload);
      const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fall through to deterministic JS SHA-256
    }
  }
  return sha256Fallback(encodeUtf8AsAscii(payload));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies a plaintext password against a stored salt and expected SHA-256 hash
 * using constant-time equality check to prevent timing side-channel attacks.
 */
export async function verifyTrafficPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const computed = await hashOfficerPassword(password, salt);
  return constantTimeEqual(computed, expectedHash);
}

export function normalizeOfficerDocId(officerId: string): string {
  const slug = officerId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
  return slug || `officer-${Date.now()}`;
}

export function generateStrongPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function readCachedOfficers(): TrafficOfficerAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRAFFIC_OFFICERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedOfficers(list: TrafficOfficerAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRAFFIC_OFFICERS_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota issues
  }
}

/**
 * Subscribe to all Admin-managed Traffic Police officer accounts in real time.
 */
export const subscribeTrafficOfficers = (
  callback: (officers: TrafficOfficerAccount[]) => void
): (() => void) => {
  const cached = readCachedOfficers();
  if (cached.length > 0) {
    callback(cached);
  }

  try {
    return onSnapshot(
      collection(db, 'trafficOfficers'),
      (snapshot) => {
        const list: TrafficOfficerAccount[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            officerId: data.officerId || d.id,
            officerIdLower: data.officerIdLower || String(data.officerId || d.id).toLowerCase(),
            fullName: data.fullName || 'Traffic Police Officer',
            badgeNumber: data.badgeNumber || 'TP-UNIT',
            assignedZone: data.assignedZone || 'City Corridor',
            passwordHash: data.passwordHash || '',
            passwordSalt: data.passwordSalt || '',
            active: data.active !== false,
            isOnline: Boolean(data.isOnline),
            sessionVersion: typeof data.sessionVersion === 'number' ? data.sessionVersion : 1,
            createdBy: data.createdBy || 'admin',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            lastLoginAt: data.lastLoginAt
          };
        });

        // Merge any locally cached officers that might have been created while offline or awaiting cloud sync
        const currentCached = readCachedOfficers();
        for (const localOfficer of currentCached) {
          if (!list.some((o) => o.id === localOfficer.id || o.officerIdLower === localOfficer.officerIdLower)) {
            list.push(localOfficer);
          }
        }

        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        writeCachedOfficers(list);
        callback(list);
      },
      (err) => {
        console.warn('Traffic officers subscription note (using cached):', err);
        callback(readCachedOfficers());
      }
    );
  } catch (subErr) {
    console.warn('Failed to attach Firestore snapshot (using cached):', subErr);
    callback(readCachedOfficers());
    return () => {};
  }
};

/**
 * Seed a default Traffic Police officer account ("police" / "police123") ONLY once on initial setup
 * so Admin retains complete control if they later edit, suspend, or delete it.
 */
export const seedDefaultTrafficOfficerIfNeeded = async (): Promise<void> => {
  try {
    const cached = readCachedOfficers();
    const hasPoliceLocally = cached.some((o) => o.id === 'police');

    const salt = generateSalt();
    const passwordHash = await hashOfficerPassword('police123', salt);
    const now = new Date().toISOString();

    const defaultOfficer: TrafficOfficerAccount = {
      id: 'police',
      officerId: 'police',
      officerIdLower: 'police',
      fullName: 'Traffic Officer Unit 1',
      badgeNumber: 'TP-BLR-401',
      assignedZone: 'Central Emergency Corridor',
      passwordHash,
      passwordSalt: salt,
      active: true,
      isOnline: false,
      sessionVersion: 1,
      createdBy: 'system-init',
      createdAt: now,
      updatedAt: now
    };

    if (!hasPoliceLocally) {
      writeCachedOfficers([defaultOfficer, ...cached]);
    }

    if (typeof window !== 'undefined' && localStorage.getItem(TRAFFIC_SEEDED_KEY) === 'true') {
      return;
    }

    try {
      const seedRef = doc(db, 'systemConfig', 'trafficAuthSeed');
      const seedSnap = await getDoc(seedRef).catch(() => null);
      if (seedSnap && seedSnap.exists() && seedSnap.data()?.seeded === true) {
        if (typeof window !== 'undefined') localStorage.setItem(TRAFFIC_SEEDED_KEY, 'true');
        return;
      }

      await setDoc(doc(db, 'trafficOfficers', 'police'), defaultOfficer, { merge: true });
      await setDoc(seedRef, { seeded: true, seededAt: now }, { merge: true });
      if (typeof window !== 'undefined') localStorage.setItem(TRAFFIC_SEEDED_KEY, 'true');
    } catch (fsErr) {
      console.warn('Default officer cloud seed note (cached locally):', fsErr);
    }
  } catch (err) {
    console.warn('Default traffic officer seed note:', err);
  }
};

/**
 * Create a new Traffic Police Officer ID & Password from the Admin Command Center.
 */
export const createTrafficOfficer = async (input: {
  officerId: string;
  password: string;
  fullName: string;
  badgeNumber?: string;
  assignedZone?: string;
}): Promise<TrafficOfficerAccount> => {
  const cleanId = input.officerId.trim();
  const cleanPass = input.password.trim();
  const cleanName = input.fullName.trim() || cleanId;

  if (cleanId.length < 3) {
    throw new Error('Officer ID must be at least 3 characters.');
  }
  if (cleanPass.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }

  const idLower = cleanId.toLowerCase();
  const docId = normalizeOfficerDocId(idLower);

  // Check duplicate in local cache first
  const cachedList = readCachedOfficers();
  if (cachedList.some((o) => o.officerIdLower === idLower || o.id === docId)) {
    throw new Error(`Officer ID "${cleanId}" already exists. Choose a different ID.`);
  }

  // Check duplicate in Firestore if online
  try {
    const existingDoc = await getDoc(doc(db, 'trafficOfficers', docId)).catch(() => null);
    if (existingDoc && existingDoc.exists()) {
      throw new Error(`Officer ID "${cleanId}" already exists. Choose a different ID.`);
    }
  } catch (checkErr) {
    console.warn('Firestore duplicate check note:', checkErr);
  }

  const salt = generateSalt();
  const passwordHash = await hashOfficerPassword(cleanPass, salt);
  const now = new Date().toISOString();

  const newAccount: TrafficOfficerAccount = {
    id: docId,
    officerId: cleanId,
    officerIdLower: idLower,
    fullName: cleanName,
    badgeNumber: input.badgeNumber?.trim() || `TP-${Math.floor(100 + Math.random() * 900)}`,
    assignedZone: input.assignedZone?.trim() || 'City Emergency Corridor',
    passwordHash,
    passwordSalt: salt,
    active: true,
    isOnline: false,
    sessionVersion: 1,
    createdBy: 'admin',
    createdAt: now,
    updatedAt: now
  };

  // 1. ALWAYS persist to local storage first so officer is immediately guaranteed available
  const updatedCache = [newAccount, ...cachedList.filter((o) => o.id !== docId)];
  writeCachedOfficers(updatedCache);

  // 2. Persist to Firestore with error resilience
  try {
    await setDoc(doc(db, 'trafficOfficers', docId), newAccount);
    await setDoc(
      doc(db, 'systemConfig', 'trafficAuthSeed'),
      { seeded: true, seededAt: now },
      { merge: true }
    ).catch(() => {});
  } catch (firestoreErr) {
    console.warn('Firestore sync note for created officer (persisted locally):', firestoreErr);
  }

  return newAccount;
};

/**
 * Authenticate a Traffic Police Officer using ONLY Officer ID and Password (no fingerprint required).
 */
export const authenticateTrafficOfficer = async (
  officerIdInput: string,
  passwordInput: string
): Promise<{ success: boolean; session?: PoliceOfficerSession; error?: string }> => {
  const cleanId = officerIdInput.trim();
  const cleanPass = passwordInput.trim();

  if (!cleanId || !cleanPass) {
    return { success: false, error: 'Please enter both Officer ID and Password.' };
  }

  const idLower = cleanId.toLowerCase();
  const docId = normalizeOfficerDocId(idLower);

  let account: TrafficOfficerAccount | null = null;

  try {
    // 1. Direct lookup by normalized doc ID
    const directSnap = await getDoc(doc(db, 'trafficOfficers', docId));
    if (directSnap.exists()) {
      account = { ...(directSnap.data() as TrafficOfficerAccount), id: directSnap.id };
    } else {
      // 2. Query by officerIdLower
      const q = query(collection(db, 'trafficOfficers'), where('officerIdLower', '==', idLower));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const d = qSnap.docs[0];
        account = { ...(d.data() as TrafficOfficerAccount), id: d.id };
      }
    }
  } catch (err) {
    console.warn('Firestore officer lookup fallback to cache:', err);
    const cached = readCachedOfficers();
    account = cached.find((o) => o.officerIdLower === idLower || o.id === docId) || null;
  }

  if (!account) {
    // Also check cached list once if Firestore returned empty due to offline mode
    const cached = readCachedOfficers();
    account = cached.find((o) => o.officerIdLower === idLower || o.id === docId) || null;
  }

  if (!account) {
    return {
      success: false,
      error: 'Invalid Officer ID or Password. Ask your System Admin to create an Officer ID.'
    };
  }

  if (!account.active) {
    return {
      success: false,
      error: 'This Officer ID is suspended by Administrator. Contact Dispatch Command.'
    };
  }

  const computedHash = await hashOfficerPassword(cleanPass, account.passwordSalt);
  if (!constantTimeEqual(computedHash, account.passwordHash)) {
    return {
      success: false,
      error: 'Incorrect Password for this Officer ID.'
    };
  }

  const nowISO = new Date().toISOString();
  await updateDoc(doc(db, 'trafficOfficers', account.id), {
    isOnline: true,
    lastLoginAt: nowISO,
    updatedAt: nowISO
  }).catch(() => {});

  const session: PoliceOfficerSession = {
    isLoggedIn: true,
    accountId: account.id,
    officerId: account.officerId,
    username: account.officerId,
    fullName: account.fullName,
    badgeNumber: account.badgeNumber,
    assignedZone: account.assignedZone,
    sessionVersion: account.sessionVersion || 1,
    loginTime: nowISO
  };

  return { success: true, session };
};

/**
 * Reset an officer's password from Admin Dashboard and increment sessionVersion so existing sessions re-verify.
 */
export const resetTrafficOfficerPassword = async (
  accountId: string,
  newPassword: string,
  currentSessionVersion = 1
): Promise<void> => {
  const cleanPass = newPassword.trim();
  if (cleanPass.length < 4) {
    throw new Error('New password must be at least 4 characters.');
  }
  const salt = generateSalt();
  const passwordHash = await hashOfficerPassword(cleanPass, salt);
  const now = new Date().toISOString();

  // 1. Update local cache
  const cached = readCachedOfficers();
  const updated = cached.map((o) => {
    if (o.id === accountId) {
      return {
        ...o,
        passwordHash,
        passwordSalt: salt,
        sessionVersion: currentSessionVersion + 1,
        isOnline: false,
        updatedAt: now
      };
    }
    return o;
  });
  writeCachedOfficers(updated);

  // 2. Update Firestore
  try {
    await updateDoc(doc(db, 'trafficOfficers', accountId), {
      passwordHash,
      passwordSalt: salt,
      sessionVersion: currentSessionVersion + 1,
      isOnline: false,
      updatedAt: now
    });
  } catch (fsErr) {
    console.warn('Firestore password reset note (updated locally):', fsErr);
  }
};

/**
 * Enable or suspend a Traffic Police officer account. Suspending immediately invalidates active sessions.
 */
export const toggleTrafficOfficerActive = async (
  accountId: string,
  active: boolean,
  currentSessionVersion = 1
): Promise<void> => {
  const now = new Date().toISOString();

  // 1. Update local cache
  const cached = readCachedOfficers();
  const updated = cached.map((o) => {
    if (o.id === accountId) {
      return {
        ...o,
        active,
        isOnline: active ? o.isOnline : false,
        sessionVersion: active ? o.sessionVersion : currentSessionVersion + 1,
        updatedAt: now
      };
    }
    return o;
  });
  writeCachedOfficers(updated);

  // 2. Update Firestore
  try {
    await updateDoc(doc(db, 'trafficOfficers', accountId), {
      active,
      ...(active ? {} : { isOnline: false, sessionVersion: currentSessionVersion + 1 }),
      updatedAt: now
    });
  } catch (fsErr) {
    console.warn('Firestore toggle officer note (updated locally):', fsErr);
  }
};

/**
 * Force sign-out an active officer device session immediately while keeping the account enabled.
 */
export const forceLogoutTrafficOfficer = async (
  accountId: string,
  currentSessionVersion = 1
): Promise<void> => {
  const now = new Date().toISOString();

  // 1. Update local cache
  const cached = readCachedOfficers();
  const updated = cached.map((o) => {
    if (o.id === accountId) {
      return {
        ...o,
        isOnline: false,
        sessionVersion: currentSessionVersion + 1,
        updatedAt: now
      };
    }
    return o;
  });
  writeCachedOfficers(updated);

  // 2. Update Firestore
  try {
    await updateDoc(doc(db, 'trafficOfficers', accountId), {
      isOnline: false,
      sessionVersion: currentSessionVersion + 1,
      updatedAt: now
    });
  } catch (fsErr) {
    console.warn('Firestore force logout note (updated locally):', fsErr);
  }
};

/**
 * Update officer metadata (Name, Badge, Assigned Zone).
 */
export const updateTrafficOfficerDetails = async (
  accountId: string,
  updates: { fullName?: string; badgeNumber?: string; assignedZone?: string }
): Promise<void> => {
  const now = new Date().toISOString();

  // 1. Update local cache
  const cached = readCachedOfficers();
  const updated = cached.map((o) => {
    if (o.id === accountId) {
      return {
        ...o,
        ...updates,
        updatedAt: now
      };
    }
    return o;
  });
  writeCachedOfficers(updated);

  // 2. Update Firestore
  try {
    await updateDoc(doc(db, 'trafficOfficers', accountId), {
      ...updates,
      updatedAt: now
    });
  } catch (fsErr) {
    console.warn('Firestore update officer details note (updated locally):', fsErr);
  }
};

/**
 * Permanently delete a Traffic Police officer ID.
 */
export const deleteTrafficOfficer = async (accountId: string): Promise<void> => {
  // 1. Remove from local cache immediately
  const cached = readCachedOfficers().filter((o) => o.id !== accountId);
  writeCachedOfficers(cached);

  // 2. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'trafficOfficers', accountId));
  } catch (fsErr) {
    console.warn('Firestore delete officer note (removed locally):', fsErr);
  }
};

/**
 * Mark officer offline on voluntary logout.
 */
export const markTrafficOfficerOffline = async (accountId?: string): Promise<void> => {
  if (!accountId) return;
  await updateDoc(doc(db, 'trafficOfficers', accountId), {
    isOnline: false,
    updatedAt: new Date().toISOString()
  }).catch(() => {});
};

/**
 * Subscribe to system-wide Admin Broadcast banner.
 */
export const subscribeGlobalBroadcast = (
  callback: (broadcast: SystemBroadcast | null) => void
): (() => void) => {
  return onSnapshot(
    doc(db, 'systemConfig', 'globalBroadcast'),
    (snap) => {
      if (snap.exists() && snap.data()?.active) {
        callback(snap.data() as SystemBroadcast);
      } else {
        callback(null);
      }
    },
    () => {
      callback(null);
    }
  );
};

export const publishGlobalBroadcast = async (
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'critical' = 'warning'
): Promise<void> => {
  await setDoc(doc(db, 'systemConfig', 'globalBroadcast'), {
    active: true,
    title: title.trim() || 'Admin System Directive',
    message: message.trim(),
    severity,
    createdAt: new Date().toISOString(),
    createdBy: 'Admin Command'
  });
};

export const clearGlobalBroadcast = async (): Promise<void> => {
  await setDoc(
    doc(db, 'systemConfig', 'globalBroadcast'),
    {
      active: false,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
};
