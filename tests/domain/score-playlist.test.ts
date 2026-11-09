import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlaylist } from '../../src/infrastructure/storage/playlist.ts';
import { buildScore, staffNote, notePositions } from '../../src/domain/graphs/score.ts';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';

const song = { id: 'first', title: 'First song', tempo: 96, instrument: 'piano', draft: { schemaVersion: 1, source: 'C | Am', shift: 2, preference: 'flats', sourceKey: 'C', choices: {}, savedAt: '2026-11-10T00:00:00Z' } };
test('playlist roundtrip preserves per-song settings and rejects corrupt or oversized collections', () => {
  const result = validatePlaylist(JSON.parse(JSON.stringify({ schemaVersion: 1, songs: [song] })));
  assert.equal(result.songs[0].draft.shift, 2);
  assert.equal(result.songs[0].tempo, 96);
  assert.throws(() => validatePlaylist({ schemaVersion: 1, songs: [song, song] }));
  for (const bad of [{ ...song, tempo: 0 }, { ...song, instrument: 'other' }, { ...song, title: '' }, { ...song, draft: { ...song.draft, source: null } }]) assert.throws(() => validatePlaylist({ schemaVersion: 1, songs: [bad] }));
  assert.throws(() => validatePlaylist({ schemaVersion: 1, songs: Array.from({ length: 41 }, (_, index) => ({ ...song, id: `song-${index}` })) }));
  assert.throws(() => validatePlaylist({ schemaVersion: 1, songs: Array.from({ length: 9 }, (_, index) => ({ ...song, id: `song-${index}`, draft: { ...song.draft, source: 'C'.repeat(500_000) } })) }));
});

test('staff spelling distinguishes enharmonics, middle C, clefs and ledger lines', () => {
  const note = (midi: number, spelling: string) => staffNote({ midi, spelling, role: 'tone' });
  assert.deepEqual(note(60, 'C').ledgers, [158]);
  assert.equal(note(64, 'E').y, 146);
  assert.equal(note(43, 'G').y, 254);
  assert.equal(note(57, 'A').y, 206);
  assert.equal(note(60, 'B#').name, 'B#3');
  assert.equal(note(60, 'B#').clef, 'bass');
  assert.equal(note(59, 'Cb').name, 'Cb4');
  assert.equal(note(59, 'Cb').clef, 'treble');
  assert.notEqual(note(66, 'F#').y, note(66, 'Gb').y);
  const seconds = notePositions([{ midi: 60, spelling: 'C', role: '1P' }, { midi: 62, spelling: 'D', role: '2M' }], 180);
  assert.notEqual(seconds[0].x, seconds[1].x);
});

test('score voice leading is continuous, preserves pitches and carries selected alternatives forward', () => {
  const chart = parseChart('C | Am | Fmaj7 | G7 | C/E', tonalTheory);
  const score = buildScore(chart, tonalTheory, 0, 'preserve');
  assert.deepEqual(score[1].notes.map(note => note.midi), [60, 64, 69]);
  for (let index = 0; index < score.length; index++) {
    const item = score[index];
    for (const pitch of item.chord!.pitchClasses) assert.ok(item.notes.some(note => note.midi % 12 === pitch));
    if (item.chosen) assert.deepEqual(item.chosen.to, score[index + 1].notes);
  }
  const alternative = score[0].candidates[1];
  const changed = buildScore(chart, tonalTheory, 0, 'preserve', { [score[0].id]: alternative.id });
  assert.deepEqual(changed[1].notes, alternative.to);
  assert.deepEqual(changed[1].chosen!.from, alternative.to);
  assert.equal(score.at(-1)!.notes[0].midi % 12, 4);
});

test('unresolved symbols break suggestions and transposition respells staff pitches', () => {
  const chart = parseChart('C | H7 | G', tonalTheory);
  const score = buildScore(chart, tonalTheory, 1, 'flats');
  assert.equal(score[0].symbol, 'Db');
  assert.equal(score[0].notes[0].spelling, 'Db');
  assert.equal(score[0].chosen, undefined);
  assert.deepEqual(score[1].notes, []);
  assert.equal(score[1].chosen, undefined);
  assert.equal(score.at(-1)!.chosen, undefined);
});
