// Tests sobre el HTML que genera `astro build` (dist/): es exactamente lo que ven Meta y los visitantes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HTMLElement, NodeType, parse, type Node } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  APP_SESSION,
  APP_URL,
  BUSINESS_NAME,
  CONTACT_EMAIL,
  FACEBOOK_DOMAIN_VERIFICATION,
  LEGAL_LAST_UPDATED,
  LOCATION,
  OWNER_NAME,
  REMINDER_PREVIEW,
  REMINDER_SEND_TIME,
  RESPONSE_DEADLINES,
  RETENTION,
  ROUTES,
  SLOT_OFFER,
  TRIAL_DAYS,
  TRIAL_EXTENSION_DAYS,
  TRIAL_NOTICE_DAYS_BEFORE,
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
    expect(bodyText(page())).not.toMatch(PENDING_MARKER_PATTERN);
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

  // Hasta que Meta apruebe a Cale (Fase 5), ningún negocio puede conectar su WhatsApp: la portada lo avisa
  it('la portada avisa que la conexión con WhatsApp todavía no está disponible', () => {
    const notice = pages.get(ROUTES.home)!.querySelector('.hero .notice')?.text ?? '';
    expect(notice).toContain('La conexión con WhatsApp se está habilitando');
    expect(notice).toContain('anotarte');
  });

  // "Desde el mismo número" sale recién cuando exista la conexión (fuente de verdad, sección 8)
  it('la landing no promete el mismo número ni nada que todavía no se cumple', () => {
    const text = bodyText(pages.get(ROUTES.home)!);
    expect(text).not.toMatch(/mismo número|coexistencia|prueba gratis de \d+ días|\d+ días gratis/i);
  });

  it('la vista previa muestra el recordatorio real con sus tres botones', () => {
    const preview = pages.get(ROUTES.home)!.querySelector('.hero figure')!;
    expect(preview.getAttribute('aria-label')).toBe('Vista previa del recordatorio por WhatsApp');
    expect(preview.querySelector('.bubble p')?.text).toBe(REMINDER_PREVIEW.message);
    expect(preview.querySelectorAll('.replies li').map((reply) => reply.text)).toEqual([
      'Confirmo',
      'Cancelo',
      'Cambiar horario',
    ]);
    expect(preview.text).toContain(`A las ${REMINDER_SEND_TIME}`);
  });

  it('"Cómo funciona" tiene 3 pasos en orden', () => {
    const section = pages.get(ROUTES.home)!.querySelector('#como-funciona')!;
    expect(section.querySelector('h2')?.text).toBe('Cómo funciona');
    expect(section.querySelectorAll('ol > li h3').map((title) => title.text)).toEqual([
      'Entrá con tu cuenta de Google',
      'Anotá cada turno con el nombre y el celular',
      'Cale le escribe a tu cliente el día anterior',
    ]);
    expect(section.text).toContain(`A las ${REMINDER_SEND_TIME}, por WhatsApp`);
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

  it.each(INDEXABLE_ROUTES)('%s tiene el botón de WhatsApp con el número del negocio', (route) => {
    const whatsappLinks = pages
      .get(route)!
      .querySelectorAll('a')
      .filter((link) => link.getAttribute('href')?.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`));
    expect(whatsappLinks.length).toBeGreaterThan(0);
  });

  it('la landing ofrece WhatsApp en el contacto del cierre y en el pie', () => {
    const page = pages.get(ROUTES.home)!;
    const whatsappLinks = page
      .querySelectorAll('a')
      .filter((link) => link.getAttribute('href')?.startsWith(`https://wa.me/${WHATSAPP_NUMBER}`));
    expect(whatsappLinks).toHaveLength(2);
    expect(page.querySelector(`#contacto a[href^="https://wa.me/${WHATSAPP_NUMBER}"]`)).not.toBeNull();
  });

  // La acción principal es empezar: los dos botones de la landing y los del encabezado llevan al asistente
  it('en la landing los botones "Empezar gratis" de la portada y del cierre llevan al asistente', () => {
    const page = pages.get(ROUTES.home)!;
    const starts = page.querySelectorAll('main a.button');
    expect(starts.map((link) => [link.text.trim(), link.getAttribute('href')])).toEqual([
      ['Empezar gratis', APP_URL],
      ['Empezar gratis', APP_URL],
    ]);
  });

  it.each(INDEXABLE_ROUTES)('%s tiene arriba "Ingresar a mi cuenta" (secundario) y "Empezar gratis" (principal)', (route) => {
    const buttons = pages.get(route)!.querySelectorAll('header.site-header a.button');
    expect(buttons.map((link) => [link.text.trim(), link.getAttribute('href'), link.classList.contains('button-secondary')])).toEqual([
      ['Ingresar a mi cuenta', APP_URL, true],
      ['Empezar gratis', APP_URL, false],
    ]);
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

  // Decisión de Tom (2026-10-11): el sitio no habla del precio del servicio.
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
