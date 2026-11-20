import { describe, it, expect, beforeEach } from 'vitest';

// Polyfill localStorage for Node.js test environment if needed
const mockStorage = new Map<string, string>();
const storageMock = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, val: string) => { mockStorage.set(key, String(val)); },
  removeItem: (key: string) => { mockStorage.delete(key); },
  clear: () => { mockStorage.clear(); },
  get length() { return mockStorage.size; },
  key: (i: number) => Array.from(mockStorage.keys())[i] || null
};

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
  configurable: true
});

import { voiceGuidance } from '../src/services/voiceGuidanceService';

describe('Voice Guidance Service Unit Tests', () => {
  beforeEach(() => {
    storageMock.clear();
    voiceGuidance.setEnabled(true);
  });

  it('TC-VG-01: Correctly reads default enabled state', () => {
    expect(voiceGuidance.isEnabled()).toBe(true);
  });

  it('TC-VG-02: Toggles enabled state properly and persists to storage', () => {
    voiceGuidance.setEnabled(false);
    expect(voiceGuidance.isEnabled()).toBe(false);
    expect(storageMock.getItem('sers_voice_hud_enabled')).toBe('false');

    voiceGuidance.setEnabled(true);
    expect(voiceGuidance.isEnabled()).toBe(true);
    expect(storageMock.getItem('sers_voice_hud_enabled')).toBe('true');
  });

  it('TC-VG-03: Subscribes and receives notifications on status toggle', () => {
    const events: any[] = [];
    const unsubscribe = voiceGuidance.subscribe(event => {
      events.push(event);
    });

    voiceGuidance.setEnabled(false);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1].enabled).toBe(false);
    expect(events[events.length - 1].text).toContain('Muted');

    unsubscribe();
  });

  it('TC-VG-04: Gracefully handles environments where SpeechSynthesis is unavailable', () => {
    // In headless test runner, window.speechSynthesis may be undefined
    const isSupp = voiceGuidance.isSupported();
    expect(typeof isSupp).toBe('boolean');

    // Calling speak shouldn't throw an unhandled exception
    const spoken = voiceGuidance.speak('Approaching junction', 'test_cue', 1000);
    expect(typeof spoken).toBe('boolean');
  });

  it('TC-VG-05: Formats emergency announcements cleanly without throwing', () => {
    const dispatchSpoken = voiceGuidance.announceDispatch('Apollo Hospital', 'BED-APO-101');
    expect(typeof dispatchSpoken).toBe('boolean');

    const junctionSpoken = voiceGuidance.announceApproachingJunction('Silk Board Junction', 450);
    expect(typeof junctionSpoken).toBe('boolean');

    const turnSpoken = voiceGuidance.announceUpcomingTurn('right', 180, 'Hosur Road');
    expect(typeof turnSpoken).toBe('boolean');

    const arrivalSpoken = voiceGuidance.announceHospitalBayArrival('Apollo Hospital', 250);
    expect(typeof arrivalSpoken).toBe('boolean');

    const completedSpoken = voiceGuidance.announceEmergencyCompleted('Apollo Hospital');
    expect(typeof completedSpoken).toBe('boolean');
  });
});
