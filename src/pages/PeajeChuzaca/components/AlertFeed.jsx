import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { timeAgo } from '../lib/utils';

const SEVERITY = {
  critical: { icon: AlertCircle, bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' },
  warning:  { icon: AlertTriangle, bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' },
  info:     { icon: Info, bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.3)', color: '#0ea5e9' },
};

export default function AlertFeed({ alerts }) {
  return (
    <div className="rounded-lg border p-3 flex flex-col" style={{ backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Eventos en Tiempo Real</span>
        <span className="text-[10px] font-mono text-slate-600">{alerts.filter(a => !a.resolved).length} activas</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-[320px] pr-1" style={{ scrollbarWidth: 'thin' }}>
        {alerts.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">Sin alertas recientes</p>
        )}
        {alerts.slice(0, 12).map((alert) => {
          const sev = SEVERITY[alert.severity] || SEVERITY.info;
          const Icon = alert.resolved ? CheckCircle : sev.icon;
          return (
            <div key={alert.id}
              className="rounded p-2 border text-xs flex items-start gap-2"
              style={{
                backgroundColor: alert.resolved ? 'rgba(30, 41, 59, 0.3)' : sev.bg,
                borderColor: alert.resolved ? '#1e293b' : sev.border,
                opacity: alert.resolved ? 0.5 : 1,
                animation: !alert.resolved ? 'slideIn 0.3s ease-out' : undefined,
              }}>
              <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: alert.resolved ? '#22c55e' : sev.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-300 leading-snug">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1 py-px rounded text-[9px] font-mono" style={{
                    backgroundColor: 'rgba(100, 116, 139, 0.2)',
                    color: '#64748b',
                  }}>
                    {alert.source}
                  </span>
                  {alert.lane && <span className="text-[9px] text-slate-600">Carril {alert.lane}</span>}
                  <span className="text-[9px] text-slate-600 ml-auto" title={alert.timestamp.toLocaleString('es-CO')}>
                    {timeAgo(alert.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
