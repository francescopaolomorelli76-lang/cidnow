import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router';
// Font con licenza libera (OFL), inclusi nell'app: nessuna richiesta a servizi esterni.
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '@fontsource/cinzel/latin-500.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import './styles/app.css';
import { Layout } from './components/Layout.js';
import { SessionProvider } from './session.js';
import { Home } from './pages/Home.js';
import { Auth } from './pages/Auth.js';
import { DisciplineDetail, Disciplines } from './pages/Disciplines.js';
import { LessonRoom } from './pages/LessonRoom.js';
import { TeacherDashboard } from './pages/TeacherDashboard.js';
import { StudentDashboard } from './pages/StudentDashboard.js';
import { SmartSetup } from './pages/SmartSetup.js';
import { Info } from './pages/Info.js';
import { IS_DEMO } from './demo/env.js';
import { DemoBanner } from './demo/DemoBanner.js';
import { installMockApi } from './demo/mockApi.js';

// Demo online: niente server, API simulata nel browser e navigazione interna (la pagina ospite non gestisce i percorsi).
if (IS_DEMO) installMockApi();
const Router = IS_DEMO ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <SessionProvider>
        <Layout>
          {IS_DEMO && <DemoBanner />}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/accedi" element={<Auth />} />
            <Route path="/discipline" element={<Disciplines />} />
            <Route path="/discipline/:id" element={<DisciplineDetail />} />
            <Route path="/lezione" element={<LessonRoom />} />
            <Route path="/docente" element={<TeacherDashboard />} />
            <Route path="/allievo" element={<StudentDashboard />} />
            <Route path="/setup" element={<SmartSetup />} />
            <Route path="/info" element={<Info />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </SessionProvider>
    </Router>
  </StrictMode>,
);
