// Investigator triage state, persisted in localStorage (demo-scale case management).
export type TriageStatus = 'new' | 'review' | 'escalated' | 'cleared';
export interface TriageEntry { status: TriageStatus; note: string; updatedAt: number }

const KEY = 'muletrace.triage.v1';

export function loadTriage(): Record<string, TriageEntry> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
export function saveTriageEntry(accountId: string, entry: TriageEntry) {
  const all = loadTriage();
  all[accountId] = entry;
  localStorage.setItem(KEY, JSON.stringify(all));
}
export const TRIAGE_LABELS: Record<TriageStatus, string> = {
  new: 'New', review: 'In review', escalated: 'Escalated', cleared: 'Cleared',
};
export const TRIAGE_COLORS: Record<TriageStatus, string> = {
  new: '#667085', review: '#3B4BD8', escalated: '#D92D20', cleared: '#1F9D6B',
};
