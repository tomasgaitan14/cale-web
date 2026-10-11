# cale-web

## Descripción

Sitio público de **Cale**, servicio de recordatorios de turnos por WhatsApp (WhatsApp Cloud API de Meta)
para peluquerías y negocios con turnos. El cliente final confirma, cancela o reprograma con un botón.

El sitio es la cara pública de Cale y da las URLs legales (privacidad, términos, eliminación de datos) que
piden las apps de Meta, por ejemplo para pasar a modo Live.

**Modelo de operación: sin Tech Provider** (decisión del 2026-10-11). Tom no tiene un negocio registrado y no
hay documento contra el cual Meta pueda verificarlo, así que Cale no conecta números con Embedded Signup. Cada
negocio crea en su propio portfolio de Meta su app, su cuenta de WhatsApp Business y su número, y le da acceso
a Cale con un token de usuario de sistema (`whatsapp_business_messaging` y `whatsapp_business_management`).
El webhook se configura en la app del negocio y apunta al endpoint de Cale. Sin verificar, cada negocio tiene
el límite de mensajes de cuentas no verificadas; si necesita más, se verifica con sus propios papeles.

Si más adelante Cale pasa a ser Tech Provider, hacen falta: un documento a nombre de quien presta el servicio
(por ejemplo, la constancia de monotributo), que el nombre legal del sitio y del portfolio coincida con ese
documento letra por letra, un dominio propio con email en ese dominio, y el App Review.

## Contexto

Personal. Producto propio. **Sin relación** con Sinfalta / `whatsapp-bot` (decisión de Tom, 2026-10-10).

## Stack usado en este proyecto

| Capa | Elección |
|------|----------|
| Build | Astro 7, salida 100 % estática, **sin JS en el cliente** |
| Estilos | CSS plano con tokens en `src/styles/global.css` (sin Tailwind) |
| Tipografía | Newsreader (títulos, self-hosted con `@fontsource-variable`) + fuentes del sistema |
| Íconos | `@phosphor-icons/core` (Bold), inline vía `src/components/Icon.astro` |
| Tests | Vitest sobre el HTML de `dist/` + `node-html-parser` |
| Node | 24 (`.nvmrc` y `engines`; Astro 7 pide ≥ 22.12 y el `node` por defecto de nvm es 22.11) |
| Deploy | Vercel, proyecto `cale-turnos` (equipo `tomasg-projects`) → `cale-turnos.vercel.app`, deploy automático desde `main` |

## Proyectos relacionados

Ninguno por ahora.

## Estado actual

En producción en https://cale-turnos.vercel.app desde el 2026-10-11. 75 tests en verde. Repo público en
`github.com/tomasgaitan14/cale-web`.

## Decisiones tomadas

- **Astro y no Vite + React:** el crawler y el revisor de Meta tienen que recibir el contenido en el HTML, no
  armado por JS.
- **`src/config.ts` es la fuente única** de nombre, titular, ubicación, email, rutas, plazos de conservación y
  fecha de vigencia legal. Cambiar el dominio = cambiar `SITE_URL`.
- **URLs sin barra final ni `.html`:** `build.format: 'file'` + `cleanUrls` y `trailingSlash: false` en `vercel.json`.
- **CSP estricta** (`script-src 'none'`, sin `unsafe-inline`): por eso `inlineStylesheets: 'never'`, y nada de
  `style=""` ni `<script>`. Hay un test que lo controla.
- **Animaciones solo CSS** (`animation-timeline: view()` con `@supports`): el contenido se ve igual sin soporte.
- **Gris secundario `#6B6A66`** en lugar del `#787774` de la skill minimalist-ui: el original no pasa AA (4.3:1).
- **Sin cookies, analítica ni formularios.** Si se agrega GTM/GA4, hay que actualizar la política de privacidad
  y la CSP.
- **Rol legal:** Cale trata datos por cuenta del negocio (art. 25, Ley 25.326); el negocio es responsable y
  tiene que tener el opt-in de sus clientes.
- **Identidad pública:** el sitio muestra **CRM Solutions**, **Argentina** y `crmsolutionsgchu@gmail.com`, no
  datos personales. "CRM Solutions" no es un negocio registrado: sirve mientras no se pida la verificación de
  Meta, pero no pasaría esa verificación (ver Descripción).
- **Sin precio en el sitio** (2026-10-11): ni la landing ni los términos hablan del precio del servicio. Hay
  un test que lo controla.
- **Plazos de conservación** (`RETENTION` en `config.ts`): 12 meses desde el turno; 30 días después de la baja
  de un negocio. Confirmados el 2026-10-10.
- **Repo público:** en Hobby, Vercel no deploya repos privados cuando el autor del commit (`tomasgaitan14`) no es
  el dueño de la cuenta de Vercel (`tomasagustingaitan`).

## Próximos pasos

1. Comprar el `.com.ar` y cambiar `SITE_URL` (no bloquea nada mientras no haya verificación de Meta).
2. Cuando la base pase de Supabase a AWS: actualizar la sección 7 de `/privacidad` y `LEGAL_LAST_UPDATED`.
3. Que un abogado revise los textos legales. En particular: el tope de responsabilidad de los términos se calcula
   sobre "lo pagado por el servicio" y la jurisdicción no nombra una ciudad.

## Archivos clave

- `src/config.ts` — datos del negocio, rutas, plazos.
- `src/layouts/BaseLayout.astro` — `<head>` (meta tags, canonical, OG), header y footer con identidad y links legales.
- `src/layouts/LegalLayout.astro` — layout de las páginas legales con fecha de actualización.
- `src/pages/` — `index`, `privacidad`, `terminos`, `eliminar-datos`, `404`.
- `vercel.json` — URLs limpias y headers de seguridad.
- `tests/site.test.ts` — controla el HTML generado (identidad, links, meta tags, CSP, contenido legal requerido).

## Notas / contexto extra

- **Espacios en Astro:** un salto de línea entre texto y `{expresión}` o una etiqueta inline se pierde
  ("dentro de los5", "sin queCale", "Contacto:email"). El test "no pega palabras" lo detecta; dejá el espacio en
  la misma línea.
- `astro preview` en Astro 7 corre como daemon: se baja con `npx astro preview stop`.
- **Cómo se creó el proyecto de Vercel:** la importación desde el dashboard no llegó a crearlo, y la API
  (`POST /v11/projects` con `gitRepository`) lo rechaza con "install the GitHub integration". Funcionó
  `vercel project add` + `vercel link` + `vercel git connect`. `vercel link` agrega `.vercel` al `.gitignore`
  aunque ya esté: descartar ese cambio.
- Al cambiar cualquier texto legal, actualizar `LEGAL_LAST_UPDATED`.
