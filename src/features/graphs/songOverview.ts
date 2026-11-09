import * as THREE from 'three';
import { sharedPitchClasses, type TimeChord } from '../../domain/graphs/fifthsTime.ts';
import { meterFrame, overviewPoint, overviewX, rhythmEvents, type VisualRhythm } from '../../domain/graphs/rhythm.ts';
import { noteColor, unambiguousPitch } from '../../domain/harmony/noteColor.ts';
import type { PianoNote } from '../../domain/instruments/voicings.ts';

function lines(parent: THREE.Group, vertices: number[], color: number, opacity: number) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  parent.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
}
function noteMarker() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#fff'; context.beginPath(); context.arc(16, 16, 14, 0, Math.PI * 2); context.fill();
  return new THREE.CanvasTexture(canvas);
}

export function buildSongOverview(parent: THREE.Group, chords: TimeChord[], rhythm: VisualRhythm, voicings: readonly { id: string; notes: PianoNote[] }[] = []) {
  const roots: number[] = [], tones: number[] = [], outlines: number[] = [], links: number[] = [], bars: number[] = [], groove: number[] = [], guides: number[] = [];
  const rootColors: number[] = [], toneColors: number[] = [];
  const byId = new Map(voicings.map(item => [item.id, item.notes]));
  const vector = (pitch: number, position: number) => { const p = overviewPoint(pitch, position, chords.length); return [p.x, p.y, p.z]; };
  const events = rhythmEvents(rhythm);
  chords.forEach((chord, index) => {
    chord.notes.forEach((note, n) => {
      const p = vector(note.pitch, index);
      (note.root ? roots : tones).push(...p);
      const color = new THREE.Color(noteColor(unambiguousPitch(byId.get(chord.id), note.pitch)));
      (note.root ? rootColors : toneColors).push(color.r, color.g, color.b);
      if (chord.notes.length > 1) outlines.push(...p, ...vector(chord.notes[(n + 1) % chord.notes.length].pitch, index));
    });
    if (index + 1 < chords.length) for (const pitch of sharedPitchClasses(chord, chords[index + 1])) links.push(...vector(pitch, index), ...vector(pitch, index + 1));
    const x = overviewX(index, chords.length);
    // Each occurrence keeps a circular chord layer, batched for long charts.
    for (let step = 0; step < 24; step++) {
      const a = step * Math.PI / 12, b = (step + 1) * Math.PI / 12;
      guides.push(x, Math.cos(a) * 2, Math.sin(a) * 2, x, Math.cos(b) * 2, Math.sin(b) * 2);
    }
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
  if (chords.length > 1) for (let pitch = 0; pitch < 12; pitch++) {
    guides.push(...vector(pitch, 0), ...vector(pitch, chords.length - 1));
  }
  lines(parent, guides, 0x817cbd, .22);
  lines(parent, [-16, 0, 0, 16, 0, 0], 0x7353d8, .8);
  lines(parent, outlines, 0x7542d4, .35); lines(parent, links, 0x087d9f, .7); lines(parent, bars, 0x9a6b35, .28); lines(parent, groove, 0xcc631d, .8);
  const marker = noteMarker();
  for (const [vertices, colors, size] of [[roots, rootColors, 9], [tones, toneColors, 7]] as const) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    parent.add(new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, size, map: marker, transparent: true, alphaTest: .1, depthWrite: false, sizeAttenuation: false, fog: false, toneMapped: false })));
  }
  const cursor = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -5.5, 0), new THREE.Vector3(0, 3.8, 0)]), new THREE.LineBasicMaterial({ color: 0x263c91 }));
  parent.add(cursor);
  return cursor;
}
