import React from 'react';
import { TICKER_MESSAGES } from '../data/scenarios';

export default function Ticker() {
  const text = TICKER_MESSAGES.join('     ·     ');
  return (
    <div className="bg-viits-bgAlt border-b border-viits-border overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex items-center h-6 overflow-hidden">
          <span className="text-[8px] uppercase tracking-wider text-amber-500 font-bold mr-3 flex-shrink-0">ALERTAS</span>
          <div className="overflow-hidden flex-1 relative">
            <div className="whitespace-nowrap animate-[ticker_80s_linear_infinite] text-[9px] text-slate-400 font-mono">
              {text}{'     ·     '}{text}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
