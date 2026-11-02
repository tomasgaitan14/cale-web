// Validación y normalización del formulario de /empezar (src/lib/lead.ts).
import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPES,
  CURRENT_METHODS,
  LEAD_LIMITS,
  LeadValidationError,
  WEEKLY_APPOINTMENTS,
  PHONE_TAIL_DIGITS,
  cleanText,
  closingMessage,
  normalizeWhatsapp,
  toLeadPayload,
  validateForm,
  validateStep,
  type LeadForm,
} from '../src/lib/lead';

const CONSENT_VERSION = 'test-version';

function validForm(overrides: Partial<LeadForm> = {}): LeadForm {
  return {
    businessName: 'Barbería Ribera',
    businessType: BUSINESS_TYPES[1],
    city: 'Concordia',
    weeklyAppointments: WEEKLY_APPOINTMENTS[0].value,
    currentMethod: CURRENT_METHODS[0].value,
    ownerName: 'Lucía Pérez',
    ownerWhatsapp: '11 5555 0142',
    businessWhatsapp: '3445 12-3456',
    consent: true,
    ...overrides,
  };
}

describe('normalizeWhatsapp', () => {
  it.each([
    ['11 5555-0142', '5491155550142'],
    ['(11) 5555-0142', '5491155550142'],
    ['+54 9 11 5555 0142', '5491155550142'],
    ['541155550142', '5491155550142'],
    ['0054 9 11 5555 0142', '5491155550142'],
    ['3445 12-3456', '5493445123456'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeWhatsapp(input)).toBe(expected);
  });

  it.each([
    ['vacío', ''],
    ['solo letras', 'abcdef'],
    ['muy corto', '5555 0142'],
    ['con 0 y 15 (formato viejo)', '011 15 5555 0142'],
    ['demasiado largo', '5491155550142999'],
    ['de otro país', '+1 415 555 0142 99'],
  ])('rechaza %s', (_label, input) => {
    expect(normalizeWhatsapp(input)).toBeNull();
  });
});

describe('cleanText', () => {
  it('colapsa espacios y recorta los bordes', () => {
    expect(cleanText('  Barbería \n  Ribera\t ')).toBe('Barbería Ribera');
  });
});

describe('validateStep 1 (negocio)', () => {
  it('acepta datos válidos, con acentos, ñ y signos comunes', () => {
    expect(validateStep(1, validForm({ businessName: "Peluquería Ñandú & Co. D'Alessandro (Centro)" }))).toEqual({});
  });

  it('pide los tres campos cuando están vacíos', () => {
    const errors = validateStep(1, validForm({ businessName: '', businessType: '', city: '' }));
    expect(Object.keys(errors)).toEqual(['businessName', 'businessType', 'city']);
  });

  it('trata un nombre de solo espacios como vacío', () => {
    expect(validateStep(1, validForm({ businessName: '    ' })).businessName).toBe('Escribí el nombre de tu negocio.');
  });

  it.each([
    ['1 letra', 'A', true],
    ['2 letras (mínimo)', 'Ab', false],
    ['80 caracteres (máximo)', 'a'.repeat(LEAD_LIMITS.businessName.max), false],
    ['81 caracteres', 'a'.repeat(LEAD_LIMITS.businessName.max + 1), true],
  ])('largo del nombre del negocio: %s', (_label, businessName, hasError) => {
    expect(validateStep(1, validForm({ businessName })).businessName !== undefined).toBe(hasError);
  });

  it.each(['<script>alert(1)</script>', 'Peluquería {{x}}', 'Local\u0000oculto', 'Salón 💈'])('rechaza caracteres inválidos: %s', (businessName) => {
    expect(validateStep(1, validForm({ businessName })).businessName).toBe('Usá solo letras, números y signos comunes.');
  });

  it('el largo se mide después de limpiar los espacios', () => {
    const padded = ` ${'a'.repeat(LEAD_LIMITS.businessName.max)} `;
    expect(validateStep(1, validForm({ businessName: padded })).businessName).toBeUndefined();
  });

  it('rechaza un tipo de negocio que no está en la lista', () => {
    expect(validateStep(1, validForm({ businessType: 'Hackeo' })).businessType).toBe('Elegí el tipo de negocio.');
  });

  it('no mira los campos de otros pasos', () => {
    expect(validateStep(1, validForm({ ownerName: '', consent: false }))).toEqual({});
  });
});

describe('validateStep 2 (turnos)', () => {
  it('acepta todas las opciones que se ofrecen', () => {
    for (const weekly of WEEKLY_APPOINTMENTS) {
      for (const method of CURRENT_METHODS) {
        expect(validateStep(2, validForm({ weeklyAppointments: weekly.value, currentMethod: method.value }))).toEqual({});
      }
    }
  });

  it.each(['', '0', '-5', '1-1000', 'muchos'])('rechaza turnos por semana inválidos: "%s"', (weeklyAppointments) => {
    expect(validateStep(2, validForm({ weeklyAppointments })).weeklyAppointments).toBe('Elegí una opción.');
  });

  it('rechaza una forma de avisar inventada', () => {
    expect(validateStep(2, validForm({ currentMethod: 'paloma' })).currentMethod).toBe('Elegí una opción.');
  });
});

describe('validateStep 3 (datos)', () => {
  it('acepta datos válidos', () => {
    expect(validateStep(3, validForm())).toEqual({});
  });

  it('exige el consentimiento', () => {
    expect(validateStep(3, validForm({ consent: false })).consent).toBeDefined();
  });

  it('pide el número cuando está vacío y explica el formato cuando no se puede armar', () => {
    const errors = validateStep(3, validForm({ ownerWhatsapp: '', businessWhatsapp: '011 15 5555 0142' }));
    expect(errors.ownerWhatsapp).toBe('Escribí el número.');
    expect(errors.businessWhatsapp).toContain('sin 0 ni 15');
  });

  it('valida el nombre de quien completa', () => {
    expect(validateStep(3, validForm({ ownerName: 'L' })).ownerName).toBeDefined();
  });
});

describe('toLeadPayload', () => {
  it('arma los parámetros de submit_lead, limpios y con los teléfonos normalizados', () => {
    const payload = toLeadPayload(
      validForm({ businessName: '  Barbería   Ribera ', ownerName: ' Lucía  Pérez ', city: ' Concordia ' }),
      CONSENT_VERSION,
    );
    expect(payload).toEqual({
      p_business_name: 'Barbería Ribera',
      p_business_type: 'Barbería',
      p_city: 'Concordia',
      p_weekly_appointments: '1-10',
      p_current_method: 'whatsapp_manual',
      p_owner_name: 'Lucía Pérez',
      p_owner_whatsapp: '5491155550142',
      p_business_phone: '5493445123456',
      p_consent_version: CONSENT_VERSION,
    });
  });

  it('falla con LeadValidationError y dice qué campos están mal', () => {
    const attempt = () => toLeadPayload(validForm({ city: '', consent: false }), CONSENT_VERSION);
    expect(attempt).toThrow(LeadValidationError);
    try {
      attempt();
    } catch (error) {
      expect(Object.keys((error as LeadValidationError).errors)).toEqual(['city', 'consent']);
    }
  });

  it('validateForm junta los errores de los tres pasos', () => {
    expect(Object.keys(validateForm(validForm({ businessName: '', currentMethod: '', ownerName: '' })))).toEqual([
      'businessName',
      'currentMethod',
      'ownerName',
    ]);
  });
});

describe('closingMessage', () => {
  it('nombra solo los últimos dígitos del WhatsApp, no el número entero', () => {
    const message = closingMessage('5493445123456');
    expect(PHONE_TAIL_DIGITS).toBe(4);
    expect(message).toContain('el que termina en 3456');
    expect(message).not.toContain('5493445123456');
    expect(message).not.toContain('123456');
  });

  // Con coexistencia no hay una línea aparte: el recordatorio sale del número del negocio
  it('no promete una línea aparte de recordatorios', () => {
    expect(closingMessage('5493445123456')).not.toMatch(/línea/i);
    expect(closingMessage('5493445123456')).toBe(
      'Te anotamos. Apenas Cale esté listo para tu negocio, te escribimos a tu WhatsApp (el que termina en 3456).',
    );
  });
});
