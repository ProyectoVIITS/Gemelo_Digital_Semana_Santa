import React from 'react';

const IRT_CONFIG = [
  { max: 30,  label: 'NORMAL',        color: '#22c55e', bg: '#22c55e18' },
  { max: 55,  label: 'MODERADO',      color: '#84cc16', bg: '#84cc1618' },
  { max: 75,  label: 'CONGESTIONADO', color: '#f59e0b', bg: '#f59e0b18' },
  { max: 90,  label: 'CRÍTICO',       color: '#ef4444', bg: '#ef444418' },
  { max: 100, label: 'CERRADO',       color: '#7f1d1d', bg: '#7f1d1d40' },
];

export default function IRTBadge({ irt, size = 'md' }) {
  const cfg = IRT_CONFIG.find(c => irt <= c.max) || IRT_CONFIG[IRT_CONFIG.length - 1];
  const numSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl';

  return (
    <div className="flex flex-col items-center rounded px-2 py-1"
         style={{ background: cfg.bg, border: `1px solid ${cfg.color}44` }}>
      <span className={`${numSize} font-bold font-mono leading-none`} style={{ color: cfg.color }}>
        {irt}
      </span>
      <span className="text-[7px] tracking-widest uppercase mt-0.5" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}
