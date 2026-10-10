// Fuente única de los datos del negocio: la usan las páginas, los layouts y los tests.
// Al conectar el dominio propio (.com.ar) solo cambia SITE_URL.

export const SITE_URL = 'https://cale-turnos.vercel.app';

export const BUSINESS_NAME = 'Cale';
export const OWNER_NAME = 'CRM Solutions';
export const LOCATION = 'Argentina';
export const CONTACT_EMAIL = 'crmsolutionsgchu@gmail.com';
// Tribunales competentes que fijan los términos de servicio.
export const JURISDICTION = 'la República Argentina';

export const ROUTES = {
  home: '/',
  privacy: '/privacidad',
  terms: '/terminos',
  dataDeletion: '/eliminar-datos',
} as const;

// Fecha de vigencia de los textos legales (ISO, se formatea al renderizar).
export const LEGAL_LAST_UPDATED = '2026-10-10';

// Plazos de conservación declarados en la política de privacidad.
export const RETENTION = {
  // Datos de turnos, mensajes y estados de entrega, contados desde la fecha del turno.
  appointmentDataMonths: 12,
  // Borrado de todos los datos de un negocio después de que da de baja el servicio.
  afterTerminationDays: 30,
} as const;

// Plazos de respuesta de la Ley 25.326 (art. 14 inc. 2 y art. 16 inc. 2).
export const RESPONSE_DEADLINES = {
  accessCalendarDays: 10,
  deletionBusinessDays: 5,
} as const;
