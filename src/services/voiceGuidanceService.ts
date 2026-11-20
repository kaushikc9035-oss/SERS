/**
 * SERS Emergency Voice Guidance & Driver Hands-Free HUD Service
 * Native Android TextToSpeech (via @capacitor-community/text-to-speech) + Web Speech API fallback.
 * Guaranteed audio playback on Android devices, WebViews, and desktop browsers.
 */

import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export interface VoicePromptEvent {
  text: string;
  cueKey: string;
  timestamp: number;
  enabled: boolean;
}

type VoiceListener = (event: VoicePromptEvent) => void;

class VoiceGuidanceService {
  private static STORAGE_KEY = 'sers_voice_hud_enabled';
  private cooldownMap: Map<string, number> = new Map();
  private listeners: Set<VoiceListener> = new Set();
  private lastSpokenEvent: VoicePromptEvent | null = null;
  private audioCtx: any = null;
  private isAudioUnlocked: boolean = false;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        if (localStorage.getItem(VoiceGuidanceService.STORAGE_KEY) === null) {
          localStorage.setItem(VoiceGuidanceService.STORAGE_KEY, 'true');
        }
      } catch {}
    }

    // Pre-unlock voices on browser platforms (non-native only)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !Capacitor.isNativePlatform()) {
      try {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      } catch {}
    }
  }

  /**
   * Unlock audio context and TTS engines on user gesture
   */
  public unlockAudio(): void {
    if (this.isAudioUnlocked) return;
    this.isAudioUnlocked = true;

    if (Capacitor.isNativePlatform()) {
      // Native Android handles its own audio stream; do not touch web audio
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if (!this.audioCtx || this.audioCtx.state === 'closed') {
            this.audioCtx = new AudioContextClass();
          }
          if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
        }
      }
    } catch {}
  }

  /**
   * Check if speech is supported (either native Android TTS or Web SpeechSynthesis)
   */
  public isSupported(): boolean {
    if (Capacitor.isNativePlatform()) {
      return true; // Native Android TextToSpeech is supported
    }
    return (
      typeof window !== 'undefined' &&
      ('speechSynthesis' in window || 'AudioContext' in window || 'webkitAudioContext' in window)
    );
  }

  /**
   * Check if Voice HUD is enabled by driver
   */
  public isEnabled(): boolean {
    if (typeof localStorage === 'undefined') return true;
    try {
      return localStorage.getItem(VoiceGuidanceService.STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  /**
   * Enable or disable the Voice HUD
   */
  public setEnabled(enabled: boolean): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(VoiceGuidanceService.STORAGE_KEY, enabled ? 'true' : 'false');
      } catch {}
    }
    if (!enabled) {
      this.stop();
    }
    this.notify({
      text: enabled ? 'Voice Guidance HUD Enabled' : 'Voice Guidance HUD Muted',
      cueKey: 'system_toggle',
      timestamp: Date.now(),
      enabled
    });
  }

  /**
   * Toggle Voice HUD status
   */
  public toggle(): boolean {
    const nextState = !this.isEnabled();
    this.setEnabled(nextState);
    if (nextState) {
      this.speak('Voice guidance active', 'toggle_confirm', 500, true);
    }
    return nextState;
  }

  /**
   * Subscribe to speech events for HUD status badges
   */
  public subscribe(listener: VoiceListener): () => void {
    this.listeners.add(listener);
    if (this.lastSpokenEvent) {
      listener(this.lastSpokenEvent);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastEvent(): VoicePromptEvent | null {
    return this.lastSpokenEvent;
  }

  /**
   * Play subtle 2-tone pre-announcement radio chime (587Hz -> 880Hz)
   */
  private playChime(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.06); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.20);
    } catch {
      // AudioContext is optional; ignore if blocked
    }
  }

  /**
   * Speak an emergency navigation cue with dual native/web engine
   */
  public speak(
    text: string,
    cueKey: string,
    cooldownMs: number = 8000,
    priority: boolean = false
  ): boolean {
    if (!this.isEnabled()) return false;

    const now = Date.now();
    const lastSpoken = this.cooldownMap.get(cueKey) || 0;

    // Check cooldown unless priority override
    if (!priority && now - lastSpoken < cooldownMs) {
      return false;
    }

    this.cooldownMap.set(cueKey, now);
    this.unlockAudio();

    // Play subtle radio chime
    this.playChime();

    const event: VoicePromptEvent = {
      text,
      cueKey,
      timestamp: now,
      enabled: true
    };
    this.lastSpokenEvent = event;
    this.notify(event);

    // Primary Engine: Native Android / Capacitor TextToSpeech
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.speak({
        text,
        lang: 'en-US',
        rate: 1.05,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback', // Plays audio with full playback priority on mobile
        queueStrategy: QueueStrategy.Flush
      }).catch((nativeErr) => {
        console.warn('Native TextToSpeech failed, attempting web speech synthesis fallback:', nativeErr);
        this.speakViaWebSpeech(text);
      });
      return true;
    }

    // Secondary Engine: Web Speech API (for desktop / web preview)
    return this.speakViaWebSpeech(text);
  }

  /**
   * Fallback Web Speech Synthesis
   */
  private speakViaWebSpeech(text: string): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice =
          voices.find(v => v.lang === 'en-US' && !v.name.includes('Preview')) ||
          voices.find(v => v.lang.startsWith('en')) ||
          voices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {}
      }, 50);

      return true;
    } catch (e) {
      console.warn('Web speech synthesis failed:', e);
      return false;
    }
  }

  /**
   * Stop active speech
   */
  public stop(): void {
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => {});
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  /**
   * Announce Emergency Dispatch
   */
  public announceDispatch(hospitalName: string, bedCode?: string): boolean {
    const bedMsg = bedCode ? ` Emergency bed reserved.` : '';
    const text = `Emergency dispatched. Clearing green corridor to ${hospitalName}.${bedMsg}`;
    return this.speak(text, `dispatch_${hospitalName}`, 10000, true);
  }

  /**
   * Announce approaching traffic signal / green corridor junction
   */
  public announceApproachingJunction(junctionName: string, distanceMeters: number): boolean {
    const text = `Approaching ${junctionName} in ${Math.round(distanceMeters)} meters. Green corridor active.`;
    return this.speak(text, `junction_${junctionName}`, 15000);
  }

  /**
   * Announce upcoming dynamic turn along the driving corridor
   */
  public announceUpcomingTurn(
    turnType: 'left' | 'right' | 'slight_left' | 'slight_right' | 'sharp_left' | 'sharp_right',
    distanceMeters: number,
    roadName?: string
  ): boolean {
    const dirStr = turnType.replace('_', ' ');
    const roadStr = roadName ? ` onto ${roadName}` : '';
    const text = `In ${Math.round(distanceMeters)} meters, turn ${dirStr}${roadStr}. Green corridor confirmed.`;
    return this.speak(text, `turn_${turnType}_${Math.round(distanceMeters / 100)}`, 14000);
  }

  /**
   * Announce hospital emergency bay arrival
   */
  public announceHospitalBayArrival(hospitalName: string, distanceMeters: number = 300): boolean {
    const text = `Arriving at ${hospitalName} emergency bay in ${Math.round(distanceMeters)} meters. Trauma team notified.`;
    return this.speak(text, `bay_arrival_${hospitalName}`, 30000, true);
  }

  /**
   * Announce patient arrival / mission completed
   */
  public announceEmergencyCompleted(hospitalName: string): boolean {
    const text = `Patient arrived safely at ${hospitalName}. Green corridor mission completed.`;
    return this.speak(text, `completed_${hospitalName}`, 15000, true);
  }

  private notify(event: VoicePromptEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {}
    }
  }
}

export const voiceGuidance = new VoiceGuidanceService();
export default voiceGuidance;
