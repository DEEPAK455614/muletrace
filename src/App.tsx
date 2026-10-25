import React, { Suspense, lazy, useMemo } from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { analyze, analyzeWorld, type Analysis } from './engine';
import type { World } from './engine/types';
import type { ImportResult } from './engine/import';
import { setActiveDatasetScope } from './state/dataset';
import { LayoutDashboard, Bell, Network, GitBranch, FileWarning, FlaskConical, BookOpen, Menu, X, ShieldCheck, History, Upload, Server } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';

const Workbench = lazy(() => import('./pages/Workbench'));
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
const PlatformWorkspace = lazy(() => import('./pages/platform/Workspace'));
const PlatformUpload = lazy(() => import('./pages/platform/UploadWizard'));
const PlatformTraining = lazy(() => import('./pages/platform/Training'));
const PlatformAnalyse = lazy(() => import('./pages/platform/AnalyseLauncher'));
const PlatformRun = lazy(() => import('./pages/platform/RunDashboard'));
const PlatformTrail = lazy(() => import('./pages/platform/MoneyTrailApi'));
const PlatformFindings = lazy(() => import('./pages/platform/FindingsApi'));

const NAV = [
  { to: '/', label: 'Workbench', icon: LayoutDashboard, end: true },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/network', label: 'Network', icon: Network },
  { to: '/trails', label: 'Money trails', icon: GitBranch },
  { to: '/complaints', label: 'Complaints', icon: FileWarning },
  { to: '/audit', label: 'Audit trail', icon: History },
  { to: '/evaluation', label: 'Evaluation', icon: FlaskConical },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
  { to: '/import', label: 'Import data', icon: Upload },
  { to: '/platform', label: 'Platform (API)', icon: Server, end: true },
];

function Brand({ uploaded, fileName }: { uploaded: boolean; fileName?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
          <ShieldCheck size={17} color="#fff" strokeWidth={2.2} />
        </div>
        <div>
          <div className="text-[16px] font-bold leading-4 tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>Surag</div>
          <div className="text-[10px] font-medium text-ink-mute leading-3 mt-0.5">Financial crime intelligence</div>
        </div>
      </Link>
      {uploaded ? (
        <Link to="/import" className="demo-pill demo-pill-uploaded no-print" title={`Uploaded dataset${fileName ? ` (${fileName})` : ''} - unverified, not validated banking data. Scores rank suspicion for human review, never proof of guilt. No accuracy benchmark exists for unlabelled data.`}>
          Uploaded data - unverified
        </Link>
      ) : (
        <Link to="/methodology" className="demo-pill no-print" title="Synthetic demonstration dataset - no real banking data. Scores indicate suspicion for investigation, never proof of guilt. Details in Methodology.">
          Demo - Synthetic data
        </Link>
      )}
    </div>
  );
}

type DatasetState =
  | { kind: 'synthetic' }
  | { kind: 'uploaded'; world: World; fileName: string; stats: ImportResult['stats']; scope: string };

export default function App() {
  const [dataset, setDataset] = React.useState<DatasetState>({ kind: 'synthetic' });
  const a: Analysis = useMemo(
    () => (dataset.kind === 'synthetic' ? analyze() : analyzeWorld(dataset.world)),
    [dataset],
  );
  const uploaded = dataset.kind === 'uploaded';
  React.useEffect(() => {
    setActiveDatasetScope(uploaded ? dataset.scope : 'synthetic');
  }, [dataset, uploaded]);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const fmtM = (ts: number) => new Date(ts).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const windowLabel = uploaded
    ? `${fmtM(a.world.windowStart)} - ${fmtM(a.world.windowEnd)} (uploaded)`
    : 'Jan-Oct 2026';
  const alertCount = useMemo(() => [...a.scores.values()].filter((s) => s.score >= 45).length, [a]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-40 md:static md:z-auto bg-surface">
        {/* Mobile top bar */}
        <div className="no-print md:hidden">
          <div className="flex items-center justify-between px-3 h-[52px]">
            <Brand uploaded={uploaded} fileName={uploaded ? dataset.fileName : undefined} />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button className="btn !p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="px-2 py-2 grid grid-cols-2 gap-1">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `navpill !py-2.5 ${isActive ? 'active' : ''}`}>
                  <Icon size={15} /> {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - desktop */}
        <aside className="no-print hidden md:flex flex-col w-[218px] shrink-0 px-3 py-5 gap-[3px] sticky top-0 h-screen">
          <div className="px-1 pb-4 flex items-center justify-between gap-2">
            <Brand uploaded={uploaded} fileName={uploaded ? dataset.fileName : undefined} />
            <ThemeToggle />
          </div>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `navpill ${isActive ? 'active' : ''}`}>
              <Icon size={16} strokeWidth={2} />
              {label}
              {label === 'Alerts' && (
                <span className="ml-auto num text-[10px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: '#FF4D5E18', color: 'var(--color-risk-crit)' }}>{alertCount}</span>
              )}
            </NavLink>
          ))}
          <div className="mt-auto pt-4 border-t border-[#1A2537]">
            <div className="text-[10.5px] text-ink-mute px-2 leading-relaxed">
              Analysis window: {windowLabel}<br />
              Engine built in {a.buildMs.toFixed(0)} ms<br />
              <a href="https://sahajsolutions.org" target="_blank" rel="noreferrer" className="text-ink-mute no-underline hover:text-brand mt-1 inline-block">Developed by Sahaj Solutions</a>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 px-4 md:px-7 py-5 md:py-6 pb-24 md:pb-10">
          <Suspense fallback={<div className="text-sm text-ink-mute py-16 text-center">Loading analysis…</div>}>
            <Routes>
              <Route path="/" element={<Workbench a={a} uploaded={dataset.kind === 'uploaded'} />} />
              <Route path="/overview" element={<Overview a={a} />} />
              <Route path="/alerts" element={<Alerts a={a} />} />
              <Route path="/accounts/:id" element={<Account360 a={a} />} />
              <Route path="/network" element={<NetworkPage a={a} />} />
              <Route path="/trails" element={<Trails a={a} />} />
              <Route path="/complaints" element={<Complaints a={a} />} />
              <Route path="/audit" element={<Audit a={a} />} />
              <Route path="/evaluation" element={<Evaluation a={a} />} />
              <Route path="/methodology" element={<Methodology a={a} />} />
              <Route path="/import" element={<ImportData
                activeKind={dataset.kind}
                onWorld={(world, fileName, stats, scope) => setDataset({ kind: 'uploaded', world, fileName, stats, scope })}
                onReset={() => setDataset({ kind: 'synthetic' })} />} />
              <Route path="/report/account/:id" element={<ReportPage a={a} />} />
              <Route path="/platform" element={<PlatformWorkspace />} />
              <Route path="/platform/upload" element={<PlatformUpload />} />
              <Route path="/platform/training" element={<PlatformTraining />} />
              <Route path="/platform/analyse/:datasetId" element={<PlatformAnalyse />} />
              <Route path="/platform/runs/:runId" element={<PlatformRun />} />
              <Route path="/platform/runs/:runId/trail" element={<PlatformTrail />} />
              <Route path="/platform/runs/:runId/findings" element={<PlatformFindings />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
