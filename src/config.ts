// Fuente única de los datos del negocio: la usan las páginas, los layouts y los tests.
// Al conectar el dominio propio (.com.ar) solo cambia SITE_URL.

export const SITE_URL = 'https://cale.com.ar';

export const BUSINESS_NAME = 'Cale';
export const OWNER_NAME = 'CRM Solutions';
export const LOCATION = 'Argentina';
export const CONTACT_EMAIL = 'cale.turnos@gmail.com';
// WhatsApp de contacto: formato internacional sin "+" (54 + 9 de celular + característica + número).
export const WHATSAPP_NUMBER = '5491100000000';
export const WHATSAPP_GREETING = 'Hola, quiero saber más sobre Cale para mi negocio.';
// Tribunales competentes que fijan los términos de servicio.
export const JURISDICTION = 'la República Argentina';

// Verificación del dominio en el portfolio de Meta (no es secreta: va en el HTML público).
export const FACEBOOK_DOMAIN_VERIFICATION = 'myontabf6taia94eztrrd8p475ancg';

export const ROUTES = {
  home: '/',
  privacy: '/privacidad',
  terms: '/terminos',
  dataDeletion: '/eliminar-datos',
} as const;

// Fecha de vigencia de los textos legales (ISO, se formatea al renderizar).
export const LEGAL_LAST_UPDATED = '2026-10-11';

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
