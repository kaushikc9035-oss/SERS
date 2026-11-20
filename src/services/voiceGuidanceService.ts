/**
 * SERS Emergency Voice Guidance & Driver Hands-Free HUD Service
 * Native SpeechSynthesis and Web Audio API integration for real-time auditory navigation cues.
 */

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
  private activeUtterance: any = null;
  private audioCtx: any = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        if (localStorage.getItem(VoiceGuidanceService.STORAGE_KEY) === null) {
          localStorage.setItem(VoiceGuidanceService.STORAGE_KEY, 'true');
        }
      } catch {}
    }
  }

  /**
   * Check if SpeechSynthesis is supported in the current environment
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  /**
   * Check if Voice HUD is enabled by driver
   */
  public isEnabled(): boolean {
    if (typeof localStorage === 'undefined') return false;
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
      this.speak('Voice guidance active', 'toggle_confirm', 1000);
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

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // AudioContext is optional; ignore if blocked by browser policy
    }
  }

  /**
   * Speak an emergency navigation cue with deduplication cooldown
   */
  public speak(
    text: string,
    cueKey: string,
    cooldownMs: number = 8000,
    priority: boolean = false
  ): boolean {
    if (!this.isEnabled()) return false;
    if (!this.isSupported()) return false;

    const now = Date.now();
    const lastSpoken = this.cooldownMap.get(cueKey) || 0;

    // Check cooldown unless priority override
    if (!priority && now - lastSpoken < cooldownMs) {
      return false;
    }

    this.cooldownMap.set(cueKey, now);

    try {
      // Cancel previous utterance to prevent queue lag in high-speed driving
      window.speechSynthesis.cancel();

      // Play soft radio chime
      this.playChime();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05; // Slightly brisk for responsive navigation
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice =
          voices.find(v => v.lang === 'en-US' && !v.name.includes('Google') && !v.name.includes('Preview')) ||
          voices.find(v => v.lang.startsWith('en')) ||
          voices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      // Keep strong reference to prevent premature garbage collection
      this.activeUtterance = utterance;
      utterance.onend = () => {
        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
        }
      };
      utterance.onerror = () => {
        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
        }
      };

      // Slight delay (40ms) after chime for crystal clear speech
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {}
      }, 40);

      const event: VoicePromptEvent = {
        text,
        cueKey,
        timestamp: now,
        enabled: true
      };
      this.lastSpokenEvent = event;
      this.notify(event);
      return true;
    } catch (e) {
      console.warn('Voice guidance speech failed:', e);
      return false;
    }
  }

  /**
   * Stop active speech
   */
  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.activeUtterance = null;
  }

  /**
   * Announce Emergency Dispatch
   */
  public announceDispatch(hospitalName: string, bedCode?: string): boolean {
    const bedMsg = bedCode ? ` Emergency bed reserved.` : '';
    const text = `Emergency dispatched. Clearing green corridor to ${hospitalName}.${bedMsg}`;
    return this.speak(text, `dispatch_${hospitalName}`, 12000, true);
  }

  /**
   * Announce approaching traffic signal / green corridor junction
   */
  public announceApproachingJunction(junctionName: string, distanceMeters: number): boolean {
    const text = `Approaching ${junctionName} in ${Math.round(distanceMeters)} meters. Green corridor active.`;
    return this.speak(text, `junction_${junctionName}`, 15000);
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
    return this.speak(text, `completed_${hospitalName}`, 20000, true);
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
