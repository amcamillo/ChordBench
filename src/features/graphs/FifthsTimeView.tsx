import { useEffect, useMemo, useRef, useState } from 'react';
import { DnaVoiceLeading } from './DnaVoiceLeading.tsx';
import { buildTransition } from '../../domain/song/transitions.ts';
import { TimingRuler } from './TimingRuler.tsx';
import { ChordLens } from './ChordLens.tsx';
import { RhythmPanel } from './RhythmPanel.tsx';
import { GROOVES, METERS, type Meter, type VisualRhythm } from '../../domain/graphs/rhythm.ts';
import { FIFTHS, sharedPitchClasses } from '../../domain/graphs/fifthsTime.ts';
import type { TimeChord } from '../../domain/graphs/fifthsTime.ts';
import type { ThreeFifthsScene } from './threeFifthsScene.ts';

interface Props { tempo: number; chords: TimeChord[]; selectedId: string | null; playingId: string | null; playbackState: 'playing' | 'paused' | 'stopped'; playbackDisabled: boolean; onTimingCues(enabled: boolean, rhythm: VisualRhythm): void; onPlay(): void; onPause(): void; onStop(): void; getPlaybackPosition(): number; selectedPitch: number | null; stale: boolean; onSelect(id: string): void; onPitchSelect(pitch: number): void }

export function FifthsTimeView({ tempo, chords, selectedId, playingId, playbackState, playbackDisabled, onTimingCues, onPlay, onPause, onStop, getPlaybackPosition, selectedPitch, stale, onSelect, onPitchSelect }: Props) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [timingVisible, setTimingVisible] = useState(() => {
    try { return localStorage.getItem('chord-workbench-timing-visible') !== 'false'; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem('chord-workbench-timing-visible', String(timingVisible)); } catch { /* The control still works without storage. */ } }, [timingVisible]);
  const [voiceSelection, setVoiceSelection] = useState({ key: '', index: 0 });
  const [overview, setOverview] = useState(false);
  const [rhythm, setRhythm] = useState<VisualRhythm>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('chord-workbench-visual-rhythm-v1') || '{}');
      return { groove: GROOVES.find(item => item.id === saved.groove) ?? GROOVES[0], meter: METERS.includes(saved.meter) ? saved.meter as Meter : '4/4' };
    } catch { return { groove: GROOVES[0], meter: '4/4' }; }
  });
  useEffect(() => { onTimingCues(timingVisible, rhythm); return () => onTimingCues(false, rhythm); }, [onTimingCues, timingVisible, rhythm]);
  useEffect(() => { try { localStorage.setItem('chord-workbench-visual-rhythm-v1', JSON.stringify({ groove: rhythm.groove.id, meter: rhythm.meter })); } catch { /* View settings remain usable without storage. */ } }, [rhythm]);
  const [follow, setFollow] = useState(true);
  const [yaw, setYaw] = useState(.15);
  const [tilt, setTilt] = useState(.4);
  const [zoom, setZoom] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [rendererStatus, setRendererStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [rendererError, setRendererError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ThreeFifthsScene | null>(null);
  const drag = useRef<{ x: number; y: number; yaw: number; tilt: number; moved: boolean } | null>(null);
  const focusId = follow && playingId ? playingId : selectedId;
  const found = chords.findIndex(chord => chord.id === focusId);
  const focus = Math.max(0, found);
  const current = chords[focus];
  const next = chords[focus + 1];
  const voiceKey = `${current?.id}-${current?.symbol}-${next?.id}-${next?.symbol}`;
  const voiceChoice = voiceSelection.key === voiceKey ? voiceSelection.index : 0;
  const candidates = useMemo(() => current?.definition && next?.definition ? buildTransition(current.definition, next.definition).candidates : [], [current, next]);
  const voiceCandidate = candidates[voiceChoice] ?? null;

  const isSelected = !!current && current.id === selectedId;
  const shared = useMemo(() => current && next ? sharedPitchClasses(current, next) : [], [current, next]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !chords.length) return;
    let cancelled = false;
    let renderer: ThreeFifthsScene | null = null;
    setRendererStatus('loading');
    void import('./threeFifthsScene.ts').then(({ ThreeFifthsScene }) => {
      if (cancelled) return;
      renderer = new ThreeFifthsScene(element, message => {
        scene.current?.dispose(); scene.current = null;
        setRendererError(message); setRendererStatus('unavailable');
      });
      scene.current = renderer; setRendererError(''); setRendererStatus('ready');
    }).catch(() => {
      if (cancelled) return;
      setRendererError('This device could not start the 3D graphics view. Use the chord and note controls below, or try a browser with WebGL 2.');
      setRendererStatus('unavailable');
    });
    return () => { cancelled = true; renderer?.dispose(); if (scene.current === renderer) scene.current = null; };
  }, [chords.length > 0]);
  useEffect(() => {
    scene.current?.setPlayback(follow && playingId && !reducedMotion && playbackState === 'playing' ? getPlaybackPosition : null);
  }, [follow, playingId, reducedMotion, playbackState, getPlaybackPosition, rendererStatus]);
  useEffect(() => { scene.current?.setData(chords, focus, isSelected ? selectedPitch : null, overview, rhythm, timingVisible); }, [chords, focus, selectedPitch, isSelected, rendererStatus, overview, rhythm, timingVisible]);
  useEffect(() => { scene.current?.setView(yaw, tilt, zoom); }, [yaw, tilt, zoom, rendererStatus]);

  useEffect(() => { scene.current?.setTempo(tempo); }, [tempo, rendererStatus]);

  useEffect(() => { scene.current?.setVoiceLeading(voiceEnabled ? voiceCandidate : null); }, [voiceEnabled, voiceCandidate, overview, rendererStatus]);

  function goTo(index: number) {
    const chord = chords[index];
    if (!chord || stale) return;
    setFollow(false); onSelect(chord.id);
  }
  function selectNote(pitch: number) {
    if (stale || !current) return;
    if (!isSelected) { setFollow(false); onSelect(current.id); return; }
    onPitchSelect(pitch);
  }
  return <section className="time-view" aria-labelledby="time-view-heading">
    <div className="time-view-header"><div><span className="time-kicker">Your chart in harmony</span><h2 id="time-view-heading">Song DNA</h2><p>Follow the notes and connections woven through your chart.</p></div><div className="time-view-progress"><strong>{chords.length ? focus + 1 : 0}</strong><span> / {chords.length} chords</span></div></div>
    {!chords.length ? <div className="time-empty"><p>Add chords to your chart to begin exploring their notes in the circle of fifths.</p></div> : <>
      <div className="dna-scope" role="group" aria-label="Song DNA scope"><button aria-pressed={!overview} onClick={() => setOverview(false)}>Chord detail</button><button aria-pressed={overview} onClick={() => setOverview(true)}>Whole song</button><span>{overview ? `All ${chords.length} written chords, first to last` : 'Nearby chords with individual note selection'}</span></div>
      <RhythmPanel rhythm={rhythm} onChange={setRhythm} count={chords.length}/>
      {overview && rhythm.groove.steps.length > 0 && <p className="dna-overview-note">All chords shown; orange rhythm motifs are enlarged examples.</p>}
      <div className="time-stage">
        <canvas ref={canvas} className="time-canvas" data-renderer={rendererStatus === 'ready' ? 'webgl' : rendererStatus} role="img" aria-label="3D orbital view of chord tones on a circle of fifths extending through the written chart; use the chord and note controls below for an equivalent description"
          onPointerDown={event => { if (stale) return; drag.current = { x: event.clientX, y: event.clientY, yaw, tilt, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { const d = drag.current; if (!d) return; const dx = event.clientX - d.x, dy = event.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 7) d.moved = true; if (d.moved) { setYaw(Math.max(-.75, Math.min(.75, d.yaw + dx * .004))); setTilt(Math.max(-.65, Math.min(.75, d.tilt + dy * .004))); } }}
          onPointerUp={event => { const d = drag.current; drag.current = null; if (!d || d.moved) return; const occurrence = scene.current?.pickOccurrence(event.clientX, event.clientY); if (occurrence !== null && occurrence !== undefined) { goTo(occurrence); return; } const hit = scene.current?.pick(event.clientX, event.clientY); if (hit !== null && hit !== undefined) selectNote(hit); }}
          onPointerCancel={() => { drag.current = null; }}/>
        {rendererStatus === 'unavailable' && timingVisible && <TimingRuler focus={focus} symbol={current.symbol} running={follow && playbackState === 'playing' && !reducedMotion} getPosition={getPlaybackPosition}/>}
        <div className="time-stage-caption"><span>{playingId && follow ? 'Following playback' : 'Exploring chart'}</span><strong>{current.symbol}</strong><small>{current.section} · chord {focus + 1}</small></div>
        <details className="dna-stage-transport" open>
          <summary>Chart playback</summary>
          <div role="group" aria-label="Song DNA playback controls">
            {playbackState === 'playing' ? <button aria-label="Pause chart from Song DNA" onClick={onPause}>Pause</button> : <button aria-label={`${playbackState === 'paused' ? 'Resume' : 'Play'} chart from Song DNA`} disabled={playbackDisabled} onClick={onPlay}>{playbackState === 'paused' ? 'Resume' : 'Play'}</button>}
            <button aria-label="Stop chart from Song DNA" disabled={playbackState === 'stopped'} onClick={onStop}>Stop</button>
          </div>
        </details>
        <div className="time-stage-horizon" aria-hidden="true">written order →</div>
        {rendererStatus === 'unavailable' && <p className="time-render-error" role="alert">{rendererError}</p>}
      </div>
      <label className="dna-timing-toggle"><input type="checkbox" checked={timingVisible} onChange={event => setTimingVisible(event.target.checked)}/> Timing guide & beat cues</label>
      <p className="dna-time-hint">{overview ? "Time line: one mark per written chord; the moving line follows playback." : "Focused chord stays pinned; background chords travel along the time line. The bottom-right guide shows the selected visual meter and groove; its moving marker follows playback. Playback still assumes one 4/4 bar per chord. Shapes anticipate changes by 180 ms; audio stays on the beat."}</p>
      <DnaVoiceLeading candidates={candidates} choice={voiceChoice} onChoice={index => setVoiceSelection({ key: voiceKey, index })} enabled={voiceEnabled} onToggle={setVoiceEnabled} disabled={stale} hasNext={!!next}/>
      {overview && <ChordLens chord={current} disabled={stale} onDive={() => { setFollow(false); onSelect(current.id); setOverview(false); }}/>}
      <div className="time-controls"><div className="time-control-group"><button disabled={stale || focus === 0} onClick={() => goTo(focus - 1)}>Previous chord</button><button disabled={stale || focus >= chords.length - 1} onClick={() => goTo(focus + 1)}>Next chord</button><button onClick={() => { setYaw(.15); setTilt(.4); setZoom(1); }}>Reset view</button></div>
        <label className="time-follow"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)}/> Follow playback</label>
        {reducedMotion && <span className="time-motion-note">Playback movement reduced by device setting.</span>}
      </div>
      <div className="dna-jump"><label>Jump to chord<input type="number" min="1" max={chords.length} value={focus + 1} disabled={stale} onChange={event => { const n = event.target.valueAsNumber; if (Number.isInteger(n)) goTo(n - 1); }}/></label><label>Jump to section<select value={String(chords.reduce((start, chord, index) => index <= focus && (index === 0 || chord.section !== chords[index - 1].section) ? index : start, 0))} disabled={stale} onChange={event => goTo(Number(event.target.value))}>{chords.flatMap((chord, index) => index === 0 || chord.section !== chords[index - 1].section ? [<option key={chord.id} value={index}>{chord.section} - chord {index + 1}</option>] : [])}</select></label></div>
      <div className="time-sliders"><label>Chord position <span>{focus + 1} of {chords.length}</span><input type="range" min={1} max={Math.max(1, chords.length)} step={1} value={focus + 1} disabled={stale || chords.length < 2} onChange={event => goTo(Number(event.target.value) - 1)} aria-label="Chord position"/></label></div>
      <details className="dna-view-options"><summary>View controls</summary><div className="time-sliders"><label>View angle <input type="range" min="-0.75" max="0.75" step="0.05" value={yaw} onChange={event => setYaw(Number(event.target.value))} aria-label="View angle"/></label><label>View tilt <input type="range" min="-0.65" max="0.75" step="0.05" value={tilt} onChange={event => setTilt(Number(event.target.value))} aria-label="View tilt"/></label><label>Zoom <input type="range" min="0.7" max="1.3" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} aria-label="3D view zoom"/></label></div></details>
      <div className="time-legend"><span><i className="time-legend-root"/>Root</span><span><i className="time-legend-tone"/>Chord tone</span><span><i className="time-legend-lane"/>Pitch-class lane</span><span><i className="time-legend-thread"/>Shared note in the next chord</span></div>
      <div className="time-explanation"><div><h3>{current.symbol} <span>· {current.section}</span></h3>{current.unresolved ? <p>This symbol is unresolved, so no notes or relationships are guessed.</p> : <><p>{current.notes.map(note => `${note.spelling} (${note.interval})`).join(' · ')}{current.bass ? ` · requested bass ${current.bass}` : ''}</p>{!isSelected && <p>Inspect this chord to select its notes.</p>}<div className="time-note-buttons" aria-label={`Notes in ${current.symbol}`}>{current.notes.map((note, i) => <button className={`orbital-note ${note.root ? 'orbital-root' : 'orbital-tone'}`} key={`${note.pitch}-${i}`} disabled={stale || !isSelected} aria-pressed={isSelected && note.pitch === selectedPitch} onClick={() => selectNote(note.pitch)}>{note.spelling}<small>{note.root ? 'root' : note.interval}</small></button>)}</div></>}{!isSelected && <button className="time-inspect" disabled={stale} onClick={() => { setFollow(false); onSelect(current.id); }}>Inspect this chord</button>}
      </div><div><h3>What connects next</h3>{!next ? <p>End of the written chart. The lanes continue visually, but no more chords are inferred.</p> : current.unresolved || next.unresolved ? <p>{current.symbol} → {next.symbol}: an unresolved symbol prevents a note comparison.</p> : <p>{current.symbol} → {next.symbol}: {shared.length ? `${shared.length} shared pitch class${shared.length === 1 ? '' : 'es'} (${shared.map(pc => current.notes.find(note => note.pitch === pc)?.spelling).join(', ')}).` : 'no shared pitch classes.'} These lines do not describe a particular fingering or voice movement.</p>}</div></div>
      <details className="time-reference"><summary>How to read this view</summary><p>The circle places adjacent notes a perfect fifth apart: {FIFTHS.map(note => note.label).join(' → ')} → C. Each faint lane follows one pitch class through the strand; enharmonic names share a lane. Bright shapes connect notes in a chord, and teal trails join pitches shared by adjacent chords. Positions along the central thread represent written chord occurrences, not actual time or song duration. Whole song shows every occurrence with a moving position line; click the strand or use Jump to chord to explore. Dense overviews condense notes; Chord detail restores individual note selection. Orange frames and accent marks show your chosen visual rhythm, assuming one bar per occurrence. Style examples are not inferred from the chart; the timing guide adds optional accent cues without changing the chord accompaniment. Playback advances using the chosen tempo and assumed bar per chord. This is a pitch-class map, not conventional sheet music or an inferred key, rhythm, octave, or unique instrumental voicing.</p></details>
    </>}
  </section>;
}
