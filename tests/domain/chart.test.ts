import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';

test('A01: four ordered occurrences and independently spelled triads', () => {
  const chart = parseChart('C | Am | F | G', tonalTheory);
  assert.deepEqual(chart.occurrences.map(item => item.order), [0, 1, 2, 3]);
  assert.equal(new Set(chart.occurrences.map(item => item.id)).size, 4);
  const c = chart.occurrences[0].result;
  const am = chart.occurrences[1].result;
  assert.equal(c.status, 'resolved'); assert.equal(am.status, 'resolved');
  if (c.status === 'resolved' && am.status === 'resolved') {
    assert.deepEqual(c.chord.notes, ['C', 'E', 'G']);
    assert.deepEqual(am.chord.notes, ['A', 'C', 'E']);
  }
});

test('A02 domain: repeated symbols have distinct occurrences and equal definitions', () => {
  const chart = parseChart('C | G | C', tonalTheory);
  assert.equal(chart.occurrences.length, 3);
  assert.notEqual(chart.occurrences[0].id, chart.occurrences[2].id);
  assert.deepEqual(chart.occurrences[0].result, chart.occurrences[2].result);
});

test('A04: bracketed unknown symbols, Unicode, CRLF and all source spans round trip', () => {
  const source = '[Verse]\r\n[C]Hello 🌿 [H7]stay\r\nB♭ | F/A\r\n';
  const chart = parseChart(source, tonalTheory);
  assert.equal(chart.lines.flatMap(line => line.tokens).map(token => token.text).join(''), source);
  for (const token of chart.lines.flatMap(line => line.tokens)) assert.equal(source.slice(token.start, token.end), token.text);
  assert.deepEqual(chart.occurrences.map(item => item.symbol), ['C', 'H7', 'B♭', 'F/A']);
  assert.equal(chart.diagnostics.length, 1);
  assert.equal(chart.diagnostics[0].symbol, 'H7');
});

test('lyrics resembling a single chord require a review choice', () => {
  const source = 'Am\nI still here';
  const chart = parseChart(source, tonalTheory);
  assert.equal(chart.occurrences.length, 0);
  assert.equal(chart.diagnostics[0].reviewKey, '0:Am');
  assert.equal(parseChart(source, tonalTheory, chart, { '0:Am': 'chord' }).occurrences.length, 1);
  const textChoice = parseChart(source, tonalTheory, chart, { '0:Am': 'text' });
  assert.equal(textChoice.occurrences.length, 0);
  assert.equal(textChoice.diagnostics.length, 0);
});

test('unknown candidate in a chords-above-lyrics line remains a diagnostic', () => {
  const chart = parseChart('C     H7     G\nOur own original lyric', tonalTheory);
  assert.deepEqual(chart.occurrences.map(item => item.symbol), ['C', 'H7', 'G']);
  assert.equal(chart.lines[1].kind, 'lyrics');
});

test('aliases consolidate definitions without losing source spelling', () => {
  const chart = parseChart('Cm | Cmin | C# | Db', tonalTheory);
  const defs = chart.occurrences.map(item => item.result.status === 'resolved' ? item.result.chord.id : '');
  assert.equal(defs[0], defs[1]);
  assert.notEqual(defs[2], defs[3]);
  assert.deepEqual(chart.occurrences.map(item => item.symbol), ['Cm', 'Cmin', 'C#', 'Db']);
});

test('unchanged occurrences retain IDs across a lyric-only insertion', () => {
  const previous = parseChart('[C]First\n[G]Second\n[C]Third', tonalTheory);
  const next = parseChart('[C]First bright\n[G]Second\n[C]Third', tonalTheory, previous);
  assert.deepEqual(next.occurrences.map(item => item.id), previous.occurrences.map(item => item.id));
});

test('changing a chord invalidates only that occurrence', () => {
  const previous = parseChart('C | Am | G', tonalTheory);
  const next = parseChart('C | Dm | G', tonalTheory, previous);
  assert.equal(next.occurrences[0].id, previous.occurrences[0].id);
  assert.notEqual(next.occurrences[1].id, previous.occurrences[1].id);
  assert.equal(next.occurrences[2].id, previous.occurrences[2].id);
});

test('headings and repeat markers are preserved rather than expanded', () => {
  const source = '# Verse 2\nC | G | :| x2';
  const chart = parseChart(source, tonalTheory);
  assert.equal(chart.occurrences[0].section, 'Verse 2');
  assert.equal(chart.occurrences.length, 4);
  assert.equal(chart.diagnostics.length, 2);
  assert.equal(chart.lines.flatMap(line => line.tokens).map(token => token.text).join(''), source);
});

test('empty and whitespace-only sources remain lossless', () => {
  for (const source of ['', '   ', '\r\n\n']) {
    const chart = parseChart(source, tonalTheory);
    assert.equal(chart.occurrences.length, 0);
    assert.equal(chart.lines.flatMap(line => line.tokens).map(token => token.text).join(''), source);
  }
});

test('oversized sources are rejected with a useful error', () => {
  assert.throws(() => parseChart('C'.repeat(500001), tonalTheory), /500,000/);
});
