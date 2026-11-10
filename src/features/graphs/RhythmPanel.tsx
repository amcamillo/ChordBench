import { useT } from '../../i18n/Language.tsx';
import { T } from '../../i18n/Language.tsx';
import { GROOVES, meterBeats, type Meter, type VisualRhythm } from '../../domain/graphs/rhythm.ts';

export function RhythmPanel({ rhythm, onChange, count }: { rhythm: VisualRhythm; onChange(value: VisualRhythm): void; count: number }) {
  const t = useT();
  const { groove, meter } = rhythm;
  return <section className="dna-rhythm" aria-label={t("Visual rhythm and meter")}>
    <div className="dna-rhythm-fields">
      <label><T text={"Visual groove"}/><select value={groove.id} onChange={event => { const next = GROOVES.find(item => item.id === event.target.value)!; onChange({ groove: next, meter: next.meter }); }}>{GROOVES.map(item => <option key={item.id} value={item.id}>{t(item.name)}</option>)}</select></label>
      <label><T text={"Meter / comp\u00e1s"}/><select value={meter} disabled={!groove.steps.length} onChange={event => onChange({ groove, meter: event.target.value as Meter })}><option value="2/4"><T text={"2/4 - two quarter notes"}/></option><option value="3/4"><T text={"3/4 \u00b7 three quarter notes"}/></option><option value="4/4"><T text={"4/4 \u00b7 four quarter notes"}/></option><option value="6/8"><T text={"6/8 \u00b7 two groups of three eighths"}/></option></select></label>
    </div>
    <p className="dna-rhythm-summary">{t(groove.steps.length ? 'Visual example · one bar per chord · optional beat cues' : 'No rhythm layer applied')}</p>
    <details className="dna-rhythm-explanation"><summary>{t('Rhythm pattern & explanation')}</summary>
    <p>{t(groove.description)}</p>
    {groove.steps.length > 0 && <>
      <svg className="dna-rhythm-cell" viewBox="0 0 600 110" role="img" aria-label={`${groove.name}: one visual bar in ${meter}; ${groove.steps.filter(Boolean).length} marked attacks. Taller marks mean stronger accents.`}>
        <line x1="24" x2="576" y1="78" y2="78" stroke="currentColor" opacity=".4"/>
        {Array.from({ length: meterBeats(meter) }, (_, beat) => <g key={beat}><line x1={24 + beat / meterBeats(meter) * 552} x2={24 + beat / meterBeats(meter) * 552} y1="8" y2="82" stroke="currentColor" opacity={beat === 0 || meter === '6/8' && beat === 3 ? .55 : .2}/><text x={24 + beat / meterBeats(meter) * 552} y="102" fill="currentColor" fontSize="14">{meter === '6/8' ? ['1', 'la', 'li', '2', 'la', 'li'][beat] : beat + 1}</text></g>)}
        {groove.steps.map((strength, step) => <g key={step}><line x1={24 + step / groove.steps.length * 552} x2={24 + step / groove.steps.length * 552} y1="78" y2={78 - strength * 62} stroke="#b95313" strokeWidth={strength > .7 ? 6 : 3}/><circle cx={24 + step / groove.steps.length * 552} cy={78 - strength * 62} r={strength ? 3 + strength * 3 : 2} fill={strength ? '#b95313' : '#9296a6'}/></g>)}
      </svg>
      <p className="dna-pattern-text"><T text={"Accent cell (0 = gap, 1 = strongest):"}/> {groove.steps.join(' · ')}</p>
      <p>{meter !== groove.meter ? `Meter override: the example cell is stretched across ${meter}. ` : ''}{count} visual bars, assuming one bar per written chord. Orange frames show meter; small outer marks and ribbon heights show the chosen accents. These are not extra chord tones.</p>
      <p>The chord preview uses assumed 4/4 timing. The timing guide adds optional cues for strong visual accents; harmony-only mode cues the downbeat.</p>
    </>}
    </details>
  </section>;
}
