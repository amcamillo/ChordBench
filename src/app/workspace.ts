import type { ParsedChart, ReviewChoices } from '../domain/chart/parser.ts';
import type { AccidentalPreference } from '../domain/harmony/types.ts';

export interface Workspace {
  source: string;
  revision: number;
  parsedRevision: number;
  parsed: ParsedChart;
  choices: ReviewChoices;
  selectedId: string | null;
  shift: number;
  preference: AccidentalPreference;
  sourceKey: string;
  notice: string;
}
export type Action =
  | { type: 'edit'; source: string }
  | { type: 'parsed'; revision: number; parsed: ParsedChart }
  | { type: 'select'; id: string }
  | { type: 'shift'; value: number }
  | { type: 'preference'; value: AccidentalPreference }
  | { type: 'key'; value: string }
  | { type: 'review'; key: string; value: 'chord' | 'text' }
  | { type: 'restore'; state: Workspace };

export function workspaceReducer(state: Workspace, action: Action): Workspace {
  switch (action.type) {
    case 'edit': return { ...state, source: action.source, revision: state.revision + 1, choices: {}, notice: '' };
    case 'parsed': {
      if (action.revision !== state.revision) return state;
      const retained = action.parsed.occurrences.some(item => item.id === state.selectedId);
      return { ...state, parsed: action.parsed, parsedRevision: action.revision,
        selectedId: retained ? state.selectedId : null,
        notice: state.selectedId && !retained ? 'The selected chord changed. Select a chord in the updated chart.' : state.notice };
    }
    case 'select': return state.parsedRevision === state.revision && state.parsed.occurrences.some(item => item.id === action.id)
      ? { ...state, selectedId: action.id, notice: '' } : state;
    case 'shift': return state.parsedRevision === state.revision && Number.isInteger(action.value) && Math.abs(action.value) <= 11
      ? { ...state, shift: action.value } : state;
    case 'preference': return { ...state, preference: action.value };
    case 'key': return { ...state, sourceKey: action.value };
    case 'review': return { ...state, choices: { ...state.choices, [action.key]: action.value }, revision: state.revision + 1 };
    case 'restore': return action.state;
  }
}
