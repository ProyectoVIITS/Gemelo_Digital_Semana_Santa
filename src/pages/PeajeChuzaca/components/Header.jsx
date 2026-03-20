import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wifi } from 'lucide-react';
import { CHUZACA } from '../lib/constants';
import { formatTime } from '../lib/utils';

export default function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
      style={{
        backgroundColor: 'rgba(10, 15, 30, 0.85)',
        backdropFilter: 'blur(12px)',
        borderColor: 'rgba(14, 165, 233, 0.2)',
      }}>
      {/* Left: Logo + Name */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Módulos</span>
        </Link>
        <div className="w-px h-6 bg-slate-700" />
        <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
          VN
        </div>
        <div>
          <span className="text-sm font-bold tracking-wide" style={{ color: '#0ea5e9', fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
            VIITS NEXUS
          </span>
          <span className="text-[10px] text-slate-500 ml-2 hidden lg:inline">
            Gemelo Digital
          </span>
        </div>
      </div>

      {/* Center: Toll info */}
      <div className="text-center hidden md:block">
        <span className="text-sm font-semibold text-white">{CHUZACA.name}</span>
        <span className="text-xs text-slate-500 ml-2">{CHUZACA.route} {CHUZACA.km}</span>
      </div>

      {/* Right: Clock + Status */}
      <div className="flex items-center gap-4">
        <span className="text-sm tabular-nums text-slate-300" style={{ fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
          {formatTime(time)}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono text-green-400 uppercase tracking-wider hidden sm:inline">
            Sistema Activo
          </span>
          <Wifi className="w-3 h-3 text-green-400 ml-1" />
        </div>
      </div>
    </header>
  );
}
