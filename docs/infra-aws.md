# Infraestructura en AWS

Cómo está alojado el sitio en AWS, cómo se deploya y cómo se opera. La plantilla es
[`infra/site.yaml`](../infra/site.yaml) (stack `cale-site`, región `us-east-1`) y sus tests están en
[`tests/infra.test.ts`](../tests/infra.test.ts).

Los IDs concretos (cuenta, bucket, distribución, zona) no están en el repo: salen de los outputs del stack.

```bash
aws cloudformation describe-stacks --stack-name cale-site --query 'Stacks[0].Outputs' --profile cale --region us-east-1
```

## Arquitectura

```
visitante ─HTTPS─► CloudFront ─OAC─► S3 (privado)
                     │  ├─ WAF (4 reglas)
                     │  ├─ función viewer-request: URLs limpias y redirecciones
                     │  └─ función viewer-response: headers de seguridad
                     └─ Route 53 (zona del dominio)

GitHub Actions ─OIDC─► rol de deploy ─► s3 sync + invalidación
CloudWatch (2 alarmas) ─► SNS ─► email
```

| Recurso | Para qué |
|---------|----------|
| `SiteBucket` | Los archivos de `dist/`. Privado, cifrado, con versiones (las viejas se borran a los 30 días). |
| `SiteBucketPolicy` | Solo esta distribución de CloudFront puede leer; rechaza conexiones sin TLS. |
| `OriginAccessControl` | CloudFront firma los pedidos a S3 (OAC). |
| `UrlRewriteFunction` | `/privacidad` sirve `privacidad.html`; `/x.html`, `/x/` e `/index.html` redirigen con 301, conservando la query. |
| `SecurityHeadersFunction` | Agrega CSP, HSTS, nosniff, `X-Frame-Options: DENY`, referrer y permisos. |
| `WebAcl` | Límite de 500 pedidos cada 5 min por IP + 3 reglas administradas de AWS (reputación de IP, comunes, entradas maliciosas). |
| `Distribution` | HTTPS obligatorio, HTTP/2 y 3, IPv6, caché administrada `CachingOptimized`, 403/404 de S3 → `/404.html`. |
| `HostedZone` | Zona de Route 53 del dominio. |
| `PricingPlan` | Plan flat-rate **Free** de CloudFront: cubre la distribución, el WAF y la zona. |
| `AlertsTopic` + 2 alarmas | Errores 5xx > 5 % durante 10 min y más de 5.000 pedidos en una hora. Avisan al entrar y al salir de alarma. |
| `GitHubOidcProvider` + `DeployRole` | GitHub Actions entra sin claves; el rol solo sube al bucket e invalida esta distribución. |

`SiteBucket` y `HostedZone` tienen `DeletionPolicy: RetainExceptOnCreate`: si se borra el stack se conservan, pero si
falla la creación se borran (así un intento fallido no deja restos).

## Costos

Costo esperado: **USD 0 por mes**.

- **Plan Free de CloudFront:** incluye CDN, TLS, funciones, WAF (hasta 5 reglas), la zona de Route 53 (cuota mensual,
  registros y consultas) y 5 GB de S3. Uso incluido por mes: 1 M de pedidos y 100 GB de transferencia. No cobra
  excedentes: si se superan de forma sostenida, CloudFront puede bajar el rendimiento.
- **Fuera del plan:** los pedidos a S3 de cada deploy (centavos), las métricas y alarmas de CloudWatch (dentro de las
  10 gratuitas) y SNS por email (dentro del uso gratuito).
- **Presupuesto de gasto cero** (AWS Budgets, creado a mano en la consola): avisa por email ante el primer centavo.

### Lo que el plan Free no admite

Con cualquiera de estos, AWS rechaza la distribución con "resources are not eligible for this subscription tier":

- response headers policies propias (por eso los headers van en una función);
- cache policies y origin request policies propias (se usa la administrada `CachingOptimized`);
- KeyValueStore, Lambda@Edge, Origin Shield, logs en tiempo real, rule groups propios de WAF.

Los tests de `tests/infra.test.ts` fallan si la plantilla usa alguno. Además, la cuenta tiene que estar en el plan
**Paid** de AWS: las cuentas en el plan Free de AWS no pueden suscribirse.

## Deploy

Automático en cada push a `main` ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)):

1. `npm ci` y `npm test` (buildea y corre todos los tests). Si algo falla, no se sube nada.
2. Entra a AWS con OIDC asumiendo el rol de deploy.
3. Sube `dist/_astro/` con `Cache-Control: public, max-age=31536000, immutable` (los nombres llevan hash).
4. Sube el resto con `Cache-Control: public, max-age=0, s-maxage=86400, must-revalidate` y borra lo que ya no existe.
5. Invalida `/*` en CloudFront.

El workflow lee tres **variables del repo** (GitHub → Settings → Secrets and variables → Actions → Variables):
`AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET` y `CLOUDFRONT_DISTRIBUTION_ID`. Salen de los outputs del stack. No son
secretos, pero así el ID de la cuenta no queda en el repo público.

**OIDC:** el repo usa el `sub` **inmutable** de GitHub (`repo:<owner>@<ownerId>/<repo>@<repoId>:ref:refs/heads/main`).
Con el formato clásico (`repo:<owner>/<repo>:...`) el rol rechaza el token con "Not authorized to perform
sts:AssumeRoleWithWebIdentity". El prefijo es el parámetro `GitHubSubjectPrefix` del stack y sale de:

```bash
gh api repos/tomasgaitan14/cale-web/actions/oidc/customization/sub
```

**Push de cambios en `.github/workflows/`:** el token de git del llavero no tiene el permiso `workflow`. Usar el de
`gh` solo en ese push:

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main
```

## Operación

Todos los comandos usan el perfil `cale` (se configura con `aws login --profile cale`, sin claves de acceso). En zsh,
pasar el perfil por variable de entorno: una variable con `--profile cale` adentro no se separa en dos argumentos.

```bash
export AWS_PROFILE=cale AWS_REGION=us-east-1
```

### Cambiar la infraestructura

1. Editar `infra/site.yaml` y correr `npm test`.
2. Validar: `aws cloudformation validate-template --template-body file://infra/site.yaml`.
3. Crear un change set y revisar qué cambia antes de ejecutarlo:

```bash
aws cloudformation create-change-set --stack-name cale-site --change-set-name <nombre> --template-body file://infra/site.yaml --parameters ParameterKey=AlertEmail,UsePreviousValue=true ParameterKey=RequestSpikeThreshold,UsePreviousValue=true ParameterKey=DomainName,UsePreviousValue=true --capabilities CAPABILITY_NAMED_IAM
```

```bash
aws cloudformation describe-change-set --stack-name cale-site --change-set-name <nombre> --query 'Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]' --output text
```

```bash
aws cloudformation execute-change-set --stack-name cale-site --change-set-name <nombre>
```

### Deploy manual (si GitHub Actions no está disponible)

```bash
npm run build && aws s3 sync dist/ "s3://<bucket>/" --delete && aws cloudfront create-invalidation --distribution-id <distribución> --paths '/*'
```

### Volver atrás un deploy

- **Lo más simple:** `git revert` del commit y push; el workflow vuelve a deployar la versión anterior.
- **Sin pasar por git:** el bucket tiene versiones (30 días). Se puede restaurar un archivo copiando su versión anterior
  y después invalidar la caché.

### Alarmas

- Llegan a un email suscripto al tópico `cale-site-alerts`. Si el tópico se vuelve a crear, hay que confirmar de nuevo
  la suscripción desde el email "AWS Notification - Subscription Confirmation".
- Es normal recibir un email "OK" al crear las alarmas: pasan de "sin datos" a OK.
- No hacer clic en "unsubscribe" en esos emails.

## Problemas que ya aparecieron

| Problema | Causa | Solución |
|----------|-------|----------|
| El stack falló con "not eligible for this subscription tier" | Response headers policy propia, que el plan Free no admite | Headers en una CloudFront Function viewer-response |
| Después del rollback quedaron la zona y el bucket | `DeletionPolicy: Retain` también se aplica al fallar la creación | `RetainExceptOnCreate`; los restos se borraron a mano |
| GitHub Actions no podía asumir el rol | El repo usa el `sub` OIDC inmutable | Parámetro `GitHubSubjectPrefix` con el formato inmutable |
| `aws ... $P` con `P="--profile cale"` falló | zsh no separa variables en palabras | `export AWS_PROFILE=cale` |
| IAM Identity Center iba a crear una organización | Al crear la organización caducan los créditos del nivel gratuito y la instancia multirregión usa una clave KMS paga | No usar Organizations; usuario de IAM con MFA y `aws login` |

## Limitaciones conocidas

- La página 404 sale sin los headers de seguridad: CloudFront no ejecuta la función viewer-response en las respuestas
  de error. No afecta a las páginas reales.
- Mientras el sitio siga también en Vercel, los headers están duplicados en `vercel.json` y en
  `SecurityHeadersFunction`. Un test controla que coincidan. Al dar de baja Vercel, borrar `vercel.json`,
  `tests/vercel-config.test.ts` y la comparación en `tests/infra.test.ts`.

## Etapa 2: dominio propio (13/10/2026)

1. ✅ Delegaciones en DonWeb (Mis Dominios → Nameservers y Zona DNS) a los 4 nameservers de la zona. NIC tardó unas
   horas en publicarlas.
2. ✅ En la plantilla: certificado de ACM para el dominio y `www` (validación por DNS en la zona del stack, sin pasos
   manuales), alias de los dos en la distribución (`sni-only`, TLS 1.2 o más) y registros A/AAAA alias en Route 53.
   La función de URLs redirige `www` y la dirección de CloudFront a `https://cale.com.ar` con la misma ruta (el
   dominio canónico sale del parámetro `DomainName` con `!Sub`). El change set tardó unos 7 minutos.
3. ✅ `SITE_URL` = `https://cale.com.ar`.
4. Pendiente: verificar el dominio nuevo en Meta y actualizar el sitio cargado ahí.
5. Pendiente: dar de baja Vercel (ver "Limitaciones conocidas").

Si después del cambio la Mac no encuentra `cale.com.ar` (pero `www` sí), es la caché de DNS local que guardó la
respuesta de antes del registro: se va sola o con `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.
