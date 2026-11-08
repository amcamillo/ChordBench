import type { ChartLine, Occurrence, ParsedChart, Token } from '../../domain/chart/parser.ts';
import type { AccidentalPreference } from '../../domain/harmony/types.ts';
import type { TheoryPort } from '../../ports/theory.ts';

interface Props {
  chart: ParsedChart;
  theory: TheoryPort;
  shift: number;
  preference: AccidentalPreference;
  selectedId: string | null;
  playingId?: string | null;
  stale: boolean;
  onSelect(id: string): void;
}

export function ChartViewer({ chart, theory, shift, preference, selectedId, playingId, stale, onSelect }: Props) {
  const byId = new Map(chart.occurrences.map(item => [item.id, item]));
  function chordButton(token: Token) {
    const occurrence = byId.get(token.occurrenceId!) as Occurrence;
    const result = theory.transpose(occurrence.symbol, shift, preference);
    const label = result.status === 'resolved' ? result.chord.symbol : occurrence.symbol;
    return <button key={token.start} type="button" className={`chord-token ${result.status !== 'resolved' ? 'unresolved' : ''} ${playingId === occurrence.id ? 'playing-token' : ''}`}
      aria-label={`${label}, occurrence ${occurrence.order + 1}${result.status !== 'resolved' ? ', unresolved' : ''}`}
      aria-pressed={selectedId === occurrence.id} disabled={stale} onClick={() => onSelect(occurrence.id)}>
      {label}{result.status !== 'resolved' && <span className="unresolved-mark" aria-hidden="true">?</span>}
    </button>;
  }
  function renderTokens(line: ChartLine) {
    return line.tokens.map(token => token.kind === 'chord' ? chordButton(token) : <span key={token.start}>{token.text.replace(/[\r\n]+$/, '')}</span>);
  }
  const rows = [];
  for (let index = 0; index < chart.lines.length; index++) {
    const line = chart.lines[index];
    const next = chart.lines[index + 1];
    if (line.kind === 'heading') {
      rows.push(<h3 className="section-heading" key={line.start}>{line.tokens[0].text.trim().replace(/^#{1,3}\s+|^\[|\]$/g, '')}</h3>);
    } else if (line.kind === 'chords' && next?.kind === 'lyrics' && !line.tokens.some(token => token.text.includes('|'))) {
      // Pair chord anchors and lyric slices. Each column can grow for a wider
      // transposed chord without covering or modifying any lyric characters.
      const lyric = chart.source.slice(next.start, next.end).replace(/[\r\n]+$/, '');
      const chordTokens = line.tokens.filter(token => token.kind === 'chord');
      const columns = [0, ...chordTokens.map(token => token.start - line.start)].filter((v, i, all) => all.indexOf(v) === i).sort((a, b) => a - b);
      rows.push(<div className="anchored-line" key={line.start}>{columns.map((column, i) => {
        const token = chordTokens.find(item => item.start - line.start === column);
        return <div className="lyric-segment" key={column}>
          <div className="anchor-chord">{token ? chordButton(token) : null}</div>
          <span>{lyric.slice(column, columns[i + 1] ?? Math.max(lyric.length, column))}</span>
        </div>;
      })}</div>);
      index++;
    } else {
      rows.push(<div key={line.start} className={`chart-line ${line.kind}`}>{renderTokens(line)}</div>);
    }
  }
  return <div className={`chart-scroll ${stale ? 'stale' : ''}`} tabIndex={0} role="region" aria-label="Readable chord chart; scroll horizontally for long lines" aria-busy={stale}>
    {chart.source.trim() ? rows : <div className="empty-chart"><h3>Your chart starts here.</h3><p>Paste chords and lyrics in the editor. Use brackets like [C] or bars like C | Am | F | G.</p></div>}
  </div>;
}
