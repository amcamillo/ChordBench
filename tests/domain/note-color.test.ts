import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteColor, unambiguousPitch, UNKNOWN_NOTE_COLOR } from '../../src/domain/harmony/noteColor.ts';

const luminance = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
};
const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
test('fixed absolute pitch scale has exact anchors, clamped ends and rejects unknowns', () => {
  assert.equal(noteColor(36), '#b12c40'); assert.equal(noteColor(60), '#7a3f98'); assert.equal(noteColor(96), '#2454a6');
  assert.equal(noteColor(0), noteColor(36)); assert.equal(noteColor(127), noteColor(96));
  for (const value of [null, undefined, NaN, -1, 128, 60.5]) assert.equal(noteColor(value), UNKNOWN_NOTE_COLOR);
  assert.notEqual(noteColor(60), noteColor(72));
});
test('every pitch color has readable white text and contrast against the strand background', () => {
  for (let midi = 0; midi <= 127; midi++) {
    assert.ok(contrast(noteColor(midi), '#ffffff') >= 4.5, `white text at ${midi}`);
    assert.ok(contrast(noteColor(midi), '#f6f8ff') >= 3, `strand at ${midi}`);
  }
});
test('a pitch-class marker stays neutral when its octave is missing or ambiguous', () => {
  assert.equal(unambiguousPitch(undefined, 4), null);
  assert.equal(unambiguousPitch([{ midi: 64 }, { midi: 64 }], 4), 64);
  assert.equal(unambiguousPitch([{ midi: 52 }, { midi: 64 }], 4), null);
  assert.equal(noteColor(unambiguousPitch([{ midi: 52 }, { midi: 64 }], 4)), UNKNOWN_NOTE_COLOR);
});
