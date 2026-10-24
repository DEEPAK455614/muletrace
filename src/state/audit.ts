// Browser-local, tamper-evident audit trail of analyst actions.
// Each entry carries the SHA-256 of its own canonical body, which includes the
// previous entry's hash - so editing or deleting a past entry breaks the chain.
// Demonstration-grade integrity (client-side storage), documented as such.

export type AuditEntry = {
  seq: number;
  ts: number;
  action: string;
  accountId?: string;
  detail: string;
  prevHash: string;
  hash: string;
};

const KEY = "ps01_audit_v1";
const GENESIS = "GENESIS";

const bodyOf = (e: Pick<AuditEntry, "seq" | "ts" | "action" | "accountId" | "detail" | "prevHash">): string =>
  JSON.stringify({ seq: e.seq, ts: e.ts, action: e.action, accountId: e.accountId, detail: e.detail, prevHash: e.prevHash });

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function loadAuditLog(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export async function appendAudit(action: string, detail: string, accountId?: string): Promise<void> {
  const log = loadAuditLog();
  const prevHash = log.length ? log[log.length - 1].hash : GENESIS;
  const entry: AuditEntry = { seq: log.length, ts: Date.now(), action, accountId, detail, prevHash, hash: "" };
  entry.hash = await sha256Hex(bodyOf(entry));
  log.push(entry);
  localStorage.setItem(KEY, JSON.stringify(log));
}

export type ChainCheck = { ok: boolean; checked: number; brokenAt?: number };

export async function verifyAuditChain(log: AuditEntry[]): Promise<ChainCheck> {
  let prev = GENESIS;
  for (const e of log) {
    if (e.prevHash !== prev) return { ok: false, checked: e.seq, brokenAt: e.seq };
    const h = await sha256Hex(bodyOf(e));
    if (h !== e.hash) return { ok: false, checked: e.seq, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, checked: log.length };
}

// Test hook: pure chain hashing for deterministic verification.
export const __auditInternals = { bodyOf, GENESIS };
