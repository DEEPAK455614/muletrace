// Investigator triage state, persisted in localStorage (demo-scale case management).
import { appendAudit } from './audit';
import { scopedKey } from './dataset';

export type TriageStatus = 'new' | 'review' | 'escalated' | 'cleared';
export interface TriageEntry { status: TriageStatus; note: string; updatedAt: number }

const KEY = 'muletrace.triage.v1';

export function loadTriage(): Record<string, TriageEntry> {
  try { return JSON.parse(localStorage.getItem(scopedKey(KEY)) ?? '{}'); } catch { return {}; }
}
export function saveTriageEntry(accountId: string, entry: TriageEntry) {
  const all = loadTriage();
  all[accountId] = entry;
  localStorage.setItem(scopedKey(KEY), JSON.stringify(all));
  void appendAudit('TRIAGE_STATUS', `status -> ${entry.status}${entry.note ? ' (note)' : ''}`, accountId);
}
export const TRIAGE_LABELS: Record<TriageStatus, string> = {
  new: 'New', review: 'In review', escalated: 'Escalated', cleared: 'Cleared',
};
export const TRIAGE_COLORS: Record<TriageStatus, string> = {
  new: '#5E7191', review: '#4F8CFF', escalated: '#FF4D5E', cleared: '#2FD48C',
};
