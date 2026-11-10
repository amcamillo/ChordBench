import { T } from '../i18n/Language.tsx';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LanguageToggle, useT } from '../i18n/Language.tsx';
import { parseChart, MAX_SOURCE_LENGTH } from '../domain/chart/parser.ts';
import type { AccidentalPreference } from '../domain/harmony/types.ts';
import { tonalTheory } from '../infrastructure/theory/tonal.ts';
import { readDraft, saveDraft } from '../infrastructure/storage/drafts.ts';
import type { Draft } from '../infrastructure/storage/drafts.ts';
import { workspaceReducer } from './workspace.ts';
import type { Workspace } from './workspace.ts';
import { usePlaylist } from '../features/playlist/usePlaylist.ts';
import { PlaylistManager } from '../features/playlist/PlaylistManager.tsx';
import { SessionWorkspace } from '../features/session/SessionWorkspace.tsx';
import { ChartViewer } from '../features/chart/ChartViewer.tsx';
import { TransitionInspector } from '../features/learning/TransitionInspector.tsx';
import { ChordInspector } from '../features/learning/ChordInspector.tsx';
import { InstrumentPanel } from '../features/instruments/InstrumentPanel.tsx';
import { InstrumentAudio } from '../infrastructure/audio/instrumentAudio.ts';
import type { Instrument } from '../infrastructure/audio/instrumentAudio.ts';
import { buildPlaybackPlan } from '../domain/song/playbackPlan.ts';
import { useSongTransport } from '../features/playback/useSongTransport.ts';
import { ChartImport } from '../features/chart/ChartImport.tsx';
import { buildSongJourney } from '../domain/graphs/songJourney.ts';
import { SongJourney } from '../features/graphs/SongJourney.tsx';
import { buildHarmonicMap } from '../domain/graphs/harmonicMap.ts';
import { HarmonicMap } from '../features/graphs/HarmonicMap.tsx';
import { ChordStructure } from '../features/graphs/ChordStructure.tsx';
import { buildFifthsTime } from '../domain/graphs/fifthsTime.ts';
import { ScoreDNA } from '../features/graphs/ScoreDNA.tsx';
import { buildScore } from '../domain/graphs/score.ts';
import { FifthsTimeView } from '../features/graphs/FifthsTimeView.tsx';

const DEMO = '[Verse]\nC       Am      F       G\nFind a little room for a new beginning\n\n[Chorus]\n[C]Take your time, [Am]find the notes\n[F]Let the changes [G]bring you home\n\n[Bridge]\nC/E | Fmaj7 | Dm7 | G7';
const TONICS = [ ['C', 0], ['C#', 1], ['Db', 1], ['D', 2], ['Eb', 3], ['E', 4], ['F', 5], ['F#', 6], ['Gb', 6], ['G', 7], ['Ab', 8], ['A', 9], ['Bb', 10], ['B', 11] ] as const;

type PanelName = 'editor' | 'chart' | 'details' | 'graph' | 'playback';
type PanelSettings = Record<PanelName, boolean>;
const DEFAULT_PANELS: PanelSettings = { editor: true, chart: true, details: true, graph: true, playback: true };
function initialPanels(): PanelSettings {
  try {
    const value = JSON.parse(localStorage.getItem('chord-workbench-panels-v1') || '{}') as Partial<PanelSettings>;
    return Object.fromEntries(Object.keys(DEFAULT_PANELS).map(key => [key, typeof value[key as PanelName] === 'boolean' ? value[key as PanelName] : true])) as PanelSettings;
  } catch { return { ...DEFAULT_PANELS }; }
}
function PanelToggle({ label, expanded, controls, onToggle }: { label: string; expanded: boolean; controls: string; onToggle(): void }) {
  const t = useT();
  return <button type="button" className="panel-toggle" aria-label={`${t(expanded ? 'Collapse' : 'Expand')} ${t(label)}`} aria-expanded={expanded} aria-controls={controls} onClick={onToggle}><span aria-hidden="true">{expanded ? '−' : '+'}</span><span className="panel-toggle-text">{t(expanded ? 'Collapse' : 'Expand')}</span></button>;
}

function initialState(source = DEMO): Workspace {
  const parsed = parseChart(source, tonalTheory);
  return { source, revision: 0, parsedRevision: 0, parsed, choices: {}, selectedId: parsed.occurrences[0]?.id ?? null,
    shift: 0, preference: 'preserve', sourceKey: '', notice: '' };
}

function downloadDraft(draft: Draft) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'chord-workbench-draft.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const t = useT();
  const [state, dispatch] = useReducer(workspaceReducer, undefined, () => initialState());
  const [session, setSession] = useState(() => {
    try { const saved = localStorage.getItem('chordbench-session'); if (saved !== null) return saved === 'true'; } catch { /* Optional preference. */ }
    return matchMedia('(max-width: 1199px), (pointer: coarse)').matches;
  });
  function changeSession(value: boolean) {
    setSession(value);
    try { localStorage.setItem('chordbench-session', String(value)); } catch { /* Optional preference. */ }
    window.scrollTo(0, 0);
  }
  const [tab, setTab] = useState<'chart' | 'graph' | 'learn'>('chart');
  const [graphView, setGraphView] = useState<'journey' | 'harmonic' | 'structure' | 'time' | 'score'>('time');
  const [panels, setPanels] = useState<PanelSettings>(initialPanels);
  const [structurePitch, setStructurePitch] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<Draft | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Checking local draft…');
  const [editorError, setEditorError] = useState('');
  const [copied, setCopied] = useState(false);
  const [instrument, setInstrument] = useState<Instrument>('piano');
  const [tempo, setTempo] = useState(90);
  const [tempoText, setTempoText] = useState('90');
  const [audio] = useState(() => new InstrumentAudio());
  const editor = useRef<HTMLTextAreaElement>(null);
  const stale = state.revision !== state.parsedRevision;
  const [scoreChoices, setScoreChoices] = useState<Record<string, string>>({});
  const [guidedPlayback, setGuidedPlayback] = useState(false);
  const score = useMemo(() => buildScore(state.parsed, tonalTheory, state.shift, state.preference, scoreChoices), [state.parsed, state.shift, state.preference, scoreChoices]);
  useEffect(() => setScoreChoices({}), [state.source, state.shift, state.preference]);
  const playbackPlan = useMemo(() => {
    const plan = buildPlaybackPlan(state.parsed, tonalTheory, state.shift, state.preference, instrument);
    return guidedPlayback && instrument === 'piano' ? plan.map((event, index) => ({ ...event, pitches: score[index]?.notes.map(note => note.midi) ?? event.pitches })) : plan;
  }, [state.parsed, state.shift, state.preference, instrument, guidedPlayback, score]);
  const journey = useMemo(() => buildSongJourney(state.parsed, tonalTheory, state.shift, state.preference), [state.parsed, state.shift, state.preference]);
  const harmonicMap = useMemo(() => buildHarmonicMap(state.parsed, tonalTheory, state.shift, state.preference), [state.parsed, state.shift, state.preference]);
  const fifthsTime = useMemo(() => buildFifthsTime(state.parsed, tonalTheory, state.shift, state.preference), [state.parsed, state.shift, state.preference]);
  const transport = useSongTransport(playbackPlan, tempo, instrument, audio);
  const unavailable = playbackPlan.filter(event => event.warning);
  const tempoValid = /^\d+$/.test(tempoText) && Number(tempoText) >= 40 && Number(tempoText) <= 240;
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => { if (stale) transport.stop('Chart changed. Playback stopped.'); }, [stale]);
  const currentDraft: Draft = useMemo(() => ({ schemaVersion: 1, source: state.source, shift: state.shift,
    preference: state.preference, sourceKey: state.sourceKey, choices: state.choices, savedAt: new Date().toISOString() }),
  [state.source, state.shift, state.preference, state.sourceKey, state.choices]);
  const songSnapshot = useMemo(() => ({ draft: currentDraft, tempo, instrument }), [currentDraft, tempo, instrument]);
  const playlist = usePlaylist(songSnapshot);
  useEffect(() => { try { localStorage.setItem('chord-workbench-panels-v1', JSON.stringify(panels)); } catch { /* optional presentation preference */ } }, [panels]);
  function showView(view: 'chart' | 'graph' | 'learn') {
    setTab(view);
    requestAnimationFrame(() => document.getElementById('workspace')?.scrollIntoView({ block: 'start' }));
  }
  function setPanel(name: PanelName, value: boolean) { setPanels(previous => ({ ...previous, [name]: value })); }

  useEffect(() => {
    let active = true;
    readDraft().then(draft => {
      if (!active) return;
      setRecovery(draft);
      setStorageReady(!draft);
      setSaveStatus(draft ? 'Saved draft available' : 'Ready to save locally');
    }).catch(() => {
      if (!active) return;
      setStorageError('Local storage could not be read. Your current chart is still editable. Download a draft to keep a copy.');
      setSaveStatus('Local save unavailable');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!stale) return;
    const timer = setTimeout(() => {
      try {
        const parsed = parseChart(state.source, tonalTheory, state.parsed, state.choices);
        dispatch({ type: 'parsed', revision: state.revision, parsed });
      } catch (error) { setEditorError(error instanceof Error ? error.message : 'Unable to parse this chart.'); }
    }, 180);
    return () => clearTimeout(timer);
  }, [state.source, state.revision, state.parsed, state.choices, stale]);

  useEffect(() => {
    if (!storageReady || recovery) return;
    let active = true;
    setSaveStatus('Unsaved changes');
    const timer = setTimeout(() => {
      setSaveStatus('Saving locally…');
      saveDraft(currentDraft).then(() => {
        if (active) { setSaveStatus('Saved on this browser'); setStorageError(''); }
      }).catch(() => {
        if (active) { setSaveStatus('Changes not saved'); setStorageError('The browser could not save your draft. Keep editing, or download a copy.'); }
      });
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [currentDraft, storageReady, recovery]);

  const selected = state.parsed.occurrences.find(item => item.id === state.selectedId);
  const nextOccurrence = state.parsed.occurrences[state.parsed.occurrences.findIndex(item => item.id === state.selectedId) + 1];
  const nextResult = selected && nextOccurrence ? tonalTheory.transpose(nextOccurrence.symbol, state.shift, state.preference) : undefined;
  const selectedResult = selected ? tonalTheory.transpose(selected.symbol, state.shift, state.preference) : undefined;
  useEffect(() => { setStructurePitch(null); audio.stop('structure'); }, [selected?.id, state.shift, state.preference, audio]);
  const unresolved = state.parsed.occurrences.filter(item => item.result.status !== 'resolved').length;
  const targetTonic = state.sourceKey ? tonalTheory.transposeNote(state.sourceKey, state.shift, state.preference) : '';

  function select(id: string) { dispatch({ type: 'select', id }); }
  function changeInstrument(value: Instrument) { transport.stop('Instrument changed. Ready to play from the beginning.'); audio.stop('preview'); setInstrument(value); }
  function loadPlaylistSong(id: string) {
    if (recovery) return;
    const song = playlist.activate(id);
    if (!song) return;
    transport.stop('Song changed. Ready to play from the beginning.'); audio.stop();
    const draft = song.draft;
    const parsed = parseChart(draft.source, tonalTheory, undefined, draft.choices);
    dispatch({ type: 'restore', state: { ...initialState(draft.source), parsed, choices: draft.choices,
      selectedId: parsed.occurrences[0]?.id ?? null, shift: draft.shift, preference: draft.preference, sourceKey: draft.sourceKey } });
    setTempo(song.tempo); setTempoText(String(song.tempo)); setInstrument(song.instrument);
  }
  function restoreDraft() {
    if (!recovery) return;
    const parsed = parseChart(recovery.source, tonalTheory, undefined, recovery.choices);
    dispatch({ type: 'restore', state: { ...initialState(recovery.source), parsed, choices: recovery.choices,
      selectedId: parsed.occurrences[0]?.id ?? null, shift: recovery.shift, preference: recovery.preference, sourceKey: recovery.sourceKey } });
    setRecovery(null); setStorageReady(true);
  }
  function focusSpan(start: number, end: number) {
    setTab('chart');
    setPanel('editor', true);
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(start, end); });
  }
  async function copyChart() {
    const text = state.parsed.lines.flatMap(line => line.tokens).map(token => {
      if (!token.occurrenceId) return token.text;
      const occurrence = state.parsed.occurrences.find(item => item.id === token.occurrenceId)!;
      const result = tonalTheory.transpose(occurrence.symbol, state.shift, state.preference);
      if (result.status !== 'resolved') return token.text;
      return token.text.startsWith('[') ? `[${result.chord.symbol}]` : result.chord.symbol;
    }).join('');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setEditorError('Clipboard access is unavailable. Select and copy text from the editor.'); }
  }

  function chooseScoreVoicing(id: string, candidate: string) { select(id); transport.stop('Voicing changed. Ready to play.'); audio.stop(); setScoreChoices(previous => ({ ...previous, [id]: candidate })); }
  function setGuided(value: boolean) { const active = transport.activeIndex === null ? undefined : playbackPlan[transport.activeIndex]; if (active) select(active.occurrenceId); setGuidedPlayback(value); }
  const scoreView = <ScoreDNA score={score} selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId ?? null}
    stale={stale} audio={audio} onSelect={select} onChoice={chooseScoreVoicing}
    onAudition={() => transport.stop('Chart stopped for score preview.')} guidedPlayback={guidedPlayback} onGuidedPlayback={setGuided}/>;
  const sessionPosition = transport.state !== 'stopped' && transport.activeIndex !== null
    ? transport.activeIndex : state.parsed.occurrences.findIndex(item => item.id === state.selectedId);
  const sessionOccurrence = state.parsed.occurrences[sessionPosition];
  const sessionNext = state.parsed.occurrences[sessionPosition + 1];
  const sessionCurrentResult = sessionOccurrence && tonalTheory.transpose(sessionOccurrence.symbol, state.shift, state.preference);
  const sessionNextResult = sessionNext && tonalTheory.transpose(sessionNext.symbol, state.shift, state.preference);
  function browseSessionChord(index: number) {
    const item = state.parsed.occurrences[index];
    if (!item) return;
    if (transport.state !== 'stopped') transport.stop('Chart stopped for chord browsing.');
    select(item.id);
  }
  if (session && !recovery && !storageError) return <SessionWorkspace
    symbol={sessionCurrentResult?.status === 'resolved' ? sessionCurrentResult.chord.symbol : sessionOccurrence?.symbol ?? t('No chords')}
    next={sessionNextResult?.status === 'resolved' ? sessionNextResult.chord.symbol : sessionNext?.symbol ?? ''}
    position={sessionPosition} count={state.parsed.occurrences.length} section={sessionOccurrence?.section ?? t('Chart')}
    selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId ?? null}
    playback={transport.state} disabled={stale || !tempoValid} status={/could not|interrupted/.test(transport.message) ? t(transport.message) : `${tempo} BPM / ${t(transport.state)}${transport.activeIndex !== null ? ` / ${playbackPlan[transport.activeIndex]?.symbol ?? ''}` : ''}`}
    onPrevious={() => browseSessionChord(sessionPosition - 1)}
    onNext={() => browseSessionChord(sessionPosition + 1)}
    onPlay={() => void transport.play()} onPause={() => transport.pause()} onStop={() => { if (sessionOccurrence) select(sessionOccurrence.id); transport.stop(); }}
    onSetup={() => changeSession(false)}
    songs={playlist.songs} activeSong={playlist.activeId} onSong={loadPlaylistSong} playlistError={playlist.error}
    chart={<ChartViewer chart={state.parsed} theory={tonalTheory} shift={state.shift} preference={state.preference} selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId} stale={stale} onSelect={select}/>}
    piano={sessionOccurrence && sessionCurrentResult?.status === 'resolved' ? <InstrumentPanel guidedNotes={guidedPlayback && instrument === 'piano' ? score[sessionPosition]?.notes : undefined} chord={sessionCurrentResult.chord} occurrenceId={sessionOccurrence.id} disabled={stale} instrument={instrument} onInstrumentChange={changeInstrument} audio={audio} songPlaying={transport.state === 'playing'} focusPitchClass={structurePitch} onPreview={() => { select(sessionOccurrence.id); transport.stop('Chart playback stopped for instrument preview.'); }}/> : <p><T text={"No playable voicing. Choose another chord or open Setup."}/></p>}
    dna={<FifthsTimeView compact score={score} onScoreChoice={chooseScoreVoicing} guidedPlayback={guidedPlayback} onGuidedPlayback={setGuided} tempo={tempo} chords={fifthsTime} selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId ?? null} playbackState={transport.state} playbackDisabled={stale || !tempoValid || playbackPlan.length === 0} onTimingCues={transport.setTimingCues} onPlay={() => void transport.play()} onPause={() => transport.pause()} onStop={() => transport.stop()} getPlaybackPosition={transport.getPosition} selectedPitch={structurePitch} stale={stale} onSelect={id => { if (transport.state !== 'stopped') transport.stop('Chart stopped for chord browsing.'); select(id); }} onPitchSelect={setStructurePitch}/>}
    score={scoreView}
  />;

  return <>
    <a className="skip-link" href="#chart-editor" onClick={event => { event.preventDefault(); setTab('chart'); setPanel('editor', true); requestAnimationFrame(() => editor.current?.focus()); }}><T text={"Skip to chart editor"}/></a>
    <header className="app-header">
      <LanguageToggle/>
      <a className="brand" href="#"><svg width="34" height="38" viewBox="0 0 34 38" fill="none" aria-hidden="true"><path d="M8 29V8m9 16V4m9 25V12" stroke="currentColor" strokeWidth="2"/><circle cx="8" cy="29" r="5" fill="currentColor"/><circle cx="17" cy="24" r="5" fill="currentColor"/><circle cx="26" cy="29" r="5" fill="currentColor"/></svg><span><T text={"Chord"}/><span className="brand-light">Workbench</span></span></a>
      <span className="local-status" role="status"><span className={`status-dot ${storageError ? 'error-dot' : ''}`} aria-hidden="true"/>{t(saveStatus)}</span>
      <button className="primary-button" onClick={() => changeSession(true)}><T text={"Start session"}/></button>
      <button className="quiet-button" onClick={() => downloadDraft(currentDraft)}><T text={"Download draft"}/></button>
    </header>

    <main>
      <div className="workspace-intro"><div><h1><T text={"Explore the shape of your music."}/></h1><p><T text={"Read a chart, follow its harmony and hear how the chords connect."}/></p></div><div className="intro-actions"><span className="edition-label"><T text={"Your listening workspace"}/></span><div className="intro-buttons"><button className="explore-fifths" onClick={() => { setTab('chart'); setPanel('editor', true); requestAnimationFrame(() => editor.current?.focus()); }}><T text={"Edit chart"}/></button><button className="explore-fifths" onClick={() => { setGraphView('time'); setTab('graph'); setPanel('graph', true); requestAnimationFrame(() => document.getElementById('graph-workspace')?.scrollIntoView({ block: 'start' })); }}><T text={"Explore Song DNA"}/></button></div></div></div>
      {recovery && <section className="notice recovery" aria-label={t("Draft recovery")}><div><strong><T text={"A saved draft is waiting."}/></strong><p><T text={"Restore it before editing, or keep this chart and replace the local draft."}/></p></div><button className="primary-button" onClick={restoreDraft}><T text={"Restore draft"}/></button><button onClick={() => { setRecovery(null); setStorageReady(true); }}><T text={"Keep current chart"}/></button></section>}
      {storageError && <div className="notice" role="alert"><p>{t(storageError)}</p><button onClick={() => { setStorageReady(true); setStorageError(''); }}><T text={"Retry local saving"}/></button></div>}
      <PlaylistManager playlist={playlist} onLoad={loadPlaylistSong} disabled={!!recovery || stale}/>
      <nav className="mobile-tabs" aria-label={t("Workspace views")}><button aria-current={tab === 'chart' ? 'page' : undefined} onClick={() => showView('chart')}><T text={"Chart"}/></button><button aria-current={tab === 'graph' ? 'page' : undefined} onClick={() => showView('graph')}><T text={"Graph"}/></button><button aria-current={tab === 'learn' ? 'page' : undefined} onClick={() => showView('learn')}><T text={"Learn"}/>{selectedResult?.status === 'resolved' ? ` · ${selectedResult.chord.symbol}` : ''}</button></nav>

      <div id="workspace" className="workspace" data-tab={tab} data-editor-open={panels.editor} data-chart-open={panels.chart} data-details-open={panels.details} data-graph-open={panels.graph}>
        <div className="graph-region" id="graph-workspace"><div className="workspace-bar graph-bar"><div><h2><T text={"Harmony space"}/></h2><p><T text={"Choose a view to explore your chart."}/></p></div><PanelToggle label="visualization" expanded={panels.graph} controls="graph-content" onToggle={() => setPanel('graph', !panels.graph)}/></div><div id="graph-content" hidden={!panels.graph}><nav className="graph-switch" aria-label={t("Graph views")}><button aria-pressed={graphView === 'score'} onClick={() => setGraphView('score')}><T text={"Score view"}/></button><button aria-pressed={graphView === 'time'} onClick={() => setGraphView('time')}><T text={"Song DNA"}/></button><button aria-pressed={graphView === 'journey'} onClick={() => setGraphView('journey')}><T text={"Song journey"}/></button><button aria-pressed={graphView === 'harmonic'} onClick={() => setGraphView('harmonic')}><T text={"Harmonic map"}/></button><button aria-pressed={graphView === 'structure'} onClick={() => setGraphView('structure')}><T text={"Chord structure"}/></button></nav>
          {graphView === 'score' ? scoreView : graphView === 'time' ? <FifthsTimeView tempo={tempo} chords={fifthsTime} selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId ?? null} playbackState={transport.state} playbackDisabled={stale || !tempoValid || playbackPlan.length === 0} onTimingCues={transport.setTimingCues} onPlay={() => void transport.play()} onPause={() => transport.pause()} onStop={() => transport.stop()} getPlaybackPosition={transport.getPosition} selectedPitch={structurePitch} stale={stale} onSelect={select} onPitchSelect={setStructurePitch}/> : graphView === 'journey' ? <SongJourney journey={journey} selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId ?? null} stale={stale} onSelect={select}/> : graphView === 'harmonic' ? <HarmonicMap map={harmonicMap} selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId ?? null} stale={stale} onSelect={select}/> : <ChordStructure chord={selectedResult?.status === 'resolved' ? selectedResult.chord : undefined} occurrenceId={selected?.id} stale={stale} audio={audio} selectedPitchClass={structurePitch} onNoteChange={setStructurePitch} onAudition={() => transport.stop('Chart playback stopped for chord structure audio.')}/>}
        </div></div>
        <section className="chart-panel" aria-labelledby="chart-heading">
          <div className="panel-heading"><div><h2 id="chart-heading"><T text={"Read & explore"}/></h2><p>{state.parsed.occurrences.length} {t('chord occurrences')}</p></div><div className="panel-heading-actions"><button className="quiet-button" hidden={!panels.chart} disabled={stale || !state.source.trim()} onClick={copyChart}>{t(copied ? 'Copied' : 'Copy chart')}</button><PanelToggle label="chart" expanded={panels.chart} controls="chart-content" onToggle={() => setPanel('chart', !panels.chart)}/></div></div>
      <section className="song-transport" aria-label={t("Chart playback")}>
        <div className="transport-intro"><div className="transport-heading"><h2><span aria-hidden="true">&#9654;</span> <T text={"Play the chart"}/></h2><PanelToggle label="playback settings" expanded={panels.playback} controls="playback-settings" onToggle={() => setPanel('playback', !panels.playback)}/></div><p hidden={!panels.playback}><T text="Assumed timing: one 4/4 bar per written chord. Repeats are not expanded."/></p></div>
        <div className="transport-controls"><div id="playback-settings" className="playback-settings" hidden={!panels.playback}><label><T text={"Instrument"}/><select aria-label={t("Chart playback instrument")} value={instrument} onChange={event => changeInstrument(event.target.value as Instrument)}><option value="piano"><T text={"Piano"}/></option><option value="guitar"><T text={"Guitar"}/></option></select></label><label><T text={"Tempo"}/> <span>(BPM)</span><input aria-label={t("Chart tempo in beats per minute")} type="number" inputMode="numeric" min="40" max="240" step="1" value={tempoText} aria-invalid={!tempoValid} disabled={transport.state !== 'stopped'} onChange={event => { const value = event.target.value; setTempoText(value); const next = event.target.valueAsNumber; if (Number.isInteger(next) && next >= 40 && next <= 240) setTempo(next); }}/></label></div>
          {transport.state === 'playing' ? <button onClick={() => transport.pause()}><T text={"Pause chart"}/></button> : <button className="primary-button" disabled={stale || !tempoValid || playbackPlan.length === 0} onClick={() => void transport.play()}>{t(transport.state === 'paused' ? 'Resume chart' : 'Play chart')}</button>}
          <button disabled={transport.state === 'stopped'} onClick={() => transport.stop()}><T text={"Stop chart"}/></button></div>
        <p className="transport-status" role="status">{transport.message}{transport.activeIndex !== null && playbackPlan[transport.activeIndex] ? ` Chord ${transport.activeIndex + 1} of ${playbackPlan.length}: ${playbackPlan[transport.activeIndex].symbol}${playbackPlan[transport.activeIndex].warning ? ' (silent)' : ''}.` : ''}</p>
        {!tempoValid && <p className="transport-warning"><T text={"Enter a tempo from 40 to 240 BPM."}/></p>}
        {unavailable.length > 0 && <p className="transport-warning">{unavailable.length} chord occurrence{unavailable.length === 1 ? '' : 's'} will be silent: {Array.from(new Set(unavailable.map(event => `${event.symbol} (${event.warning})`))).join(', ')}.</p>}
      </section>
          <div id="chart-content" className="chart-content" hidden={!panels.chart}>
          <fieldset className="transpose-controls" disabled={stale}><legend><T text={"Transpose"}/></legend><div className="shift-control"><button aria-label={t("Transpose down one semitone")} disabled={state.shift <= -11} onClick={() => dispatch({ type: 'shift', value: state.shift - 1 })}>−</button><output aria-live="polite">{state.shift > 0 ? '+' : ''}{state.shift}<small><T text={"semitones"}/></small></output><button aria-label={t("Transpose up one semitone")} disabled={state.shift >= 11} onClick={() => dispatch({ type: 'shift', value: state.shift + 1 })}>+</button></div><label className="spelling-control"><T text={"Note spelling"}/><select value={state.preference} onChange={event => dispatch({ type: 'preference', value: event.target.value as AccidentalPreference })}><option value="preserve"><T text={"Follow source"}/></option><option value="sharps"><T text={"Prefer sharps"}/></option><option value="flats"><T text={"Prefer flats"}/></option></select></label><button className="reset-button" disabled={state.shift === 0 && state.preference === 'preserve'} onClick={() => { dispatch({ type: 'shift', value: 0 }); dispatch({ type: 'preference', value: 'preserve' }); }}><T text={"Reset"}/></button></fieldset>
          <details className="key-controls"><summary>{state.sourceKey ? `${t('Manual tonic:')} ${state.sourceKey} → ${targetTonic}` : 'Key unknown · choose a tonic if you know it'}</summary><div><label><T text={"Source tonic"}/><select value={state.sourceKey} onChange={event => dispatch({ type: 'key', value: event.target.value })}><option value=""><T text={"Unknown"}/></option>{TONICS.map(([name]) => <option key={name}>{name}</option>)}</select></label><label><T text={"Target tonic"}/><select disabled={!state.sourceKey || stale} value={targetTonic} onChange={event => { const source = TONICS.find(([name]) => name === state.sourceKey)![1]; const target = TONICS.find(([name]) => name === event.target.value)![1]; dispatch({ type: 'shift', value: (target - source + 12) % 12 }); dispatch({ type: 'preference', value: event.target.value.includes('b') || event.target.value === 'F' ? 'flats' : 'sharps' }); }}><option value=""><T text={"Choose source first"}/></option>{TONICS.map(([name]) => <option key={name}>{name}</option>)}</select></label></div><p><T text={"This is your tonic choice, not an inferred key or mode."}/></p></details>
          {state.shift !== 0 && <p className="projection-label"><T text={"Transposed view. Your original text is unchanged."}/>{unresolved > 0 && ` ${unresolved} unresolved symbol(s) remain as written.`}</p>}
          {stale && <p role="status" className="projection-label"><T text={"Updating chart\u2026 showing the previous revision."}/></p>}
          <ChartViewer chart={state.parsed} theory={tonalTheory} shift={state.shift} preference={state.preference} selectedId={state.selectedId} playingId={transport.activeIndex === null ? null : playbackPlan[transport.activeIndex]?.occurrenceId} stale={stale} onSelect={select}/>
          <div className="chart-footer"><span><T text={"Tap a chord, then open Learn to hear its notes."}/></span><span><T text={"No timing assumed"}/></span></div>
          {state.notice && <p role="status" className="projection-label">{state.notice}</p>}
          </div>
        </section>
        <section className="editor-panel" aria-labelledby="editor-heading">
          <div className="panel-heading"><div><h2 id="editor-heading"><T text={"Your chart"}/></h2><span className="source-label"><T text={"Original"}/></span></div><PanelToggle label="editor" expanded={panels.editor} controls="editor-content" onToggle={() => setPanel('editor', !panels.editor)}/></div>
          <div id="editor-content" hidden={!panels.editor}>
          <ChartImport theory={tonalTheory} recoveryPending={!!recovery} onImport={source => { playlist.detach(); transport.stop('Chart imported. Ready to play from the beginning.'); audio.stop(); dispatch({ type: 'restore', state: initialState(source) }); }}/>
          <label htmlFor="chart-editor"><T text={"Chords and lyrics"}/></label>
          <textarea ref={editor} id="chart-editor" value={state.source} spellCheck={false} aria-describedby="editor-hint" aria-invalid={!!editorError}
            onChange={event => { if (event.target.value.length > MAX_SOURCE_LENGTH) { setEditorError('That chart is too large. Split it into sections under 500,000 characters.'); return; } setEditorError(''); dispatch({ type: 'edit', source: event.target.value }); }} />
          <p id="editor-hint" className="helper"><T text={"Use chords above lyrics, [inline] chords, or bar-separated progressions."}/></p>
          {editorError && <p role="alert" className="error-text">{editorError}</p>}
          <div className="editor-actions"><button onClick={() => { if (state.source === DEMO || !state.source.trim() || window.confirm('Replace the editor text with the example chart? Download a draft first to keep your current chart.')) dispatch({ type: 'restore', state: initialState() }); }}><T text={"Load example"}/></button><span>{state.source.length.toLocaleString()} characters</span></div>
          <details className="parse-review" open={state.parsed.diagnostics.length > 0}>
            <summary>{stale ? 'Reviewing changes…' : state.parsed.diagnostics.length ? `${state.parsed.diagnostics.length} item${state.parsed.diagnostics.length === 1 ? '' : 's'} to review` : 'Parsing looks clear'}</summary>
            {state.parsed.diagnostics.length === 0 ? <p>Recognised {state.parsed.occurrences.length} chord occurrences. No text was removed.</p> : <ul>{state.parsed.diagnostics.map(item => <li key={`${item.start}-${item.symbol}`}><strong>{item.symbol}</strong><p>{t(item.message)}</p><div className="review-actions">{item.reviewKey && <><button disabled={stale} onClick={() => dispatch({ type: 'review', key: item.reviewKey!, value: 'chord' })}><T text={"Treat as chord"}/></button><button disabled={stale} onClick={() => dispatch({ type: 'review', key: item.reviewKey!, value: 'text' })}><T text={"Keep as text"}/></button></>}<button disabled={stale} onClick={() => focusSpan(item.start, item.end)}><T text={"Edit token"}/></button></div></li>)}</ul>}
          </details>
          </div>
        </section>

        <div className="learning-panel"><div className="workspace-bar details-bar"><div><h2><T text={"Chord details"}/></h2><p>{selectedResult?.status === 'resolved' ? selectedResult.chord.symbol : 'Select a chord'}</p></div><PanelToggle label="chord details" expanded={panels.details} controls="details-content" onToggle={() => setPanel('details', !panels.details)}/></div><div id="details-content" hidden={!panels.details}><ChordInspector occurrence={selected} result={selectedResult} shift={state.shift}/>{selected && selectedResult?.status === 'resolved' && <InstrumentPanel guidedNotes={guidedPlayback && instrument === 'piano' ? score.find(item => item.id === selected.id)?.notes : undefined} chord={selectedResult.chord} occurrenceId={selected.id} disabled={stale} instrument={instrument} onInstrumentChange={changeInstrument} audio={audio} songPlaying={transport.state === 'playing'} focusPitchClass={structurePitch} onPreview={() => transport.stop('Chart playback stopped for instrument preview.')}/>}<TransitionInspector key={`${selected?.id}-${selected?.symbol}-${nextOccurrence?.id}-${nextOccurrence?.symbol}-${state.shift}-${state.preference}`} from={selectedResult?.status === 'resolved' ? selectedResult.chord : undefined} to={nextResult?.status === 'resolved' ? nextResult.chord : undefined} hasNext={!!selected && !!nextOccurrence} disabled={stale} audio={audio} onAudition={() => transport.stop('Chart playback stopped for transition preview.')}/><button className="back-to-chart" onClick={() => showView('chart')}><T text={"Back to chart"}/></button></div></div>
      </div>
      <footer className="workspace-footer"><p><T text={"Your chart stays in this browser. Download a draft to keep a separate copy."}/></p><details><summary><T text={"About this first build"}/></summary><p><T text={"Chart parsing, song journey, harmonic map, chord notes, transposition, simulated instruments, assumed-timing chart playback and local draft recovery are available. The rhythm\u2013pitch lab is a later increment. Draft downloads are backups of the editor; importing them is not available yet."}/></p></details></footer>
    </main>
  </>;
}
