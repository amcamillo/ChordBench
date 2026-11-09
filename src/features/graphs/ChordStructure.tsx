import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChordDefinition } from '../../domain/harmony/types.ts';
import { buildChordStructure, referenceDistance } from '../../domain/graphs/chordStructure.ts';
import { noteColor } from '../../domain/harmony/noteColor.ts';
import { noteStyle } from '../noteStyle.ts';
import type { InstrumentAudio } from '../../infrastructure/audio/instrumentAudio.ts';

interface Props { chord?: ChordDefinition; occurrenceId?: string; stale: boolean; audio: InstrumentAudio; selectedPitchClass: number | null; onNoteChange(value: number | null): void; onAudition(): void }
const WIDTH = 620, HEIGHT = 430, CX = 310, CY = 215, RADIUS = 155;

export function ChordStructure({ chord, occurrenceId, stale, audio, selectedPitchClass, onNoteChange, onAudition }: Props) {
  const structure = useMemo(() => chord ? buildChordStructure(chord) : null, [chord]);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(1);
  const [showInterval, setShowInterval] = useState(false);
  const [status, setStatus] = useState('Choose a note to explore.');
  const [scale, setScale] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useEffect(() => { generation.current++; audio.stop('structure'); setFrom(0); setTo(1); setShowInterval(false); setStatus('Choose a note to explore.'); }, [chord?.symbol, occurrenceId, stale, audio]);
  useEffect(() => () => { generation.current++; audio.stop('structure'); }, [audio]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { generation.current++; audio.stop('structure'); setStatus('Sound stopped while the page was hidden.'); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [audio]);
  const notes = structure?.notes ?? [];
  const selected = notes.find(note => note.pitchClass === selectedPitchClass);
  const positions = notes.map((_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / notes.length;
    return { x: CX + RADIUS * Math.cos(angle), y: CY + RADIUS * Math.sin(angle) };
  });
  const first = notes[from], second = notes[to];
  async function audition(midis: number[], description: string) {
    if (stale || !midis.length) return;
    const current = ++generation.current;
    onAudition();
    try {
      await audio.play(midis.map(midi => ({ midi, delay: 0 })), 'piano', 'structure');
      if (generation.current === current) setStatus(`Playing ${description} on reference piano.`);
    } catch { if (generation.current === current) setStatus('Sound could not start. Check your device volume and try again.'); }
  }
  function selectNote(pitch: number) { onNoteChange(pitch); setStatus('Note selected. Press Hear note to play it.'); }
  return <section className="journey-panel structure-panel" aria-labelledby="structure-heading">
    <div className="journey-heading"><div><h2 id="structure-heading">Inside the chord</h2><p>See chord tones and their roles relative to the chord root.</p></div></div>
    {!structure ? <p className="journey-empty">Select a recognized chord in the chart or another graph to explore its structure.</p> : <>
      <p className="journey-help">Select a note to highlight it on the selected instrument. No sound plays until you choose an audio control.</p>
      <div className="journey-toolbar" role="group" aria-label="Chord structure zoom controls"><button aria-label="Zoom chord structure out" onClick={() => setScale(value => Math.max(.25, Math.round((value - .25) * 100) / 100))}>−</button><output aria-label="Chord structure zoom">{Math.round(scale * 100)}%</output><button aria-label="Zoom chord structure in" onClick={() => setScale(value => Math.min(1.5, Math.round((value + .25) * 100) / 100))}>+</button><button onClick={() => setScale(Math.max(.25, Math.min(1, ((viewport.current?.clientWidth ?? WIDTH) - 28) / WIDTH)))}>Fit structure width</button><button onClick={() => setScale(1)}>Reset structure zoom</button></div>
      <p className="journey-help">Scroll within the diagram when needed. The note and comparison controls remain available at full size.</p>
      <div className="journey-viewport structure-viewport" ref={viewport} role="region" tabIndex={0} aria-label="Chord structure graph, scroll horizontally to explore" aria-busy={stale}>
        <div className="journey-scaled-space" style={{ width: WIDTH * scale, height: HEIGHT * scale }}><div className="journey-scale" style={{ transform: `scale(${scale})` }}><div className="structure-diagram" style={{ width: WIDTH, height: HEIGHT }}>
          <svg className="structure-edges" width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
            {positions.map((point, i) => <line key={i} x1={CX} y1={CY} x2={point.x} y2={point.y} stroke="#7166a5" strokeOpacity=".65" strokeWidth="1.5"/>)}
            {showInterval && first && second && from !== to && <line x1={positions[from].x} y1={positions[from].y} x2={positions[to].x} y2={positions[to].y} stroke="#b31665" strokeWidth="2.5" strokeDasharray="5 5"/>}
          </svg>
          <div className="structure-center"><strong>{structure.symbol}</strong><span>chord</span></div>
          {notes.map((note, i) => <button key={note.id} className={`journey-node structure-node ${note.interval === '1P' ? 'orbital-root' : 'orbital-tone'}`} data-note-midi={note.midi} data-note-color={noteColor(note.midi)} style={{ left: positions[i].x - 60, top: positions[i].y - 30, ...noteStyle(note.midi) }}
            aria-label={`Structure ${note.spelling}, ${note.role}, ${note.interval}`} aria-pressed={selectedPitchClass === note.pitchClass} disabled={stale} onClick={() => selectNote(note.pitchClass)}>
            <span className="journey-node-symbol">{note.spelling}</span><span className="journey-node-order">{note.role} ? {note.referenceName}</span>
          </button>)}
        </div></div></div>
      </div>
      {structure.bass && <p className="structure-bass">Requested slash bass: {chord!.slashBass}. In this reference voicing it sounds as {structure.bass}; it is not automatically an additional chord tone.</p>}
      <div className="structure-content"><section aria-label="Chord note list"><h3>Chord notes</h3><div className="harmonic-buttons">{notes.map(note => <button className={`orbital-note ${note.interval === '1P' ? 'orbital-root' : 'orbital-tone'}`} key={note.id} data-note-midi={note.midi} data-note-color={noteColor(note.midi)} style={noteStyle(note.midi)} disabled={stale} aria-pressed={selectedPitchClass === note.pitchClass} onClick={() => selectNote(note.pitchClass)}>{note.spelling} · {note.role}</button>)}</div></section>
        {selected && <section className="harmonic-detail" aria-label="Selected chord note"><h3>{selected.spelling} · {selected.role}</h3><p>Interval from chord root: {selected.interval}. Reference pitch: {selected.referenceName}.</p><button disabled={stale} onClick={() => void audition([selected.midi], selected.referenceName)}>Hear note</button></section>}
        {notes.length > 1 && <section className="harmonic-detail" aria-labelledby="compare-heading"><h3 id="compare-heading">Compare two notes</h3><p>Choose a pair to draw their connection. Distances and audio use this reference voicing.</p><div className="structure-pickers"><label>First note<select aria-label="First comparison note" value={from} disabled={stale} onChange={event => setFrom(Number(event.target.value))}>{notes.map(note => <option value={note.id} key={note.id}>{note.referenceName} · {note.role}</option>)}</select></label><label>Second note<select aria-label="Second comparison note" value={to} disabled={stale} onChange={event => setTo(Number(event.target.value))}>{notes.map(note => <option value={note.id} key={note.id}>{note.referenceName} · {note.role}</option>)}</select></label></div>
          {first && second && <><p>{first.referenceName} to {second.referenceName}: {referenceDistance(first, second)} semitone{referenceDistance(first, second) === 1 ? '' : 's'} apart in this voicing.</p><div className="harmonic-buttons"><button disabled={stale || from === to} aria-pressed={showInterval && from !== to} onClick={() => setShowInterval(value => !value)}>{showInterval && from !== to ? 'Hide connection' : 'Show connection'}</button><button disabled={stale} onClick={() => void audition([first.midi, ...(from === to ? [] : [second.midi])], `${first.referenceName} and ${second.referenceName}`)}>Hear pair</button></div></>}
        </section>}
      </div>
      <p className="structure-audio-note">Audio uses a synthesized, equal-tempered reference piano. This is not an inferred song rhythm or fingering.</p><div className="harmonic-buttons"><button onClick={() => { generation.current++; audio.stop('structure'); setStatus('Stopped.'); }}>Stop structure audio</button></div><p className="structure-status" role="status">{status}</p>
    </>}
  </section>;
}
