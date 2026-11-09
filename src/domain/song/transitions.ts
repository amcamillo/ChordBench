import type { ChordDefinition } from '../harmony/types.ts';
import { pianoVoicing, type PianoNote } from '../instruments/voicings.ts';

export interface VoiceMovement { from?: PianoNote; to?: PianoNote; semitones: number | null }
export interface TransitionCandidate { id: string; from: PianoNote[]; to: PianoNote[]; movements: VoiceMovement[]; movement: number; changes: number }

// Order-preserving alignment: voices cannot cross. Entering/leaving a voice
// costs 12 for this illustrative comparison, not a musical quality judgment.
export function matchVoices(from: PianoNote[], to: PianoNote[]): VoiceMovement[] {
  const costs = Array.from({ length: from.length + 1 }, () => Array(to.length + 1).fill(0) as number[]);
  for (let i = from.length; i >= 0; i--) for (let j = to.length; j >= 0; j--) {
    if (i === from.length) costs[i][j] = (to.length - j) * 12;
    else if (j === to.length) costs[i][j] = (from.length - i) * 12;
    else costs[i][j] = Math.min(Math.abs(to[j].midi - from[i].midi) + costs[i + 1][j + 1], 12 + costs[i + 1][j], 12 + costs[i][j + 1]);
  }
  const result: VoiceMovement[] = [];
  let i = 0, j = 0;
  while (i < from.length || j < to.length) {
    if (i < from.length && j < to.length && costs[i][j] === Math.abs(to[j].midi - from[i].midi) + costs[i + 1][j + 1]) {
      result.push({ from: from[i], to: to[j], semitones: to[j].midi - from[i].midi }); i++; j++;
    } else if (i < from.length && costs[i][j] === 12 + costs[i + 1][j]) {
      result.push({ from: from[i++], semitones: null });
    } else result.push({ to: to[j++], semitones: null });
  }
  return result;
}

export function buildTransition(fromChord: ChordDefinition, toChord: ChordDefinition, fromNotes?: PianoNote[]): { shared: string[]; candidates: TransitionCandidate[] } {
  const from = fromNotes ?? pianoVoicing(fromChord);
  const shared = fromChord.notes.filter((_, index) => toChord.pitchClasses.includes(fromChord.pitchClasses[index]));
  const candidates: TransitionCandidate[] = [];
  const seen = new Set<string>();
  for (let inversion = 0; inversion < toChord.notes.length; inversion++) for (const octave of [-12, 0, 12]) {
    // Keep an explicit slash bass at its reference register under every inversion.
    const to = pianoVoicing(toChord, inversion).map(note => ({ ...note, midi: note.midi + (note.role === 'Bass' ? 0 : octave) }));
    if (to.some(note => note.midi < 36 || note.midi > 96) || to.some((note, i) => i > 0 && note.midi <= to[i - 1].midi)) continue;
    const id = to.map(note => note.midi).join('-');
    if (seen.has(id)) continue;
    seen.add(id);
    const movements = matchVoices(from, to);
    candidates.push({ id, from, to, movements, movement: movements.reduce((sum, voice) => sum + Math.abs(voice.semitones ?? 0), 0), changes: movements.filter(voice => voice.semitones === null).length });
  }
  candidates.sort((a, b) => (a.movement + a.changes * 12) - (b.movement + b.changes * 12));
  return { shared, candidates: candidates.slice(0, 3) };
}
