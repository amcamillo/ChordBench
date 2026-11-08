import { MAX_SOURCE_LENGTH } from '../../domain/chart/parser.ts';
import type { ReviewChoices } from '../../domain/chart/parser.ts';
import type { AccidentalPreference } from '../../domain/harmony/types.ts';

export interface Draft {
  schemaVersion: 1;
  source: string;
  shift: number;
  preference: AccidentalPreference;
  sourceKey: string;
  choices: ReviewChoices;
  savedAt: string;
}

export function validateDraft(value: unknown): Draft {
  if (!value || typeof value !== 'object') throw new Error('The saved draft is not readable.');
  const d = value as Record<string, unknown>;
  if (d.schemaVersion !== 1 || typeof d.source !== 'string' || d.source.length > MAX_SOURCE_LENGTH
    || typeof d.shift !== 'number' || !Number.isInteger(d.shift) || Math.abs(d.shift) > 11
    || !['preserve', 'sharps', 'flats'].includes(String(d.preference))
    || typeof d.sourceKey !== 'string' || !/^(?:[A-G](?:#|b)?)?$/.test(d.sourceKey)
    || typeof d.savedAt !== 'string' || !Number.isFinite(Date.parse(d.savedAt))) throw new Error('The saved draft uses invalid or unsupported data.');
  const choices: ReviewChoices = {};
  if (d.choices && typeof d.choices === 'object' && !Array.isArray(d.choices)) {
    for (const [key, choice] of Object.entries(d.choices)) {
      if (/^\d+:[^\r\n]{1,100}$/.test(key) && (choice === 'chord' || choice === 'text')) choices[key] = choice;
    }
  }
  return { schemaVersion: 1, source: d.source, shift: d.shift, preference: d.preference as AccidentalPreference,
    sourceKey: d.sourceKey, choices, savedAt: d.savedAt };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chord-workbench', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close another Workbench tab to allow local storage to open.'));
  });
}

export async function readDraft(): Promise<Draft | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readonly');
    const request = transaction.objectStore('drafts').get('current');
    transaction.oncomplete = () => {
      db.close();
      try { resolve(request.result ? validateDraft(request.result) : null); } catch (error) { reject(error); }
    };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

let writeQueue: Promise<void> = Promise.resolve();
export function saveDraft(draft: Draft): Promise<void> {
  const checked = validateDraft(draft);
  const next = writeQueue.catch(() => {}).then(async () => {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite');
      transaction.objectStore('drafts').put(checked, 'current');
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  });
  writeQueue = next;
  return next;
}
