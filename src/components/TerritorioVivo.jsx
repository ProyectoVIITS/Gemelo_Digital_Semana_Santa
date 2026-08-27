import React, { useEffect, useRef } from 'react';
import { NEXUS_CORRIDORS } from '../data/nexusCorridors';

/**
 * Portada táctica — territorio instrumentado bajo barrido.
 *
 * Hereda el lenguaje del fondo de SENTINEL —retícula, retículas de puntería, anillos
 * concéntricos con marcas de rumbo, barrido cónico y línea de scan— con una diferencia
 * de fondo: allí el barrido es adorno y aquí pasa sobre datos. Cada punto es una caseta
 * de peaje en su coordenada real, tomada de NEXUS_CORRIDORS, y cuando la aguja del
 * radar cruza su rumbo la caseta se enciende. El adorno y el dato son lo mismo.
 *
 * El territorio va en claro sobre fondo oscuro: la silueta y la retícula en un blanco
 * cálido, y el naranja INVÍAS reservado para lo que se mide —la aguja del radar y las
 * casetas que enciende—. Cuando todo era naranja no había contraste entre el mapa y el
 * dato; ahora el naranja significa lectura.
 *
 * Paleta INVÍAS: principal #FF8300 (Pantone 151 C), sectorial #DA723C, gris #4D4D4D.
 */
const CONTORNO = [
  [-75.373, -0.152], [-75.801, 0.085], [-76.292, 0.416], [-76.576, 0.257], [-77.425, 0.396],
  [-77.669, 0.826], [-77.855, 0.810], [-78.855, 1.381], [-78.991, 1.691], [-78.618, 1.766],
  [-78.662, 2.267], [-78.428, 2.630], [-77.932, 2.697], [-77.510, 3.325], [-77.128, 3.850],
  [-77.496, 4.088], [-77.308, 4.668], [-77.533, 5.583], [-77.319, 5.845], [-77.477, 6.691],
  [-77.882, 7.224], [-77.753, 7.710], [-77.431, 7.638], [-77.243, 7.935], [-77.475, 8.524],
  [-77.353, 8.671], [-76.837, 8.639], [-76.086, 9.337], [-75.675, 9.443], [-75.665, 9.774],
  [-75.480, 10.619], [-74.907, 11.083], [-74.277, 11.102], [-74.197, 11.310], [-73.415, 11.227],
  [-72.628, 11.732], [-72.238, 11.956], [-71.754, 12.437], [-71.400, 12.376], [-71.137, 12.113],
  [-71.332, 11.776], [-71.974, 11.609], [-72.228, 11.109], [-72.615, 10.822], [-72.905, 10.450],
  [-73.028, 9.737], [-73.305, 9.152], [-72.789, 9.085], [-72.660, 8.625], [-72.440, 8.405],
  [-72.361, 8.003], [-72.480, 7.633], [-72.444, 7.424], [-72.198, 7.340], [-71.960, 6.992],
  [-70.674, 7.088], [-70.093, 6.960], [-69.389, 6.100], [-68.985, 6.207], [-68.265, 6.153],
  [-67.695, 6.267], [-67.341, 6.095], [-67.522, 5.557], [-67.745, 5.221], [-67.823, 4.504],
  [-67.622, 3.839], [-67.338, 3.542], [-67.303, 3.318], [-67.810, 2.821], [-67.447, 2.600],
  [-67.181, 2.251], [-66.876, 1.253], [-67.065, 1.130], [-67.260, 1.720], [-67.538, 2.037],
  [-67.869, 1.692], [-69.817, 1.715], [-69.805, 1.089], [-69.219, 0.986], [-69.252, 0.603],
  [-69.452, 0.706], [-70.016, 0.541], [-70.021, -0.185], [-69.577, -0.550], [-69.420, -1.123],
  [-69.444, -1.556], [-69.894, -4.298], [-70.394, -3.767], [-70.693, -3.743], [-70.048, -2.725],
  [-70.813, -2.257], [-71.414, -2.343], [-71.775, -2.170], [-72.326, -2.434], [-73.070, -2.309],
  [-73.660, -1.260], [-74.122, -1.003], [-74.442, -0.531], [-75.107, -0.057], [-75.373, -0.152],
];

const DIBUJO = 2400;      // ms que tarda en trazarse el territorio
const VUELTA = 11000;     // ms de una vuelta completa del barrido
const ESTELA = 0.85;      // radianes que tarda una caseta en apagarse tras el paso

function merc(lng, lat) {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

export default function TerritorioVivo({ className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const corredores = NEXUS_CORRIDORS.map((c) => ({
      color: c.color,
      puntos: (c.tollStations || []).map((t) => merc(t.lng, t.lat)),
    })).filter((c) => c.puntos.length > 1);

    const contorno = CONTORNO.map(([x, y]) => merc(x, y));

    // El encuadre sale de los peajes, no del país entero: metiendo los llanos y la
    // Amazonía —donde no hay un solo equipo— los corredores quedaban en una mancha
    // diminuta. La silueta se sale por los bordes y pasa a ser contexto.
    const eq = [].concat(...corredores.map((c) => c.puntos));
    const ex = eq.map((p) => p[0]);
    const ey = eq.map((p) => p[1]);
    const HOLGURA = 0.34;
    const cx0 = Math.min(...ex);
    const cx1 = Math.max(...ex);
    const cy0 = Math.min(...ey);
    const cy1 = Math.max(...ey);
    const hx = (cx1 - cx0) * HOLGURA;
    const hy = (cy1 - cy0) * HOLGURA;
    const caja = { x0: cx0 - hx, x1: cx1 + hx, y0: cy0 - hy, y1: cy1 + hy };

    let w = 0;
    let h = 0;
    let escala = 1;
    let ox = 0;
    let oy = 0;

    function medir() {
      const r = cv.getBoundingClientRect();
      // Al montar, el rect puede venir en cero antes de que asiente el layout. Escribir
      // cv.width = 0 deja el lienzo inservible y, si la pestaña está oculta, no hay
      // fotograma que lo corrija.
      if (r.width < 2 || r.height < 2) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Ajuste por contención: los 37 peajes tienen que caber enteros. Con 'cover' el
      // recuadro se llenaba, pero la caja de peajes es más alta que ancha y la mitad de
      // los corredores se salía por el borde inferior.
      escala = Math.min(w / (caja.x1 - caja.x0), h / (caja.y1 - caja.y0));
      // El texto de la portada cubre la izquierda; el contenido se corre a la derecha.
      ox = (w - (caja.x1 - caja.x0) * escala) / 2 + w * 0.06;
      oy = (h - (caja.y1 - caja.y0) * escala) / 2;
      return true;
    }
    const px = (p) => [ox + (p[0] - caja.x0) * escala, oy + (p[1] - caja.y0) * escala];

    function trazo(pts, hasta) {
      const n = pts.length - 1;
      const corte = n * Math.max(0, Math.min(1, hasta));
      const entero = Math.floor(corte);
      ctx.beginPath();
      const a = px(pts[0]);
      ctx.moveTo(a[0], a[1]);
      for (let i = 1; i <= entero; i += 1) {
        const q = px(pts[i]);
        ctx.lineTo(q[0], q[1]);
      }
      if (entero < n) {
        const p0 = px(pts[entero]);
        const p1 = px(pts[entero + 1]);
        const f = corte - entero;
        ctx.lineTo(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f);
      }
      ctx.stroke();
    }

    let ini = null;
    let vivo = true;
    let lazo = 0;
    let espera = 0;

    function pintar(t) {
      if (!vivo) return;
      if (ini === null) ini = t;
      const ms = quieto ? DIBUJO : t - ini;
      const p = Math.min(1, ms / DIBUJO);
      ctx.clearRect(0, 0, w, h);

      // el barrido gira sobre el centroide de los peajes, no sobre el del lienzo
      const cen = px([(cx0 + cx1) / 2, (cy0 + cy1) / 2]);
      const ccx = cen[0];
      const ccy = cen[1];
      const radio = Math.max(w, h) * 0.66;

      // ── retícula, alineada al centro del barrido
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.05)';
      ctx.lineWidth = 1;
      for (let x = (ccx % 64) - 64; x < w; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = (ccy % 64) - 64; y < h; y += 64) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // ── retículas de puntería
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
      ctx.setLineDash([3, 9]);
      ctx.beginPath(); ctx.moveTo(ccx, 0); ctx.lineTo(ccx, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ccy); ctx.lineTo(w, ccy); ctx.stroke();
      ctx.setLineDash([]);

      // ── anillos concéntricos y marcas de rumbo
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.10)';
      for (let r = 90; r < radio; r += 90) {
        ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, Math.PI * 2); ctx.stroke();
      }
      const rMarca = Math.min(w, h) * 0.42;
      ctx.font = '9px "Space Mono", monospace';
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const c = Math.cos(a);
        const s2 = Math.sin(a);
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
        ctx.beginPath();
        ctx.moveTo(ccx + c * rMarca, ccy + s2 * rMarca);
        ctx.lineTo(ccx + c * (rMarca - 11), ccy + s2 * (rMarca - 11));
        ctx.stroke();
        ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
        ctx.fillText(`${(i * 30).toString().padStart(3, '0')}°`,
          ccx + c * (rMarca + 18) - 10, ccy + s2 * (rMarca + 18) + 3);
      }

      // ── silueta del país
      const av0 = Math.min(1, p / 0.42);
      ctx.strokeStyle = `rgba(241, 245, 249, ${0.62 * av0})`;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'round';
      trazo(contorno, p / 0.42);
      if (p >= 0.42) {
        // lavado tenue: sin él la silueta es solo una línea y el mapa no se lee como
        // territorio, que es lo que tiene que contrastar con el fondo
        ctx.fillStyle = 'rgba(226, 232, 240, 0.045)';
        ctx.fill();
      }

      // ── corredores
      corredores.forEach((c, i) => {
        const desde = 0.38 + (i / corredores.length) * 0.42;
        const av = (p - desde) / 0.22;
        if (av <= 0) return;
        ctx.strokeStyle = c.color;
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 1.9;
        trazo(c.puntos, av);
        ctx.globalAlpha = 1;
      });

      // ── barrido cónico
      const ang = quieto
        ? -Math.PI / 2
        : -Math.PI / 2 + ((ms % VUELTA) / VUELTA) * Math.PI * 2;
      if (p >= 0.5 && ctx.createConicGradient) {
        // El degradado conico arranca en el angulo de la aguja y avanza en sentido
        // horario, que es justo hacia donde el radar TODAVIA no ha mirado. La estela
        // tiene que quedar detras, o sea al final del recorrido: cerca de 1.
        const g = ctx.createConicGradient(ang, ccx, ccy);
        g.addColorStop(0, 'rgba(255, 131, 0, 0)');
        g.addColorStop(0.72, 'rgba(255, 131, 0, 0)');
        g.addColorStop(0.93, 'rgba(255, 131, 0, 0.045)');
        g.addColorStop(1, 'rgba(255, 131, 0, 0.13)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ccx, ccy, radio, 0, Math.PI * 2); ctx.fill();
      }
      if (p >= 0.5) {
        ctx.strokeStyle = 'rgba(255, 131, 0, 0.5)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(ccx, ccy);
        ctx.lineTo(ccx + Math.cos(ang) * radio, ccy + Math.sin(ang) * radio);
        ctx.stroke();
      }

      // ── casetas: se encienden cuando la aguja cruza su rumbo
      corredores.forEach((c, i) => {
        const desde = 0.40 + (i / corredores.length) * 0.42;
        c.puntos.forEach((q, k) => {
          const av = (p - desde - k * 0.005) / 0.2;
          if (av <= 0) return;
          const q2 = px(q);
          const x = q2[0];
          const y = q2[1];
          let brillo = 0;
          if (!quieto && p >= 0.5) {
            // cuánto hace que la aguja pasó por este rumbo, en radianes
            let d = ang - Math.atan2(y - ccy, x - ccx);
            d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (d < ESTELA) brillo = 1 - d / ESTELA;
          }
          const r = 2.5 * Math.min(1, av);
          ctx.globalAlpha = Math.min(1, av);
          ctx.beginPath();
          ctx.arc(x, y, r + brillo * 7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 131, 0, ${0.05 + brillo * 0.3})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = brillo > 0.35 ? '#FF8300' : c.color;
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      });

      // ── línea de scan
      if (!quieto && p >= 1) {
        const y = h * (1 - ((ms / 5200) % 1));
        const g = ctx.createLinearGradient(0, y - 70, 0, y + 70);
        g.addColorStop(0, 'rgba(255, 131, 0, 0)');
        g.addColorStop(0.5, 'rgba(255, 131, 0, 0.06)');
        g.addColorStop(1, 'rgba(255, 131, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 70, w, 140);
      }

      // rAF no corre en pestaña oculta. Encolar otro rAF ahí mata la cadena: el relevo
      // llama a pintar directamente y el dibujo termina igual, sin animar.
      if (quieto) return;
      if (!document.hidden) lazo = requestAnimationFrame(pintar);
      else espera = setTimeout(() => pintar(t + 260), 260);
    }

    let reintento = 0;
    const rehacer = () => {
      if (medir()) {
        clearTimeout(reintento);
        reintento = 0;
        cancelAnimationFrame(lazo);
        clearTimeout(espera);
        pintar(performance.now());
        return true;
      }
      return false;
    };

    // Si al montar el lienzo mide cero —ventana minimizada, pestana en segundo plano,
    // layout sin asentar— ni ResizeObserver ni el evento resize llegan, porque ambos se
    // entregan con el ciclo de pintado. Un temporizador si corre siempre: se reintenta
    // hasta que haya tamano y despues no vuelve a gastarse.
    const insistir = () => { if (!rehacer() && vivo) reintento = setTimeout(insistir, 250); };
    insistir();
    const ro = new ResizeObserver(rehacer);
    ro.observe(cv);
    // Respaldo: ResizeObserver se entrega con el ciclo de pintado, asi que en una
    // pestana que no se compone puede no llegar nunca y el lienzo se queda con el
    // tamano viejo. El evento de ventana si llega siempre.
    window.addEventListener('resize', rehacer);
    const alVolver = () => { if (!document.hidden) rehacer(); };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      vivo = false;
      cancelAnimationFrame(lazo);
      clearTimeout(espera);
      clearTimeout(reintento);
      ro.disconnect();
      window.removeEventListener('resize', rehacer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export const TOTAL_PEAJES = NEXUS_CORRIDORS.reduce(
  (a, c) => a + (c.tollStations || []).length, 0,
);
export const TOTAL_CORREDORES = NEXUS_CORRIDORS.length;
