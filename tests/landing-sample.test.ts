import { describe, expect, it } from 'vitest';
import { LANDING_SAMPLE } from '../src/config.ts';

// El código de país de Argentina para un celular (54 + 9) y la característica de Buenos Aires
const AR_MOBILE_PREFIX = '549';
const BUENOS_AIRES_AREA = '11';
const SUBSCRIBER_LENGTH = 8;

describe('el negocio de ejemplo de la portada', () => {
  // La animación muestra un enlace wa.me con este número a cualquiera que abra el sitio: no puede ser de una persona real
  it('usa un número imposible: el abonado empieza con 0, que en Argentina no existe', () => {
    const number = LANDING_SAMPLE.businessWhatsapp;
    expect(number.startsWith(AR_MOBILE_PREFIX + BUENOS_AIRES_AREA)).toBe(true);
    const subscriber = number.slice((AR_MOBILE_PREFIX + BUENOS_AIRES_AREA).length);
    expect(subscriber).toHaveLength(SUBSCRIBER_LENGTH);
    expect(subscriber.startsWith('0')).toBe(true);
  });
});
