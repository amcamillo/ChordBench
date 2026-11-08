import { useEffect, useRef, useState } from 'react';
import type { JourneyNode, SongJourney as Journey } from '../../domain/graphs/songJourney.ts';

interface Props { journey: Journey; selectedId: string | null; playingId: string | null; stale: boolean; onSelect(id: string): void }
const STEP_X = 154, STEP_Y = 92, NODE_W = 108, NODE_H = 54, LEFT = 22, TOP = 14;
const diagramWidth = (cols: number) => LEFT * 2 + (cols - 1) * STEP_X + NODE_W;

function Diagram({ nodes, cols, selectedId, playingId, stale, onSelect }: { nodes: JourneyNode[]; cols: number } & Omit<Props, 'journey'>) {
  const width = diagramWidth(cols);
  const height = TOP * 2 + (Math.ceil(nodes.length / cols) - 1) * STEP_Y + NODE_H;
  return <div className="journey-diagram" style={{ width, height }}>
    <svg className="journey-edges" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <defs><marker id={`arrow-${nodes[0].id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7166a5" /></marker></defs>
      {nodes.slice(0, -1).map((node, i) => {
        const col = i % cols, row = Math.floor(i / cols), x = LEFT + col * STEP_X, y = TOP + row * STEP_Y;
        const path = col < cols - 1
          ? `M ${x + NODE_W + 3} ${y + NODE_H / 2} H ${x + STEP_X - 6}`
          : `M ${x + NODE_W / 2} ${y + NODE_H + 3} V ${y + NODE_H + 17} H ${LEFT - 12} V ${y + STEP_Y + NODE_H / 2} H ${LEFT - 5}`;
        return <path key={node.id} d={path} fill="none" stroke="#7166a5" strokeOpacity=".72" strokeWidth="1.5" markerEnd={`url(#arrow-${nodes[0].id})`}/>;
      })}
    </svg>
    {nodes.map((node, i) => <button key={node.id} type="button" className={`journey-node ${node.unresolved ? 'journey-unresolved' : ''} ${node.id === playingId ? 'journey-playing' : ''}`}
      style={{ left: LEFT + (i % cols) * STEP_X, top: TOP + Math.floor(i / cols) * STEP_Y }}
      aria-label={`Graph ${node.symbol}, occurrence ${node.order + 1}${node.unresolved ? ', unresolved' : ''}`}
      aria-pressed={node.id === selectedId} disabled={stale} title={node.symbol} onClick={() => onSelect(node.id)}>
      <span className="journey-node-symbol">{node.symbol}</span><span className="journey-node-order">{node.order + 1}{node.unresolved ? ' · unresolved' : ''}</span>
    </button>)}
  </div>;
}

export function SongJourney({ journey, selectedId, playingId, stale, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [scale, setScale] = useState(1);
  const [cols, setCols] = useState(3);
  const viewport = useRef<HTMLDivElement>(null);
  const count = journey.sections.reduce((sum, section) => sum + section.nodes.length, 0);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = new ResizeObserver(() => setCols(Math.max(3, Math.min(10, Math.floor((element.clientWidth - 28 - diagramWidth(1)) / STEP_X) + 1))));
    resize.observe(element); return () => resize.disconnect();
  }, [count > 0]);
  function toggle(id: string) {
    setCollapsed(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  const width = diagramWidth(cols);
  function fit() { setScale(Math.max(.5, Math.min(1, ((viewport.current?.clientWidth ?? width) - 28) / width))); }
  const controls = { selectedId, playingId, stale, onSelect };
  return <section className="journey-panel" aria-labelledby="journey-heading">
    <div className="journey-heading"><div><h2 id="journey-heading">Song journey</h2><p>Follow the written order. Each appearance is its own chord.</p></div><span className="journey-count">{count} occurrences</span></div>
    {count > 0 ? <>
      <div className="journey-toolbar" role="group" aria-label="Graph zoom controls"><button onClick={() => setScale(value => Math.max(.5, Math.round((value - .25) * 100) / 100))} aria-label="Zoom graph out">−</button><output aria-label="Graph zoom">{Math.round(scale * 100)}%</output><button onClick={() => setScale(value => Math.min(1.5, Math.round((value + .25) * 100) / 100))} aria-label="Zoom graph in">+</button><button onClick={fit}>Fit width</button><button onClick={() => setScale(1)}>Reset zoom</button></div>
      <p className="journey-help">Select a chord to inspect it. The magenta outline follows playback. Scroll sideways if needed.</p>
      <div className="journey-viewport" ref={viewport} role="region" tabIndex={0} aria-label="Song journey graph, scroll horizontally when needed" aria-busy={stale}>
        {journey.sections.map((section, index) => {
          const closed = collapsed.has(section.id);
          const height = TOP * 2 + (Math.ceil(section.nodes.length / cols) - 1) * STEP_Y + NODE_H;
          return <div className="journey-section" key={section.id}>
            {index > 0 && <p className="journey-continuation">↓ {journey.sections[index - 1].nodes.at(-1)?.symbol} → {section.nodes[0].symbol} (next section)</p>}
            <button className="journey-section-toggle" aria-expanded={!closed} onClick={() => toggle(section.id)}><span>{closed ? '▸' : '▾'} {section.name}</span><span>{section.nodes.length} chord{section.nodes.length === 1 ? '' : 's'}</span></button>
            {!closed && <div className="journey-scaled-space" style={{ width: width * scale, height: height * scale }}><div className="journey-scale" style={{ transform: `scale(${scale})` }}><Diagram nodes={section.nodes} cols={cols} {...controls}/></div></div>}
          </div>;
        })}
      </div>
      <details className="journey-list"><summary>Show chord list instead</summary><p>Chord occurrences in written order. Select an item to inspect it.</p>{journey.sections.map(section => <div key={section.id}><h3>{section.name}</h3><ol>{section.nodes.map(node => <li key={node.id}><button disabled={stale} aria-pressed={node.id === selectedId} onClick={() => onSelect(node.id)}>{node.order + 1}. {node.symbol}{node.unresolved ? ' (unresolved)' : ''}{node.id === playingId ? ' (playing)' : ''}</button></li>)}</ol></div>)}</details>
    </> : <p className="journey-empty">Add chords to the chart to see their journey.</p>}
  </section>;
}
