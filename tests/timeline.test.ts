// Reloj de las animaciones de la portada (src/lib/timeline.ts).
import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS, TimelineAttributeError, advance, isActive, parseWindow, toSeconds } from '../src/lib/timeline';

describe('parseWindow', () => {
  it('lee el inicio y el final en segundos, con decimales', () => {
    expect(parseWindow('1.5', '4')).toEqual({ start: 1.5, end: 4 });
  });

  it('sin data-out se queda hasta el final del ciclo', () => {
    expect(parseWindow('0', null)).toEqual({ start: 0, end: Infinity });
  });

  it.each([
    ['vacío', '', null],
    ['solo espacios', '  ', null],
    ['texto', 'pronto', null],
    ['negativo', '-1', null],
    ['infinito', 'Infinity', null],
    ['final que no es número', '1', 'luego'],
    ['final negativo', '1', '-2'],
  ])('rechaza %s', (_label, start, end) => {
    expect(() => parseWindow(start, end)).toThrow(TimelineAttributeError);
  });

  it.each([
    ['final antes del inicio', '5', '2'],
    ['final igual al inicio (una ventana vacía)', '3', '3'],
  ])('rechaza %s', (_label, start, end) => {
    expect(() => parseWindow(start, end)).toThrow('tiene que ser mayor');
  });
});

describe('isActive', () => {
  const window = { start: 2, end: 5 };

  it('cuenta el inicio y no cuenta el final', () => {
    expect(isActive(window, 1.99)).toBe(false);
    expect(isActive(window, 2)).toBe(true);
    expect(isActive(window, 4.99)).toBe(true);
    expect(isActive(window, 5)).toBe(false);
  });

  it('sin final, queda activo hasta que termina el ciclo', () => {
    expect(isActive({ start: 2, end: Infinity }, 1000)).toBe(true);
  });
});

describe('advance', () => {
  const LOOP = 10;

  it('suma el tiempo del cuadro', () => {
    expect(advance(1000, 16, LOOP)).toBe(1016);
  });

  it('da la vuelta al terminar el ciclo y conserva lo que sobra', () => {
    expect(advance(9950, 80, LOOP)).toBe(30);
  });

  it('un cuadro enorme (pestaña en segundo plano) no hace saltar el reloj', () => {
    expect(advance(1000, 60_000, LOOP)).toBe(1000 + MAX_FRAME_MS);
  });

  it('un tiempo negativo no hace retroceder el reloj', () => {
    expect(advance(1000, -50, LOOP)).toBe(1000);
  });
});

describe('toSeconds', () => {
  it('convierte milisegundos a segundos', () => {
    expect(toSeconds(2500)).toBe(2.5);
  });
});
