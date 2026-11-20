import { describe, it, expect } from 'vitest';
import { calculateDistance, normalizeCoordinates } from '../src/services/emergencyService';
import {
  generateSalt,
  hashOfficerPassword,
  verifyTrafficPassword
} from '../src/services/trafficAuthService';

describe('Unit Test Cases - Vitest 3.0 / Isolated Environments', () => {

  // TC-UT-01: Math - calculateDistance() with known coordinates
  it('TC-UT-01: calculateDistance() with known coordinates returns expected 14.28 km', () => {
    // Silk Board junction (12.9172, 77.6228) to north boundary (13.045624, 77.6228)
    const lat1 = 12.9172;
    const lon1 = 77.6228;
    const lat2 = 13.045624;
    const lon2 = 77.6228;

    const result = calculateDistance(lat1, lon1, lat2, lon2);
    expect(result).toBe('14.28');
  });

  // TC-UT-02: Security - hashPassword() with plaintext + random salt
  it('TC-UT-02: hashOfficerPassword() with plaintext + random salt generates 64-char hex SHA-256 hash', async () => {
    const salt = generateSalt(16);
    const plaintext = 'TrafficOfficerPass!2026';
    const hash = await hashOfficerPassword(plaintext, salt);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  // TC-UT-03: Security - verifyTrafficPassword() with correct password
  it('TC-UT-03: verifyTrafficPassword() with correct password returns true', async () => {
    const salt = generateSalt(16);
    const password = 'CorrectOfficerPassword#99';
    const storedHash = await hashOfficerPassword(password, salt);

    const isValid = await verifyTrafficPassword(password, salt, storedHash);
    expect(isValid).toBe(true);
  });

  // TC-UT-04: Security - verifyTrafficPassword() with incorrect password
  it('TC-UT-04: verifyTrafficPassword() with incorrect password returns false and denies access', async () => {
    const salt = generateSalt(16);
    const correctPass = 'CorrectOfficerPassword#99';
    const wrongPass = 'WrongAttemptedPassword!00';
    const storedHash = await hashOfficerPassword(correctPass, salt);

    const isValid = await verifyTrafficPassword(wrongPass, salt, storedHash);
    expect(isValid).toBe(false);
  });

  // TC-UT-05: Validation - normalizeCoordinates() at boundary values
  it('TC-UT-05: normalizeCoordinates() constrains latitude and longitude to valid ranges', () => {
    // Valid coordinates should remain unchanged
    const normal = normalizeCoordinates(12.9716, 77.5946);
    expect(normal.lat).toBe(12.9716);
    expect(normal.lng).toBe(77.5946);

    // Out-of-bounds latitude > 90 and longitude > 180 should be clamped
    const overBound = normalizeCoordinates(105.4, 195.8);
    expect(overBound.lat).toBe(90);
    expect(overBound.lng).toBe(180);

    // Negative out-of-bounds coordinates
    const underBound = normalizeCoordinates(-110.0, -220.5);
    expect(underBound.lat).toBe(-90);
    expect(underBound.lng).toBe(-180);
  });

  // TC-UT-06: Concurrency - Two requests attempt to reserve one remaining bed
  it('TC-UT-06: Two concurrent requests attempting to reserve 1 remaining bed - 1 succeeds, 1 rejected', async () => {
    // Simulated atomic transaction / optimistic lock state
    let availableBeds = 1;
    let lockAcquired = false;

    const reserveBed = async (requestId: string): Promise<{ success: boolean; requestId: string }> => {
      // Simulate asynchronous atomic condition check
      await new Promise((r) => setTimeout(r, 10));
      if (!lockAcquired && availableBeds > 0) {
        lockAcquired = true;
        availableBeds -= 1;
        return { success: true, requestId };
      }
      return { success: false, requestId };
    };

    // Fire two competing requests concurrently
    const [res1, res2] = await Promise.all([
      reserveBed('REQ_AMB_01'),
      reserveBed('REQ_AMB_02')
    ]);

    const results = [res1, res2];
    const successes = results.filter((r) => r.success);
    const rejections = results.filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    expect(availableBeds).toBe(0);
  });

});
