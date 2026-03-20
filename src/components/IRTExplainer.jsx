import React, { useState } from 'react';
import { desglosarIRT } from '../utils/irtEngine';

/**
 * Panel colapsable que muestra el desglose de la fórmula IRT
 * con valores en tiempo real del corredor seleccionado.
 */

export default function IRTExplainer({ corridor, params }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!corridor || !params) return null;

  const desglose = desglosarIRT(params);
  const nivelLluviaLabels = ['Sin lluvia', 'Lluvia moderada', 'Lluvia intensa'];
  const dayLabels = [
    'Domingo de Ramos', 'Lunes Santo', 'Martes Santo', 'Miércoles Santo',
    'Jueves Santo', 'Viernes Santo', 'Sábado de Gloria', 'Domingo de Resurrección'
  ];

  return (
    <div className="bg-viits-card border border-viits-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700/30 transition-colors"
      >
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
          Índice de Riesgo de Trancón (IRT) — {corridor.name}
        </span>
        <span className="text-slate-500 text-xs">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 border-t border-viits-border">
          <div className="font-mono text-[10px] text-slate-400 mt-2 space-y-1.5">
            <div className="text-slate-500 border-b border-slate-700 pb-1 mb-1">
              {'━'.repeat(52)}
            </div>

            <div className="flex justify-between">
              <span>Volumen/Capacidad: {params.volumenActual.toLocaleString()}/{params.capacidadVia.toLocaleString()} = {desglose.ratio}</span>
              <span className="text-amber-400">× 0.40 = {desglose.componentes.volumenCapacidad.weighted}</span>
            </div>

            <div className="flex justify-between">
              <span>Tasa de crecimiento: {(params.tasaCrecimiento * 100).toFixed(0)}%/hora</span>
              <span className="text-amber-400">× 0.25 = {desglose.componentes.tasaCrecimiento.weighted}</span>
            </div>

            <div className="flex justify-between">
              <span>Factor festivo hist.: {dayLabels[params.dayIndex] || 'N/A'}</span>
              <span className="text-amber-400">× 0.20 = {desglose.componentes.factorFestivo.weighted}</span>
            </div>

            <div className="flex justify-between">
              <span>Factor climático: {nivelLluviaLabels[params.nivelLluvia]}</span>
              <span className="text-amber-400">× 0.15 = {desglose.componentes.factorClimatico.weighted}</span>
            </div>

            {params.restriccionPesados && (
              <div className="flex justify-between text-emerald-400">
                <span>Restricción pesados activa</span>
                <span>-0.080</span>
              </div>
            )}

            {params.carrilReversible && (
              <div className="flex justify-between text-emerald-400">
                <span>Carril reversible activo</span>
                <span>-0.120</span>
              </div>
            )}

            <div className="text-slate-500 border-t border-slate-700 pt-1 mt-1">
              {'─'.repeat(52)}
            </div>

            <div className="flex justify-between text-sm font-bold text-white">
              <span>IRT TOTAL</span>
              <span className="text-amber-400">{desglose.total} → {desglose.irt}/100</span>
            </div>
          </div>

          <div className="mt-2 text-[8px] text-slate-600">
            Modelo IRT v1.0 — VIITS/INVÍAS 2026 · Pesos: V/C(40%) + Crecimiento(25%) + Festivo(20%) + Clima(15%)
          </div>
        </div>
      )}
    </div>
  );
}
