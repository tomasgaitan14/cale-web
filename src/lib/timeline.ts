// Reloj de las animaciones de la portada (scripts/timeline.ts). Cada elemento con data-in="2.5" aparece a los 2,5 s del
// ciclo y, si lleva data-out, se va a ese segundo. El estado se calcula siempre desde el tiempo, no se acumula: así la
// pausa, el salto al cuadro final y el reinicio del ciclo son la misma cuenta.

// Si la pestaña estuvo en segundo plano, el reloj no salta: un cuadro nunca avanza más que esto
export const MAX_FRAME_MS = 100;
const MS_PER_SECOND = 1000;

export interface TimelineWindow {
  // Segundo del ciclo en que aparece
  start: number;
  // Segundo en que se va (Infinity: se queda hasta que termina el ciclo)
  end: number;
}

export class TimelineAttributeError extends Error {
  constructor(detail: string) {
    super(`Atributo de animación inválido: ${detail}`);
    this.name = 'TimelineAttributeError';
  }
}

function parseSeconds(name: string, value: string): number {
  const seconds = Number(value);
  if (value.trim() === '' || !Number.isFinite(seconds) || seconds < 0) {
    throw new TimelineAttributeError(`${name}="${value}" tiene que ser un número de segundos, 0 o más`);
  }
  return seconds;
}

export function parseWindow(start: string, end: string | null): TimelineWindow {
  const window = { start: parseSeconds('data-in', start), end: end === null ? Infinity : parseSeconds('data-out', end) };
  if (window.end <= window.start) {
    throw new TimelineAttributeError(`data-out="${end}" tiene que ser mayor que data-in="${start}"`);
  }
  return window;
}

// El inicio cuenta y el final no: a los 5 s justos, algo que se va a los 5 s ya no está
export function isActive(window: TimelineWindow, seconds: number): boolean {
  return seconds >= window.start && seconds < window.end;
}

// Avanza el reloj `deltaMs` y da la vuelta al llegar al final del ciclo
export function advance(elapsedMs: number, deltaMs: number, loopSeconds: number): number {
  const next = elapsedMs + Math.min(Math.max(deltaMs, 0), MAX_FRAME_MS);
  const loopMs = loopSeconds * MS_PER_SECOND;
  return next >= loopMs ? next - loopMs : next;
}

export const toSeconds = (elapsedMs: number): number => elapsedMs / MS_PER_SECOND;
