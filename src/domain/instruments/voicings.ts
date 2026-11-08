import { chroma } from '@tonaljs/note';
import type { ChordDefinition } from '../harmony/types.ts';

export interface PianoNote { midi: number; spelling: string; role: string }
export interface GuitarShape { symbol: string; name: string; frets: (number | null)[]; fingers: (number | null)[]; generated?: boolean; barre?: { fret: number; from: number; to: number } }
export const GUITAR_TUNING = [40, 45, 50, 55, 59, 64] as const; // strings 6 to 1
export const GUITAR_SHAPES: GuitarShape[] = [
  { symbol: 'C', name: 'Open C', frets: [null,3,2,0,1,0], fingers: [null,3,2,null,1,null] },
  { symbol: 'A', name: 'Open A', frets: [null,0,2,2,2,0], fingers: [null,null,1,2,3,null] },
  { symbol: 'G', name: 'Open G', frets: [3,2,0,0,0,3], fingers: [2,1,null,null,null,3] },
  { symbol: 'E', name: 'Open E', frets: [0,2,2,1,0,0], fingers: [null,2,3,1,null,null] },
  { symbol: 'D', name: 'Open D', frets: [null,null,0,2,3,2], fingers: [null,null,null,1,3,2] },
  { symbol: 'Am', name: 'Open Am', frets: [null,0,2,2,1,0], fingers: [null,null,2,3,1,null] },
  { symbol: 'Em', name: 'Open Em', frets: [0,2,2,0,0,0], fingers: [null,2,3,null,null,null] },
  { symbol: 'Dm', name: 'Open Dm', frets: [null,null,0,2,3,1], fingers: [null,null,null,2,3,1] },
  { symbol: 'F', name: 'F barre', frets: [1,3,3,2,1,1], fingers: [1,3,4,2,1,1], barre: { fret: 1, from: 6, to: 1 } },
  { symbol: 'Bm', name: 'Bm barre', frets: [null,2,4,4,3,2], fingers: [null,1,3,4,2,1], barre: { fret: 2, from: 5, to: 1 } },
];

const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export function midiName(midi: number): string { return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`; }
export function midiFrequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12); }
export function spelledMidiName(midi: number, spelling: string): string {
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const base = natural[spelling[0]];
  if (base === undefined) return midiName(midi);
  const alterations = [...spelling.slice(1)].reduce((sum, char) => sum + (char === '#' ? 1 : char === 'b' ? -1 : 0), 0);
  return `${spelling}${Math.floor((midi - base - alterations) / 12) - 1}`;
}

// A reference arrangement, not a fingering or a claim about what a performer plays.
export function pianoVoicing(chord: ChordDefinition, inversion = 0): PianoNote[] {
  const first = 60 + chord.pitchClasses[0];
  let previous = first - 1;
  const notes = chord.pitchClasses.map((pitch, i) => {
    let midi = 60 + pitch;
    while (midi <= previous) midi += 12;
    previous = midi;
    return { midi, spelling: chord.notes[i], role: chord.intervals[i] };
  });
  for (let i = 0; i < Math.min(inversion, notes.length - 1); i++) {
    const note = notes.shift()!;
    while (note.midi <= notes[notes.length - 1].midi) note.midi += 12;
    notes.push(note);
  }
  if (chord.slashBass) {
    const pitch = chroma(chord.slashBass);
    if (pitch !== null) {
      let midi = 48 + pitch;
      while (midi >= notes[0].midi) midi -= 12;
      notes.unshift({ midi, spelling: chord.slashBass, role: 'Bass' });
    }
  }
  return notes;
}

export function guitarPitches(shape: GuitarShape): (number | null)[] {
  return shape.frets.map((fret, i) => fret === null ? null : GUITAR_TUNING[i] + fret);
}

const derivedShapes = new Map<string, GuitarShape | null>();

// Search the first four frets for an exact pitch-class match. This is a
// synthesized arrangement only: no playable fingering or barre is asserted.
function deriveGuitarShape(chord: ChordDefinition): GuitarShape | null {
  const pitches = [...new Set(chord.pitchClasses)];
  const bass = chord.slashBass ? chroma(chord.slashBass) : chord.pitchClasses[0];
  if (bass === null || pitches.length > 6 || !pitches.includes(bass)) return null;
  const options = GUITAR_TUNING.map(open => [null, ...[0, 1, 2, 3, 4].filter(fret => pitches.includes((open + fret) % 12))]);
  let best: (number | null)[] | null = null;
  let bestScore = Infinity;
  const frets: (number | null)[] = [];
  function search(index: number) {
    if (index === 6) {
      const sounded = frets.map((fret, i) => fret === null ? null : GUITAR_TUNING[i] + fret).filter((value): value is number => value !== null);
      if (!sounded.length || Math.min(...sounded) % 12 !== bass || pitches.some(pitch => !sounded.some(value => value % 12 === pitch))) return;
      const fretted = frets.filter((fret): fret is number => fret !== null && fret > 0);
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      const score = (6 - sounded.length) * 3 + span * 2 + fretted.reduce((a, b) => a + b, 0) * .1;
      if (score < bestScore) { bestScore = score; best = [...frets]; }
      return;
    }
    for (const fret of options[index]) { frets.push(fret); search(index + 1); frets.pop(); }
  }
  search(0);
  return best ? { symbol: chord.symbol, name: `${chord.symbol} reference`, frets: best, fingers: Array(6).fill(null), generated: true } : null;
}

export function resolveGuitar(chord: ChordDefinition): GuitarShape[] {
  const catalogued = GUITAR_SHAPES.filter(shape => {
    // Catalogue identities are spelling-aware and transposition always re-resolves.
    if (shape.symbol !== chord.root + chord.suffix) return false;
    const pitches = guitarPitches(shape).filter((pitch): pitch is number => pitch !== null);
    if (!pitches.length || pitches.some(pitch => !chord.pitchClasses.includes(pitch % 12))) return false;
    if (chord.pitchClasses.some(pitch => !pitches.some(note => note % 12 === pitch))) return false;
    return !chord.slashBass || Math.min(...pitches) % 12 === chroma(chord.slashBass);
  });
  if (catalogued.length) return catalogued;
  if (!derivedShapes.has(chord.symbol)) {
    if (derivedShapes.size >= 256) derivedShapes.clear();
    derivedShapes.set(chord.symbol, deriveGuitarShape(chord));
  }
  const derived = derivedShapes.get(chord.symbol);
  return derived ? [derived] : [];
}
