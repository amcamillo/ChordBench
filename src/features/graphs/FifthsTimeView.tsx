import { useEffect, useMemo, useRef, useState } from 'react';
import { DnaVoiceLeading } from './DnaVoiceLeading.tsx';
import { RailLabels } from './RailLabels.tsx';
import { buildTransition } from '../../domain/song/transitions.ts';
import { TimingRuler } from './TimingRuler.tsx';
import { ChordLens } from './ChordLens.tsx';
import { RhythmPanel } from './RhythmPanel.tsx';
import { GROOVES, METERS, type Meter, type VisualRhythm } from '../../domain/graphs/rhythm.ts';
import { CHROMATIC, sharedPitchClasses } from '../../domain/graphs/fifthsTime.ts';
import type { TimeChord } from '../../domain/graphs/fifthsTime.ts';
import type { ThreeFifthsScene } from './threeFifthsScene.ts';
import type { ScoreChord } from '../../domain/graphs/score.ts';
import { spelledMidiName } from '../../domain/instruments/voicings.ts';
import { pianoVoicing } from '../../domain/instruments/voicings.ts';
import { noteColor, unambiguousPitch } from '../../domain/harmony/noteColor.ts';
import { noteStyle } from '../noteStyle.ts';

interface Props { tempo: number; chords: TimeChord[]; selectedId: string | null; playingId: string | null; playbackState: 'playing' | 'paused' | 'stopped'; playbackDisabled: boolean; onTimingCues(enabled: boolean, rhythm: VisualRhythm): void; onPlay(): void; onPause(): void; onStop(): void; getPlaybackPosition(): number; selectedPitch: number | null; stale: boolean; onSelect(id: string): void; onPitchSelect(pitch: number): void; compact?: boolean; score?: ScoreChord[]; onScoreChoice?(id: string, candidate: string): void; guidedPlayback?: boolean; onGuidedPlayback?(value: boolean): void }

export function FifthsTimeView({ tempo, chords, selectedId, playingId, playbackState, playbackDisabled, onTimingCues, onPlay, onPause, onStop, getPlaybackPosition, selectedPitch, stale, onSelect, onPitchSelect, compact = false, score, onScoreChoice, guidedPlayback = false, onGuidedPlayback }: Props) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showRailLabels, setShowRailLabels] = useState(false);
  const [timingVisible, setTimingVisible] = useState(() => {
    try { const saved = localStorage.getItem('chord-workbench-timing-visible'); return saved === null ? !compact : saved !== 'false'; } catch { return !compact; }
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
  const [zoom, setZoom] = useState(compact ? 1.55 : 1);
  const detailView = useRef({ yaw, tilt, zoom });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const gestureMoved = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [rendererStatus, setRendererStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [rendererError, setRendererError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ThreeFifthsScene | null>(null);
  const drag = useRef<{ x: number; y: number; yaw: number; tilt: number; moved: boolean } | null>(null);
  const compactOptions = useRef<HTMLDialogElement>(null);
  const focusId = follow && playingId ? playingId : selectedId;
  const found = chords.findIndex(chord => chord.id === focusId);
  const focus = Math.max(0, found);
  const current = chords[focus];
  const next = chords[focus + 1];
  const voiceKey = `${current?.id}-${current?.symbol}-${next?.id}-${next?.symbol}`;
  const scoreChord = compact ? score?.find(item => item.id === current?.id) : undefined;
  const candidates = useMemo(() => scoreChord ? scoreChord.candidates : current?.definition && next?.definition ? buildTransition(current.definition, next.definition).candidates : [], [current, next, scoreChord]);
  const voiceChoice = scoreChord ? Math.max(0, candidates.findIndex(candidate => candidate.id === scoreChord.chosen?.id)) : voiceSelection.key === voiceKey ? voiceSelection.index : 0;
  const voiceCandidate = candidates[voiceChoice] ?? null;
  const visualVoicings = useMemo(() => {
    if (score) return score;
    if (!current?.definition) return [];
    const notes = voiceCandidate?.from ?? pianoVoicing(current.definition);
    return [{ id: current.id, notes }, ...(next && voiceCandidate ? [{ id: next.id, notes: voiceCandidate.to }] : [])];
  }, [score, current, next, voiceCandidate]);
  const compactMovements = voiceCandidate?.movements.map(voice => !voice.from ? `${spelledMidiName(voice.to!.midi, voice.to!.spelling)} enters` : !voice.to ? `${spelledMidiName(voice.from.midi, voice.from.spelling)} leaves` : voice.semitones === 0 ? `${spelledMidiName(voice.from.midi, voice.from.spelling)} stays` : `${spelledMidiName(voice.from.midi, voice.from.spelling)} → ${spelledMidiName(voice.to.midi, voice.to.spelling)}`).join(' · ');
  function changeVoice(index: number) {
    const candidate = candidates[index];
    if (compact && current && candidate && onScoreChoice) onScoreChoice(current.id, candidate.id);
    else setVoiceSelection({ key: voiceKey, index });
  }

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
  useEffect(() => { scene.current?.setData(chords, focus, isSelected ? selectedPitch : null, overview, rhythm, timingVisible, visualVoicings); }, [chords, focus, selectedPitch, isSelected, rendererStatus, overview, rhythm, timingVisible, visualVoicings]);
  useEffect(() => { scene.current?.setView(yaw, tilt, zoom); }, [yaw, tilt, zoom, rendererStatus]);

  useEffect(() => { scene.current?.setTempo(tempo); }, [tempo, rendererStatus]);

  useEffect(() => { scene.current?.setVoiceLeading(voiceEnabled ? voiceCandidate : null); }, [voiceEnabled, voiceCandidate, overview, rendererStatus]);

  function changeScope(whole: boolean) {
    if (whole === overview) return;
    if (whole) { detailView.current = { yaw, tilt, zoom }; setYaw(.15); setTilt(.4); setZoom(1.1); }
    else { setYaw(detailView.current.yaw); setTilt(detailView.current.tilt); setZoom(detailView.current.zoom); }
    pointers.current.clear(); pinch.current = null; drag.current = null;
    setOverview(whole);
  }
  const clampZoom = (value: number) => Math.max(.35, Math.min(3.5, value));
  const wrapAngle = (value: number) => ((value + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  useEffect(() => {
    const element = canvas.current;
    if (!element || !overview) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); setZoom(value => clampZoom(value * Math.exp(-event.deltaY * .001))); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [overview, rendererStatus]);
  function resetView() { setYaw(.15); setTilt(.4); setZoom(overview ? 1.1 : compact ? 1.55 : 1); }
  function goTo(index: number) {
    const chord = chords[index];
    if (!chord || stale) return;
    if (!compact) setFollow(false);
    onSelect(chord.id);
  }
  function selectNote(pitch: number) {
    if (stale || !current) return;
    if (!isSelected) { setFollow(false); onSelect(current.id); return; }
    onPitchSelect(pitch);
  }
  return <section className={`time-view ${compact ? 'time-view-compact' : ''}`} aria-label={compact ? '3D Song DNA' : undefined} aria-labelledby={compact ? undefined : 'time-view-heading'}>
    <div className="time-view-header"><div><span className="time-kicker">Your chart in harmony</span><h2 id="time-view-heading">Song DNA</h2><p>Follow the notes and connections woven through your chart. Note colours show a suggested piano register; neutral means the octave is unknown.</p></div><div className="time-view-progress"><strong>{chords.length ? focus + 1 : 0}</strong><span> / {chords.length} chords</span></div></div>
    {!chords.length ? <div className="time-empty"><p>Add chords to your chart to begin exploring their notes in the chromatic note circle.</p></div> : <>
      <div className="dna-scope" role="group" aria-label="Song DNA scope"><button aria-pressed={!overview} onClick={() => changeScope(false)}>Chord detail</button><button aria-pressed={overview} onClick={() => changeScope(true)}>Whole song</button><span>{overview ? `All ${chords.length} written chords, first to last` : 'Nearby chords with individual note selection'}</span></div>
      <RhythmPanel rhythm={rhythm} onChange={setRhythm} count={chords.length}/>
      {overview && rhythm.groove.steps.length > 0 && <p className="dna-overview-note">All chords shown; orange rhythm motifs are enlarged examples.</p>}
      <div className={`time-stage ${showRailLabels && !overview ? 'show-rail-labels' : ''} ${overview ? 'is-whole-song' : ''}`}>
        <canvas ref={canvas} className="time-canvas" data-renderer={rendererStatus === 'ready' ? 'webgl' : rendererStatus} role="img" aria-label="3D orbital view of chord tones on a chromatic note circle extending through the written chart; use the chord and note controls below for an equivalent description"
          onPointerDown={event => {
            if (stale) return;
            if (overview) {
              if (!pointers.current.size) gestureMoved.current = false;
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              if (pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()];
                pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
                drag.current = null; gestureMoved.current = true;
              } else if (pointers.current.size === 1) drag.current = { x: event.clientX, y: event.clientY, yaw, tilt, moved: false };
            } else { gestureMoved.current = false; drag.current = { x: event.clientX, y: event.clientY, yaw, tilt, moved: false }; }
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (overview && pointers.current.has(event.pointerId)) {
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              if (pinch.current && pointers.current.size >= 2) {
                const [a, b] = [...pointers.current.values()];
                if (pinch.current.distance > 0) setZoom(clampZoom(pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance));
                return;
              }
            }
            const d = drag.current; if (!d) return;
            const dx = event.clientX - d.x, dy = event.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 7) d.moved = true;
            if (d.moved) {
              gestureMoved.current = true;
              setYaw(overview ? wrapAngle(d.yaw + dx * .008) : Math.max(-.75, Math.min(.75, d.yaw + dx * .004)));
              setTilt(overview ? wrapAngle(d.tilt + dy * .008) : Math.max(-.65, Math.min(.75, d.tilt + dy * .004)));
            }
          }}
          onPointerUp={event => {
            if (overview) { pointers.current.delete(event.pointerId); if (pinch.current) { pinch.current = null; drag.current = null; return; } }
            const d = drag.current; drag.current = null;
            if (!d || d.moved || gestureMoved.current) return;
            const occurrence = scene.current?.pickOccurrence(event.clientX, event.clientY); if (occurrence !== null && occurrence !== undefined) { goTo(occurrence); return; }
            const hit = scene.current?.pick(event.clientX, event.clientY); if (hit !== null && hit !== undefined) selectNote(hit);
          }}
          onPointerCancel={event => { pointers.current.delete(event.pointerId); pinch.current = null; drag.current = null; }}/>
        {compact && <button className="dna-whole-toggle" type="button" aria-pressed={overview} onClick={() => changeScope(!overview)}>{overview ? 'Return to chord detail' : 'See the whole song DNA'}</button>}
        {overview && <div className="dna-orbit-controls" role="group" aria-label="Whole-song view controls"><button type="button" aria-label="Zoom out" onClick={() => setZoom(value => clampZoom(value / 1.25))}>-</button><button type="button" aria-label="Zoom in" onClick={() => setZoom(value => clampZoom(value * 1.25))}>+</button><button type="button" onClick={resetView}>Reset</button></div>}
        {!overview && <button className="rail-label-toggle" type="button" aria-pressed={showRailLabels} onClick={() => setShowRailLabels(!showRailLabels)}>{showRailLabels ? 'Hide note lines' : 'Label note lines'}</button>}
        {showRailLabels && !overview && <RailLabels canvas={canvas} scene={scene} current={current} next={next} notes={visualVoicings.find(item => item.id === current.id)?.notes} nextNotes={visualVoicings.find(item => item.id === next?.id)?.notes} playing={follow && playbackState === 'playing' && !reducedMotion} yaw={yaw} tilt={tilt} zoom={zoom} rendererStatus={rendererStatus}/>}

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
      {compact && <div className="dna-compact-summary">
        <div className="dna-compact-line"><strong>{current.symbol} <span aria-hidden="true">→</span> {next?.symbol ?? 'End'}</strong><span className="dna-voicing-label">Suggested piano</span><button onClick={() => compactOptions.current?.showModal()}>3D options</button></div>
        <p>{overview ? `All ${chords.length} chords. Drag to rotate; pinch or use + and - to zoom.` : voiceEnabled ? compactMovements ?? (next ? 'Both chords must resolve to compare voices.' : 'Last chord in chart.') : 'Voice-leading paths are off.'}</p>
        <dialog ref={compactOptions} className="dna-compact-options" aria-labelledby="dna-compact-options-heading"><div className="dna-compact-options-header"><h2 id="dna-compact-options-heading">3D options</h2><button onClick={() => compactOptions.current?.close()}>Close</button></div>
          <DnaVoiceLeading candidates={candidates} choice={voiceChoice} onChoice={changeVoice} enabled={voiceEnabled} onToggle={setVoiceEnabled} disabled={stale} hasNext={!!next} guidedPlayback={guidedPlayback}/>
          <label className="time-follow"><input type="checkbox" checked={guidedPlayback} onChange={event => onGuidedPlayback?.(event.target.checked)}/> Use suggested voicings for piano playback</label>
          <label className="time-follow"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)}/> Follow playback</label>
          <label className="time-follow"><input type="checkbox" checked={timingVisible} onChange={event => setTimingVisible(event.target.checked)}/> Timing guide &amp; beat cues</label>
          <div className="time-sliders"><label>View angle<input type="range" min={overview ? -3.15 : -.75} max={overview ? 3.15 : .75} step="0.05" value={yaw} onChange={event => setYaw(Number(event.target.value))} aria-label="Session 3D view angle"/></label><label>View tilt<input type="range" min={overview ? -3.15 : -.65} max={overview ? 3.15 : .75} step="0.05" value={tilt} onChange={event => setTilt(Number(event.target.value))} aria-label="Session 3D view tilt"/></label><label>Zoom<input type="range" min={overview ? .35 : .7} max={overview ? 3.5 : 1.8} step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} aria-label="Session 3D view zoom"/></label></div>
          <button onClick={resetView}>Reset 3D view</button>
          <p>Warm red means lower pitch and cool blue means higher pitch on a fixed scale. Neutral notes have no single displayed octave. Paths illustrate the chosen piano voicing, not an inferred rhythm or fingering. The same pitch does not imply a sustained note. Use Score for individual note auditions and notation.</p>
        </dialog>
      </div>}
      {!compact && <label className="dna-timing-toggle"><input type="checkbox" checked={timingVisible} onChange={event => setTimingVisible(event.target.checked)}/> Timing guide & beat cues</label>}
      <p className="dna-time-hint">{overview ? "Time line: one mark per written chord; the moving line follows playback." : "Focused chord stays pinned; background chords travel along the time line. The bottom-right guide shows the selected visual meter and groove; its moving marker follows playback. Playback still assumes one 4/4 bar per chord. Shapes anticipate changes by 180 ms; audio stays on the beat."}</p>
      {!compact && <DnaVoiceLeading candidates={candidates} choice={voiceChoice} onChoice={changeVoice} enabled={voiceEnabled} onToggle={setVoiceEnabled} disabled={stale} hasNext={!!next}/>}
      {overview && <ChordLens chord={current} disabled={stale} onDive={() => { setFollow(false); onSelect(current.id); changeScope(false); }}/>}
      <div className="time-controls"><div className="time-control-group"><button disabled={stale || focus === 0} onClick={() => goTo(focus - 1)}>Previous chord</button><button disabled={stale || focus >= chords.length - 1} onClick={() => goTo(focus + 1)}>Next chord</button><button onClick={resetView}>Reset view</button></div>
        {!compact && <label className="time-follow"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)}/> Follow playback</label>}
        {reducedMotion && <span className="time-motion-note">Playback movement reduced by device setting.</span>}
      </div>
      <div className="dna-jump"><label>Jump to chord<input type="number" min="1" max={chords.length} value={focus + 1} disabled={stale} onChange={event => { const n = event.target.valueAsNumber; if (Number.isInteger(n)) goTo(n - 1); }}/></label><label>Jump to section<select value={String(chords.reduce((start, chord, index) => index <= focus && (index === 0 || chord.section !== chords[index - 1].section) ? index : start, 0))} disabled={stale} onChange={event => goTo(Number(event.target.value))}>{chords.flatMap((chord, index) => index === 0 || chord.section !== chords[index - 1].section ? [<option key={chord.id} value={index}>{chord.section} - chord {index + 1}</option>] : [])}</select></label></div>
      <div className="time-sliders"><label>Chord position <span>{focus + 1} of {chords.length}</span><input type="range" min={1} max={Math.max(1, chords.length)} step={1} value={focus + 1} disabled={stale || chords.length < 2} onChange={event => goTo(Number(event.target.value) - 1)} aria-label="Chord position"/></label></div>
      <details className="dna-view-options"><summary>View controls</summary><div className="time-sliders"><label>View angle <input type="range" min={overview ? -3.15 : -.75} max={overview ? 3.15 : .75} step="0.05" value={yaw} onChange={event => setYaw(Number(event.target.value))} aria-label="View angle"/></label><label>View tilt <input type="range" min={overview ? -3.15 : -.65} max={overview ? 3.15 : .75} step="0.05" value={tilt} onChange={event => setTilt(Number(event.target.value))} aria-label="View tilt"/></label><label>Zoom <input type="range" min={overview ? .35 : .7} max={overview ? 3.5 : 1.3} step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} aria-label="3D view zoom"/></label></div></details>
      <div className="time-legend"><span><i className="time-legend-root"/>Root</span><span><i className="time-legend-tone"/>Chord tone</span><span><i className="time-legend-lane"/>Pitch-class lane</span></div>
      <div className="time-explanation"><div><h3>{current.symbol} <span>· {current.section}</span></h3>{current.unresolved ? <p>This symbol is unresolved, so no notes or relationships are guessed.</p> : <><p>{current.notes.map(note => `${note.spelling} (${note.interval})`).join(' · ')}{current.bass ? ` · requested bass ${current.bass}` : ''}</p>{!isSelected && <p>Inspect this chord to select its notes.</p>}<div className="time-note-buttons" aria-label={`Notes in ${current.symbol}`}>{current.notes.map((note, i) => { const midi = unambiguousPitch(visualVoicings.find(item => item.id === current.id)?.notes, note.pitch); return <button className={`orbital-note ${note.root ? 'orbital-root' : 'orbital-tone'}`} data-note-midi={midi ?? undefined} data-note-color={noteColor(midi)} style={noteStyle(midi)} key={`${note.pitch}-${i}`} disabled={stale || !isSelected} aria-pressed={isSelected && note.pitch === selectedPitch} title={midi === null ? 'Octave not uniquely represented' : `Suggested pitch ${spelledMidiName(midi, note.spelling)}`} onClick={() => selectNote(note.pitch)}>{note.spelling}<small>{note.root ? 'root' : note.interval}</small></button>; })}</div></>}{!isSelected && <button className="time-inspect" disabled={stale} onClick={() => { setFollow(false); onSelect(current.id); }}>Inspect this chord</button>}
      </div><div><h3>What connects next</h3>{!next ? <p>End of the written chart. The lanes continue visually, but no more chords are inferred.</p> : current.unresolved || next.unresolved ? <p>{current.symbol} → {next.symbol}: an unresolved symbol prevents a note comparison.</p> : <p>{current.symbol} → {next.symbol}: {shared.length ? `${shared.length} shared pitch class${shared.length === 1 ? '' : 'es'} (${shared.map(pc => current.notes.find(note => note.pitch === pc)?.spelling).join(', ')}).` : 'no shared pitch classes.'} Shared pitch classes do not imply a particular fingering, octave or sustained note.</p>}</div></div>
      <details className="time-reference"><summary>How to read this view</summary><p>The circle places notes one semitone apart, starting at C: {CHROMATIC.map(note => note.label).join(' → ')} → C. Straight rails pass through the circular chord layers. Each rail represents a pitch class, so C4 and C5 share a rail and enharmonic names share a rail. Check the suggested voicing labels for the octave. The focused chord is clear; the next chord is shown faintly. Voice-leading guides show suggested movements and do not imply sustain. Positions along the central thread represent written chord occurrences, not actual time or song duration. Whole song shows every occurrence with a moving position line; click the strand or use Jump to chord to explore. Dense overviews condense notes; Chord detail restores individual note selection. Orange frames and accent marks show your chosen visual rhythm, assuming one bar per occurrence. Style examples are not inferred from the chart; the timing guide adds optional accent cues without changing the chord accompaniment. Playback advances using the chosen tempo and assumed bar per chord. Warm red means lower pitch and cool blue means higher pitch on a fixed scale. The geometry is a pitch-class map. Note colours show the indicated suggested piano voicing when its octave is unambiguous; neutral notes have no single displayed octave. The chart does not establish a key, rhythm, octave, or unique instrumental voicing.</p></details>
    </>}
  </section>;
}
