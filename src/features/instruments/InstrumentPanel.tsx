import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChordDefinition } from '../../domain/harmony/types.ts';
import { guitarPitches, midiName, pianoVoicing, resolveGuitar, spelledMidiName } from '../../domain/instruments/voicings.ts';
import type { GuitarShape } from '../../domain/instruments/voicings.ts';
import type { InstrumentAudio, Instrument, PlaybackNote } from '../../infrastructure/audio/instrumentAudio.ts';

function GuitarDiagram({ shape, rootPitch }: { shape: GuitarShape; rootPitch: number }) {
  const frets = shape.frets;
  const pitches = guitarPitches(shape);
  return <svg className="guitar-diagram" viewBox="0 0 210 215" role="img" aria-label={`${shape.name} chord box. String and fret details follow.`}>
    {frets.map((fret, index) => <text key={`mark-${index}`} x={25 + 32 * index} y="20" textAnchor="middle" className={`guitar-mark ${fret === 0 ? (pitches[index]! % 12 === rootPitch ? 'guitar-open-root' : 'guitar-open-tone') : ''}`}>{fret === null ? '×' : fret === 0 ? '○' : ''}</text>)}
    {[0,1,2,3,4].map(fret => <line key={`fret-${fret}`} x1="25" x2="185" y1={34 + fret * 36} y2={34 + fret * 36} stroke="currentColor" strokeWidth={fret === 0 ? 4 : 1}/>)}
    {frets.map((_, index) => <line key={`string-${index}`} x1={25 + 32 * index} x2={25 + 32 * index} y1="34" y2="178" stroke="currentColor" strokeWidth="1"/>)}
    {shape.barre && <line x1={25 + (6-shape.barre.from)*32} x2={25 + (6-shape.barre.to)*32} y1={34 + (shape.barre.fret - .5)*36} y2={34 + (shape.barre.fret - .5)*36} stroke="#9ad1c9" strokeWidth="19" strokeLinecap="round"/>}
    {frets.map((fret, index) => fret ? <g key={`finger-${index}`}><circle className={pitches[index] !== null && pitches[index]! % 12 === rootPitch ? 'guitar-orb-root' : 'guitar-orb-tone'} cx={25 + 32 * index} cy={34 + (fret - .5)*36} r="11"/><text x={25 + 32 * index} y={38 + (fret - .5)*36} textAnchor="middle" className="guitar-finger">{shape.fingers[index]}</text></g> : null)}
    {frets.map((_, index) => <text key={`string-label-${index}`} x={25 + 32 * index} y="200" textAnchor="middle" className="guitar-mark">{6-index}</text>)}
  </svg>;
}

interface Props { chord: ChordDefinition; occurrenceId: string; disabled: boolean; instrument: Instrument; onInstrumentChange(instrument: Instrument): void; audio: InstrumentAudio; onPreview(): void; songPlaying: boolean; focusPitchClass: number | null }
export function InstrumentPanel({ chord, occurrenceId, disabled, instrument, onInstrumentChange, audio, onPreview, songPlaying, focusPitchClass }: Props) {
  const [inversion, setInversion] = useState(0);
  const [active, setActive] = useState<number[]>([]);
  const [status, setStatus] = useState('Tap a key or play the chord to enable sound.');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const generation = useRef(0);
  const pianoViewport = useRef<HTMLDivElement>(null);
  const piano = useMemo(() => pianoVoicing(chord, inversion), [chord, inversion]);
  const shape = useMemo(() => resolveGuitar(chord)[0], [chord]);

  function stop() {
    generation.current++;
    audio.stop('preview');
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActive([]);
  }
  useEffect(() => {
    return () => { generation.current++; timers.current.forEach(clearTimeout); audio.stop('preview'); };
  }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) { stop(); setStatus('Sound stopped while the page was hidden.'); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => { stop(); setInversion(0); setStatus('Tap a note or play the chord to enable sound.'); }, [chord.symbol, occurrenceId, disabled]);
  useEffect(() => { if (songPlaying) { stop(); setStatus('Chart playback is active.'); } }, [songPlaying]);
  useEffect(() => {
    const container = pianoViewport.current;
    if (!container || focusPitchClass === null || instrument !== 'piano') return;
    const reveal = () => {
      const key = container.querySelector<HTMLElement>('.piano-key.theory-focus');
      if (key && container.clientWidth) container.scrollLeft = Math.max(0, key.offsetLeft - container.clientWidth / 2 + key.offsetWidth / 2);
    };
    reveal();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reveal);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [focusPitchClass, instrument, chord.symbol, inversion]);

  async function play(notes: PlaybackNote[], description: string) {
    if (disabled || !notes.length) return;
    stop();
    const current = generation.current;
    try {
      onPreview();
      await audio.play(notes, instrument);
      if (generation.current !== current) return;
      setStatus(`Playing ${description}.`);
      for (const note of notes) {
        timers.current.push(setTimeout(() => setActive(existing => [...existing, note.midi]), note.delay * 1000 + 25));
        timers.current.push(setTimeout(() => setActive(existing => existing.filter(midi => midi !== note.midi)), note.delay * 1000 + (instrument === 'guitar' ? 1375 : 1625)));
      }
      timers.current.push(setTimeout(() => { if (generation.current === current) setStatus('Ready to play.'); }, Math.max(...notes.map(note => note.delay)) * 1000 + 1650));
    } catch {
      if (generation.current === current) setStatus('Sound could not start. Check your device volume and tap play again.');
    }
  }
  function playAll(midis: number[], spread: number, description: string) {
    void play(midis.map((midi, index) => ({ midi, delay: index * spread })), description);
  }
  const low = Math.min(48, ...piano.map(note => note.midi));
  const high = Math.max(84, ...piano.map(note => note.midi));
  const start = Math.floor(low / 12) * 12;
  const end = Math.ceil(high / 12) * 12;
  const keys = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const isBlack = (midi: number) => [1,3,6,8,10].includes(midi % 12);
  let whites = 0;
  const pianoKeys = keys.map(midi => {
    const black = isBlack(midi);
    const x = black ? whites * 45 - 16 : whites++ * 45;
    const selected = piano.some(note => note.midi === midi);
    const focused = selected && midi % 12 === focusPitchClass;
    return <button key={midi} className={`piano-key ${black ? 'black-key' : 'white-key'} ${selected ? `voicing-key ${chord.pitchClasses[0] === midi % 12 ? 'orbital-root' : chord.pitchClasses.includes(midi % 12) ? 'orbital-tone' : 'orbital-bass'}` : ''} ${active.includes(midi) ? 'sounding-key' : ''} ${focused ? 'theory-focus' : ''}`}
      style={{ left: `${x}px` }} disabled={disabled} aria-label={`Piano ${midiName(midi)}${selected ? ', chord note' : ''}${focused ? ', selected in chord structure' : ''}`} onClick={() => void play([{ midi, delay: 0 }], midiName(midi))}>
      <span>{midi % 12 === 0 || selected ? midiName(midi) : ''}</span>
    </button>;
  });
  const guitar = shape ? guitarPitches(shape) : [];
  const guitarSounded = guitar.filter((note): note is number => note !== null);
  const focusedSpelling = chord.notes.find((_, index) => chord.pitchClasses[index] === focusPitchClass);

  return <section className="instrument-panel" aria-labelledby="instrument-heading">
    <div className="instrument-heading"><div><h2 id="instrument-heading">Play this chord</h2><p>Hear {chord.symbol} on an instrument</p></div><span className="sound-badge">Synthesized sound</span></div>
    <div className="instrument-switch" role="group" aria-label="Choose instrument">
      <button aria-pressed={instrument === 'piano'} onClick={() => { stop(); onInstrumentChange('piano'); setStatus('Piano selected.'); }}>Piano</button>
      <button aria-pressed={instrument === 'guitar'} onClick={() => { stop(); onInstrumentChange('guitar'); setStatus('Guitar selected.'); }}>Guitar</button>
    </div>
    {disabled && <p className="instrument-hint">Wait for the chart to finish updating before playing.</p>}
    {focusedSpelling && <p className="instrument-hint">Focused chord tone: {focusedSpelling}. Dashed outlines mark matching pitches.</p>}
    {instrument === 'piano' ? <>
      <div className="instrument-options"><label>Voicing<select aria-label="Piano inversion" value={inversion} disabled={disabled} onChange={event => { stop(); setInversion(Number(event.target.value)); }}>
        <option value={0}>Root position</option>{chord.notes.slice(1).map((_, i) => <option key={i} value={i + 1}>Inversion {i + 1}</option>)}
      </select></label></div>
      <p className="instrument-hint">Suggested note arrangement. C4 is middle C; tap any key to hear it. Fingering is not available for this voicing.</p>
      <div className="piano-scroll" ref={pianoViewport} role="region" tabIndex={0} aria-label="Piano keyboard, scroll horizontally for more keys"><div className="piano-keyboard" style={{ width: `${whites * 45}px` }}>{pianoKeys}</div></div>
      <p className="instrument-hint">Highlighted keys: {piano.map(note => `${spelledMidiName(note.midi, note.spelling)}${note.role === 'Bass' ? ' (bass)' : ''}`).join(' · ')}. Key labels use sharp names for black keys.</p>
      <div className="instrument-actions"><button disabled={disabled} onClick={() => playAll(piano.map(note => note.midi), 0, `${chord.symbol} together`)}>Play chord</button><button disabled={disabled} onClick={() => playAll(piano.map(note => note.midi), .25, `${chord.symbol} as an arpeggio`)}>Play arpeggio</button><button onClick={() => { stop(); setStatus('Stopped.'); }}>Stop sound</button></div>
      <div className="note-buttons" aria-label="Piano chord notes">{piano.map((note, i) => <button className={`orbital-note ${note.midi % 12 === chord.pitchClasses[0] ? 'orbital-root' : chord.pitchClasses.includes(note.midi % 12) ? 'orbital-tone' : 'orbital-bass'}`} key={`${note.midi}-${i}`} disabled={disabled} onClick={() => void play([{ midi: note.midi, delay: 0 }], midiName(note.midi))}>{spelledMidiName(note.midi, note.spelling)}{note.role === 'Bass' ? ' bass' : ''}</button>)}</div>
    </> : shape ? <>
      <div className="guitar-layout"><GuitarDiagram shape={shape} rootPitch={chord.pitchClasses[0]}/><div><h3>{shape.name}</h3><p className="instrument-hint">Standard tuning · strings 6 to 1. X = muted, ○ = open. {shape.generated ? 'Dots show frets.' : 'Dots show finger numbers; barre is shown as a line.'}</p><p className="instrument-hint">{shape.generated ? 'Generated pitch arrangement; fingering and physical playability have not been verified.' : 'Suggested shape; fingering has not yet been independently reviewed.'}</p></div></div>
      <div className="instrument-actions"><button disabled={disabled} onClick={() => playAll(guitarSounded, 0, `${chord.symbol} together`)}>Play chord</button><button disabled={disabled} onClick={() => playAll(guitarSounded, .09, `${chord.symbol} as an illustrative strum`)}>Strum chord</button><button onClick={() => { stop(); setStatus('Stopped.'); }}>Stop sound</button></div>
      <p className="instrument-hint">Strumming here is a demonstration, not the song’s rhythm. Tap a sounding string to hear it.</p>
      <div className="string-list" aria-label="Guitar strings">{guitar.map((midi, i) => <button key={i} disabled={disabled || midi === null} className={`${midi !== null && active.includes(midi) ? 'string-active' : ''} ${midi !== null && midi % 12 === focusPitchClass ? 'theory-focus' : ''}`} onClick={() => { if (midi !== null) void play([{ midi, delay: 0 }], `string ${6-i}, ${midiName(midi)}`); }}>
        <span>String {6-i}</span><strong>{midi === null ? 'Muted' : midiName(midi)}</strong><small>{shape.frets[i] === null ? 'X' : shape.frets[i] === 0 ? 'Open' : `Fret ${shape.frets[i]}${shape.fingers[i] !== null ? `, finger ${shape.fingers[i]}` : ''}`}</small>
      </button>)}</div>
    </> : <div className="instrument-unavailable"><h3>No guitar shape available for {chord.symbol}.</h3><p>The current catalogue does not have a compatible shape{chord.slashBass ? ` with ${chord.slashBass} as its lowest note` : ''}. Try piano or choose another chord.</p></div>}
    <p className="audio-status" role="status">{status}</p>
  </section>;
}
