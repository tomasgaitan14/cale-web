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
// Asistente de alta (cale-app).
export const APP_URL = 'https://app.cale.com.ar/';
// Prueba gratis: los mismos plazos que cale-app (TRIAL_DAYS en shared/src/trial.ts; TRIAL_NOTICE_DAYS_BEFORE y
// TRIAL_EXTENSION_DAYS en api/src/domain/trial.ts)
export const TRIAL_DAYS = 30;
// El aviso de que termina la prueba sale estos días antes, por WhatsApp
export const TRIAL_NOTICE_DAYS_BEFORE = 2;
// Días de más que se ofrecen, una sola vez, si el negocio dice que no quiere seguir
export const TRIAL_EXTENSION_DAYS = 15;
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
export const LEGAL_LAST_UPDATED = '2026-10-15';

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

// Textos de la landing (cale-app: docs/PRODUCT_SOURCE_OF_TRUTH.md, sección 9)
export const LANDING_COPY = {
  audience: 'Para negocios que trabajan con turnos',
  title: 'Tus recordatorios de turnos, en automático.',
  subtitle: 'Conectá tu agenda y dejá que Cale envíe los recordatorios por WhatsApp por vos.',
  cta: 'Empezar gratis',
  signIn: 'Ingresar a mi cuenta',
  tagline: 'Menos mensajes manuales. Más tiempo para tu negocio.',
  // La conexión de WhatsApp de cada negocio depende de que Meta apruebe a Cale (Fase 5): hasta entonces, se avisa
  whatsappNotice:
    'Sin tarjeta. La conexión con WhatsApp se está habilitando: podés dejar todo listo y anotarte para usarla apenas esté.',
  closing: 'Tu tiempo vale más que mandar recordatorios uno por uno.',
} as const;

// "Cómo funciona" en 3 pasos (prototipo de cale-rediseno, propuesta "Recepción")
export const HOW_IT_WORKS = [
  {
    title: 'Entrá con tu cuenta de Google',
    text: 'Cale crea un calendario de turnos para tu negocio dentro de tu Google Calendar.',
  },
  {
    title: 'Anotá cada turno con el nombre y el celular',
    text: 'Como ya lo hacés: “Lucía - color 11 5555-0142”.',
  },
  {
    title: 'Cale le escribe a tu cliente el día anterior',
    text: `A las ${REMINDER_SEND_TIME}, por WhatsApp. Tu cliente confirma o cancela con un botón.`,
  },
] as const;

// Vista previa del recordatorio: el texto y los botones reales de la plantilla cale_recordatorio_turno, con los datos de
// ejemplo que se le dieron a Meta (cale-app: REMINDER_TEMPLATE y APPOINTMENT_BUTTONS en api/src/whatsapp/templates.ts)
export const REMINDER_PREVIEW = {
  day: 'Miércoles',
  message: 'Hola Lucía, te recordamos tu turno en Barbería Ribera el jueves 16/10 a las 17:30. ¿Nos confirmás si venís?',
  replies: ['Confirmo', 'Cancelo', 'Cambiar horario'],
} as const;
// Horarios libres que se ofrecen para reservar o cambiar un turno (cale-app: api/src/domain/availability.ts)
export const SLOT_OFFER = { maxSlots: 10, daysAhead: 7 } as const;

// Plazos de respuesta de la Ley 25.326 (art. 14 inc. 2 y art. 16 inc. 2).
export const RESPONSE_DEADLINES = {
  accessCalendarDays: 10,
  deletionBusinessDays: 5,
} as const;
