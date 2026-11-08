import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaceReducer } from '../../src/app/workspace.ts';
import type { Workspace } from '../../src/app/workspace.ts';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';
import { validateDraft } from '../../src/infrastructure/storage/drafts.ts';

function state(): Workspace {
  const source = 'C | G | C';
  const parsed = parseChart(source, tonalTheory);
  return { source, parsed, revision: 0, parsedRevision: 0, choices: {}, selectedId: parsed.occurrences[1].id, shift: 0, preference: 'preserve', sourceKey: '', notice: '' };
}

test('stale parse results and transformations cannot overwrite current draft', () => {
  const original = state();
  const edited = workspaceReducer(original, { type: 'edit', source: 'C | Am | G' });
  assert.equal(workspaceReducer(edited, { type: 'parsed', revision: 0, parsed: original.parsed }), edited);
  assert.equal(workspaceReducer(edited, { type: 'shift', value: 2 }), edited);
});

test('editing selected symbol clears stale selection and explains it', () => {
  const original = state();
  const edited = workspaceReducer(original, { type: 'edit', source: 'C | Am | C' });
  const next = workspaceReducer(edited, { type: 'parsed', revision: edited.revision, parsed: parseChart(edited.source, tonalTheory, original.parsed) });
  assert.equal(next.selectedId, null);
  assert.match(next.notice, /selected chord changed/);
});

test('transposition changes neither source nor selected occurrence', () => {
  const original = state();
  const next = workspaceReducer(original, { type: 'shift', value: 2 });
  assert.equal(next.source, original.source);
  assert.equal(next.selectedId, original.selectedId);
  assert.equal(next.parsed, original.parsed);
  assert.equal(workspaceReducer(next, { type: 'shift', value: 12 }), next);
});

const draft = { schemaVersion: 1, source: '[C]A lyric', shift: 2, preference: 'flats', sourceKey: 'C', choices: { '0:C': 'chord' }, savedAt: '2026-11-07T12:00:00.000Z' };
test('draft validation round trips settings and copies only allowlisted fields', () => {
  assert.deepEqual(validateDraft(JSON.parse(JSON.stringify({ ...draft, injected: '<script>' }))), draft);
});

test('future versions, malformed ranges, invalid dates and large source are rejected', () => {
  for (const invalid of [null, {}, { ...draft, schemaVersion: 2 }, { ...draft, shift: 99 }, { ...draft, source: 'x'.repeat(500001) }, { ...draft, savedAt: 'never' }]) {
    assert.throws(() => validateDraft(invalid));
  }
});
