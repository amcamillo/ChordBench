import type { ParsedChart } from '../chart/parser.ts';
import type { AccidentalPreference, ChordDefinition } from '../harmony/types.ts';
import type { TheoryPort } from '../../ports/theory.ts';

// Clockwise perfect fifths. Enharmonic labels are display names, not key guesses.
export const FIFTHS = [
  { pitch: 0, label: 'C' }, { pitch: 7, label: 'G' }, { pitch: 2, label: 'D' },
  { pitch: 9, label: 'A' }, { pitch: 4, label: 'E' }, { pitch: 11, label: 'B' },
  { pitch: 6, label: 'F♯/G♭' }, { pitch: 1, label: 'D♭/C♯' }, { pitch: 8, label: 'A♭/G♯' },
  { pitch: 3, label: 'E♭/D♯' }, { pitch: 10, label: 'B♭/A♯' }, { pitch: 5, label: 'F' },
] as const;

export interface TimeNote { pitch: number; spelling: string; interval: string; root: boolean }
export interface TimeChord { id: string; order: number; section: string; symbol: string; notes: TimeNote[]; bass: string | null; unresolved: boolean; definition?: ChordDefinition }

export function buildFifthsTime(chart: ParsedChart, theory: TheoryPort, shift: number, preference: AccidentalPreference): TimeChord[] {
  return chart.occurrences.map(item => {
    const result = theory.transpose(item.symbol, shift, preference);
    if (result.status !== 'resolved') return { id: item.id, order: item.order, section: item.section, symbol: item.symbol, notes: [], bass: null, unresolved: true };
    const chord = result.chord;
    return { id: item.id, order: item.order, section: item.section, symbol: chord.symbol, bass: chord.slashBass ?? null, unresolved: false, definition: chord,
      notes: chord.notes.map((spelling, i) => ({ pitch: chord.pitchClasses[i], spelling, interval: chord.intervals[i], root: i === 0 })) };
  });
}

export function sharedPitchClasses(a: TimeChord, b: TimeChord): number[] {
  const other = new Set(b.notes.map(note => note.pitch));
  return [...new Set(a.notes.map(note => note.pitch).filter(pitch => other.has(pitch)))];
}

export function fifthIndex(pitch: number): number { return FIFTHS.findIndex(note => note.pitch === ((pitch % 12) + 12) % 12); }

// The whole circle turns equally with depth: fifth positions remain 30° apart.
export function fifthsOrbitPoint(pitch: number, z: number, radius = 2.25) {
  const index = fifthIndex(pitch);
  if (index < 0) throw new Error('Invalid pitch class');
  const angle = index * Math.PI / 6 + z * .65 + Math.PI / 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z };
}
