import { useT } from '../../i18n/Language.tsx';
import { T } from '../../i18n/Language.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChordDefinition } from '../../domain/harmony/types.ts';
import { spelledMidiName, type PianoNote } from '../../domain/instruments/voicings.ts';
import { buildTransition } from '../../domain/song/transitions.ts';
import type { InstrumentAudio } from '../../infrastructure/audio/instrumentAudio.ts';

const name = (note: PianoNote) => spelledMidiName(note.midi, note.spelling);
interface Props { from?: ChordDefinition; to?: ChordDefinition; hasNext: boolean; disabled: boolean; audio: InstrumentAudio; onAudition(): void }

export function TransitionInspector({ from, to, hasNext, disabled, audio, onAudition }: Props) {
  const t = useT();
  const comparison = useMemo(() => from && to ? buildTransition(from, to) : null, [from, to]);
  const [choice, setChoice] = useState(0);
  const [status, setStatus] = useState('');
  const generation = useRef(0);
  const candidate = comparison?.candidates[choice];
  useEffect(() => {
    const hide = () => { if (document.hidden) { generation.current++; audio.stop('transition'); setStatus('Transition audio stopped.'); } };
    document.addEventListener('visibilitychange', hide);
    return () => { generation.current++; audio.stop('transition'); document.removeEventListener('visibilitychange', hide); };
  }, [audio]);
  useEffect(() => { generation.current++; audio.stop('transition'); setStatus(''); }, [choice, disabled, audio]);
  async function audition() {
    if (!candidate || disabled) return;
    onAudition();
    const ticket = ++generation.current;
    try {
      await audio.play([...candidate.from.map(note => ({ midi: note.midi, delay: 0, duration: .8 })), ...candidate.to.map(note => ({ midi: note.midi, delay: 1, duration: .8 }))], 'piano', 'transition');
      if (ticket === generation.current) setStatus('Reference piano preview: first chord, then next chord.');
    } catch { if (ticket === generation.current) setStatus('Audio unavailable. Try Hear transition again.'); }
  }
  return <section className="transition-inspector" aria-labelledby="transition-heading">
    <h3 id="transition-heading"><T text={"To the next chord"}/></h3>
    {!hasNext ? <p>This is the last written chord.</p> : !comparison ? <p><T text={"Both adjacent chords must be recognized before comparing voices."}/></p> : <>
      <h4>{from!.symbol} → {to!.symbol}</h4>
      <p><T text={"Shared chord tones:"}/> {comparison.shared.join(', ') || 'none'}. Shared pitch classes need not stay in the same octave.</p>
      <p><T text={"Reference piano examples, not the song\u2019s arrangement or suggested fingering. Choices change this preview only."}/></p>
      {candidate ? <>
        <label><T text={"Reference voicing"}/><select value={choice} disabled={disabled} onChange={event => setChoice(Number(event.target.value))}>
          {comparison.candidates.map((item, index) => <option key={item.id} value={index}><T text={"Option"}/> {index + 1}: {item.to.map(name).join(' · ')}</option>)}
        </select></label>
        <p><T text={"From:"}/> {candidate.from.map(name).join(' · ')}<br/>To: {candidate.to.map(name).join(' · ')}</p>
        <ul aria-label={t("Voice movements")}>{candidate.movements.map((voice, index) => <li key={index}>
          {!voice.from ? `${name(voice.to!)} enters` : !voice.to ? `${name(voice.from)} leaves` : `${name(voice.from)} → ${name(voice.to)}: ${voice.semitones === 0 ? 'same pitch' : `${voice.semitones! > 0 ? 'up' : 'down'} ${Math.abs(voice.semitones!)} semitone${Math.abs(voice.semitones!) === 1 ? '' : 's'}`}`}
        </li>)}</ul>
        <p>{candidate.movement} semitones of total movement; {candidate.changes} entering/leaving voices. Examples favor smaller movement with target pitches within C2–C7, without crossings; this is not a musical quality rating.</p>
        <div className="transition-actions"><button disabled={disabled} onClick={audition}><T text={"Hear transition"}/></button><button onClick={() => { generation.current++; audio.stop('transition'); setStatus('Transition audio stopped.'); }}><T text={"Stop transition audio"}/></button></div>
        <p>Preview timing: two separate attacks, one second apart. “Same pitch” does not imply a sustained note.</p>
        <p role="status">{status}</p>
      </> : <p><T text={"No reference comparison is available in the supported range."}/></p>}
    </>}
  </section>;
}
