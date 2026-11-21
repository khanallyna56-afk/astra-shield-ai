import { lazy, Suspense } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';

const Overview = lazy(() => import('./pages/Overview'));
const Space = lazy(() => import('./pages/Space'));
const Crew = lazy(() => import('./pages/Crew'));
const Decisions = lazy(() => import('./pages/Decisions'));
const Schedule = lazy(() => import('./pages/Schedule'));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LinearProgress />}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/space" element={<Space />} />
          <Route path="/crew" element={<Crew />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="*" element={<Overview />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
