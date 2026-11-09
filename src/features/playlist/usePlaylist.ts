import { useEffect, useRef, useState } from 'react';
import { readPlaylist, savePlaylist, validatePlaylist, type PlaylistSong } from '../../infrastructure/storage/playlist.ts';

export type SongSnapshot = Pick<PlaylistSong, 'draft' | 'tempo' | 'instrument'>;
export function usePlaylist(current: SongSnapshot) {
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Loading playlist…');
  const [retry, setRetry] = useState(0);
  const [removed, setRemoved] = useState<{ song: PlaylistSong; index: number } | null>(null);
  const latest = useRef(current); latest.current = current;
  useEffect(() => {
    let alive = true;
    if (ready) return;
    readPlaylist().then(value => { if (alive) { setSongs(value.songs); setReady(true); setError(''); } })
      .catch(() => { if (alive) setError('Playlist could not be read. Retry before changing saved songs.'); });
    return () => { alive = false; };
  }, [ready, retry]);
  useEffect(() => {
    if (!activeId) return;
    setSongs(previous => previous.map(song => song.id === activeId ? { ...song, ...current } : song));
  }, [current, activeId]);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setStatus('Saving playlist…');
    const timer = setTimeout(() => {
      try {
        savePlaylist({ schemaVersion: 1, songs }).then(() => { if (alive) { setStatus('Playlist saved on this browser'); setError(''); } })
          .catch(() => { if (alive) { setError('Playlist could not be saved. Download a backup and retry.'); setStatus('Playlist not saved'); } });
      } catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : 'Playlist is too large.'); }
    }, 150);
    return () => { alive = false; clearTimeout(timer); };
  }, [songs, ready, retry]);
  function add(incoming: PlaylistSong[]) {
    const next = [...songs, ...incoming];
    validatePlaylist({ schemaVersion: 1, songs: next });
    setSongs(next);
  }
  return { songs, activeId, ready, error, status, removed,
    retry: () => setRetry(n => n + 1),
    add,
    addCurrent(title: string) {
      const song = { ...latest.current, id: crypto.randomUUID(), title: title.trim() || `Song ${songs.length + 1}` };
      add([song]); setActiveId(song.id);
    },
    activate(id: string) {
      const song = songs.find(item => item.id === id);
      if (!song) return;
      setSongs(previous => previous.map(item => item.id === activeId ? { ...item, ...latest.current } : item));
      setActiveId(id);
      return song;
    },
    detach() {
      if (activeId) setSongs(previous => previous.map(song => song.id === activeId ? { ...song, ...latest.current } : song));
      setActiveId(null);
    },
    rename(id: string, title: string) { setSongs(previous => previous.map(song => song.id === id ? { ...song, title: title.trim().slice(0, 100) || song.title } : song)); },
    move(id: string, direction: number) { setSongs(previous => { const next = [...previous], index = next.findIndex(song => song.id === id), other = index + direction; if (index >= 0 && other >= 0 && other < next.length) [next[index], next[other]] = [next[other], next[index]]; return next; }); },
    remove(id: string) { const index = songs.findIndex(song => song.id === id); if (index < 0) return; setRemoved({ song: id === activeId ? { ...songs[index], ...latest.current } : songs[index], index }); setSongs(songs.filter(song => song.id !== id)); if (activeId === id) setActiveId(null); },
    undo() { if (!removed) return; const next = [...songs]; next.splice(removed.index, 0, removed.song); validatePlaylist({ schemaVersion: 1, songs: next }); setSongs(next); setRemoved(null); },
  };
}
