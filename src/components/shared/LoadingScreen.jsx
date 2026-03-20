import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function LoadingScreen({ title, subtitle, color = '#0ea5e9', onComplete }) {
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  const PHASES = [
    { text: `Inicializando ${title}...`, pct: 20 },
    { text: 'Conectando sensores VIITS...', pct: 50 },
    { text: 'Cargando datos en tiempo real...', pct: 80 },
    { text: 'Sistema listo', pct: 100 },
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1300),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setFadeOut(true), 2300),
      setTimeout(() => onComplete && onComplete(), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete, title]);

  const current = PHASES[phase];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: '#040810', opacity: fadeOut ? 0 : 1, transition: 'opacity 0.3s ease' }}>

      {/* Grid background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(${color}08 1px, transparent 1px), linear-gradient(90deg, ${color}08 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          transform: `scale(${1 + phase * 0.05})`,
          transition: 'transform 1s ease',
        }} />
      </div>

      {/* Logo + Text */}
      <div className="relative z-10 flex flex-col items-center" style={{ opacity: 1, transition: 'opacity 0.5s ease' }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}88)`, boxShadow: `0 0 40px ${color}40` }}>
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-widest mb-1" style={{ color, fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-600 mb-1">{subtitle}</p>
        )}
        <p className="text-xs font-mono text-slate-500 mb-8">VIITS NEXUS · DITRA · INVÍAS</p>

        {/* Progress bar */}
        <div className="w-64 h-1 rounded-full bg-slate-900 overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-500 ease-out" style={{
            width: `${current.pct}%`,
            background: current.pct === 100 ? '#22c55e' : `linear-gradient(90deg, ${color}, ${color}88)`,
          }} />
        </div>
        <p className="text-xs font-mono" style={{ color: current.pct === 100 ? '#22c55e' : '#475569' }}>
          {current.text}
        </p>
      </div>

      <div className="absolute bottom-6 text-[9px] font-mono text-slate-800 text-center">
        Dirección Técnica de Carreteras · Instituto Nacional de Vías · Ministerio de Transporte
      </div>
    </div>
  );
}
