/** Fixed absolute-pitch colours. A missing or invalid MIDI note stays neutral. */
export const UNKNOWN_NOTE_COLOR = '#596579';
export const NOTE_COLOR_ANCHORS = [
  { midi: 36, color: '#842634' },
  { midi: 60, color: '#b12c40' },
  { midi: 64, color: '#7a3f98' },
  { midi: 67, color: '#2454a6' },
  { midi: 96, color: '#203c7c' },
] as const;

type Triple = [number, number, number];
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const srgb = (v: number) => v <= .0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - .055;
function toLab(hex: string): Triple {
  const [r, g, b] = [1, 3, 5].map(i => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
  const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
  const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  return [.2104542553*l + .793617785*m - .0040720468*s, 1.9779984951*l - 2.428592205*m + .4505937099*s, .0259040371*l + .7827717662*m - .808675766*s];
}
function fromLab([L, a, b]: Triple): string {
  const l = (L + .3963377774*a + .2158037573*b) ** 3;
  const m = (L - .1055613458*a - .0638541728*b) ** 3;
  const s = (L - .0894841775*a - 1.291485548*b) ** 3;
  return '#' + [4.0767416621*l - 3.3077115913*m + .2309699292*s, -1.2684380046*l + 2.6097574011*m - .3413193965*s, -.0041960863*l - .7034186147*m + 1.707614701*s]
    .map(value => Math.round(Math.max(0, Math.min(1, srgb(value))) * 255).toString(16).padStart(2, '0')).join('');
}
const LAB = NOTE_COLOR_ANCHORS.map(anchor => toLab(anchor.color));
export function noteColor(midi: number | null | undefined): string {
  if (typeof midi !== 'number' || !Number.isInteger(midi) || midi < 0 || midi > 127) return UNKNOWN_NOTE_COLOR;
  if (midi <= NOTE_COLOR_ANCHORS[0].midi) return NOTE_COLOR_ANCHORS[0].color;
  const last = NOTE_COLOR_ANCHORS.length - 1;
  if (midi >= NOTE_COLOR_ANCHORS[last].midi) return NOTE_COLOR_ANCHORS[last].color;
  const segment = NOTE_COLOR_ANCHORS.findIndex((anchor, i) => i < last && midi >= anchor.midi && midi < NOTE_COLOR_ANCHORS[i + 1].midi);
  const start = NOTE_COLOR_ANCHORS[segment].midi, end = NOTE_COLOR_ANCHORS[segment + 1].midi;
  if (midi === start) return NOTE_COLOR_ANCHORS[segment].color;
  const t = (midi - start) / (end - start);
  return fromLab(LAB[segment].map((value, i) => value + (LAB[segment + 1][i] - value) * t) as Triple);
}

/** One pitch class can represent several octaves; only an unambiguous MIDI may be coloured. */
export function unambiguousPitch(notes: readonly { midi: number }[] | undefined, pitchClass: number): number | null {
  if (!notes) return null;
  const pitches = new Set(notes.filter(note => note.midi % 12 === pitchClass).map(note => note.midi));
  return pitches.size === 1 ? [...pitches][0] : null;
}
