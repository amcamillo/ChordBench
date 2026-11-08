import { MAX_SOURCE_LENGTH, parseChart } from './parser.ts';
import type { TheoryPort } from '../../ports/theory.ts';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export interface ImportPreview { source: string; originalSource: string; removedLines: string[]; title: string | null; chords: number; warnings: number; directives: boolean }

export function filterImportedChart(source: string): { source: string; removedLines: string[] } {
  const removedLines: string[] = [];
  const kept: string[] = [];
  for (const match of source.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
    if (!match[0]) continue;
    const line = match[0].replace(/[\r\n]+$/, '');
    const withoutBom = line.replace(/^\ufeff/, '');
    const metadata = /^\s*\{(?:t|title|artist|key|c|comment)\s*:[^{}\r\n]*\}\s*$/i.test(withoutBom);
    const link = /^\s*https?:\/\/\S+\s*$/i.test(withoutBom);
    if (metadata || link) removedLines.push(withoutBom);
    else kept.push(match[0]);
  }
  return { source: kept.join(''), removedLines };
}

export function inspectChartBytes(bytes: Uint8Array, theory: TheoryPort): ImportPreview {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error('The file is too large. Choose a text chart under 2 MB.');
  let source: string;
  try { source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('The file is not valid UTF-8 text. Export it as a UTF-8 ChordPro or text file.'); }
  if (!source.trim()) throw new Error('The selected file is empty. Choose a chart with text.');
  if (source.length > MAX_SOURCE_LENGTH) throw new Error('The chart is too long. Choose a file under 500,000 characters.');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source)) throw new Error('The file contains binary or unsupported control characters. Choose a text chart.');
  const title = /^\s*\{(?:title|t)\s*:\s*([^}\r\n]+)\}\s*$/im.exec(source)?.[1]?.trim() ?? null;
  const filtered = filterImportedChart(source);
  const parsed = parseChart(filtered.source, theory);
  return { source: filtered.source, originalSource: source, removedLines: filtered.removedLines, title, chords: parsed.occurrences.length, warnings: parsed.diagnostics.length,
    directives: parsed.lines.some(line => line.kind === 'directive') };
}
