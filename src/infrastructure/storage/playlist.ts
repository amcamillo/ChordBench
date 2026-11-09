import { validateDraft, type Draft } from './drafts.ts';

export interface PlaylistSong { id: string; title: string; draft: Draft; tempo: number; instrument: 'piano' | 'guitar' }
export interface Playlist { schemaVersion: 1; songs: PlaylistSong[] }
export const MAX_PLAYLIST_SONGS = 40;
export function validatePlaylist(value: unknown): Playlist {
  if (!value || typeof value !== 'object') throw new Error('This is not a playlist backup.');
  const data = value as Partial<Playlist>;
  if (data.schemaVersion !== 1 || !Array.isArray(data.songs) || data.songs.length > MAX_PLAYLIST_SONGS) throw new Error('Unsupported playlist or more than 40 songs.');
  const ids = new Set<string>();
  let length = 0;
  const songs = data.songs.map(song => {
    if (!song || typeof song.id !== 'string' || !/^[\w-]{1,80}$/.test(song.id) || ids.has(song.id)
      || typeof song.title !== 'string' || !song.title.trim() || song.title.length > 100
      || !Number.isInteger(song.tempo) || song.tempo < 40 || song.tempo > 240
      || !['piano', 'guitar'].includes(song.instrument)) throw new Error('A playlist song has invalid data.');
    ids.add(song.id);
    const draft = validateDraft(song.draft);
    length += draft.source.length;
    if (length > 4_000_000) throw new Error('Keep the playlist under four million text characters.');
    return { id: song.id, title: song.title.trim(), draft, tempo: song.tempo, instrument: song.instrument };
  });
  return { schemaVersion: 1, songs };
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chordbench-playlist', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('playlists');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other ChordBench tabs and retry.'));
  });
}
export async function readPlaylist(): Promise<Playlist> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readonly');
    const request = tx.objectStore('playlists').get('current');
    tx.oncomplete = () => { db.close(); try { resolve(request.result ? validatePlaylist(request.result) : { schemaVersion: 1, songs: [] }); } catch (error) { reject(error); } };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
let queue: Promise<void> = Promise.resolve();
export function savePlaylist(value: Playlist): Promise<void> {
  const checked = validatePlaylist(value);
  const write = queue.catch(() => {}).then(async () => {
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      tx.objectStore('playlists').put(checked, 'current');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
  queue = write;
  return write;
}
