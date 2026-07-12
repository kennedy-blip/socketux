import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Radio, Zap, PlugZap, Plug, Wifi, Activity, Send, Download, RefreshCw,
  Trash2, Search, Copy, Check, Eye, ChevronRight, Terminal, Braces,
  Layers, Clock3, Database, ShieldCheck, Globe, Code2, Cable,
  ArrowUpRight, ArrowDownLeft, Info, AlertTriangle, X, Play, Pause,
  Settings2, Hash, FileJson, Sparkles, Signal, Timer, ArrowUpDown
} from 'lucide-react';

// Types
type Direction = 'sent' | 'received' | 'system';
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type TabId = 'websocket' | 'sse' | 'builder' | 'logs';

interface Frame {
  id: string;
  direction: Direction;
  payload: string;
  timestamp: Date;
  size: number;
  opcode?: string;
  latency?: number;
  headers?: Record<string, string>;
}

// Presets
const PRESETS = [
  { id: 'subscribe', label: 'subscribe', json: `{\n  "action": "subscribe",\n  "channel": "live_prices",\n  "symbols": ["BTC-USD", "ETH-USD"]\n}` },
  { id: 'ping', label: 'ping', json: `{\n  "type": "ping",\n  "timestamp": "{{now}}",\n  "id": "hb_001"\n}` },
  { id: 'auth_refresh', label: 'auth_refresh', json: `{\n  "action": "auth_refresh",\n  "token": "Bearer eyJhbGci..."\n}` },
  { id: 'broadcast', label: 'broadcast', json: `{\n  "event": "broadcast",\n  "room": "global",\n  "message": "Hello from SocketPulse!",\n  "priority": "high"\n}` },
  { id: 'join_room', label: 'join_room', json: `{\n  "action": "join",\n  "room": "dev-console",\n  "user": "socketpulse_user"\n}` },
  { id: 'unsubscribe', label: 'unsubscribe', json: `{\n  "action": "unsubscribe",\n  "channel": "live_prices"\n}` },
]

const MOCK_INCOMING = [
  `{"event":"price_update","symbol":"BTC-USD","price":68421.12,"change":1.24}`,
  `{"event":"heartbeat","ts":1715600000,"latency":12}`,
  `{"type":"ack","id":"hb_001","status":"ok"}`,
  `{"user":"alex joined","room":"global","online":142}`,
  `{"event":"broadcast","from":"system","msg":"Deployment completed v2.4.1"}`,
  `{"error":null,"data":{"balance":4250.00,"currency":"USD"}}`,
]

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('websocket');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [protocol, setProtocol] = useState('wss://');
  const [url, setUrl] = useState('echo.websocket.events');
  const [authToken, setAuthToken] = useState('');
  const [customHeaderKey, setCustomHeaderKey] = useState('X-Client');
  const [customHeaderVal, setCustomHeaderVal] = useState('SocketPulse/1.0');
  const [latency, setLatency] = useState(18);
  const [frames, setFrames] = useState<Frame[]>(() => [
    { id: '1', direction: 'sent', payload: `{"action":"subscribe","channel":"live_prices"}`, timestamp: new Date(Date.now() - 1000 * 62), size: 48, opcode: 'TEXT', latency: 14 },
    { id: '2', direction: 'received', payload: `{"event":"subscribed","channel":"live_prices","ok":true}`, timestamp: new Date(Date.now() - 1000 * 60), size: 54, opcode: 'TEXT', latency: 12 },
    { id: '3', direction: 'sent', payload: `{"type":"ping"}`, timestamp: new Date(Date.now() - 1000 * 45), size: 15, opcode: 'PING' },
    { id: '4', direction: 'received', payload: `{"type":"pong","ts":1715600023}`, timestamp: new Date(Date.now() - 1000 * 44), size: 28, opcode: 'PONG', latency: 18 },
    { id: '5', direction: 'received', payload: `{"event":"price_update","symbol":"ETH-USD","price":3421.88}`, timestamp: new Date(Date.now() - 1000 * 20), size: 62, opcode: 'TEXT' },
  ]);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [payloadText, setPayloadText] = useState(PRESETS[0].json);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDir, setFilterDir] = useState<'all' | Direction>('all');
  const [sseConnected, setSseConnected] = useState(false);
  const [sseUrl, setSseUrl] = useState('api.stream.live/events');
  const [sseEvents, setSseEvents] = useState<Frame[]>([
    { id: 'sse1', direction: 'received', payload: `event: price\n data: {"symbol":"BTC-USD","price":68400}`, timestamp: new Date(Date.now() - 5000), size: 44, opcode: 'SSE' },
    { id: 'sse2', direction: 'received', payload: `event: heartbeat\n data: {"ts":171560000}`, timestamp: new Date(Date.now() - 2000), size: 32, opcode: 'SSE' },
  ]);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const latencyInterval = useRef<number | null>(null);
  const mockInterval = useRef<number | null>(null);

  const fullUrl = `${protocol}${url}`;

  // Latency ticker
  useEffect(() => {
    if (connectionState === 'connected') {
      latencyInterval.current = window.setInterval(() => {
        setLatency(Math.floor(14 + Math.random() * 28));
      }, 1400);
    } else {
      if (latencyInterval.current) clearInterval(latencyInterval.current);
    }
    return () => { if (latencyInterval.current) clearInterval(latencyInterval.current); };
  }, [connectionState]);

  // Mock incoming frames when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      mockInterval.current = window.setInterval(() => {
        if (Math.random() > 0.55) {
          const payload = MOCK_INCOMING[Math.floor(Math.random() * MOCK_INCOMING.length)];
          const f: Frame = {
            id: Math.random().toString(36).slice(2, 9),
            direction: 'received',
            payload,
            timestamp: new Date(),
            size: new Blob([payload]).size,
            opcode: 'TEXT',
            latency: Math.floor(8 + Math.random() * 20)
          };
          setFrames(prev => [f, ...prev].slice(0, 100));
        }
      }, 2500);
    } else {
      if (mockInterval.current) clearInterval(mockInterval.current);
    }
    return () => { if (mockInterval.current) clearInterval(mockInterval.current); };
  }, [connectionState]);

  // SSE mock
  useEffect(() => {
    if (!sseConnected) return;
    const id = window.setInterval(() => {
      const payload = `event: update\nid: ${Date.now()}\ndata: ${MOCK_INCOMING[Math.floor(Math.random() * MOCK_INCOMING.length)]}`;
      setSseEvents(prev => [{ id: Math.random().toString(36).slice(2), direction: 'received' as Direction, payload, timestamp: new Date(), size: payload.length, opcode: 'SSE' }, ...prev].slice(0, 50));
    }, 1800);
    return () => clearInterval(id);
  }, [sseConnected]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [frames, autoScroll]);

  const handleConnect = () => {
    if (connectionState === 'connected') {
      setConnectionState('disconnected');
      showToast('Socket disconnected');
    } else {
      setConnectionState('connecting');
      setTimeout(() => {
        setConnectionState('connected');
        const sys: Frame = { id: Date.now().toString(), direction: 'system' as Direction, payload: `Handshake successful → ${fullUrl} (101 Switching Protocols)`, timestamp: new Date(), size: 0, opcode: 'SYSTEM' };
        setFrames(p => [sys, ...p]);
        showToast('Connected to ' + fullUrl);
      }, 900);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const validateAndSend = () => {
    try {
      // replace {{now}} token
      let text = payloadText.replace('{{now}}', Date.now().toString());
      JSON.parse(text);
      setPayloadError(null);
      const f: Frame = {
        id: Math.random().toString(36).slice(2, 9),
        direction: 'sent',
        payload: text,
        timestamp: new Date(),
        size: new Blob([text]).size,
        opcode: 'TEXT',
        latency
      };
      setFrames(prev => [f, ...prev]);
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 600);
      showToast('Frame sent • ' + f.size + ' bytes');
      // echo back after short delay
      setTimeout(() => {
        const echo: Frame = { id: Math.random().toString(36).slice(2), direction: 'received', payload: `{"echo":${text},"ack":true}`, timestamp: new Date(), size: text.length + 14, opcode: 'TEXT', latency: Math.floor(10 + Math.random() * 15) };
        setFrames(prev => [echo, ...prev]);
      }, 700);
    } catch (e: any) {
      setPayloadError(e.message);
    }
  };

  const exportLog = () => {
    const data = JSON.stringify(frames, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `socketpulse-log-${Date.now()}.json`;
    a.click();
    showToast('Message log exported');
  };

  const copyFrame = (f: Frame) => {
    navigator.clipboard.writeText(f.payload);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredFrames = useMemo(() => {
    return frames.filter(f => {
      const matchSearch = !search || f.payload.toLowerCase().includes(search.toLowerCase()) || f.opcode?.toLowerCase().includes(search.toLowerCase());
      const matchDir = filterDir === 'all' || f.direction === filterDir;
      return matchSearch && matchDir;
    });
  }, [frames, search, filterDir]);

  const jsonTree = (str: string) => {
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch { return str; }
  };

  return (
    <div className="min-h-screen bg-[#060a14] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-100">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800;900&display=swap'); *{font-family:Inter,sans-serif} .mono{font-family:'JetBrains Mono',monospace}`}</style>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[700px] h-[700px] bg-cyan-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-emerald-600/5 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#060a14]/80 border-b border-white/[0.06]">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6">
          <div className="h-[64px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#060a14] animate-pulse shadow shadow-emerald-500/50" />
              </div>
              <div>
                <h1 className="text-[18px] font-black tracking-tight leading-none flex items-center gap-2">
                  SocketPulse <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase bg-white/10 border border-white/10 px-2 py-0.5 rounded-full">LIVE</span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block -mt-0.5">Real-Time Connection Debugger</p>
              </div>
            </div>

            {/* Status Badge - desktop */}
            <div className="hidden lg:flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${connectionState === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : connectionState === 'connecting' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                <span className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-emerald-400 animate-pulse' : connectionState === 'connecting' ? 'bg-amber-400 animate-ping' : 'bg-red-400'}`} />
                Connection: {connectionState === 'connected' ? `Connected (${fullUrl})` : connectionState === 'connecting' ? 'Handshaking...' : 'Disconnected'}
              </div>
              <div className="flex items-center gap-2 text-xs bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-full">
                <Timer className="w-3.5 h-3.5 text-cyan-400" />
                <span className="mono font-bold">{latency}ms</span>
                <span className="w-1 h-1 bg-white/30 rounded-full" />
                <Signal className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => { handleConnect(); }} className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition">
                <RefreshCw className={`w-3.5 h-3.5 ${connectionState === 'connecting' ? 'animate-spin' : ''}`} /> Reconnect Socket
              </button>
              <button onClick={exportLog} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-semibold hover:bg-white/15 transition">
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export Log</span><span className="sm:hidden">Export</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-3 -mb-px">
            {[
              { id: 'websocket', label: 'WebSocket Inspector', icon: Cable, count: frames.length },
              { id: 'sse', label: 'SSE Streamer', icon: Activity, count: sseEvents.length },
              { id: 'builder', label: 'Payload Builder', icon: Braces, count: null },
              { id: 'logs', label: 'Connection Logs', icon: Database, count: frames.length + sseEvents.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition border ${activeTab === tab.id ? 'bg-white text-slate-900 border-white shadow' : 'bg-white/[0.06] text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== null && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold mono ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white/10 text-slate-300'}`}>{tab.count}</span>
                )}
              </button>
            ))}
            <div className="ml-auto hidden xl:flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> TLS 1.3 • wss • JSON
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6 relative">
        {activeTab === 'websocket' && (
          <div className="grid grid-cols-12 gap-5">
            {/* Left: Connection Panel + Payload Sender */}
            <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-5">
              {/* Connection & Handshake Panel */}
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
                  <h2 className="text-sm font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-400" /> Connection & Handshake</h2>
                  <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full border ${connectionState === 'connected' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-white/10 text-slate-300 border-white/10'}`}>{connectionState}</span>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-2 flex items-center gap-1"><Hash className="w-3 h-3" /> Endpoint URL</label>
                    <div className="flex gap-2">
                      <select value={protocol} onChange={e => setProtocol(e.target.value)} className="bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold mono text-cyan-300 outline-none focus:border-cyan-500/50 w-[84px]">
                        <option>wss://</option>
                        <option>ws://</option>
                        <option>http://</option>
                      </select>
                      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="echo.websocket.events" className="flex-1 bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2.5 text-xs mono outline-none focus:border-cyan-500/50 placeholder:text-slate-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-1 block">Auth Token</label>
                      <input value={authToken} onChange={e => setAuthToken(e.target.value)} placeholder="Bearer eyJ..." className="w-full bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2.5 text-xs mono outline-none focus:border-violet-500/50 placeholder:text-slate-500" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-1 block">Latency Ping</label>
                      <div className="bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <span className="text-xs font-bold mono flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-emerald-400" />{latency}ms</span>
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-2 block">Custom Headers</label>
                    <div className="flex gap-2">
                      <input value={customHeaderKey} onChange={e => setCustomHeaderKey(e.target.value)} className="flex-1 bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2 text-xs mono outline-none focus:border-white/20" />
                      <input value={customHeaderVal} onChange={e => setCustomHeaderVal(e.target.value)} className="flex-1 bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2 text-xs mono outline-none focus:border-white/20" />
                    </div>
                  </div>

                  <button
                    onClick={handleConnect}
                    className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${connectionState === 'connected' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-red-500/20 hover:from-red-600 hover:to-orange-600' : connectionState === 'connecting' ? 'bg-amber-500 text-white animate-pulse' : 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-cyan-500/20 hover:from-cyan-600 hover:to-violet-600'}`}
                  >
                    {connectionState === 'connected' ? <><Plug className="w-4 h-4" /> Disconnect</> : connectionState === 'connecting' ? <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting...</> : <><PlugZap className="w-4 h-4" /> Connect</>}
                  </button>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { k: 'Uptime', v: connectionState === 'connected' ? '02:14:08' : '00:00:00', icon: Clock3 },
                      { k: 'Frames', v: frames.length.toString(), icon: Layers },
                      { k: 'Throughput', v: '1.2 KB/s', icon: ArrowUpDown },
                    ].map(s => (
                      <div key={s.k} className="bg-[#0f1424] border border-white/5 rounded-xl p-2.5 text-center">
                        <s.icon className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                        <div className="text-[10px] tracking-widest uppercase font-bold text-slate-400">{s.k}</div>
                        <div className="text-xs font-bold mono text-white">{s.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payload Sender */}
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Send className="w-4 h-4 text-violet-400" /> Quick Sender</h3>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">JSON • VALIDATED</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => setPayloadText(p.json)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${payloadText.includes(`"${p.label}"`) || payloadText.includes(p.label) ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}>{p.label}</button>
                    ))}
                  </div>

                  <div className="relative">
                    <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-slate-500"><FileJson className="w-3 h-3" /> Payload</div>
                    <textarea
                      value={payloadText}
                      onChange={e => { setPayloadText(e.target.value); try { JSON.parse(e.target.value.replace('{{now}}', '0')); setPayloadError(null); } catch (err: any) { setPayloadError(err.message); } }}
                      rows={8}
                      className="w-full bg-[#080c1a] border border-white/10 rounded-xl pt-7 px-3 pb-3 text-xs mono leading-relaxed outline-none focus:border-cyan-500/40 resize-none"
                      spellCheck={false}
                    />
                    {payloadError && (
                      <div className="mt-2 flex items-center gap-2 text-xs bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2 rounded-xl">
                        <AlertTriangle className="w-3.5 h-3.5" /> {payloadError}
                      </div>
                    )}
                    {!payloadError && payloadText && (
                      <div className="mt-2 flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-2 rounded-xl">
                        <Check className="w-3.5 h-3.5" /> Valid JSON • {new Blob([payloadText]).size} bytes
                      </div>
                    )}
                  </div>

                  <button onClick={validateAndSend} disabled={!!payloadError || connectionState !== 'connected'} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:from-cyan-600 hover:to-blue-700 transition shadow-lg shadow-cyan-600/20">
                    <Zap className="w-4 h-4" /> Send Frame
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">Press <span className="mono bg-white/10 px-1.5 py-0.5 rounded">⌘+Enter</span> to send • Auto-validated</p>
                </div>
              </div>
            </div>

            {/* Center: Live Frame Exchange Stream */}
            <div className="col-span-12 lg:col-span-8 xl:col-span-6">
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden flex flex-col h-[760px]">
                <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Live Frame Exchange Stream</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payload, opcode..." className="bg-[#0f1424] border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs outline-none focus:border-white/20 w-[180px] placeholder:text-slate-500" />
                    </div>
                    <select value={filterDir} onChange={e => setFilterDir(e.target.value as any)} className="bg-[#0f1424] border border-white/10 rounded-full px-3 py-1.5 text-xs font-bold outline-none">
                      <option value="all">All</option>
                      <option value="sent">Sent</option>
                      <option value="received">Received</option>
                      <option value="system">System</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full cursor-pointer">
                      <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="accent-cyan-500" /> Auto-scroll
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-2 bg-[#0f1424]/60 border-b border-white/5 text-[11px] font-bold tracking-widest uppercase text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-cyan-400 rounded-full" /> Sent</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-full" /> Received</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-full" /> System</span>
                  <span className="ml-auto flex items-center gap-1"><Clock3 className="w-3 h-3" /> {filteredFrames.length} frames</span>
                  <button onClick={() => setFrames([])} className="ml-2 flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10"><Trash2 className="w-3 h-3" /> Clear</button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-auto divide-y divide-white/5">
                  {filteredFrames.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 text-slate-400">
                      <Terminal className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm font-semibold">No frames match</p>
                      <p className="text-xs">Try changing filters or send a new payload</p>
                    </div>
                  ) : filteredFrames.map(f => (
                    <div key={f.id} onClick={() => setSelectedFrame(f)} className={`group px-5 py-3 hover:bg-white/[0.04] cursor-pointer flex items-start gap-3 transition ${selectedFrame?.id === f.id ? 'bg-cyan-500/10' : ''}`}>
                      <div className={`mt-1 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${f.direction === 'sent' ? 'bg-cyan-500/15 border-cyan-500/20 text-cyan-300' : f.direction === 'received' ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/15 border-amber-500/20 text-amber-300'}`}>
                        {f.direction === 'sent' ? <ArrowUpRight className="w-4 h-4" /> : f.direction === 'received' ? <ArrowDownLeft className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase border ${f.direction === 'sent' ? 'bg-cyan-500 text-white border-cyan-400' : f.direction === 'received' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-amber-500 text-white border-amber-400'}`}>{f.direction === 'sent' ? 'SENT' : f.direction === 'received' ? 'RECEIVED' : 'SYSTEM'}</span>
                          <span className="text-[11px] mono text-slate-400 flex items-center gap-1"><Clock3 className="w-3 h-3" />{f.timestamp.toLocaleTimeString()}</span>
                          <span className="text-[11px] mono bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-full">{f.size} B</span>
                          {f.opcode && <span className="text-[11px] mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">{f.opcode}</span>}
                          {f.latency && <span className="text-[11px] mono text-emerald-300">{f.latency}ms</span>}
                        </div>
                        <div className="mono text-xs text-slate-200 mt-1 truncate">{f.payload}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); copyFrame(f); }} className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10">
                          {copiedId === f.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
                      </div>
                    </div>
                  ))}
                </div>

                {isTyping && (
                  <div className="px-5 py-2 border-t border-white/10 bg-cyan-500/10 text-xs flex items-center gap-2 text-cyan-200">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" /> Sending frame...
                  </div>
                )}
              </div>
            </div>

            {/* Right: Frame Inspector */}
            <div className="col-span-12 xl:col-span-3 space-y-5">
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden min-h-[760px] flex flex-col">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Eye className="w-4 h-4 text-cyan-400" /> Frame Inspector</h3>
                  <div className="flex items-center gap-1 bg-[#0f1424] border border-white/10 rounded-full p-1">
                    <button onClick={() => setShowRaw(false)} className={`px-3 py-1 rounded-full text-xs font-bold ${!showRaw ? 'bg-white text-slate-900' : 'text-slate-400'}`}>Pretty</button>
                    <button onClick={() => setShowRaw(true)} className={`px-3 py-1 rounded-full text-xs font-bold ${showRaw ? 'bg-white text-slate-900' : 'text-slate-400'}`}>Raw</button>
                  </div>
                </div>

                {!selectedFrame ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                      <Braces className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-white">No frame selected</p>
                    <p className="text-xs mt-1">Click any message frame to reveal formatted JSON trees, headers and opcode details.</p>
                    <div className="mt-6 w-full bg-[#0f1424] border border-white/10 rounded-xl p-3 text-left">
                      <div className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-2">Quick Tips</div>
                      <ul className="text-xs space-y-1.5 text-slate-300">
                        <li className="flex gap-2"><span className="text-cyan-400">•</span> Cyan = sent, Emerald = received</li>
                        <li className="flex gap-2"><span className="text-cyan-400">•</span> Copy payload with one click</li>
                        <li className="flex gap-2"><span className="text-cyan-400">•</span> Search supports opcode & JSON keys</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${selectedFrame.direction === 'sent' ? 'bg-cyan-500 text-white' : selectedFrame.direction === 'received' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>{selectedFrame.direction}</span>
                        <span className="mono text-xs text-slate-400">{selectedFrame.timestamp.toLocaleString()}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#0f1424] border border-white/10 rounded-xl p-3">
                          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Size</div>
                          <div className="mono text-sm font-bold">{selectedFrame.size} B</div>
                        </div>
                        <div className="bg-[#0f1424] border border-white/10 rounded-xl p-3">
                          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Opcode</div>
                          <div className="mono text-sm font-bold">{selectedFrame.opcode || '-'}</div>
                        </div>
                        <div className="bg-[#0f1424] border border-white/10 rounded-xl p-3">
                          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Latency</div>
                          <div className="mono text-sm font-bold">{selectedFrame.latency ? `${selectedFrame.latency}ms` : '-'}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2 flex items-center justify-between">
                          Payload
                          <button onClick={() => copyFrame(selectedFrame)} className="px-2 py-1 rounded-full bg-white text-slate-900 text-[11px] font-bold flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                        </div>
                        <pre className="mono text-xs bg-[#080c1a] border border-white/10 rounded-xl p-3 overflow-auto max-h-[300px] whitespace-pre-wrap break-words leading-relaxed">
                          {showRaw ? selectedFrame.payload : jsonTree(selectedFrame.payload)}
                        </pre>
                      </div>

                      <div>
                        <div className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Headers</div>
                        <div className="bg-[#0f1424] border border-white/10 rounded-xl p-3 space-y-1.5 mono text-xs">
                          <div className="flex justify-between"><span className="text-slate-400">Content-Type</span><span>application/json</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">X-Request-ID</span><span>{selectedFrame.id}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Sec-WebSocket-Version</span><span>13</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Authorization</span><span className="truncate max-w-[140px]">{authToken || '—'}</span></div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => setSelectedFrame(null)} className="flex-1 py-2 rounded-xl bg-white/10 border border-white/10 text-xs font-bold flex items-center justify-center gap-2"><X className="w-3.5 h-3.5" /> Close</button>
                        <button onClick={() => { setPayloadText(selectedFrame.payload); showToast('Loaded into editor'); }} className="flex-1 py-2 rounded-xl bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Resend</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sse' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-4 space-y-5">
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2"><Wifi className="w-4 h-4 text-emerald-400" /> SSE Streamer</h2>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold border ${sseConnected ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-white/10 text-slate-300 border-white/10'}`}>{sseConnected ? 'STREAMING' : 'IDLE'}</span>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-2 block">SSE Endpoint</label>
                    <div className="flex gap-2">
                      <span className="bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold mono text-emerald-300">http://</span>
                      <input value={sseUrl} onChange={e => setSseUrl(e.target.value)} className="flex-1 bg-[#0f1424] border border-white/10 rounded-xl px-3 py-2.5 text-xs mono outline-none focus:border-emerald-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0f1424] border border-white/10 rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Events Received</div>
                      <div className="text-lg font-black mono">{sseEvents.length}</div>
                    </div>
                    <div className="bg-[#0f1424] border border-white/10 rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Last Event</div>
                      <div className="text-xs font-bold mono">{sseEvents[0] ? new Date(sseEvents[0].timestamp).toLocaleTimeString() : '--:--:--'}</div>
                    </div>
                  </div>
                  <button onClick={() => setSseConnected(v => !v)} className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg ${sseConnected ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/20'}`}>
                    {sseConnected ? <><Pause className="w-4 h-4" /> Stop Stream</> : <><Play className="w-4 h-4" /> Start SSE Stream</>}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setSseEvents([])} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center justify-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
                    <button onClick={() => { const blob = new Blob([JSON.stringify(sseEvents, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sse-log.json'; a.click(); }} className="flex-1 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold flex items-center justify-center gap-2"><Download className="w-3.5 h-3.5" /> Export</button>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white border border-white/10">
                <h3 className="font-bold flex items-center gap-2"><Code2 className="w-4 h-4" /> How SSE Works</h3>
                <p className="text-xs opacity-90 mt-2 leading-relaxed">Server-Sent Events use a single HTTP connection to push updates. Ideal for live feeds, notifications, and price tickers without WebSocket overhead.</p>
                <div className="mt-3 mono text-xs bg-black/20 rounded-xl p-3 border border-white/10">
                  const es = new EventSource('/events');<br />
                  es.onmessage = e =&gt; console.log(e.data);
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8">
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden flex flex-col h-[620px]">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Live Event Feed</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    {sseConnected ? 'Receiving...' : 'Paused'}
                  </div>
                </div>
                <div className="flex-1 overflow-auto divide-y divide-white/5">
                  {sseEvents.map(e => (
                    <div key={e.id} className="px-5 py-3 flex gap-3 hover:bg-white/[0.03]">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-300"><ArrowDownLeft className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black">SSE</span>
                          <span className="mono text-slate-400">{e.timestamp.toLocaleTimeString()}</span>
                          <span className="mono bg-white/10 px-1.5 py-0.5 rounded-full text-[11px]">{e.size} B</span>
                        </div>
                        <pre className="mono text-xs mt-1 whitespace-pre-wrap break-words bg-[#0f1424] border border-white/5 rounded-xl p-2.5">{e.payload}</pre>
                      </div>
                    </div>
                  ))}
                  {sseEvents.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">No events yet. Start the stream.</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2"><Settings2 className="w-4 h-4 text-cyan-400" /> Payload Builder</h2>
                  <span className="text-xs bg-white/10 border border-white/10 px-3 py-1 rounded-full">Drag • Drop • Generate</span>
                </div>
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { title: 'Event Type', options: ['subscribe', 'unsubscribe', 'publish', 'broadcast'] },
                      { title: 'Channel', options: ['live_prices', 'chat_global', 'notifications', 'system'] },
                      { title: 'Priority', options: ['low', 'medium', 'high', 'critical'] },
                      { title: 'Encoding', options: ['json', 'msgpack', 'cbor'] },
                    ].map(section => (
                      <div key={section.title} className="bg-[#0f1424] border border-white/10 rounded-2xl p-4">
                        <div className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-2">{section.title}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {section.options.map(o => (
                            <button key={o} onClick={() => {
                              const patch = `"${section.title.toLowerCase().replace(' ', '_')}": "${o}"`;
                              setPayloadText(prev => {
                                try {
                                  const obj = JSON.parse(prev);
                                  obj[section.title.toLowerCase().replace(' ', '_')] = o;
                                  return JSON.stringify(obj, null, 2);
                                } catch { return prev + `,\n  ${patch}`; }
                              });
                            }} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10 hover:text-white transition">{o}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#080c1a] border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2"><FileJson className="w-4 h-4" /> Generated Payload</div>
                      <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(payloadText); showToast('Payload copied'); }} className="px-3 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                        <button onClick={validateAndSend} className="px-3 py-1.5 rounded-full bg-cyan-500 text-white text-xs font-bold flex items-center gap-1"><Send className="w-3 h-3" /> Send</button>
                      </div>
                    </div>
                    <textarea value={payloadText} onChange={e => setPayloadText(e.target.value)} rows={10} className="w-full bg-[#0f1424] border border-white/10 rounded-xl p-3 mono text-xs leading-relaxed outline-none focus:border-cyan-500/40" />
                    {payloadError ? <div className="mt-2 text-xs text-red-300 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{payloadError}</div> : <div className="mt-2 text-xs text-emerald-300 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Valid JSON</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-5">
              <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 p-5">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> Templates</h3>
                <div className="grid grid-cols-1 gap-3">
                  {PRESETS.map(p => (
                    <button key={p.id} onClick={() => setPayloadText(p.json)} className="text-left bg-[#0f1424] border border-white/10 rounded-2xl p-4 hover:border-cyan-500/30 transition group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold group-hover:text-cyan-300 transition">{p.label}</span>
                        <span className="text-xs mono bg-white/10 px-2 py-1 rounded-full">{new Blob([p.json]).size} B</span>
                      </div>
                      <pre className="mono text-[11px] text-slate-400 mt-2 whitespace-pre-wrap line-clamp-3">{p.json}</pre>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white border border-white/10">
                <h3 className="font-bold">Pro Tip</h3>
                <p className="text-xs opacity-90 mt-1 leading-relaxed">Use <span className="mono bg-white/20 px-1.5 py-0.5 rounded">{"{{now}}"}</span> token in any template — it will be replaced with the current timestamp on send. Great for ping/pong testing.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="rounded-[20px] bg-white/[0.06] backdrop-blur border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Database className="w-4 h-4 text-violet-400" /> Connection Logs</h2>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 text-xs bg-[#0f1424] border border-white/10 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> Live capture • {frames.length + sseEvents.length} entries
                </div>
                <button onClick={() => setFrames([])} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
                <button onClick={exportLog} className="px-3 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Export JSON</button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0f1424]/80 backdrop-blur text-[11px] tracking-widest uppercase font-bold text-slate-400">
                  <tr>
                    <th className="text-left px-5 py-3">Time</th>
                    <th className="text-left px-5 py-3">Direction</th>
                    <th className="text-left px-5 py-3">Opcode</th>
                    <th className="text-left px-5 py-3">Size</th>
                    <th className="text-left px-5 py-3">Payload Preview</th>
                    <th className="text-right px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[...frames, ...sseEvents].sort((a,b)=> b.timestamp.getTime()-a.timestamp.getTime()).map(f => (
                    <tr key={f.id} className="hover:bg-white/[0.03] transition">
                      <td className="px-5 py-3 mono text-xs text-slate-300 whitespace-nowrap">{f.timestamp.toLocaleTimeString()} <span className="text-slate-500">{f.timestamp.toLocaleDateString()}</span></td>
                      <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase text-white ${f.direction==='sent'?'bg-cyan-500':f.direction==='received'?'bg-emerald-500':'bg-amber-500'}`}>{f.direction}</span></td>
                      <td className="px-5 py-3 mono text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-full inline-block mt-2">{f.opcode}</td>
                      <td className="px-5 py-3 mono text-xs">{f.size} B</td>
                      <td className="px-5 py-3 mono text-xs max-w-[420px] truncate text-slate-200">{f.payload.slice(0,120)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => { navigator.clipboard.writeText(f.payload); showToast('Copied'); }} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 inline-flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6 text-center text-xs text-slate-500">
        SocketPulse v1.0 • Built for full-stack engineers • WebSocket • SSE • Real-Time Debugger • <span className="text-slate-300">Made with precision & glow</span>
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-white text-slate-900 px-4 py-2.5 rounded-full text-sm font-bold shadow-xl border flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" /> {toast}
        </div>
      )}

      {/* Mobile status bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[#0f1424]/90 backdrop-blur border-t border-white/10 px-4 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connectionState==='connected'?'bg-emerald-400 animate-pulse':'bg-red-400'}`} />
          <span className="font-bold mono">{connectionState}</span>
          <span className="text-slate-400">• {latency}ms</span>
        </div>
        <button onClick={handleConnect} className={`px-3 py-1.5 rounded-full font-bold text-xs ${connectionState==='connected'?'bg-red-500 text-white':'bg-emerald-500 text-white'}`}>{connectionState==='connected'?'Disconnect':'Connect'}</button>
      </div>
    </div>
  );
}
