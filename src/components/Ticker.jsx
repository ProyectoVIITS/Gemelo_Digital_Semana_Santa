import React from 'react';
import { TICKER_MESSAGES } from '../data/scenarios';

/**
 * Ticker horizontal animado con noticias/alertas contextuales.
 */
export default function Ticker() {
  const text = TICKER_MESSAGES.join('     ·     ');

  return (
    <div className="w-full overflow-hidden bg-viits-card/80 border-y border-viits-border py-1.5">
      <div
        className="whitespace-nowrap text-[11px] text-slate-400 font-mono"
        style={{
          animation: 'ticker 60s linear infinite',
        }}
      >
        {text}
        {'     ·     '}
        {text}
      </div>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
