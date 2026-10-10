# cale-web

## Descripción

Sitio público de **Cale**, servicio de recordatorios de turnos por WhatsApp (WhatsApp Cloud API de Meta)
para peluquerías y negocios con turnos. El cliente final confirma, cancela o reprograma con un botón.

El sitio existe para la **verificación del negocio en Meta** y el **App Review como Tech Provider**:
nombre del negocio y titular visibles, email de contacto, y política de privacidad, términos y
eliminación de datos en URLs propias.

## Contexto

Personal. Producto propio. **Sin relación** con Sinfalta / `whatsapp-bot` (decisión de Titular, 2026-10-10).

## Stack usado en este proyecto

| Capa | Elección |
|------|----------|
| Build | Astro 7, salida 100 % estática, **sin JS en el cliente** |
| Estilos | CSS plano con tokens en `src/styles/global.css` (sin Tailwind) |
| Tipografía | Newsreader (títulos, self-hosted con `@fontsource-variable`) + fuentes del sistema |
| Íconos | `@phosphor-icons/core` (Bold), inline vía `src/components/Icon.astro` |
| Tests | Vitest sobre el HTML de `dist/` + `node-html-parser` |
| Node | 24 (`.nvmrc` y `engines`; Astro 7 pide ≥ 22.12 y el `node` por defecto de nvm es 22.11) |
| Deploy | Vercel, proyecto `cale-turnos` → `cale-turnos.vercel.app` (pendiente) |

## Proyectos relacionados

Ninguno por ahora.

## Estado actual

Sitio completo, 75 tests en verde. Repo público en `github.com/tomasgaitan14/cale-web`. **Falta importarlo en Vercel.**

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
- **Identidad pública:** el sitio muestra **CRM Solutions**, **Argentina** y `cale.turnos@gmail.com`, no
  datos personales. Para la verificación de Meta, "CRM Solutions" tiene que coincidir con la documentación legal.
- **Plazos de conservación** (`RETENTION` en `config.ts`): 12 meses desde el turno; 30 días después de la baja
  de un negocio. Confirmados el 2026-10-10.
- **Repo público:** en Hobby, Vercel no deploya repos privados cuando el autor del commit (`tomasgaitan14`) no es
  el dueño de la cuenta de Vercel (`cuenta-vercel`).

## Próximos pasos

1. Importar el repo en Vercel (`tomasg-projects`) con el nombre `cale-turnos` y verificar las 4 rutas.
2. Comprar el `.com.ar`, cambiar `SITE_URL` y crear un email en ese dominio antes de pedir la verificación de Meta.
3. Cuando la base pase de Supabase a AWS: actualizar la sección 7 de `/privacidad` y `LEGAL_LAST_UPDATED`.
4. Que un abogado revise los textos legales.

## Archivos clave

- `src/config.ts` — datos del negocio, rutas, plazos.
- `src/layouts/BaseLayout.astro` — `<head>` (meta tags, canonical, OG), header y footer con identidad y links legales.
- `src/layouts/LegalLayout.astro` — layout de las páginas legales con fecha de actualización.
- `src/pages/` — `index`, `privacidad`, `terminos`, `eliminar-datos`, `404`.
- `vercel.json` — URLs limpias y headers de seguridad.
- `tests/site.test.ts` — controla el HTML generado (identidad, links, meta tags, CSP, contenido legal requerido).

## Notas / contexto extra

- **Espacios en Astro:** un salto de línea entre texto y `{expresión}` o una etiqueta inline se pierde
  ("dentro de los5"). El test "no pega palabras" lo detecta; dejá el espacio en la misma línea.
- `astro preview` en Astro 7 corre como daemon: se baja con `npx astro preview stop`.
- Al cambiar cualquier texto legal, actualizar `LEGAL_LAST_UPDATED`.
