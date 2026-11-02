// Datos del formulario de alta (/empezar) y sus reglas de validación.
// Los límites y las opciones espejan los check de supabase/migrations/0001_leads.sql: si cambia uno, cambiar el otro
// (tests/lead-schema.test.ts lo controla). La base de datos vuelve a validar todo; esto es para guiar a la persona.

export const LEAD_LIMITS = {
  businessName: { min: 2, max: 80 },
  businessType: { min: 2, max: 60 },
  city: { min: 2, max: 60 },
  ownerName: { min: 2, max: 80 },
} as const;

export const BUSINESS_TYPES = [
  'Peluquería',
  'Barbería',
  'Centro de estética',
  'Uñas',
  'Consultorio',
  'Otro negocio con turnos',
] as const;

export const WEEKLY_APPOINTMENTS = [
  { value: '1-10', label: 'Hasta 10' },
  { value: '11-30', label: 'Entre 11 y 30' },
  { value: '31-60', label: 'Entre 31 y 60' },
  { value: '61+', label: 'Más de 60' },
] as const;

export const CURRENT_METHODS = [
  { value: 'whatsapp_manual', label: 'Les escribo por WhatsApp a mano' },
  { value: 'llamadas', label: 'Los llamo por teléfono' },
  { value: 'agenda_papel', label: 'Anoto en una agenda y no les aviso' },
  { value: 'otro', label: 'De otra forma' },
] as const;

export interface LeadForm {
  businessName: string;
  businessType: string;
  city: string;
  weeklyAppointments: string;
  currentMethod: string;
  ownerName: string;
  ownerWhatsapp: string;
  businessWhatsapp: string;
  consent: boolean;
}

export type LeadField = keyof LeadForm;
export type FieldErrors = Partial<Record<LeadField, string>>;

export const FORM_STEPS = [1, 2, 3] as const;
export type FormStep = (typeof FORM_STEPS)[number];

export const STEP_FIELDS: Record<FormStep, readonly LeadField[]> = {
  1: ['businessName', 'businessType', 'city'],
  2: ['weeklyAppointments', 'currentMethod'],
  3: ['ownerName', 'ownerWhatsapp', 'businessWhatsapp', 'consent'],
};

// Parámetros de la función submit_lead de Supabase, en el mismo orden que su definición SQL
export interface LeadPayload {
  p_business_name: string;
  p_business_type: string;
  p_city: string;
  p_weekly_appointments: string;
  p_current_method: string;
  p_owner_name: string;
  p_owner_whatsapp: string;
  p_business_phone: string;
  p_consent_version: string;
}

export class LeadValidationError extends Error {
  constructor(readonly errors: FieldErrors) {
    super(`Formulario inválido: ${Object.keys(errors).join(', ')}`);
    this.name = 'LeadValidationError';
  }
}

const COUNTRY_CODE = '54';
const MOBILE_PREFIX = '9';
const INTERNATIONAL_CALL_PREFIX = '00';
// Código de área + número, sin 0 ni 15
const NATIONAL_MOBILE_DIGITS = 10;
// 54 + 9 + código de área + número
const FULL_MOBILE_DIGITS = 13;
// 54 + código de área + número (sin el 9 de celular)
const FULL_MOBILE_DIGITS_WITHOUT_NINE = 12;

// Letras, números, espacios y la puntuación habitual de un nombre de negocio ("Barbería Ribera & Co.")
const ALLOWED_TEXT = /^[\p{L}\p{N} .,'’&\-/()#°!¡¿?+:;]+$/u;

// Un solo espacio entre palabras y sin espacios en los bordes
export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// Últimos dígitos del WhatsApp que se muestran al confirmar el alta
export const PHONE_TAIL_DIGITS = 4;

// El cierre de /empezar. No promete una línea aparte (Cale usa el número del negocio) ni una fecha
export function closingMessage(ownerWhatsapp: string): string {
  return `Te anotamos. Apenas Cale esté listo para tu negocio, te escribimos a tu WhatsApp (el que termina en ${ownerWhatsapp.slice(-PHONE_TAIL_DIGITS)}).`;
}

// WhatsApp argentino de celular: devuelve 549 + código de área + número (solo dígitos), o null si no se puede armar
export function normalizeWhatsapp(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith(INTERNATIONAL_CALL_PREFIX)) digits = digits.slice(INTERNATIONAL_CALL_PREFIX.length);

  const withMobilePrefix = `${COUNTRY_CODE}${MOBILE_PREFIX}`;
  if (digits.startsWith(withMobilePrefix) && digits.length === FULL_MOBILE_DIGITS) return digits;
  if (digits.startsWith(COUNTRY_CODE) && digits.length === FULL_MOBILE_DIGITS_WITHOUT_NINE) {
    return `${withMobilePrefix}${digits.slice(COUNTRY_CODE.length)}`;
  }
  if (digits.length === NATIONAL_MOBILE_DIGITS) return `${withMobilePrefix}${digits}`;
  return null;
}

function validateText(value: string, limits: { min: number; max: number }, emptyMessage: string): string | undefined {
  const text = cleanText(value);
  if (text.length === 0) return emptyMessage;
  if (text.length < limits.min) return `Escribí al menos ${limits.min} letras.`;
  if (text.length > limits.max) return `Es muy largo: máximo ${limits.max} caracteres.`;
  if (!ALLOWED_TEXT.test(text)) return 'Usá solo letras, números y signos comunes.';
  return undefined;
}

function validateWhatsapp(value: string): string | undefined {
  if (cleanText(value).length === 0) return 'Escribí el número.';
  if (normalizeWhatsapp(value) === null) return 'Escribilo con el código de área, sin 0 ni 15. Ejemplo: 11 5555 0142.';
  return undefined;
}

function validateChoice(value: string, allowed: readonly string[], emptyMessage: string): string | undefined {
  return allowed.includes(value) ? undefined : emptyMessage;
}

const FIELD_VALIDATORS: Record<LeadField, (form: LeadForm) => string | undefined> = {
  businessName: (form) => validateText(form.businessName, LEAD_LIMITS.businessName, 'Escribí el nombre de tu negocio.'),
  businessType: (form) =>
    validateChoice(form.businessType, BUSINESS_TYPES, 'Elegí el tipo de negocio.'),
  city: (form) => validateText(form.city, LEAD_LIMITS.city, 'Escribí tu ciudad.'),
  weeklyAppointments: (form) =>
    validateChoice(form.weeklyAppointments, WEEKLY_APPOINTMENTS.map((option) => option.value), 'Elegí una opción.'),
  currentMethod: (form) =>
    validateChoice(form.currentMethod, CURRENT_METHODS.map((option) => option.value), 'Elegí una opción.'),
  ownerName: (form) => validateText(form.ownerName, LEAD_LIMITS.ownerName, 'Escribí tu nombre.'),
  ownerWhatsapp: (form) => validateWhatsapp(form.ownerWhatsapp),
  businessWhatsapp: (form) => validateWhatsapp(form.businessWhatsapp),
  consent: (form) => (form.consent ? undefined : 'Necesitamos que aceptes para poder contactarte.'),
};

export function validateStep(step: FormStep, form: LeadForm): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of STEP_FIELDS[step]) {
    const message = FIELD_VALIDATORS[field](form);
    if (message) errors[field] = message;
  }
  return errors;
}

export function validateForm(form: LeadForm): FieldErrors {
  return Object.assign({}, ...FORM_STEPS.map((step) => validateStep(step, form))) as FieldErrors;
}

// Arma los parámetros de submit_lead con todo limpio y normalizado. Falla si algo no es válido.
export function toLeadPayload(form: LeadForm, consentVersion: string): LeadPayload {
  const errors = validateForm(form);
  if (Object.keys(errors).length > 0) throw new LeadValidationError(errors);

  return {
    p_business_name: cleanText(form.businessName),
    p_business_type: form.businessType,
    p_city: cleanText(form.city),
    p_weekly_appointments: form.weeklyAppointments,
    p_current_method: form.currentMethod,
    p_owner_name: cleanText(form.ownerName),
    p_owner_whatsapp: normalizeWhatsapp(form.ownerWhatsapp)!,
    p_business_phone: normalizeWhatsapp(form.businessWhatsapp)!,
    p_consent_version: consentVersion,
  };
}
