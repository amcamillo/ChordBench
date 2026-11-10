import { T } from '../../i18n/Language.tsx';
import type { Occurrence } from '../../domain/chart/parser.ts';
import type { ChordResult } from '../../domain/harmony/types.ts';

const roleLabels: Record<string, string> = {
  '1P': 'Root', '2M': 'Second', '3m': 'Minor third', '3M': 'Major third', '4P': 'Fourth',
  '5d': 'Diminished fifth', '5P': 'Fifth', '5A': 'Augmented fifth', '6M': 'Sixth',
  '7d': 'Diminished seventh', '7m': 'Minor seventh', '7M': 'Major seventh',
  '9m': 'Minor ninth', '9M': 'Ninth', '9A': 'Augmented ninth', '11P': 'Eleventh', '11A': 'Augmented eleventh', '13m': 'Minor thirteenth', '13M': 'Thirteenth',
};

export function ChordInspector({ occurrence, result, shift }: { occurrence?: Occurrence; result?: ChordResult; shift: number }) {
  if (!occurrence || !result) return <aside className="inspector" aria-labelledby="learn-heading">
    <h2 id="learn-heading"><T text={"Inside the chord"}/></h2>
    <div className="inspector-empty"><div className="note-emblem" aria-hidden="true">♪</div><h3><T text={"Select a chord."}/></h3><p><T text={"Explore its notes, intervals and bass. Each appearance in the chart is a separate selection."}/></p></div>
  </aside>;
  if (result.status !== 'resolved') return <aside className="inspector" aria-labelledby="learn-heading">
    <h2 id="learn-heading"><T text={"Inside the chord"}/></h2><div className="selected-symbol">{occurrence.symbol}</div>
    <p className="inspector-tag"><T text={"Unresolved symbol"}/></p><p>{result.message}</p><p><T text={"Edit the original symbol in the chart editor. Its text has been kept."}/></p>
  </aside>;
  const chord = result.chord;
  return <aside className="inspector" aria-labelledby="learn-heading">
    <div className="panel-heading"><h2 id="learn-heading"><T text={"Inside the chord"}/></h2><span>{occurrence.order + 1}</span></div>
    <div className="selected-symbol">{chord.symbol}</div><p className="chord-quality">{chord.root} {chord.quality}</p>
    <p className="inspector-tag">{occurrence.section} / occurrence {occurrence.order + 1}</p>
    {shift !== 0 && <p className="source-symbol"><T text={"Written as"}/> {occurrence.symbol}</p>}
    <h3 className="notes-heading"><T text={"Built from"}/> {chord.notes.length} notes</h3>
    <ol className="note-list">{chord.notes.map((note, index) => <li key={`${note}-${index}`}>
      <span className={`note-name orbital-note ${chord.intervals[index] === '1P' ? 'orbital-root' : 'orbital-tone'}`}>{note}</span><span>{roleLabels[chord.intervals[index]] ?? chord.intervals[index]}</span><span className="interval-label">{chord.intervals[index]}</span>
    </li>)}</ol>
    {chord.slashBass && <div className="bass-note"><strong><T text={"Bass:"}/> {chord.slashBass}</strong><p><T text={"The slash asks for"}/> {chord.slashBass} as the lowest note. It does not choose an octave or fingering.</p></div>}
    <div className="learning-note"><h3><T text={"Notes, then voicing"}/></h3><p><T text={"These are chord tones. A piano or guitar voicing chooses their octaves, order and any repeated notes."}/></p></div>
  </aside>;
}
