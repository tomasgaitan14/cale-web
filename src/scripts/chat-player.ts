// Reproductor de la simulación de /empezar: recorre las escenas de lib/chat-script.ts armando los mensajes en pantalla
// (escribiendo…, el mensaje, el toque en un botón, la respuesta) y vuelve a empezar. Tiene pausa y "ver otro ejemplo".
// Con "reducir movimiento" no arranca sola: muestra la escena completa y quieta. Los textos entran con textContent.
import { STEP_SECONDS, transcriptOf, type ChatScenario, type ChatStep } from '../lib/chat-script';

// Tiempos de la animación, en milisegundos (los mismos que usa la portada: lib/chat-script.ts)
const MS_PER_SECOND = 1000;
const TIMING = {
  typing: STEP_SECONDS.typing * MS_PER_SECOND,
  read: STEP_SECONDS.read * MS_PER_SECOND,
  press: STEP_SECONDS.press * MS_PER_SECOND,
  customer: STEP_SECONDS.customer * MS_PER_SECOND,
  hold: STEP_SECONDS.hold * MS_PER_SECOND,
} as const;
const LABELS = { pause: 'Pausar', play: 'Reproducir' } as const;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

class MissingSimulationElementError extends Error {
  constructor(selector: string) {
    super(`Falta el elemento ${selector} en la simulación`);
    this.name = 'MissingSimulationElementError';
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new MissingSimulationElementError(selector);
  return element;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

function typingIndicator(): HTMLElement {
  const indicator = element('div', 'sim-msg sim-in sim-typing');
  indicator.append(element('span', 'sim-dot'), element('span', 'sim-dot'), element('span', 'sim-dot'));
  return indicator;
}

type TextStep = Extract<ChatStep, { text: string }>;

let stopCurrent: (() => void) | undefined;

export function startSimulation(root: HTMLElement, scenarios: readonly ChatScenario[]): void {
  stopCurrent?.();

  const stage = required<HTMLElement>(root, '[data-sim-stage]');
  const caption = required<HTMLElement>(root, '[data-sim-caption]');
  const toggle = required<HTMLButtonElement>(root, '[data-sim-toggle]');
  const next = required<HTMLButtonElement>(root, '[data-sim-next]');
  const transcript = required<HTMLElement>(root, '[data-sim-transcript]');
  const dots = [...root.querySelectorAll<HTMLElement>('[data-sim-dot]')];

  transcript.replaceChildren(...transcriptOf(scenarios).map((text) => element('li', '', text)));

  let generation = 0;
  let index = 0;
  let paused = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  // Hay una animación en marcha (puede estar en pausa); con "reducir movimiento" no hay ninguna hasta tocar Reproducir
  let loopAlive = false;
  let waiters: (() => void)[] = [];

  function setPaused(value: boolean): void {
    paused = value;
    toggle.textContent = value ? LABELS.play : LABELS.pause;
    if (!value) {
      for (const release of waiters) release();
      waiters = [];
    }
  }

  const waitWhilePaused = (): Promise<void> => (paused ? new Promise<void>((resolve) => waiters.push(resolve)) : Promise.resolve());

  // Espera `ms` (y mientras esté en pausa). Devuelve false si esta corrida ya no es la vigente.
  async function pace(ms: number, run: number): Promise<boolean> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
    await waitWhilePaused();
    return run === generation;
  }

  function appendBot(step: TextStep & { kind: 'bot' }): void {
    stage.append(element('div', 'sim-msg sim-in', step.text));
    if (step.buttons) {
      const list = element('ul', 'sim-buttons');
      for (const label of step.buttons) list.append(element('li', 'sim-button-reply', label));
      stage.append(list);
    }
  }

  function press(label: string): void {
    const lists = stage.querySelectorAll('.sim-buttons');
    const buttons = [...(lists[lists.length - 1]?.querySelectorAll<HTMLElement>('.sim-button-reply') ?? [])];
    buttons.find((button) => button.textContent === label)?.classList.add('sim-pressed');
  }

  function appendStatic(step: ChatStep): void {
    if (step.kind === 'bot') appendBot(step);
    else if (step.kind === 'press') press(step.button);
    else stage.append(element('div', 'sim-msg sim-out', step.text));
  }

  function showScenario(scenarioIndex: number): ChatScenario {
    const scenario = scenarios[scenarioIndex];
    stage.replaceChildren();
    caption.textContent = scenario.caption;
    dots.forEach((dot, position) => {
      dot.classList.toggle('is-current', position === scenarioIndex);
      dot.classList.toggle('is-done', position < scenarioIndex);
    });
    return scenario;
  }

  // La escena entera de una vez, sin esperas
  function showCompleteScenario(scenarioIndex: number): void {
    for (const step of showScenario(scenarioIndex).steps) appendStatic(step);
  }

  async function playStep(step: ChatStep, run: number): Promise<boolean> {
    if (step.kind === 'bot') {
      const typing = typingIndicator();
      stage.append(typing);
      const stillCurrent = await pace(TIMING.typing, run);
      typing.remove();
      if (!stillCurrent) return false;
      appendStatic(step);
      return pace(TIMING.read, run);
    }
    appendStatic(step);
    return pace(step.kind === 'press' ? TIMING.press : TIMING.customer, run);
  }

  async function loop(run: number): Promise<void> {
    while (run === generation) {
      for (const step of showScenario(index).steps) {
        if (!(await playStep(step, run))) return;
      }
      if (!(await pace(TIMING.hold, run))) return;
      index = (index + 1) % scenarios.length;
    }
  }

  function startLoop(): void {
    generation += 1;
    loopAlive = true;
    void loop(generation);
  }

  toggle.addEventListener('click', () => {
    if (!paused) {
      setPaused(true);
      return;
    }
    setPaused(false);
    if (!loopAlive) startLoop();
  });

  next.addEventListener('click', () => {
    index = (index + 1) % scenarios.length;
    // La corrida en marcha (si hay) termina sola en su próxima espera
    generation += 1;
    if (paused) {
      loopAlive = false;
      showCompleteScenario(index);
    } else {
      startLoop();
    }
  });

  setPaused(paused);
  if (paused) {
    showCompleteScenario(index);
  } else {
    startLoop();
  }

  stopCurrent = () => {
    generation += 1;
    loopAlive = false;
    setPaused(false);
  };
}
