import * as THREE from 'three';
import { fifthIndex, sharedPitchClasses, type TimeChord } from '../../domain/graphs/fifthsTime.ts';
import { meterFrame, overviewPoint, overviewX, rhythmEvents, type VisualRhythm } from '../../domain/graphs/rhythm.ts';

function lines(parent: THREE.Group, vertices: number[], color: number, opacity: number) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  parent.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
}
export function buildSongOverview(parent: THREE.Group, chords: TimeChord[], rhythm: VisualRhythm) {
  const roots: number[] = [], tones: number[] = [], outlines: number[] = [], links: number[] = [], bars: number[] = [], groove: number[] = [];
  const vector = (pitch: number, position: number) => { const p = overviewPoint(fifthIndex(pitch), position, chords.length); return [p.x, p.y, p.z]; };
  const events = rhythmEvents(rhythm);
  chords.forEach((chord, index) => {
    chord.notes.forEach((note, n) => {
      const p = vector(note.pitch, index);
      (note.root ? roots : tones).push(...p);
      if (chord.notes.length > 1) outlines.push(...p, ...vector(chord.notes[(n + 1) % chord.notes.length].pitch, index));
    });
    if (index + 1 < chords.length) for (const pitch of sharedPitchClasses(chord, chords[index + 1])) links.push(...vector(pitch, index), ...vector(pitch, index + 1));
    const x = overviewX(index, chords.length);
    bars.push(x, -.12, 0, x, .12, 0);
    if (chord.unresolved) bars.push(x, -2.6, 0, x, 2.6, 0);
    if (index === 0 || chord.section !== chords[index - 1].section) bars.push(x, -3.6, 0, x, 3.3, 0);
  });
  // The overview enlarges a repeated representative rhythm motif. It does not
  // pretend that subpixel per-bar attacks remain readable in a long chart.
  const cells = Math.min(12, chords.length);
  if (events.length) for (let cell = 0; cell < cells; cell++) {
    const width = 32 / cells, x = -16 + cell * width;
    for (const event of events) {
      const ex = x + event.fraction * width;
      groove.push(ex, -3.6, 0, ex, -3.6 - event.strength * 1.6, event.strength * .45);
    }
    const frame = meterFrame(rhythm.meter, 2.65);
    for (let beat = 0; beat < frame.length - 1; beat++) {
      const a = frame[beat], b = frame[beat + 1];
      bars.push(x, a.x, a.y, x, b.x, b.y);
    }
  }
  lines(parent, [-16, 0, 0, 16, 0, 0], 0x7353d8, .8);
  lines(parent, outlines, 0x7542d4, .35); lines(parent, links, 0x087d9f, .7); lines(parent, bars, 0x9a6b35, .28); lines(parent, groove, 0xcc631d, .8);
  for (const [vertices, color, size] of [[roots, 0xe72f65, .13], [tones, 0x1478d4, .09]] as const) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    parent.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, sizeAttenuation: true })));
  }
  const cursor = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -5.5, 0), new THREE.Vector3(0, 3.8, 0)]), new THREE.LineBasicMaterial({ color: 0x263c91 }));
  parent.add(cursor);
  return cursor;
}
