import React, { useRef, useEffect } from 'react';

// Escala Visual: 1 Metro = 4 Pixeles
const METERS_TO_PX = 4;
const FPS = 60;

export default function RoadCanvas({ jamLevel = 3, jamSpeed = 10, jamRatio = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    
    const parent = canvas.parentElement;
    
    // Usar ResizeObserver para solventar el layout tardío de React Flexbox
    let width = parent.clientWidth > 10 ? parent.clientWidth : 800;
    let height = parent.clientHeight > 10 ? parent.clientHeight : 280;
    
    // Support High-DPI displays
    let dpr = window.devicePixelRatio || 1;
    
    const applySize = () => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    applySize();

    let animationFrameId;

    // Configuración Vial
    const roadTopY = 40;
    const roadBottomY = height - 40;
    const roadHeight = roadBottomY - roadTopY;
    const lanes = 3;
    const laneHeight = roadHeight / lanes;
    
    // ─── FÍSICA Y CINEMÁTICA ───
    // jamSpeed viene en km/h. Convertimos a m/s -> px/s -> px/frame
    const speedMPS = jamSpeed / 3.6;
    const speedPXS = speedMPS * METERS_TO_PX;
    const baseSpeedPxFrame = speedPXS / FPS;
    
    // Evitar que queden ABSOLUTAMENTE congelados si el jamSpeed dice 0 o 1 km/h:
    // Aseguramos un mínimo perceptual lentísimo de 0.05 px por frame.
    const actualBaseSpeed = Math.max(0.05, baseSpeedPxFrame);

    // Calcular cantidad de vehículos aproximada basada en la densidad de Waze. 
    // Un nivel 4 (Jam pesado) equivale a carros parados casi llanta con llanta.
    const spacingFactor = jamLevel >= 4 ? 1.5 : jamLevel === 3 ? 3 : 5; 
    const carsPerLane = Math.floor(width / (4.5 * METERS_TO_PX * spacingFactor)); 

    // Paleta de colores vehiculares más profesional/sobria
    const carColors = ['#e2e8f0', '#94a3b8', '#0f172a', '#1e293b', '#b91c1c', '#0369a1'];

    // Inicializar carros ordenados por carril y posición para usar lógica de seguimiento (Car Following)
    let cars = [];
    for (let currentLane = 0; currentLane < lanes; currentLane++) {
      let currentX = width + Math.random() * 50; // Empezar fuera de pantalla
      for (let j = 0; j < carsPerLane; j++) {
        const carLength = (4 + Math.random() * 1.5) * METERS_TO_PX; // ~4 - 5.5 metros
        
        currentX -= (carLength + 2 * METERS_TO_PX + (Math.random() * 15 * METERS_TO_PX)); // Gap base de 2m + random
        // Repartir en el ancho inicial disponible
        if(j === 0) currentX = width * Math.random();

        cars.push({
          lane: currentLane,
          x: currentX,
          y: roadTopY + (currentLane * laneHeight) + (laneHeight / 2),
          length: carLength,
          width: 1.8 * METERS_TO_PX, // ~1.8 metros ancho
          color: carColors[Math.floor(Math.random() * carColors.length)],
          targetSpeed: actualBaseSpeed * (0.9 + Math.random() * 0.2), // Pequeña variación
          currentSpeed: 0,
        });
      }
    }

    const isSevere = jamLevel >= 3 || jamRatio > 2;

    // Lógica de Render
    const render = () => {
      // Actializar size dinámico para Flexbox si cambia
      if (parent.clientWidth > 10 && Math.abs(parent.clientWidth - width) > 10) {
        width = parent.clientWidth;
        applySize();
      }

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Fondo exterior (pasto/tierra nocturna)
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, width, height);

      // Asfalto
      ctx.fillStyle = '#111827'; 
      ctx.fillRect(0, roadTopY, width, roadHeight);

      // Líneas continuas asfalto
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, roadTopY - 1, width, 1);
      ctx.fillRect(0, roadBottomY, width, 1);

      // Líneas punteadas de carril
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.setLineDash([15, 15]);
      for (let i = 1; i < lanes; i++) {
        ctx.beginPath();
        const lineY = roadTopY + i * laneHeight;
        ctx.moveTo(0, lineY);
        ctx.lineTo(width, lineY);
        ctx.stroke();
      }
      ctx.setLineDash([]); 

      // Brillo rojo de Alerta Severa Waze (Calor/Congestión)
      if (isSevere) {
        const gradient = ctx.createLinearGradient(0, roadTopY, 0, roadBottomY);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.01)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.08)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, roadTopY, width, roadHeight);
      }

      // Físicas y Renderizado Vehicular
      for (let currentLane = 0; currentLane < lanes; currentLane++) {
        // Filtrar carros en este carril y ordenar por posición X (de derecha a izquierda)
        const laneCars = cars.filter(c => c.lane === currentLane).sort((a, b) => b.x - a.x);
        
        for (let i = 0; i < laneCars.length; i++) {
          const car = laneCars[i];
          const leader = i > 0 ? laneCars[i - 1] : null;

          // Car Following Model simplificado
          let speedToApply = car.targetSpeed;
          let isBraking = false;

          if (leader) {
            // Distancia entre frente de este carro y cola del líder
            const distanceToLeader = leader.x - (car.x + car.length);
            const safeDistance = 1 * METERS_TO_PX + (car.currentSpeed * 10); // Gap dinámico seguro
            
            if (distanceToLeader < safeDistance) {
              speedToApply = leader.currentSpeed * 0.9; // Frenar sutilmente debajo de la velocidad del líder
              isBraking = true;
            } else if (distanceToLeader < safeDistance * 2) {
              speedToApply = leader.currentSpeed; // Igualar
            }
          }

          // Aceleración / Desaceleración suave
          car.currentSpeed += (speedToApply - car.currentSpeed) * 0.1;
          
          // Aplicar desplazamiento neto
          car.x += car.currentSpeed;

          // Reposicionar si sale del Canvas (Efecto carrusel)
          if (car.x > width + 20) {
            // Mandarlo al final de la cola
            const lastCar = laneCars[laneCars.length - 1];
            car.x = lastCar ? lastCar.x - (car.length + 8 * METERS_TO_PX) : -car.length;
            car.currentSpeed = actualBaseSpeed;
          }

          // ─── DIBUJAR VEHÍCULO (High Fidelity) ───
          const cy = car.y;
          const cx = car.x;
          
          ctx.save();
          ctx.translate(cx, cy);

          // Sombra perimetral
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;

          // Chasis (Cuerpo)
          ctx.fillStyle = car.color;
          ctx.beginPath();
          ctx.roundRect(0, -car.width/2, car.length, car.width, 2);
          ctx.fill();

          // Resetear sombras para detalles internos
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Techo/Chasis superior (un poco más oscuro para volumen 3D top-down)
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          // El techo ocupa aprox un 50% de la longitud, centrado
          ctx.roundRect(car.length * 0.25, -car.width * 0.4, car.length * 0.45, car.width * 0.8, 1);
          ctx.fill();

          // Parabrisas Frontal
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Vidrio oscuro
          ctx.beginPath();
          ctx.roundRect(car.length * 0.65, -car.width * 0.35, car.length * 0.1, car.width * 0.7, 1);
          ctx.fill();
          
          // Parabrisas Trasero
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.beginPath();
          ctx.roundRect(car.length * 0.2, -car.width * 0.35, car.length * 0.08, car.width * 0.7, 1);
          ctx.fill();

          // Stop Lights (Tail Lights)
          const tailLightColor = isBraking ? '#ef4444' : '#7f1d1d';
          ctx.fillStyle = tailLightColor;
          if (isBraking) {
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 6;
          }
          // Izquierda
          ctx.fillRect(0, -car.width * 0.45, 2, car.width * 0.2);
          // Derecha
          ctx.fillRect(0, car.width * 0.25, 2, car.width * 0.2);
          
          // HeadLights (Luces delanteras sutiles apuntando al frente)
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(car.length - 2, -car.width * 0.45, 2, car.width * 0.2);
          ctx.fillRect(car.length - 2, car.width * 0.25, 2, car.width * 0.2);

          // HeadLight Glow (Rayo volumétrico muy tenue)
          const lightGlow = ctx.createLinearGradient(car.length, 0, car.length + 12, 0);
          lightGlow.addColorStop(0, 'rgba(254, 240, 138, 0.15)');
          lightGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = lightGlow;
          ctx.fillRect(car.length, -car.width * 0.5, 12, car.width);

          ctx.restore();
        }
      }

      // ─── HUD UI Overlay ───
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.fillRect(0, 0, width, height); // Oscurecer esquinas
      
      // Limpiar un box para destacar el render interno
      ctx.clearRect(10, roadTopY - 20, width - 20, roadHeight + 40);

      // Etiquetas informativas del simulador
      ctx.fillStyle = '#a855f7'; 
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.fillText(`SIMULACIÓN FLUJO DENSO WAZE`, 12, 18);
      
      const speedText = `${Math.round(jamSpeed)} KM/H`;
      const ratioText = `${jamRatio}x DELAY`;
      ctx.fillStyle = isSevere ? '#ef4444' : '#f59e0b';
      ctx.fillText(`⚡ VELOCIDAD VÍA: ${speedText}  |  🕒 EXCESO: ${ratioText}`, width - 240, 18);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [jamLevel, jamSpeed, jamRatio]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ display: 'block', width: '100%', height: '100%', borderRadius: '4px' }} 
    />
  );
}
