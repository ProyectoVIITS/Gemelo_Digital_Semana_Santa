import React from 'react';
import { Link } from 'react-router-dom';
import { Map, Building2, Shield, Activity } from 'lucide-react';

const modules = [
  {
    title: 'Monitor NEXUS — Semana Santa 2026',
    subtitle: 'Sala de control virtual DITRA — 7 corredores, 33 peajes',
    description: 'Monitor multicanal de corredores críticos con mapa de Colombia, IRT en tiempo real, alertas globales y gráfica comparativa.',
    path: '/monitor',
    icon: Shield,
    accent: '#38bdf8',
    accentBg: 'rgba(56, 189, 248, 0.08)',
    accentBorder: 'rgba(56, 189, 248, 0.25)',
    status: 'Operativo',
    statusColor: '#22c55e',
    tags: ['7 corredores', '33 peajes', 'IRT tiempo real', 'DITRA'],
  },
  {
    title: 'Corredores Semana Santa 2026',
    subtitle: 'Predicción de congestiones en 4 corredores nacionales',
    description: 'Gemelo digital de tráfico vehicular con IRT, alertas inteligentes y simulación de flujo en tiempo real.',
    path: '/semana-santa',
    icon: Map,
    accent: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.08)',
    accentBorder: 'rgba(245, 158, 11, 0.25)',
    status: 'Operativo',
    statusColor: '#22c55e',
    tags: ['4 corredores', 'IRT predictivo', 'Alertas'],
  },
  {
    title: 'Gemelo Digital — Peaje Chuzacá',
    subtitle: 'Autopista Sur Km 14, Soacha, Cundinamarca',
    description: 'Monitoreo inteligente de infraestructura vial con cámaras PTZ, conteo vehicular y visualización 2.5D.',
    path: '/peaje-chuzaca',
    icon: Building2,
    accent: '#0ea5e9',
    accentBg: 'rgba(14, 165, 233, 0.08)',
    accentBorder: 'rgba(14, 165, 233, 0.25)',
    status: 'Piloto',
    statusColor: '#0ea5e9',
    tags: ['4 carriles', 'PTZ', 'CCTV', 'Tiempo real'],
  },
];

export default function ModuleSelector() {
  return (
    <div className="min-h-screen bg-viits-bg flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      {/* Header */}
      <div className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
          }}>
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide" style={{ color: '#0ea5e9', fontFamily: 'Space Mono, monospace' }}>
              VIITS NEXUS
            </h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-mono">
              Sistema de Gemelos Digitales Viales
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-slate-700" />
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            Instituto Nacional de Vías — Ministerio de Transporte de Colombia
          </p>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-slate-700" />
        </div>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full relative z-10">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.path}
              to={mod.path}
              className="group block rounded-xl border transition-all duration-300 hover:scale-[1.02]"
              style={{
                backgroundColor: mod.accentBg,
                borderColor: mod.accentBorder,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = mod.accent;
                e.currentTarget.style.boxShadow = `0 0 30px ${mod.accent}20, 0 0 60px ${mod.accent}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = mod.accentBorder;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="p-6">
                {/* Icon + Status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{
                    backgroundColor: `${mod.accent}15`,
                    border: `1px solid ${mod.accent}30`,
                  }}>
                    <Icon className="w-5 h-5" style={{ color: mod.accent }} />
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider" style={{
                    backgroundColor: `${mod.statusColor}15`,
                    color: mod.statusColor,
                    border: `1px solid ${mod.statusColor}30`,
                  }}>
                    <Activity className="w-3 h-3" />
                    {mod.status}
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-opacity-100">
                  {mod.title}
                </h2>
                <p className="text-xs font-mono mb-3" style={{ color: mod.accent }}>
                  {mod.subtitle}
                </p>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  {mod.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {mod.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2 py-0.5 rounded border"
                      style={{
                        borderColor: `${mod.accent}25`,
                        color: `${mod.accent}cc`,
                        backgroundColor: `${mod.accent}08`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Arrow */}
                <div className="mt-4 flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                  <span>Acceder al módulo</span>
                  <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center relative z-10">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
          VIITS-NEXUS v0.1-PILOT · Dirección Técnica y de Estructuración — INVÍAS
        </p>
      </div>
    </div>
  );
}
