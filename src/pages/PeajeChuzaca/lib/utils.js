import { SPEED_THRESHOLDS, QUEUE_THRESHOLDS } from './constants';

export function getColorForSpeed(speed, limit = 80) {
  if (speed > limit * 1.2) return '#ef4444';
  if (speed > limit) return '#f59e0b';
  if (speed > limit * 0.6) return '#22c55e';
  return '#0ea5e9';
}

export function getColorForQueue(q) {
  if (q >= QUEUE_THRESHOLDS.critical) return '#ef4444';
  if (q >= QUEUE_THRESHOLDS.warning) return '#f59e0b';
  return '#22c55e';
}

export function getColorForOccupancy(pct) {
  if (pct >= 80) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

export function formatTime(date) {
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function formatTimeShort(date) {
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function maskPlate(plate) {
  if (!plate || plate.length < 4) return '***';
  return plate.slice(0, 3) + '***';
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function generatePlate() {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const l = () => letters[Math.floor(Math.random() * letters.length)];
  const n = () => Math.floor(Math.random() * 10);
  return `${l()}${l()}${l()}${n()}${n()}${n()}`;
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}
