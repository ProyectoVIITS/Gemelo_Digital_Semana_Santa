import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import VIITSDashboard from './components/VIITSDashboard';
import ModuleSelector from './pages/ModuleSelector';
import ChuzacaDashboard from './pages/PeajeChuzaca';
import MonitorPage from './pages/Monitor';
import CorridorPage from './modules/corridor/CorridorPage';
import TollPage from './modules/toll/TollPage';
import WazeSegmentPage from './modules/waze/WazeSegmentPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ModuleSelector />} />
        <Route path="/semana-santa" element={<VIITSDashboard />} />
        <Route path="/peaje-chuzaca" element={<ChuzacaDashboard />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/monitor/waze/:wazeId" element={<WazeSegmentPage />} />
        <Route path="/monitor/:corridorId" element={<CorridorPage />} />
        <Route path="/monitor/:corridorId/:tollId" element={<TollPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
