import type { ChordDefinition } from '../harmony/types.ts';
import { pianoVoicing, spelledMidiName } from '../instruments/voicings.ts';

const ROLES: Record<string, string> = {
  '1P': 'Root', '2m': 'Minor second', '2M': 'Major second', '3m': 'Minor third', '3M': 'Major third',
  '4P': 'Perfect fourth', '5d': 'Diminished fifth', '5P': 'Perfect fifth', '5A': 'Augmented fifth',
  '6m': 'Minor sixth', '6M': 'Major sixth', '7d': 'Diminished seventh', '7m': 'Minor seventh',
  '7M': 'Major seventh', '9m': 'Minor ninth', '9M': 'Major ninth', '9A': 'Augmented ninth', '11P': 'Perfect eleventh', '11A': 'Augmented eleventh', '13m': 'Minor thirteenth', '13M': 'Major thirteenth',
};
export interface StructureNote { id: number; spelling: string; role: string; interval: string; pitchClass: number; midi: number; referenceName: string }
export interface ChordStructure { symbol: string; notes: StructureNote[]; bass: string | null }

export function buildChordStructure(chord: ChordDefinition): ChordStructure {
  const voicing = pianoVoicing(chord);
  const tones = voicing.filter(note => note.role !== 'Bass');
  const bass = voicing.find(note => note.role === 'Bass');
  return { symbol: chord.symbol, notes: tones.map((note, id) => ({ id, spelling: note.spelling,
    role: ROLES[note.role] ?? `Interval ${note.role}`, interval: note.role, pitchClass: note.midi % 12,
    midi: note.midi, referenceName: spelledMidiName(note.midi, note.spelling) })),
  bass: bass ? spelledMidiName(bass.midi, bass.spelling) : null };
}

export function referenceDistance(a: StructureNote, b: StructureNote): number {
  return Math.abs(b.midi - a.midi);
}
