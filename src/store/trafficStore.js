import { create } from 'zustand';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/api/traffic`;
const HTTP_URL = `${window.location.protocol}//${window.location.host}/api/traffic/snapshot`;

export const useTrafficStore = create((set) => ({
  trafficData: {},
  calendar: {},
  nationalWazeJams: [],
  isConnected: false,
  isConnecting: false,
  ws: null,
  
  connect: () => {
    const state = useTrafficStore.getState();
    if (state.isConnected || state.isConnecting || state.ws) return;
    
    set({ isConnecting: true });

    // Soporte para Render / Redes Corporativas: Intentamos WS, si falla por Firewall de la Policía, hace HTTP
    const ws = new WebSocket(WS_URL);
    set({ ws });
    
    ws.onopen = () => set({ isConnected: true, isConnecting: false });
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'initial_snapshot') {
          set({ trafficData: payload.data || {}, calendar: payload.calendar || {}, nationalWazeJams: payload.nationalWazeJams || [] });
        } else if (payload.type === 'traffic_update') {
          set((state) => ({
            trafficData: { ...state.trafficData, ...(payload.data || {}) },
            nationalWazeJams: payload.nationalWazeJams || state.nationalWazeJams
          }));
        }
      } catch (e) {}
    };
    
    ws.onclose = () => {
      set({ isConnected: false, isConnecting: false, ws: null });
      setTimeout(() => useTrafficStore.getState().connect(), 3000);
    };
    
    ws.onerror = () => ws.close();
  }
}));

useTrafficStore.getState().connect();
