// Tests sobre el HTML que genera `astro build` (dist/): es exactamente lo que ven Meta y los visitantes.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HTMLElement, NodeType, parse, type Node } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  APP_SESSION,
  APP_URL,
  BUSINESS_NAME,
  CONTACT_EMAIL,
  FACEBOOK_DOMAIN_VERIFICATION,
  LOCATION,
  OWNER_NAME,
  REMINDER_SEND_TIME,
  RESPONSE_DEADLINES,
  RETENTION,
  ROUTES,
  SLOT_OFFER,
  TRIAL_DAYS,
  TRIAL_EXTENSION_DAYS,
  TRIAL_NOTICE_DAYS_BEFORE,
  WHATSAPP_HELP_GREETING,
  WHATSAPP_NUMBER,
} from '../src/config';
import { canonicalUrl } from '../src/lib/url';

const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const NOT_FOUND_FILE = '404.html';
const DESCRIPTION_LENGTH = { min: 50, max: 160 };
const TEXT_NODE = NodeType.TEXT_NODE;
const TECHNICAL_JARGON = /\bAPI\b|Cloud API|plantilla|opt-in|webhook|token|Business Platform/i;
// Palabras con mayúscula interna que no son texto pegado
const WORDS_WITH_INNER_CAPITALS = ['WhatsApp'];
const PLACEHOLDER_PATTERN = /en construcci[oó]n|pr[oó]ximamente|lorem ipsum|coming soon|\bTODO\b|\bTBD\b/i;

const INDEXABLE_ROUTES = Object.values(ROUTES);

function routeToFile(route: string): string {
  return route === '/' ? 'index.html' : `${route.slice(1)}.html`;
}

function loadPage(file: string): HTMLElement {
  return parse(readFileSync(join(DIST_DIR, file), 'utf8'));
}

function bodyText(page: HTMLElement): string {
  return (page.querySelector('body')?.text ?? '').replace(/\s+/g, ' ');
}

function textNodes(element: HTMLElement): Node[] {
  return element.childNodes.flatMap((child) =>
    child.nodeType === TEXT_NODE ? [child] : child instanceof HTMLElement ? textNodes(child) : [],
  );
}

function metaContent(page: HTMLElement, selector: string): string | undefined {
  return page.querySelector(selector)?.getAttribute('content');
}

const pages = new Map<string, HTMLElement>();

beforeAll(() => {
  if (!existsSync(DIST_DIR)) {
    throw new Error('No existe dist/. Corré `npm test`, que buildea antes de testear.');
  }
  for (const route of INDEXABLE_ROUTES) {
    const file = routeToFile(route);
    if (existsSync(join(DIST_DIR, file))) pages.set(route, loadPage(file));
  }
});

describe('build', () => {
  it.each(INDEXABLE_ROUTES)('genera la página de %s', (route) => {
    expect(existsSync(join(DIST_DIR, routeToFile(route)))).toBe(true);
  });

  it('genera una 404 que no se indexa', () => {
    const page = loadPage(NOT_FOUND_FILE);
    expect(metaContent(page, 'meta[name="robots"]')).toBe('noindex');
    expect(page.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

describe.each(INDEXABLE_ROUTES)('página %s', (route) => {
  const page = () => pages.get(route)!;

  it('está en español de Argentina', () => {
    expect(page().querySelector('html')?.getAttribute('lang')).toBe('es-AR');
  });

  it('tiene título con el nombre del negocio y un solo h1', () => {
    expect(page().querySelector('title')?.text).toContain(BUSINESS_NAME);
    expect(page().querySelectorAll('h1')).toHaveLength(1);
  });

  it('tiene una meta description de largo razonable', () => {
    const description = metaContent(page(), 'meta[name="description"]') ?? '';
    expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_LENGTH.min);
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_LENGTH.max);
  });

  it('tiene canonical y Open Graph coherentes', () => {
    const expectedUrl = canonicalUrl(route);
    expect(page().querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(expectedUrl);
    expect(metaContent(page(), 'meta[property="og:url"]')).toBe(expectedUrl);
    expect(metaContent(page(), 'meta[property="og:title"]')).toBe(page().querySelector('title')?.text);
    expect(metaContent(page(), 'meta[property="og:description"]')).toBe(
      metaContent(page(), 'meta[name="description"]'),
    );
    expect(metaContent(page(), 'meta[property="og:locale"]')).toBe('es_AR');
  });

  it('muestra el negocio, el titular, la ubicación y el email de contacto', () => {
    const text = bodyText(page());
    expect(text).toContain(BUSINESS_NAME);
    expect(text).toContain(OWNER_NAME);
    expect(text).toContain(LOCATION);
    expect(text).toContain(CONTACT_EMAIL);
    const mailtoLinks = page()
      .querySelectorAll('a')
      .filter((link) => link.getAttribute('href')?.startsWith(`mailto:${CONTACT_EMAIL}`));
    expect(mailtoLinks.length).toBeGreaterThan(0);
  });

  it.each([ROUTES.privacy, ROUTES.terms, ROUTES.dataDeletion])('linkea a %s', (target) => {
    expect(page().querySelector(`a[href="${target}"]`)).not.toBeNull();
  });

  // Astro recorta el espacio de un salto de línea antes de {expresión} o de una etiqueta inline:
  // "dentro de los\n{plazo}" se renderiza como "dentro de los5".
  it('no pega palabras entre sí ni con números', () => {
    const glued: string[] = [];
    for (const node of textNodes(page().querySelector('body')!)) {
      // "los5" (letra+número), "queCale" (minúscula+mayúscula) o "Contacto,Cale" (puntuación+letra)
      for (const match of node.text.matchAll(/\S*(?:\p{Ll}\d|\p{Ll}\p{Lu}|[,;:]\p{L})\S*/gu)) {
        if (!WORDS_WITH_INNER_CAPITALS.some((word) => match[0].includes(word))) glued.push(match[0]);
      }
    }
    for (const element of page().querySelectorAll('body a, body strong, body em, body time')) {
      const previous = element.previousSibling;
      const next = element.nextSibling;
      if (previous?.nodeType === TEXT_NODE && /[\p{L},;:]$/u.test(previous.text) && /^[\p{L}\d]/u.test(element.text)) {
        glued.push(`${previous.text.trim().split(' ').at(-1)}|${element.text}`);
      }
      if (next?.nodeType === TEXT_NODE && /[\p{L}\d]$/u.test(element.text) && /^\p{L}/u.test(next.text)) {
        glued.push(`${element.text}|${next.text.trim().split(' ')[0]}`);
      }
    }
    expect(glued).toEqual([]);
  });

  it('no tiene textos de relleno ni de "en construcción"', () => {
    expect(bodyText(page())).not.toMatch(PLACEHOLDER_PATTERN);
  });

  // La CSP del sitio (SecurityHeadersFunction en infra/site.yaml) bloquea scripts y estilos inline: si aparecen, se rompen en producción.
  it('no tiene scripts ni estilos inline', () => {
    expect(page().querySelectorAll('script')).toHaveLength(0);
    expect(page().querySelectorAll('style')).toHaveLength(0);
    expect(page().querySelectorAll('[style]')).toHaveLength(0);
  });
});

describe('links internos', () => {
  it('títulos y descriptions no se repiten entre páginas', () => {
    const titles = [...pages.values()].map((page) => page.querySelector('title')?.text);
    const descriptions = [...pages.values()].map((page) => metaContent(page, 'meta[name="description"]'));
    expect(new Set(titles).size).toBe(pages.size);
    expect(new Set(descriptions).size).toBe(pages.size);
  });

  it('todos los links internos y anclas apuntan a algo que existe', () => {
    const broken: string[] = [];
    for (const [route, page] of pages) {
      for (const link of page.querySelectorAll('a')) {
        const href = link.getAttribute('href') ?? '';
        if (!href.startsWith('/') && !href.startsWith('#')) continue;

        const [path, hash] = href.split('#');
        const targetRoute = path === '' ? route : path;
        const targetFile = join(DIST_DIR, routeToFile(targetRoute));
        if (!existsSync(targetFile)) {
          broken.push(`${route} → ${href}`);
          continue;
        }
        if (hash && !loadPage(routeToFile(targetRoute)).querySelector(`[id="${hash}"]`)) {
          broken.push(`${route} → ${href} (no existe el ancla)`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('contenido requerido', () => {
  // Meta busca la etiqueta en el <head> del HTML de la home, sin JS
  it('la home tiene la etiqueta de verificación de dominio de Meta en el head', () => {
    expect(FACEBOOK_DOMAIN_VERIFICATION).toMatch(/^[a-z0-9]{20,}$/);
    const tag = pages.get(ROUTES.home)!.querySelector('head meta[name="facebook-domain-verification"]');
    expect(tag?.getAttribute('content')).toBe(FACEBOOK_DOMAIN_VERIFICATION);
  });

  it('la landing explica cómo funciona, el mismo número, la instalación, para quién es y tiene contacto', () => {
    const page = pages.get(ROUTES.home)!;
    for (const id of ['comparacion', 'mismo-numero', 'instalacion', 'para-quien', 'contacto']) {
      expect(page.querySelector(`#${id}`)).not.toBeNull();
    }
    const text = bodyText(page);
    for (const reply of ['Confirmo', 'Cancelo', 'Cambiar horario']) {
      expect(text).toContain(reply);
    }
    expect(text).toContain('mismo número');
  });

  // Cada fila compara el mismo momento: "sin" en gris con una X y "con" con un check, con encabezados de columna
  it('la comparación tiene 4 filas con su par "sin" y "con", y el link de la portada lleva ahí', () => {
    const page = pages.get(ROUTES.home)!;
    const table = page.querySelector('#comparacion table')!;
    expect(table.querySelectorAll('thead th').map((header) => header.text.trim())).toEqual(['Sin Cale', 'Con Cale']);
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const [without, withCale] = row.querySelectorAll('td');
      expect(without?.classList.contains('compare-without')).toBe(true);
      expect(without?.querySelector('.compare-icon svg')).not.toBeNull();
      expect(withCale?.classList.contains('compare-with')).toBe(true);
      expect(withCale?.querySelector('.compare-icon svg')).not.toBeNull();
      expect(without?.querySelector('.compare-icon')?.innerHTML).not.toBe(withCale?.querySelector('.compare-icon')?.innerHTML);
    }
    expect(page.querySelector('.hero a[href="#comparacion"]')?.text).toBe('Ver cómo funciona');
  });

  // Público mayor: la portada habla en criollo, sin términos técnicos
  it('la landing no usa términos técnicos', () => {
    expect(bodyText(pages.get(ROUTES.home)!)).not.toMatch(TECHNICAL_JARGON);
  });

  it.each(INDEXABLE_ROUTES)('%s tiene el botón de WhatsApp con el número del negocio', (route) => {
    const whatsappLinks = pages
      .get(route)!
      .querySelectorAll('a')
      .filter((link) => link.getAttribute('href')?.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`));
    expect(whatsappLinks.length).toBeGreaterThan(0);
  });

  it('la landing ofrece WhatsApp en la instalación, al cierre y en el pie', () => {
    const whatsappLinks = pages
      .get(ROUTES.home)!
      .querySelectorAll('a')
      .filter((link) => link.getAttribute('href')?.startsWith(`https://wa.me/${WHATSAPP_NUMBER}`));
    expect(whatsappLinks).toHaveLength(3);
  });

  // La acción principal es instalar: los botones de arriba llevan a la sección de instalación (con los pasos y el costo
  // de WhatsApp) y recién el de esa sección abre el asistente
  it.each(INDEXABLE_ROUTES)('%s tiene "Probalo GRATIS" arriba, que lleva a la sección de instalación', (route) => {
    const install = pages.get(route)!.querySelector('header.site-header a.button');
    expect(install?.text.trim()).toBe('Probalo GRATIS');
    expect(install?.getAttribute('href')).toBe('/#instalacion');
  });

  // Objetivo del sitio: todo lleva a "Probalo GRATIS". Antes de la instalación, a la sección (pasos y costo de
  // WhatsApp); desde la sección y el cierre, al asistente.
  it('en la landing cada sección clave tiene "Probalo GRATIS" y lleva al lugar que corresponde', () => {
    const page = pages.get(ROUTES.home)!;
    const trialIn = (selector: string) =>
      page.querySelector(selector)!.querySelectorAll('a').find((link) => link.text.trim() === 'Probalo GRATIS');
    expect(trialIn('.hero')?.getAttribute('href')).toBe('/#instalacion');
    expect(trialIn('#comparacion')?.getAttribute('href')).toBe('/#instalacion');
    expect(trialIn('#instalacion')?.getAttribute('href')).toBe(APP_URL);
    expect(trialIn('#contacto')?.getAttribute('href')).toBe(APP_URL);
  });

  // Video de la instalación (cale-video): sin sonido, arranca solo en bucle sin pantalla completa en el iPhone, con controles
  // para pausarlo, imagen de espera y una descripción para lectores de pantalla. Los archivos tienen que existir.
  it('la instalación muestra el video al lado de los pasos', () => {
    const video = pages.get(ROUTES.home)!.querySelector('#instalacion video')!;
    for (const attribute of ['autoplay', 'muted', 'loop', 'playsinline', 'controls']) {
      expect(video.hasAttribute(attribute), attribute).toBe(true);
    }
    expect(video.getAttribute('aria-label')).toMatch(/^Video: cómo se instala Cale/);
    for (const attribute of ['src', 'poster']) {
      const path = video.getAttribute(attribute)!;
      expect(existsSync(join(DIST_DIR, path)), `${attribute}: ${path}`).toBe(true);
    }
  });

  // El argumento en orden: el dolor, la diferencia, la objeción del número, cómo empezar y la prueba gratis
  it('la landing va del dolor a la prueba gratis', () => {
    const page = pages.get(ROUTES.home)!;
    const order = page.querySelectorAll('main > section[id]').map((section) => section.id);
    expect(order).toEqual(['para-quien', 'comparacion', 'mismo-numero', 'instalacion', 'contacto']);
    expect(page.querySelector('#para-quien h2')?.text).toBe('Cada turno que se olvidan es plata que perdés');
    expect(page.querySelector('#contacto h2')?.text).toBe(`Probalo gratis ${TRIAL_DAYS} días en tu negocio`);
  });

  // Resumen corto en 4 pasos (el detalle lo da el asistente), la prueba gratis y, desde el principio, que WhatsApp
  // cobra los mensajes aparte. Ayuda por WhatsApp con un mensaje propio.
  it('la instalación resume los pasos, la prueba gratis, el costo de WhatsApp y ofrece ayuda', () => {
    const section = pages.get(ROUTES.home)!.querySelector('#instalacion')!;
    expect(section.querySelector('h2')?.text).toBe(`Hacé la instalación por tu cuenta y probalo gratis por ${TRIAL_DAYS} días`);
    expect(section.querySelectorAll('ol li').map((step) => step.text)).toEqual([
      'Ingresá los datos de tu negocio.',
      'Te creamos un calendario de turnos automáticamente.',
      'Conectás tu WhatsApp.',
      'Ya podés usarlo.',
    ]);
    expect(section.text).toContain('WhatsApp cobra los mensajes aparte');
    const help = section.querySelector(`a[href^="https://wa.me/${WHATSAPP_NUMBER}"]`);
    expect(help?.getAttribute('href')).toBe(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_HELP_GREETING)}`);
  });

  it('la política de privacidad cubre datos, Meta, proveedores, plazos y Ley 25.326', () => {
    const page = pages.get(ROUTES.privacy)!;
    const text = bodyText(page);
    for (const required of [
      'Ley 25.326',
      // Leyenda obligatoria de la Disposición 10/2008 (frases que no aparecen en otra parte de la página)
      'a intervalos no inferiores a seis meses',
      'La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley Nº 25.326',
      'WhatsApp Business Platform',
      'Número de teléfono',
      'Datos del turno',
      'Contenido de los mensajes',
      'Estados de entrega',
      // Proveedores actuales: AWS (sitio, asistente y base), Google (calendario e inicio de sesión) y Meta (WhatsApp)
      'Amazon Web Services',
      'Google LLC',
      'el inicio de sesión con Google',
      'Meta Platforms',
      // El asistente de alta: entrar con Google (nombre y correo), dos cookies necesarias y sin analítica
      'El nombre y el correo de la cuenta de Google',
      `dos cookies, necesarias para entrar: una acompaña cada intento de entrar con Google y dura ${APP_SESSION.loginAttemptMinutes} minutos`,
      'No usa cookies de analítica ni de publicidad',
      // Etapa 7: Cale cambia el calendario según lo que pide el cliente, toma turnos por WhatsApp y descarta los
      // mensajes que no piden un turno
      'borrar el que cancela, moverlo al horario que elige y anotar el que reserva por WhatsApp',
      'los demás los descarta sin guardarlos',
      'el nombre de pila de su perfil de WhatsApp',
      'días y horarios de atención, duración de los turnos y días sin atención',
      'calendario de turnos',
      `${RETENTION.appointmentDataMonths} meses`,
      `${RETENTION.afterTerminationDays} días`,
      `${RESPONSE_DEADLINES.deletionBusinessDays} días hábiles`,
      // Cale le escribe al negocio por WhatsApp sobre su cuenta, con su consentimiento, y guarda lo que responde
      'Escribirle por WhatsApp al negocio',
      'al cargar su número en el asistente, donde se lo avisamos',
      'lo que responde a nuestros mensajes de WhatsApp sobre la prueba',
      `${RETENTION.trialNoticeDays} días del día en que salen`,
      `a los ${RETENTION.buttonReplyDays} días`,
    ]) {
      expect(text, `falta "${required}"`).toContain(required);
    }
  });

  it('los términos cubren el servicio real, la prueba gratis, opt-in, pago a Meta y responsabilidad', () => {
    const text = bodyText(pages.get(ROUTES.terms)!);
    for (const required of [
      'Consentimiento de los clientes (opt-in)',
      'Cada negocio paga esos mensajes directamente a Meta',
      'Limitación de responsabilidad',
      'Ley aplicable y jurisdicción',
      // Coexistencia: mismo número y misma app, y el acceso de Cale es revocable
      'sigue usando la misma app y el mismo número',
      'puede quitarle el acceso',
      // Calendario de turnos en la cuenta de Cale, que Cale cambia según lo que responde cada cliente
      'calendario de turnos',
      `a las ${REMINDER_SEND_TIME} del día anterior`,
      'si cancela, lo borra del calendario',
      `le ofrece hasta ${SLOT_OFFER.maxSlots} horarios libres de los próximos ${SLOT_OFFER.daysAhead} días y mueve el turno al que elija`,
      'Tomar turnos por WhatsApp',
      'uno por vez por cliente',
      'turnos ofrecidos o tomados según horarios o un calendario desactualizados',
      // Prueba gratis: plazo, aviso por WhatsApp, días de más una vez, sin cobro automático y qué pasa al terminar
      `gratis durante ${TRIAL_DAYS} días`,
      `${TRIAL_NOTICE_DAYS_BEFORE} días antes de que termine la prueba, le escribimos al negocio por WhatsApp`,
      `${TRIAL_EXTENSION_DAYS} días más de prueba gratis, una sola vez`,
      'no cobra nada de forma automática',
      'el servicio se pausa',
      // Al dar de baja, el negocio puede pedir sus turnos
      'sus turnos en un archivo',
    ]) {
      expect(text, `falta "${required}"`).toContain(required);
    }
  });

  // Decisión de Titular (2026-10-11): el sitio no habla del precio del servicio.
  it.each(INDEXABLE_ROUTES)('%s no menciona el precio del servicio', (route) => {
    expect(bodyText(pages.get(route)!)).not.toMatch(/precio|cu[aá]nto cuesta|propuesta comercial|lo que cobra/i);
  });

  it('la página de eliminación explica cómo pedirlo y en qué plazo', () => {
    const page = pages.get(ROUTES.dataDeletion)!;
    const deletionLink = page
      .querySelectorAll('a')
      .find((link) => link.getAttribute('href')?.startsWith(`mailto:${CONTACT_EMAIL}?subject=`));
    expect(deletionLink).toBeDefined();
    expect(bodyText(page)).toContain(`${RESPONSE_DEADLINES.deletionBusinessDays} días hábiles`);
    expect(bodyText(page)).toContain('Le pasamos tu pedido al negocio');
  });

  // Supabase y Vercel ya no intervienen: nombrarlos sería informar mal a quién se entregan los datos
  it.each(INDEXABLE_ROUTES)('%s no nombra proveedores que ya no se usan', (route) => {
    expect(bodyText(pages.get(route)!)).not.toMatch(/Supabase|Vercel/);
  });
});
