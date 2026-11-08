import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tonalTheory, SUFFIXES } from '../../src/infrastructure/theory/tonal.ts';

test('A03: transpose slash bass and root by two semitones', () => {
  const result = tonalTheory.transpose('C/E', 2, 'preserve');
  assert.equal(result.status, 'resolved');
  if (result.status === 'resolved') {
    assert.equal(result.chord.symbol, 'D/F#');
    assert.deepEqual(result.chord.notes, ['D', 'F#', 'A']);
    assert.equal(result.chord.slashBass, 'F#');
  }
});

test('flats remain musical spellings including a diminished seventh', () => {
  const result = tonalTheory.transpose('C/E', 1, 'flats');
  assert.equal(result.status, 'resolved');
  if (result.status === 'resolved') assert.deepEqual(result.chord.notes, ['Db', 'F', 'Ab']);
  const diminished = tonalTheory.parse('Cdim7');
  assert.equal(diminished.status, 'resolved');
  if (diminished.status === 'resolved') assert.deepEqual(diminished.chord.notes, ['C', 'Eb', 'Gb', 'Bbb']);
});

test('major seventh, dominant, suspension and added ninth remain distinct', () => {
  for (const [symbol, notes] of [
    ['Cmaj7', ['C', 'E', 'G', 'B']], ['C7', ['C', 'E', 'G', 'Bb']],
    ['Csus2', ['C', 'D', 'G']], ['Csus4', ['C', 'F', 'G']], ['Cadd9', ['C', 'E', 'G', 'D']],
    ['Cm7b5', ['C', 'Eb', 'Gb', 'Bb']],
  ] as const) {
    const result = tonalTheory.parse(symbol);
    assert.equal(result.status, 'resolved', symbol);
    if (result.status === 'resolved') assert.deepEqual(result.chord.notes, notes);
  }
});

test('every published grammar suffix resolves through the adapter', () => {
  for (const suffix of Object.keys(SUFFIXES)) assert.equal(tonalTheory.parse('C' + suffix).status, 'resolved', suffix);
});

test('culturally ambiguous and unsupported symbols never become guessed notes', () => {
  assert.equal(tonalTheory.parse('C7+').status, 'ambiguous');
  for (const symbol of ['H7', '<script>', 'Cbanana', 'C/E/G']) assert.equal(tonalTheory.parse(symbol).status, 'unsupported');
  assert.equal(tonalTheory.transpose('H7', 3, 'sharps').status, 'unsupported');
});

test('negative transposition wraps and reset preserves original enharmonic spelling', () => {
  assert.equal(tonalTheory.transposeNote('C', -1, 'preserve'), 'B');
  assert.equal(tonalTheory.transposeNote('Db', 0, 'preserve'), 'Db');
  assert.equal(tonalTheory.transposeNote('F♯', 1, 'preserve'), 'G');
});
