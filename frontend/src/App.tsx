// frontend/src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Shield, Sliders, AlertTriangle, Globe, Database, Cpu, 
  Layers, Settings, LogOut, User, Server, Wifi, Battery, Thermometer, 
  Play, Square, Radio, Compass, RefreshCw, Send, CheckCircle2, AlertOctagon, Terminal
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const API_BASE_URL = 'http://localhost:8000/api/v1';
const WS_BASE_URL = 'ws://localhost:8000/api/v1';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<string | null>(localStorage.getItem('role'));
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [satellites, setSatellites] = useState<any[]>([]);
  const [activeSatellite, setActiveSatellite] = useState<string>('SAT-001');
  const [liveTelemetry, setLiveTelemetry] = useState<Record<string, any>>({});
  const [telemetryHistory, setTelemetryHistory] = useState<Record<string, any[]>>({
    'SAT-001': [],
    'SAT-002': [],
    'SAT-003': []
  });
  
  const [alerts, setAlerts] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Time-range filter for historical graph view
  const [histStart, setHistStart] = useState<string>(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
  const [histEnd, setHistEnd] = useState<string>(new Date().toISOString().slice(0, 16));
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  const ws = useRef<WebSocket | null>(null);

  // Token management
  const saveToken = (newToken: string, userRole: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', userRole);
    setToken(newToken);
    setRole(userRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setRole(null);
    if (ws.current) {
      ws.current.close();
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      if (!res.ok) {
        throw new Error('Authentication failed. Check credentials.');
      }

      const data = await res.json();
      
      // Fetch user role
      const userRes = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const userData = await userRes.json();
      
      saveToken(data.access_token, userData.role);
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.message.includes('fetch') || err.name === 'TypeError') {
        console.log("Backend offline. Logging in with local mock credentials.");
        const mockRoles: Record<string, string> = {
          admin: 'Administrator',
          operator: 'Operator',
          viewer: 'Viewer'
        };
        const resolvedRole = mockRoles[username.toLowerCase()];
        if (resolvedRole && password === username + '123') {
          saveToken('mock-token-offline-mode', resolvedRole);
          setSuccessMessage('Logged in (Offline Mock Mode)');
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setAuthError('Invalid credentials or backend is offline.');
        }
      } else {
        setAuthError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // REST API requests
  const apiGet = async (path: string) => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        return null;
      }
      return await res.json();
    } catch (e) {
      console.error(`Error fetching ${path}`, e);
      return null;
    }
  };

  const apiPost = async (path: string, body: any = null) => {
    if (!token) return null;
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };
      let requestBody = undefined;
      if (body) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      }
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: requestBody
      });
      if (res.status === 401) {
        handleLogout();
        return null;
      }
      return await res.json();
    } catch (e) {
      console.error(`Error posting ${path}`, e);
      return null;
    }
  };

  // Fetch initial system states
  const fetchSystemData = async () => {
    const satsData = await apiGet('/telemetry/satellites');
    if (satsData) setSatellites(satsData);

    const healthData = await apiGet('/system/health');
    if (healthData) setSystemHealth(healthData);

    const alertsData = await apiGet('/alerts/');
    if (alertsData) setAlerts(alertsData);

    const configsData = await apiGet('/system/configs');
    if (configsData) setConfigs(configsData);

    // Fetch initial latest telemetry data
    const latestData = await apiGet('/telemetry/latest');
    if (latestData) {
      const liveMap: Record<string, any> = {};
      latestData.forEach((packet: any) => {
        liveMap[packet.satellite_id] = packet;
        setTelemetryHistory(prev => ({
          ...prev,
          [packet.satellite_id]: [packet]
        }));
      });
      setLiveTelemetry(liveMap);
    }
  };

  // Fetch log views based on current role
  const fetchLogs = async () => {
    const sysLogs = await apiGet('/system/logs/system');
    if (sysLogs) setSystemLogs(sysLogs);
    
    if (role === 'Administrator') {
      const audLogs = await apiGet('/system/logs/audit');
      if (audLogs) setAuditLogs(audLogs);
    }
  };

  // Fetch historical data range
  const loadHistoricalTelemetry = async () => {
    setLoading(true);
    if (token === 'mock-token-offline-mode') {
      const mockHist = [];
      const timestamp = new Date();
      for (let i = 100; i >= 0; i--) {
        const t = new Date(timestamp.getTime() - i * 60000);
        const angle = (t.getTime() / 600000);
        const idx = activeSatellite === 'SAT-001' ? 0 : activeSatellite === 'SAT-002' ? 1 : 2;
        const baseBattery = 80 - idx * 5;
        const baseTemp = 20 + idx * 5;
        const altitude = 400 + idx * 5000;
        const velocity = 7.6 - idx * 1.5;

        mockHist.push({
          id: i,
          satellite_id: activeSatellite,
          timestamp: t.toISOString(),
          orbit_number: 12 + Math.floor(angle / 6.28),
          temperature: Number((baseTemp + Math.sin(angle * 5) * 4).toFixed(2)),
          battery_level: Number(Math.max(0, Math.min(100, baseBattery + Math.cos(angle * 3) * 10)).toFixed(2)),
          solar_panel_voltage: Number((24 + Math.sin(angle) * 3).toFixed(2)),
          power_consumption: Number((95 + Math.cos(angle) * 10).toFixed(2)),
          cpu_usage: Number((15 + Math.random() * 20).toFixed(2)),
          memory_usage: Number((32 + Math.random() * 5).toFixed(2)),
          signal_strength: Number((-70 - Math.random() * 10).toFixed(2)),
          altitude: Number((altitude + Math.sin(angle) * 2).toFixed(2)),
          velocity: Number((velocity + Math.cos(angle) * 0.05).toFixed(3)),
          latitude: Number((50 * Math.sin(angle)).toFixed(6)),
          longitude: Number((150 * Math.cos(angle * 0.5)).toFixed(6)),
          roll: Number((Math.sin(angle) * 2).toFixed(3)),
          pitch: Number((Math.cos(angle) * 1.5).toFixed(3)),
          yaw: Number((Math.sin(angle * 0.5) * 5).toFixed(3)),
          fuel_remaining: Number((92 - angle * 0.05).toFixed(2)),
          radiation_level: Number((12 + Math.random() * 3).toFixed(2)),
          communication_status: "CONNECTED",
          gps_lock: true,
          health_status: "HEALTHY",
          error_code: 0,
          packet_loss: Number((Math.random() * 0.2).toFixed(2)),
          uplink_delay: 120 + Math.floor(Math.random() * 20),
          downlink_delay: 110 + Math.floor(Math.random() * 15)
        });
      }
      setHistoricalData(mockHist);
      setLoading(false);
      return;
    }

    const startStr = new Date(histStart).toISOString();
    const endStr = new Date(histEnd).toISOString();
    const hist = await apiGet(`/telemetry/historical?satellite_id=${activeSatellite}&start_time=${startStr}&end_time=${endStr}`);
    if (hist) setHistoricalData(hist);
    setLoading(false);
  };

  // Control simulation execution
  const toggleSimulation = async (active: boolean) => {
    if (token === 'mock-token-offline-mode') {
      setSuccessMessage(`Simulation state set to active=${active} (Mock Mode)`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setSystemHealth((prev: any) => prev ? {
        ...prev,
        services: { ...prev.services, telemetry_simulator: active ? 'RUNNING' : 'STOPPED' }
      } : null);
      return;
    }

    const res = await apiPost(`/system/simulation/control?active=${active}`);
    if (res) {
      setSuccessMessage(res.message);
      setTimeout(() => setSuccessMessage(null), 3000);
      setSystemHealth((prev: any) => prev ? {
        ...prev,
        services: { ...prev.services, telemetry_simulator: active ? 'RUNNING' : 'STOPPED' }
      } : null);
    }
  };

  // Anomaly injector
  const injectAnomaly = async (satId: string, type: string) => {
    if (token === 'mock-token-offline-mode') {
      const detailsMsg = type === 'clear' ? `Cleared all anomalies on ${satId}` : `Injected ${type} anomaly on ${satId}`;
      setSuccessMessage(detailsMsg + ' (Mock Mode)');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      if (type !== 'clear') {
        const newAlert = {
          id: Math.floor(Math.random() * 10000),
          satellite_id: satId,
          timestamp: new Date().toISOString(),
          metric_name: type === 'temp_spike' ? 'Temperature' : type === 'battery_drop' ? 'Battery Level' : 'System Control',
          metric_value: type === 'temp_spike' ? 104.5 : type === 'battery_drop' ? 8.2 : 95.0,
          threshold_value: type === 'temp_spike' ? 85.0 : type === 'battery_drop' ? 20.0 : 90.0,
          severity: type === 'system_failure' ? 'Emergency' : 'Critical',
          message: `Mock Anomaly: ${type} triggered on ${satId}`,
          resolved: false
        };
        setAlerts(prev => [newAlert, ...prev]);
        setSystemLogs(prev => [{
          id: Math.floor(Math.random() * 10000),
          service_name: "TelemetrySimulator",
          log_level: "WARNING",
          message: newAlert.message,
          timestamp: newAlert.timestamp
        }, ...prev]);
      }
      return;
    }

    const res = await apiPost(`/system/simulation/anomaly?satellite_id=${satId}&anomaly_type=${type}`);
    if (res) {
      setSuccessMessage(res.message);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Resolve alert
  const resolveAlert = async (alertId: number) => {
    if (token === 'mock-token-offline-mode') {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a));
      return;
    }

    const res = await apiPost(`/alerts/${alertId}/resolve`);
    if (res) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a));
    }
  };

  // Setup live websocket stream
  useEffect(() => {
    if (!token) return;

    if (token === 'mock-token-offline-mode') {
      setSatellites([
        {id: "SAT-001", name: "Aero-SAT 1", type: "LEO Telemetry", launch_date: "2024-03-15", status: "ACTIVE"},
        {id: "SAT-002", name: "Aero-SAT 2", type: "GEO Weather", launch_date: "2024-11-20", status: "ACTIVE"},
        {id: "SAT-003", name: "Aero-SAT 3", type: "MEO Navigation", launch_date: "2025-06-01", status: "ACTIVE"}
      ]);

      setConfigs([
        {key: "SIMULATION_INTERVAL_SEC", value: "1", description: "Interval in seconds between telemetry generations"},
        {key: "BATTERY_LOW_THRESHOLD", value: "20.0", description: "Percentage below which a critical battery alert is generated"},
        {key: "TEMP_HIGH_THRESHOLD", value: "85.0", description: "Celsius above which an emergency temperature alert is generated"},
        {key: "TEMP_LOW_THRESHOLD", value: "-40.0", description: "Celsius below which a warning temperature alert is generated"}
      ]);

      setSystemHealth({
        status: "HEALTHY",
        timestamp: new Date().toISOString(),
        database: "ONLINE (MOCK)",
        services: {
          telemetry_simulator: "RUNNING"
        },
        host_metrics: {
          cpu_usage_percent: 34.5,
          memory_usage_percent: 42.1,
          disk_usage_percent: 18.9
        }
      });

      const initialHistory: Record<string, any[]> = {};
      const initialLive: Record<string, any> = {};
      const timestamp = new Date();

      ['SAT-001', 'SAT-002', 'SAT-003'].forEach((satId, idx) => {
        const satHist = [];
        for (let i = 49; i >= 0; i--) {
          const t = new Date(timestamp.getTime() - i * 1000);
          const angle = (t.getTime() / 20000) + idx;
          const baseBattery = 80 - idx * 5;
          const baseTemp = 20 + idx * 5;
          const altitude = 400 + idx * 5000;
          const velocity = 7.6 - idx * 1.5;

          const lat = 50 * Math.sin(angle);
          const lon = 150 * Math.cos(angle * 0.5);

          const packet = {
            id: i,
            satellite_id: satId,
            timestamp: t.toISOString(),
            orbit_number: 12 + Math.floor(angle / 6.28),
            temperature: Number((baseTemp + Math.sin(angle * 5) * 4).toFixed(2)),
            battery_level: Number(Math.max(0, Math.min(100, baseBattery + Math.cos(angle * 3) * 10)).toFixed(2)),
            solar_panel_voltage: Number((24 + Math.sin(angle) * 3).toFixed(2)),
            power_consumption: Number((95 + Math.cos(angle) * 10).toFixed(2)),
            cpu_usage: Number((15 + Math.random() * 20).toFixed(2)),
            memory_usage: Number((32 + Math.random() * 5).toFixed(2)),
            signal_strength: Number((-70 - Math.random() * 10).toFixed(2)),
            altitude: Number((altitude + Math.sin(angle) * 2).toFixed(2)),
            velocity: Number((velocity + Math.cos(angle) * 0.05).toFixed(3)),
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lon.toFixed(6)),
            roll: Number((Math.sin(angle) * 2).toFixed(3)),
            pitch: Number((Math.cos(angle) * 1.5).toFixed(3)),
            yaw: Number((Math.sin(angle * 0.5) * 5).toFixed(3)),
            fuel_remaining: Number((92 - angle * 0.05).toFixed(2)),
            radiation_level: Number((12 + Math.random() * 3).toFixed(2)),
            communication_status: "CONNECTED",
            gps_lock: true,
            health_status: "HEALTHY",
            error_code: 0,
            packet_loss: Number((Math.random() * 0.2).toFixed(2)),
            uplink_delay: 120 + Math.floor(Math.random() * 20),
            downlink_delay: 110 + Math.floor(Math.random() * 15)
          };
          satHist.push(packet);
          if (i === 0) {
            initialLive[satId] = packet;
          }
        }
        initialHistory[satId] = satHist;
      });

      setLiveTelemetry(initialLive);
      setTelemetryHistory(initialHistory);
      setWsConnected(true);

      let localAngle = 0;
      const interval = setInterval(() => {
        localAngle += 0.05;
        const currentTimestamp = new Date().toISOString();
        const newTelemetry: Record<string, any> = {};

        setTelemetryHistory(prev => {
          const updatedHistory = { ...prev };
          ['SAT-001', 'SAT-002', 'SAT-003'].forEach((satId, idx) => {
            const baseBattery = 80 - idx * 5;
            const baseTemp = 20 + idx * 5;
            const altitude = 400 + idx * 5000;
            const velocity = 7.6 - idx * 1.5;
            
            const lat = 50 * Math.sin(localAngle + idx);
            const lon = 150 * Math.cos(localAngle * 0.5 + idx);

            const packet = {
              id: Math.floor(Math.random() * 100000),
              satellite_id: satId,
              timestamp: currentTimestamp,
              orbit_number: 12 + Math.floor(localAngle / 6.28),
              temperature: Number((baseTemp + Math.sin(localAngle * 5) * 4).toFixed(2)),
              battery_level: Number(Math.max(0, Math.min(100, baseBattery + Math.cos(localAngle * 3) * 10)).toFixed(2)),
              solar_panel_voltage: Number((24 + Math.sin(localAngle) * 3).toFixed(2)),
              power_consumption: Number((95 + Math.cos(localAngle) * 10).toFixed(2)),
              cpu_usage: Number((15 + Math.random() * 20).toFixed(2)),
              memory_usage: Number((32 + Math.random() * 5).toFixed(2)),
              signal_strength: Number((-70 - Math.random() * 10).toFixed(2)),
              altitude: Number((altitude + Math.sin(localAngle) * 2).toFixed(2)),
              velocity: Number((velocity + Math.cos(localAngle) * 0.05).toFixed(3)),
              latitude: Number(lat.toFixed(6)),
              longitude: Number(lon.toFixed(6)),
              roll: Number((Math.sin(localAngle) * 2).toFixed(3)),
              pitch: Number((Math.cos(localAngle) * 1.5).toFixed(3)),
              yaw: Number((Math.sin(localAngle * 0.5) * 5).toFixed(3)),
              fuel_remaining: Number((92 - localAngle * 0.01).toFixed(2)),
              radiation_level: Number((12 + Math.random() * 3).toFixed(2)),
              communication_status: "CONNECTED",
              gps_lock: true,
              health_status: "HEALTHY",
              error_code: 0,
              packet_loss: Number((Math.random() * 0.2).toFixed(2)),
              uplink_delay: 120 + Math.floor(Math.random() * 20),
              downlink_delay: 110 + Math.floor(Math.random() * 15)
            };

            newTelemetry[satId] = packet;
            updatedHistory[satId] = [...(updatedHistory[satId] || []), packet].slice(-50);
          });

          setLiveTelemetry(newTelemetry);
          return updatedHistory;
        });

        setSystemHealth(prev => prev ? {
          ...prev,
          host_metrics: {
            cpu_usage_percent: Number((20 + Math.random() * 25).toFixed(1)),
            memory_usage_percent: Number((40 + Math.random() * 5).toFixed(1)),
            disk_usage_percent: 18.9
          }
        } : null);

        if (Math.random() < 0.15) {
          setSystemLogs(prev => [
            {
              id: Math.floor(Math.random() * 10000),
              service_name: "TelemetrySimulator",
              log_level: "INFO",
              message: `Telemetry heartbeat processed for SAT-001/002/003. Ground track locked.`,
              timestamp: currentTimestamp
            },
            ...prev
          ].slice(0, 50));
        }
      }, 1000);

      return () => clearInterval(interval);
    }

    fetchSystemData();

    // Connect WebSocket
    const connectWS = () => {
      ws.current = new WebSocket(`${WS_BASE_URL}/telemetry/ws`);

      ws.current.onopen = () => {
        setWsConnected(true);
      };

      ws.current.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'telemetry') {
          const packet = payload.data;
          
          // 1. Update live states
          setLiveTelemetry(prev => ({
            ...prev,
            [packet.satellite_id]: packet
          }));

          // 2. Append history limit to 50
          setTelemetryHistory(prev => {
            const satHistory = prev[packet.satellite_id] || [];
            const updated = [...satHistory, packet].slice(-50);
            return {
              ...prev,
              [packet.satellite_id]: updated
            };
          });

          // 3. Append alerts if any
          if (payload.alerts && payload.alerts.length > 0) {
            setAlerts(prev => [...payload.alerts, ...prev].slice(0, 100));
          }
        }
      };

      ws.current.onclose = () => {
        setWsConnected(false);
        // Attempt reconnect after 3s
        setTimeout(() => connectWS(), 3000);
      };
    };

    connectWS();

    // Poll health status every 10s
    const healthInterval = setInterval(() => {
      apiGet('/system/health').then(data => {
        if (data) setSystemHealth(data);
      });
    }, 10000);

    return () => {
      clearInterval(healthInterval);
      if (ws.current) ws.current.close();
    };
  }, [token]);

  // Load secondary tabs
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'settings') {
      apiGet('/system/configs').then(data => { if (data) setConfigs(data); });
    }
  }, [activeTab]);

  // If not authenticated, render Login view
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aerospace-dark relative">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-950/10 rounded-full blur-3xl" />

        <div className="bg-aerospace-card border border-aerospace-border w-full max-w-md p-8 rounded-xl glow-blue relative z-10">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-blue-600/10 p-3 rounded-full border border-blue-500/20 mb-3 text-aerospace-blue">
              <Compass size={40} className="animate-spin-slow" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">AEROSPACE GROUND SYSTEM</h1>
            <p className="text-sm text-gray-400 mt-1">Ground Station Telemetry Gateway</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="bg-red-950/30 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertOctagon size={16} />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Username</label>
              <input 
                type="text" 
                className="w-full bg-aerospace-dark border border-aerospace-border px-4 py-2.5 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono" 
                placeholder="e.g. admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
              <input 
                type="password" 
                className="w-full bg-aerospace-dark border border-aerospace-border px-4 py-2.5 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-3 rounded-lg font-semibold tracking-wider transition-colors flex items-center justify-center gap-2 mt-6 uppercase text-sm"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Authenticate Node'}
            </button>
          </form>

          <div className="mt-6 border-t border-aerospace-border pt-4 text-center">
            <span className="text-xs text-gray-500 font-mono">AUTHORIZED PERSONNEL ONLY</span>
          </div>
        </div>
      </div>
    );
  }

  // Active satellite calculations
  const satTelemetry = liveTelemetry[activeSatellite] || {};
  const currentHistory = telemetryHistory[activeSatellite] || [];

  return (
    <div className="min-h-screen bg-aerospace-dark flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-aerospace-card border-r border-aerospace-border flex flex-col justify-between">
        <div>
          {/* Header/Logo */}
          <div className="p-6 border-b border-aerospace-border flex items-center gap-3">
            <Compass size={28} className="text-aerospace-blue" />
            <div>
              <h2 className="font-bold text-white tracking-wide font-sans">AERO STATION</h2>
              <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Ground Gateway</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {[
              { id: 'overview', name: 'Overview', icon: Activity },
              { id: 'live', name: 'Live Telemetry', icon: Radio },
              { id: 'map', name: 'Satellite Map', icon: Globe },
              { id: 'alerts', name: 'Alert Center', icon: AlertTriangle, badge: alerts.filter(a => !a.resolved).length },
              { id: 'history', name: 'Historical Graphs', icon: Compass },
              { id: 'health', name: 'System Health', icon: Server },
              { id: 'logs', name: 'Gateway Logs', icon: Terminal },
              { id: 'settings', name: 'Settings', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-600/10 text-aerospace-blue border-l-2 border-blue-500 font-bold' 
                      : 'text-gray-400 hover:bg-aerospace-border hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span>{tab.name}</span>
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <span className="bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full text-xs border border-red-500/30">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-aerospace-border bg-[#0E0E0E]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600/20 text-aerospace-blue p-2 rounded-full">
                <User size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-white font-mono uppercase">User Session</p>
                <span className="text-[10px] text-gray-400 font-mono">{role}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
            <span>GATEWAY STATUS:</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span>{wsConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-aerospace-border bg-aerospace-card px-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">
              {activeTab.replace('_', ' ')}
            </h1>

            {/* Satellite Selector */}
            <div className="flex items-center gap-2 bg-aerospace-dark border border-aerospace-border px-3 py-1 rounded-lg">
              <span className="text-xs text-gray-400 font-semibold">Active Node:</span>
              <select 
                value={activeSatellite} 
                onChange={e => setActiveSatellite(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-bold"
              >
                {satellites.length > 0 ? (
                  satellites.map(s => <option key={s.id} value={s.id} className="bg-aerospace-card">{s.name}</option>)
                ) : (
                  <>
                    <option value="SAT-001" className="bg-aerospace-card">SAT-001 (Solvrex-Aero 1)</option>
                    <option value="SAT-002" className="bg-aerospace-card">SAT-002 (Solvrex-Aero 2)</option>
                    <option value="SAT-003" className="bg-aerospace-card">SAT-003 (Solvrex-Aero 3)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {successMessage && (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded text-xs font-mono">
                {successMessage}
              </span>
            )}
            
            <div className="text-xs text-gray-400 font-mono">
              METRIC CYCLE: <span className="text-white font-bold">1s</span>
            </div>
          </div>
        </header>

        {/* View Layout Renderer */}
        <div className="p-8 space-y-6">
          
          {/* Tab Content: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {[
                  { title: 'Battery Level', value: satTelemetry.battery_level ? `${satTelemetry.battery_level}%` : 'N/A', icon: Battery, color: 'text-emerald-500', glow: 'glow-green' },
                  { title: 'Payload Temp', value: satTelemetry.temperature ? `${satTelemetry.temperature}°C` : 'N/A', icon: Thermometer, color: 'text-amber-500', glow: 'glow-gold' },
                  { title: 'Signal Loss', value: satTelemetry.packet_loss ? `${satTelemetry.packet_loss}%` : 'N/A', icon: Wifi, color: 'text-blue-500', glow: 'glow-blue' },
                  { title: 'Orbit Number', value: satTelemetry.orbit_number || 'N/A', icon: Compass, color: 'text-purple-500', glow: 'glow-blue' }
                ].map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div key={i} className={`bg-aerospace-card border border-aerospace-border p-5 rounded-xl flex items-center justify-between ${card.glow}`}>
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{card.title}</span>
                        <h3 className="text-2xl font-bold text-white mt-1.5 font-mono">{card.value}</h3>
                      </div>
                      <div className={`p-3 bg-aerospace-dark border border-aerospace-border rounded-lg ${card.color}`}>
                        <Icon size={24} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic telemetry charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Altitude / Velocity real-time graph */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Altitude / Orbital Speed</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentHistory}>
                        <defs>
                          <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#6B7280" style={{ fontSize: 10 }} />
                        <YAxis stroke="#6B7280" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1F2937' }} labelFormatter={(t) => new Date(t).toLocaleString()} />
                        <Area type="monotone" dataKey="altitude" stroke="#3B82F6" fillOpacity={1} fill="url(#colorAlt)" name="Altitude (km)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Host Diagnostics */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Node Ground Station Health</h3>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-aerospace-dark border border-aerospace-border p-4 rounded-lg text-center">
                      <span className="text-xs text-gray-500 font-bold block">CPU</span>
                      <span className="text-xl font-bold font-mono text-white mt-1 block">
                        {systemHealth?.host_metrics?.cpu_usage_percent?.toFixed(1) || '0.0'}%
                      </span>
                    </div>
                    <div className="bg-aerospace-dark border border-aerospace-border p-4 rounded-lg text-center">
                      <span className="text-xs text-gray-500 font-bold block">RAM</span>
                      <span className="text-xl font-bold font-mono text-white mt-1 block">
                        {systemHealth?.host_metrics?.memory_usage_percent?.toFixed(1) || '0.0'}%
                      </span>
                    </div>
                    <div className="bg-aerospace-dark border border-aerospace-border p-4 rounded-lg text-center">
                      <span className="text-xs text-gray-500 font-bold block">DISK</span>
                      <span className="text-xl font-bold font-mono text-white mt-1 block">
                        {systemHealth?.host_metrics?.disk_usage_percent?.toFixed(1) || '0.0'}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">PostgreSQL Interface</span>
                      <span className="text-emerald-400 font-bold font-mono">ONLINE</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Prometheus Metric Exposer</span>
                      <span className="text-emerald-400 font-bold font-mono">ACTIVE</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Logstash Pipeline Stream</span>
                      <span className="text-blue-400 font-bold font-mono">ESTABLISHED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: LIVE TELEMETRY */}
          {activeTab === 'live' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'BATTERY', value: `${satTelemetry.battery_level || 0}%`, sub: `${satTelemetry.solar_panel_voltage || 0}V Solar` },
                  { label: 'TEMPERATURE', value: `${satTelemetry.temperature || 0}°C`, sub: 'Payload Core' },
                  { label: 'SIGNAL', value: `${satTelemetry.signal_strength || 0} dBm`, sub: `${satTelemetry.packet_loss || 0}% Loss` },
                  { label: 'UPLINK/DOWNLINK', value: `${satTelemetry.uplink_delay || 0}/${satTelemetry.downlink_delay || 0}ms`, sub: 'Latency' },
                  { label: 'HEALTH STATUS', value: satTelemetry.health_status || 'UNKNOWN', sub: `ErrCode: ${satTelemetry.error_code || 0}`, isHealth: true }
                ].map((stat, i) => (
                  <div key={i} className="bg-aerospace-card border border-aerospace-border p-4 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{stat.label}</span>
                    <h4 className={`text-xl font-bold font-mono mt-1.5 ${stat.isHealth ? (stat.value === 'HEALTHY' ? 'text-emerald-500' : 'text-red-500') : 'text-white'}`}>{stat.value}</h4>
                    <span className="text-xs text-gray-400 mt-1 block">{stat.sub}</span>
                  </div>
                ))}
              </div>

              {/* Dynamic telemetry curves */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Battery voltage curve */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Battery vs Power Consumption</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#6B7280" style={{ fontSize: 10 }} />
                        <YAxis stroke="#6B7280" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1F2937' }} />
                        <Line type="monotone" dataKey="battery_level" stroke="#10B981" strokeWidth={2} name="Battery (%)" dot={false} />
                        <Line type="monotone" dataKey="power_consumption" stroke="#F59E0B" strokeWidth={2} name="Power (W)" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Attitude Pitch/Roll/Yaw */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Attitude Vector Dynamics</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentHistory.slice(-15)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#6B7280" style={{ fontSize: 10 }} />
                        <YAxis stroke="#6B7280" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1F2937' }} />
                        <Bar dataKey="roll" fill="#3B82F6" name="Roll (°)" />
                        <Bar dataKey="pitch" fill="#EC4899" name="Pitch (°)" />
                        <Bar dataKey="yaw" fill="#10B981" name="Yaw (°)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CPU/Memory loading */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Satellite Board Compute Load</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#6B7280" style={{ fontSize: 10 }} />
                        <YAxis stroke="#6B7280" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1F2937' }} />
                        <Area type="monotone" dataKey="cpu_usage" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} name="CPU Load (%)" />
                        <Area type="monotone" dataKey="memory_usage" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.1} name="Memory Load (%)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Anomaly simulation control panel (Operator/Admin only) */}
              {['Administrator', 'Operator'].includes(role || '') && (
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4 border-b border-aerospace-border pb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <Sliders size={18} className="text-aerospace-blue" />
                      Satellite Command & Anomaly Injection Console
                    </h3>
                    
                    {/* Simulator switch */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-semibold font-mono">SIMULATION TASK:</span>
                      <button 
                        onClick={() => toggleSimulation(systemHealth?.services?.telemetry_simulator !== 'RUNNING')}
                        className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                          systemHealth?.services?.telemetry_simulator === 'RUNNING' 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {systemHealth?.services?.telemetry_simulator === 'RUNNING' ? 'Running (Stop)' : 'Stopped (Start)'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Inject Battery Drop', type: 'battery_drop' },
                      { label: 'Thermal Overheat', type: 'temp_spike' },
                      { label: 'CPU Overload', type: 'cpu_overload' },
                      { label: 'Signal Degradation', type: 'signal_loss' },
                      { label: 'Critical System Failure', type: 'system_failure' }
                    ].map((btn, idx) => (
                      <button
                        key={idx}
                        onClick={() => injectAnomaly(activeSatellite, btn.type)}
                        className="bg-red-950/20 hover:bg-red-900/20 border border-red-500/20 hover:border-red-500/40 text-red-400 py-3 rounded-lg text-xs font-bold transition-all text-center uppercase tracking-wide"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-aerospace-border flex justify-end">
                    <button
                      onClick={() => injectAnomaly(activeSatellite, 'clear')}
                      className="bg-emerald-950/20 hover:bg-emerald-900/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 px-5 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wide"
                    >
                      Clear Active Anomalies
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: SATELLITE MAP */}
          {activeTab === 'map' && (
            <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Orbital Ground Track (2D Cartesian Grid)</h3>
                  <span className="text-xs text-gray-500 mt-1 block">Live coordinate plotting: latitude vs longitude.</span>
                </div>
                <div className="bg-aerospace-dark border border-aerospace-border px-4 py-2 rounded-lg text-xs font-mono">
                  LAT: <span className="text-white font-bold">{satTelemetry.latitude || 0.0}°</span> | 
                  LON: <span className="text-white font-bold">{satTelemetry.longitude || 0.0}°</span>
                </div>
              </div>

              {/* Grid Simulator for Map plotting */}
              <div className="h-[400px] border border-aerospace-border rounded-xl relative overflow-hidden bg-aerospace-dark flex items-center justify-center">
                {/* Visual coordinate lines */}
                <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 pointer-events-none">
                  {Array.from({ length: 72 }).map((_, i) => (
                    <div key={i} className="border-t border-l border-aerospace-border/10" />
                  ))}
                </div>

                {/* Map Center Coordinates */}
                <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-gray-700/30" />
                <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gray-700/30" />

                {/* Satellite Points */}
                {Object.keys(liveTelemetry).map(satId => {
                  const data = liveTelemetry[satId];
                  if (!data || !data.latitude) return null;
                  
                  // Convert lat (-90 to 90) and lon (-180 to 180) to percentage styles
                  const x = ((data.longitude + 180) / 360) * 100;
                  const y = ((90 - data.latitude) / 180) * 100;

                  return (
                    <div 
                      key={satId} 
                      className="absolute transition-all duration-1000 ease-in-out cursor-pointer group"
                      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                      onClick={() => setActiveSatellite(satId)}
                    >
                      <div className={`relative w-4 h-4 rounded-full border-2 ${
                        satId === activeSatellite ? 'bg-blue-500 border-white glow-blue' : 'bg-gray-600 border-gray-500'
                      }`}>
                        {/* Radar Ping Animation */}
                        <div className={`absolute -inset-2 rounded-full border border-blue-500/40 ping-indicator`} />
                      </div>
                      <span className="absolute left-5 -top-1 bg-aerospace-card border border-aerospace-border text-[9px] font-bold px-1.5 py-0.5 rounded text-white whitespace-nowrap shadow-lg">
                        {satId}
                      </span>
                    </div>
                  );
                })}

                <div className="absolute bottom-4 left-4 text-[10px] text-gray-500 font-mono">
                  PROJECTION: EQUIRECTANGULAR MERCATOR SIMULATION
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: ALERT CENTER */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Active System Anomalies & Alert Logs</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-aerospace-border text-gray-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="pb-3">Timestamp</th>
                        <th className="pb-3">Satellite</th>
                        <th className="pb-3">Metric</th>
                        <th className="pb-3">Value</th>
                        <th className="pb-3">Severity</th>
                        <th className="pb-3">Message</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aerospace-border font-mono text-xs">
                      {alerts.length > 0 ? (
                        alerts.map(alert => (
                          <tr key={alert.id} className={`hover:bg-white/5 transition-colors ${alert.resolved ? 'opacity-55' : ''}`}>
                            <td className="py-3.5">{new Date(alert.timestamp).toLocaleString()}</td>
                            <td className="py-3.5 font-bold text-white">{alert.satellite_id}</td>
                            <td className="py-3.5">{alert.metric_name}</td>
                            <td className="py-3.5 text-gray-300">{alert.metric_value}</td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${
                                alert.severity === 'Emergency' ? 'bg-red-950/40 text-red-500 border-red-500/30' :
                                alert.severity === 'Critical' ? 'bg-orange-950/40 text-orange-500 border-orange-500/30' :
                                alert.severity === 'Warning' ? 'bg-amber-950/40 text-amber-500 border-amber-500/30' :
                                'bg-blue-950/40 text-blue-500 border-blue-500/30'
                              }`}>
                                {alert.severity}
                              </span>
                            </td>
                            <td className="py-3.5 text-gray-400 max-w-xs truncate">{alert.message}</td>
                            <td className="py-3.5 text-right">
                              {alert.resolved ? (
                                <span className="text-emerald-400 font-semibold flex items-center justify-end gap-1.5">
                                  <CheckCircle2 size={14} /> Resolved
                                </span>
                              ) : (
                                ['Administrator', 'Operator'].includes(role || '') ? (
                                  <button
                                    onClick={() => resolveAlert(alert.id)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors"
                                  >
                                    Resolve
                                  </button>
                                ) : (
                                  <span className="text-red-500 font-bold">Unresolved</span>
                                )
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-500 font-sans">
                            No system anomalies logged. System telemetry is stable.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: HISTORICAL GRAPHS */}
          {activeTab === 'history' && (
            <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-aerospace-border pb-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Historical Telemetry Plotter</h3>
                  <span className="text-xs text-gray-500 mt-1 block">Fetch satellite telemetry logs by custom time intervals.</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Start Time</label>
                    <input 
                      type="datetime-local" 
                      value={histStart} 
                      onChange={e => setHistStart(e.target.value)}
                      className="bg-aerospace-dark border border-aerospace-border px-3 py-2 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">End Time</label>
                    <input 
                      type="datetime-local" 
                      value={histEnd} 
                      onChange={e => setHistEnd(e.target.value)}
                      className="bg-aerospace-dark border border-aerospace-border px-3 py-2 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={loadHistoricalTelemetry}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={14} /> : 'Fetch Logs'}
                  </button>
                </div>
              </div>

              {historicalData.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {/* Altitude History Chart */}
                  <div className="border border-aerospace-border bg-aerospace-dark/40 p-5 rounded-xl">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Altitude Range (km)</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historicalData}>
                          <defs>
                            <linearGradient id="histAlt" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#6B7280" />
                          <YAxis stroke="#6B7280" />
                          <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1F2937' }} />
                          <Area type="monotone" dataKey="altitude" stroke="#3B82F6" fillOpacity={1} fill="url(#histAlt)" name="Altitude (km)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Battery decay and Solar charge */}
                  <div className="border border-aerospace-border bg-aerospace-dark/40 p-5 rounded-xl">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Power & Battery Tracking</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historicalData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#6B7280" />
                          <YAxis stroke="#6B7280" />
                          <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#1F2937' }} />
                          <Line type="monotone" dataKey="battery_level" stroke="#10B981" strokeWidth={2} name="Battery (%)" dot={false} />
                          <Line type="monotone" dataKey="power_consumption" stroke="#F59E0B" strokeWidth={2} name="Power (W)" dot={false} />
                          <Line type="monotone" dataKey="solar_panel_voltage" stroke="#EF4444" strokeWidth={2} name="Solar Voltage (V)" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-gray-500">
                  Select start and end timestamps and click "Fetch Logs" to display historical comparisons.
                </div>
              )}
            </div>
          )}

          {/* Tab Content: SYSTEM HEALTH */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Node Exporter Diagnostics */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Ground Node Exporter</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                        <span>NODE CPU USAGE</span>
                        <span>{systemHealth?.host_metrics?.cpu_usage_percent?.toFixed(1) || '0.0'}%</span>
                      </div>
                      <div className="w-full bg-aerospace-dark h-2 rounded-full overflow-hidden border border-aerospace-border">
                        <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${systemHealth?.host_metrics?.cpu_usage_percent || 0}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                        <span>PHYSICAL RAM LOAD</span>
                        <span>{systemHealth?.host_metrics?.memory_usage_percent?.toFixed(1) || '0.0'}%</span>
                      </div>
                      <div className="w-full bg-aerospace-dark h-2 rounded-full overflow-hidden border border-aerospace-border">
                        <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${systemHealth?.host_metrics?.memory_usage_percent || 0}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                        <span>ROOT DISK USAGE</span>
                        <span>{systemHealth?.host_metrics?.disk_usage_percent?.toFixed(1) || '0.0'}%</span>
                      </div>
                      <div className="w-full bg-aerospace-dark h-2 rounded-full overflow-hidden border border-aerospace-border">
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${systemHealth?.host_metrics?.disk_usage_percent || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Database Connection pools */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">PostgreSQL DB Pool</h3>
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">DATABASE:</span>
                        <span className="text-white font-bold">telemetry_db</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">INTERFACE STATUS:</span>
                        <span className="text-emerald-400 font-bold">CONNECTED</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">QUERY ENGINE:</span>
                        <span className="text-white">SQLAlchemy + asyncpg</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-aerospace-border pt-4 mt-4 text-[10px] text-gray-500 font-mono">
                    HEALTH PROBE: SELECT 1 (OK)
                  </div>
                </div>

                {/* Kubernetes Orchestrator mock states */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Kubernetes Pod Status</h3>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-white">ground-station-backend</span>
                      </div>
                      <span className="text-gray-500">2/2 RUNNING</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-white">ground-station-frontend</span>
                      </div>
                      <span className="text-gray-500">2/2 RUNNING</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-white">postgres-db-0</span>
                      </div>
                      <span className="text-gray-500">1/1 RUNNING</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-white">observability-prometheus</span>
                      </div>
                      <span className="text-gray-500">1/1 RUNNING</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* System Logs */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl flex flex-col h-[500px]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                    <Terminal size={16} className="text-blue-500" />
                    FastAPI Server System Logs
                  </h3>
                  <div className="bg-aerospace-dark border border-aerospace-border rounded-lg p-4 font-mono text-[11px] text-gray-300 flex-1 overflow-y-auto space-y-2">
                    {systemLogs.length > 0 ? (
                      systemLogs.map(log => (
                        <div key={log.id} className="leading-5">
                          <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                          <span className={`font-bold ${log.log_level === 'ERROR' ? 'text-red-500' : 'text-amber-500'}`}>
                            {log.log_level}
                          </span>{' '}
                          <span className="text-blue-400">({log.service_name}):</span>{' '}
                          <span>{log.message}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-600 mt-20">No system logs loaded.</div>
                    )}
                  </div>
                </div>

                {/* Audit Logs (Admin only) */}
                <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl flex flex-col h-[500px]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                    <Shield size={16} className="text-emerald-500" />
                    Security & RBAC Audit Logs
                  </h3>
                  {role === 'Administrator' ? (
                    <div className="bg-aerospace-dark border border-aerospace-border rounded-lg p-4 font-mono text-[11px] text-gray-300 flex-1 overflow-y-auto space-y-2">
                      {auditLogs.length > 0 ? (
                        auditLogs.map(log => (
                          <div key={log.id} className="leading-5 border-b border-white/5 pb-1">
                            <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                            <span className="text-emerald-400 font-bold">{log.action}</span> |{' '}
                            <span className="text-white">Target: {log.target}</span> -{' '}
                            <span className="text-gray-400">{log.details}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-600 mt-20">No audit logs logged.</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-aerospace-dark/40 border border-aerospace-border rounded-lg">
                      <span className="text-xs text-red-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        <AlertOctagon size={16} /> Restricted: Administrator Role Required
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-aerospace-card border border-aerospace-border p-6 rounded-xl space-y-6">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">System Parameters Configurations</h3>
                <span className="text-xs text-gray-500 mt-1 block">Adjust notification limits and anomaly threshold parameters.</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-aerospace-border text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="pb-3">Parameter Key</th>
                      <th className="pb-3">Current Threshold Value</th>
                      <th className="pb-3">Definition/Description</th>
                      <th className="pb-3 text-right">Access Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aerospace-border font-mono text-xs">
                    {configs.map((config, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 font-bold text-white">{config.key}</td>
                        <td className="py-3.5 text-blue-400">{config.value}</td>
                        <td className="py-3.5 text-gray-400">{config.description}</td>
                        <td className="py-3.5 text-right text-gray-500">
                          {config.key.includes('SIMULATION') ? 'Operator / Admin' : 'Administrator'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
