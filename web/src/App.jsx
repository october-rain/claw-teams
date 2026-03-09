import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import ChatPage from './pages/ChatPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ConfigPage from './pages/ConfigPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import RunsPage from './pages/RunsPage.jsx';

export default function App() {
  return (
    <div className="layout">
      <Nav />
      <main className="main-shell">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
