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
agregar acá nombre legal, dirección, CUIT ni IDs de cuentas. El único teléfono es el WhatsApp de contacto
(`WHATSAPP_NUMBER`), que es público a propósito.

## Stack usado en este proyecto

| Capa | Elección |
|------|----------|
| Build | Astro 7, salida 100 % estática. **Sin JS en el cliente, salvo `/empezar`** (un script propio, sin framework) |
| Estilos | CSS plano: tokens del diseño en `src/styles/tokens.css` (copia de `cale-app/docs/DISENO.md`), base en `global.css` (sin Tailwind) |
| Tipografía | Manrope (títulos) + DM Sans (texto), autoalojadas con `@fontsource-variable` |
| Íconos | `@phosphor-icons/core` (Bold), inline vía `src/components/Icon.astro` (calendario, reloj, tilde, doble tilde y WhatsApp) |
| Tests | Vitest sobre el HTML de `dist/` + `node-html-parser`; la plantilla de AWS y el workflow, con `yaml` |
| Node | 24 (`.nvmrc` y `engines`; Astro 7 pide ≥ 22.12 y el `node` por defecto de nvm es 22.11) |
| Hosting | **AWS**: S3 + CloudFront con el plan flat-rate Free, WAF, Route 53, alarmas por email. Ver [`docs/infra-aws.md`](docs/infra-aws.md) |
| Deploy | GitHub Actions en cada push a `main` (OIDC, sin claves) |
| Hosting anterior | Vercel (`cale-turnos.vercel.app`), dado de baja el 2026-10-14 |

## Proyectos relacionados

- **`cale-app`** (repo privado, `~/projects-claude/personal/cale-app/`): el asistente de alta y el backend de Cale en
  `https://app.cale.com.ar` (entrar con Google, calendario, perfil, recordatorios, reservas por WhatsApp y webhook).
  Los botones "Empezar gratis" e "Ingresar a mi cuenta" llevan ahí (`APP_URL`; en el celular el encabezado muestra solo el segundo). `tokens.css` es la misma copia que
  `cale-app/web/src/styles/tokens.css`: si cambia un valor, cambiarlo en `DISENO.md` y en los dos repos. Varios plazos y textos del sitio copian los de
  cale-app y lo dicen en `src/config.ts` (prueba gratis, sesión, hora de los recordatorios, horarios que se ofrecen):
  si cambian allá, cambiarlos acá y en `LEGAL_LAST_UPDATED`.

## Estado actual

**Al 2026-10-24: toda la infraestructura de AWS está borrada y el sitio está offline** (decisión de Titular, para no
tener ningún costo por ahora). Se eliminaron los stacks `cale-site`, `cale-app` y el de SAM, los buckets, la zona de
Route 53, DynamoDB (sin copia), SSM y SES. `cale.com.ar` sigue siendo de Titular en DonWeb (vence 12/10/2027) pero sin
DNS. Los workflows `Deploy` (este repo) y `CI` (cale-app) están **desactivados** en GitHub (`gh workflow enable`
para reactivarlos). Para reconstruir: `infra/site.yaml`, [`docs/infra-aws.md`](docs/infra-aws.md), nameservers
nuevos en DonWeb, dominio de Meta a verificar de nuevo y `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET` y
`CLOUDFRONT_DISTRIBUTION_ID` a cargar de nuevo. Lo que sigue, abajo, es el estado **antes** del borrado.

**Formulario de alta `/empezar` (29/10/2026, sin deployar):** el botón "Empezar gratis" ya no lleva a `cale-app` sino a
`/empezar` (3 pasos: negocio, turnos, datos) y termina en una simulación del recordatorio con el nombre del negocio, más
un cierre "te escribimos cuando tu línea esté lista". **Sin pago por ahora** (decisión de Titular: se suma cuando la línea de
WhatsApp funcione). Guarda el alta en una tabla `leads` de **Supabase** (proyecto `cale-leads`, cuenta
`cale.turnos@gmail.com`). **El navegador no habla con Supabase:** manda el formulario y un token de **Cloudflare
Turnstile** a `/api/lead` (`api/lead.ts`, Vercel Function), que verifica el token y llama a `submit_lead` con la clave
`service_role`. `submit_lead` solo la puede ejecutar `service_role` (`supabase/migrations/0002_lead_rate_limit.sql`) y
corta a 5 intentos por hora por IP y 100 en total (se guarda un hash HMAC de la IP, nunca la IP). La tabla `leads` no
tiene políticas (RLS). Archivos: `src/lib/lead.ts` (validación), `lead-api.ts` (cliente de `/api/lead`), `simulation.ts`,
`src/scripts/onboarding.ts` y `captcha.ts` (recorrido y widget). Variables: `PUBLIC_TURNSTILE_SITE_KEY` (pública, build)
y `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY` (secretas, solo servidor); ver `.env.example`.
Hosting nuevo en **Vercel** (proyecto `cale-turnos`, equipo `tomasg-projects`; `vercel.json` con las cabeceras: la CSP de
`/empezar` admite su script y `https://challenges.cloudflare.com`). Ojo con la `service_role` en formato JWT: Supabase
exige que viaje también como `Authorization: Bearer`, no solo en `apikey` (si no, la llamada entra como `anon` y da 401);
las `sb_secret_…` van solo en `apikey`. `vercel dev` no sirve en este proyecto (404 en todo): para probar en local, un
servidor propio que sirva `dist/` y ejecute `api/lead.ts`. Pendiente: deploy, cargar las variables en Vercel, y ajustar
privacidad (ahora se guardan datos personales y el captcha manda datos de la visita a Cloudflare) y términos.

**Dirección del producto (24/10/2026):** primero se usa con una amiga de Titular (estética) con **n8n** y la Cloud API,
sin Tech Provider; Cale como producto multicliente se retoma después. Se descartó Twilio: el camino ISV exige igual
ser Tech Provider, cobra USD 0,005 por mensaje y no confirma coexistencia. Estilo elegido para un rediseño futuro:
skill `design-taste-frontend` (la maqueta B se perdió con el scratchpad).

Al 2026-10-15:

- Sitio en **`https://cale.com.ar`** (AWS, deploy automático); `www` y `d3bl9yoji79fah.cloudfront.net` redirigen ahí.
  Vercel dado de baja.
- **Publicado `a0d6b13`**: portada nueva ("Cale confirma tus turnos y te los reprograma por WhatsApp"), sección de
  instalación con el video y "Probalo GRATIS" hacia `app.cale.com.ar`, y textos legales al 15/10/2026 (entrar con
  Google, perfil, recordatorios a las 7:00, Cale marca, borra, mueve y anota turnos, reservas con "turno").
  162 tests en verde.
- **Publicado `6a8384a` (Fase 1 del rediseño):** landing nueva con el diseño "Recepción" y los
  textos de `PRODUCT_SOURCE_OF_TRUTH.md` (sección 9): portada con el celular y la vista previa real del recordatorio,
  "Cómo funciona" en 3 pasos y banda de cierre. Sin video ni "mismo número"; avisa que WhatsApp todavía no está
  disponible. Las páginas legales toman los tokens sin cambiar sus textos. 189 tests en verde.
- Decisión del titular: publicar todo aunque el asistente todavía se frena en el paso 3 (WhatsApp, depende de que
  Meta apruebe a Cale como Tech Provider). Por ahora solo entra él.
- Dominio `cale.com.ar` verificado en Meta. Verificación del negocio se retoma el 20/10/2026.

## Decisiones tomadas

- **Astro y no Vite + React:** el crawler y el revisor de Meta tienen que recibir el contenido en el HTML, no
  armado por JS.
- **`src/config.ts` es la fuente única** de nombre, titular, ubicación, email, rutas, plazos de conservación,
  fecha de vigencia legal y la etiqueta de verificación de dominio de Meta. Cambiar el dominio = cambiar `SITE_URL`.
- **URLs sin barra final ni `.html`:** `build.format: 'file'`; en AWS lo resuelve una CloudFront Function
  (`UrlRewriteFunction`).
- **CSP estricta** (`script-src 'none'`, sin `unsafe-inline`): por eso `inlineStylesheets: 'never'`, y nada de
  `style=""` ni `<script>`. Hay un test que lo controla.
- **Diseño "Recepción"** (aprobado el 2026-10-15, implementado en la Fase 1): crema, negro, blanco y verde WhatsApp;
  Manrope + DM Sans. Fuente: `~/projects-claude/personal/cale-app/docs/DISENO.md` y el prototipo que cita. El verde
  nunca es color de texto, y AAA en el texto principal y AA en el resto (los dos los controla `tests/contrast.test.ts`).
  Reemplazó al rediseño para público mayor del 2026-10-12 (Atkinson, resaltador amarillo, comparación y video).
- **Textos de la landing** (`LANDING_COPY`, `HOW_IT_WORKS`, `REMINDER_PREVIEW` en `config.ts`): los de la fuente de
  verdad de cale-app. La vista previa usa el texto real de la plantilla `cale_recordatorio_turno`. Sin promesas que
  todavía no se cumplen: el "mismo número" y la prueba gratis activa vuelven recién con la Fase 5 (Meta). Ojo:
  `terminos.astro` todavía dice "el mismo número" (texto legal, no se tocó).
- **Contacto por WhatsApp** (`WHATSAPP_NUMBER` en `config.ts`): al cierre de la landing y en el pie, con un mensaje ya
  escrito. El email queda como segunda opción.
- **Sin cookies ni analítica.** El único formulario es `/empezar` (guarda datos de contacto en Supabase): la política
  de privacidad tiene que reflejarlo. Si se agrega GTM/GA4, actualizar también la política y la CSP.
- **Rol legal:** Cale trata datos por cuenta del negocio (art. 25, Ley 25.326); el negocio es responsable y
  tiene que tener el opt-in de sus clientes.
- **Identidad pública sin datos personales:** el sitio muestra **CRM Solutions**, **Argentina** y
  `cale.turnos@gmail.com` (desde el 13/10/2026; antes `cale.turnos@gmail.com`). "CRM Solutions" no es un negocio registrado. Riesgo aceptado: Meta podría rechazar
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

1. **Meta:** retomar la verificación del negocio el 20/10/2026 (el dominio `cale.com.ar` ya está verificado).
2. `terminos.astro` todavía dice "el mismo número": revisarlo con los legales (y `LEGAL_LAST_UPDATED`).
3. Que un abogado revise los textos legales: el tope de responsabilidad se calcula sobre "lo pagado por el
   servicio", la jurisdicción no nombra una ciudad y la Ley 25.326 (art. 6) pide identificar al responsable de los
   datos.

## Archivos clave

- `src/config.ts` — datos del negocio, rutas, plazos, etiqueta de verificación de Meta.
- `src/layouts/BaseLayout.astro` — `<head>` (meta tags, canonical, OG, verificación de Meta), header y footer.
- `src/layouts/LegalLayout.astro` — layout de las páginas legales con fecha de actualización.
- `src/pages/` — `index`, `privacidad`, `terminos`, `eliminar-datos`, `404`.
- `src/pages/empezar.astro`, `src/scripts/onboarding.ts`, `src/lib/lead*.ts`, `src/lib/simulation.ts` — formulario de alta y simulación.
- `supabase/migrations/` — `0001_leads.sql` (tabla `leads`) y `0002_lead_rate_limit.sql` (límite de envíos y `submit_lead` solo para el servidor); las corre Titular en el SQL Editor, en orden.
- `api/lead.ts` — Vercel Function: verifica Turnstile y guarda el alta (`tests/api-lead.test.ts`).
- `vercel.json` — cabeceras de seguridad del hosting en Vercel (`tests/headers.test.ts`).
- `infra/site.yaml` — plantilla de CloudFormation del stack `cale-site` (AWS, borrado el 24/10).
- `.github/workflows/deploy.yml` — deploy a AWS en cada push a `main`.
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
- Al cambiar cualquier texto legal, actualizar `LEGAL_LAST_UPDATED`.
