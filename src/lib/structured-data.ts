// Datos estructurados (schema.org, JSON-LD) de la portada: quién es Cale y qué es el sitio. Solo lo que el sitio ya
// publica: nombre, dirección, logo y el correo de contacto. Sin teléfono, domicilio ni datos del titular.
import { APPLE_TOUCH_ICON } from './brand';
import { BUSINESS_NAME, CONTACT_EMAIL, SITE_URL } from '../config';
import { canonicalUrl } from './url';

const SCHEMA_CONTEXT = 'https://schema.org';
const SITE_LANGUAGE = 'es-AR';
const CONTACT_LANGUAGE = 'es';
const CONTACT_TYPE = 'customer support';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: BUSINESS_NAME,
    url: canonicalUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: canonicalUrl(APPLE_TOUCH_ICON.path),
      width: APPLE_TOUCH_ICON.size,
      height: APPLE_TOUCH_ICON.size,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: CONTACT_TYPE,
      email: CONTACT_EMAIL,
      availableLanguage: CONTACT_LANGUAGE,
    },
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: BUSINESS_NAME,
    url: canonicalUrl('/'),
    inLanguage: SITE_LANGUAGE,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function homeStructuredData() {
  return { '@context': SCHEMA_CONTEXT, '@graph': [organizationSchema(), websiteSchema()] };
}

// Dentro de un <script> el JSON no puede contener "<": un texto con "</script>" cortaría el bloque
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
