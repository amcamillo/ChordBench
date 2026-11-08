import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { buildPlaybackPlan } from '../../src/domain/song/playbackPlan.ts';
import { guitarPitches, pianoVoicing, resolveGuitar, spelledMidiName } from '../../src/domain/instruments/voicings.ts';

const examples = [
  ['Bm7/b5', ['B', 'D', 'F', 'A']],
  ['B7/b9', ['B', 'D#', 'F#', 'A', 'C']],
  ['Bb7/b9', ['Bb', 'D', 'F', 'Ab', 'Cb']],
  ['A7(b13)', ['A', 'C#', 'E', 'G', 'F']],
  ['Am4', ['A', 'C', 'D', 'E']],
  ['G#m6/5+', ['G#', 'B', 'D##', 'E#']],
  ['G(add9)', ['G', 'B', 'D', 'A']],
  ['A7/b9', ['A', 'C#', 'E', 'G', 'Bb']],
  ['G7/b9', ['G', 'B', 'D', 'F', 'Ab']],
  ['C6/9', ['C', 'E', 'G', 'A', 'D']],
] as const;

test('requested jazz symbols resolve with spelled notes and playable reference arrangements', () => {
  const chart = parseChart(examples.map(([symbol]) => symbol).join(' | '), tonalTheory);
  assert.equal(chart.occurrences.length, examples.length);
  for (const [i, [symbol, notes]] of examples.entries()) {
    const result = tonalTheory.parse(symbol);
    assert.equal(result.status, 'resolved', symbol);
    if (result.status !== 'resolved') continue;
    assert.deepEqual(result.chord.notes, notes, symbol);
    const guitar = resolveGuitar(result.chord)[0];
    assert.ok(guitar, symbol);
    const sounded = guitarPitches(guitar).filter((n): n is number => n !== null);
    assert.deepEqual(new Set(sounded.map(n => n % 12)), new Set(result.chord.pitchClasses), symbol);
  }
  for (const instrument of ['piano', 'guitar'] as const) {
    const plan = buildPlaybackPlan(chart, tonalTheory, 0, 'preserve', instrument);
    assert.ok(plan.every(event => event.pitches.length && !event.warning), instrument);
  }
});

test('extended tones preserve compound octaves and slash alterations transpose independently of bass', () => {
  const result = tonalTheory.parse('B7/b9');
  assert.equal(result.status, 'resolved');
  if (result.status === 'resolved') {
    assert.deepEqual(pianoVoicing(result.chord).map(note => spelledMidiName(note.midi, note.spelling)), ['B4', 'D#5', 'F#5', 'A5', 'C6']);
  }
  const transposed = tonalTheory.transpose('C6/9/E', 2, 'sharps');
  assert.equal(transposed.status, 'resolved');
  if (transposed.status === 'resolved') {
    assert.equal(transposed.chord.symbol, 'D6add9/F#');
    assert.deepEqual(transposed.chord.notes, ['D', 'F#', 'A', 'B', 'E']);
  }
  assert.equal(tonalTheory.parse('C6/9/E/G').status, 'unsupported');
});
