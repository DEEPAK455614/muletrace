import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge } from '../ui';
import { Search, X, Clock, ArrowRight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  a: Analysis;
}

export function GlobalSearchModal({ open, onClose, a }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Load recent account IDs from sessionStorage
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('surag_recent_accounts');
      if (stored) setRecentIds(JSON.parse(stored).slice(0, 5));
    } catch {
      // ignore
    }
  }, [open]);

  // Search results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches: { id: string; name: string; bank: string; archetype: string; score: number; band: string }[] = [];
    for (const [id, scoreObj] of a.scores.entries()) {
      const acc = a.world.accounts.find((x) => x.id === id);
      const cust = a.world.customers.find((c) => c.id === acc?.customerId);
      const name = cust?.name ?? id;
      const bank = acc?.bank ?? '';
      const archetype = scoreObj.archetype ?? '';

      if (
        id.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        bank.toLowerCase().includes(q) ||
        archetype.toLowerCase().includes(q)
      ) {
        matches.push({
          id,
          name,
          bank,
          archetype,
          score: scoreObj.score,
          band: scoreObj.band,
        });
      }
      if (matches.length >= 10) break;
    }
    return matches.sort((x, y) => y.score - x.score);
  }, [query, a]);

  const selectAccount = (id: string) => {
    // Record into recent accounts
    try {
      const existing = JSON.parse(sessionStorage.getItem('surag_recent_accounts') ?? '[]');
      const updated = [id, ...existing.filter((x: string) => x !== id)].slice(0, 8);
      sessionStorage.setItem('surag_recent_accounts', JSON.stringify(updated));
    } catch {
      // ignore
    }
    onClose();
    nav(`/accounts/${id}`);
  };

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        selectAccount(results[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content !max-w-[580px] p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Search size={18} className="text-ink-soft shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none outline-none text-ink text-[15px] placeholder:text-ink-mute"
            placeholder="Search accounts by ID (e.g. ACC-101), name, bank, or pattern…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-ink-mute hover:text-ink p-1 rounded transition-colors"
            >
              <X size={15} />
            </button>
          )}
          <span className="text-[11px] font-mono text-ink-mute px-1.5 py-0.5 rounded border border-line bg-surface/50">
            ESC
          </span>
        </div>

        {/* Results area */}
        <div className="max-h-[380px] overflow-y-auto p-2">
          {query && results.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
                Accounts ({results.length})
              </div>
              {results.map((r, i) => {
                const active = i === selectedIndex;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                      active ? 'bg-brand/15 border border-brand/30' : 'hover:bg-surface/60 border border-transparent'
                    }`}
                    onClick={() => selectAccount(r.id)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink truncate">{r.name}</span>
                        <span className="num text-[11px] text-ink-mute">{r.id}</span>
                        <span className="text-[11px] text-ink-soft">• {r.bank}</span>
                      </div>
                      <div className="text-[11px] text-ink-soft truncate mt-0.5">Pattern: {r.archetype}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ScoreBadge score={r.score} band={r.band} size="sm" />
                      <ArrowRight size={13} className="text-ink-mute" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {query && results.length === 0 && (
            <div className="py-8 text-center text-sm text-ink-mute">
              No accounts match "{query}".
            </div>
          )}

          {!query && recentIds.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-1.5">
                <Clock size={12} /> Recently Viewed
              </div>
              {recentIds.map((id) => {
                const acc = a.world.accounts.find((x) => x.id === id);
                const cust = a.world.customers.find((c) => c.id === acc?.customerId);
                const score = a.scores.get(id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer hover:bg-surface/60 transition-colors"
                    onClick={() => selectAccount(id)}
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{cust?.name ?? id}</div>
                      <div className="num text-[11px] text-ink-mute">{id} • {acc?.bank}</div>
                    </div>
                    {score && <ScoreBadge score={score.score} band={score.band} size="sm" />}
                  </div>
                );
              })}
            </div>
          )}

          {!query && recentIds.length === 0 && (
            <div className="py-8 text-center text-xs text-ink-mute leading-relaxed">
              Type an account ID or customer name to instantly inspect risk factors.<br />
              Use <kbd className="px-1 py-0.5 border border-line rounded text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 border border-line rounded text-[10px]">↓</kbd> to navigate, <kbd className="px-1 py-0.5 border border-line rounded text-[10px]">↵</kbd> to open.
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-surface/40 border-t border-line flex items-center justify-between text-[11px] text-ink-mute">
          <span>Global Investigation Search</span>
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> to navigate</span>
            <span><kbd className="font-mono">↵</kbd> to select</span>
            <span><kbd className="font-mono">esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
