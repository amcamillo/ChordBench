import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';
import { buildChordStructure, referenceDistance } from '../../src/domain/graphs/chordStructure.ts';

function structure(symbol: string) {
  const result = tonalTheory.parse(symbol);
  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') throw new Error('Fixture failed');
  return buildChordStructure(result.chord);
}

test('C major maps each chord tone to its root-relative role and reference pitch', () => {
  const result = structure('C');
  assert.deepEqual(result.notes.map(note => [note.spelling, note.role, note.referenceName]), [['C','Root','C4'],['E','Major third','E4'],['G','Perfect fifth','G4']]);
  assert.equal(referenceDistance(result.notes[0], result.notes[1]), 4);
  assert.equal(referenceDistance(result.notes[1], result.notes[0]), 4);
});

test('minor seventh and diminished seventh retain distinct written roles', () => {
  assert.deepEqual(structure('Cm7').notes.map(note => note.role), ['Root','Minor third','Perfect fifth','Minor seventh']);
  const diminished = structure('Cdim7');
  assert.equal(diminished.notes[3].spelling, 'Bbb');
  assert.equal(diminished.notes[3].role, 'Diminished seventh');
});

test('slash bass stays separate from theoretical chord tones', () => {
  const result = structure('C/E');
  assert.equal(result.bass, 'E3');
  assert.deepEqual(result.notes.map(note => note.referenceName), ['C4','E4','G4']);
});

test('transposed spelling and exact octave labels stay coherent', () => {
  const result = structure('C#');
  assert.deepEqual(result.notes.map(note => note.referenceName), ['C#4', 'E#4', 'G#4']);
  assert.deepEqual(result.notes.map(note => note.pitchClass), [1,5,8]);
});
