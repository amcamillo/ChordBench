import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  songs: { id: string; title: string }[]; activeSong: string | null; onSong(id: string): void; playlistError: string;
  chart: ReactNode; piano: ReactNode; dna: ReactNode;
  symbol: string; next: string; position: number; count: number; section: string;
  selectedId: string | null; playingId: string | null;
  playback: 'playing' | 'paused' | 'stopped'; disabled: boolean; status: string;
  onPrevious(): void; onNext(): void; onPlay(): void; onPause(): void; onStop(): void; onSetup(): void;
}

export function SessionWorkspace(props: Props) {
  const [view, setView] = useState<'chart' | 'piano' | 'dna'>('chart');
  const chart = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view !== 'chart') return;
    const container = chart.current?.querySelector<HTMLElement>('.chart-scroll');
    const target = container?.querySelector<HTMLElement>(props.playingId ? '.playing-token' : '[aria-pressed=true]');
    if (!container || !target) return;
    const box = container.getBoundingClientRect(), note = target.getBoundingClientRect();
    if (note.top < box.top || note.bottom > box.bottom) container.scrollTop += note.top - box.top - 16;
    if (note.left < box.left || note.right > box.right) container.scrollLeft += note.left - box.left - 8;
  }, [view, props.selectedId, props.playingId]);
  function turnPage(direction: number) {
    const container = chart.current?.querySelector<HTMLElement>('.chart-scroll');
    if (container) container.scrollBy({ top: direction * container.clientHeight * .8, behavior: 'instant' });
  }
  return <div className="session-shell" aria-label="Musician session">
    <header className="session-header">{props.songs.length ? <label className="session-song"><span className="sr-only">Playlist song</span><select aria-label="Playlist song" value={props.activeSong ?? ''} onChange={event => props.onSong(event.target.value)}><option value="" disabled>Current chart - choose song</option>{props.songs.map((song, index) => <option key={song.id} value={song.id}>{index + 1}. {song.title}</option>)}</select></label> : <h1>ChordBench <span>Session</span></h1>}<button onClick={props.onSetup}>Setup</button></header>
    <div className="session-chord" aria-label="Selected chord">
      <button aria-label="Previous session chord" disabled={props.disabled || props.position <= 0} onClick={props.onPrevious}>‹</button>
      <div><strong>{props.symbol}</strong><span>{props.section} · {props.count ? props.position + 1 : 0}/{props.count}{props.next && ` · next ${props.next}`}</span></div>
      <button aria-label="Next session chord" disabled={props.disabled || props.position >= props.count - 1} onClick={props.onNext}>›</button>
    </div>
    <div className="session-content" data-view={view}>
      <div className="session-chart" ref={chart} hidden={view !== 'chart'}>
        {props.chart}
        <div className="session-page-controls"><button onClick={() => turnPage(-1)}>Page back</button><button onClick={() => turnPage(1)}>Page forward</button></div>
      </div>
      <div className="session-piano" hidden={view !== 'piano'}>{props.piano}</div>
      <div className="session-dna" hidden={view !== 'dna'}>{props.dna}</div>
    </div>
    <div className="session-transport" aria-label="Session playback">
      {props.playback === 'playing' ? <button onClick={props.onPause}>Pause</button> : <button className="primary-button" disabled={props.disabled || !props.count} onClick={props.onPlay}>{props.playback === 'paused' ? 'Resume' : 'Play'}</button>}
      <button disabled={props.playback === 'stopped'} onClick={props.onStop}>Stop</button>
      <span role="status">{props.playlistError || props.status}</span>
    </div>
    <nav className="session-tabs" aria-label="Session views">{(['chart', 'piano', 'dna'] as const).map(item => <button key={item} aria-current={view === item ? 'page' : undefined} onClick={() => setView(item)}>{item === 'chart' ? 'Chart' : item === 'piano' ? 'Instrument' : 'Song DNA'}</button>)}</nav>
  </div>;
}
