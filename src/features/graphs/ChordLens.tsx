import { T } from '../../i18n/Language.tsx';
import { type TimeChord } from '../../domain/graphs/fifthsTime.ts';

const roles: Record<string, string> = { '1P': 'Root', '3m': 'Minor third', '3M': 'Major third', '4P': 'Perfect fourth', '5P': 'Perfect fifth', '5d': 'Diminished fifth', '5A': 'Augmented fifth', '6M': 'Major sixth', '7m': 'Minor seventh', '7M': 'Major seventh', '9M': 'Major ninth', '9m': 'Minor ninth', '11P': 'Perfect eleventh', '13M': 'Major thirteenth' };
export function ChordLens({ chord, disabled, onDive }: { chord: TimeChord; disabled: boolean; onDive(): void }) {
  const points = chord.notes.map(note => {
    const angle = note.pitch * Math.PI / 6 - Math.PI / 2;
    return { ...note, x: 130 + Math.cos(angle) * 72, y: 110 + Math.sin(angle) * 72, labelX: 130 + Math.cos(angle) * 94, labelY: 110 + Math.sin(angle) * 94 };
  });
  return <section className="dna-chord-lens" aria-label="Focused chord diagram">
    <svg viewBox="0 0 260 220" role="img" aria-label={`${chord.symbol}: ${chord.unresolved ? 'unresolved chord' : chord.notes.map(note => `${note.spelling}, ${roles[note.interval] ?? note.interval}`).join('; ')}`}>
      <circle cx="130" cy="110" r="72" fill="none" stroke="#c8cce4"/>
      {points.length > 1 && <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="#7542d414" stroke="#7542d4" strokeWidth="2"/>}
      {points.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={p.root ? 7 : 5} fill="#596579" stroke={p.root ? '#19243a' : 'none'} strokeWidth={p.root ? 3 : 0}/><text x={p.labelX} y={p.labelY} textAnchor="middle" dominantBaseline="middle" fill="#252b4b" fontSize="14">{p.spelling}</text></g>)}
      <text x="130" y="114" textAnchor="middle" fill="#252b4b" fontSize="21">{chord.symbol}</text>
    </svg>
    <div><h3>{chord.symbol} · chord {chord.order + 1}</h3><p>{chord.unresolved ? 'Unresolved symbol: no chord tones are invented.' : 'Each dot is a chord tone. The polygon joins those tones around the chromatic note circle; its edges are not melody or voice movement.'}</p>
      <button disabled={disabled} onClick={onDive}><T text={"Dive into chord"}/></button>
      <details><summary>Notes &amp; intervals</summary><ul>{chord.notes.map((note, i) => <li key={i}><strong>{note.spelling}</strong> — {roles[note.interval] ?? `Interval ${note.interval}`} ({note.interval})</li>)}</ul>{chord.bass && <p><T text={"Requested bass:"}/> {chord.bass}. The diagram shows pitch classes, not a particular voicing.</p>}</details>
    </div>
  </section>;
}
