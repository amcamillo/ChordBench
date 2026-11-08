import { useCallback, useEffect, useRef, useState } from 'react';
import type { SongEvent } from '../../domain/song/playbackPlan.ts';
import type { Instrument, InstrumentAudio } from '../../infrastructure/audio/instrumentAudio.ts';

export function useSongTransport(plan: SongEvent[], tempo: number, instrument: Instrument, audio: InstrumentAudio) {
  const [state, setState] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('Ready to play from the beginning.');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const position = useRef(0);
  const origin = useRef(0);
  const barSeconds = 240 / tempo;
  const length = plan.length * barSeconds;

  const cancel = useCallback(() => {
    generation.current++;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    audio.stop('song');
  }, [audio]);
  const stop = useCallback((reason = 'Stopped. Ready to play from the beginning.') => {
    cancel(); position.current = 0; setActiveIndex(null); setState('stopped'); setMessage(reason);
  }, [cancel]);
  const pause = useCallback((reason = 'Paused. Press Resume to continue.') => {
    if (state !== 'playing') return;
    position.current = Math.max(0, Math.min(length, audio.currentTime - origin.current));
    cancel(); setState('paused'); setMessage(reason);
  }, [state, audio, length, cancel]);

  const play = useCallback(async () => {
    if (!plan.length) return;
    cancel();
    const current = generation.current;
    try {
      const start = await audio.begin('song');
      if (start === null || generation.current !== current) return;
      const from = Math.min(position.current, Math.max(0, length - .001));
      origin.current = start - from;
      let next = Math.floor(from / barSeconds);
      setState('playing'); setMessage('Playing chart with assumed timing.');
      const tick = () => {
        if (generation.current !== current) return;
        if (audio.state !== 'running') {
          position.current = Math.max(0, Math.min(length, audio.currentTime - origin.current));
          cancel(); setState('paused'); setMessage('Audio was interrupted. Press Resume to continue.'); return;
        }
        const now = audio.currentTime;
        const elapsed = Math.max(0, now - origin.current);
        if (elapsed >= length) { stop('Chart finished. Ready to play again.'); return; }
        setActiveIndex(Math.min(plan.length - 1, Math.floor(elapsed / barSeconds)));
        while (next < plan.length && origin.current + next * barSeconds <= now + .2) {
          // If the main thread stalls, never sound already-expired chords at once.
          if (origin.current + (next + 1) * barSeconds <= now) { next++; continue; }
          const event = plan[next];
          const scheduled = Math.max(start, now, origin.current + next * barSeconds);
          const remaining = Math.max(.04, origin.current + (next + 1) * barSeconds - scheduled);
          audio.schedule(event.pitches.map(midi => ({ midi, delay: 0, duration: Math.min(remaining * .92, barSeconds * .92) })), instrument, scheduled);
          next++;
        }
        timer.current = setTimeout(tick, 50);
      };
      tick();
    } catch {
      if (generation.current === current) { setState('stopped'); setMessage('Sound could not start. Check your device volume and try again.'); }
    }
  }, [plan, length, barSeconds, audio, cancel, instrument, stop]);

  useEffect(() => { stop('Chart or playback settings changed. Ready to play from the beginning.'); }, [plan, tempo, instrument, stop]);
  useEffect(() => {
    const onHide = () => { if (document.hidden && state === 'playing') pause('Playback paused while the page was hidden. Press Resume to continue.'); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [state, pause]);
  useEffect(() => () => cancel(), [cancel]);
  // A fractional written-chord position, read from the same clock as scheduled audio.
  const getPosition = useCallback(() => {
    const seconds = state === 'playing' ? audio.currentTime - origin.current : position.current;
    return Math.max(0, Math.min(plan.length, seconds / barSeconds));
  }, [state, audio, plan.length, barSeconds]);
  return { state, activeIndex, message, play, pause, stop, getPosition };
}
