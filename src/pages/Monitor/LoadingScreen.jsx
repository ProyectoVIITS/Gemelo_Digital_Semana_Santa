import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

const PHASES = [
  { text: 'Cargando inventario de peajes INVÍAS...', pct: 20 },
  { text: 'Inicializando corredores (7/7)...', pct: 50 },
  { text: 'Conectando sensores VIITS...', pct: 80 },
  { text: 'Sistema listo', pct: 100 },
];

export default function MonitorLoadingScreen({ onComplete }) {
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1300),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setFadeOut(true), 2300),
      setTimeout(() => onComplete(), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const current = PHASES[phase];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: '#040810', opacity: fadeOut ? 0 : 1, transition: 'opacity 0.3s ease' }}>

      {/* Grid background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(14, 165, 233, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          transform: `scale(${1 + phase * 0.05})`,
          transition: 'transform 1s ease',
        }} />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center" style={{ opacity: phase >= 0 ? 1 : 0, transition: 'opacity 0.5s ease' }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', boxShadow: '0 0 40px rgba(56,189,248,0.25)' }}>
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-widest mb-1" style={{ color: '#0ea5e9', fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
          VIITS NEXUS
        </h1>
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-600 mb-1">
          Monitor de Corredores
        </p>
        <p className="text-xs font-mono text-slate-500 mb-8">
          Semana Santa 2026 · DITRA · 7 Corredores · 33 Peajes
        </p>

        {/* Progress bar */}
        <div className="w-64 h-1 rounded-full bg-slate-900 overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-500 ease-out" style={{
            width: `${current.pct}%`,
            background: current.pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #0ea5e9, #6366f1)',
          }} />
        </div>

        <p className="text-xs font-mono" style={{ color: current.pct === 100 ? '#22c55e' : '#475569', transition: 'color 0.3s ease' }}>
          {current.text}
        </p>
      </div>

      <div className="absolute bottom-6 text-[9px] font-mono text-slate-800 text-center">
        Dirección Técnica de Carreteras · Instituto Nacional de Vías · Ministerio de Transporte
      </div>
    </div>
  );
}
