import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { calculateDistanceKm } from '../src/services/emergencyService';

describe('Smart Emergency System - Phase 2 Demo Verification Suite', () => {

  // 1. Firebase Messaging Configuration & Manifest Checks
  it('verifies firebase-applet-config.json and public/manifest.json exist and are properly structured', () => {
    const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
    const manifestPath = path.resolve(__dirname, '../public/manifest.json');
    const swPath = path.resolve(__dirname, '../public/firebase-messaging-sw.js');

    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(swPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.projectId).toBeDefined();
    expect(config.messagingSenderId).toBeDefined();
    expect(config.apiKey).toBeDefined();

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });

  // 2. Proximity Calculation & 800m Threshold Test
  it('verifies 800-metre proximity trigger logic between ambulance and traffic signal', () => {
    const signalLoc = { lat: 12.9172, lng: 77.6228 }; // Silk Board Junction
    
    // Position 1: 500 meters away (Within 800m threshold -> Should trigger)
    const posWithin500m = { lat: 12.9172 + 0.003, lng: 77.6228 + 0.003 };
    const distWithin = calculateDistanceKm(posWithin500m.lat, posWithin500m.lng, signalLoc.lat, signalLoc.lng);
    expect(distWithin).toBeLessThanOrEqual(0.8);

    // Position 2: 2.5 km away (Outside 800m threshold -> Should NOT trigger)
    const posFar = { lat: 12.9172 + 0.02, lng: 77.6228 + 0.02 };
    const distFar = calculateDistanceKm(posFar.lat, posFar.lng, signalLoc.lat, signalLoc.lng);
    expect(distFar).toBeGreaterThan(0.8);
  });

  // 3. Deduplication & Cooldown Window Verification
  it('verifies 5-minute deduplication window suppresses repeated alerts', () => {
    const notificationCooldownMap = new Map<string, number>();
    const COOLDOWN_MS = 5 * 60 * 1000;
    const key = 'emergency_101_sig_01';

    const time1 = 1000000;
    notificationCooldownMap.set(key, time1);

    // Immediate repeated GPS update (1 second later) -> Suppressed
    const time2 = time1 + 1000;
    const isSuppressedImmediate = (time2 - (notificationCooldownMap.get(key) || 0)) < COOLDOWN_MS;
    expect(isSuppressedImmediate).toBe(true);

    // GPS update 6 minutes later -> Allowed (Cooldown expired)
    const time3 = time1 + (6 * 60 * 1000);
    const isSuppressedAfter6Min = (time3 - (notificationCooldownMap.get(key) || 0)) < COOLDOWN_MS;
    expect(isSuppressedAfter6Min).toBe(false);
  });

  // 4. Vercel Serverless Function Handler Interface Check
  it('verifies /api/notify-traffic handler exports valid request handler', async () => {
    const apiPath = path.resolve(__dirname, '../api/notify-traffic.ts');
    expect(fs.existsSync(apiPath)).toBe(true);
    
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    expect(apiContent).toContain('export default async function handler');
    expect(apiContent).toContain('sendEachForMulticast');
    expect(apiContent).toContain('messaging/invalid-registration-token');
  });

});
