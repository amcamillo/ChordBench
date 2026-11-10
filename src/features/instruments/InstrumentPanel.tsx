import { useT } from '../../i18n/Language.tsx';
import { T } from '../../i18n/Language.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChordDefinition } from '../../domain/harmony/types.ts';
import { guitarPitches, midiName, pianoVoicing, resolveGuitar, spelledMidiName } from '../../domain/instruments/voicings.ts';
import type { GuitarShape, PianoNote } from '../../domain/instruments/voicings.ts';
import { noteColor } from '../../domain/harmony/noteColor.ts';
import { noteStyle } from '../noteStyle.ts';
import type { InstrumentAudio, Instrument, PlaybackNote } from '../../infrastructure/audio/instrumentAudio.ts';

function GuitarDiagram({ shape, rootPitch }: { shape: GuitarShape; rootPitch: number }) {
  const frets = shape.frets;
  const pitches = guitarPitches(shape);
  return <svg className="guitar-diagram" viewBox="0 0 210 215" role="img" aria-label={`${shape.name} chord box. String and fret details follow.`}>
    {frets.map((fret, index) => <text key={`mark-${index}`} x={25 + 32 * index} y="20" textAnchor="middle" style={fret === 0 && pitches[index] !== null ? { fill: noteColor(pitches[index]) } : undefined} className={`guitar-mark ${fret === 0 ? (pitches[index]! % 12 === rootPitch ? 'guitar-open-root' : 'guitar-open-tone') : ''}`}>{fret === null ? '×' : fret === 0 ? '○' : ''}</text>)}
    {[0,1,2,3,4].map(fret => <line key={`fret-${fret}`} x1="25" x2="185" y1={34 + fret * 36} y2={34 + fret * 36} stroke="currentColor" strokeWidth={fret === 0 ? 4 : 1}/>)}
    {frets.map((_, index) => <line key={`string-${index}`} x1={25 + 32 * index} x2={25 + 32 * index} y1="34" y2="178" stroke="currentColor" strokeWidth="1"/>)}
    {shape.barre && <line x1={25 + (6-shape.barre.from)*32} x2={25 + (6-shape.barre.to)*32} y1={34 + (shape.barre.fret - .5)*36} y2={34 + (shape.barre.fret - .5)*36} stroke="#9ad1c9" strokeWidth="19" strokeLinecap="round"/>}
    {frets.map((fret, index) => fret ? <g key={`finger-${index}`}><circle style={{ fill: noteColor(pitches[index]), stroke: pitches[index] !== null && pitches[index]! % 12 === rootPitch ? '#19243a' : 'none', strokeWidth: 3 }} data-midi={pitches[index] ?? undefined} className={pitches[index] !== null && pitches[index]! % 12 === rootPitch ? 'guitar-orb-root' : 'guitar-orb-tone'} cx={25 + 32 * index} cy={34 + (fret - .5)*36} r="11"/><text x={25 + 32 * index} y={38 + (fret - .5)*36} textAnchor="middle" className="guitar-finger">{shape.fingers[index]}</text></g> : null)}
    {frets.map((_, index) => <text key={`string-label-${index}`} x={25 + 32 * index} y="200" textAnchor="middle" className="guitar-mark">{6-index}</text>)}
  </svg>;
}

interface Props { chord: ChordDefinition; occurrenceId: string; disabled: boolean; instrument: Instrument; onInstrumentChange(instrument: Instrument): void; audio: InstrumentAudio; onPreview(): void; songPlaying: boolean; focusPitchClass: number | null; guidedNotes?: PianoNote[] }
export function InstrumentPanel({ chord, occurrenceId, disabled, instrument, onInstrumentChange, audio, onPreview, songPlaying, focusPitchClass, guidedNotes }: Props) {
  const t = useT();
  const [inversion, setInversion] = useState(0);
  const [active, setActive] = useState<number[]>([]);
  const [status, setStatus] = useState('Tap a key or play the chord to enable sound.');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const generation = useRef(0);
  const pianoViewport = useRef<HTMLDivElement>(null);
  const piano = useMemo(() => guidedNotes ?? pianoVoicing(chord, inversion), [chord, inversion, guidedNotes]);
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
    if (!container || instrument !== 'piano') return;
    const reveal = () => {
      const key = container.querySelector<HTMLElement>(focusPitchClass === null ? '.piano-key.voicing-key' : '.piano-key.theory-focus');
      if (key && container.clientWidth) container.scrollLeft = Math.max(0, key.offsetLeft - container.clientWidth / 2 + key.offsetWidth / 2);
    };
    reveal();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reveal);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [focusPitchClass, instrument, chord.symbol, inversion, guidedNotes]);

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
    const x = black ? whites * 64 - 24 : whites++ * 64;
    const voiced = piano.find(note => note.midi === midi);
    const selected = !!voiced;
    const isRoot = selected && midi % 12 === chord.pitchClasses[0];
    const isBass = voiced?.role === 'Bass';
    const lowest = selected && midi === Math.min(...piano.map(note => note.midi));
    const highest = selected && midi === Math.max(...piano.map(note => note.midi));
    const focused = selected && midi % 12 === focusPitchClass;
    return <button key={midi} className={`piano-key ${black ? 'black-key' : 'white-key'} ${selected ? `voicing-key ${chord.pitchClasses[0] === midi % 12 ? 'orbital-root' : chord.pitchClasses.includes(midi % 12) ? 'orbital-tone' : 'orbital-bass'}` : ''} ${active.includes(midi) ? 'sounding-key' : ''} ${focused ? 'theory-focus' : ''}`}
      style={{ left: `${x}px`, ...(selected ? noteStyle(midi) : {}) }} data-note-midi={selected ? midi : undefined} data-note-color={selected ? noteColor(midi) : undefined} title={selected ? `${midiName(midi)}${isRoot ? ', Root' : ''}${isBass ? ', Bass' : ''}${lowest ? ', Lowest' : ''}${highest ? ', Highest' : ''}` : undefined} disabled={disabled} aria-label={`Piano ${midiName(midi)}${selected ? `, ${t('chord note')}` : ''}${focused ? `, ${t('selected in chord structure')}` : ''}${isRoot ? `, ${t('root')}` : ''}${isBass ? `, ${t('bass')}` : ''}${lowest ? `, ${t('lowest')}` : ''}${highest ? `, ${t('highest')}` : ''}`} onClick={() => void play([{ midi, delay: 0 }], midiName(midi))}>
      <span>{midi % 12 === 0 || selected ? midiName(midi) : ''}{isRoot && <b aria-hidden="true"> R</b>}{isBass && <b aria-hidden="true"> B</b>}</span>
    </button>;
  });
  const guitar = shape ? guitarPitches(shape) : [];
  const guitarSounded = guitar.filter((note): note is number => note !== null);
  const focusedSpelling = chord.notes.find((_, index) => chord.pitchClasses[index] === focusPitchClass);

  return <section className="instrument-panel" aria-labelledby="instrument-heading">
    <div className="instrument-heading"><div><h2 id="instrument-heading"><T text={"Play this chord"}/></h2><p>Hear {chord.symbol} on an instrument</p></div><span className="sound-badge"><T text={"Synthesized sound"}/></span></div>
    <div className="instrument-switch" role="group" aria-label={t("Choose instrument")}>
      <button aria-pressed={instrument === 'piano'} onClick={() => { stop(); onInstrumentChange('piano'); setStatus('Piano selected.'); }}><T text={"Piano"}/></button>
      <button aria-pressed={instrument === 'guitar'} onClick={() => { stop(); onInstrumentChange('guitar'); setStatus('Guitar selected.'); }}><T text={"Guitar"}/></button>
    </div>
    {disabled && <p className="instrument-hint"><T text={"Wait for the chart to finish updating before playing."}/></p>}
    {focusedSpelling && <p className="instrument-hint"><T text={"Focused chord tone:"}/> {focusedSpelling}. Dashed outlines mark matching pitches.</p>}
    {instrument === 'piano' ? <>
      {guidedNotes ? <p className="guided-voicing"><T text={"Suggested voicing from Song DNA"}/></p> : <div className="instrument-options"><label><T text={"Voicing"}/><select aria-label={t("Piano inversion")} value={inversion} disabled={disabled} onChange={event => { stop(); setInversion(Number(event.target.value)); }}>
        <option value={0}><T text={"Root position"}/></option>{chord.notes.slice(1).map((_, i) => <option key={i} value={i + 1}>{t('Inversion')} {i + 1}</option>)}
      </select></label></div>}
      <p className="instrument-hint"><T text={"Suggested note arrangement. C4 is middle C; tap any key to hear it. Fingering is not available for this voicing."}/></p>
      <div className="piano-scroll" ref={pianoViewport} role="region" tabIndex={0} aria-label={t("Piano keyboard, scroll horizontally for more keys")}><div className="piano-keyboard" style={{ width: `${whites * 64}px` }}>{pianoKeys}</div></div>
      <p className="instrument-hint"><T text={"Highlighted keys:"}/> {piano.map(note => `${spelledMidiName(note.midi, note.spelling)}${note.role === 'Bass' ? ' (bass)' : ''}`).join(' · ')}. Key labels use sharp names for black keys.</p>
      <div className="instrument-actions"><button disabled={disabled} onClick={() => playAll(piano.map(note => note.midi), 0, `${chord.symbol} together`)}><T text={"Play chord"}/></button><button disabled={disabled} onClick={() => playAll(piano.map(note => note.midi), .25, `${chord.symbol} as an arpeggio`)}><T text={"Play arpeggio"}/></button><button onClick={() => { stop(); setStatus('Stopped.'); }}><T text={"Stop sound"}/></button></div>
      <div className="note-buttons" aria-label={t("Piano chord notes")}>{piano.map((note, i) => <button className={`orbital-note ${note.midi % 12 === chord.pitchClasses[0] ? 'orbital-root' : chord.pitchClasses.includes(note.midi % 12) ? 'orbital-tone' : 'orbital-bass'}`} key={`${note.midi}-${i}`} data-note-midi={note.midi} data-note-color={noteColor(note.midi)} style={noteStyle(note.midi)} title={`${spelledMidiName(note.midi, note.spelling)}${note.midi % 12 === chord.pitchClasses[0] ? ', Root' : ''}${note.role === 'Bass' ? ', Bass' : ''}`} disabled={disabled} onClick={() => void play([{ midi: note.midi, delay: 0 }], midiName(note.midi))}>{spelledMidiName(note.midi, note.spelling)}{note.role === 'Bass' ? ` ${t('bass')}` : ''}</button>)}</div>
    </> : shape ? <>
      <div className="guitar-layout"><GuitarDiagram shape={shape} rootPitch={chord.pitchClasses[0]}/><div><h3>{shape.name}</h3><p className="instrument-hint"><T text={"Standard tuning \u00b7 strings 6 to 1. X = muted, \u25cb = open."}/> {shape.generated ? 'Dots show frets.' : 'Dots show finger numbers; barre is shown as a line.'}</p><p className="instrument-hint">{shape.generated ? 'Generated pitch arrangement; fingering and physical playability have not been verified.' : 'Suggested shape; fingering has not yet been independently reviewed.'}</p></div></div>
      <div className="instrument-actions"><button disabled={disabled} onClick={() => playAll(guitarSounded, 0, `${chord.symbol} together`)}><T text={"Play chord"}/></button><button disabled={disabled} onClick={() => playAll(guitarSounded, .09, `${chord.symbol} as an illustrative strum`)}><T text={"Strum chord"}/></button><button onClick={() => { stop(); setStatus('Stopped.'); }}><T text={"Stop sound"}/></button></div>
      <p className="instrument-hint"><T text={"Strumming here is a demonstration, not the song\u2019s rhythm. Tap a sounding string to hear it."}/></p>
      <div className="string-list" aria-label={t("Guitar strings")}>{guitar.map((midi, i) => <button key={i} data-note-midi={midi ?? undefined} data-note-color={midi === null ? undefined : noteColor(midi)} style={midi === null ? undefined : noteStyle(midi)} disabled={disabled || midi === null} className={`${midi !== null && active.includes(midi) ? 'string-active' : ''} ${midi !== null && midi % 12 === focusPitchClass ? 'theory-focus' : ''}`} onClick={() => { if (midi !== null) void play([{ midi, delay: 0 }], `string ${6-i}, ${midiName(midi)}`); }}>
        <span><T text={"String"}/> {6-i}</span><strong>{midi === null ? t('Muted') : midiName(midi)}</strong><small>{shape.frets[i] === null ? 'X' : shape.frets[i] === 0 ? t('Open') : `Fret ${shape.frets[i]}${shape.fingers[i] !== null ? `, finger ${shape.fingers[i]}` : ''}`}</small>{midi !== null && midi % 12 === chord.pitchClasses[0] && <small><T text={"Root"}/></small>}
      </button>)}</div>
    </> : <div className="instrument-unavailable"><h3><T text={"No guitar shape available for"}/> {chord.symbol}.</h3><p><T text={"The current catalogue does not have a compatible shape"}/>{chord.slashBass ? ` with ${chord.slashBass} as its lowest note` : ''}. Try piano or choose another chord.</p></div>}
    <p className="audio-status" role="status">{t(status)}</p>
  </section>;
}
