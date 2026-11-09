import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morphAmount, pairMorphNotes } from '../../src/domain/graphs/chordMorph.ts';
import type { TimeNote } from '../../src/domain/graphs/fifthsTime.ts';
import { Group, Line, Sprite } from 'three';
import { buildFocusedChord } from '../../src/features/graphs/focusedChord.ts';
import { buildFifthsTime } from '../../src/domain/graphs/fifthsTime.ts';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';
const notes = (pitches: number[]): TimeNote[] => pitches.map((pitch, i) => ({ pitch, spelling: String(pitch), root: i === 0, interval: '1P' }));

test('anticipation is 180ms at different tempos with eased endpoints', () => {
  for (const bpm of [40, 90, 240]) {
    const seconds = 240 / bpm;
    assert.equal(morphAmount(1 - .2 / seconds, 0, seconds), 0);
    assert.ok(Math.abs(morphAmount(1 - .09 / seconds, 0, seconds) - .5) < 1e-10);
    assert.equal(morphAmount(1, 0, seconds), 1);
    assert.equal(morphAmount(2, 0, seconds), 1);
    assert.equal(morphAmount(1, 1, seconds), 0);
  }
});
test('shared pitch classes stay anchored and changing note counts are retained', () => {
  const pairs = pairMorphNotes(notes([0, 4, 7]), notes([9, 0, 4]));
  assert.deepEqual(pairs.map(p => [p.from?.pitch, p.to?.pitch]), [[0, 0], [4, 4], [7, 9]]);
  const added = pairMorphNotes(notes([0, 4, 7]), notes([0, 4, 7, 11]));
  assert.equal(added[3].from, undefined); assert.equal(added[3].to?.pitch, 11);
  const removed = pairMorphNotes(notes([0, 4, 7, 11]), notes([0, 4, 7]));
  assert.equal(removed[3].from?.pitch, 11); assert.equal(removed[3].to, undefined);
});

test('morph endpoint matches the next chord geometry, including changing tone counts', () => {
  const chords = buildFifthsTime(parseChart('C | Am | Fmaj7 | Dm', tonalTheory), tonalTheory, 0, 'preserve');
  for (let i = 0; i < chords.length - 1; i++) {
    const from = new Group(), to = new Group();
    const morph = buildFocusedChord(from, chords[i], chords[i + 1], null, () => new Sprite());
    buildFocusedChord(to, chords[i + 1], undefined, null, () => new Sprite());
    morph.update(1);
    const outline = (group: Group) => Array.from((group.children.find(child => child instanceof Line) as Line).geometry.getAttribute('position').array);
    const actual = outline(from), expected = outline(to);
    assert.equal(actual.length, expected.length);
    actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6, 'morph endpoint must meet the next shape without a visible jump'));
  }
  const unknown = buildFifthsTime(parseChart('C | H7', tonalTheory), tonalTheory, 0, 'preserve');
  assert.equal(buildFocusedChord(new Group(), unknown[0], unknown[1], null, () => new Sprite()).canMorph, false);
});
