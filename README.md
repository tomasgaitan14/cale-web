# Cale — sitio público

Sitio estático de [Cale](https://cale-turnos.vercel.app), servicio de recordatorios de turnos por WhatsApp.

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
vigencia de los textos legales. Para usar un dominio propio, cambiá `SITE_URL` y agregá el dominio en Vercel.

## Deploy

Vercel, desde la rama `main` del repo. `vercel.json` define URLs sin `.html` ni barra final y los headers de
seguridad (incluida una CSP sin scripts).
