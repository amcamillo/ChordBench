import type { TimeNote } from './fifthsTime.ts';

export const MORPH_LEAD_SECONDS = .18;
export function morphAmount(position: number, focus: number, secondsPerChord: number): number {
  const remaining = (focus + 1 - position) * secondsPerChord;
  const t = Math.max(0, Math.min(1, 1 - remaining / MORPH_LEAD_SECONDS));
  return t * t * (3 - 2 * t);
}
// Pitch-class graphics matching only; these are not octave-specific voices.
export function pairMorphNotes(from: TimeNote[], to: TimeNote[]): { from?: TimeNote; to?: TimeNote }[] {
  const unused = [...to];
  const pairs = from.map(note => {
    const index = unused.findIndex(other => other.pitch === note.pitch);
    return { from: note, to: index < 0 ? undefined : unused.splice(index, 1)[0] };
  });
  for (const pair of pairs) if (!pair.to && unused.length) {
    let best = 0;
    const distance = (pitch: number) => Math.min((pitch - pair.from.pitch + 12) % 12, (pair.from.pitch - pitch + 12) % 12);
    unused.forEach((note, index) => { if (distance(note.pitch) < distance(unused[best].pitch)) best = index; });
    pair.to = unused.splice(best, 1)[0];
  }
  return [...pairs, ...unused.map(note => ({ to: note }))];
}
