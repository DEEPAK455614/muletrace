// Typed client for the MULE DRISHTI FastAPI backend (SRS section 8).
// Base URL comes from VITE_API_BASE; local default matches the documented backend.
// When the API is unreachable, screens show an honest unavailable state - never mock data.
const BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'api_unreachable',
      `Cannot reach the MuleTrace API at ${BASE}. This hosted preview serves the frontend only - ` +
      `the integrated import/train/analyse/report flow runs locally: start the backend ` +
      `(cd backend && uvicorn app.main:app) and set VITE_API_BASE if it is not ${BASE}. ` +
      `No sample data is substituted.`);
  }
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!r.ok) {
    const err = body?.error;
    throw new ApiError(r.status, err?.code ?? 'request_failed',
      err?.message ?? `Request failed with status ${r.status}.`);
  }
  return body as T;
}

export interface DatasetRow {
  id: string; name: string; source_type: string; provenance: string; checksum: string;
  currency: string; status: string; row_counts: Record<string, number>; created_at: string | null;
}
export interface ValidateResult {
  checksum: string; valid: boolean; headers?: string[]; suggested_mapping?: Record<string, string>;
  row_count?: number; sample?: { row: number; ok: boolean; values: Record<string, string> }[];
  sample_invalid?: number; issues: { level: string; message: string }[]; file_name?: string;
}
export interface ModelRow { id: string; training_run_id: string; feature_version: string; active: boolean; created_at: string }
export interface RunSummary {
  accounts_analysed: number; band_distribution?: Record<string, number>; findings_created?: number;
  method?: string; scoring_version?: string; rules_version?: string; limitations?: string[];
}
export interface AnalysisRunRow {
  id: string; dataset_id: string; model_version_id: string | null; status: string;
  started_at: string; completed_at: string | null; summary: RunSummary;
}
export interface Assessment {
  account_ref: string; account_id: string; score: number; band: string; method: string;
  indicators: { features?: Record<string, number>; rules?: { rule: string; reason: string; evidence_txn_refs: string[] }[]; model_output?: number | null };
  warnings: string[];
}
export interface GraphEdge { source: string; target: string; txn_ref: string; amount: number; currency: string; ts: string }
export interface GraphSlice { nodes: { id: string; external_ref: string }[]; edges: GraphEdge[]; truncated: boolean; honest_empty: boolean; note: string }
export interface TraceStep { from_ref: string; to_ref: string; txn_ref: string; amount: number; ts: string }
export interface TraceResult { origin: { external_ref: string }; direction: string; max_hops: number; paths: TraceStep[][]; path_count: number; paths_capped: boolean; note: string }
export interface FindingRow {
  id: string; type: string; severity: string; title: string; explanation: string; status: string;
  evidence: { account_ref?: string; txn_refs?: string[] }; created_at: string;
}
export interface TrainingRunRow {
  id: string; dataset_ids: string[]; algorithm: string; feature_version: string;
  metrics: Record<string, any>; status: string; created_at: string;
}

export const api = {
  base: BASE,
  health: () => req<{ status: string; database: boolean }>('/health'),
  datasets: () => req<{ datasets: DatasetRow[] }>('/api/v1/datasets'),
  validate: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return req<ValidateResult>('/api/v1/datasets/validate', { method: 'POST', body: fd });
  },
  importDataset: (file: File, payload: { file_name: string; mapping: Record<string, string>; source_type: string; name: string; currency: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('payload', JSON.stringify(payload));
    return req<{ dataset_id: string; batch_id: string; accepted: number; rejected: number; duplicates: number }>(
      '/api/v1/datasets/import', { method: 'POST', body: fd });
  },
  trainingRuns: () => req<{ training_runs: TrainingRunRow[] }>('/api/v1/training-runs'),
  train: (dataset_ids: string[], algorithm: string, parameters: Record<string, unknown>) =>
    req<TrainingRunRow>('/api/v1/training-runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_ids, algorithm, parameters }),
    }),
  models: () => req<{ models: ModelRow[] }>('/api/v1/models'),
  analysisRuns: () => req<{ analysis_runs: AnalysisRunRow[] }>('/api/v1/analysis-runs'),
  startAnalysis: (dataset_id: string, model_version_id?: string) =>
    req<AnalysisRunRow>('/api/v1/analysis-runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model_version_id ? { dataset_id, model_version_id } : { dataset_id }),
    }),
  run: (id: string) => req<AnalysisRunRow>(`/api/v1/analysis-runs/${id}`),
  assessments: (id: string, band?: string) =>
    req<{ count: number; assessments: Assessment[] }>(`/api/v1/analysis-runs/${id}/assessments${band ? `?band=${band}` : ''}`),
  graph: (id: string, limit = 300) => req<GraphSlice>(`/api/v1/analysis-runs/${id}/graph?limit=${limit}`),
  trace: (id: string, p: { account_ref: string; direction: string; max_hops: number; min_amount?: number }) => {
    const q = new URLSearchParams({ account_ref: p.account_ref, direction: p.direction, max_hops: String(p.max_hops) });
    if (p.min_amount != null) q.set('min_amount', String(p.min_amount));
    return req<TraceResult>(`/api/v1/analysis-runs/${id}/trace?${q}`);
  },
  findings: (id: string) => req<{ count: number; findings: FindingRow[] }>(`/api/v1/analysis-runs/${id}/findings`),
  setFindingStatus: (id: string, status: string) =>
    req<{ id: string; status: string }>(`/api/v1/findings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    }),
  addNote: (id: string, note: string) =>
    req<{ id: string }>(`/api/v1/findings/${id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }),
    }),
  reportUrl: (id: string) => `${BASE}/api/v1/analysis-runs/${id}/report.pdf`,
};
