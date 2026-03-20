import React, { useState, useCallback } from 'react';
import useSensorData from './hooks/useSensorData';
import useAlerts from './hooks/useAlerts';
import LoadingScreen from './LoadingScreen';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import StreetViewPanel from './components/StreetViewPanel';
import TollCanvas from './components/TollCanvas';
import FlowMetrics from './components/FlowMetrics';
import SpeedChart from './components/SpeedChart';
import PTZCountPanel from './components/PTZCountPanel';
import OccupancyGauge from './components/OccupancyGauge';
import AlertFeed from './components/AlertFeed';
import DataSourcesPanel from './components/DataSourcesPanel';

export default function ChuzacaDashboard() {
  const [showLoading, setShowLoading] = useState(true);
  const sensorData = useSensorData();
  const { alerts } = useAlerts(sensorData);

  const handleLoadComplete = useCallback(() => setShowLoading(false), []);

  if (showLoading) {
    return <LoadingScreen onComplete={handleLoadComplete} />;
  }

  return (
    <div className="min-h-screen bg-viits-bg text-viits-text font-sans chuzaca-root" style={{ paddingBottom: 36 }}>
      <Header />
      <main className="max-w-[1600px] mx-auto px-3 py-3">
        <div className="grid grid-cols-12 gap-3">
          {/* Left column — 5/12 on xl */}
          <div className="col-span-12 xl:col-span-5 space-y-3 order-2 xl:order-1">
            <StreetViewPanel />
            <AlertFeed alerts={alerts} />
          </div>

          {/* Right column — 7/12 on xl */}
          <div className="col-span-12 xl:col-span-7 space-y-3 order-1 xl:order-2">
            <TollCanvas sensorData={sensorData} />
            <FlowMetrics flow={sensorData.flow} />
            <SpeedChart history={sensorData.speedHistory} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PTZCountPanel counting={sensorData.counting} />
              <OccupancyGauge occupancy={sensorData.flow.occupancy} />
            </div>
          </div>
        </div>
        <DataSourcesPanel />
      </main>
      <StatusBar />
    </div>
  );
}
