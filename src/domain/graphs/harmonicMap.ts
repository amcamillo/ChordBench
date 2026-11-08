import type { ParsedChart } from '../chart/parser.ts';
import type { AccidentalPreference } from '../harmony/types.ts';
import type { TheoryPort } from '../../ports/theory.ts';

export interface MapOccurrence { id: string; order: number; section: string; sourceSymbol: string }
export interface HarmonicNode { id: string; symbol: string; sourceSymbols: string[]; occurrences: MapOccurrence[] }
export interface HarmonicEdge { from: string; to: string; occurrences: { from: MapOccurrence; to: MapOccurrence }[] }
export interface HarmonicMap { nodes: HarmonicNode[]; edges: HarmonicEdge[]; unresolved: MapOccurrence[] }

export function buildHarmonicMap(chart: ParsedChart, theory: TheoryPort, shift: number, preference: AccidentalPreference): HarmonicMap {
  const nodes = new Map<string, HarmonicNode>();
  const edges = new Map<string, HarmonicEdge>();
  const unresolved: MapOccurrence[] = [];
  let previous: { nodeId: string; occurrence: MapOccurrence } | null = null;
  for (const item of chart.occurrences) {
    const occurrence: MapOccurrence = { id: item.id, order: item.order, section: item.section, sourceSymbol: item.symbol };
    const result = theory.transpose(item.symbol, shift, preference);
    if (result.status !== 'resolved') { unresolved.push(occurrence); previous = null; continue; }
    const id = result.chord.id;
    let node = nodes.get(id);
    if (!node) { node = { id, symbol: result.chord.symbol, sourceSymbols: [], occurrences: [] }; nodes.set(id, node); }
    node.occurrences.push(occurrence);
    if (!node.sourceSymbols.includes(item.symbol)) node.sourceSymbols.push(item.symbol);
    if (previous) {
      const key = JSON.stringify([previous.nodeId, id]);
      let edge = edges.get(key);
      if (!edge) { edge = { from: previous.nodeId, to: id, occurrences: [] }; edges.set(key, edge); }
      edge.occurrences.push({ from: previous.occurrence, to: occurrence });
    }
    previous = { nodeId: id, occurrence };
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()], unresolved };
}
