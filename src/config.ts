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

// Formulario de alta de interesados (/empezar). No está en ROUTES: no se indexa ni va al sitemap.
export const START_ROUTE = '/empezar';
// Versión del texto de consentimiento que se guarda con cada alta. Cambiarla cuando cambie ese texto o la política
// de privacidad (se ajusta junto con los textos legales).
export const LEAD_CONSENT_VERSION = '2026-11-01';

// Fecha de vigencia de los textos legales (ISO, se formatea al renderizar).
export const LEGAL_LAST_UPDATED = '2026-11-01';

// Plazos de conservación declarados en la política de privacidad.
export const RETENTION = {
  // Datos del formulario de alta, contados desde que se completa, si el servicio no se activa.
  leadMonths: 12,
  // Datos de turnos, mensajes y estados de entrega, contados desde la fecha del turno.
  appointmentDataMonths: 12,
  // Borrado de todos los datos de un negocio después de que da de baja el servicio.
  afterTerminationDays: 30,
} as const;

// Coexistencia de WhatsApp (el negocio sigue usando su app con el mismo número): requisitos y límites de Meta
// (docs/roadmap.md, "Coexistencia: lo que el negocio tiene que saber").
export const COEXISTENCE = {
  minAppVersion: '2.24.17',
  // Historial de chats que WhatsApp sincroniza al conectar el número
  historyDays: 180,
  maxMessagesPerSecond: 20,
} as const;

// Hora (Argentina) en que salen los recordatorios, el día anterior a cada turno (cale-app: REMINDER_SEND_TIME)
export const REMINDER_SEND_TIME = '7:00';

// Negocio de ejemplo de las animaciones de la portada. El día es fijo (jueves 29/10/2026): la portada es estática y un
// "mañana" calculado al compilar quedaría desfasado a los pocos días.
export const LANDING_SAMPLE = {
  businessName: 'Estética Cuidarte',
  businessWhatsapp: '5493415550187',
  today: '2026-10-29T15:00:00Z',
} as const;

// Textos de la landing (cale-app: docs/PRODUCT_SOURCE_OF_TRUTH.md, sección 9)
export const LANDING_COPY = {
  audience: 'Para negocios que trabajan con turnos',
  title: 'Tus recordatorios de turnos, en automático.',
  subtitle: 'Conectá tu agenda y dejá que Cale envíe los recordatorios por WhatsApp por vos.',
  cta: 'Empezar gratis',
  tagline: 'Menos mensajes manuales. Más tiempo para tu negocio.',
  closing: 'Tu tiempo vale más que mandar recordatorios uno por uno.',
} as const;

// "Cómo funciona" en 3 pasos (prototipo de cale-rediseno, propuesta "Recepción")
export const HOW_IT_WORKS = [
  {
    title: 'Entrá con tu cuenta de Google',
    text: 'Cale crea un calendario de turnos para tu negocio dentro de tu Google Calendar.',
  },
  {
    title: 'Anotá cada turno en tu calendario',
    text: 'Cada turno se anota con el nombre de tu cliente, el servicio y su celular, para poder contactarlo ante cualquier inconveniente.',
  },
  {
    title: 'Cale le escribe a tu cliente el día anterior',
    text: 'Por WhatsApp, en el horario que vos digas. Tu cliente confirma, reprograma o cancela el turno con un botón.',
  },
] as const;

// Vista previa del recordatorio: el texto y los botones reales de la plantilla cale_recordatorio_turno, con los datos de
// ejemplo que se le dieron a Meta (cale-app: REMINDER_TEMPLATE y APPOINTMENT_BUTTONS en api/src/whatsapp/templates.ts)
export const REMINDER_PREVIEW = {
  message: 'Hola Lucía, te recordamos tu turno en Barbería Ribera el jueves 16/10 a las 17:30. ¿Nos confirmás si venís?',
  replies: ['Confirmo', 'Cancelo', 'Cambiar horario'],
} as const;
// Plazos de respuesta de la Ley 25.326 (art. 14 inc. 2 y art. 16 inc. 2).
export const RESPONSE_DEADLINES = {
  accessCalendarDays: 10,
  deletionBusinessDays: 5,
} as const;
