import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIFTHS, buildFifthsTime, fifthIndex, fifthsOrbitPoint, sharedPitchClasses } from '../../src/domain/graphs/fifthsTime.ts';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';
import { cameraPosition } from '../../src/domain/graphs/fifthsCamera.ts';
import { PerspectiveCamera, Vector3 } from 'three';

test('circle positions make twelve unique pitch classes with perfect-fifth steps', () => {
  assert.equal(new Set(FIFTHS.map(note => note.pitch)).size, 12);
  for (let i = 0; i < 12; i++) assert.equal((FIFTHS[(i + 1) % 12].pitch - FIFTHS[i].pitch + 12) % 12, 7);
  assert.equal(fifthIndex(6), 6);
  assert.equal(fifthIndex(13), 7);
});

test('chart model retains written occurrence order, spellings, bass and unresolved symbols', () => {
  const chart = parseChart('C/E | Am | H7 | C', tonalTheory);
  const chords = buildFifthsTime(chart, tonalTheory, 0, 'preserve');
  assert.deepEqual(chords.map(chord => chord.symbol), ['C/E', 'Am', 'H7', 'C']);
  assert.deepEqual(chords.map(chord => chord.id), chart.occurrences.map(item => item.id));
  assert.equal(chords[0].bass, 'E');
  assert.deepEqual(chords[0].notes.map(note => note.spelling), ['C', 'E', 'G']);
  assert.equal(chords[2].unresolved, true);
  assert.deepEqual(chords[2].notes, []);
  assert.deepEqual(sharedPitchClasses(chords[0], chords[1]), [0, 4]);
  assert.deepEqual(sharedPitchClasses(chords[1], chords[2]), []);
});

test('transposition re-resolves both notes and slash bass without changing occurrence identity', () => {
  const chart = parseChart('C/E | G', tonalTheory);
  const result = buildFifthsTime(chart, tonalTheory, 2, 'preserve');
  assert.equal(result[0].symbol, 'D/F#');
  assert.deepEqual(result[0].notes.map(note => note.pitch), [2, 6, 9]);
  assert.equal(result[0].bass, 'F#');
  assert.equal(result[0].id, chart.occurrences[0].id);
});

test('pitch-class positions remain aligned on straight rails through circular chord layers', () => {
  const near = fifthsOrbitPoint(0, 0);
  const far = fifthsOrbitPoint(0, -3);
  assert.equal(near.z, 0); assert.equal(far.z, -3);
  assert.ok(Math.abs(Math.hypot(near.x, near.y) - 2.25) < 1e-10);
  assert.ok(Math.abs(Math.hypot(far.x, far.y) - 2.25) < 1e-10);
  assert.equal(far.x, near.x); assert.equal(far.y, near.y);
  for (const { pitch } of FIFTHS) {
    const first = fifthsOrbitPoint(pitch, 3), last = fifthsOrbitPoint(pitch, -19);
    assert.equal(first.x, last.x); assert.equal(first.y, last.y);
    assert.ok(Math.abs(Math.hypot(first.x, first.y) - 2.25) < 1e-10);
  }
  const fifth = fifthsOrbitPoint(7, 0);
  assert.ok(Math.abs((near.x * fifth.x + near.y * fifth.y) / (2.25 ** 2) - Math.cos(Math.PI / 6)) < 1e-10);
});

test('portrait camera framing keeps the central light and end of the thread in view', () => {
  const camera = new PerspectiveCamera(42, .66, .1, 100);
  const position = cameraPosition(.66, .15, .4, 1);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(0, 0, -5.4); camera.updateMatrixWorld();
  for (const z of [3.1, -19]) {
    const projected = new Vector3(0, 0, z).project(camera);
    assert.ok(Math.abs(projected.x) < .9, `thread at z=${z} is outside portrait view`);
    assert.ok(Math.abs(projected.y) < .9);
  }
});
