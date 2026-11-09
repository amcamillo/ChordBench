import * as THREE from 'three';
import { fifthsOrbitPoint, type TimeChord, type TimeNote } from '../../domain/graphs/fifthsTime.ts';
import { pairMorphNotes } from '../../domain/graphs/chordMorph.ts';

const point = (note?: TimeNote) => { const p = note ? fifthsOrbitPoint(note.pitch, 0) : { x: 0, y: 0, z: 0 }; return new THREE.Vector3(p.x, p.y, p.z); };
const color = (note?: TimeNote) => new THREE.Color(note?.root ? 0xe72f65 : 0x1478d4);
// Fixed sampling lets triads and extended chords interpolate without changing buffers.
function outline(notes: TimeNote[]) {
  const vertices = notes.map(note => point(note));
  return Array.from({ length: 49 }, (_, i) => {
    if (!vertices.length) return new THREE.Vector3();
    const t = i / 48 * vertices.length, index = Math.floor(t) % vertices.length;
    return vertices[index].clone().lerp(vertices[(index + 1) % vertices.length], t % 1);
  });
}
export function buildFocusedChord(parent: THREE.Group, chord: TimeChord, next: TimeChord | undefined, selectedPitch: number | null, labelSprite: (text: string) => THREE.Sprite) {
  const target = next && !next.unresolved && !chord.unresolved ? next : chord;
  const sourceOutline = outline(chord.notes), targetOutline = outline(target.notes);
  const geometry = new THREE.BufferGeometry().setFromPoints(sourceOutline);
  const edge = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x7542d4 }));
  parent.add(edge);
  const nodes = pairMorphNotes(chord.notes, target.notes).map(pair => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(pair.from?.pitch === selectedPitch ? .19 : .14, 16, 12), new THREE.MeshBasicMaterial({ color: color(pair.from ?? pair.to), transparent: true }));
    mesh.userData.pitch = pair.from?.pitch; parent.add(mesh);
    const labels = [pair.from, pair.to].map(note => {
      if (!note) return null;
      const label = labelSprite(`${note.spelling} ${note.interval}`); label.position.copy(point(note).multiplyScalar(1.25)); parent.add(label); return label;
    });
    return { pair, mesh, labels, start: point(pair.from), end: point(pair.to), fromColor: color(pair.from ?? pair.to), toColor: color(pair.to ?? pair.from) };
  });
  const update = (amount: number) => {
    const buffer = geometry.getAttribute('position') as THREE.BufferAttribute;
    sourceOutline.forEach((p, i) => buffer.setXYZ(i, p.x + (targetOutline[i].x - p.x) * amount, p.y + (targetOutline[i].y - p.y) * amount, 0));
    buffer.needsUpdate = true; geometry.computeBoundingSphere();
    edge.visible = chord.notes.length > 1 || amount > 0 && target.notes.length > 1;
    for (const node of nodes) {
      node.mesh.position.copy(node.start).lerp(node.end, amount);
      node.mesh.material.color.copy(node.fromColor).lerp(node.toColor, amount);
      node.mesh.material.opacity = !node.pair.from ? amount : !node.pair.to ? 1 - amount : 1;
      node.mesh.visible = node.mesh.material.opacity > .001;
      if (node.labels[0]) node.labels[0].material.opacity = 1 - amount;
      if (node.labels[1]) node.labels[1].material.opacity = amount;
    }
  };
  update(0);
  return { update, meshes: nodes.filter(node => node.pair.from).map(node => node.mesh), canMorph: target !== chord };
}
