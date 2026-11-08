import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { buildSongJourney } from '../../src/domain/graphs/songJourney.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';

test('C G C retains three journey nodes and both ordered directed edges', () => {
  const chart = parseChart('C | G | C', tonalTheory);
  const journey = buildSongJourney(chart, tonalTheory, 0, 'preserve');
  const nodes = journey.sections.flatMap(section => section.nodes);
  assert.deepEqual(nodes.map(node => node.symbol), ['C', 'G', 'C']);
  assert.notEqual(nodes[0].id, nodes[2].id);
  assert.deepEqual(journey.edges, [{ from: nodes[0].id, to: nodes[1].id }, { from: nodes[1].id, to: nodes[2].id }]);
});

test('separate repeated section headings stay separate and transitions cross section boundaries', () => {
  const chart = parseChart('[Verse]\nC | Am\n[Verse]\nF | G', tonalTheory);
  const journey = buildSongJourney(chart, tonalTheory, 0, 'preserve');
  assert.deepEqual(journey.sections.map(section => section.name), ['Verse', 'Verse']);
  assert.deepEqual(journey.sections.map(section => section.nodes.length), [2, 2]);
  assert.deepEqual(journey.edges[1], { from: chart.occurrences[1].id, to: chart.occurrences[2].id });
});

test('transposition and unresolved symbols preserve positions and identity', () => {
  const chart = parseChart('[Intro]\nC/E | H7 | G', tonalTheory);
  const journey = buildSongJourney(chart, tonalTheory, 2, 'preserve');
  const nodes = journey.sections[0].nodes;
  assert.deepEqual(nodes.map(node => node.symbol), ['D/F#', 'H7', 'A']);
  assert.deepEqual(nodes.map(node => node.unresolved), [false, true, false]);
  assert.deepEqual(nodes.map(node => node.id), chart.occurrences.map(item => item.id));
});

test('a 200-occurrence chart remains deterministic and keeps all connections', () => {
  const chart = parseChart(Array.from({ length: 50 }, () => 'C | Am | F | G').join('\n'), tonalTheory);
  const first = buildSongJourney(chart, tonalTheory, 0, 'preserve');
  assert.equal(first.sections[0].nodes.length, 200);
  assert.equal(first.edges.length, 199);
  assert.deepEqual(first, buildSongJourney(chart, tonalTheory, 0, 'preserve'));
});
