import * as THREE from 'three';
import { fifthsOrbitPoint, type TimeChord, type TimeNote } from '../../domain/graphs/fifthsTime.ts';
import { pairMorphNotes } from '../../domain/graphs/chordMorph.ts';
import { noteColor, unambiguousPitch } from '../../domain/harmony/noteColor.ts';
import type { PianoNote } from '../../domain/instruments/voicings.ts';

const point = (note?: TimeNote) => { const p = note ? fifthsOrbitPoint(note.pitch, 0) : { x: 0, y: 0, z: 0 }; return new THREE.Vector3(p.x, p.y, p.z); };
// Fixed sampling lets triads and extended chords interpolate without changing buffers.
function outline(notes: TimeNote[]) {
  const vertices = notes.map(note => point(note));
  return Array.from({ length: 49 }, (_, i) => {
    if (!vertices.length) return new THREE.Vector3();
    const t = i / 48 * vertices.length, index = Math.floor(t) % vertices.length;
    return vertices[index].clone().lerp(vertices[(index + 1) % vertices.length], t % 1);
  });
}
export function buildFocusedChord(parent: THREE.Group, chord: TimeChord, next: TimeChord | undefined, selectedPitch: number | null, _labelSprite: (text: string) => THREE.Sprite, fromVoicing?: PianoNote[], toVoicing?: PianoNote[]) {
  const target = next && !next.unresolved && !chord.unresolved ? next : chord;
  const sourceOutline = outline(chord.notes), targetOutline = outline(target.notes);
  const geometry = new THREE.BufferGeometry().setFromPoints(sourceOutline);
  const edge = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x7542d4 }));
  parent.add(edge);
  const nodes = pairMorphNotes(chord.notes, target.notes).map(pair => {
    const fromMidi = pair.from ? unambiguousPitch(fromVoicing, pair.from.pitch) : null;
    const toMidi = pair.to ? unambiguousPitch(toVoicing, pair.to.pitch) : null;
    const fromColor = new THREE.Color(noteColor(fromMidi));
    const toColor = new THREE.Color(noteColor(toMidi));
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(pair.from?.pitch === selectedPitch ? .31 : .25, 16, 12), new THREE.MeshBasicMaterial({ color: fromColor, transparent: true, fog: false, toneMapped: false }));
    mesh.userData.pitch = pair.from?.pitch; parent.add(mesh);
    const rootRing = new THREE.Mesh(new THREE.TorusGeometry(.31, .025, 6, 32), new THREE.MeshBasicMaterial({ color: 0x18263a, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    rootRing.position.z = .05; mesh.add(rootRing);
    return { pair, mesh, rootRing, start: point(pair.from), end: point(pair.to), fromColor, toColor };
  });
  const update = (amount: number) => {
    const buffer = geometry.getAttribute('position') as THREE.BufferAttribute;
    sourceOutline.forEach((p, i) => buffer.setXYZ(i, p.x + (targetOutline[i].x - p.x) * amount, p.y + (targetOutline[i].y - p.y) * amount, 0));
    buffer.needsUpdate = true; geometry.computeBoundingSphere();
    edge.visible = chord.notes.length > 1 || amount > 0 && target.notes.length > 1;
    for (const node of nodes) {
      node.mesh.position.copy(node.start).lerp(node.end, amount);
      node.mesh.material.color.copy(amount < .5 ? node.fromColor : node.toColor);
      node.rootRing.visible = !!(amount < .5 ? node.pair.from?.root : node.pair.to?.root);
      node.mesh.material.opacity = !node.pair.from ? amount : !node.pair.to ? 1 - amount : 1;
      node.mesh.visible = node.mesh.material.opacity > .001;
    }
  };
  update(0);
  return { update, meshes: nodes.filter(node => node.pair.from).map(node => node.mesh), canMorph: target !== chord };
}
