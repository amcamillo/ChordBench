import type { ParsedChart } from '../chart/parser.ts';
import type { AccidentalPreference } from '../harmony/types.ts';
import type { TheoryPort } from '../../ports/theory.ts';

export interface JourneyNode { id: string; symbol: string; order: number; unresolved: boolean }
export interface JourneySection { id: string; name: string; nodes: JourneyNode[] }
export interface SongJourney { sections: JourneySection[]; edges: { from: string; to: string }[] }

export function buildSongJourney(chart: ParsedChart, theory: TheoryPort, shift: number, preference: AccidentalPreference): SongJourney {
  const sections: JourneySection[] = [];
  const edges: { from: string; to: string }[] = [];
  let section: JourneySection | null = null;
  let headingIndex = 0;
  const headings = chart.lines.filter(line => line.kind === 'heading');
  let lastHeading = -1;
  let previous: string | undefined;
  for (const occurrence of chart.occurrences) {
    while (headingIndex < headings.length && headings[headingIndex].start < occurrence.start) {
      lastHeading = headingIndex++;
    }
    const id = lastHeading < 0 ? 'introductory-chart' : `section-${lastHeading}`;
    if (!section || section.id !== id) {
      section = { id, name: occurrence.section, nodes: [] };
      sections.push(section);
    }
    const result = theory.transpose(occurrence.symbol, shift, preference);
    section.nodes.push({ id: occurrence.id, order: occurrence.order,
      symbol: result.status === 'resolved' ? result.chord.symbol : occurrence.symbol, unresolved: result.status !== 'resolved' });
    if (previous) edges.push({ from: previous, to: occurrence.id });
    previous = occurrence.id;
  }
  return { sections, edges };
}
