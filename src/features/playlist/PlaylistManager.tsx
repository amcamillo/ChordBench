import { useRef, useState } from 'react';
import { inspectChartBytes, MAX_IMPORT_BYTES } from '../../domain/chart/importChart.ts';
import { tonalTheory } from '../../infrastructure/theory/tonal.ts';
import { validatePlaylist, type PlaylistSong } from '../../infrastructure/storage/playlist.ts';
import type { usePlaylist } from './usePlaylist.ts';

export function PlaylistManager({ playlist, onLoad, disabled }: { playlist: ReturnType<typeof usePlaylist>; onLoad(id: string): void; disabled: boolean }) {
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState<PlaylistSong[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ticket = useRef(0);
  async function choose(files: File[]) {
    const run = ++ticket.current;
    setPending([]); setError('');
    if (!files.length) return;
    if (files.length > 40) { setError('Choose up to 40 chart files.'); return; }
    setBusy(true);
    try {
      const result: PlaylistSong[] = [];
      for (const file of files) {
        if (file.size > (file.name.toLowerCase().endsWith('.json') ? 16_000_000 : MAX_IMPORT_BYTES)) throw new Error(`${file.name}: file is too large.`);
        if (file.name.toLowerCase().endsWith('.json')) {
          const saved = validatePlaylist(JSON.parse(await file.text()));
          result.push(...saved.songs.map(song => ({ ...song, id: crypto.randomUUID() })));
        } else {
          const chart = inspectChartBytes(new Uint8Array(await file.arrayBuffer()), tonalTheory);
          if (!chart.source.trim()) throw new Error(`${file.name}: no chart text remains.`);
          result.push({ id: crypto.randomUUID(), title: (chart.title || file.name.replace(/\.[^.]+$/, '')).slice(0, 100), tempo: 90, instrument: 'piano', draft: { schemaVersion: 1, source: chart.source, shift: 0, preference: 'preserve', sourceKey: '', choices: {}, savedAt: new Date().toISOString() } });
        }
      }
      validatePlaylist({ schemaVersion: 1, songs: [...playlist.songs, ...result] });
      if (run === ticket.current) setPending(result);
    } catch (cause) { if (run === ticket.current) setError(cause instanceof Error ? cause.message : 'Unable to read these charts.'); }
    finally { if (run === ticket.current) setBusy(false); }
  }
  function attempt(action: () => void) { try { action(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Playlist could not be changed.'); } }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, songs: playlist.songs }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'chordbench-playlist.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="playlist-manager">
    <summary>Playlist · {playlist.songs.length} songs</summary>
    <div className="playlist-body">
      <p>Prepare your set here. Loaded songs keep their chart, transposition, tempo and instrument as you edit. Add the current chart before loading another song if you want to keep it in the playlist.</p>
      <div className="playlist-add"><label>Song title<input maxLength={100} value={title} onChange={event => setTitle(event.target.value)}/></label><button disabled={disabled || !playlist.ready} onClick={() => attempt(() => { playlist.addCurrent(title); setTitle(''); })}>Add current chart</button></div>
      <label>Load chart files or a playlist backup<input type="file" multiple accept=".txt,.pro,.cho,.chopro,.chordpro,.crd,.json" disabled={disabled || !playlist.ready || busy} onChange={event => { void choose(Array.from(event.target.files ?? [])); event.target.value = ''; }}/></label>
      <p className="helper">Up to 40 songs. ChartPro/text imports remove metadata and standalone links; musical text remains. Playlist backups retain all saved settings.</p>
      {busy && <p role="status">Reading charts…</p>}
      {pending.length > 0 && <div className="playlist-preview"><strong>Ready to add {pending.length} songs</strong><ul>{pending.map(song => <li key={song.id}>{song.title}</li>)}</ul><button disabled={disabled} onClick={() => attempt(() => { playlist.add(pending); setPending([]); })}>Add files to playlist</button><button onClick={() => setPending([])}>Cancel files</button></div>}
      {(error || playlist.error) && <p role="alert">{error || playlist.error}</p>}
      {playlist.error && <button onClick={playlist.retry}>Retry playlist storage</button>}
      <ol className="playlist-songs">{playlist.songs.map((song, index) => <li key={song.id} data-active={playlist.activeId === song.id}>
        <label><span>Song {index + 1}</span><input aria-label={`Title for song ${index + 1}`} maxLength={100} defaultValue={song.title} onBlur={event => { playlist.rename(song.id, event.target.value); event.target.value = event.target.value.trim() || song.title; }}/></label>
        <div><button disabled={disabled || playlist.activeId === song.id} aria-label={`Load ${song.title}`} onClick={() => onLoad(song.id)}>{playlist.activeId === song.id ? 'Loaded' : 'Load'}</button><button disabled={index === 0} aria-label={`Move ${song.title} up`} onClick={() => playlist.move(song.id, -1)}>↑</button><button disabled={index === playlist.songs.length - 1} aria-label={`Move ${song.title} down`} onClick={() => playlist.move(song.id, 1)}>↓</button><button onClick={() => playlist.remove(song.id)} aria-label={`Remove ${song.title}`}>Remove</button></div>
      </li>)}</ol>
      {playlist.removed && <button onClick={() => attempt(playlist.undo)}>Undo removal of {playlist.removed.song.title}</button>}
      <div className="playlist-backup"><button disabled={!playlist.songs.length} onClick={download}>Download playlist</button><span role="status">{playlist.status}</span></div>
    </div>
  </details>;
}
