import { T } from '../../i18n/Language.tsx';
import { useT } from '../../i18n/Language.tsx';
import { useMemo, useRef, useState } from 'react';
import { inspectChartBytes, MAX_IMPORT_BYTES } from '../../domain/chart/importChart.ts';
import type { ImportPreview } from '../../domain/chart/importChart.ts';
import type { TheoryPort } from '../../ports/theory.ts';
import { parseChart } from '../../domain/chart/parser.ts';

interface Props { theory: TheoryPort; recoveryPending: boolean; onImport(source: string): void }
export function ChartImport({ theory, recoveryPending, onImport }: Props) {
  const t = useT();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const sequence = useRef(0);
  const source = preview ? (keepOriginal ? preview.originalSource : preview.source) : '';
  const selectedChart = useMemo(() => preview ? parseChart(source, theory) : null, [preview, source, theory]);
  async function choose(file?: File) {
    const current = ++sequence.current;
    setPreview(null); setName(file?.name ?? ''); setError(''); setKeepOriginal(false);
    if (!file) { setLoading(false); return; }
    if (file.size > MAX_IMPORT_BYTES) { setLoading(false); setError('The file is too large. Choose a text chart under 2 MB.'); return; }
    setLoading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = inspectChartBytes(bytes, theory);
      if (sequence.current === current) setPreview(result);
    } catch (cause) {
      if (sequence.current === current) setError(cause instanceof Error ? cause.message : 'The file could not be read.');
    } finally { if (sequence.current === current) setLoading(false); }
  }
  return <details className="chart-import">
    <summary><T text={"Find or import a chart"}/></summary>
    <div className="import-content">
      <p><T text={"Search the OzBcoz ChordPro index by song or artist, then download a chart to your device."}/></p>
      <a className="external-chart-link" href="https://www.ozbcoz.com/Songs/cp/index.php" target="_blank" rel="noopener noreferrer"><T text={"Search OzBcoz charts"}/> <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
      <p className="import-hint"><T text={"Return here and choose the downloaded .pro, .chordpro or text file. The file is read on your device."}/></p>
      <label htmlFor="chart-file"><T text={"Choose a chart file"}/></label>
      <input id="chart-file" type="file" accept=".pro,.cho,.chopro,.chordpro,.crd,.txt,text/plain" aria-describedby="chart-file-help" onChange={event => { void choose(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }}/>
      <p id="chart-file-help" className="import-hint"><T text={"UTF-8 text; maximum 2 MB and 500,000 characters."}/></p>
      {loading && <p role="status"><T text={"Reading chart\u2026"}/></p>}
      {error && <p className="error-text" role="alert">{t(error)}</p>}
      {preview && <div className="import-preview">
        <h3>Preview: {preview.title || name}</h3>
        <p>{selectedChart!.occurrences.length} chord occurrence{selectedChart!.occurrences.length === 1 ? '' : 's'} recognised{selectedChart!.diagnostics.length ? `; ${selectedChart!.diagnostics.length} item(s) need review` : ''}.</p>
        {selectedChart!.occurrences.length === 0 && <p><T text={"No chords were recognised. You can still import the text and edit it."}/></p>}
        {preview.removedLines.length > 0 && <><p>{keepOriginal ? 'Keeping' : 'Filtered out'} {preview.removedLines.length} metadata, comment or standalone link line{preview.removedLines.length === 1 ? '' : 's'}.</p><label className="import-original-choice"><input type="checkbox" checked={keepOriginal} onChange={event => setKeepOriginal(event.target.checked)}/> <T text={"Keep original metadata and links"}/></label><details><summary><T text={"Show filtered lines"}/></summary><pre className="import-preview-text">{preview.removedLines.join('\n')}</pre></details></>}
        {selectedChart!.lines.some(line => line.kind === 'directive') && <p><T text={"Remaining ChordPro directives are kept as text. Formatting, repeats, key, capo and timing directives are not applied automatically."}/></p>}
        <pre className="import-preview-text">{source.slice(0, 1200)}{source.length > 1200 ? '\n… preview shortened' : ''}</pre>
        {!source.trim() && <p role="alert">No chart text remains after filtering. Choose “Keep original metadata and links” or select another file.</p>}
        <p><T text={"Importing replaces the current editor chart and resets transposition. Download your current draft first if you want to keep it."}/></p>
        {recoveryPending && <p role="status"><T text={"Restore or dismiss the saved draft before replacing the editor chart."}/></p>}
        <div className="import-actions"><button className="primary-button" disabled={recoveryPending || !source.trim()} onClick={() => { onImport(source); setPreview(null); setName(''); }}><T text={"Import and replace chart"}/></button><button onClick={() => { ++sequence.current; setPreview(null); setName(''); }}><T text={"Cancel import"}/></button></div>
      </div>}
    </div>
  </details>;
}
