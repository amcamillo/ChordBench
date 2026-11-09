import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';
import { buildTransition, matchVoices } from '../../src/domain/song/transitions.ts';

function chord(symbol: string) {
  const result = tonalTheory.parse(symbol);
  if (result.status !== 'resolved') throw new Error(`Invalid fixture ${symbol}`);
  return result.chord;
}
test('C to Am can retain C4 and E4 while G4 moves to A4', () => {
  const result = buildTransition(chord('C'), chord('Am'));
  assert.deepEqual(result.shared, ['C', 'E']);
  assert.deepEqual(result.candidates[0].from.map(n => n.midi), [60, 64, 67]);
  assert.deepEqual(result.candidates[0].to.map(n => n.midi), [60, 64, 69]);
  assert.deepEqual(result.candidates[0].movements.map(n => n.semitones), [0, 0, 2]);
  assert.ok(result.candidates.length >= 2);
  assert.notDeepEqual(result.candidates[1].to, result.candidates[0].to);
});
test('no shared tones and repeated chords have explicit distinct results', () => {
  assert.deepEqual(buildTransition(chord('C'), chord('F#')).shared, []);
  const repeated = buildTransition(chord('C'), chord('C')).candidates[0];
  assert.deepEqual(repeated.movements.map(n => n.semitones), [0, 0, 0]);
});
test('slash basses remain lowest, spellings survive, and source objects are untouched', () => {
  const from = chord('C/E'), to = chord('Db/F');
  const before = JSON.stringify([from, to]);
  const result = buildTransition(from, to);
  for (const item of result.candidates) {
    assert.equal(item.from[0].midi, 52);
    assert.equal(item.to[0].midi, 53);
    assert.equal(item.to[0].spelling, 'F');
    assert.ok(item.to.some(n => n.spelling === 'Db'));
    assert.ok(item.to.every((n, i) => i === 0 || n.midi > item.to[i - 1].midi));
  }
  assert.equal(JSON.stringify([from, to]), before);
});
test('alignment preserves duplicate voices and explicitly accounts for entering/leaving notes', () => {
  const notes = (pitches: number[]) => pitches.map(midi => ({ midi, spelling: 'C', role: '1P' }));
  const added = matchVoices(notes([60, 64, 67]), notes([60, 64, 67, 71]));
  assert.deepEqual(added.map(v => v.semitones), [0, 0, 0, null]);
  assert.equal(added[3].from, undefined);
  const removed = matchVoices(notes([48, 60, 64, 67]), notes([60, 64, 67]));
  assert.equal(removed[0].to, undefined);
  assert.equal(matchVoices(notes([60, 60]), notes([60, 60])).length, 2);
});
test('extended chords retain every target pitch class and compare deterministically', () => {
  const from = chord('C7'), to = chord('Fmaj9');
  const result = buildTransition(from, to);
  assert.deepEqual(buildTransition(from, to), result);
  for (const candidate of result.candidates) {
    assert.deepEqual([...new Set(candidate.to.map(n => n.midi % 12))].sort(), [...to.pitchClasses].sort());
    assert.ok(candidate.to.every(n => n.midi >= 36 && n.midi <= 96));
  }
});
