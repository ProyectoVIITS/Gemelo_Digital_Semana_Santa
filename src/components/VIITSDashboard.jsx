import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ColombiaMap from './ColombiaMap';
import ControlPanel from './ControlPanel';
import CorridorCard from './CorridorCard';
import AlertsPanel from './AlertsPanel';
import IRTExplainer from './IRTExplainer';
import Ticker from './Ticker';
import { CORRIDORS, DAYS, getTrafficVolume, TOTAL_TOLL_STATIONS } from '../data/corridors';
import { calcularIRT, calcularTasaCrecimiento, calcularTiempoViaje, calcularVelocidadPromedio, getNivelAlerta } from '../utils/irtEngine';
import { evaluateAlerts, extractCriticalEvents } from '../utils/alertEngine';

function KPICard({ label, value, sub, color }) {
  return (
    <div className="bg-viits-card border border-viits-border rounded-lg px-3 py-2 text-center">
      <div className="font-mono text-lg font-bold" style={{ color: color || '#e2e8f0' }}>{value}</div>
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[8px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function VIITSDashboard() {
  const [selectedDay, setSelectedDay] = useState(5);        // Viernes Santo
  const [selectedHour, setSelectedHour] = useState(11);
  const [rainByRegion, setRainByRegion] = useState({ andina: 0, pacifica: 0, orinoquia: 0, caribe: 0 });
  const [restriccionPesados, setRestricionPesados] = useState(false);
  const [carrilReversible, setCarrilReversible] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [selectedCorridor, setSelectedCorridor] = useState(null);

  const handleLoadScenario = useCallback((scenario) => {
    const { config } = scenario;
    setSelectedDay(config.selectedDay);
    setSelectedHour(config.selectedHour);
    setRainByRegion(config.rainByRegion);
    setRestricionPesados(config.restriccionPesados);
    setCarrilReversible(config.carrilReversible);
    setActiveScenario(scenario.id);
  }, []);

  // Calculate IRT for all 7 corridors
  const corridorMetrics = useMemo(() => {
    const metrics = {};
    CORRIDORS.forEach(corridor => {
      const regionKey = corridor.region;
      const nivelLluvia = rainByRegion[regionKey] || 0;
      const { volume, factorFestivo } = getTrafficVolume(corridor, selectedDay, selectedHour, nivelLluvia);
      const prevData = getTrafficVolume(corridor, selectedDay, Math.max(selectedHour - 1, 0), nivelLluvia);
      const tasaCrecimiento = calcularTasaCrecimiento(volume, prevData.volume);

      const irt = calcularIRT({
        volumenActual: volume,
        capacidadVia: corridor.normalCapacityVehHr,
        tasaCrecimiento,
        factorFestivo,
        nivelLluvia,
        restriccionPesados,
        carrilReversible,
      });

      metrics[corridor.id] = {
        irt, volume, nivelLluvia, factorFestivo, tasaCrecimiento,
        tiempoViaje: calcularTiempoViaje(corridor.normalTravelTimeHrs, irt),
        velocidad: calcularVelocidadPromedio(corridor.freeFlowSpeedKmh, irt),
        params: { volumenActual: volume, capacidadVia: corridor.normalCapacityVehHr, tasaCrecimiento, factorFestivo, nivelLluvia, restriccionPesados, carrilReversible, dayIndex: selectedDay },
      };
    });
    return metrics;
  }, [selectedDay, selectedHour, rainByRegion, restriccionPesados, carrilReversible]);

  // KPIs
  const kpis = useMemo(() => {
    const irts = Object.values(corridorMetrics);
    const totalVehicles = irts.reduce((s, m) => s + m.volume, 0);
    const alertRojas = irts.filter(m => m.irt > 80).length;
    const peajesAlerta = CORRIDORS.reduce((count, c) => {
      const cIrt = corridorMetrics[c.id]?.irt || 0;
      return count + c.peajes.filter(p => p.critico && cIrt > 75).length;
    }, 0);
    const avgIRT = Math.round(irts.reduce((s, m) => s + m.irt, 0) / irts.length);
    const avgTiempo = irts.reduce((s, m) => s + m.tiempoViaje, 0) / irts.length;
    return { totalVehicles, alertRojas, peajesAlerta, avgIRT, avgTiempo };
  }, [corridorMetrics]);

  const irtValues = useMemo(() => {
    const vals = {};
    Object.keys(corridorMetrics).forEach(id => { vals[id] = corridorMetrics[id].irt; });
    return vals;
  }, [corridorMetrics]);

  // Smart Alerts
  const [criticalEventsLog, setCriticalEventsLog] = useState([]);
  const smartAlerts = useMemo(() =>
    evaluateAlerts({ corridorMetrics, corridors: CORRIDORS, selectedDay, selectedHour })
  , [corridorMetrics, selectedDay, selectedHour]);

  const prevAlertsRef = useRef([]);
  useEffect(() => {
    const nc = extractCriticalEvents(smartAlerts, prevAlertsRef.current);
    if (nc.length > 0) {
      setCriticalEventsLog(prev => [...prev, ...nc].slice(-20));
      prevAlertsRef.current = [...prevAlertsRef.current, ...nc];
    }
  }, [smartAlerts]);

  const currentDay = DAYS[selectedDay];
  const selectedCorridorData = selectedCorridor ? CORRIDORS.find(c => c.id === selectedCorridor) : null;

  return (
    <div className="min-h-screen bg-viits-bg text-viits-text font-sans">
      {/* Header */}
      <header className="bg-viits-bgAlt border-b border-viits-border">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-viits-invias flex items-center justify-center text-white font-bold text-xs">V</div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-white">
                  VIITS <span className="text-slate-500">·</span> GEMELO DIGITAL
                  <span className="text-slate-500"> ·</span>
                  <span className="text-amber-400"> SEMANA SANTA 2026</span>
                  <span className="text-slate-500"> ·</span>
                  <span className="text-sky-400"> DITRA</span>
                </h1>
                <p className="text-[9px] text-slate-500 tracking-widest uppercase">
                  Instituto Nacional de Vías — Dirección Técnica de Carreteras · 7 Corredores · {TOTAL_TOLL_STATIONS} Peajes
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-amber-400">{currentDay.name}</div>
              <div className="font-mono text-[11px] text-slate-400">
                {currentDay.date} 2026 · {String(selectedHour).padStart(2, '0')}:00 hrs
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="max-w-[1600px] mx-auto px-4 pb-3">
          <div className="grid grid-cols-5 gap-2">
            <KPICard label="Vehículos/hora (7 corredores)" value={kpis.totalVehicles.toLocaleString()}
              sub={`×${CORRIDORS.reduce((s,c) => s + c.incrementoVsSemNormal, 0) / CORRIDORS.length > 3 ? '3.5' : '2.8'} vs sem. normal`} />
            <KPICard label="Corredores en alerta roja" value={`${kpis.alertRojas} / 7`}
              color={kpis.alertRojas > 0 ? '#ef4444' : '#10b981'} />
            <KPICard label="Peajes en alerta" value={`${kpis.peajesAlerta} / ${TOTAL_TOLL_STATIONS}`}
              color={kpis.peajesAlerta > 0 ? '#f97316' : '#10b981'} />
            <KPICard label="IRT Nacional Promedio" value={`${kpis.avgIRT}/100`}
              color={getNivelAlerta(kpis.avgIRT).color} />
            <KPICard label="Tiempo promedio viaje"
              value={`${Math.floor(kpis.avgTiempo)}h ${Math.round((kpis.avgTiempo % 1) * 60)}m`} />
          </div>
        </div>
      </header>

      <Ticker />

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid grid-cols-12 gap-3">
          {/* Sidebar — Controls */}
          <aside className="col-span-12 lg:col-span-3 xl:col-span-2 lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto lg:pr-1">
            <ControlPanel
              selectedDay={selectedDay}
              setSelectedDay={d => { setSelectedDay(d); setActiveScenario(null); }}
              selectedHour={selectedHour}
              setSelectedHour={h => { setSelectedHour(h); setActiveScenario(null); }}
              rainByRegion={rainByRegion}
              setRainByRegion={r => { setRainByRegion(r); setActiveScenario(null); }}
              restriccionPesados={restriccionPesados}
              setRestricionPesados={v => { setRestricionPesados(v); setActiveScenario(null); }}
              carrilReversible={carrilReversible}
              setCarrilReversible={v => { setCarrilReversible(v); setActiveScenario(null); }}
              activeScenario={activeScenario}
              onLoadScenario={handleLoadScenario}
            />
          </aside>

          {/* Center — Map */}
          <section className="col-span-12 lg:col-span-5 xl:col-span-6 min-w-0">
            <div className="bg-viits-bgAlt border border-viits-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-viits-border flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                  Mapa de 7 Corredores — Colombia
                </h2>
                <div className="flex gap-2">
                  {CORRIDORS.map(c => {
                    const irt = irtValues[c.id] || 0;
                    const lv = getNivelAlerta(irt);
                    return (
                      <button key={c.id} onClick={() => setSelectedCorridor(c.id === selectedCorridor ? null : c.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono transition-all ${
                          selectedCorridor === c.id ? 'bg-slate-700/50 ring-1 ring-slate-500' : 'hover:bg-slate-800/40'
                        }`}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                        <span className="text-slate-400">{c.id}</span>
                        <span className="font-bold" style={{ color: lv.color }}>{irt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <ColombiaMap
                corridors={CORRIDORS}
                irtValues={irtValues}
                selectedCorridor={selectedCorridor}
                onSelectCorridor={id => setSelectedCorridor(id === selectedCorridor ? null : id)}
                corridorMetrics={corridorMetrics}
              />
            </div>

            {/* IRT Legend */}
            <div className="mt-2 flex items-center gap-3 justify-center">
              {[
                { label: '0-40 Normal', color: '#10b981' },
                { label: '41-65 Precaución', color: '#f59e0b' },
                { label: '66-80 Congestión', color: '#f97316' },
                { label: '81-90 Crítico', color: '#ef4444' },
                { label: '91+ Colapso', color: '#7f1d1d' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-[8px] text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>

            {/* IRT Explainer */}
            {selectedCorridorData && corridorMetrics[selectedCorridor] && (
              <div className="mt-3">
                <IRTExplainer corridor={selectedCorridorData} params={corridorMetrics[selectedCorridor].params} />
              </div>
            )}
          </section>

          {/* Right — Corridor Cards + Alerts */}
          <aside className="col-span-12 lg:col-span-4 xl:col-span-4 space-y-2 lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto lg:pr-1">
            <div className="space-y-2">
              {CORRIDORS.map(corridor => {
                const m = corridorMetrics[corridor.id];
                return (
                  <CorridorCard key={corridor.id} corridor={corridor}
                    irt={m.irt} volume={m.volume}
                    dayIndex={selectedDay} selectedHour={selectedHour}
                    nivelLluvia={m.nivelLluvia} />
                );
              })}
            </div>

            <AlertsPanel
              selectedDay={selectedDay} selectedHour={selectedHour}
              rainByRegion={rainByRegion} restriccionPesados={restriccionPesados}
              carrilReversible={carrilReversible} irtValues={irtValues}
              smartAlerts={smartAlerts} criticalEventsLog={criticalEventsLog}
            />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-viits-bgAlt border-t border-viits-border mt-6">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="text-[9px] text-slate-600 leading-relaxed space-y-0.5">
            <p><span className="text-slate-500 font-semibold">Fuentes:</span> INVÍAS ConteosFijosMoviles · ANI · MinTransporte · IDEAM · ANSV</p>
            <p><span className="text-slate-500 font-semibold">Inventario:</span> peajes_act.xlsx — VIITS/INVÍAS 2026 · {TOTAL_TOLL_STATIONS} peajes en 7 corredores</p>
            <p><span className="text-slate-500 font-semibold">Modelo:</span> IRT v1.0 — VIITS/INVÍAS · DITRA 2026 · Vol/Cap (40%) + Crecimiento (25%) + Festivo (20%) + Clima (15%)</p>
            <p><span className="text-slate-500 font-semibold">Datos históricos:</span> SS 2019–2025 · 9.1M vehículos (SS 2025) · Reducción 60% siniestralidad</p>
            <p className="text-slate-700">
              Este sistema es un prototipo de demostración. Los valores son proyecciones basadas en datos históricos
              y no constituyen información oficial de tránsito. © VIITS — INVÍAS — DITRA — Ministerio de Transporte 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
