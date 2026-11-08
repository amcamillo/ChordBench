import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { buildPlaybackPlan } from '../../src/domain/song/playbackPlan.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';

test('chart plan follows written occurrences, applies transposition and keeps unresolved time slots', () => {
  const chart = parseChart('C/E | H7 | C', tonalTheory);
  const plan = buildPlaybackPlan(chart, tonalTheory, 2, 'preserve', 'piano');
  assert.deepEqual(plan.map(event => event.symbol), ['D/F#', 'H7', 'D']);
  assert.equal(plan[0].pitches[0] % 12, 6);
  assert.deepEqual(plan[1].pitches, []);
  assert.equal(plan[1].warning, 'Unrecognized chord');
  assert.deepEqual(plan.map(event => event.occurrenceId), chart.occurrences.map(event => event.id));
});

test('guitar plan uses catalogue and derived pitches and leaves unavailable voicings silent', () => {
  const chart = parseChart('C | C/E | Am | Cmaj13', tonalTheory);
  const plan = buildPlaybackPlan(chart, tonalTheory, 0, 'preserve', 'guitar');
  assert.deepEqual(plan[0].pitches, [48,52,55,60,64]);
  assert.equal(Math.min(...plan[1].pitches) % 12, 4);
  assert.equal(plan[1].warning, undefined);
  assert.deepEqual(plan[2].pitches, [45,52,57,60,64]);
  assert.deepEqual(plan[3].pitches, []);
  assert.equal(plan[3].warning, 'No compatible guitar shape');
});
