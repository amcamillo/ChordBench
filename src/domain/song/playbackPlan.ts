import type { ParsedChart } from '../chart/parser.ts';
import type { AccidentalPreference } from '../harmony/types.ts';
import { guitarPitches, pianoVoicing, resolveGuitar } from '../instruments/voicings.ts';
import type { TheoryPort } from '../../ports/theory.ts';
import type { Instrument } from '../../infrastructure/audio/instrumentAudio.ts';

export interface SongEvent { occurrenceId: string; symbol: string; pitches: number[]; warning?: string }

export function buildPlaybackPlan(chart: ParsedChart, theory: TheoryPort, shift: number, preference: AccidentalPreference, instrument: Instrument): SongEvent[] {
  return chart.occurrences.map(occurrence => {
    const result = theory.transpose(occurrence.symbol, shift, preference);
    if (result.status !== 'resolved') return { occurrenceId: occurrence.id, symbol: occurrence.symbol, pitches: [], warning: 'Unrecognized chord' };
    const chord = result.chord;
    if (instrument === 'piano') return { occurrenceId: occurrence.id, symbol: chord.symbol, pitches: pianoVoicing(chord).map(note => note.midi) };
    const shape = resolveGuitar(chord)[0];
    if (!shape) return { occurrenceId: occurrence.id, symbol: chord.symbol, pitches: [], warning: 'No compatible guitar shape' };
    return { occurrenceId: occurrence.id, symbol: chord.symbol, pitches: guitarPitches(shape).filter((pitch): pitch is number => pitch !== null) };
  });
}
