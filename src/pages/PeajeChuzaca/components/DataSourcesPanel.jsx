import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Database } from 'lucide-react';

const sources = [
  { name: 'Google Street View', tipo: 'Imágenes 360°', datos: 'Vista nivel suelo del peaje', licencia: 'CC BY (embed público)', estado: 'Activo', color: '#22c55e' },
  { name: 'Google Maps Satellite', tipo: 'Imagen satelital', datos: 'Vista aérea del peaje', licencia: 'Uso embed público', estado: 'Activo', color: '#22c55e' },
  { name: 'OpenStreetMap', tipo: 'Vector', datos: 'Geometría vial y calzadas', licencia: 'ODbL 1.0', estado: 'Activo', color: '#22c55e' },
  { name: 'Copernicus/Sentinel-2', tipo: 'Multibanda', datos: 'Contexto territorial', licencia: 'CC BY-SA (ESA)', estado: 'Disponible', color: '#0ea5e9' },
  { name: 'INVÍAS VIITS', tipo: 'Sensores ITS', datos: 'Flujo, velocidad, conteo', licencia: 'Propietario', estado: 'Simulado', color: '#f59e0b' },
];

export default function DataSourcesPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border mt-3" style={{ backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-400">Fuentes de Datos — Piloto</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: '#1a2d4a' }}>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="pb-2 pr-4">Fuente</th>
                  <th className="pb-2 pr-4">Tipo</th>
                  <th className="pb-2 pr-4">Datos usados</th>
                  <th className="pb-2 pr-4">Licencia</th>
                  <th className="pb-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(s => (
                  <tr key={s.name} className="border-t" style={{ borderColor: '#1a2d4a' }}>
                    <td className="py-2 pr-4 text-slate-300 font-medium">{s.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{s.tipo}</td>
                    <td className="py-2 pr-4 text-slate-500">{s.datos}</td>
                    <td className="py-2 pr-4 text-slate-500 font-mono text-[10px]">{s.licencia}</td>
                    <td className="py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{
                        color: s.color,
                        backgroundColor: `${s.color}15`,
                      }}>
                        {s.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed mt-4 italic border-l-2 pl-3" style={{ borderColor: '#1a2d4a' }}>
            Este piloto fue construido exclusivamente con fuentes de datos abiertos y públicamente
            disponibles para demostrar la arquitectura del sistema VIITS NEXUS. Los datos operacionales
            de sensores son simulados con parámetros estadísticos basados en los registros históricos
            del peaje. En producción, estos datos serán reemplazados por el feed en tiempo real de los
            sensores instalados bajo el Contrato 5092/5093 de INVÍAS.
          </p>
        </div>
      )}
    </div>
  );
}
