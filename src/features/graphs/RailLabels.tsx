import { useEffect, useState, type RefObject } from 'react';
import { CHROMATIC } from '../../domain/graphs/fifthsTime.ts';
import { noteColor, unambiguousPitch } from '../../domain/harmony/noteColor.ts';
import type { PianoNote } from '../../domain/instruments/voicings.ts';
import type { ThreeFifthsScene } from './threeFifthsScene.ts';
import type { TimeChord } from '../../domain/graphs/fifthsTime.ts';

type Point = { x: number; y: number };
type Rail = { pitch: number; candidates: Point[]; kind: 'current' | 'next' };
interface Props {
  canvas: RefObject<HTMLCanvasElement | null>; scene: RefObject<ThreeFifthsScene | null>;
  current: TimeChord; next: TimeChord | undefined; notes: PianoNote[] | undefined; nextNotes: PianoNote[] | undefined; playing: boolean; yaw: number; tilt: number; zoom: number; rendererStatus: string;
}
interface LabelPosition { pitch: number; x: number; y: number; kind: 'current' | 'next' }

// Choose actual visible points along each rail. Avoid collisions without pulling a
// label away from the rail or adding long leaders across the chord visualization.
function placeLabels(rails: Rail[], width: number, height: number): LabelPosition[] {
  const positions: LabelPosition[] = [];
  const labelWidth = 58, labelHeight = 23;
  for (const rail of rails) {
    const candidates = rail.candidates.map(p => ({ x: p.x * width, y: p.y * height }))
      .filter(p => p.x >= labelWidth / 2 && p.x <= width - labelWidth / 2 && p.y >= labelHeight && p.y <= height - labelHeight);
    if (!candidates.length) continue;
    let best = candidates[0], bestCost = Infinity;
    for (const point of candidates) {
      let cost = Math.abs(point.x - width * .54) * .015 + Math.abs(point.y - height * .54) * .005;
      // Keep the toggle and chord caption readable.
      if (point.y < 55 && (point.x > width - 155 || point.x < 100)) cost += 2000;
      for (const other of positions) {
        const overlapX = Math.max(0, labelWidth - Math.abs(point.x - other.x));
        const overlapY = Math.max(0, labelHeight - Math.abs(point.y - other.y));
        cost += overlapX * overlapY * 100;
      }
      if (cost < bestCost) { best = point; bestCost = cost; }
    }
    positions.push({ pitch: rail.pitch, x: best.x, y: best.y, kind: rail.kind });
  }
  return positions;
}

export function RailLabels({ canvas, scene, current, next, notes, nextNotes, playing, yaw, tilt, zoom, rendererStatus }: Props) {
  const [positions, setPositions] = useState<LabelPosition[]>([]);
  useEffect(() => {
    const element = canvas.current, stage = element?.parentElement;
    if (!element || !stage) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!element.clientWidth || !element.clientHeight) return;
        const currentPitches = new Set(current.notes.map(note => note.pitch));
        const nextPitches = new Set(next?.notes.map(note => note.pitch) ?? []);
        const rails: Rail[] = (scene.current?.railPositions() ?? []).flatMap(rail => {
          const kind = currentPitches.has(rail.pitch) ? 'current' : nextPitches.has(rail.pitch) ? 'next' : null;
          return kind ? [{ pitch: rail.pitch, candidates: kind === 'current' ? rail.current : rail.next, kind }] : [];
        });
        setPositions(placeLabels(rails, element.clientWidth, element.clientHeight));
      });
    };
    const observer = new ResizeObserver(measure); observer.observe(stage); observer.observe(element); measure();
    const timer = playing ? window.setInterval(measure, 120) : undefined;
    return () => { cancelAnimationFrame(frame); observer.disconnect(); if (timer) clearInterval(timer); };
  }, [canvas, scene, current, next, playing, yaw, tilt, zoom, rendererStatus]);
  return <div className="rail-labels" role="list" aria-label="Pitch-class rail labels">
    {positions.map(position => {
      const pitch = CHROMATIC[position.pitch];
      const midi = unambiguousPitch(position.kind === 'current' ? notes : nextNotes, position.pitch);
      const chord = position.kind === 'current' ? current : next;
      const spelling = chord?.notes.find(note => note.pitch === position.pitch)?.spelling ?? pitch.label;
      return <div role="listitem" className={`rail-label ${position.kind === 'next' ? 'rail-label-next' : 'rail-label-current'}`} key={position.pitch} data-pitch={position.pitch} data-kind={position.kind} title={`${spelling}, ${position.kind} chord; octaves share this rail`} style={{ left: position.x, top: position.y }}>
        <i aria-hidden="true" style={{ background: noteColor(midi) }}/><span>{spelling}</span>
      </div>;
    })}
  </div>;
}
