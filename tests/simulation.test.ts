// Simulación del recordatorio al final de /empezar (src/lib/simulation.ts).
import { describe, expect, it } from 'vitest';
import { REMINDER_PREVIEW } from '../src/config';
import {
  SAMPLE_APPOINTMENT_TIME,
  SAMPLE_CLIENT_NAME,
  buildSimulation,
  businessInitials,
  businessWhatsappLink,
  dayAfter,
  reminderText,
} from '../src/lib/simulation';

const BUSINESS_WHATSAPP = '5493445123456';

describe('reminderText', () => {
  // La simulación tiene que decir lo mismo que la vista previa de la portada (el texto real de la plantilla)
  it('con los datos de la vista previa de la portada, reproduce exactamente su mensaje', () => {
    expect(
      reminderText({
        clientName: 'Lucía',
        businessName: 'Barbería Ribera',
        weekday: 'jueves',
        date: '16/10',
        time: '17:30',
      }),
    ).toBe(REMINDER_PREVIEW.message);
  });
});

describe('buildSimulation', () => {
  it('usa el nombre del negocio, la clienta de muestra y el día siguiente', () => {
    // Jueves 29/10/2026, 12:00 en Argentina
    const simulation = buildSimulation({
      businessName: 'Peluquería Sol',
      businessWhatsapp: BUSINESS_WHATSAPP,
      today: new Date('2026-10-29T15:00:00Z'),
    });
    expect(simulation.reminder).toBe(
      `Hola ${SAMPLE_CLIENT_NAME}, te recordamos tu turno en Peluquería Sol el viernes 30/10 a las ${SAMPLE_APPOINTMENT_TIME}. ¿Nos confirmás si venís?`,
    );
  });

  it('calcula "mañana" con la hora de Argentina, no con la de UTC', () => {
    // 23:30 del jueves 29/10 en Argentina ya es viernes 30/10 en UTC: mañana sigue siendo viernes 30/10
    const simulation = buildSimulation({
      businessName: 'Sol',
      businessWhatsapp: BUSINESS_WHATSAPP,
      today: new Date('2026-10-30T02:30:00Z'),
    });
    expect(simulation.reminder).toContain('el viernes 30/10');
  });

  it('pasa al mes siguiente a fin de mes', () => {
    const simulation = buildSimulation({
      businessName: 'Sol',
      businessWhatsapp: BUSINESS_WHATSAPP,
      today: new Date('2026-10-31T15:00:00Z'),
    });
    expect(simulation.reminder).toContain('el domingo 01/11');
  });

  it('ofrece los botones de la plantilla real', () => {
    const simulation = buildSimulation({ businessName: 'Sol', businessWhatsapp: BUSINESS_WHATSAPP, today: new Date() });
    expect(simulation.replies).toEqual(REMINDER_PREVIEW.replies);
  });

  it('manda lo que no sea un botón al WhatsApp del negocio', () => {
    const simulation = buildSimulation({ businessName: 'Sol', businessWhatsapp: BUSINESS_WHATSAPP, today: new Date() });
    expect(simulation.redirect).toBe(
      `Para consultas escribí directamente a wa.me/${BUSINESS_WHATSAPP}, este número es de mensajes automáticos.`,
    );
    expect(businessWhatsappLink(BUSINESS_WHATSAPP)).toBe(`wa.me/${BUSINESS_WHATSAPP}`);
  });
});

describe('dayAfter', () => {
  it('da el día con la hora de Argentina y el nombre corto con mayúscula y tilde, como la lista de horarios', () => {
    // Jueves 29/10/2026, 12:00 en Argentina
    const today = new Date('2026-10-29T15:00:00Z');
    expect(dayAfter(today, 1)).toEqual({ weekday: 'viernes', shortWeekday: 'Vie', date: '30/10' });
    expect(dayAfter(today, 2)).toEqual({ weekday: 'sábado', shortWeekday: 'Sáb', date: '31/10' });
    expect(dayAfter(today, 6)).toEqual({ weekday: 'miércoles', shortWeekday: 'Mié', date: '04/11' });
  });
});

describe('businessInitials', () => {
  it.each([
    ['Estética Cuidarte', 'EC'],
    ['Barbería Ribera', 'BR'],
    ['Peluquería', 'P'],
    ['  óptica   nueva  ', 'ÓN'],
  ])('%s -> %s', (name, expected) => {
    expect(businessInitials(name)).toBe(expected);
  });

  it('salta los signos sueltos al principio de una palabra', () => {
    expect(businessInitials('Salón & Co.')).toBe('SC');
  });

  it('un nombre vacío no da iniciales', () => {
    expect(businessInitials('   ')).toBe('');
  });
});
