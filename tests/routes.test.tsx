import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { analyze } from '../src/engine';
import Overview from '../src/pages/Overview';
import Alerts from '../src/pages/Alerts';
import NetworkPage from '../src/pages/NetworkPage';
import Trails from '../src/pages/Trails';
import Complaints from '../src/pages/Complaints';
import Audit from '../src/pages/Audit';
import Evaluation from '../src/pages/Evaluation';
import Methodology from '../src/pages/Methodology';
import Account360 from '../src/pages/Account360';
import ReportPage from '../src/pages/ReportPage';

// Route-render regression: every page must render real markup from the real
// analysis. Width-only checks missed a full-app unmount on /methodology.
describe('route renders', () => {
  const a = analyze('muletrace-v1');
  const someAccount = a.world.accounts[0].id;
  const routed = (path: string, el: React.ReactElement) => (
    <MemoryRouter initialEntries={[path.replace(':id', someAccount)]}>
      <Routes><Route path={path} element={el} /></Routes>
    </MemoryRouter>
  );
  const pages: [string, React.ReactElement][] = [
    ['Overview', <Overview a={a} />],
    ['Alerts', <Alerts a={a} />],
    ['NetworkPage', <NetworkPage a={a} />],
    ['Trails', <Trails a={a} />],
    ['Complaints', <Complaints a={a} />],
    ['Audit', <Audit a={a} />],
    ['Evaluation', <Evaluation a={a} />],
    ['Methodology', <Methodology a={a} />],
    ['Account360', routed('/accounts/:id', <Account360 a={a} />)],
    ['ReportPage', routed('/report/account/:id', <ReportPage a={a} />)],
  ];
  for (const [name, el] of pages) {
    it(`${name} renders non-trivial markup`, () => {
      const html = renderToStaticMarkup(
        React.isValidElement(el) && (el as React.ReactElement).type === MemoryRouter ? el : <MemoryRouter>{el}</MemoryRouter>,
      );
      expect(html.length).toBeGreaterThan(400);
    });
  }
});
