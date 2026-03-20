import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ColombiaMap from './ColombiaMap';
import ControlPanel from './ControlPanel';
import CorridorCard from './CorridorCard';
import AlertsPanel from './AlertsPanel';
import IRTExplainer from './IRTExplainer';
import Ticker from './Ticker';
import { CORRIDORS, DAYS, getTrafficVolume } from '../data/corridors';
import { calcularIRT, calcularTasaCrecimiento, calcularTiempoViaje, calcularVelocidadPromedio, getNivelAlerta } from '../utils/irtEngine';
import { evaluateAlerts, extractCriticalEvents } from '../utils/alertEngine';

/**
 * VIITS — Gemelo Digital Semana Santa 2026
 * Componente principal del dashboard.
 */

function KPICard({ label, value, sub, color }) {
  return (
    <div className="bg-viits-card border border-viits-border rounded-lg px-3 py-2 text-center">
      <div className="font-mono text-lg font-bold" style={{ color: color || '#e2e8f0' }}>
        {value}
      </div>
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[8px] text-slate-600">{sub}</div>}
    </div>
  );
}

export default function VIITSDashboard() {
  // Estado global
  const [selectedDay, setSelectedDay] = useState(4);        // Jueves Santo
  const [selectedHour, setSelectedHour] = useState(11);     // 11am
  const [rainByRegion, setRainByRegion] = useState({ andina: 0, orinoquia: 0, caribe: 0 });
  const [restriccionPesados, setRestricionPesados] = useState(false);
  const [carrilReversible, setCarrilReversible] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [selectedCorridor, setSelectedCorridor] = useState(null);

  // Cargar escenario
  const handleLoadScenario = useCallback((scenario) => {
    const { config } = scenario;
    setSelectedDay(config.selectedDay);
    setSelectedHour(config.selectedHour);
    setRainByRegion(config.rainByRegion);
    setRestricionPesados(config.restriccionPesados);
    setCarrilReversible(config.carrilReversible);
    setActiveScenario(scenario.id);
  }, []);

  // Calcular IRT para todos los corredores
  const corridorMetrics = useMemo(() => {
    const metrics = {};
    CORRIDORS.forEach(corridor => {
      const regionKey = corridor.region === 'andina' ? 'andina'
        : corridor.region === 'orinoquia' ? 'orinoquia' : 'caribe';
      const nivelLluvia = rainByRegion[regionKey];

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
        irt,
        volume,
        nivelLluvia,
        factorFestivo,
        tasaCrecimiento,
        tiempoViaje: calcularTiempoViaje(corridor.normalTravelTimeHrs, irt),
        velocidad: calcularVelocidadPromedio(corridor.freeFlowSpeedKmh, irt),
        params: {
          volumenActual: volume,
          capacidadVia: corridor.normalCapacityVehHr,
          tasaCrecimiento,
          factorFestivo,
          nivelLluvia,
          restriccionPesados,
          carrilReversible,
          dayIndex: selectedDay,
        },
      };
    });
    return metrics;
  }, [selectedDay, selectedHour, rainByRegion, restriccionPesados, carrilReversible]);

  // KPIs
  const kpis = useMemo(() => {
    const irts = Object.values(corridorMetrics);
    const totalVehicles = irts.reduce((sum, m) => sum + m.volume, 0);
    const alertRojas = irts.filter(m => m.irt > 80).length;
    const avgIRT = Math.round(irts.reduce((sum, m) => sum + m.irt, 0) / irts.length);
    const avgTiempo = irts.reduce((sum, m) => sum + m.tiempoViaje, 0) / irts.length;
    return { totalVehicles, alertRojas, avgIRT, avgTiempo };
  }, [corridorMetrics]);

  const irtValues = useMemo(() => {
    const vals = {};
    Object.keys(corridorMetrics).forEach(id => { vals[id] = corridorMetrics[id].irt; });
    return vals;
  }, [corridorMetrics]);

  // Smart Alerts
  const [criticalEventsLog, setCriticalEventsLog] = useState([]);

  const smartAlerts = useMemo(() => {
    return evaluateAlerts({
      corridorMetrics,
      corridors: CORRIDORS,
      selectedDay,
      selectedHour,
    });
  }, [corridorMetrics, selectedDay, selectedHour]);

  // Log critical events
  const prevAlertsRef = useRef([]);
  useEffect(() => {
    const newCritical = extractCriticalEvents(smartAlerts, prevAlertsRef.current);
    if (newCritical.length > 0) {
      setCriticalEventsLog(prev => [...prev, ...newCritical].slice(-20)); // Keep last 20
      prevAlertsRef.current = [...prevAlertsRef.current, ...newCritical];
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
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-viits-invias flex items-center justify-center text-white font-bold text-xs">
                  V
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-wider text-white">
                    VIITS <span className="text-slate-500">·</span> GEMELO DIGITAL
                    <span className="text-slate-500"> ·</span>
                    <span className="text-amber-400"> SEMANA SANTA 2026</span>
                  </h1>
                  <p className="text-[9px] text-slate-500 tracking-widest uppercase">
                    Instituto Nacional de Vías — Ministerio de Transporte de Colombia
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-amber-400">
                {currentDay.name}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {currentDay.date} 2026 · {String(selectedHour).padStart(2, '0')}:00 hrs
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="max-w-[1600px] mx-auto px-4 pb-3">
          <div className="grid grid-cols-4 gap-2">
            <KPICard
              label="Vehículos/hora (4 corredores)"
              value={kpis.totalVehicles.toLocaleString()}
              sub="+35% vs semana normal"
              color="#e2e8f0"
            />
            <KPICard
              label="Corredores en alerta roja"
              value={`${kpis.alertRojas} / 4`}
              color={kpis.alertRojas > 0 ? '#ef4444' : '#10b981'}
            />
            <KPICard
              label="IRT Nacional Promedio"
              value={`${kpis.avgIRT}/100`}
              color={getNivelAlerta(kpis.avgIRT).color}
            />
            <KPICard
              label="Tiempo promedio viaje"
              value={`${Math.floor(kpis.avgTiempo)}h ${Math.round((kpis.avgTiempo % 1) * 60)}m`}
              color="#e2e8f0"
            />
          </div>
        </div>
      </header>

      {/* Ticker */}
      <Ticker />

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid grid-cols-12 gap-3">
          {/* Sidebar — Controles */}
          <aside className="col-span-12 lg:col-span-3 xl:col-span-2 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">
            <ControlPanel
              selectedDay={selectedDay}
              setSelectedDay={(d) => { setSelectedDay(d); setActiveScenario(null); }}
              selectedHour={selectedHour}
              setSelectedHour={(h) => { setSelectedHour(h); setActiveScenario(null); }}
              rainByRegion={rainByRegion}
              setRainByRegion={(r) => { setRainByRegion(r); setActiveScenario(null); }}
              restriccionPesados={restriccionPesados}
              setRestricionPesados={(v) => { setRestricionPesados(v); setActiveScenario(null); }}
              carrilReversible={carrilReversible}
              setCarrilReversible={(v) => { setCarrilReversible(v); setActiveScenario(null); }}
              activeScenario={activeScenario}
              onLoadScenario={handleLoadScenario}
            />
          </aside>

          {/* Centro — Mapa */}
          <section className="col-span-12 lg:col-span-5 xl:col-span-6 min-w-0">
            <div className="bg-viits-bgAlt border border-viits-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-viits-border">
                <h2 className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                  Mapa de Corredores — Gemelo Digital
                </h2>
              </div>
              <ColombiaMap
                corridors={CORRIDORS}
                irtValues={irtValues}
                selectedCorridor={selectedCorridor}
                onSelectCorridor={(id) => setSelectedCorridor(id === selectedCorridor ? null : id)}
                corridorMetrics={corridorMetrics}
              />
            </div>

            {/* IRT Explainer — debajo del mapa */}
            {selectedCorridorData && corridorMetrics[selectedCorridor] && (
              <div className="mt-3">
                <IRTExplainer
                  corridor={selectedCorridorData}
                  params={corridorMetrics[selectedCorridor].params}
                />
              </div>
            )}
          </section>

          {/* Derecha — Corredores + Alertas */}
          <aside className="col-span-12 lg:col-span-4 xl:col-span-4 space-y-2 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">
            {/* Tarjetas de corredor */}
            <div className="space-y-2">
              {CORRIDORS.map(corridor => {
                const metrics = corridorMetrics[corridor.id];
                return (
                  <CorridorCard
                    key={corridor.id}
                    corridor={corridor}
                    irt={metrics.irt}
                    volume={metrics.volume}
                    dayIndex={selectedDay}
                    selectedHour={selectedHour}
                    nivelLluvia={metrics.nivelLluvia}
                  />
                );
              })}
            </div>

            {/* Alertas y simulador */}
            <AlertsPanel
              selectedDay={selectedDay}
              selectedHour={selectedHour}
              rainByRegion={rainByRegion}
              restriccionPesados={restriccionPesados}
              carrilReversible={carrilReversible}
              irtValues={irtValues}
              smartAlerts={smartAlerts}
              criticalEventsLog={criticalEventsLog}
            />
          </aside>
        </div>
      </main>

      {/* Footer — Nota metodológica */}
      <footer className="bg-viits-bgAlt border-t border-viits-border mt-6">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="text-[9px] text-slate-600 leading-relaxed space-y-0.5">
            <p>
              <span className="text-slate-500 font-semibold">Fuentes:</span> INVÍAS ConteosFijosMoviles · ANI ·
              MinTransporte · IDEAM · ANSV · SuperTransporte
            </p>
            <p>
              <span className="text-slate-500 font-semibold">Modelo:</span> IRT v1.0 — VIITS/INVÍAS 2026 ·
              Componentes: Volumen/Capacidad (40%) + Tasa Crecimiento (25%) + Factor Festivo (20%) + Clima (15%)
            </p>
            <p>
              <span className="text-slate-500 font-semibold">Datos históricos:</span> Semanas Santas 2019–2025 ·
              9.1M vehículos movilizados (SS 2025) · Reducción 60% siniestralidad
            </p>
            <p className="text-slate-700">
              Este sistema es un prototipo de demostración. Los valores son proyecciones basadas en datos históricos
              y no constituyen información oficial de tránsito. © VIITS — INVÍAS — Ministerio de Transporte 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
