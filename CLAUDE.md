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

**Regla del 2026-11-01: siempre coexistencia.** Los recordatorios salen del número que el negocio ya usa (si no tiene
cuenta de WhatsApp Business Platform, se crea en el alta) y el negocio sigue viendo sus mensajes. No se ofrece una
línea aparte solo para recordatorios.

## Contexto

Personal. Producto propio. **Sin relación** con Sinfalta / `whatsapp-bot` (decisión del 2026-10-10).

**Datos privados:** la identidad legal del titular, los IDs de las cuentas (Meta, AWS, DonWeb) y la bitácora
completa están **fuera del repo**, en `~/projects-claude/personal/cale-privado/`. Este repo es público: no
agregar acá nombre, teléfono, dirección, CUIT, situación fiscal ni IDs de cuentas. El único contacto público es
`cale.turnos@gmail.com` (`CONTACT_EMAIL`).

## Stack usado en este proyecto

| Capa | Elección |
|------|----------|
| Build | Astro 7, salida 100 % estática. **Sin JS en el cliente, salvo la portada (animación) y `/empezar`** (scripts propios, sin framework) |
| Estilos | CSS plano: tokens del diseño en `src/styles/tokens.css` (copia de `cale-app/docs/DISENO.md`), base en `global.css` (sin Tailwind) |
| Tipografía | Manrope (títulos) + DM Sans (texto), autoalojadas con `@fontsource-variable` |
| Íconos | `@phosphor-icons/core` (Bold), inline vía `src/components/Icon.astro` (calendario, reloj, tilde, doble tilde y WhatsApp) |
| Tests | Vitest sobre el HTML de `dist/` + `node-html-parser`; la plantilla de AWS y el workflow, con `yaml` |
| Node | 24 (`.nvmrc` y `engines`; Astro 7 pide ≥ 22.12 y el `node` por defecto de nvm es 22.11) |
| Hosting | **Vercel** (Hobby, proyecto `cale-turnos`, equipo `tomasg-projects`): el sitio estático y la Function `api/lead.ts`. Dominios: `cale.com.ar` (y `www`, que redirige) y `cale-turnos.vercel.app`. Dejar Vercel es una opción a retomar más adelante (implicaría volver a S3 + CloudFront y rehacer `api/lead.ts` como Lambda) |
| Deploy | Vercel despliega solo en cada push a `main` (el workflow de GitHub Actions para AWS está desactivado) |
| Hosting anterior | AWS (S3 + CloudFront, [`docs/infra-aws.md`](docs/infra-aws.md)), borrado el 2026-10-24; antes de eso, Vercel hasta el 2026-10-14 |

## Proyectos relacionados

- **`cale-api`** (repo privado, `~/projects-claude/personal/cale-api/`): backend mínimo del App Review de Meta (Supabase Edge
  Functions: crear una plantilla y enviar un mensaje) y panel local para grabar los videos. No se comunica con este sitio:
  son dos piezas del camino a Tech Provider. Detalle y estado en su `CLAUDE.md`.
- **`cale-app`** (repo privado, `~/projects-claude/personal/cale-app/`): el asistente de alta y el backend de Cale
  (entrar con Google, calendario, perfil, recordatorios, reservas por WhatsApp y webhook). **Está offline desde el
  2026-10-24** (su AWS se borró) y el sitio ya no enlaza a `app.cale.com.ar`: "Empezar gratis" va a `/empezar` y el
  encabezado no tiene botón de ingreso (un test lo controla). Si la app vuelve, se vuelve a agregar un acceso.
  `tokens.css` es la misma copia que `cale-app/web/src/styles/tokens.css`: si cambia un valor, cambiarlo en
  `DISENO.md` y en los dos repos. La hora de los recordatorios (`REMINDER_SEND_TIME`) copia la de cale-app y lo dice
  en `src/config.ts`: si cambia allá, cambiarla acá y en `LEGAL_LAST_UPDATED`.

## Estado actual

**Al 2026-11-01 (publicado en `https://cale.com.ar`; `cale-turnos.vercel.app` sigue activo):**

- **Textos legales reescritos** (`privacidad`, `terminos`, `eliminar-datos`) para lo que existe hoy: formulario de alta
  (datos, hash de la IP, Turnstile), copia de mensajes de la coexistencia (se descartan los que no son recordatorios),
  proveedores Meta, Vercel, Supabase y Cloudflare, términos en "etapa de lanzamiento" y el mismo número y la misma app.
  Sin AWS, Google, asistente ni prueba gratis. `LEGAL_LAST_UPDATED` y `LEAD_CONSENT_VERSION` = 2026-11-01. Los datos de
  coexistencia (versión de la app, 180 días de historial, 20 mensajes por segundo) están en `COEXISTENCE` de `config.ts`.
- Se sacó el botón "Ingresar a mi cuenta" (apuntaba a `app.cale.com.ar`, sin DNS).
- **`/empezar` probado en producción (01/11/2026, 23:28):** un alta de prueba (`PRUEBA BORRAR 0111`) se guardó en `leads` con el consentimiento
  `2026-11-01`, el cierre mostró el texto nuevo y después se borró a mano en el SQL Editor (la base quedó en 0 altas y 0 intentos). Titular completó el
  captcha de Turnstile. El modo automático no deja que Claude consulte la base de producción: la comprobación y el borrado los corre Titular.
- **Dominio (01/11/2026, ~22:20): `cale.com.ar` está online.** Responde con HTTPS (Let's Encrypt), `www` y `http`
  redirigen con 308, el DNS de DonWeb apunta a Vercel y las páginas legales y `/empezar` dan 200. El widget de Turnstile
  ya admite `cale.com.ar`. Un recorrido del sitio en vivo no encontró nombre, teléfono ni otros correos.
- **Animación de la portada y de `/empezar` alineada con «siempre coexistencia»** (01/11/2026): la escena de «escribe otra cosa» ya no
  manda a la clienta a otro `wa.me`; lo que escribe fuera de los botones lo contesta el negocio desde su WhatsApp («Vos» en el texto de
  corrido, `byBusiness` en `lib/chat-script.ts`). Se sacó el número del negocio de ejemplo (`LANDING_SAMPLE.businessWhatsapp`): ningún
  texto del sitio lleva un `wa.me`.
  El cierre de `/empezar` (`closingMessage` en `lib/lead.ts`) y la ayuda del paso 3 ya no hablan de «tu línea de recordatorios»: dicen «apenas Cale
  esté listo para tu negocio», sin prometer una línea aparte ni una fecha. Un test lo controla.
- **Decisiones del texto legal (asumidas, a confirmar):** la agenda del negocio no se nombra (tampoco la portada, desde el
  01/11/2026), sin costos ni precio, los datos del formulario se guardan 12 meses si no se activa el servicio.
- **Meta:** la verificación del negocio se **envió el 01/11/2026** y está a la espera (hasta 48 h; los datos concretos
  están fuera del repo). El dominio `cale.com.ar` figura verificado. El backend del App Review está hecho en `cale-api`
  y los dos videos están grabados; el App Review se envía cuando el negocio quede verificado. Falta cargar las URLs
  legales de `cale.com.ar` en la app de Meta.

**Al 2026-10-24: toda la infraestructura de AWS está borrada y el sitio está offline** (decisión de Titular, para no
tener ningún costo por ahora). Se eliminaron los stacks `cale-site`, `cale-app` y el de SAM, los buckets, la zona de
Route 53, DynamoDB (sin copia), SSM y SES. `cale.com.ar` sigue siendo de Titular en DonWeb (vence 12/10/2027) pero sin
DNS. Los workflows `Deploy` (este repo) y `CI` (cale-app) están **desactivados** en GitHub (`gh workflow enable`
para reactivarlos). Para reconstruir: `infra/site.yaml`, [`docs/infra-aws.md`](docs/infra-aws.md), nameservers
nuevos en DonWeb, dominio de Meta a verificar de nuevo y `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET` y
`CLOUDFRONT_DISTRIBUTION_ID` a cargar de nuevo. Lo que sigue, abajo, es el estado **antes** del borrado.

**Formulario de alta `/empezar` (29/10/2026, publicado en `https://cale-turnos.vercel.app`):** el botón "Empezar gratis" ya no lleva a `cale-app` sino a
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
servidor propio que sirva `dist/` y ejecute `api/lead.ts`. Nunca pasar `import.meta.env` entero al código del navegador:
Vite incrusta todo el entorno del build, incluidas las `PUBLIC_VERCEL_*` de Vercel (`tests/public-env.test.ts`). Pendiente:
probar el formulario en producción, conectar `cale.com.ar` (y sumarlo al widget de Turnstile), y ajustar
privacidad (ahora se guardan datos personales y el captcha manda datos de la visita a Cloudflare) y términos.

**Portada animada (30/10/2026, publicada):** el celular de la portada (`PhonePreview.astro`) es un chat de WhatsApp animado
con el negocio de ejemplo «Estética Cuidarte» (`LANDING_SAMPLE` en `config.ts`, con el día fijo jueves 29/10/2026: la
portada es estática). Recorre las mismas cuatro escenas que la simulación de `/empezar` (`lib/chat-script.ts`, con los
textos reales de cale-app). Todo está en el HTML y `scripts/timeline.ts` solo enciende y apaga `is-in` según un reloj
(`lib/timeline.ts`); corre solo a la vista, tiene pausa y, con «reducir movimiento», muestra un cuadro fijo. La CSP de `/`
admite scripts del propio sitio (`vercel.json`). **Vite incrusta en el HTML los scripts de menos de 4 KB y la CSP los
bloquea:** `assetsInlineLimit: 0` en `astro.config.ts` (`tests/build-config.test.ts`). Se compararon tres versiones
(celular, agenda que se actualiza, los 3 pasos en acción); se publicó la del celular y las otras dos se borraron.
Ojo con los git worktrees: un enlace `node_modules` se puede colar en un commit (el `.gitignore` ignora el nombre a secas).

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
- **De dónde salen los turnos: sin definir (01/11/2026).** La portada ya no promete Google Calendar ni una cuenta de Google (el código que
  lo conectaba estaba en `cale-app`, borrada de AWS). Los pasos dicen «Dejanos los datos de tu negocio» y «Pasale tus turnos a Cale»; un test
  prohíbe «Google» y «Calendar» en la portada y en su descripción.
- **Textos de la landing** (`LANDING_COPY`, `HOW_IT_WORKS`, `REMINDER_PREVIEW` en `config.ts`): los de la fuente de
  verdad de cale-app. La vista previa usa el texto real de la plantilla `cale_recordatorio_turno`. Sin promesas que
  todavía no se cumplen: el "mismo número" y la prueba gratis activa vuelven recién con la Fase 5 (Meta). Ojo:
  `terminos.astro` todavía dice "el mismo número" (texto legal, no se tocó).
- **Contacto solo por correo** (decisión del 2026-11-01): al cierre de la landing, en el pie y en `/empezar`, solo
  `cale.turnos@gmail.com`. Se sacó el WhatsApp de contacto porque era un número personal; hay un test que prohíbe
  enlaces `wa.me` y `tel:`. (El `wa.me/…` de la animación es de un negocio de ejemplo inventado.)
- **Sin cookies ni analítica.** El único formulario es `/empezar` (guarda datos de contacto en Supabase): la política
  de privacidad tiene que reflejarlo. Si se agrega GTM/GA4, actualizar también la política y la CSP.
- **Rol legal:** Cale trata datos por cuenta del negocio (art. 25, Ley 25.326); el negocio es responsable y
  tiene que tener el opt-in de sus clientes.
- **Identidad pública, sin datos personales** (decisión de Titular del 2026-11-01): la marca es **Cale** en todo el sitio
  (pie y metaetiquetas: "Cale · Argentina") y el contacto, `cale.turnos@gmail.com`. **Ningún lado publica el nombre
  legal, el domicilio, el CUIT ni otro correo**; el nombre legal va solo en el formulario privado de Meta y nunca en
  este repo. Se sacó "CRM Solutions", que no es un negocio registrado. Test en `tests/site.test.ts` (sin CUIT, sin
  otros correos, sin "CRM Solutions"). Riesgo aceptado: Meta podría rechazar la verificación por no ver el nombre
  legal en el sitio (plan B en `docs/roadmap.md`).
- **Sin precio en el sitio** (2026-10-11): ni la landing ni los términos hablan del precio del servicio. Hay
  un test que lo controla.
- **Plazos de conservación** (`RETENTION` en `config.ts`): 12 meses desde el turno; 30 días después de la baja
  de un negocio. Confirmados el 2026-10-10.
- **Repo público:** en Hobby, Vercel no deploya repos privados cuando el autor del commit no es el dueño de la
  cuenta de Vercel (cuentas cruzadas). Con el sitio otra vez en Vercel, el repo tiene que seguir público.
- **AWS en vez de Vercel** (2026-10-12) **quedó superado**: AWS se borró el 2026-10-24 y el 2026-11-01 el sitio se
  quedó en Vercel (USD 0, deploy solo y la Function `api/lead.ts` ya funcionando). Dejar Vercel queda como opción
  futura; el detalle de la infraestructura de AWS está en `docs/infra-aws.md`.

## Próximos pasos

1. **Meta:** esperar la decisión de la verificación del negocio (enviada el 01/11/2026, hasta 48 h). Con el negocio
   verificado, enviar el App Review (videos grabados, backend en `cale-api`) y cargar las URLs legales de `cale.com.ar` en la app.
2. Confirmar las decisiones asumidas del texto legal (agenda, costos, plazo del formulario).
   **Decisión de producto abierta:** de dónde salen los turnos (Google Calendar, una agenda propia de Cale o carga manual). Hasta definirlo la
   portada es neutra («Pasale tus turnos a Cale»); cuando se defina, se reescriben los pasos 1 y 2 de «Cómo funciona» (`HOW_IT_WORKS`).
3. Que un abogado revise los textos legales: el tope de responsabilidad se calcula sobre "lo pagado por el servicio"
   (hoy sería cero, porque no hay cobro), la jurisdicción no nombra una ciudad y la Ley 25.326 (art. 6) pide
   identificar al responsable de los datos.

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
