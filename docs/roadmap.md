# Plan hasta la coexistencia de WhatsApp

Estado del camino para que Cale sea Tech Provider de Meta y pueda conectar negocios con **coexistencia** (el negocio
sigue usando la app WhatsApp Business en su mismo número). Actualizado al 01/11/2026.

**Regla (01/11/2026):** siempre coexistencia, en el número que el negocio ya usa; si no tiene cuenta de WhatsApp
Business Platform, se crea en el alta. No se ofrece una línea aparte solo para recordatorios. Se evaluó pasar por un
proveedor que ya sea Tech Provider (por ejemplo 360dialog): el plan de partner cuesta USD 500 a 1.000 por mes más USD
25 a 49 por número al mes, así que se siguió con Tech Provider propio.

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
| 1 | Documento legal del titular | Hecho |
| 2 | Información del negocio en el portfolio de Meta (nombre legal tal cual el documento, dirección, teléfono, sitio) | Hecho |
| 3 | Verificar el dominio del sitio en Meta (metaetiqueta en el `<head>`) | Hecho con `cale.com.ar` (14/10/2026); `cale-turnos.vercel.app` eliminado del portfolio |
| 4 | Comprar el dominio propio | Hecho: `cale.com.ar`, activo desde el 13/10/2026 |
| 5 | Hosting en AWS (S3 + CloudFront, plan Free) con deploy automático y alarmas | Hecho el 13/10 y **borrado el 24/10/2026** (ver [infra-aws.md](infra-aws.md)) |
| 6 | Etapa 2 de AWS: dominio en Route 53, certificado y alias | Hecho el 13/10 y borrado el 24/10/2026 |
| 7 | Verificación del negocio en Meta | Iniciada y pausada; retomar con `cale.com.ar` andando (Meta no aceptaba `vercel.app`) y con el documento legal vigente. En curso desde el 01/11/2026; el detalle de lo cargado está fuera del repo |
| 8 | Actualizar los textos del sitio al modelo Tech Provider | Hecho: landing (12/10) y privacidad, términos y eliminación de datos (01/11/2026) |
| 9 | Backend de Cale funcionando (enviar mensajes y crear plantillas) | Pendiente: hace falta para los videos del App Review. Falta decidir la arquitectura (propuesta: repo privado con funciones en Vercel y Supabase) |
| 10 | App Review y acceso avanzado | Pendiente |
| 11 | Embedded Signup con coexistencia | Pendiente. v2 y v3 dejaron de funcionar el 15/10/2026; la **v5** trae la coexistencia activada por defecto, sin `featureType` (para desactivarla: `enabled: false` en `features`) |
| 12 | Hosting en Vercel y `cale.com.ar` conectado | Sitio publicado en Vercel; `cale.com.ar` y `www` agregados el 01/11/2026 y nameservers cambiados en DonWeb a `ns1.vercel-dns.com` y `ns2.vercel-dns.com`: falta que propague |

## Verificación del negocio (paso 7)

Se inicia desde Configuración del portfolio → Centro de seguridad → Verificación del negocio:

- **Caso de uso:** "La app requiere acceso a los permisos en Meta for Developers" (no "Configurar una cuenta de
  WhatsApp Business").
- **Tipo de negocio y documento:** los que corresponden al titular; el detalle está fuera del repo.
- **Sitio:** `https://cale.com.ar`, cuando esté andando y verificado en Meta.
- **Confirmación:** por dominio (ya verificado) o por teléfono.
- Si pide un nombre comercial (DBA), revisarlo antes de completarlo.

**Identidad en el sitio (decisión del 01/11/2026):** el sitio no muestra el nombre legal, el domicilio, el CUIT ni
otro correo: todo dice "Cale" y `cale.turnos@gmail.com`. En el formulario privado de Meta, el nombre del negocio es el
nombre legal y `Cale` va como nombre alternativo.

**Riesgo aceptado:** las guías recomiendan mostrar el nombre legal, así que Meta podría rechazar la verificación. Si la
rechaza por eso, plan B: agregar solo el nombre legal en los términos y la privacidad, y volver a enviarla.

## Coexistencia: lo que el negocio tiene que saber

- El número tiene que estar en uso en la app WhatsApp Business, versión 2.24.17 o posterior.
- Se sincronizan los últimos 180 días de chats (los archivos multimedia, solo de 14 días).
- No se sincronizan los grupos. En la API no hay llamadas, listas de difusión ni mensajes temporales.
- El envío queda limitado a 20 mensajes por segundo.

## Límites de Meta a tener en cuenta

- Un portfolio sin verificar puede escribir a 250 usuarios distintos cada 24 horas; verificado, 2.000, y después
  escala con la calidad.
- Las plantillas de recordatorio van en categoría **utilidad**; si Meta las ve promocionales, las pasa a marketing.
