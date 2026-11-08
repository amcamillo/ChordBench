export interface ChordDefinition {
  id: string;
  symbol: string;
  root: string;
  suffix: string;
  quality: string;
  notes: string[];
  intervals: string[];
  pitchClasses: number[];
  slashBass?: string;
}

export type ChordResult =
  | { status: 'resolved'; chord: ChordDefinition }
  | { status: 'unsupported' | 'ambiguous'; message: string };

export type AccidentalPreference = 'preserve' | 'sharps' | 'flats';
