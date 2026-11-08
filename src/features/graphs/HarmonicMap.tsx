import { useEffect, useMemo, useRef, useState } from 'react';
import type { HarmonicEdge, HarmonicMap as MapData, HarmonicNode, MapOccurrence } from '../../domain/graphs/harmonicMap.ts';

interface Props { map: MapData; selectedId: string | null; playingId: string | null; stale: boolean; onSelect(id: string): void }
const NODE_W = 120, NODE_H = 64, MAX_DIAGRAM_NODES = 32;

function layout(nodes: HarmonicNode[]) {
  const radius = nodes.length <= 1 ? 0 : Math.max(125, nodes.length * 160 / (2 * Math.PI));
  const width = Math.ceil(radius * 2 + 240), height = Math.ceil(radius * 2 + 200);
  const positions = new Map(nodes.map((node, i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / nodes.length;
    return [node.id, { x: width / 2 + radius * Math.cos(angle), y: height / 2 + radius * Math.sin(angle) }] as const;
  }));
  return { width, height, positions };
}

function Diagram({ map, selectedNodeId, playingId, stale, onNode }: { map: MapData; selectedNodeId: string | null; playingId: string | null; stale: boolean; onNode(id: string): void }) {
  const { width, height, positions } = useMemo(() => layout(map.nodes), [map.nodes]);
  const pairs = new Set(map.edges.map(edge => JSON.stringify([edge.from, edge.to])));
  function edgePath(edge: HarmonicEdge) {
    const a = positions.get(edge.from)!, b = positions.get(edge.to)!;
    if (edge.from === edge.to) return { d: `M ${a.x - 23} ${a.y - 30} C ${a.x - 55} ${a.y - 92}, ${a.x + 55} ${a.y - 92}, ${a.x + 23} ${a.y - 30}`, x: a.x, y: a.y - 76 };
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), ux = dx / distance, uy = dy / distance;
    const start = { x: a.x + ux * 60, y: a.y + uy * 33 }, end = { x: b.x - ux * 65, y: b.y - uy * 35 };
    const bend = pairs.has(JSON.stringify([edge.to, edge.from])) ? 28 : 0;
    const cx = (start.x + end.x) / 2 - uy * bend, cy = (start.y + end.y) / 2 + ux * bend;
    return { d: `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`, x: .25 * start.x + .5 * cx + .25 * end.x, y: .25 * start.y + .5 * cy + .25 * end.y };
  }
  return <div className="harmonic-diagram" style={{ width, height }}>
    <svg className="harmonic-edges" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs><marker id="harmonic-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#7166a5"/></marker></defs>
      {map.edges.map(edge => { const path = edgePath(edge); return <g key={JSON.stringify([edge.from, edge.to])}>
        <path d={path.d} fill="none" stroke="#7166a5" strokeOpacity=".8" strokeWidth={Math.min(5, 1 + Math.sqrt(edge.occurrences.length))} markerEnd="url(#harmonic-arrow)"/>
        <circle cx={path.x} cy={path.y} r="12" fill="#f7f7fd" stroke="#9c98bf"/><text x={path.x} y={path.y + 4} textAnchor="middle" fontSize="11" fill="#12244a">{edge.occurrences.length}</text>
      </g>; })}
    </svg>
    {map.nodes.map(node => { const position = positions.get(node.id)!; const playing = node.occurrences.some(item => item.id === playingId); return <button key={node.id} className={`journey-node harmonic-node ${playing ? 'journey-playing' : ''}`} style={{ left: position.x - NODE_W / 2, top: position.y - NODE_H / 2 }}
      aria-label={`Map ${node.symbol}, ${node.occurrences.length} occurrence${node.occurrences.length === 1 ? '' : 's'}`} aria-pressed={node.id === selectedNodeId} disabled={stale} onClick={() => onNode(node.id)}>
      <span className="journey-node-symbol">{node.symbol}</span><span className="journey-node-order">{node.occurrences.length} occurrence{node.occurrences.length === 1 ? '' : 's'}</span>
    </button>; })}
  </div>;
}

function OccurrenceButton({ item, stale, onSelect, label }: { item: MapOccurrence; stale: boolean; onSelect(id: string): void; label?: string }) {
  return <button disabled={stale} onClick={() => onSelect(item.id)}>{label ?? `Occurrence ${item.order + 1}`} · {item.section} · {item.sourceSymbol}</button>;
}

export function HarmonicMap({ map, selectedId, playingId, stale, onSelect }: Props) {
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [edgeKey, setEdgeKey] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const dimensions = useMemo(() => layout(map.nodes), [map.nodes]);
  useEffect(() => {
    const selected = map.nodes.find(node => node.occurrences.some(item => item.id === selectedId));
    setNodeId(selected?.id ?? null);
    setEdgeKey(null);
  }, [selectedId, map]);
  const selectedNode = map.nodes.find(node => node.id === nodeId);
  const selectedEdge = map.edges.find(edge => JSON.stringify([edge.from, edge.to]) === edgeKey);
  const symbols = new Map(map.nodes.map(node => [node.id, node.symbol]));
  return <section className="journey-panel harmonic-panel" aria-labelledby="harmonic-heading">
    <div className="journey-heading"><div><h2 id="harmonic-heading">Harmonic map</h2><p>Repeated chord identities share a node. Arrows show observed transitions.</p></div><span className="journey-count">{map.nodes.length} distinct chords</span></div>
    {map.nodes.length > 0 ? <>
      <p className="journey-help">The number and width of each arrow show its count, not harmonic strength. Select a chord, then choose an occurrence. Use the lists below to choose transitions.</p>
      {map.nodes.length <= MAX_DIAGRAM_NODES ? <>
        <div className="journey-toolbar" role="group" aria-label="Harmonic map zoom controls"><button aria-label="Zoom harmonic map out" onClick={() => setScale(value => Math.max(.5, Math.round((value - .25) * 100) / 100))}>−</button><output aria-label="Harmonic map zoom">{Math.round(scale * 100)}%</output><button aria-label="Zoom harmonic map in" onClick={() => setScale(value => Math.min(1.5, Math.round((value + .25) * 100) / 100))}>+</button><button onClick={() => setScale(Math.max(.5, Math.min(1, ((viewport.current?.clientWidth ?? dimensions.width) - 28) / dimensions.width)))}>Fit map width</button><button onClick={() => setScale(1)}>Reset map zoom</button></div>
        <p className="journey-help">Scroll within the map to explore. The chord and transition lists remain available at full size.</p>
        <div className="journey-viewport harmonic-viewport" ref={viewport} role="region" tabIndex={0} aria-label="Harmonic map, scroll to explore" aria-busy={stale}>
          <div className="journey-scaled-space" style={{ width: dimensions.width * scale, height: dimensions.height * scale }}><div className="journey-scale" style={{ transform: `scale(${scale})` }}><Diagram map={map} selectedNodeId={nodeId} playingId={playingId} stale={stale} onNode={id => { setNodeId(id); setEdgeKey(null); }}/></div></div>
        </div>
      </> : <p className="harmonic-notice">This chart has more than {MAX_DIAGRAM_NODES} distinct chords. Use the chord and transition lists below to explore all of them.</p>}
      <div className="harmonic-content">
        <section aria-label="Chord identities"><h3>Chords</h3><div className="harmonic-buttons">{map.nodes.map(node => <button key={node.id} aria-pressed={nodeId === node.id} disabled={stale} onClick={() => { setNodeId(node.id); setEdgeKey(null); }}>{node.symbol} <span>· {node.occurrences.length}</span></button>)}</div></section>
        {selectedNode && <section className="harmonic-detail" aria-label={`Occurrences of ${selectedNode.symbol}`}><h3>{selectedNode.symbol} · {selectedNode.occurrences.length} occurrence{selectedNode.occurrences.length === 1 ? '' : 's'}</h3><p>Written as: {selectedNode.sourceSymbols.join(', ')}</p><div className="harmonic-buttons">{selectedNode.occurrences.map(item => <OccurrenceButton key={item.id} item={item} stale={stale} onSelect={onSelect}/>)}</div></section>}
        <section aria-label="Observed transitions"><h3>Observed transitions</h3>{map.edges.length ? <div className="harmonic-buttons">{map.edges.map(edge => { const key = JSON.stringify([edge.from, edge.to]); return <button key={key} disabled={stale} aria-pressed={edgeKey === key} onClick={() => { setEdgeKey(key); setNodeId(null); }}>{symbols.get(edge.from)} → {symbols.get(edge.to)} · {edge.occurrences.length}</button>; })}</div> : <p>No resolved adjacent chords to compare.</p>}</section>
        {selectedEdge && <section className="harmonic-detail" aria-label="Transition occurrences"><h3>{symbols.get(selectedEdge.from)} → {symbols.get(selectedEdge.to)}</h3><p>Choose an occurrence in the written transition.</p>{selectedEdge.occurrences.map(pair => <div className="harmonic-pair" key={`${pair.from.id}-${pair.to.id}`}><OccurrenceButton item={pair.from} label={`From ${pair.from.order + 1}`} stale={stale} onSelect={onSelect}/><span aria-hidden="true">→</span><OccurrenceButton item={pair.to} label={`To ${pair.to.order + 1}`} stale={stale} onSelect={onSelect}/></div>)}</section>}
      </div>
    </> : <p className="journey-empty">No resolved chords to map yet. Add chords or review unrecognized symbols.</p>}
    {map.unresolved.length > 0 && <div className="harmonic-notice"><p>{map.unresolved.length} unresolved occurrence{map.unresolved.length === 1 ? '' : 's'} excluded. Transitions across them are not inferred.</p><div className="harmonic-buttons">{map.unresolved.map(item => <OccurrenceButton key={item.id} item={item} stale={stale} onSelect={onSelect}/>)}</div></div>}
  </section>;
}
