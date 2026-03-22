/**
 * TollStationCard — Tarjeta autónoma de peaje con mini-canvas
 * Cada tarjeta tiene su propio useTollData — datos independientes por peaje
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import useTollData from '../../toll/hooks/useTollData';
import TollCanvas from '../../toll/components/TollCanvas';
import { getOperationMode } from '../../../utils/operationMode';

export default function TollStationCard({ corridor, toll }) {
  // ★ Cada tarjeta tiene su propio hook — datos independientes por peaje
  const data = useTollData(toll.id, corridor.id);
  const irt = data.metrics.irt || 0;
  const irtColor = irt > 75 ? '#ef4444' : irt > 55 ? '#f59e0b' : irt > 30 ? '#84cc16' : '#22c55e';

  return (
    <div className="flex flex-col rounded-lg border overflow-hidden transition-all duration-200 hover:shadow-lg"
         style={{
           borderColor: corridor.color + '33',
           background: '#0d1a2e',
         }}
         onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 16px ${corridor.color}22`)}
         onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>

      {/* Header de la tarjeta */}
      <div className="flex items-center justify-between px-3 py-2 border-b"
           style={{ borderColor: corridor.color + '22', background: '#090f1c' }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-200">{toll.name}</span>
            {toll.isCritical && (
              <AlertTriangle className="w-3 h-3 text-[#ef4444]" />
            )}
          </div>
          <span className="text-[8px] text-[#475569]">{toll.km} · {toll.department}</span>
        </div>
        {/* IRT badge */}
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-none" style={{ color: irtColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {irt}
          </span>
          <span className="text-[7px] text-[#475569]">IRT</span>
        </div>
      </div>

      {/* ★ Mini-canvas autónomo del peaje */}
      <TollCanvas
        mode="mini"
        stationName={toll.name}
        corridorColor={corridor.color}
        lanes={data.lanes}
        metrics={data.metrics}
        showHeader={false}
        showMetrics={true}
        direction={getOperationMode().mode}
      />

      {/* Vista satelital del peaje */}
      <div className="border-t" style={{ borderColor: corridor.color + '22' }}>
        <iframe
          src={
            toll.streetViewUrl ||
            `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d400!2d${toll.lng}!3d${toll.lat}!2m3!1f0!2f0!3f0!3m2!1i400!2i180!4f13.1!5e1!3m2!1ses!2sco!4v1`
          }
          width="100%" height="130"
          style={{ border: 'none', display: 'block', filter: 'brightness(0.8) saturate(0.8)' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={toll.name}
        />
      </div>

      {/* Footer — enlace al módulo completo del peaje */}
      <Link
        to={`/monitor/${corridor.id}/${toll.id.toLowerCase()}`}
        className="flex items-center justify-between px-3 py-2.5 border-t text-[9px] tracking-widest uppercase transition-colors duration-150 hover:bg-white/5"
        style={{ borderColor: corridor.color + '22', color: corridor.color }}>
        <span>Ver gemelo digital completo</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
