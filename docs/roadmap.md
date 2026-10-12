# Plan hasta la coexistencia de WhatsApp

Estado del camino para que Cale sea Tech Provider de Meta y pueda conectar negocios con **coexistencia** (el negocio
sigue usando la app WhatsApp Business en su mismo número). Actualizado al 12/10/2026.

## Por qué Tech Provider

- La coexistencia solo se activa con **Embedded Signup**, y Meta lo limita a Solution Partners y Tech Providers.
- No se quiere usar un proveedor (BSP) intermediario, así que Cale tiene que ser Tech Provider.
- Para ser Tech Provider, Meta pide, en orden: **verificación del negocio**, **App Review** (dos videos: enviar un
  mensaje y crear una plantilla) y **acceso avanzado** a `whatsapp_business_messaging` y
  `whatsapp_business_management`.

Se descartó el modelo "sin Tech Provider" (cada negocio con su propia app y un token de usuario de sistema): sin
coexistencia, el número conectado deja de funcionar en la app WhatsApp Business.

## Pasos

| # | Paso | Estado |
|---|------|--------|
| 1 | Documento legal del titular (constancia de régimen fiscal) | Hecho |
| 2 | Información del negocio en el portfolio de Meta (nombre legal tal cual el documento, dirección, teléfono, sitio) | Hecho |
| 3 | Verificar el dominio del sitio en Meta (metaetiqueta en el `<head>`) | Hecho con `cale-turnos.vercel.app`; repetir con `cale.com.ar` |
| 4 | Comprar el dominio propio | Comprado; esperando que NIC Argentina lo active |
| 5 | Hosting en AWS (S3 + CloudFront, plan Free) con deploy automático y alarmas | Hecho (ver [infra-aws.md](infra-aws.md)) |
| 6 | Etapa 2 de AWS: dominio en Route 53, certificado y alias | Pendiente (depende del 4) |
| 7 | Verificación del negocio en Meta | Iniciada y pausada: Meta no acepta dominios compartidos como `vercel.app` |
| 8 | Actualizar los textos del sitio al modelo Tech Provider | Landing hecha (rediseño del 12/10); faltan los términos |
| 9 | Backend de Cale funcionando (enviar mensajes y crear plantillas) | Pendiente: hace falta para los videos del App Review |
| 10 | App Review y acceso avanzado | Pendiente |
| 11 | Embedded Signup v4 con coexistencia (`featureType: whatsapp_business_app_onboarding`) | Pendiente. La v2 deja de funcionar el 15/10/2026: usar la v4 directamente |
| 12 | Dar de baja Vercel | Pendiente (después del 6 y de actualizar Meta) |

## Verificación del negocio (paso 7)

Se inicia desde Configuración del portfolio → Centro de seguridad → Verificación del negocio:

- **Caso de uso:** "La app requiere acceso a los permisos en Meta for Developers" (no "Configurar una cuenta de
  WhatsApp Business").
- **Tipo de negocio:** "tipo de negocio del titular" (titular).
- **Documento:** la constancia de régimen fiscal (Constancia de CUIT en ARCA).
- **Sitio:** `https://cale.com.ar`, cuando esté andando y verificado en Meta.
- **Confirmación:** por dominio (ya verificado) o por teléfono.
- Si pide un nombre comercial (DBA), revisarlo antes de completarlo.

**Riesgo aceptado:** por decisión del titular, el sitio no muestra datos personales (nombre legal, dirección ni CUIT).
Las guías recomiendan mostrar el nombre legal, así que Meta podría rechazar la verificación. Si la rechaza por eso,
agregar solo el nombre legal en los términos y la privacidad, y volver a enviarla.

## Coexistencia: lo que el negocio tiene que saber

- El número tiene que estar en uso en la app WhatsApp Business, versión 2.24.17 o posterior.
- Se sincronizan los últimos 180 días de chats (los archivos multimedia, solo de 14 días).
- No se sincronizan los grupos. En la API no hay llamadas, listas de difusión ni mensajes temporales.
- El envío queda limitado a 20 mensajes por segundo.

## Límites de Meta a tener en cuenta

- Un portfolio sin verificar puede escribir a 250 usuarios distintos cada 24 horas; verificado, 2.000, y después
  escala con la calidad.
- Las plantillas de recordatorio van en categoría **utilidad**; si Meta las ve promocionales, las pasa a marketing.
