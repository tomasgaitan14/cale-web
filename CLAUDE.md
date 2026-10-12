# cale-web

## Descripción

Sitio público de **Cale**, servicio de recordatorios de turnos por WhatsApp (WhatsApp Cloud API de Meta)
para peluquerías y negocios con turnos. El cliente final confirma, cancela o reprograma con un botón.

El sitio es la cara pública de Cale y da las URLs legales (privacidad, términos, eliminación de datos) que piden
Meta y las apps de WhatsApp.

**Modelo de operación: Tech Provider con coexistencia** (decisión del 2026-10-11). Cale tiene que permitir que el
negocio siga usando la app WhatsApp Business en su número, y eso solo se logra con Embedded Signup siendo Tech
Provider; no se usa un proveedor (BSP) intermediario. El camino completo y su estado están en
[`docs/roadmap.md`](docs/roadmap.md). El modelo anterior (cada negocio con su propia app y un token) quedó descartado.

## Contexto

Personal. Producto propio. **Sin relación** con Sinfalta / `whatsapp-bot` (decisión del 2026-10-10).

**Datos privados:** la identidad legal del titular, los IDs de las cuentas (Meta, AWS, DonWeb) y la bitácora
completa están **fuera del repo**, en `~/projects-claude/personal/cale-privado/`. Este repo es público: no
agregar acá nombre legal, dirección, CUIT, teléfonos ni IDs de cuentas.

## Stack usado en este proyecto

| Capa | Elección |
|------|----------|
| Build | Astro 7, salida 100 % estática, **sin JS en el cliente** |
| Estilos | CSS plano con tokens en `src/styles/global.css` (sin Tailwind) |
| Tipografía | Newsreader (títulos, self-hosted con `@fontsource-variable`) + fuentes del sistema |
| Íconos | `@phosphor-icons/core` (Bold), inline vía `src/components/Icon.astro` |
| Tests | Vitest sobre el HTML de `dist/` + `node-html-parser`; la plantilla de AWS y el workflow, con `yaml` |
| Node | 24 (`.nvmrc` y `engines`; Astro 7 pide ≥ 22.12 y el `node` por defecto de nvm es 22.11) |
| Hosting | **AWS**: S3 + CloudFront con el plan flat-rate Free, WAF, Route 53, alarmas por email. Ver [`docs/infra-aws.md`](docs/infra-aws.md) |
| Deploy | GitHub Actions en cada push a `main` (OIDC, sin claves) |
| Hosting anterior | Vercel (`cale-turnos.vercel.app`), que sigue activo hasta que el dominio propio funcione en AWS |

## Proyectos relacionados

Ninguno por ahora. El backend de Cale (envío de mensajes, webhooks, plantillas) todavía no existe.

## Estado actual

Al 2026-10-12:

- Sitio en AWS en `d3bl9yoji79fah.cloudfront.net`, con deploy automático. También sigue en `cale-turnos.vercel.app`.
- Dominio `cale.com.ar` comprado en DonWeb, esperando que NIC Argentina lo active (24 a 48 horas).
- Verificación del negocio en Meta iniciada y pausada hasta tener el dominio propio.
- 123 tests en verde.

## Decisiones tomadas

- **Astro y no Vite + React:** el crawler y el revisor de Meta tienen que recibir el contenido en el HTML, no
  armado por JS.
- **`src/config.ts` es la fuente única** de nombre, titular, ubicación, email, rutas, plazos de conservación,
  fecha de vigencia legal y la etiqueta de verificación de dominio de Meta. Cambiar el dominio = cambiar `SITE_URL`.
- **URLs sin barra final ni `.html`:** `build.format: 'file'`; en AWS lo resuelve una CloudFront Function y en
  Vercel, `cleanUrls` y `trailingSlash: false` en `vercel.json`.
- **CSP estricta** (`script-src 'none'`, sin `unsafe-inline`): por eso `inlineStylesheets: 'never'`, y nada de
  `style=""` ni `<script>`. Hay un test que lo controla.
- **Animaciones solo CSS** (`animation-timeline: view()` con `@supports`): el contenido se ve igual sin soporte.
- **Gris secundario `#6B6A66`** en lugar del `#787774` de la skill minimalist-ui: el original no pasa AA (4.3:1).
- **Sin cookies, analítica ni formularios.** Si se agrega GTM/GA4, hay que actualizar la política de privacidad
  y la CSP.
- **Rol legal:** Cale trata datos por cuenta del negocio (art. 25, Ley 25.326); el negocio es responsable y
  tiene que tener el opt-in de sus clientes.
- **Identidad pública sin datos personales:** el sitio muestra **CRM Solutions**, **Argentina** y
  `cale.turnos@gmail.com`. "CRM Solutions" no es un negocio registrado. Riesgo aceptado: Meta podría rechazar
  la verificación por no ver el nombre legal (plan B en `docs/roadmap.md`).
- **Sin precio en el sitio** (2026-10-11): ni la landing ni los términos hablan del precio del servicio. Hay
  un test que lo controla.
- **Plazos de conservación** (`RETENTION` en `config.ts`): 12 meses desde el turno; 30 días después de la baja
  de un negocio. Confirmados el 2026-10-10.
- **Repo público:** en Hobby, Vercel no deploya repos privados cuando el autor del commit no es el dueño de la
  cuenta de Vercel (cuentas cruzadas). Ya no importa para AWS, pero el repo sigue público.
- **AWS en vez de Vercel** (2026-10-12): pedido del titular, con el plan más barato (USD 0) y alarmas. Detalle en
  `docs/infra-aws.md`.

## Próximos pasos

1. **Etapa 2 de AWS** cuando NIC active `cale.com.ar`: delegaciones en DonWeb → certificado y alias en CloudFront →
   `SITE_URL` → verificar el dominio en Meta → retomar la verificación del negocio.
2. **Actualizar los textos del sitio al modelo Tech Provider:** el paso 1 de la landing y las secciones 2 y 3 de
   los términos todavía describen el modelo descartado ("el negocio crea y mantiene su propia app…").
3. **Dar de baja Vercel** y borrar `vercel.json`, `tests/vercel-config.test.ts` y la comparación de headers en
   `tests/infra.test.ts`.
4. Cuando la base pase de Supabase a AWS: actualizar la sección 7 de `/privacidad` y `LEGAL_LAST_UPDATED`.
5. Que un abogado revise los textos legales: el tope de responsabilidad se calcula sobre "lo pagado por el
   servicio", la jurisdicción no nombra una ciudad y la Ley 25.326 (art. 6) pide identificar al responsable de los
   datos.

## Archivos clave

- `src/config.ts` — datos del negocio, rutas, plazos, etiqueta de verificación de Meta.
- `src/layouts/BaseLayout.astro` — `<head>` (meta tags, canonical, OG, verificación de Meta), header y footer.
- `src/layouts/LegalLayout.astro` — layout de las páginas legales con fecha de actualización.
- `src/pages/` — `index`, `privacidad`, `terminos`, `eliminar-datos`, `404`.
- `infra/site.yaml` — plantilla de CloudFormation del stack `cale-site`.
- `.github/workflows/deploy.yml` — deploy a AWS en cada push a `main`.
- `vercel.json` — URLs limpias y headers en Vercel (se borra al darlo de baja).
- `tests/site.test.ts` — controla el HTML generado (identidad, links, meta tags, CSP, contenido legal requerido).
- `tests/infra.test.ts` — controla la plantilla y el workflow (seguridad, plan Free, alarmas, URLs, headers).
- `docs/infra-aws.md` — arquitectura, costos, deploy, operación y problemas de AWS.
- `docs/roadmap.md` — camino a Tech Provider y coexistencia, con su estado.

## Notas / contexto extra

- **Espacios en Astro:** un salto de línea entre texto y `{expresión}` o una etiqueta inline se pierde
  ("dentro de los5", "sin queCale", "Contacto:email"). El test "no pega palabras" lo detecta; dejá el espacio en
  la misma línea.
- `astro preview` en Astro 7 corre como daemon: se baja con `npx astro preview stop`.
- **AWS CLI:** solo con el perfil `cale` (`aws login --profile cale`). El perfil `default` de la Mac es de otra
  cuenta: no usarlo. En zsh, `export AWS_PROFILE=cale AWS_REGION=us-east-1`.
- **Cómo se creó el proyecto de Vercel:** la importación desde el dashboard no llegó a crearlo, y la API
  (`POST /v11/projects` con `gitRepository`) lo rechaza con "install the GitHub integration". Funcionó
  `vercel project add` + `vercel link` + `vercel git connect`. `vercel link` agrega `.vercel` al `.gitignore`
  aunque ya esté: descartar ese cambio.
- Al cambiar cualquier texto legal, actualizar `LEGAL_LAST_UPDATED`.
