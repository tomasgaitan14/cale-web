// Recorrido de /empezar: tres pasos, validación por paso, envío a Supabase y simulación final.
// Todo texto que escribe la persona entra al DOM con textContent, nunca como HTML.
import { LEAD_CONSENT_VERSION } from '../config';
import {
  FORM_STEPS,
  LeadValidationError,
  STEP_FIELDS,
  toLeadPayload,
  validateStep,
  type FieldErrors,
  type FormStep,
  type LeadField,
  type LeadForm,
  type LeadPayload,
} from '../lib/lead';
import { LeadConfigError, LeadRejectedError, LeadServiceError, readSupabaseConfig, submitLead, type LeadResult } from '../lib/lead-api';
import { buildSimulation } from '../lib/simulation';

const NEXT_LABEL = 'Siguiente';
const SUBMIT_LABEL = 'Ver cómo le llega a mis clientes';
const SENDING_LABEL = 'Enviando…';
// Últimos dígitos del WhatsApp que se muestran al confirmar el alta
const PHONE_TAIL_DIGITS = 4;
const MESSAGES = {
  config: 'El formulario no está disponible en este momento. Escribinos por WhatsApp y te ayudamos.',
  rejected: 'Hay un dato que no pudimos aceptar. Revisalo y probá de nuevo.',
  service: 'No pudimos guardar tus datos. Revisá tu conexión y probá de nuevo.',
  unexpected: 'Algo salió mal. Probá de nuevo o escribinos por WhatsApp.',
} as const;

class MissingElementError extends Error {
  constructor(selector: string) {
    super(`Falta el elemento ${selector} en /empezar`);
    this.name = 'MissingElementError';
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new MissingElementError(selector);
  return element;
}

const wizard = required<HTMLElement>(document, '[data-wizard]');
const result = required<HTMLElement>(document, '[data-result]');
const form = required<HTMLFormElement>(wizard, '#lead-form');
const progressLabel = required<HTMLElement>(wizard, '[data-progress-label]');
const formError = required<HTMLElement>(form, '[data-form-error]');
const backButton = required<HTMLButtonElement>(form, '[data-action="back"]');
const nextButton = required<HTMLButtonElement>(form, '[data-action="next"]');
const sameNumber = required<HTMLInputElement>(form, '[data-same-number]');
const businessWhatsappField = required<HTMLElement>(form, '[data-business-whatsapp]');
const honeypot = required<HTMLInputElement>(form, 'input[name="website"]');

const sections = new Map<FormStep, HTMLElement>(FORM_STEPS.map((step) => [step, required<HTMLElement>(form, `[data-step="${step}"]`)]));
const progressItems = new Map<FormStep, HTMLElement>(
  FORM_STEPS.map((step) => [step, required<HTMLElement>(wizard, `[data-progress-step="${step}"]`)]),
);
const LAST_STEP = FORM_STEPS[FORM_STEPS.length - 1];

let currentStep: FormStep = FORM_STEPS[0];

function readForm(): LeadForm {
  const data = new FormData(form);
  const text = (name: LeadField): string => String(data.get(name) ?? '');
  const ownerWhatsapp = text('ownerWhatsapp');
  return {
    businessName: text('businessName'),
    businessType: text('businessType'),
    city: text('city'),
    weeklyAppointments: text('weeklyAppointments'),
    currentMethod: text('currentMethod'),
    ownerName: text('ownerName'),
    ownerWhatsapp,
    businessWhatsapp: sameNumber.checked ? ownerWhatsapp : text('businessWhatsapp'),
    consent: data.get('consent') !== null,
  };
}

function controlsOf(field: LeadField): HTMLElement[] {
  return [...form.querySelectorAll<HTMLElement>(`[name="${field}"]`)];
}

function setFieldError(field: LeadField, message: string): void {
  required<HTMLElement>(form, `[data-error-for="${field}"]`).textContent = message;
  for (const control of controlsOf(field)) {
    if (message) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  }
}

function renderErrors(step: FormStep, errors: FieldErrors): void {
  for (const field of STEP_FIELDS[step]) setFieldError(field, errors[field] ?? '');
  const firstInvalid = STEP_FIELDS[step].find((field) => errors[field]);
  if (firstInvalid) controlsOf(firstInvalid)[0]?.focus();
}

function showStep(step: FormStep, moveFocus: boolean): void {
  currentStep = step;
  for (const [number, section] of sections) section.hidden = number !== step;
  for (const [number, item] of progressItems) {
    item.classList.toggle('is-current', number === step);
    item.classList.toggle('is-done', number < step);
    if (number === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
  progressLabel.textContent = `Paso ${step} de ${FORM_STEPS.length}`;
  backButton.hidden = step === FORM_STEPS[0];
  nextButton.textContent = step === LAST_STEP ? SUBMIT_LABEL : NEXT_LABEL;
  formError.textContent = '';
  if (moveFocus) required<HTMLElement>(sections.get(step)!, 'h2').focus();
}

function showResult(payload: LeadPayload, outcome: LeadResult): void {
  const simulation = buildSimulation({
    businessName: payload.p_business_name,
    businessWhatsapp: payload.p_business_phone,
    today: new Date(),
  });
  const firstName = payload.p_owner_name.split(' ')[0];
  const setText = (selector: string, text: string) => {
    required<HTMLElement>(result, selector).textContent = text;
  };

  setText('[data-result-title]', `Listo, ${firstName}. Así le llegaría a tus clientes`);
  setText('[data-result-lead]', `Ejemplo con los datos de ${payload.p_business_name}. La clienta, el día y la hora son de muestra.`);
  setText('[data-sim="reminder"]', simulation.reminder);
  setText('[data-sim="free-text"]', simulation.freeText);
  setText('[data-sim="redirect"]', simulation.redirect);
  setText('[data-result-closing]', `Te anotamos. Apenas tu línea de recordatorios esté lista, te escribimos a tu WhatsApp (el que termina en ${payload.p_owner_whatsapp.slice(-PHONE_TAIL_DIGITS)}).`);
  required<HTMLElement>(result, '[data-duplicate-note]').hidden = outcome !== 'duplicate';

  wizard.hidden = true;
  result.hidden = false;
  required<HTMLElement>(result, '[data-result-title]').focus();
}

function setSending(sending: boolean): void {
  nextButton.disabled = sending;
  backButton.disabled = sending;
  nextButton.textContent = sending ? SENDING_LABEL : SUBMIT_LABEL;
}

function messageFor(error: unknown): string {
  if (error instanceof LeadConfigError) return MESSAGES.config;
  if (error instanceof LeadRejectedError || error instanceof LeadValidationError) return MESSAGES.rejected;
  if (error instanceof LeadServiceError) return MESSAGES.service;
  return MESSAGES.unexpected;
}

async function sendLead(values: LeadForm): Promise<void> {
  formError.textContent = '';
  setSending(true);
  try {
    const payload = toLeadPayload(values, LEAD_CONSENT_VERSION);
    // Un robot completa la trampa: se le muestra el final igual, pero no se guarda nada
    const outcome: LeadResult = honeypot.value ? 'created' : await submitLead(payload, readSupabaseConfig(import.meta.env));
    showResult(payload, outcome);
  } catch (error) {
    setSending(false);
    formError.textContent = messageFor(error);
    if (!(error instanceof LeadConfigError || error instanceof LeadRejectedError || error instanceof LeadServiceError)) throw error;
  }
}

async function handleSubmit(): Promise<void> {
  const values = readForm();
  const errors = validateStep(currentStep, values);
  renderErrors(currentStep, errors);
  if (Object.keys(errors).length > 0) return;

  const nextStep = FORM_STEPS[currentStep];
  if (nextStep) {
    showStep(nextStep, true);
    return;
  }
  await sendLead(values);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void handleSubmit();
});

backButton.addEventListener('click', () => {
  const previousStep = FORM_STEPS[currentStep - 2];
  if (previousStep) showStep(previousStep, true);
});

// Al corregir un campo, se borra su error
form.addEventListener('input', (event) => {
  const name = (event.target as HTMLInputElement).name as LeadField;
  if (name && STEP_FIELDS[currentStep].includes(name)) setFieldError(name, '');
});

sameNumber.addEventListener('change', () => {
  businessWhatsappField.hidden = sameNumber.checked;
});

wizard.hidden = false;
showStep(FORM_STEPS[0], false);
