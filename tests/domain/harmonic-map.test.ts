import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { buildHarmonicMap } from '../../src/domain/graphs/harmonicMap.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';

function map(source: string, shift = 0, preference: 'preserve' | 'sharps' | 'flats' = 'preserve') {
  return buildHarmonicMap(parseChart(source, tonalTheory), tonalTheory, shift, preference);
}
const edge = (from: string, to: string) => JSON.stringify([`chord:${from}`, `chord:${to}`]);

test('C G C has two nodes and both directed transitions', () => {
  const result = map('C | G | C');
  assert.deepEqual(result.nodes.map(node => [node.symbol, node.occurrences.length]), [['C', 2], ['G', 1]]);
  assert.deepEqual(result.edges.map(item => [item.from, item.to, item.occurrences.length]), [['chord:C', 'chord:G', 1], ['chord:G', 'chord:C', 1]]);
  assert.equal(result.nodes[0].occurrences[1].order, 2);
});

test('self loops and repeated directed transitions count occurrences, not strength', () => {
  const result = map('C | C | G | C | G');
  const counts = new Map(result.edges.map(item => [JSON.stringify([item.from, item.to]), item.occurrences.length]));
  assert.equal(counts.get(edge('C', 'C')), 1);
  assert.equal(counts.get(edge('C', 'G')), 2);
  assert.equal(counts.get(edge('G', 'C')), 1);
});

test('aliases consolidate while slash bass and enharmonic spellings remain distinct', () => {
  const result = map('Cm | Cmin | C/E | C | C# | Db');
  assert.deepEqual(result.nodes.map(node => node.symbol), ['Cm', 'C/E', 'C', 'C#', 'Db']);
  assert.deepEqual(result.nodes[0].sourceSymbols, ['Cm', 'Cmin']);
  assert.equal(result.nodes[0].occurrences.length, 2);
});

test('unknown chords break edges rather than inventing a transition across them', () => {
  const result = map('C | H7 | G | C');
  assert.deepEqual(result.unresolved.map(item => item.sourceSymbol), ['H7']);
  assert.deepEqual(result.edges.map(item => [item.from, item.to]), [['chord:G', 'chord:C']]);
});

test('transpose updates identities and retains original spellings and occurrence IDs', () => {
  const source = 'C/E | Dm | C/E';
  const chart = parseChart(source, tonalTheory);
  const result = buildHarmonicMap(chart, tonalTheory, 2, 'preserve');
  assert.deepEqual(result.nodes.map(node => node.symbol), ['D/F#', 'Em']);
  assert.deepEqual(result.nodes[0].sourceSymbols, ['C/E']);
  assert.deepEqual(result.nodes[0].occurrences.map(item => item.id), [chart.occurrences[0].id, chart.occurrences[2].id]);
});

test('explicit respelling can merge enharmonics without losing source spelling', () => {
  const result = map('C# | Db', 0, 'sharps');
  assert.equal(result.nodes.length, 1);
  assert.deepEqual(result.nodes[0].sourceSymbols, ['C#', 'Db']);
  assert.equal(result.edges[0].from, result.edges[0].to);
});
