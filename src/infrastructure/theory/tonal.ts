import { get as getChord } from '@tonaljs/chord';
import { chroma, transpose as transposeInterval } from '@tonaljs/note';
import type { TheoryPort } from '../../ports/theory.ts';
import type { AccidentalPreference, ChordResult } from '../../domain/harmony/types.ts';

// An intentional supported grammar, not everything a vendor happens to accept.
export const SUFFIXES: Record<string, string> = {
  '': '', M: '', maj: '', m: 'm', min: 'm', '-': 'm',
  '7': '7', maj7: 'maj7', M7: 'maj7', 'Δ7': 'maj7', m7: 'm7', min7: 'm7',
  dim: 'dim', '°': 'dim', dim7: 'dim7', '°7': 'dim7', m7b5: 'm7b5', 'ø7': 'm7b5',
  aug: 'aug', '+': 'aug', sus2: 'sus2', sus4: 'sus4', sus: 'sus4', add9: 'add9',
  '6': '6', m6: 'm6', '9': '9', maj9: 'maj9', m9: 'm9',
  '11': '11', m11: 'm11', '13': '13', maj13: 'maj13', m13: 'm13',
  'm7/b5': 'm7b5', 'm7(b5)': 'm7b5',
  '7b9': '7b9', '7/b9': '7b9', '7(b9)': '7b9',
  '7#9': '7#9', '7/#9': '7#9', '7(#9)': '7#9',
  '7b13': '7b13', '7/b13': '7b13', '7(b13)': '7b13',
  '7#5': '7#5', '7/5+': '7#5', '7(#5)': '7#5',
  '(add9)': 'add9', '6/9': '6add9', '6add9': '6add9', '69': '6add9',
  maj11: 'maj11', mMaj7: 'mMaj7', '7b5': '7b5', '7(b5)': '7b5',
  '9b5': '9b5', '13b9': '13b9', '7#11': '7#11', '7(#11)': '7#11',
  '7b9b13': '7b9b13', '7(b9,b13)': '7b9b13',
  m4: 'madd4', madd4: 'madd4', 'm(add4)': 'madd4',
  'm6/5+': 'm6#5', 'm6#5': 'm6#5', 'm6(#5)': 'm6#5',
};

function normalise(symbol: string): string {
  return symbol.replaceAll('♯', '#').replaceAll('♭', 'b').trim();
}

function parse(symbol: string): ChordResult {
  const match = /^([A-G](?:#{1,2}|b{1,2})?)(.*)$/.exec(normalise(symbol));
  if (!match) return { status: 'unsupported', message: 'This symbol is not supported. Your text is preserved.' };
  const [, root, remainder] = match;
  const bassMatch = /\/([A-G](?:#{1,2}|b{1,2})?)$/.exec(remainder);
  const slashBass = bassMatch?.[1];
  const rawSuffix = bassMatch ? remainder.slice(0, bassMatch.index) : remainder;
  if (rawSuffix === '7+') return { status: 'ambiguous', message: '“7+” has multiple conventions. Use maj7 for a major seventh, or edit the intended chord explicitly.' };
  if (!Object.hasOwn(SUFFIXES, rawSuffix)) return { status: 'unsupported', message: `The quality “${rawSuffix}” is not in the initial chord vocabulary.` };
  const suffix = SUFFIXES[rawSuffix];
  // Preserve the fifth in 7b13; Tonal's stock formula omits it. The library
  // also has no entry for minor sixth with an augmented fifth.
  if (suffix === 'm6#5' || suffix === '7b13') {
    const intervals = suffix === 'm6#5' ? ['1P', '3m', '5A', '6M'] : ['1P', '3M', '5P', '7m', '13m'];
    const notes = intervals.map(interval => transposeInterval(root, interval));
    const canonical = root + suffix + (slashBass ? '/' + slashBass : '');
    return { status: 'resolved', chord: { id: `chord:${canonical}`, symbol: canonical, root, suffix, quality: suffix === 'm6#5' ? 'minor sixth, augmented fifth' : 'dominant seventh, flat thirteenth', notes, intervals, pitchClasses: notes.map(note => chroma(note)!), slashBass } };
  }
  const result = getChord(root + (suffix || 'M'));
  if (result.empty) return { status: 'unsupported', message: 'No verified note formula is available for this symbol.' };
  const canonical = root + suffix + (slashBass ? '/' + slashBass : '');
  return { status: 'resolved', chord: {
    id: `chord:${canonical}`, symbol: canonical, root, suffix,
    quality: result.type || 'major', notes: result.notes, intervals: result.intervals,
    pitchClasses: result.notes.map(note => chroma(note)!), slashBass,
  } };
}

const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeNote(note: string, semitones: number, preference: AccidentalPreference): string {
  const source = normalise(note);
  const pitch = chroma(source);
  if (pitch === null) return note;
  if (semitones % 12 === 0 && preference === 'preserve') return source;
  const names = preference === 'flats' || (preference === 'preserve' && source.includes('b')) ? flatNames : sharpNames;
  return names[((pitch + semitones) % 12 + 12) % 12];
}

export const tonalTheory: TheoryPort = {
  parse,
  transposeNote,
  transpose(symbol, semitones, preference) {
    const result = parse(symbol);
    if (result.status !== 'resolved') return result;
    const chord = result.chord;
    return parse(transposeNote(chord.root, semitones, preference) + chord.suffix
      + (chord.slashBass ? '/' + transposeNote(chord.slashBass, semitones, preference) : ''));
  },
};
