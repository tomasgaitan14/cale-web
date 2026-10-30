// Simulación de cómo le llegaría el recordatorio a los clientes de un negocio, al final del formulario de /empezar.
// El texto es el de la plantilla real (REMINDER_PREVIEW en config.ts) con el nombre del negocio de quien lo completa.
import { REMINDER_PREVIEW } from '../config';

// Cliente y horario de ejemplo: la simulación nunca usa datos de personas reales
export const SAMPLE_CLIENT_NAME = 'Lucía';
export const SAMPLE_APPOINTMENT_TIME = '17:30';
// Lo que escribe el cliente de ejemplo cuando no usa los botones
export const SAMPLE_FREE_TEXT = '¿Tenés lugar el sábado?';

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SimulationInput {
  businessName: string;
  // Número de WhatsApp del negocio: 549 + código de área + número
  businessWhatsapp: string;
  // Hoy; el turno de ejemplo es mañana
  today: Date;
}

export interface Simulation {
  // Recordatorio automático, con los botones de la plantilla
  reminder: string;
  replies: readonly string[];
  // Cuando el cliente escribe algo distinto de los botones
  freeText: string;
  redirect: string;
}

export interface DayLabel {
  // "viernes"
  weekday: string;
  // "Vie": el nombre corto que lleva cada fila de la lista de horarios (cale-app: slotLabel)
  shortWeekday: string;
  // "30/10"
  date: string;
}

const SHORT_WEEKDAY_LETTERS = 3;

// El día que cae `days` días después de `today`, con la hora de Argentina
export function dayAfter(today: Date, days: number): DayLabel {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(new Date(today.getTime() + days * DAY_MS));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const weekday = part('weekday');
  const shortWeekday = weekday.slice(0, SHORT_WEEKDAY_LETTERS);
  return {
    weekday,
    shortWeekday: `${shortWeekday.charAt(0).toUpperCase()}${shortWeekday.slice(1)}`,
    date: `${part('day')}/${part('month')}`,
  };
}

export function reminderText(input: { clientName: string; businessName: string; weekday: string; date: string; time: string }): string {
  return `Hola ${input.clientName}, te recordamos tu turno en ${input.businessName} el ${input.weekday} ${input.date} a las ${input.time}. ¿Nos confirmás si venís?`;
}

export function businessWhatsappLink(businessWhatsapp: string): string {
  return `wa.me/${businessWhatsapp}`;
}

export function buildSimulation(input: SimulationInput): Simulation {
  const { weekday, date } = dayAfter(input.today, 1);

  return {
    reminder: reminderText({
      clientName: SAMPLE_CLIENT_NAME,
      businessName: input.businessName,
      weekday,
      date,
      time: SAMPLE_APPOINTMENT_TIME,
    }),
    replies: REMINDER_PREVIEW.replies,
    freeText: SAMPLE_FREE_TEXT,
    redirect: `Para consultas escribí directamente a ${businessWhatsappLink(input.businessWhatsapp)}, este número es de mensajes automáticos.`,
  };
}
