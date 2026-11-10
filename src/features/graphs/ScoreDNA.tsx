import { useT } from '../../i18n/Language.tsx';
import { T } from '../../i18n/Language.tsx';
import { useEffect, useRef, useState } from 'react';
import { notePositions, type ScoreChord } from '../../domain/graphs/score.ts';
import { spelledMidiName, type PianoNote } from '../../domain/instruments/voicings.ts';
import { noteColor } from '../../domain/harmony/noteColor.ts';
import { noteStyle } from '../noteStyle.ts';
import type { InstrumentAudio } from '../../infrastructure/audio/instrumentAudio.ts';

interface Props {
  score: ScoreChord[]; selectedId: string | null; playingId: string | null; stale: boolean;
  audio: InstrumentAudio; onSelect(id: string): void; onChoice(id: string, candidate: string): void;
  onAudition(): void; guidedPlayback: boolean; onGuidedPlayback(value: boolean): void;
}
export function ScoreDNA({ score, selectedId, playingId, stale, audio, onSelect, onChoice, onAudition, guidedPlayback, onGuidedPlayback }: Props) {
  const t = useT();
  const [labels, setLabels] = useState(true);
  const [depth, setDepth] = useState(true);
  const [guides, setGuides] = useState(true);
  const [status, setStatus] = useState('');
  const help = useRef<HTMLDialogElement>(null);
  const options = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const index = Math.max(0, score.findIndex(chord => chord.id === (playingId ?? selectedId)));
  const current = score[index], next = score[index + 1];
  const left = notePositions(current?.notes ?? [], 180), right = notePositions(next?.notes ?? [], 440);
  const movements = current?.chosen?.movements ?? [];
  const unchanged = movements.filter(voice => voice.semitones === 0).map(voice => spelledMidiName(voice.from!.midi, voice.from!.spelling));
  useEffect(() => {
    generation.current++; audio.stop('structure'); setStatus('');
  }, [current, next, stale, audio]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { generation.current++; audio.stop('structure'); } };
    document.addEventListener('visibilitychange', hide);
    return () => { generation.current++; audio.stop('structure'); document.removeEventListener('visibilitychange', hide); };
  }, [audio]);
  async function hear(notes: PianoNote[], target: PianoNote[] = []) {
    if (stale || !notes.length) return;
    if (playingId && current) onSelect(current.id);
    onAudition();
    const ticket = ++generation.current;
    try {
      await audio.play([...notes.map(note => ({ midi: note.midi, delay: 0, duration: .85 })), ...target.map(note => ({ midi: note.midi, delay: 1, duration: .85 }))], 'piano', 'structure');
      if (ticket === generation.current) setStatus(target.length ? 'Current voicing, then next voicing. Two separate attacks.' : `Playing ${notes.map(note => spelledMidiName(note.midi, note.spelling)).join(', ')}.`);
    } catch { if (ticket === generation.current) setStatus('Sound could not start. Tap to try again.'); }
  }
  const top = Math.min(40, ...left.map(note => note.y - 24), ...right.map(note => note.y - 24));
  const bottom = Math.max(295, ...left.map(note => note.y + 24), ...right.map(note => note.y + 24));
  return <section className="score-dna" aria-label={t("Song DNA score")}>
    <div className="score-toolbar"><h2 aria-label={t("Song DNA")}><T text={"Song DNA"}/> <small><T text={"Staff & voices"}/></small></h2><button onClick={() => options.current?.showModal()}><T text={"Score options"}/></button></div>
    {!current ? <p><T text={"Add a chart to see its chords on the staff."}/></p> : <>
      <div className="score-chords"><button disabled={stale || !current.notes.length} onClick={() => void hear(current.notes)}><small>{t(playingId ? 'Playing' : 'Current')} · {index + 1}</small><strong>{current.symbol}</strong><span>{current.section}</span></button><button disabled={stale || !next} onClick={() => { if (next) { onAudition(); onSelect(next.id); } }}><small>{t('Up next ·')} {next ? index + 2 : '—'}</small><strong>{next?.symbol ?? t('End')}</strong><span>{t(next ? 'Tap to inspect' : 'Last written chord')}</span></button></div>
      <div className="score-paper" data-depth={depth}>
        <svg className="score-staff" viewBox={`0 ${top} 600 ${bottom - top}`} role="img" aria-label={`Grand staff: ${current.symbol} ${current.notes.map(n => spelledMidiName(n.midi, n.spelling)).join(', ')}; next ${next?.symbol ?? 'end'} ${next?.notes.map(n => spelledMidiName(n.midi, n.spelling)).join(', ') ?? ''}`}>
          <defs><marker id="score-arrow-common" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="#287c71"/></marker><marker id="score-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="#37465e"/></marker></defs>
          {[98, 206].map(start => <g key={start}>{[0,1,2,3,4].map(line => <line key={line} x1="22" x2="578" y1={start + line * 12} y2={start + line * 12} stroke="#8c91a5" strokeWidth="1.2"/>)}</g>)}
          <path d="M22 98V254M305 98V254M578 98V254" fill="none" stroke="#8c91a5" strokeWidth="1.4"/>
          <text x="28" y="140" fontSize="63" fontFamily="Segoe UI Symbol, serif">𝄞</text><text x="31" y="246" fontSize="52" fontFamily="Segoe UI Symbol, serif">𝄢</text>
          <g fill="#454860" fontSize="20" fontFamily="serif" textAnchor="middle"><text x="89" y="118">4</text><text x="89" y="141">4</text><text x="89" y="226">4</text><text x="89" y="249">4</text></g>
          {guides && movements.map((voice, i) => {
            if (!voice.from || !voice.to) return null;
            const a = left.find(n => n.note.midi === voice.from!.midi), b = right.find(n => n.note.midi === voice.to!.midi);
            return a && b ? <path key={i} d={`M${a.x + 13} ${a.y} C275 ${a.y}, 350 ${b.y}, ${b.x - 17} ${b.y}`} stroke="#37465e" strokeWidth="2.2" strokeDasharray={voice.semitones === 0 ? undefined : "5 5"} fill="none" markerEnd={voice.semitones === 0 ? undefined : 'url(#score-arrow)'}/> : null;
          })}
          {[left, right].map((notes, column) => <g key={column}>{notes.map((item, i) => <g key={item.name}>
            {item.ledgers.map(y => <line key={y} x1={item.x - 18} x2={item.x + 18} y1={y} y2={y} stroke="#454860" strokeWidth="1.4"/>)}
            {item.accidental && <text x={item.x - 25 - (i % 3) * 12} y={item.y + 6} fontSize="22" textAnchor="end">{item.accidental}</text>}
            <ellipse cx={item.x} cy={item.y} rx="11" ry="6.2" transform={`rotate(-15 ${item.x} ${item.y})`} data-note-midi={item.note.midi} data-note-color={noteColor(item.note.midi)} fill="white" stroke={noteColor(item.note.midi)} strokeWidth={item.note.midi % 12 === (column === 0 ? current.chord?.pitchClasses[0] : next?.chord?.pitchClasses[0]) ? 4.5 : 3}/>
          </g>)}</g>)}
          {!current.chord && <text x="180" y="185" textAnchor="middle" fontSize="16"><T text={"Unresolved chord"}/></text>}
          {next && !next.chord && <text x="440" y="185" textAnchor="middle" fontSize="16"><T text={"Unresolved chord"}/></text>}
        </svg>
      </div>
      <p className="score-assumption"><T text={"Practice 4/4 \u00b7 one whole note per chord. Original rhythm unknown."}/></p>
      <div className="score-actions"><button disabled={stale || !current.notes.length} onClick={() => void hear(current.notes)}><T text={"Hear chord"}/></button><button disabled={stale || !current.chosen} onClick={() => void hear(current.notes, next!.notes)}><T text={"Hear change"}/></button><button onClick={() => { generation.current++; audio.stop('structure'); setStatus('Preview stopped.'); }}><T text={"Stop preview"}/></button></div>

      <p className="score-movement">{current.chosen ? `${unchanged.length ? `${t('Keep')} ${unchanged.join(', ')}. ` : ''}${movements.filter(v => v.semitones !== 0).map(v => !v.from ? `${spelledMidiName(v.to!.midi, v.to!.spelling)} ${t('enters')}` : !v.to ? `${spelledMidiName(v.from.midi, v.from.spelling)} ${t('leaves')}` : `${spelledMidiName(v.from.midi, v.from.spelling)} → ${spelledMidiName(v.to.midi, v.to.spelling)} (${t(v.semitones! > 0 ? 'up' : 'down')} ${Math.abs(v.semitones!)} ${t('semitones')})`).join('; ') || t('All voices stay on the same pitches.')}` : t(next ? 'Both chords must be recognized to suggest a connection.' : 'End of the written chart.')}</p>
      {labels && <p className="score-pitch-names">{current.notes.map(note => spelledMidiName(note.midi, note.spelling)).join(' / ')}{next?.notes.length ? ` ${t('to')} ${next.notes.map(note => spelledMidiName(note.midi, note.spelling)).join(' / ')}` : ''}</p>}
      <dialog ref={options} className="score-help" aria-labelledby="score-options-heading"><div className="score-help-header"><h2 id="score-options-heading"><T text={"Score options"}/></h2><button onClick={() => options.current?.close()}><T text={"Close options"}/></button></div>
      <div className="score-options"><label><T text={"Next voicing"}/><select aria-label={t("Next chord voicing")} disabled={stale || !current.candidates.length} value={current.chosen?.id ?? ''} onChange={event => onChoice(current.id, event.target.value)}>{!current.candidates.length && <option value="">{next ? t('No comparison') : t('End of chart')}</option>}{current.candidates.map((candidate, i) => <option key={candidate.id} value={candidate.id}>{i === 0 ? t('Suggested') : `${t('Alternative')} ${i}`} · {candidate.movement} {t('semitones')}{candidate.changes ? ` · ${candidate.changes} voices enter/leave` : ''}</option>)}</select></label></div>
      {<div className="score-note-names" aria-label={t("Current voicing notes")}>{current.notes.map(note => <button key={`${note.midi}-${note.spelling}`} data-note-midi={note.midi} data-note-color={noteColor(note.midi)} style={noteStyle(note.midi)} disabled={stale} onClick={() => void hear([note])}>{spelledMidiName(note.midi, note.spelling)}</button>)}</div>}
      <div className="score-switches"><button aria-pressed={labels} onClick={() => setLabels(!labels)}><T text={"Note names"}/></button><button aria-pressed={guides} onClick={() => setGuides(!guides)}><T text={"Voice guides"}/></button><button aria-pressed={depth} onClick={() => setDepth(!depth)}><T text={"3D depth"}/></button></div>
      <label className="score-playback-choice"><input type="checkbox" checked={guidedPlayback} onChange={event => onGuidedPlayback(event.target.checked)}/> <T text={"Use these voicings for piano chart playback"}/></label>
        <button onClick={() => { options.current?.close(); help.current?.showModal(); }}><T text={"Read the score"}/></button>
      </dialog>
      <p className="score-status" role="status">{t(status)}</p>
    </>}
    <dialog ref={help} className="score-help" aria-labelledby="score-help-heading"><div className="score-help-header"><h2 id="score-help-heading"><T text={"Read the score"}/></h2><button onClick={() => help.current?.close()}><T text={"Close"}/></button></div>
      <p><T text={"Read left to right. Stacked notes sound together as a chord. The chord symbol names the harmony; the noteheads show this suggested piano voicing."}/></p>
      <h3><T text={"Pitch: lines, spaces and clefs"}/></h3><p><T text={"The treble clef lines, bottom to top, are E4\u2013G4\u2013B4\u2013D5\u2013F5. Bass clef lines are G2\u2013B2\u2013D3\u2013F3\u2013A3. Spaces hold the intervening letter names. Middle C (C4) sits on a ledger line below the treble staff. Ledger lines extend a staff beyond its five lines."}/></p>
      <h3><T text={"Accidentals and rhythm"}/></h3><p><T text={"\u266f raises a written note by one semitone; \u266d lowers it by one. Accidentals here are written explicitly in each practice bar. Hollow, stemless noteheads are whole notes: four quarter-note beats in the displayed practice 4/4. This chart supplies chord order, not its original melody or rhythm. No key signature is inferred."}/></p>
      <h3><T text={"Voice leading"}/></h3><p><T text={"Solid guides connect the same pitch; dashed arrows show movement. These are learning guides, not ties or slurs. Suggestions favor less total motion without crossing voices, while retaining every chord tone and explicit slash bass. They are alternatives, not prescribed fingering or hand assignments. An extended chord may exceed a comfortable hand span."}/></p>
      <p><T text={"Note-name buttons play single notes. Hear change plays the displayed pair on piano. Enable the playback checkbox to use these voicings for the chart; guitar playback keeps its guitar shapes. Switching a voicing stops playback, and its destination becomes the next chord's starting voicing."}/></p>
      <p><T text={"3D depth tilts the score surface; it does not change pitch or rhythm. Turn it off for a flat reading view."}/></p>
      <a href="https://viva.pressbooks.pub/openmusictheory/chapter/notation-of-notes-clefs-and-ledger-lines/" target="_blank" rel="noopener noreferrer"><T text={"Notation fundamentals \u2014 Open Music Theory"}/></a>
    </dialog>
  </section>;
}
