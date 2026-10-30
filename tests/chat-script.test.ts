// Guion de la simulación animada (src/lib/chat-script.ts). Los textos de respuesta tienen que ser los de cale-app
// (api/src/whatsapp/messages.ts): si ahí cambian, este test es donde se actualiza la copia.
import { describe, expect, it } from 'vitest';
import { REMINDER_PREVIEW } from '../src/config';
import {
  SAMPLE_NEW_TIME,
  SCENARIO_IDS,
  STEP_SECONDS,
  VIEW_SLOTS_LABEL,
  buildScenarios,
  schedule,
  transcriptOf,
  type ChatStep,
} from '../src/lib/chat-script';

const BUSINESS = 'Peluquería Sol';
const BUSINESS_WHATSAPP = '5493445123456';
// Jueves 29/10/2026, 12:00 en Argentina: mañana es viernes 30/10 y pasado mañana, sábado 31/10
const TODAY = new Date('2026-10-29T15:00:00Z');
const [CONFIRM, CANCEL, RESCHEDULE] = REMINDER_PREVIEW.replies;

const scenarios = buildScenarios({ businessName: BUSINESS, businessWhatsapp: BUSINESS_WHATSAPP, today: TODAY });

function scenario(id: string) {
  const found = scenarios.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No hay una escena ${id}`);
  return found;
}

function texts(id: string): string[] {
  return scenario(id).steps.flatMap((step) => (step.kind === 'press' ? [] : [step.text]));
}

describe('buildScenarios', () => {
  it('tiene cuatro escenas, en este orden', () => {
    expect(scenarios.map((item) => item.id)).toEqual([...SCENARIO_IDS]);
    expect(SCENARIO_IDS).toEqual(['confirm', 'cancel', 'reschedule', 'free-text']);
  });

  it('toda escena empieza con el recordatorio real y sus tres botones', () => {
    for (const item of scenarios) {
      const first = item.steps[0];
      expect(first.kind).toBe('bot');
      expect(first).toMatchObject({
        text: 'Hola Lucía, te recordamos tu turno en Peluquería Sol el viernes 30/10 a las 17:30. ¿Nos confirmás si venís?',
        buttons: REMINDER_PREVIEW.replies,
      });
    }
  });

  it('confirmar: toca "Confirmo" y Cale agradece con el día y la hora (confirmedReply)', () => {
    expect(scenario('confirm').steps).toEqual([
      expect.objectContaining({ kind: 'bot' }),
      { kind: 'press', button: CONFIRM },
      { kind: 'customer', text: CONFIRM },
      { kind: 'bot', text: '¡Gracias, Lucía! Te esperamos el viernes 30/10 a las 17:30.' },
    ]);
  });

  it('cancelar: Cale cancela el turno y nombra el negocio (cancelledReply)', () => {
    expect(texts('cancel').at(-1)).toBe('Listo, Lucía. Cancelamos tu turno del viernes 30/10 a las 17:30 en Peluquería Sol.');
    expect(scenario('cancel').steps[1]).toEqual({ kind: 'press', button: CANCEL });
  });

  it('cambiar horario: ofrece horarios libres, la clienta elige uno y Cale confirma el nuevo (SLOTS_INTRO.choose y movedReply)', () => {
    const steps = scenario('reschedule').steps;
    expect(steps[1]).toEqual({ kind: 'press', button: RESCHEDULE });
    expect(steps[3]).toEqual({ kind: 'bot', text: 'Elegí tu nuevo horario en Peluquería Sol:', buttons: [VIEW_SLOTS_LABEL] });
    expect(steps[4]).toEqual({ kind: 'press', button: VIEW_SLOTS_LABEL });
    // Igual que una fila de la lista de WhatsApp (slotLabel): "Sáb 31/10 10:00"
    expect(steps[5]).toEqual({ kind: 'customer', text: `Sáb 31/10 ${SAMPLE_NEW_TIME}` });
    expect(steps[6]).toEqual({ kind: 'bot', text: `Listo, Lucía. Tu turno quedó para el sábado 31/10 a las ${SAMPLE_NEW_TIME}. ¡Te esperamos!` });
  });

  it('otra cosa: la clienta escribe y Cale la manda al número del negocio', () => {
    const steps = scenario('free-text').steps;
    expect(steps.slice(1)).toEqual([
      { kind: 'customer', text: '¿Tenés lugar el sábado?' },
      { kind: 'bot', text: `Para consultas escribí directamente a wa.me/${BUSINESS_WHATSAPP}, este número es de mensajes automáticos.` },
    ]);
  });

  it('cada toque de botón apunta a un botón que está en el último mensaje de Cale', () => {
    for (const item of scenarios) {
      let buttons: readonly string[] = [];
      for (const step of item.steps) {
        if (step.kind === 'bot') buttons = step.buttons ?? [];
        if (step.kind === 'press') expect(buttons, `${item.id}: "${step.button}" no está en los botones`).toContain(step.button);
      }
    }
  });

  it('cada toque de botón va seguido del mensaje de la clienta con ese mismo texto', () => {
    for (const item of scenarios) {
      item.steps.forEach((step, index) => {
        if (step.kind !== 'press') return;
        const next: ChatStep | undefined = item.steps[index + 1];
        expect(next, `${item.id}: tras tocar "${step.button}" no hay respuesta`).toMatchObject({ kind: 'customer' });
        if (step.button !== VIEW_SLOTS_LABEL) expect(next).toMatchObject({ text: step.button });
      });
    }
  });

  it('las fechas siguen a "hoy": un fin de mes pasa al mes siguiente', () => {
    const endOfMonth = buildScenarios({
      businessName: BUSINESS,
      businessWhatsapp: BUSINESS_WHATSAPP,
      today: new Date('2026-10-31T15:00:00Z'),
    });
    const moved = endOfMonth.find((item) => item.id === 'reschedule')!.steps.at(-1) as { text: string };
    expect(moved.text).toContain('el lunes 02/11');
    expect(endOfMonth[0].steps[0]).toMatchObject({ text: expect.stringContaining('el domingo 01/11') });
  });

  it('el nombre del negocio entra tal cual, sin interpretarse como HTML (el reproductor usa textContent)', () => {
    const odd = buildScenarios({ businessName: 'Salón <b>Luz</b> & Co.', businessWhatsapp: BUSINESS_WHATSAPP, today: TODAY });
    expect(JSON.stringify(odd)).toContain('Salón <b>Luz</b> & Co.');
  });
});

describe('transcriptOf', () => {
  it('da un texto por escena, con la escena, quién habla y sin los toques de botón', () => {
    const transcript = transcriptOf(scenarios);
    expect(transcript).toHaveLength(scenarios.length);
    expect(transcript[0]).toContain('Tu cliente confirma con un toque. Cale: Hola Lucía');
    expect(transcript[0]).toContain('Tu cliente: Confirmo');
    expect(transcript[0]).toContain('Cale: ¡Gracias, Lucía! Te esperamos el viernes 30/10 a las 17:30.');
    expect(transcript[3]).toContain('Cale: Para consultas escribí directamente a wa.me/5493445123456');
  });
});

describe('schedule', () => {
  const { scenes, total } = schedule(scenarios);
  const first = scenes[0];

  it('una escena por escena del guion, una tras otra, sin huecos', () => {
    expect(scenes.map((item) => item.scenario.id)).toEqual([...SCENARIO_IDS]);
    expect(scenes[0].start).toBe(0);
    scenes.slice(1).forEach((item, index) => expect(item.start).toBeCloseTo(scenes[index].end, 9));
    expect(scenes.at(-1)!.end).toBeCloseTo(total, 9);
  });

  it('un mensaje de Cale aparece después de "escribiendo…", y la clienta toca un botón después de leer', () => {
    const [reminder, press, customer, reply] = first.steps;
    expect(reminder.typingAt).toBe(0);
    expect(reminder.at).toBeCloseTo(STEP_SECONDS.typing, 9);
    expect(press.at).toBeCloseTo(STEP_SECONDS.typing + STEP_SECONDS.read, 9);
    expect(press.typingAt).toBeNull();
    expect(customer.at).toBeCloseTo(press.at + STEP_SECONDS.press, 9);
    expect(reply.typingAt).toBeCloseTo(customer.at + STEP_SECONDS.customer, 9);
    expect(reply.at).toBeCloseTo(reply.typingAt! + STEP_SECONDS.typing, 9);
  });

  it('la escena termina con una pausa después de su último mensaje', () => {
    const last = first.steps.at(-1)!;
    expect(first.end).toBeCloseTo(last.at + STEP_SECONDS.read + STEP_SECONDS.hold, 9);
  });

  it('todo paso empieza dentro de su escena y los pasos van en orden', () => {
    for (const scene of scenes) {
      scene.steps.forEach((item, index) => {
        expect(item.at).toBeGreaterThanOrEqual(scene.start);
        expect(item.at).toBeLessThan(scene.end);
        if (index > 0) expect(item.at).toBeGreaterThan(scene.steps[index - 1].at);
      });
    }
  });
});
