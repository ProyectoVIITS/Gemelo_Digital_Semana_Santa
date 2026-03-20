import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

const TYPE_CONFIG = {
  peaje: { label: 'PEAJE', symbol: 'P', bg: '#f59e0b', border: '#d97706' },
  via: { label: 'VÍA', symbol: '!', bg: '#f97316', border: '#ea580c' },
  salida: { label: 'SALIDA', symbol: 'S', bg: '#ef4444', border: '#dc2626' },
  tunel: { label: 'TÚNEL', symbol: 'T', bg: '#8b5cf6', border: '#7c3aed' },
};

function createBlockageIcon(point, irt, isPulsing) {
  const cfg = TYPE_CONFIG[point.type] || TYPE_CONFIG.via;
  const localIRT = Math.min(Math.round(irt * (1 + point.capacityReduction)), 100);
  const barWidth = Math.min(localIRT, 100);
  const barColor = localIRT > 85 ? '#ef4444' : localIRT > 65 ? '#f97316' : '#f59e0b';

  const html = `
    <div class="blockage-marker ${isPulsing ? 'blockage-pulse' : ''}" style="
      display:flex; flex-direction:column; align-items:center; gap:2px;
    ">
      <div style="
        width:22px; height:22px; border-radius:${point.type === 'tunel' ? '50%' : '4px'};
        ${point.type === 'via' ? 'transform:rotate(45deg);' : ''}
        background:${cfg.bg}; border:2px solid ${cfg.border};
        display:flex; align-items:center; justify-content:center;
        font-size:10px; font-weight:800; color:#fff; font-family:Inter,sans-serif;
        box-shadow: 0 0 ${isPulsing ? '12px' : '4px'} ${cfg.bg}80;
      ">
        <span style="${point.type === 'via' ? 'transform:rotate(-45deg);' : ''}">${cfg.symbol}</span>
      </div>
      <div style="
        width:36px; height:4px; background:#1e293b; border-radius:2px; overflow:hidden;
        border:1px solid #334155;
      ">
        <div style="width:${barWidth}%; height:100%; background:${barColor}; border-radius:2px;"></div>
      </div>
      <div style="
        font-size:8px; color:#94a3b8; font-family:'Space Mono',monospace;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      ">${cfg.label}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [40, 44],
    iconAnchor: [20, 22],
  });
}

export default function BlockageMarkers({ corridor, irt }) {
  if (!corridor || !corridor.blockagePoints || irt <= 45) return null;

  const isPulsing = irt > 70;

  return (
    <>
      {corridor.blockagePoints.map(point => {
        const localIRT = Math.min(Math.round(irt * (1 + point.capacityReduction)), 100);
        return (
          <Marker
            key={point.name}
            position={point.coords}
            icon={createBlockageIcon(point, irt, isPulsing)}
            zIndexOffset={1000}
          >
            <Tooltip
              direction="top"
              offset={[0, -28]}
              className="viits-tooltip"
            >
              <div style={{ minWidth: '160px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '3px' }}>
                  {point.name}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                  {point.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span style={{ color: '#64748b' }}>IRT local:</span>
                  <span style={{ color: localIRT > 80 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                    {localIRT}/100
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span style={{ color: '#64748b' }}>Reducción capacidad:</span>
                  <span style={{ color: '#f97316', fontWeight: 600 }}>
                    -{Math.round(point.capacityReduction * 100)}%
                  </span>
                </div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
