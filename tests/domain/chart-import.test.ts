import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectChartBytes, MAX_IMPORT_BYTES } from '../../src/domain/chart/importChart.ts';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';

test('ChordPro metadata is preserved but never mistaken for timed chords', () => {
  const source = '{title: Example}\r\n{comment: C | G}\r\n{start_of_verse}\r\n[C]Original [G]words\r\n{end_of_verse}\r\n';
  const preview = inspectChartBytes(new TextEncoder().encode(source), tonalTheory);
  assert.equal(preview.title, 'Example');
  assert.equal(preview.originalSource, source);
  assert.equal(preview.source, '{start_of_verse}\r\n[C]Original [G]words\r\n{end_of_verse}\r\n');
  assert.equal(preview.chords, 2);
  assert.equal(preview.directives, true);
  assert.deepEqual(parseChart(source, tonalTheory).occurrences.map(item => item.symbol), ['C', 'G']);
});

test('text file with unknown chord stays reviewable and source remains unchanged', () => {
  const source = '[H7]My words\n[C]more text';
  const result = inspectChartBytes(new TextEncoder().encode(source), tonalTheory);
  assert.equal(result.warnings, 1);
  assert.equal(result.source, source);
});

test('UTF-8 byte order mark and Unicode lyrics are retained', () => {
  const source = '\ufeff{title: Song}\n[C]Kia ora 🌿';
  const result = inspectChartBytes(new TextEncoder().encode(source), tonalTheory);
  assert.equal(result.originalSource, source);
  assert.equal(result.source, '[C]Kia ora 🌿');
});

test('filters example metadata and standalone video URL but retains lyrics, chord lines and other directives', () => {
  const source = '{t: Example Tune}\n{artist: Example Artist}\n{key: Am}\nhttps://example.com/video\n{c:  Example comment}\nA line from an example song\n[Am]There is a song\n{start_of_chorus}\nA link in lyrics https://example.com stays\n';
  const result = inspectChartBytes(new TextEncoder().encode(source), tonalTheory);
  assert.equal(result.title, 'Example Tune');
  assert.equal(result.removedLines.length, 5);
  assert.equal(result.source, 'A line from an example song\n[Am]There is a song\n{start_of_chorus}\nA link in lyrics https://example.com stays\n');
  assert.equal(result.originalSource, source);
  assert.equal(result.chords, 1);
});

test('rejects empty, binary, invalid UTF-8, oversized byte and character inputs', () => {
  assert.throws(() => inspectChartBytes(new Uint8Array(), tonalTheory), /empty/);
  assert.throws(() => inspectChartBytes(new Uint8Array([0, 65]), tonalTheory), /binary/);
  assert.throws(() => inspectChartBytes(new Uint8Array([255]), tonalTheory), /UTF-8/);
  assert.throws(() => inspectChartBytes(new Uint8Array(MAX_IMPORT_BYTES + 1), tonalTheory), /too large/);
  assert.throws(() => inspectChartBytes(new TextEncoder().encode('x'.repeat(500001)), tonalTheory), /too long/);
});
