import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROOVES, METERS, meterFrame, rhythmEvents, overviewX, overviewPoint } from '../../src/domain/graphs/rhythm.ts';
import { Group, Points } from 'three';
import { buildSongOverview } from '../../src/features/graphs/songOverview.ts';
import { buildFifthsTime } from '../../src/domain/graphs/fifthsTime.ts';
import { parseChart } from '../../src/domain/chart/parser.ts';
import { tonalTheory } from '../../src/infrastructure/theory/tonal.ts';

test('visual examples have distinct accent geometry and explicit meter', () => {
  const signatures = GROOVES.map(groove => JSON.stringify([groove.meter, rhythmEvents({ groove, meter: groove.meter })]));
  assert.equal(new Set(signatures).size, GROOVES.length);
  const waltz = GROOVES.find(g => g.id === 'waltz')!;
  assert.equal(waltz.meter, '3/4');
  assert.deepEqual(rhythmEvents({ groove: waltz, meter: waltz.meter }).map(e => e.beat), [0, 1, 2]);
  const jazz = GROOVES.find(g => g.id === 'jazz')!;
  assert.deepEqual(rhythmEvents({ groove: jazz, meter: jazz.meter }).slice(0, 3).map(e => e.beat), [0, 2 / 3, 1]);
  for (const groove of GROOVES) for (const event of rhythmEvents({ groove, meter: groove.meter })) {
    assert.ok(event.fraction >= 0 && event.fraction < 1);
    assert.ok(event.strength > 0 && event.strength <= 1);
  }
});

test('meter overrides rescale the example without mutating its template', () => {
  const groove = GROOVES.find(g => g.id === 'waltz')!;
  assert.deepEqual(rhythmEvents({ groove, meter: '6/8' }).map(e => e.beat), [0, 2, 4]);
  assert.equal(groove.meter, '3/4');
});

test('new styles include duple samba and contrasting rock-opera examples with valid frames', () => {
  for (const [id, meter] of [['minuet', '3/4'], ['samba', '2/4'], ['rock', '4/4'], ['pop', '4/4'], ['rock-opera', '4/4'], ['rock-opera-ballad', '6/8']]) {
    const groove = GROOVES.find(item => item.id === id)!;
    assert.equal(groove.meter, meter);
  }
  for (const meter of METERS) {
    const frame = meterFrame(meter, 3);
    const area = frame.slice(0, -1).reduce((sum, p, i) => sum + p.x * frame[i + 1].y - frame[i + 1].x * p.y, 0) / 2;
    assert.ok(area > 5, `${meter} needs a visible nondegenerate frame`);
    assert.ok(Math.hypot(frame[0].x - frame.at(-1)!.x, frame[0].y - frame.at(-1)!.y) < 1e-10);
  }
});

test('whole song fits first and last occurrences at any chart length', () => {
  assert.equal(overviewX(0, 1), 0);
  for (const count of [12, 200, 1000, 100000]) {
    assert.equal(overviewX(0, count), -16);
    assert.equal(overviewX(count - 1, count), 16);
    assert.equal(overviewX(count + 10, count), 16);
    assert.equal(overviewX(-10, count), -16);
    const p = overviewPoint(4, count - 1, count);
    assert.ok(Math.abs(Math.hypot(p.y, p.z) - 2) < 1e-10);
    assert.ok(overviewX(count - 2, count) < p.x);
  }
});

test('batched overview geometry retains every written note and no notes for unknown symbols', () => {
  const chords = buildFifthsTime(parseChart(Array(1000).fill('C | H7 | Am').join(' | '), tonalTheory), tonalTheory, 0, 'preserve');
  const group = new Group();
  buildSongOverview(group, chords, { groove: GROOVES[1], meter: '3/4' });
  const clouds = group.children.filter((item): item is Points => item instanceof Points);
  assert.equal(clouds.reduce((sum, cloud) => sum + cloud.geometry.getAttribute('position').count, 0), 6000);
  const roots = clouds[0].geometry.getAttribute('position');
  assert.equal(roots.getX(0), -16);
  assert.equal(roots.getX(roots.count - 1), 16);
  assert.ok(group.children.length < 10, 'overview must batch geometry rather than create one object per chord');
});
