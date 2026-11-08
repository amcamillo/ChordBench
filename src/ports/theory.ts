import type { AccidentalPreference, ChordResult } from '../domain/harmony/types.ts';

export interface TheoryPort {
  parse(symbol: string): ChordResult;
  transpose(symbol: string, semitones: number, preference: AccidentalPreference): ChordResult;
  transposeNote(note: string, semitones: number, preference: AccidentalPreference): string;
}
