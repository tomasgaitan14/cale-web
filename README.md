# Cale — sitio público

Sitio estático de [Cale](https://cale.com.ar), servicio de recordatorios de turnos por WhatsApp.

| Ruta | Contenido |
|------|-----------|
| `/` | Qué es Cale, cómo funciona, para quién es y contacto |
| `/privacidad` | Política de privacidad (Ley 25.326) |
| `/terminos` | Términos de servicio |
| `/eliminar-datos` | Cómo pedir la eliminación de datos |

## Requisitos

Node 24 (`nvm use`).

## Uso

```bash
npm install
npm run dev       # http://localhost:4321
npm test          # buildea y corre los tests sobre dist/
npm run build     # genera dist/
npm run preview   # sirve dist/ en local
```

## Cambiar datos del negocio o el dominio

Todo está en `src/config.ts`: nombre, titular, ubicación, email, `SITE_URL`, plazos de conservación y fecha de
vigencia de los textos legales. Para cambiar el dominio, cambiá `SITE_URL` y el parámetro `DomainName` de `infra/site.yaml`.

## Deploy

AWS (S3 + CloudFront), con GitHub Actions en cada push a `main`. Dos CloudFront Functions resuelven las URLs sin
`.html` ni barra final y agregan los headers de seguridad (incluida una CSP sin scripts). Ver `docs/infra-aws.md`.
