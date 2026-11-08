import { midiFrequency } from '../../domain/instruments/voicings.ts';

export type Instrument = 'piano' | 'guitar';
export interface PlaybackNote { midi: number; delay: number; duration?: number }

// One lazy context; all preview calls replace the preceding audition.
export class InstrumentAudio {
  private context: AudioContext | null = null;
  private voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  private generation = 0;
  private owner: 'preview' | 'song' | 'structure' | null = null;

  get currentTime(): number { return this.context?.currentTime ?? 0; }
  get state(): AudioContextState | 'unavailable' { return this.context?.state ?? 'unavailable'; }

  async begin(owner: 'preview' | 'song' | 'structure'): Promise<number | null> {
    this.stop();
    this.owner = owner;
    const generation = this.generation;
    const context = this.context ??= new AudioContext();
    if (context.state !== 'running') await context.resume();
    if (generation !== this.generation) return null;
    if (context.state !== 'running') throw new Error('Audio is suspended. Tap play again to enable sound.');
    return context.currentTime + 0.025;
  }

  async play(notes: PlaybackNote[], instrument: Instrument, owner: 'preview' | 'structure' = 'preview'): Promise<void> {
    const start = await this.begin(owner);
    if (start === null) return;
    this.schedule(notes, instrument, start);
  }

  schedule(notes: PlaybackNote[], instrument: Instrument, start: number): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const volume = 0.22 / Math.sqrt(Math.max(1, notes.length));
    for (const note of notes) {
      const when = start + note.delay;
      const duration = Math.max(0.04, Math.min(note.duration ?? Infinity, instrument === 'guitar' ? 1.35 : 1.6));
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = instrument === 'guitar' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(midiFrequency(note.midi), when);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(volume, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      const voice = { oscillator, gain };
      this.voices.add(voice);
      oscillator.onended = () => { this.voices.delete(voice); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(when);
      oscillator.stop(when + duration + 0.02);
    }
  }

  stop(owner?: 'preview' | 'song' | 'structure'): void {
    if (owner && this.owner !== owner) return;
    this.generation++;
    this.owner = null;
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const { oscillator, gain } of this.voices) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.006);
      try { oscillator.stop(now + 0.04); } catch { /* already stopped */ }
    }
    this.voices.clear();
  }

  dispose(): void {
    this.stop();
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = null;
  }
}
