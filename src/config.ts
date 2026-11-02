// Fuente única de los datos del negocio: la usan las páginas, los layouts y los tests.
// Al conectar el dominio propio (.com.ar) solo cambia SITE_URL.

export const SITE_URL = 'https://cale.com.ar';

export const BUSINESS_NAME = 'Cale';
export const LOCATION = 'Argentina';
export const CONTACT_EMAIL = 'cale.turnos@gmail.com';
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
export const LEAD_CONSENT_VERSION = '2026-11-02';

// Fecha de vigencia de los textos legales (ISO, se formatea al renderizar).
export const LEGAL_LAST_UPDATED = '2026-11-02';

// Tope de responsabilidad de los términos (decisión del 02/11/2026): el mayor entre lo pagado en los últimos meses y un
// monto fijo mínimo, para que el tope no sea cero mientras no haya cobro. Cambiar el monto es una decisión del titular.
export const LIABILITY_CAP = {
  lookbackMonths: 12,
  minimum: 'ARS 100.000',
} as const;

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
  today: '2026-10-29T15:00:00Z',
} as const;

// Textos de la landing (cale-app: docs/PRODUCT_SOURCE_OF_TRUTH.md, sección 9)
export const LANDING_COPY = {
  audience: 'Para negocios que trabajan con turnos',
  title: 'Tus recordatorios de turnos, en automático.',
  // Última frase de `title`, que va en el tono gris del título (tiene que ser el final exacto)
  titleSoft: 'en automático.',
  subtitle: 'Conectá tu Google Calendar y dejá que Cale envíe los recordatorios por WhatsApp por vos.',
  cta: 'Empezar gratis',
  tagline: 'Menos mensajes manuales. Más tiempo para tu negocio.',
  closing: 'Tu tiempo vale más que mandar recordatorios uno por uno.',
  // Final de `closing`, en tono gris
  closingSoft: 'recordatorios uno por uno.',
} as const;

// "Cómo funciona" en 3 pasos (prototipo de cale-rediseno, propuesta "Recepción")
export const HOW_IT_WORKS = [
  {
    title: 'Dejanos los datos de tu negocio',
    text: 'Son 3 pasos cortos: cómo se llama tu negocio, cómo anotás hoy los turnos y cómo escribirte.',
  },
  {
    title: 'Anotá tus turnos en tu Google Calendar',
    text: 'Cale crea un calendario de turnos en tu cuenta de Google. Cada turno lleva el nombre de tu cliente, el servicio y su celular, para poder contactarlo ante cualquier inconveniente.',
  },
  {
    title: 'Cale le escribe a tu cliente el día anterior',
    text: 'Por WhatsApp, en el horario que vos digas. Tu cliente confirma, reprograma o cancela el turno con un botón.',
  },
] as const;

// Datos de muestra de las mini-interfaces de "Cómo funciona". Es todo inventado y la portada los rotula "Ejemplo".
// Los textos del formulario son los de las opciones reales de /empezar (lib/lead.ts).
export const HOW_IT_WORKS_SAMPLE = {
  form: [
    { label: 'Nombre del negocio', value: LANDING_SAMPLE.businessName },
    { label: 'Turnos por semana', value: 'Entre 31 y 60' },
    { label: 'Cómo los avisás hoy', value: 'Les escribo por WhatsApp a mano' },
  ],
  appointments: [
    { time: '17:30', client: 'Lucía', service: 'Corte' },
    { time: '18:15', client: 'Brenda', service: 'Color' },
    { time: '19:00', client: 'Joaquín', service: 'Barba' },
  ],
} as const;

// La banda negra: tres datos del producto, no cifras de uso (Cale todavía no tiene clientes que respalden números)
export const LANDING_BAND = {
  title: 'Menos mensajes a mano. Más turnos confirmados.',
  // Última frase de `title`, en tono gris
  titleSoft: 'Más turnos confirmados.',
  facts: [
    { value: REMINDER_SEND_TIME, label: 'Hora de envío por defecto: el recordatorio sale el día anterior al turno y la podés cambiar.' },
    { value: '3', label: 'botones en cada recordatorio: tu cliente confirma, cancela o cambia el horario.' },
    { value: '0', label: 'aplicaciones para instalar: tu cliente responde desde su WhatsApp de siempre.' },
  ],
} as const;

export const RESPONSES_COPY = {
  title: 'Qué pasa cuando tu cliente responde.',
  titleSoft: 'Cada respuesta tiene su camino.',
} as const;

// Preguntas frecuentes: solo lo que ya es verdad del producto. Sin precios (decisión del 11/10/2026) y sin promesas que
// dependan de la conexión de WhatsApp todavía pendiente.
export const FAQ_ITEMS = [
  {
    question: '¿Qué recibe mi cliente?',
    answer:
      'Un mensaje de WhatsApp con el nombre de tu negocio, el día y la hora del turno, y tres botones: Confirmo, Cancelo y Cambiar horario.',
  },
  {
    question: '¿Qué agenda tengo que usar?',
    answer:
      'Google Calendar. Cale crea un calendario de turnos en tu cuenta de Google y desde ahí manda los recordatorios; vos anotás los turnos ahí.',
  },
  {
    question: '¿Qué pasa si mi cliente escribe otra cosa?',
    answer:
      'Te llega a vos, como cualquier mensaje de tu cliente. Cale se ocupa de los recordatorios y de lo que tu cliente responde con los botones.',
  },
  {
    question: '¿Mi cliente tiene que instalar algo?',
    answer: 'No. Recibe el recordatorio en su WhatsApp de siempre y responde con un toque.',
  },
  {
    question: '¿Cuándo sale el recordatorio?',
    answer: 'El día anterior al turno, en el horario que vos elijas.',
  },
  {
    question: '¿Qué pasa con los datos de mis clientes?',
    answer: 'Cale usa los datos de tus turnos solo para mandar los recordatorios. En la política de privacidad está todo el detalle.',
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
