import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';
import { GUITAR_SHAPES, GUITAR_TUNING, guitarPitches, midiFrequency, midiName, pianoVoicing, resolveGuitar, spelledMidiName } from '../../src/domain/instruments/voicings.ts';
import type { ChordDefinition } from '../../src/domain/harmony/types.ts';

function chord(symbol: string): ChordDefinition {
  const result = tonalTheory.parse(symbol);
  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') throw new Error(symbol);
  return result.chord;
}

test('piano C major root position and first inversion have exact octaves', () => {
  assert.deepEqual(pianoVoicing(chord('C')).map(note => note.midi), [60, 64, 67]);
  assert.deepEqual(pianoVoicing(chord('C'), 1).map(note => note.midi), [64, 67, 72]);
  assert.equal(midiName(60), 'C4');
  assert.equal(midiFrequency(69), 440);
  assert.ok(Math.abs(midiFrequency(60) - 261.625565) < .0001);
});

test('piano slash bass is the lowest sounding note, including inversions', () => {
  for (const inversion of [0, 1, 2]) {
    const notes = pianoVoicing(chord('D/F#'), inversion);
    assert.equal(notes[0].midi % 12, 6);
    assert.equal(notes[0].role, 'Bass');
    assert.ok(notes.every((note, i) => i === 0 || note.midi > notes[i-1].midi));
  }
});

test('enharmonic spellings retain the correct written octave across C', () => {
  assert.equal(spelledMidiName(60, 'B#'), 'B#3');
  assert.equal(spelledMidiName(59, 'Cb'), 'Cb4');
  assert.equal(spelledMidiName(64, 'Fb'), 'Fb4');
});

test('guitar C X32010 produces the correct pitches and fingers', () => {
  const shape = resolveGuitar(chord('C'))[0];
  assert.deepEqual(shape.frets, [null, 3, 2, 0, 1, 0]);
  assert.deepEqual(shape.fingers, [null, 3, 2, null, 1, null]);
  assert.deepEqual(guitarPitches(shape).map(note => note === null ? null : midiName(note)), [null, 'C3', 'E3', 'G3', 'C4', 'E4']);
  assert.deepEqual(GUITAR_TUNING, [40,45,50,55,59,64]);
});

test('each proposed guitar shape matches every chord tone, its root bass, and valid fret/finger semantics', () => {
  for (const shape of GUITAR_SHAPES) {
    const definition = chord(shape.symbol);
    assert.equal(resolveGuitar(definition).includes(shape), true, shape.symbol);
    assert.equal(shape.frets.length, 6);
    assert.equal(shape.fingers.length, 6);
    for (let i = 0; i < 6; i++) {
      const fret = shape.frets[i];
      if (fret === null || fret === 0) assert.equal(shape.fingers[i], null, shape.symbol);
      else { assert.ok(fret > 0 && fret <= 4); assert.ok(shape.fingers[i]! >= 1 && shape.fingers[i]! <= 4); }
    }
    const sounding = guitarPitches(shape).filter((pitch): pitch is number => pitch !== null);
    assert.equal(Math.min(...sounding) % 12, definition.pitchClasses[0], shape.symbol);
  }
});

test('generated guitar arrangements preserve chord tones and the requested bass', () => {
  for (const symbol of ['C/E', 'Cmaj7', 'D/F#']) {
    const definition = chord(symbol);
    const shape = resolveGuitar(definition)[0];
    assert.equal(shape.generated, true);
    const notes = guitarPitches(shape).filter((pitch): pitch is number => pitch !== null);
    assert.deepEqual(new Set(notes.map(pitch => pitch % 12)), new Set(definition.pitchClasses));
    if (symbol === 'C/E') assert.equal(Math.min(...notes) % 12, 4);
    if (symbol === 'D/F#') assert.equal(Math.min(...notes) % 12, 6);
    assert.ok(shape.fingers.every(finger => finger === null));
  }
  assert.equal(resolveGuitar(chord('C/C')).length, 1);
  assert.deepEqual(resolveGuitar(chord('Cmaj13')), []);
});
