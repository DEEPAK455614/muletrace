import React, { Suspense, lazy, useMemo } from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { analyze, analyzeWorld, type Analysis } from './engine';
import type { World } from './engine/types';
import type { ImportResult } from './engine/import';
import { setActiveDatasetScope } from './state/dataset';
import { LayoutDashboard, Bell, Network, GitBranch, FileWarning, FlaskConical, BookOpen, Menu, X, History, Upload, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ToastProvider } from './ui';
import { GlobalSearchModal } from './components/GlobalSearchModal';

const Overview = lazy(() => import('./pages/Overview'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Account360 = lazy(() => import('./pages/Account360'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const Trails = lazy(() => import('./pages/Trails'));
const Complaints = lazy(() => import('./pages/Complaints'));
const Evaluation = lazy(() => import('./pages/Evaluation'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Audit = lazy(() => import('./pages/Audit'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const ImportData = lazy(() => import('./pages/ImportData'));

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const INVESTIGATION_NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/network', label: 'Network intelligence', icon: Network },
  { to: '/alerts', label: 'Alert queue', icon: Bell },
  { to: '/trails', label: 'Money trails', icon: GitBranch },
  { to: '/complaints', label: 'Complaints', icon: FileWarning },
  { to: '/audit', label: 'Audit trail', icon: History },
];
const UTILITY_NAV: NavItem[] = [
  { to: '/evaluation', label: 'Evaluation', icon: FlaskConical },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
  { to: '/import', label: 'Import data', icon: Upload },
];
const NAV: NavItem[] = [...INVESTIGATION_NAV, ...UTILITY_NAV];

type DatasetState =
  | { kind: 'synthetic' }
  | { kind: 'uploaded'; world: World; fileName: string; stats: ImportResult['stats']; scope: string };

function Brand({ uploaded, fileName }: { uploaded: boolean; fileName?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <Link to="/" className="flex items-center gap-3 no-underline">
        <div className="w-8 h-8 rounded-sm flex items-center justify-center border border-brand text-brand bg-brand-soft">
          <GitBranch size={17} strokeWidth={1.8} />
        </div>
        <div>
          <div className="text-[17px] font-semibold leading-4 tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>Surag</div>
          <div className="text-[10px] text-ink-mute leading-3 mt-1">Financial crime intelligence</div>
        </div>
      </Link>
      {uploaded ? (
        <Link to="/import" className="demo-pill demo-pill-uploaded no-print" title={`Uploaded dataset${fileName ? ` (${fileName})` : ''} - unverified, not validated banking data. Scores rank suspicion for human review, never proof of guilt.`}>
          Uploaded data · unverified
        </Link>
      ) : (
        <Link to="/methodology" className="demo-pill no-print" title="Synthetic demonstration dataset - no real banking data. Scores rank suspicion for human review, never proof of guilt.">
          Demo · synthetic data
        </Link>
      )}
    </div>
  );
}

function NavItems({ items, alertCount, onNavigate }: { items: typeof NAV; alertCount: number; onNavigate?: () => void }) {
  return (
    <>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => `navpill ${isActive ? 'active' : ''}`}>
          <Icon size={15} strokeWidth={1.8} />
          <span>{label}</span>
          {label === 'Alert queue' && <span className="ml-auto num text-[11px] text-risk-high">{alertCount}</span>}
        </NavLink>
      ))}
    </>
  );
}

export default function App() {
  const [dataset, setDataset] = React.useState<DatasetState>({ kind: 'synthetic' });
  const a: Analysis = useMemo(() => (dataset.kind === 'synthetic' ? analyze() : analyzeWorld(dataset.world)), [dataset]);
  const uploaded = dataset.kind === 'uploaded';
  React.useEffect(() => { setActiveDatasetScope(uploaded ? dataset.scope : 'synthetic'); }, [dataset, uploaded]);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const fmtM = (ts: number) => new Date(ts).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const windowLabel = uploaded ? `${fmtM(a.world.windowStart)} - ${fmtM(a.world.windowEnd)} (uploaded)` : 'Jan-Oct 2026';
  const alertCount = useMemo(() => [...a.scores.values()].filter((s) => s.score >= 45).length, [a]);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen((prev) => !prev); }
      else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-paper">
        <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} a={a} />
        <div className="sticky top-0 z-40 md:static md:z-auto bg-rail border-b border-line md:border-b-0">
          <div className="no-print md:hidden">
            <div className="flex items-center justify-between px-3 h-[58px]">
              <Brand uploaded={uploaded} fileName={uploaded ? dataset.fileName : undefined} />
              <div className="flex items-center gap-1.5">
                <button className="btn !min-h-0 !p-2" onClick={() => setSearchOpen(true)} aria-label="Search accounts" title="Search accounts"><Search size={16} /></button>
                <button className="btn !min-h-0 !p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
              </div>
            </div>
            {menuOpen && <div className="px-2 py-2 grid grid-cols-2 gap-1 bg-rail"><NavItems items={NAV} alertCount={alertCount} onNavigate={() => setMenuOpen(false)} /></div>}
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          <aside className="no-print hidden md:flex flex-col w-[238px] shrink-0 bg-rail border-r border-line px-3 py-5 sticky top-0 h-screen">
            <div className="px-2 pb-4 border-b border-line"><Brand uploaded={uploaded} fileName={uploaded ? dataset.fileName : undefined} /></div>
            <button onClick={() => setSearchOpen(true)} className="flex items-center justify-between w-full px-3 py-2.5 mt-4 text-[12px] rounded-sm border border-line bg-surface text-ink-soft hover:text-ink hover:border-brand/50 transition-colors cursor-pointer" title="Search accounts (⌘K or /)">
              <span className="flex items-center gap-2"><Search size={14} /><span>Search accounts</span></span>
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-line text-ink-mute">⌘K</kbd>
            </button>
            <nav className="pt-5 space-y-1">
              <div className="px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-ink-mute">Investigation</div>
              <NavItems items={INVESTIGATION_NAV} alertCount={alertCount} />
              <div className="pt-6 px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-ink-mute">Utilities</div>
              <NavItems items={UTILITY_NAV} alertCount={alertCount} />
            </nav>
            <div className="sidebar-footer px-2 text-[11px] leading-relaxed text-ink-mute">
              <div className="text-ink-soft mb-1">Active dataset</div>
              <div className="num text-[10.5px]">{uploaded ? `uploaded · ${windowLabel}` : `synthetic · ${windowLabel}`}</div>
              <div className="mt-3">Scores rank suspicion for review. They are not findings of guilt.</div>
            </div>
          </aside>
          <main className="flex-1 min-w-0 px-4 md:px-8 py-5 md:py-7 pb-24 md:pb-12">
            <Suspense fallback={<div className="text-sm text-ink-mute py-16 text-center">Loading analysis…</div>}>
              <Routes>
                <Route path="/" element={<Overview a={a} />} />
                <Route path="/alerts" element={<Alerts a={a} />} />
                <Route path="/accounts/:id" element={<Account360 a={a} />} />
                <Route path="/network" element={<NetworkPage a={a} />} />
                <Route path="/trails" element={<Trails a={a} />} />
                <Route path="/complaints" element={<Complaints a={a} />} />
                <Route path="/audit" element={<Audit a={a} />} />
                <Route path="/evaluation" element={<Evaluation a={a} />} />
                <Route path="/methodology" element={<Methodology a={a} />} />
                <Route path="/import" element={<ImportData activeKind={dataset.kind} onWorld={(world, fileName, stats, scope) => setDataset({ kind: 'uploaded', world, fileName, stats, scope })} onReset={() => setDataset({ kind: 'synthetic' })} />} />
                <Route path="/report/account/:id" element={<ReportPage a={a} />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
