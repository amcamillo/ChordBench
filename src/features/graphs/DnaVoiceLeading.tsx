import type { TransitionCandidate } from '../../domain/song/transitions.ts';
import { spelledMidiName } from '../../domain/instruments/voicings.ts';
const name = (note: { midi: number; spelling: string }) => spelledMidiName(note.midi, note.spelling);

export function DnaVoiceLeading({ candidates, choice, onChoice, enabled, onToggle, disabled, hasNext, guidedPlayback = false }: { candidates: TransitionCandidate[]; choice: number; onChoice(index: number): void; enabled: boolean; onToggle(value: boolean): void; disabled: boolean; hasNext: boolean; guidedPlayback?: boolean }) {
  const candidate = candidates[choice] ?? candidates[0];
  return <section className="dna-voice-leading" aria-label="DNA voice leading">
    <label className="time-follow"><input type="checkbox" checked={enabled} disabled={disabled} onChange={event => onToggle(event.target.checked)}/> Voice-leading paths</label>
    {enabled && (!candidate ? <p>{hasNext ? 'Both adjacent chords must resolve before comparing voices.' : 'Last chord: no next transition.'}</p> : <>
      <label>DNA piano voicing<select aria-label="DNA piano voicing" value={choice} disabled={disabled} onChange={event => onChoice(Number(event.target.value))}>{candidates.map((item, index) => <option key={item.id} value={index}>Option {index + 1}: {item.to.map(name).join(' · ')}</option>)}</select></label>
      <p>Reference piano example. Solid paths connect the same pitch; dashed arrows show movement. Endpoint labels include octaves. {guidedPlayback ? 'Piano chart playback uses these suggestions.' : 'Chart playback uses its configured voicings.'}</p>
      <details><summary>Voice movements</summary><ul>{candidate.movements.map((voice, index) => <li key={index}>{!voice.from ? `${name(voice.to!)} enters` : !voice.to ? `${name(voice.from)} leaves` : `${name(voice.from)} → ${name(voice.to)}: ${voice.semitones === 0 ? 'same pitch' : `${voice.semitones! > 0 ? 'up' : 'down'} ${Math.abs(voice.semitones!)} semitones`}`}</li>)}</ul><p>These paths describe this chosen voicing, not a unique performance implied by chord symbols. Same pitch does not imply sustain.</p></details>
    </>)}
  </section>;
}
