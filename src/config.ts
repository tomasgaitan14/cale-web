// Fuente única de los datos del negocio: la usan las páginas, los layouts y los tests.
// Al conectar el dominio propio (.com.ar) solo cambia SITE_URL.

export const SITE_URL = 'https://cale-turnos.vercel.app';

export const BUSINESS_NAME = 'Cale';
export const OWNER_NAME = 'CRM Solutions';
export const LOCATION = 'Argentina';
export const CONTACT_EMAIL = 'cale.turnos@gmail.com';
// WhatsApp de contacto: formato internacional sin "+" (54 + 9 de celular + característica + número).
export const WHATSAPP_NUMBER = '5491100000000';
export const WHATSAPP_GREETING = 'Hola, quiero saber más sobre Cale para mi negocio.';
// Asistente de alta (cale-app).
export const APP_URL = 'https://app.cale.com.ar/';
// Sección de instalación de la portada: los botones "Probalo GRATIS" de arriba llevan ahí, y desde ahí al asistente
export const INSTALL_SECTION_ID = 'instalacion';
export const INSTALL_SECTION_URL = `/#${INSTALL_SECTION_ID}`;
// Prueba gratis: los mismos plazos que cale-app (TRIAL_DAYS en shared/src/trial.ts; TRIAL_NOTICE_DAYS_BEFORE y
// TRIAL_EXTENSION_DAYS en api/src/domain/trial.ts)
export const TRIAL_DAYS = 30;
// El aviso de que termina la prueba sale estos días antes, por WhatsApp
export const TRIAL_NOTICE_DAYS_BEFORE = 2;
// Días de más que se ofrecen, una sola vez, si el negocio dice que no quiere seguir
export const TRIAL_EXTENSION_DAYS = 15;
// Mensaje ya escrito del link de ayuda de la sección de instalación
export const WHATSAPP_HELP_GREETING = 'Hola, me trabé instalando Cale.';
// Tribunales competentes que fijan los términos de servicio.
export const JURISDICTION = 'la República Argentina';

// Verificación del dominio en el portfolio de Meta (no es secreta: va en el HTML público).
export const FACEBOOK_DOMAIN_VERIFICATION = '55hdqyv5hd3d0eyext8ptkxa76baig';

export const ROUTES = {
  home: '/',
  privacy: '/privacidad',
  terms: '/terminos',
  dataDeletion: '/eliminar-datos',
} as const;

// Fecha de vigencia de los textos legales (ISO, se formatea al renderizar).
export const LEGAL_LAST_UPDATED = '2026-10-14';

// Plazos de conservación declarados en la política de privacidad.
export const RETENTION = {
  // Datos de turnos, mensajes y estados de entrega, contados desde la fecha del turno.
  appointmentDataMonths: 12,
  // Borrado de todos los datos de un negocio después de que da de baja el servicio.
  afterTerminationDays: 30,
  // Avisos de fin de prueba al negocio, desde el día en que salen (cale-app: TRIAL_NOTICE_KEEP_DAYS)
  trialNoticeDays: 30,
  // Registro de las respuestas a los botones de WhatsApp, para no procesarlas dos veces (cale-app: WEBHOOK_MESSAGE_KEEP_DAYS)
  buttonReplyDays: 7,
} as const;

// Plazos del asistente de alta (los mismos que cale-app: api/src/domain/auth.ts)
export const APP_SESSION = {
  // Lo que dura un intento de entrar con Google (la cookie que lo acompaña)
  loginAttemptMinutes: 10,
  sessionDays: 30,
} as const;
// Hora (Argentina) en que salen los recordatorios, el día anterior a cada turno (cale-app: REMINDER_SEND_TIME)
export const REMINDER_SEND_TIME = '7:00';
// Horarios libres que se ofrecen para reservar o cambiar un turno (cale-app: api/src/domain/availability.ts)
export const SLOT_OFFER = { maxSlots: 10, daysAhead: 7 } as const;

// Plazos de respuesta de la Ley 25.326 (art. 14 inc. 2 y art. 16 inc. 2).
export const RESPONSE_DEADLINES = {
  accessCalendarDays: 10,
  deletionBusinessDays: 5,
} as const;
