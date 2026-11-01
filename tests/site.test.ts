// Tests sobre el HTML que genera `astro build` (dist/): es exactamente lo que ven Meta y los visitantes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HTMLElement, NodeType, parse, type Node } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUSINESS_NAME,
  COEXISTENCE,
  CONTACT_EMAIL,
  FACEBOOK_DOMAIN_VERIFICATION,
  LANDING_SAMPLE,
  LEGAL_LAST_UPDATED,
  LOCATION,
  REMINDER_PREVIEW,
  REMINDER_SEND_TIME,
  RESPONSE_DEADLINES,
  RETENTION,
  ROUTES,
  START_ROUTE,
} from '../src/config';
import { SCENARIO_IDS, buildScenarios } from '../src/lib/chat-script';
import { BUSINESS_TYPES, CURRENT_METHODS, FORM_STEPS, WEEKLY_APPOINTMENTS } from '../src/lib/lead';
import { businessInitials } from '../src/lib/simulation';
import { canonicalUrl } from '../src/lib/url';

const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const NOT_FOUND_FILE = '404.html';
const DESCRIPTION_LENGTH = { min: 50, max: 160 };
const TEXT_NODE = NodeType.TEXT_NODE;
const TECHNICAL_JARGON = /\bAPI\b|Cloud API|plantilla|opt-in|webhook|token|Business Platform/i;
// Palabras con mayúscula interna que no son texto pegado
const WORDS_WITH_INNER_CAPITALS = ['WhatsApp'];
const PLACEHOLDER_PATTERN = /en construcci[oó]n|pr[oó]ximamente|lorem ipsum|coming soon/i;
// En mayúsculas: sin distinguir, "TODO" también encuentra la palabra "todo"
const PENDING_MARKER_PATTERN = /\bTODO\b|\bTBD\b/;

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

  // Decisión de Titular (01/11/2026): el sitio no publica datos personales del titular. La marca es "Cale" en todas las
  // páginas, pie y metaetiquetas incluidos. El nombre legal va solo en el formulario privado de Meta, nunca en el repo.
  it('no publica datos personales: ni CUIT, ni otros correos, ni "CRM Solutions"', () => {
    const html = page().toString();
    expect(html).not.toMatch(/CRM Solutions/i);
    expect(html).not.toMatch(/\b\d{2}-\d{8}-\d\b/);
    const emails = html.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
    expect(emails.filter((email) => email !== CONTACT_EMAIL)).toEqual([]);
  });

  it('muestra el negocio, la ubicación y el email de contacto', () => {
    const text = bodyText(page());
    expect(text).toContain(BUSINESS_NAME);
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
    expect(bodyText(page())).not.toMatch(PENDING_MARKER_PATTERN);
  });

  // La CSP (vercel.json) bloquea scripts y estilos inline: si aparecen, se rompen en producción. La portada admite solo
  // los scripts externos del propio sitio (las animaciones); en las demás páginas, ninguno.
  it('no tiene scripts inline ni estilos inline, y los scripts externos son solo los permitidos', () => {
    const scripts = page().querySelectorAll('script');
    for (const script of scripts) {
      expect(script.getAttribute('src'), 'un script sin src es inline').toMatch(/^\/_astro\/.+\.js$/);
      expect(script.text.trim()).toBe('');
    }
    if (route !== ROUTES.home) expect(scripts).toHaveLength(0);
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

  // Mensaje de la landing: los textos exactos de la fuente de verdad (cale-app: PRODUCT_SOURCE_OF_TRUTH.md, sección 9)
  it('la portada tiene el título, el subtítulo, el botón y la tagline de la fuente de verdad', () => {
    const hero = pages.get(ROUTES.home)!.querySelector('.hero')!;
    expect(hero.querySelector('h1')?.text).toBe('Tus recordatorios de turnos, en automático.');
    expect(hero.querySelector('.lead')?.text).toBe(
      'Conectá tu agenda y dejá que Cale envíe los recordatorios por WhatsApp por vos.',
    );
    expect(hero.querySelector('a.button')?.text.trim()).toBe('Empezar gratis');
    expect(hero.querySelector('.tagline')?.text.trim()).toBe('Menos mensajes manuales. Más tiempo para tu negocio.');
  });

  // Decisión del 29/10/2026: la portada no lleva el aviso de "sin tarjeta" ni el de la conexión de WhatsApp
  it('la portada no lleva el aviso de sin tarjeta ni de la conexión con WhatsApp', () => {
    const hero = pages.get(ROUTES.home)!.querySelector('.hero')!;
    expect(hero.querySelector('.notice')).toBeNull();
    expect(hero.text).not.toContain('Sin tarjeta');
    expect(hero.text).not.toContain('se está habilitando');
  });

  // "Desde el mismo número" sale recién cuando exista la conexión (fuente de verdad, sección 8)
  it('la landing no promete el mismo número ni nada que todavía no se cumple', () => {
    const text = bodyText(pages.get(ROUTES.home)!);
    expect(text).not.toMatch(/mismo número|coexistencia|prueba gratis de \d+ días|\d+ días gratis/i);
  });

  describe('celular animado de la portada', () => {
    const preview = () => pages.get(ROUTES.home)!.querySelector('.hero figure')!;
    const sample = buildScenarios({
      businessName: LANDING_SAMPLE.businessName,
      businessWhatsapp: LANDING_SAMPLE.businessWhatsapp,
      today: new Date(LANDING_SAMPLE.today),
    });

    it('lleva el rótulo, el horario de envío y es una animación con ciclo y cuadro fijo válidos', () => {
      expect(preview().getAttribute('aria-label')).toBe('Vista previa animada del recordatorio por WhatsApp');
      expect(preview().text).toContain(`A las ${REMINDER_SEND_TIME}`);
      const timeline = preview().querySelector('[data-timeline]')!;
      const loop = Number(timeline.getAttribute('data-loop'));
      const still = Number(timeline.getAttribute('data-static'));
      expect(loop).toBeGreaterThan(0);
      expect(still).toBeGreaterThanOrEqual(0);
      expect(still).toBeLessThan(loop);
    });

    it('tiene las cuatro escenas una tras otra, sin huecos y dentro del ciclo', () => {
      const timeline = preview().querySelector('[data-timeline]')!;
      const loop = Number(timeline.getAttribute('data-loop'));
      const scenes = preview().querySelectorAll('.scene');
      expect(scenes.map((scene) => scene.getAttribute('data-scene'))).toEqual(['1', '2', '3', '4']);
      const windows = scenes.map((scene) => [Number(scene.getAttribute('data-in')), Number(scene.getAttribute('data-out'))]);
      expect(windows[0][0]).toBe(0);
      windows.slice(1).forEach(([start], index) => expect(start).toBeCloseTo(windows[index][1], 1));
      expect(windows.at(-1)![1]).toBeCloseTo(loop, 1);
    });

    it('todo elemento animado tiene tiempos válidos y los mensajes caen dentro de su escena', () => {
      for (const scene of preview().querySelectorAll('.scene')) {
        const [start, end] = [Number(scene.getAttribute('data-in')), Number(scene.getAttribute('data-out'))];
        for (const item of scene.querySelectorAll('[data-in]')) {
          const at = Number(item.getAttribute('data-in'));
          expect(Number.isFinite(at)).toBe(true);
          expect(at).toBeGreaterThanOrEqual(start);
          expect(at).toBeLessThan(end);
          const out = item.getAttribute('data-out');
          if (item.hasAttribute('data-out')) expect(Number(out)).toBeGreaterThan(at);
        }
      }
    });

    it('el recordatorio de la primera escena es el real y trae sus tres botones', () => {
      const first = preview().querySelector('.scene[data-scene="1"]')!;
      const reminder = sample[0].steps[0];
      expect(first.querySelector('.msg.in:not(.typing) p')?.text).toBe(reminder.kind === 'bot' ? reminder.text : '');
      expect(first.querySelectorAll('.replies li').map((reply) => reply.text)).toEqual(REMINDER_PREVIEW.replies);
    });

    it('cada escena muestra los mensajes de su guion, en orden', () => {
      sample.forEach((scenario, index) => {
        const scene = preview().querySelector(`.scene[data-scene="${index + 1}"]`)!;
        const shown = scene.querySelectorAll('.msg:not(.typing):not(.replies) p').map((message) => message.text);
        const expected = scenario.steps.flatMap((step) => (step.kind === 'press' ? [] : [step.text]));
        expect(shown).toEqual(expected);
      });
    });

    it('cada toque de botón marca un botón que existe en esa escena y llega después del mensaje', () => {
      for (const scene of preview().querySelectorAll('.scene')) {
        for (const press of scene.querySelectorAll('.press')) {
          const button = press.parentNode as HTMLElement;
          expect(button.tagName).toBe('LI');
          const list = button.parentNode as HTMLElement;
          expect(Number(press.getAttribute('data-in'))).toBeGreaterThan(Number(list.getAttribute('data-in')));
        }
      }
    });

    it('lo que se mueve se oculta a los lectores de pantalla y hay una lista de texto con las cuatro escenas', () => {
      expect(preview().querySelector('.phone')?.getAttribute('aria-hidden')).toBe('true');
      for (const tag of preview().querySelectorAll('.tag')) expect(tag.getAttribute('aria-hidden')).toBe('true');
      const transcript = preview().querySelector('ul.visually-hidden')!;
      expect(transcript.getAttribute('aria-label')).toBeTruthy();
      expect(transcript.querySelectorAll('li')).toHaveLength(4);
    });

    it('el encabezado del chat es el del negocio de ejemplo, como si se hablara con él', () => {
      const head = preview().querySelector('.chat-head')!;
      expect(head.querySelector('strong')?.text).toBe(LANDING_SAMPLE.businessName);
      expect(head.querySelector('.chat-avatar')?.text.trim()).toBe(businessInitials(LANDING_SAMPLE.businessName));
      expect(head.text).not.toMatch(/Vista previa|Recordatorio de turno/);
    });

    it('los mensajes salen del mismo negocio que el encabezado', () => {
      const first = preview().querySelector('.scene[data-scene="1"] .msg.in:not(.typing) p')!.text;
      expect(first).toContain(`en ${LANDING_SAMPLE.businessName} `);
    });

    it('tiene el botón de pausa y, sin JavaScript, solo se muestra la primera escena', () => {
      expect(preview().querySelector('button[data-timeline-toggle]')?.getAttribute('type')).toBe('button');
      expect(preview().querySelectorAll('.scene').filter((scene) => scene.getAttribute('data-scene') !== '1').length).toBe(3);
    });
  });

  it('"Cómo funciona" tiene 3 pasos en orden', () => {
    const section = pages.get(ROUTES.home)!.querySelector('#como-funciona')!;
    expect(section.querySelector('h2')?.text).toBe('Cómo funciona');
    expect(section.querySelectorAll('ol > li h3').map((title) => title.text)).toEqual([
      'Entrá con tu cuenta de Google',
      'Anotá cada turno en tu calendario',
      'Cale le escribe a tu cliente el día anterior',
    ]);
    expect(section.text).toContain('el nombre de tu cliente, el servicio y su celular');
    expect(section.text).toContain('en el horario que vos digas');
    expect(section.text).toContain('confirma, reprograma o cancela el turno con un botón');
  });

  it('la landing va de la portada a cómo funciona y cierra con la banda', () => {
    const page = pages.get(ROUTES.home)!;
    expect(page.querySelectorAll('main > section[id]').map((section) => section.id)).toEqual(['como-funciona', 'empezar']);
    expect(page.querySelector('#empezar .closing h2')?.text).toBe('Tu tiempo vale más que mandar recordatorios uno por uno.');
    expect(page.querySelector('#instalacion, video')).toBeNull();
  });

  // Público sin conocimientos técnicos: la portada habla en criollo
  it('la landing no usa términos técnicos', () => {
    expect(bodyText(pages.get(ROUTES.home)!)).not.toMatch(TECHNICAL_JARGON);
  });

  // Decisión de Titular (01/11/2026): el contacto público es solo el correo de Cale; ningún número personal
  it.each(INDEXABLE_ROUTES)('%s ofrece el correo de contacto y ningún enlace a WhatsApp ni a un teléfono', (route) => {
    const hrefs = pages
      .get(route)!
      .querySelectorAll('a')
      .map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.startsWith(`mailto:${CONTACT_EMAIL}`))).toBe(true);
    expect(hrefs.filter((href) => /wa\.me|whatsapp\.com|^tel:/i.test(href))).toEqual([]);
  });

  it('la landing ofrece el correo en el contacto del cierre y en el pie', () => {
    const page = pages.get(ROUTES.home)!;
    const mailLinks = page
      .querySelectorAll('a')
      .filter((link) => link.getAttribute('href')?.startsWith(`mailto:${CONTACT_EMAIL}`));
    expect(mailLinks).toHaveLength(2);
    expect(page.querySelector(`#contacto a[href^="mailto:${CONTACT_EMAIL}"]`)).not.toBeNull();
  });

  // La acción principal es empezar: los dos botones de la landing y el del encabezado llevan al formulario de /empezar
  it('en la landing los botones "Empezar gratis" de la portada y del cierre llevan al formulario', () => {
    const page = pages.get(ROUTES.home)!;
    const starts = page.querySelectorAll('main a.button');
    expect(starts.map((link) => [link.text.trim(), link.getAttribute('href')])).toEqual([
      ['Empezar gratis', START_ROUTE],
      ['Empezar gratis', START_ROUTE],
    ]);
  });

  // No hay cuenta a la que ingresar todavía (la app no existe): arriba solo va el botón que lleva al formulario
  it.each(INDEXABLE_ROUTES)('%s tiene arriba solo "Empezar gratis", que lleva al formulario', (route) => {
    const buttons = pages.get(route)!.querySelectorAll('header.site-header a.button');
    expect(buttons.map((link) => [link.text.trim(), link.getAttribute('href')])).toEqual([['Empezar gratis', START_ROUTE]]);
  });

  it.each(INDEXABLE_ROUTES)('%s no apunta a la app de cuentas (app.cale.com.ar), que no existe', (route) => {
    const hrefs = pages.get(route)!.querySelectorAll('a').map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => href.includes('app.cale.com.ar'))).toEqual([]);
  });

  // Decisión del 11/10/2026: ni la landing ni los legales hablan del precio del servicio
  it.each(INDEXABLE_ROUTES)('%s no muestra precios', (route) => {
    expect(bodyText(pages.get(route)!)).not.toMatch(/\$\s?\d|\bUSD\b|\bARS\b|\bpesos\b|por mes|\/mes\b/i);
  });

  // La CSP solo admite el propio dominio: fuentes, estilos, imágenes y videos se sirven desde el sitio
  it.each([...INDEXABLE_ROUTES, '/404'])('%s no carga recursos de orígenes externos', (route) => {
    const page = loadPage(route === '/404' ? NOT_FOUND_FILE : routeToFile(route));
    const sources = page
      .querySelectorAll('link[href], script[src], img[src], source[src], video[src], iframe[src]')
      .filter((element) => element.tagName !== 'LINK' || element.getAttribute('rel') !== 'canonical')
      .map((element) => element.getAttribute('href') ?? element.getAttribute('src') ?? '');
    expect(sources.filter((source) => /^(https?:)?\/\//.test(source))).toEqual([]);
  });

  it('los estilos generados no importan nada de afuera y las fuentes son las del diseño', () => {
    const astroDir = join(DIST_DIR, '_astro');
    const css = readdirSync(astroDir)
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFileSync(join(astroDir, file), 'utf8'))
      .join('\n');
    expect(css).not.toMatch(/url\(\s*['"]?(https?:)?\/\//);
    expect(css).not.toMatch(/@import\s+url\(/);
    expect(css).toContain('Manrope Variable');
    expect(css).toContain('DM Sans Variable');
    expect(css).not.toMatch(/Atkinson/i);
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
      `${BUSINESS_NAME} es un servicio con domicilio en ${LOCATION}`,
      // Datos de los clientes finales de cada negocio
      'número de teléfono de WhatsApp',
      'Datos del turno',
      'Contenido de los recordatorios',
      'Estados de entrega',
      // Formulario de alta (/empezar): lo que pide, el código de la IP, el consentimiento y el captcha
      'Del negocio: nombre, tipo de negocio, ciudad, cantidad aproximada de turnos por semana y cómo avisa hoy a sus clientes',
      'nombre y número de WhatsApp',
      'un código irreversible (hash) calculado a partir de tu dirección IP',
      'No guardamos la IP',
      'Cloudflare Turnstile',
      'Podés retirar ese consentimiento',
      // Proveedores actuales: Meta (WhatsApp), Vercel (sitio y formulario), Supabase (base) y Cloudflare (captcha)
      'Meta Platforms, Inc.',
      'Vercel Inc.',
      'Supabase Inc.',
      'Cloudflare, Inc.',
      // Coexistencia: copia de los mensajes del negocio y qué se hace con ellos
      `hasta ${COEXISTENCE.historyDays} días de historial`,
      'los demás los descarta sin guardarlos',
      'Este sitio no usa cookies ni herramientas de analítica o publicidad',
      `${RETENTION.leadMonths} meses`,
      `${RETENTION.appointmentDataMonths} meses`,
      `${RETENTION.afterTerminationDays} días`,
      `${RESPONSE_DEADLINES.deletionBusinessDays} días hábiles`,
    ]) {
      expect(text, `falta "${required}"`).toContain(required);
    }
  });

  it('los términos cubren el servicio real, opt-in, pago a Meta, límites de WhatsApp y responsabilidad', () => {
    const text = bodyText(pages.get(ROUTES.terms)!);
    for (const required of [
      `${BUSINESS_NAME} es un servicio con domicilio en ${LOCATION}`,
      'Consentimiento de los clientes (opt-in)',
      'Cada negocio paga esos mensajes directamente a Meta',
      'Limitación de responsabilidad',
      'Ley aplicable y jurisdicción',
      // Estado: se habilita negocio por negocio, el formulario no contrata nada y no hay cobro automático
      'etapa de lanzamiento',
      'no contrata nada ni garantiza el alta',
      'no cobra nada de forma automática',
      // Coexistencia: mismo número y misma app, requisitos, límites de Meta y acceso revocable
      'sigue usando la misma app y el mismo número',
      `versión ${COEXISTENCE.minAppVersion} o posterior`,
      'los chats de grupo no se sincronizan',
      `tope de ${COEXISTENCE.maxMessagesPerSecond} mensajes por segundo`,
      'puede quitarle el acceso',
      'Su número sigue siendo suyo',
      `a las ${REMINDER_SEND_TIME} del día anterior`,
      // Al dar de baja, el negocio puede pedir sus turnos
      'sus turnos en un archivo',
    ]) {
      expect(text, `falta "${required}"`).toContain(required);
    }
  });

  // El servicio todavía no tiene asistente de cuentas, calendario propio ni prueba gratis: los legales no los prometen
  it.each([ROUTES.privacy, ROUTES.terms, ROUTES.dataDeletion])('%s no describe un producto que no existe', (route) => {
    expect(bodyText(pages.get(route)!)).not.toMatch(
      /asistente|calendario de turnos|prueba gratis|entrar con Google|cookies necesarias|Google LLC/i,
    );
  });

  // Decisión de Titular (2026-10-11): el sitio no habla del precio del servicio.
  it.each(INDEXABLE_ROUTES)('%s no menciona el precio del servicio', (route) => {
    expect(bodyText(pages.get(route)!)).not.toMatch(/precio|cu[aá]nto cuesta|propuesta comercial|lo que cobra/i);
  });

  it('la página de eliminación explica cómo pedirlo, en qué plazo y que incluye el formulario de alta', () => {
    const page = pages.get(ROUTES.dataDeletion)!;
    const deletionLink = page
      .querySelectorAll('a')
      .find((link) => link.getAttribute('href')?.startsWith(`mailto:${CONTACT_EMAIL}?subject=`));
    expect(deletionLink).toBeDefined();
    expect(bodyText(page)).toContain(`${RESPONSE_DEADLINES.deletionBusinessDays} días hábiles`);
    expect(bodyText(page)).toContain('Le pasamos tu pedido al negocio');
    expect(bodyText(page)).toContain('Los datos que cargaste en el formulario de alta de tu negocio');
  });

  // AWS se borró el 24/10/2026: nombrarlo sería informar mal a quién se entregan los datos
  it.each(INDEXABLE_ROUTES)('%s no nombra proveedores que ya no se usan', (route) => {
    expect(bodyText(pages.get(route)!)).not.toMatch(/Amazon Web Services|\bAWS\b|CloudFront|Route 53/);
  });
});

describe('robots.txt y sitemap.xml', () => {
  const read = (file: string) => readFileSync(join(DIST_DIR, file), 'utf8');

  it('robots.txt deja rastrear todo el sitio y apunta al sitemap', () => {
    expect(read('robots.txt')).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl('/sitemap.xml')}\n`);
  });

  it('el sitemap tiene exactamente las páginas indexables, con su URL canónica y sin la 404', () => {
    const sitemap = parse(read('sitemap.xml'));
    const locations = sitemap.querySelectorAll('url > loc').map((loc) => loc.text);
    expect(locations).toEqual(INDEXABLE_ROUTES.map((route) => canonicalUrl(route)));
    // Cada URL es la canónica que declara su página
    for (const route of INDEXABLE_ROUTES) {
      expect(loadPage(routeToFile(route)).querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonicalUrl(route));
    }
    expect(read('sitemap.xml')).not.toContain('404');
  });

  it('es un XML de sitemap válido, y los textos legales llevan su fecha de vigencia', () => {
    const xml = read('sitemap.xml');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
    const sitemap = parse(xml);
    const lastmod = (route: string) =>
      sitemap.querySelectorAll('url').find((url) => url.querySelector('loc')?.text === canonicalUrl(route))?.querySelector('lastmod')?.text;
    for (const route of [ROUTES.privacy, ROUTES.terms, ROUTES.dataDeletion]) expect(lastmod(route)).toBe(LEGAL_LAST_UPDATED);
  });
});


// Formulario de alta (/empezar): no es una ruta indexable, así que no entra en los tests por ruta de arriba
describe('formulario de alta (/empezar)', () => {
  const START_FILE = routeToFile(START_ROUTE);
  const FORM_FIELDS = [
    'businessName',
    'businessType',
    'city',
    'weeklyAppointments',
    'currentMethod',
    'ownerName',
    'ownerWhatsapp',
    'businessWhatsapp',
    'consent',
  ];
  const page = () => loadPage(START_FILE);

  it('se genera, no se indexa y no está en el sitemap', () => {
    expect(existsSync(join(DIST_DIR, START_FILE))).toBe(true);
    expect(metaContent(page(), 'meta[name="robots"]')).toBe('noindex');
    expect(page().querySelector('link[rel="canonical"]')).toBeNull();
    expect(readFileSync(join(DIST_DIR, 'sitemap.xml'), 'utf8')).not.toContain(START_ROUTE);
  });

  it('tiene un solo h1 y un título propio con el nombre del negocio', () => {
    expect(page().querySelectorAll('h1')).toHaveLength(1);
    expect(page().querySelector('title')?.text).toContain(BUSINESS_NAME);
    const titles = [...pages.values()].map((other) => other.querySelector('title')?.text);
    expect(titles).not.toContain(page().querySelector('title')?.text);
  });

  // La CSP de /empezar (vercel.json) admite scripts solo del propio dominio: uno inline se rompe en producción
  it('carga un solo script, externo y del propio sitio, sin scripts ni estilos inline', () => {
    const scripts = page().querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('src')).toMatch(/^\/_astro\/.+\.js$/);
    expect(scripts[0].text.trim()).toBe('');
    expect(page().querySelectorAll('style')).toHaveLength(0);
    expect(page().querySelectorAll('[style]')).toHaveLength(0);
  });

  it('tiene los tres pasos en orden, cada uno con su título enfocable', () => {
    const sections = page().querySelectorAll('form section[data-step]');
    expect(sections.map((section) => section.getAttribute('data-step'))).toEqual(FORM_STEPS.map(String));
    for (const section of sections) {
      expect(section.querySelector('h2')?.getAttribute('tabindex')).toBe('-1');
      expect(section.getAttribute('aria-labelledby')).toBe(section.querySelector('h2')?.id);
    }
  });

  it('pide exactamente los campos del formulario y la trampa para robots', () => {
    const names = new Set(page().querySelectorAll('form [name]').map((field) => field.getAttribute('name')));
    expect([...names].sort()).toEqual([...FORM_FIELDS, 'website'].sort());
  });

  it('cada campo tiene etiqueta y su mensaje de error enlazado con aria-describedby', () => {
    const doc = page();
    const controls = doc.querySelectorAll('form input[name], form select').filter((field) => field.getAttribute('type') !== 'radio' && field.getAttribute('name') !== 'website');
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const id = control.id;
      const labelled = id !== '' && doc.querySelector(`label[for="${id}"]`) !== null;
      // Las casillas llevan su etiqueta alrededor
      const wrapped = control.parentNode instanceof HTMLElement && control.parentNode.tagName === 'LABEL';
      expect(labelled || wrapped, `el campo ${control.getAttribute('name')} no tiene etiqueta`).toBe(true);
      for (const target of (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)) {
        expect(doc.querySelector(`#${target}`), `aria-describedby apunta a #${target}, que no existe`).not.toBeNull();
      }
    }
    for (const field of FORM_FIELDS) {
      expect(doc.querySelector(`[data-error-for="${field}"]`), `falta el mensaje de error de ${field}`).not.toBeNull();
    }
  });

  it('los grupos de opciones son fieldset con legend y ofrecen las opciones de lib/lead.ts', () => {
    const doc = page();
    for (const [name, options] of [
      ['weeklyAppointments', WEEKLY_APPOINTMENTS],
      ['currentMethod', CURRENT_METHODS],
    ] as const) {
      const group = doc.querySelector(`fieldset[data-field="${name}"]`)!;
      expect(group.querySelector('legend')).not.toBeNull();
      expect(group.querySelectorAll('input[type="radio"]').map((radio) => radio.getAttribute('value'))).toEqual(
        options.map((option) => option.value),
      );
    }
    expect(doc.querySelectorAll('select[name="businessType"] option').map((option) => option.getAttribute('value'))).toEqual([
      '',
      ...BUSINESS_TYPES,
    ]);
  });

  it('la trampa para robots no se ve, no se lee en voz alta y no recibe foco', () => {
    const trap = page().querySelector('input[name="website"]')!;
    expect(trap.getAttribute('tabindex')).toBe('-1');
    expect(trap.getAttribute('autocomplete')).toBe('off');
    expect(trap.parentNode instanceof HTMLElement && trap.parentNode.getAttribute('aria-hidden')).toBe('true');
  });

  it('el captcha tiene su lugar en el último paso y no se carga desde el HTML (lo agrega el script al llegar ahí)', () => {
    const doc = page();
    expect(doc.querySelector('section[data-step="3"] [data-captcha]')).not.toBeNull();
    expect(doc.innerHTML).not.toContain('challenges.cloudflare.com');
  });

  it('el consentimiento enlaza a la política de privacidad', () => {
    expect(page().querySelector(`[data-field="consent"] a[href="${ROUTES.privacy}"]`)).not.toBeNull();
  });

  it('el formulario y el resultado arrancan ocultos; sin JavaScript se avisa cómo seguir por correo', () => {
    const doc = page();
    expect(doc.querySelector('[data-wizard]')?.hasAttribute('hidden')).toBe(true);
    expect(doc.querySelector('[data-result]')?.hasAttribute('hidden')).toBe(true);
    const fallback = doc.querySelector('noscript')?.innerHTML ?? '';
    expect(fallback).toContain(`mailto:${CONTACT_EMAIL}`);
  });

  // La animación (scripts/chat-player.ts) busca estos elementos por data-attributes: si falta uno, no arranca
  it('la simulación tiene el escenario, el rótulo, un punto por escena, la pausa y el texto para lectores de pantalla', () => {
    const doc = page();
    const sim = doc.querySelector('[data-result] [data-sim]')!;
    expect(sim).not.toBeNull();
    expect(sim.querySelector('[data-sim-stage]')).not.toBeNull();
    expect(sim.querySelectorAll('[data-sim-dot]').map((dot) => dot.getAttribute('data-sim-dot'))).toEqual([...SCENARIO_IDS]);
    expect(sim.querySelector('[data-sim-toggle]')?.text).toBe('Pausar');
    expect(sim.querySelector('[data-sim-next]')?.text).toBe('Ver otro ejemplo');
    expect(sim.querySelector('[data-sim-transcript]')?.getAttribute('aria-label')).toBeTruthy();
  });

  // Es decorativa y se repite sola: lo que se mueve no se lee en voz alta, solo la lista de texto
  it('la animación se oculta a los lectores de pantalla y los controles son botones de verdad', () => {
    const sim = page().querySelector('[data-sim]')!;
    expect(sim.querySelector('.sim-phone')?.getAttribute('aria-hidden')).toBe('true');
    expect(sim.querySelector('[data-sim-caption]')?.getAttribute('aria-hidden')).toBe('true');
    expect(sim.querySelector('.sim-progress')?.getAttribute('aria-hidden')).toBe('true');
    for (const control of sim.querySelectorAll('.sim-controls button')) expect(control.getAttribute('type')).toBe('button');
  });

  it('los estilos de la animación respetan "reducir movimiento" y usan solo transform y opacity', () => {
    const css = readdirSync(join(DIST_DIR, '_astro'))
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFileSync(join(DIST_DIR, '_astro', file), 'utf8'))
      .join('\n');
    // Toda clase que se anima tiene que apagar su animación con "reducir movimiento"
    const animated = [...css.matchAll(/(\.sim-[\w-]+)(?:[^{}]*){[^}]*animation:[^;}]*\bsim-/g)].map((match) => match[1]);
    expect(animated.sort()).toEqual(['.sim-buttons', '.sim-dot', '.sim-msg', '.sim-pressed']);
    // Los selectores del bloque, uno por uno (no por texto: ".sim-dot" también "está" dentro de ".sim-dotx")
    const reducedSelectors = (css.match(/prefers-reduced-motion:\s*reduce\)\s*{([^{}]*){[^}]*animation:\s*none/)?.[1] ?? '').split(',').map((selector) => selector.trim());
    for (const selector of animated) expect(reducedSelectors, `${selector} sigue animándose con "reducir movimiento"`).toContain(selector);
    const keyframes = [...css.matchAll(/@keyframes sim-[\w-]+\s*{((?:[^{}]|{[^{}]*})*)}/g)].map((match) => match[1]);
    expect(keyframes).toHaveLength(3);
    for (const body of keyframes) {
      const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map((match) => match[1]);
      expect(properties.filter((property) => !['opacity', 'transform'].includes(property))).toEqual([]);
    }
  });

  it('no carga recursos de afuera del sitio', () => {
    const sources = page()
      .querySelectorAll('link[href], script[src], img[src]')
      .filter((element) => element.getAttribute('rel') !== 'canonical')
      .map((element) => element.getAttribute('href') ?? element.getAttribute('src') ?? '');
    expect(sources.filter((source) => /^(https?:)?\/\//.test(source))).toEqual([]);
  });

  it('no muestra precios', () => {
    expect(bodyText(page())).not.toMatch(/\$\s?\d|\bUSD\b|\bARS\b|\bpesos\b|por mes|\/mes\b/i);
  });
});
