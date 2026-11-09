import type { ParsedChart } from '../chart/parser.ts';
import type { ChordDefinition, AccidentalPreference } from '../harmony/types.ts';
import type { TheoryPort } from '../../ports/theory.ts';
import { pianoVoicing, spelledMidiName, type PianoNote } from '../instruments/voicings.ts';
import { buildTransition, type TransitionCandidate } from '../song/transitions.ts';

export interface ScoreChord { id: string; symbol: string; section: string; chord?: ChordDefinition; notes: PianoNote[]; candidates: TransitionCandidate[]; chosen?: TransitionCandidate }
export function buildScore(chart: ParsedChart, theory: TheoryPort, shift: number, preference: AccidentalPreference, choices: Record<string, string> = {}): ScoreChord[] {
  const entries: ScoreChord[] = chart.occurrences.map(item => {
    const result = theory.transpose(item.symbol, shift, preference);
    return { id: item.id, symbol: result.status === 'resolved' ? result.chord.symbol : item.symbol, section: item.section,
      chord: result.status === 'resolved' ? result.chord : undefined, notes: [], candidates: [] };
  });
  for (let index = 0; index < entries.length; index++) {
    const current = entries[index], next = entries[index + 1];
    if (!current.chord) continue;
    if (!current.notes.length) current.notes = pianoVoicing(current.chord);
    if (!next?.chord) continue;
    current.candidates = buildTransition(current.chord, next.chord, current.notes).candidates;
    current.chosen = current.candidates.find(candidate => candidate.id === choices[current.id]) ?? current.candidates[0];
    if (current.chosen) next.notes = current.chosen.to;
  }
  return entries;
}

// Diatonic staff positions use spelling, not chromatic distance (B# and C differ).
export function staffNote(note: PianoNote) {
  const name = spelledMidiName(note.midi, note.spelling);
  const match = /^([A-G])([#b]*)(-?\d+)$/.exec(name);
  if (!match) throw new Error(`Unsupported note spelling: ${name}`);
  const step = Number(match[3]) * 7 + 'CDEFGAB'.indexOf(match[1]);
  const clef = step >= 28 ? 'treble' : 'bass';
  const bottom = clef === 'treble' ? 30 : 18;
  const y = (clef === 'treble' ? 146 : 254) - (step - bottom) * 6;
  const ledgers: number[] = [];
  if (step < bottom) for (let n = bottom - 2; n >= step; n -= 2) ledgers.push((clef === 'treble' ? 146 : 254) - (n - bottom) * 6);
  if (step > bottom + 8) for (let n = bottom + 10; n <= step; n += 2) ledgers.push((clef === 'treble' ? 146 : 254) - (n - bottom) * 6);
  return { name, step, y, clef, ledgers, accidental: match[2].replaceAll('#', '♯').replaceAll('b', '♭') };
}

export function notePositions(notes: PianoNote[], x: number) {
  let previous: ReturnType<typeof staffNote> | undefined, displaced = false;
  return [...notes].sort((a, b) => a.midi - b.midi).map(note => {
    const info = staffNote(note);
    displaced = !!previous && previous.clef === info.clef && info.step - previous.step <= 1 && !displaced;
    previous = info;
    return { ...info, note, x: x + (displaced ? 17 : 0) };
  });
}
