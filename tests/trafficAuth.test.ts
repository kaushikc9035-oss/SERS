import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateSalt,
  hashOfficerPassword,
  generateStrongPassword,
  normalizeOfficerDocId,
  authenticateAdmin,
  logoutAdmin
} from '../src/services/trafficAuthService';

describe('Traffic Police ID & Password Authentication + Admin Controls', () => {
  it('authenticates admin credentials correctly and rejects invalid attempts', () => {
    const successAdmin1 = authenticateAdmin('admin', 'admin');
    expect(successAdmin1.success).toBe(true);
    expect(successAdmin1.session?.username).toBe('admin');
    expect(successAdmin1.session?.role).toBe('admin');

    const successAdmin2 = authenticateAdmin('admin', 'admin123');
    expect(successAdmin2.success).toBe(true);

    const successAdmin3 = authenticateAdmin('admin@sers.gov.in', 'admin@123');
    expect(successAdmin3.success).toBe(true);

    const failWrongPass = authenticateAdmin('admin', 'wrong_pass');
    expect(failWrongPass.success).toBe(false);
    expect(failWrongPass.error).toBeDefined();

    const failWrongUser = authenticateAdmin('fake_admin', 'admin123');
    expect(failWrongUser.success).toBe(false);

    logoutAdmin();
  });
  it('generates distinct cryptographic salts and deterministic SHA-256 password hashes', async () => {
    const salt1 = generateSalt(16);
    const salt2 = generateSalt(16);

    expect(salt1).toHaveLength(32);
    expect(salt2).toHaveLength(32);
    expect(salt1).not.toBe(salt2);

    const hashA1 = await hashOfficerPassword('TrafficPass!99', salt1);
    const hashA2 = await hashOfficerPassword('TrafficPass!99', salt1);
    const hashB = await hashOfficerPassword('WrongPass!99', salt1);
    const hashDifferentSalt = await hashOfficerPassword('TrafficPass!99', salt2);

    expect(hashA1).toHaveLength(64);
    expect(hashA1).toBe(hashA2);
    expect(hashA1).not.toBe(hashB);
    expect(hashA1).not.toBe(hashDifferentSalt);
  });

  it('normalizes officer IDs safely for Firestore document keys', () => {
    expect(normalizeOfficerDocId(' TP-101 ')).toBe('tp-101');
    expect(normalizeOfficerDocId('Inspector.Rao@BLR')).toBe('inspector-rao-blr');
    expect(normalizeOfficerDocId('police')).toBe('police');
  });

  it('generates strong unambiguous passwords of requested length', () => {
    const p8 = generateStrongPassword(8);
    const p12 = generateStrongPassword(12);

    expect(p8).toHaveLength(8);
    expect(p12).toHaveLength(12);
    expect(p8).not.toBe(p12);
    expect(p8).not.toMatch(/[O0Il1]/);
  });

  it('verifies Traffic Police auth does not trigger the biometric/fingerprint gate in App.tsx', () => {
    const appPath = path.resolve(__dirname, '../src/App.tsx');
    const appSource = fs.readFileSync(appPath, 'utf8');

    expect(appSource).toContain('!policeOfficerAuth.isLoggedIn && role !== \'traffic\'');
    expect(appSource).toContain('Traffic Police Authentication');
    expect(appSource).toContain('No Fingerprint Required');
    expect(appSource).toContain('Create Traffic Police ID');
    expect(appSource).toContain('Master Admin Command Center');
  });

  it('verifies firestore.rules defines strict rules for trafficOfficers and systemConfig', () => {
    const rulesPath = path.resolve(__dirname, '../firestore.rules');
    const rulesSource = fs.readFileSync(rulesPath, 'utf8');

    expect(rulesSource).toContain('match /trafficOfficers/{officerId}');
    expect(rulesSource).toContain('isValidTrafficOfficer');
    expect(rulesSource).toContain('isValidTrafficOfficerUpdate');
    expect(rulesSource).toContain('match /systemConfig/{configId}');
    expect(rulesSource).toContain('isValidGlobalBroadcast');
  });
});
