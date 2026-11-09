import { useEffect, useState, type RefObject } from 'react';
import { FIFTHS } from '../../domain/graphs/fifthsTime.ts';
import { noteColor, unambiguousPitch } from '../../domain/harmony/noteColor.ts';
import { spelledMidiName, type PianoNote } from '../../domain/instruments/voicings.ts';
import type { TimeChord } from '../../domain/graphs/fifthsTime.ts';
import type { ThreeFifthsScene } from './threeFifthsScene.ts';

interface Props {
  canvas: RefObject<HTMLCanvasElement | null>; scene: RefObject<ThreeFifthsScene | null>;
  current: TimeChord; notes: PianoNote[] | undefined; yaw: number; tilt: number; zoom: number; rendererStatus: string;
}
export function RailLabels({ canvas, scene, current, notes, yaw, tilt, zoom, rendererStatus }: Props) {
  const [layout, setLayout] = useState<{ width: number; height: number; graphWidth: number; columns: number; points: { pitch: number; x: number; y: number }[] } | null>(null);
  useEffect(() => {
    const element = canvas.current, stage = element?.parentElement;
    if (!element || !stage) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = stage.clientWidth, height = stage.clientHeight;
        if (!width || !height) return;
        setLayout({ width, height, graphWidth: element.clientWidth, columns: window.matchMedia('(max-height: 500px)').matches ? 2 : 1, points: scene.current?.railPositions() ?? [] });
      });
    };
    const observer = new ResizeObserver(measure); observer.observe(stage); observer.observe(element); measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [canvas, scene, yaw, tilt, zoom, rendererStatus]);
  const points = layout?.points.length ? layout.points : FIFTHS.map((note, i) => ({ pitch: note.pitch, x: 1, y: (i + .5) / 12 }));
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x || a.pitch - b.pitch);
  const rows = layout?.columns === 2 ? 6 : 12;
  return <>
    {layout && <svg className="rail-leaders" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
      {sorted.map((point, index) => {
        const column = Math.floor(index / rows), row = index % rows;
        const panelWidth = layout.width - layout.graphWidth;
        const x1 = Math.max(0, Math.min(layout.graphWidth, point.x * layout.graphWidth));
        const y1 = Math.max(0, Math.min(layout.height, point.y * layout.height));
        const x2 = layout.graphWidth + column * panelWidth / layout.columns + 2;
        const y2 = (row + .5) * layout.height / rows;
        return <line key={point.pitch} data-pitch={point.pitch} x1={x1} y1={y1} x2={x2} y2={y2}/>;
      })}
    </svg>}
    <div className="rail-labels" role="list" aria-label="Pitch-class rail labels">
      {sorted.map(point => {
        const pitch = FIFTHS.find(item => item.pitch === point.pitch)!;
        const chordNote = current.notes.find(note => note.pitch === point.pitch);
        const midi = unambiguousPitch(notes, point.pitch);
        const spelling = chordNote?.spelling ?? notes?.find(note => note.midi === midi)?.spelling;
        const name = midi !== null && spelling ? spelledMidiName(midi, spelling) : spelling ?? pitch.label;
        return <div role="listitem" className="rail-label" key={point.pitch} data-pitch={point.pitch} title={midi === null ? `${pitch.label}, pitch class; octave not uniquely specified` : `${name}, suggested piano pitch`}>
          <i aria-hidden="true" style={{ background: noteColor(midi) }}/><span>{name}</span>
        </div>;
      })}
    </div>
  </>;
}
