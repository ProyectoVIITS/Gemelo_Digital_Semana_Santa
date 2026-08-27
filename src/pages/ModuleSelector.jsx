import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Truck, Construction, Gauge } from 'lucide-react';
import TerritorioVivo from '../components/TerritorioVivo';

const modules = [
  {
    title: 'Monitor NEXUS',
    subtitle: 'Sala de control virtual DITRA — 7 corredores, 37 peajes',
    description: 'Monitor multicanal de corredores críticos con mapa de Colombia, IRT en tiempo real, alertas globales y gráfica comparativa.',
    path: '/monitor',
    icon: Shield,
    accent: '#38bdf8',
    status: 'Operativo',
    tags: ['7 corredores', '37 peajes', 'IRT tiempo real', 'DITRA'],
  },
  {
    title: 'Corredores Logísticos',
    subtitle: 'Carga pesada y comercio exterior — INVÍAS',
    description: 'Análisis de corredores logísticos nacionales: heatmap de congestión, peajes estratégicos y desempeño de carga sobre red primaria.',
    path: '/logistics',
    icon: Truck,
    accent: '#a855f7',
    status: 'Operativo',
    tags: ['Corredores carga', 'Heatmap', 'Peajes', 'INVÍAS'],
  },
  {
    title: 'Módulo Infraestructura',
    subtitle: 'Estado del pavimento y carga sobre la red — INVÍAS',
    description: 'Tránsito promedio diario y ejes equivalentes de 8,2 t por tramo, medidos con los equipos del programa. Vida útil consumida, hora máxima de demanda, composición del tránsito y ocupación vial en tiempo real.',
    path: '/viits/plataforma.html',
    externo: true,
    icon: Construction,
    accent: '#f97316',
    status: 'Operativo',
    cifras: [
      { n: '41', l: 'tramos medidos' },
      { n: '264.956', l: 'veh/día' },
      { n: '34,9', l: 'M ejes eq./año' },
    ],
    tags: ['LPR', 'WIM', 'Gálibos', 'AASHTO 93', 'Ocupación en vivo'],
  },
  {
    title: 'Infracciones al Tránsito y al Transporte',
    subtitle: 'Velocidad medida y exceso sobre el límite — INVÍAS',
    description: 'Vehículos que superan los 80 km/h en cada tramo, tomados del dato de velocidad que ya registran lectores de placas, básculas y gálibos. Reparto por clase, perfil horario y capturas del vehículo para el reporte. Las capas de SOAT y técnico-mecánica quedan a la espera del acceso a la Supertransporte.',
    path: '/viits/infracciones.html',
    externo: true,
    icon: Gauge,
    accent: '#8b5cf6',
    status: 'Operativo',
    cifras: [
      { n: '37', l: 'tramos con velocidad' },
      { n: '5.635', l: 'excesos/día' },
      { n: '6,98 %', l: 'de las lecturas' },
    ],
    tags: ['SPEED', 'Límite 80 km/h', 'Capturas', 'Supertransporte'],
  },
];

const ENTIDADES = [
  { src: '/logos/mintransporte.png', alt: 'Ministerio de Transporte', name: 'MinTransporte' },
  { src: '/logos/invias.png', alt: 'Instituto Nacional de Vías', name: 'INVÍAS' },
  { src: '/logos/ditra.jpeg', alt: 'Dirección de Tránsito y Transporte', name: 'DITRA' },
];

const display = { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif' };
const mono = { fontFamily: '"Space Mono", ui-monospace, monospace' };

/* Paleta institucional del INVÍAS. El principal y el gris vienen con hexadecimal en el
   manual; el sectorial se toma de su RGB (218, 114, 60). Los pasos intermedios del
   degradado no se leen en la lámina, así que la rampa se arma entre el principal y el
   sectorial en vez de inventar códigos. */
const INVIAS = {
  principal: '#FF8300',   // Pantone 151 C
  sectorial: '#DA723C',
  gris: '#4D4D4D',
};
const RAMPA = `linear-gradient(100deg, #FFA22B 0%, ${INVIAS.principal} 46%, ${INVIAS.sectorial} 100%)`;

function Tarjeta({ mod }) {
  const Icon = mod.icon;
  /* Los módulos de pavimentos son páginas estáticas servidas desde public/, fuera del
     router: con <Link> el SPA intentaría resolverlas como ruta y caería en el catch-all.
     Van con <a> y recarga completa. */
  const Caja = mod.externo ? 'a' : Link;
  const destino = mod.externo ? { href: mod.path } : { to: mod.path };

  return (
    <Caja
      {...destino}
      className="grupo relative block h-full overflow-hidden rounded-lg border border-white/[0.07]
                 bg-[#101216] p-6 transition-transform duration-300 hover:-translate-y-[3px]"
    >
      {/* la identidad del módulo vive en el filo, no en un fondo teñido */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${mod.accent}, transparent)` }}
      />
      <span
        className="halo pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 1px ${mod.accent}55, 0 18px 50px -28px ${mod.accent}` }}
      />

      <div className="mb-5 flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-md"
          style={{ backgroundColor: `${mod.accent}14`, border: `1px solid ${mod.accent}2e` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: mod.accent }} />
        </span>
        <span
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-emerald-400"
          style={mono}
        >
          <span className="latido h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {mod.status}
        </span>
      </div>

      <h2 className="text-[19px] font-semibold leading-tight text-slate-50">{mod.title}</h2>
      <p className="mt-1.5 text-[11px] leading-snug" style={{ ...mono, color: mod.accent }}>
        {mod.subtitle}
      </p>
      <p className="mt-3.5 text-[13.5px] leading-relaxed text-slate-400">{mod.description}</p>

      {mod.cifras && (
        <div
          className="mt-5 grid gap-px overflow-hidden rounded-md"
          style={{
            gridTemplateColumns: `repeat(${mod.cifras.length}, minmax(0, 1fr))`,
            backgroundColor: `${mod.accent}22`,
            border: `1px solid ${mod.accent}22`,
          }}
        >
          {mod.cifras.map((c) => (
            <div key={c.l} className="bg-[#0b0c0f] px-3 py-2.5">
              <div className="text-[17px] leading-none text-slate-50" style={mono}>{c.n}</div>
              <div className="mt-1 text-[10px] text-slate-500">{c.l}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {mod.tags.map((tag) => (
          <span
            key={tag}
            className="rounded border px-2 py-0.5 text-[10px]"
            style={{
              ...mono,
              borderColor: `${mod.accent}26`,
              color: `${mod.accent}cc`,
              backgroundColor: `${mod.accent}0a`,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="entrada mt-5 flex items-center gap-1.5 text-[12px] text-slate-500 transition-colors">
        <span>Acceder al módulo</span>
        <span className="flecha inline-block transition-transform">→</span>
      </div>
    </Caja>
  );
}

export default function ModuleSelector() {
  return (
    <div className="min-h-screen bg-[#08090c] text-slate-200">
      <style>{`
        .grupo:hover .halo { opacity: 1 }
        .grupo:hover .entrada { color: #e2e8f0 }
        .grupo:hover .flecha { transform: translateX(4px) }
        @supports (-webkit-background-clip: text) or (background-clip: text) {
          .marca { -webkit-text-fill-color: transparent; color: transparent }
        }
        @keyframes latido { 0%,100%{opacity:1} 50%{opacity:.25} }
        .latido { animation: latido 2s ease-in-out infinite }
        @keyframes entrar { from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:none} }
        .entrar { animation: entrar .7s cubic-bezier(.22,.9,.3,1) both }
        @media (prefers-reduced-motion: reduce) {
          .latido, .entrar { animation: none }
          .grupo, .flecha { transition: none }
        }
      `}</style>

      {/* ═══════════════ portada ═══════════════ */}
      <header className="relative overflow-hidden border-b border-white/[0.06]">
        {/* el territorio ocupa la derecha y se funde con el fondo hacia la izquierda */}
        <div className="pointer-events-none absolute inset-0">
          <TerritorioVivo className="h-full w-full" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, #08090c 0%, rgba(8,9,12,.88) 20%, rgba(8,9,12,.12) 48%, rgba(8,9,12,.22) 100%)',
            }}
          />
          {/* viñeta y scanlines: el gesto de pantalla de sala de control */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 64% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,.45) 100%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, rgba(255,131,0,.5) 0 1px, transparent 1px 3px)',
            }}
          />
        </div>

        <div className="relative mx-auto flex min-h-[min(82vh,660px)] w-full max-w-6xl items-center px-6 py-20">
          <div className="entrar">
            <h1
              className="text-[clamp(3.6rem,10vw,7.4rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.015em]"
              style={display}
            >
              {/* VIITS lleva el degradado institucional; el respaldo en color plano
                  cubre a los navegadores que no recortan el fondo al texto. */}
              <span
                className="marca block"
                style={{
                  color: INVIAS.principal,
                  backgroundImage: RAMPA,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }}
              >
                VIITS
              </span>
              <span className="block text-slate-100">NEXUS</span>
            </h1>

            <p
              className="mt-7 text-[13px] uppercase tracking-[0.32em] text-slate-400"
              style={mono}
            >
              Sistema único de gemelos digitales
            </p>
          </div>
        </div>
      </header>

      {/* ═══════════════ módulos ═══════════════ */}
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-baseline gap-4">
          <h2 className="text-[13px] uppercase tracking-[0.22em] text-slate-400" style={mono}>
            Módulos
          </h2>
          <span className="h-px flex-1 bg-white/[0.07]" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-600" style={mono}>
            {modules.length} operativos
          </span>
        </div>

        <div className="grid items-stretch gap-5 md:grid-cols-2">
          {modules.map((mod, i) => (
            <div key={mod.path} className="entrar" style={{ animationDelay: `${0.12 + i * 0.09}s` }}>
              <Tarjeta mod={mod} />
            </div>
          ))}
        </div>
      </main>

      {/* ═══════════════ entidades ═══════════════ */}
      <footer className="border-t border-white/[0.06] px-6 py-14">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-7 flex items-center justify-center gap-3">
            <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[9px] uppercase tracking-[0.28em] text-slate-600" style={mono}>
              Entidades
            </span>
            <span className="h-px w-14 bg-gradient-to-l from-transparent to-white/10" />
          </div>

          <div className="flex items-center justify-center gap-12 md:gap-20">
            {ENTIDADES.map((e) => (
              <div key={e.name} className="flex flex-col items-center gap-2.5">
                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] p-2.5">
                  <img src={e.src} alt={e.alt} className="max-h-full max-w-full object-contain" />
                </div>
                <span className="text-[8.5px] uppercase tracking-[0.16em] text-slate-600" style={mono}>
                  {e.name}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-[10px] uppercase tracking-[0.2em] text-slate-700" style={mono}>
            VIITS-NEXUS v0.1-PILOT · República de Colombia
          </p>
        </div>
      </footer>
    </div>
  );
}
