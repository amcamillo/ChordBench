import type { ChordResult } from '../harmony/types.ts';
import type { TheoryPort } from '../../ports/theory.ts';

export interface Span { start: number; end: number }
export interface Token extends Span {
  kind: 'text' | 'chord' | 'heading';
  text: string;
  occurrenceId?: string;
}
export interface Occurrence extends Span {
  id: string;
  symbol: string;
  section: string;
  order: number;
  result: ChordResult;
  reviewKey?: string;
}
export interface Diagnostic extends Span {
  message: string;
  symbol: string;
  reviewKey?: string;
}
export interface ChartLine extends Span {
  kind: 'heading' | 'directive' | 'chords' | 'inline' | 'lyrics' | 'empty';
  tokens: Token[];
}
export interface ParsedChart {
  source: string;
  lines: ChartLine[];
  occurrences: Occurrence[];
  diagnostics: Diagnostic[];
  nextId: number;
}
export type ReviewChoices = Record<string, 'chord' | 'text'>;
export const MAX_SOURCE_LENGTH = 500_000;

export function parseChart(source: string, theory: TheoryPort, previous?: ParsedChart, choices: ReviewChoices = {}): ParsedChart {
  if (source.length > MAX_SOURCE_LENGTH) throw new Error('Keep charts under 500,000 characters. Split a larger chart into separate songs.');
  const chart: ParsedChart = { source, lines: [], occurrences: [], diagnostics: [], nextId: previous?.nextId ?? 1 };
  let section = 'Chart';
  // An edit mapping preserves IDs only in proven unchanged regions. Uncertain
  // repeated-token matches get fresh IDs rather than inheriting unrelated timing.
  let prefix = 0;
  let suffix = 0;
  if (previous) {
    while (prefix < Math.min(source.length, previous.source.length) && source[prefix] === previous.source[prefix]) prefix++;
    while (suffix < Math.min(source.length, previous.source.length) - prefix
      && source[source.length - 1 - suffix] === previous.source[previous.source.length - 1 - suffix]) suffix++;
  }
  const oldAt = new Map(previous?.occurrences.map(item => [item.start, item]) ?? []);
  function addChord(start: number, end: number, symbol: string, reviewKey?: string): Token {
    const mapped = end <= prefix ? start : start >= source.length - suffix ? start + (previous?.source.length ?? 0) - source.length : -1;
    const old = oldAt.get(mapped);
    const id = old?.symbol === symbol ? old.id : `occ-${chart.nextId++}`;
    const result = theory.parse(symbol);
    chart.occurrences.push({ id, symbol, section, start, end, order: chart.occurrences.length, result, reviewKey });
    if (result.status !== 'resolved') chart.diagnostics.push({ start, end, symbol, message: result.message });
    return { kind: 'chord', text: source.slice(start, end), start, end, occurrenceId: id };
  }
  const lineRegex = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  for (const match of source.matchAll(lineRegex)) {
    if (!match[0]) continue;
    const text = match[0];
    const start = match.index;
    const body = text.replace(/[\r\n]+$/, '');
    const trimmed = body.trim();
    const line: ChartLine = { start, end: start + text.length, kind: trimmed ? 'lyrics' : 'empty', tokens: [] };
    const heading = /^\s*(?:#{1,3}\s+(.+)|\[(intro|verse(?:\s+\d+)?|chorus(?:\s+\d+)?|bridge|outro|pre-chorus|instrumental|solo)\])\s*$/i.exec(body);
    if (/^\s*\{[^{}\r\n]*\}\s*$/.test(body)) {
      // ChordPro metadata, comments and formatting are retained as source text.
      // Do not turn bar separators or words inside directives into chord events.
      line.kind = 'directive';
      line.tokens.push({ kind: 'text', text, start, end: line.end });
    } else if (heading) {
      section = heading[1] ?? heading[2];
      line.kind = 'heading';
      line.tokens.push({ kind: 'heading', text, start, end: line.end });
    } else {
      const brackets = [...body.matchAll(/\[([^\]\r\n]+)\]/g)];
      const words = [...body.matchAll(/[^\s|]+/g)];
      const validCount = words.filter(word => theory.parse(word[0]).status === 'resolved').length;
      const explicitProgression = body.includes('|');
      const chordLine = explicitProgression || (words.length > 1 && validCount >= 2 && validCount / words.length >= .5);
      let cursor = start;
      const candidates = brackets.length ? brackets : chordLine ? words : [];
      if (brackets.length) line.kind = 'inline';
      else if (chordLine) line.kind = 'chords';
      // A lone chord-looking word is deliberately reviewed, even when supported.
      if (!candidates.length && words.length === 1 && /^[A-G](?:[#b♯♭]|m|maj|sus|dim|aug|add|\d|$)/.test(trimmed)) {
        const wordStart = start + words[0].index;
        const key = `${wordStart}:${trimmed}`;
        if (choices[key] === 'chord') {
          line.kind = 'chords';
          candidates.push(words[0]);
        } else if (choices[key] !== 'text') {
          chart.diagnostics.push({ start: wordStart, end: wordStart + trimmed.length, symbol: trimmed, reviewKey: key,
            message: 'This could be a chord or a lyric. Choose how to read it.' });
        }
      }
      for (const candidate of candidates) {
        const tokenStart = start + candidate.index;
        const end = tokenStart + candidate[0].length;
        if (tokenStart > cursor) line.tokens.push({ kind: 'text', text: source.slice(cursor, tokenStart), start: cursor, end: tokenStart });
        const symbol = brackets.length ? candidate[1] : candidate[0];
        const reviewKey = `${tokenStart}:${symbol}`;
        if (choices[reviewKey] === 'text') line.tokens.push({ kind: 'text', text: source.slice(tokenStart, end), start: tokenStart, end });
        else line.tokens.push(addChord(tokenStart, end, symbol, reviewKey));
        cursor = end;
      }
      if (cursor < line.end) line.tokens.push({ kind: 'text', text: source.slice(cursor, line.end), start: cursor, end: line.end });
    }
    chart.lines.push(line);
  }
  return chart;
}
