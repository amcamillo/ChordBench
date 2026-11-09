import { useEffect, useRef } from 'react';

export function TimingRuler({ focus, symbol, running, getPosition }: { focus: number; symbol: string; running: boolean; getPosition(): number }) {
  const needle = useRef<SVGLineElement>(null);
  const fill = useRef<SVGLineElement>(null);
  const previousFocus = useRef(focus);
  useEffect(() => {
    let frame = 0;
    const draw = (position: number) => {
      const phase = Math.max(0, Math.min(1, position - focus));
      const x = String(20 + phase * 960);
      needle.current?.setAttribute('x1', x); needle.current?.setAttribute('x2', x);
      fill.current?.setAttribute('x2', x);
    };
    if (previousFocus.current !== focus) draw(focus);
    previousFocus.current = focus;
    if (running) {
      const tick = () => { draw(getPosition()); frame = requestAnimationFrame(tick); };
      tick();
    }
    return () => cancelAnimationFrame(frame);
  }, [focus, running, getPosition]);
  return <div className="dna-timing-ruler" aria-label="Screen-facing timing ruler">
    <span>{symbol} · chord {focus + 1}<small>Assumed 4/4 · beats</small></span>
    <div className="dna-ruler-counts" aria-hidden="true">{[1, 2, 3, 4].map(beat => <span key={beat}>{beat}</span>)}</div>
    <svg viewBox="0 0 1000 42" preserveAspectRatio="none" role="img" aria-label="Four-beat timing ruler; the dark marker shows progress through the current assumed bar">
      <line x1="20" x2="980" y1="28" y2="28" stroke="#b9b7d7" strokeWidth="4"/>
      <line ref={fill} x1="20" x2="20" y1="28" y2="28" stroke="#49358f" strokeWidth="4"/>
      {[0, 1, 2, 3].map(beat => <line key={beat} x1={20 + beat * 240} x2={20 + beat * 240} y1="22" y2="35" stroke="#49358f" strokeWidth="2"/>)}
      <line ref={needle} x1="20" x2="20" y1="18" y2="39" stroke="#b33b16" strokeWidth="5"/>
    </svg>
  </div>;
}
