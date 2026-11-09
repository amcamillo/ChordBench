import type { CSSProperties } from 'react';
import { noteColor } from '../domain/harmony/noteColor.ts';

export const noteStyle = (midi?: number | null): CSSProperties => ({ '--note-color': noteColor(midi) }) as CSSProperties;
