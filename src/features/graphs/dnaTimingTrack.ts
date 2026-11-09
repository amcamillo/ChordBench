import * as THREE from 'three';
import type { TimeChord } from '../../domain/graphs/fifthsTime.ts';
import { meterBeats, rhythmEvents, type VisualRhythm } from '../../domain/graphs/rhythm.ts';

// Compact camera-facing readout anchored at the panel's upper-right edge.
export function buildTimingTrack(chords: TimeChord[], focus: number, rhythm: VisualRhythm, label: (text: string) => THREE.Sprite) {
  const group = new THREE.Group();
  const vertices: THREE.Vector3[] = [];
  const accents: THREE.Vector3[] = [];
  const beats = meterBeats(rhythm.meter);
  [focus, focus + 1].forEach((index, row) => {
    const y = 1 - row * 3;
    const title = label(chords[index] ? `${index + 1}: ${chords[index].symbol}` : 'End');
    title.position.set(0, y + .9, 0); title.scale.set(7, 1.75, 1); group.add(title);
    if (!chords[index]) return;
    vertices.push(new THREE.Vector3(-3, y, 0), new THREE.Vector3(3, y, 0));
    for (let beat = 0; beat < beats; beat++) {
      const x = -3 + beat * 6 / beats;
      vertices.push(new THREE.Vector3(x, y - .1, 0), new THREE.Vector3(x, y + .2, 0));
      const text = label(String(beat + 1));
      text.position.set(x, y - .65, 0); text.scale.set(5.2, 1.3, 1); group.add(text);
    }
    for (const event of rhythmEvents(rhythm)) {
      const x = -3 + event.fraction * 6;
      accents.push(new THREE.Vector3(x, y + .18, 0), new THREE.Vector3(x, y + .18 + event.strength * .35, 0));
    }
  });
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vertices), new THREE.LineBasicMaterial({ color: 0x6c5a96, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  line.renderOrder = 105; group.add(line);
  const accentsLine = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(accents), new THREE.LineBasicMaterial({ color: 0xc16a38, transparent: true, opacity: .8, depthTest: false, depthWrite: false, fog: false }));
  accentsLine.renderOrder = 106; group.add(accentsLine);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.5), new THREE.MeshBasicMaterial({ color: 0xf6f8ff, depthTest: false, depthWrite: false, transparent: true, opacity: .45, fog: false }));
  backdrop.renderOrder = 100; group.add(backdrop);
  group.traverse(object => {
    if (object instanceof THREE.Sprite) { object.material.depthTest = false; object.material.depthWrite = false; object.material.fog = false; object.renderOrder = 110; }
  });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb33b16, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  marker.renderOrder = 115; group.add(marker);
  return { group, marker };
}
