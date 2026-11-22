import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import './styles/app.css';
import { Layout } from './components/Layout.js';
import { SessionProvider } from './session.js';
import { Home } from './pages/Home.js';
import { Auth } from './pages/Auth.js';
import { Disciplines } from './pages/Disciplines.js';
import { TeacherDashboard } from './pages/TeacherDashboard.js';
import { StudentDashboard } from './pages/StudentDashboard.js';
import { SmartSetup } from './pages/SmartSetup.js';
import { Info } from './pages/Info.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/accedi" element={<Auth />} />
            <Route path="/discipline" element={<Disciplines />} />
            <Route path="/docente" element={<TeacherDashboard />} />
            <Route path="/allievo" element={<StudentDashboard />} />
            <Route path="/setup" element={<SmartSetup />} />
            <Route path="/info" element={<Info />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
