export const METERS = ['2/4', '3/4', '4/4', '6/8'] as const;
export type Meter = typeof METERS[number];
export interface Groove { id: string; name: string; meter: Meter; steps: number[]; description: string }
// Original illustrative accent envelopes. They are visual suggestions, not
// transcriptions, classifiers, or universal definitions of these broad styles.
export const GROOVES: Groove[] = [
  { id: 'none', name: 'Harmony only', meter: '4/4', steps: [], description: 'No rhythmic interpretation applied.' },
  { id: 'waltz', name: 'Waltz / valse', meter: '3/4', steps: [1, .4, .4], description: 'Three quarter-note beats: a strong first beat followed by two lighter beats.' },
  { id: 'bolero', name: 'Cuban bolero · example', meter: '4/4', steps: [1, 0, .55, .8, 0, .55, .8, 0], description: 'An illustrative uneven eight-slot accent cell in duple meter. Cuban bolero has many accompaniment patterns; this is not Spanish bolero.' },
  { id: 'phonk', name: 'Phonk · half-time example', meter: '4/4', steps: [1, .2, .25, 0, .3, 0, .5, .2, 1, 0, .3, 0, .45, .25, .65, .3], description: 'A chosen half-time example: strong first and third beats, with sparse sixteenth-note activity. Phonk variants differ.' },
  { id: 'funk', name: 'Funk · syncopated example', meter: '4/4', steps: [1, 0, .45, .8, .9, .25, 0, .7, .5, 0, .8, .4, 1, .3, 0, .75], description: 'A chosen sixteenth-note example with offbeat accents and gaps between attacks.' },
  { id: 'jazz', name: 'Jazz · swing example', meter: '4/4', steps: [.8, 0, .45, 1, 0, .55, .65, 0, .45, 1, 0, .55], description: 'Long–short pairs on a triplet grid, with stronger second and fourth beats. This fixed 2:1 example does not represent every jazz or swing performance.' },
  { id: 'minuet', name: 'Minuet · subdivided example', meter: '3/4', steps: [1, .25, .55, .25, .65, .35], description: 'A chosen triple-meter example with lighter eighth-note subdivisions. It contrasts with the simpler waltz example; minuets and waltzes cannot be distinguished by meter alone.' },
  { id: 'samba', name: 'Samba · syncopated example', meter: '2/4', steps: [.75, .3, .65, .25, 1, .25, .55, .8], description: 'A chosen two-beat cell with sixteenth-note subdivisions and offbeat accents. One visual layer cannot reproduce the interlocking parts of a samba ensemble.' },
  { id: 'rock', name: 'Rock · backbeat example', meter: '4/4', steps: [.8, .3, 1, .3, .8, .3, 1, .3], description: 'A straight eighth-note example with stronger second and fourth beats. Rock includes many other meters and feels.' },
  { id: 'pop', name: 'Pop · dance pulse example', meter: '4/4', steps: [1, .6, .85, .6, 1, .6, .85, .75], description: 'A chosen dance-pop example with a regular quarter-note pulse and lighter offbeats. Pop is a broad category, not a single rhythmic pattern.' },
  { id: 'rock-opera', name: 'Rock opera · anthem example', meter: '4/4', steps: [1, 0, .35, .65, .9, 0, .4, 0, .85, .3, 0, .65, 1, .4, .7, .85], description: 'An illustrative anthem cell with gaps and a closing build. Rock opera is a dramatic format, not a meter or groove; different sections may use different styles.' },
  { id: 'rock-opera-ballad', name: 'Rock opera · 6/8 ballad example', meter: '6/8', steps: [1, .3, .45, .8, .35, .6], description: 'A contrasting ballad example in two groups of three eighth notes. This is one possible section feel, not a defining rock-opera rhythm.' },
];
export interface VisualRhythm { groove: Groove; meter: Meter }
export function meterBeats(meter: Meter): number { return Number(meter.split('/')[0]); }
// Duple meter needs an oval rather than a degenerate two-vertex polygon.
export function meterFrame(meter: Meter, radius: number) {
  const sides = meter === '2/4' ? 32 : meterBeats(meter);
  return Array.from({ length: sides + 1 }, (_, index) => {
    const angle = index / sides * Math.PI * 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * (meter === '2/4' ? .65 : 1) };
  });
}
export function rhythmEvents({ groove, meter }: VisualRhythm) {
  return groove.steps.flatMap((strength, index) => strength > 0 ? [{ fraction: index / groove.steps.length, beat: index / groove.steps.length * meterBeats(meter), strength }] : []);
}
export function overviewX(position: number, count: number): number {
  return count <= 1 ? 0 : -16 + Math.max(0, Math.min(count - 1, position)) / (count - 1) * 32;
}
export function overviewPoint(pitchIndex: number, position: number, count: number, radius = 2) {
  const angle = pitchIndex * Math.PI / 6 + position / Math.max(1, count - 1) * Math.PI * 8;
  return { x: overviewX(position, count), y: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
