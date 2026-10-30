// Guion de la simulación animada del final de /empezar: cuatro escenas de WhatsApp. Los textos de las respuestas son
// los de cale-app (api/src/whatsapp/messages.ts: confirmedReply, cancelledReply, SLOTS_INTRO.choose, movedReply); el aviso
// de "mensajes automáticos" es el patrón de la línea solo para recordatorios. Este módulo no toca el DOM: el reproductor
// (scripts/chat-player.ts) lo recorre paso a paso.
import {
  SAMPLE_APPOINTMENT_TIME,
  SAMPLE_CLIENT_NAME,
  buildSimulation,
  dayAfter,
  type SimulationInput,
} from './simulation';

// Horario al que la clienta de ejemplo cambia su turno (dos días después de hoy)
export const SAMPLE_NEW_TIME = '10:00';
export const VIEW_SLOTS_LABEL = 'Ver horarios';

// Las escenas, en el orden en que se reproducen
export const SCENARIO_IDS = ['confirm', 'cancel', 'reschedule', 'free-text'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type ChatStep =
  // Mensaje de Cale, que llega después de "escribiendo…". Puede llevar botones.
  | { kind: 'bot'; text: string; buttons?: readonly string[] }
  // La clienta toca uno de los botones del último mensaje de Cale
  | { kind: 'press'; button: string }
  // Mensaje de la clienta
  | { kind: 'customer'; text: string };

export interface ChatScenario {
  id: ScenarioId;
  // Lo que pasa en la escena, para el rótulo que la acompaña
  caption: string;
  steps: readonly ChatStep[];
}

// Cuánto dura cada cosa en la animación, en segundos
export const STEP_SECONDS = {
  // "escribiendo…" antes de un mensaje de Cale
  typing: 1.1,
  // lo que se tarda en leer un mensaje de Cale
  read: 1.5,
  // el toque de la clienta en un botón
  press: 0.7,
  // la clienta escribe su mensaje
  customer: 0.6,
  // la escena completa queda a la vista antes de pasar a la siguiente
  hold: 2.8,
} as const;

export interface ScheduledStep {
  step: ChatStep;
  // Segundo en que aparece
  at: number;
  // Segundo en que aparece "escribiendo…" (solo los mensajes de Cale)
  typingAt: number | null;
}

export interface ScheduledScenario {
  scenario: ChatScenario;
  // Segundo del ciclo en que empieza y en que termina (incluye la pausa final)
  start: number;
  end: number;
  steps: ScheduledStep[];
}

// Pone cada paso en el segundo en que aparece, para animaciones que se arman de antemano (la portada)
export function schedule(scenarios: readonly ChatScenario[]): { scenes: ScheduledScenario[]; total: number } {
  let cursor = 0;
  const scenes = scenarios.map((scenario) => {
    const start = cursor;
    const steps = scenario.steps.map((step): ScheduledStep => {
      if (step.kind === 'bot') {
        const typingAt = cursor;
        cursor += STEP_SECONDS.typing;
        const at = cursor;
        cursor += STEP_SECONDS.read;
        return { step, at, typingAt };
      }
      const at = cursor;
      cursor += step.kind === 'press' ? STEP_SECONDS.press : STEP_SECONDS.customer;
      return { step, at, typingAt: null };
    });
    cursor += STEP_SECONDS.hold;
    return { scenario, start, end: cursor, steps };
  });
  return { scenes, total: cursor };
}

export function buildScenarios(input: SimulationInput): ChatScenario[] {
  const simulation = buildSimulation(input);
  const tomorrow = dayAfter(input.today, 1);
  const newDay = dayAfter(input.today, 2);
  const when = `el ${tomorrow.weekday} ${tomorrow.date} a las ${SAMPLE_APPOINTMENT_TIME}`;
  const reminder: ChatStep = { kind: 'bot', text: simulation.reminder, buttons: simulation.replies };
  const [confirm, cancel, reschedule] = simulation.replies;

  return [
    {
      id: 'confirm',
      caption: 'Tu cliente confirma con un toque',
      steps: [
        reminder,
        { kind: 'press', button: confirm },
        { kind: 'customer', text: confirm },
        { kind: 'bot', text: `¡Gracias, ${SAMPLE_CLIENT_NAME}! Te esperamos ${when}.` },
      ],
    },
    {
      id: 'cancel',
      caption: 'Si cancela, Cale libera el turno',
      steps: [
        reminder,
        { kind: 'press', button: cancel },
        { kind: 'customer', text: cancel },
        {
          kind: 'bot',
          text: `Listo, ${SAMPLE_CLIENT_NAME}. Cancelamos tu turno del ${tomorrow.weekday} ${tomorrow.date} a las ${SAMPLE_APPOINTMENT_TIME} en ${input.businessName}.`,
        },
      ],
    },
    {
      id: 'reschedule',
      caption: 'Si cambia el horario, elige uno libre',
      steps: [
        reminder,
        { kind: 'press', button: reschedule },
        { kind: 'customer', text: reschedule },
        { kind: 'bot', text: `Elegí tu nuevo horario en ${input.businessName}:`, buttons: [VIEW_SLOTS_LABEL] },
        { kind: 'press', button: VIEW_SLOTS_LABEL },
        { kind: 'customer', text: `${newDay.shortWeekday} ${newDay.date} ${SAMPLE_NEW_TIME}` },
        {
          kind: 'bot',
          text: `Listo, ${SAMPLE_CLIENT_NAME}. Tu turno quedó para el ${newDay.weekday} ${newDay.date} a las ${SAMPLE_NEW_TIME}. ¡Te esperamos!`,
        },
      ],
    },
    {
      id: 'free-text',
      caption: 'Si escribe otra cosa, lo mandamos a tu número',
      steps: [
        reminder,
        { kind: 'customer', text: simulation.freeText },
        { kind: 'bot', text: simulation.redirect },
      ],
    },
  ];
}

// Los textos de la animación, uno por mensaje, para quien no la ve: se lee de corrido sin esperar a que pase
export function transcriptOf(scenarios: readonly ChatScenario[]): string[] {
  return scenarios.map(
    (scenario) =>
      `${scenario.caption}. ` +
      scenario.steps
        .filter((step): step is Extract<ChatStep, { text: string }> => step.kind !== 'press')
        .map((step) => `${step.kind === 'customer' ? 'Tu cliente' : 'Cale'}: ${step.text}`)
        .join(' '),
  );
}
