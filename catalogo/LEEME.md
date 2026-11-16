# Catálogo web + Almacén · Mobiliario De Oficina

Catálogo online de **Mobiliario De Oficina** (@mobiliariodeoficina · showroom en San Diego, edo. Carabobo): sillas, escritorios, mesas, comedor, tocadores y hogar, **al mayor y al detal**.

Ya viene con su marca: logo, azul de la marca (#3E7EE4), nombre, WhatsApp de pedidos 0412-5074777, teléfonos 0424-4343284 · 0412-5074777, Instagram y dirección del showroom. Todo se puede cambiar desde el almacén (Ajustes).

Es un sistema **independiente**: no usa el Vendedor IA del resto de este repositorio. Los clientes arman su pedido y lo envían por **WhatsApp** con un **PDF**. El dueño administra todo desde el **Almacén** (`admin.html`).

## Qué hay en esta carpeta

| Carpeta / archivo | Qué es | ¿Dónde va? |
|---|---|---|
| `sitio/` | La página completa (catálogo, almacén, páginas informativas, iconos, sitemap, robots) | **Netlify** (se arrastra la carpeta entera) |
| `sitio/js/conexion.js` | El **único** archivo que hay que editar: dirección y clave pública de Supabase | Va dentro de `sitio/` |
| `supabase/01_tablas_y_seguridad.sql` | Crea las tablas, la seguridad y las funciones | Se pega en **Supabase › SQL Editor**. *No va en Netlify* |
| `supabase/02_correo_administrador.sql` | Define el correo del administrador | Se pega en **Supabase › SQL Editor**. *No va en Netlify* |
| `cloudflare/worker.js` | El "puente" de las fotos (sube, muestra y borra) | Se pega en **Cloudflare › Workers**. *No va en Netlify* |
| `guias/` | Guías paso a paso | Para ti y para el cliente |

## Orden de trabajo

1. [Crear las cuentas](guias/1-crear-cuentas.md) — Netlify, Supabase y Cloudflare, con el correo del cliente.
2. [Supabase](guias/2-supabase.md) — proyecto, SQL, usuario administrador y `conexion.js`.
3. [Cloudflare](guias/3-cloudflare.md) — bucket R2, Worker y conexión `BUCKET`.
4. [Netlify](guias/4-netlify.md) — subir la carpeta `sitio` y conectar el dominio.
5. [Usar el almacén](guias/5-usar-el-almacen.md) — pegar la dirección del Worker en Ajustes y cargar productos.

Si algo no funciona: [Problemas frecuentes](guias/6-problemas-frecuentes.md).

> 💡 **Antes de crear nada** puedes ver la tienda funcionando: abre `sitio/index.html` desde Netlify (o cualquier servidor) sin llenar `conexion.js`. Entra en **modo demostración** con productos de ejemplo, y el almacén acepta cualquier correo. Los cambios del modo demostración se guardan solo en ese navegador.

## Cómo funciona (en una imagen)

```
 Cliente (celular)                      Administrador
      │                                       │
      ▼                                       ▼
  index.html  ──lee catálogo──►  SUPABASE  ◄──crea/edita── admin.html
      │        ──guarda pedido──►  (productos, config,          │
      │                             pedidos, proveedores)       │
      │                                  ▲                      │
      │                                  │ ¿es el admin?        │
      ▼                                  │                      ▼
  PDF del pedido ──sube──►  CLOUDFLARE WORKER  ◄──sube/borra fotos──
      │                         │   (R2: fotos, videos, PDFs)
      ▼                         ▼
  WhatsApp de la tienda   fotos con caché larga (no gasta Supabase)
```

## Reglas de seguridad (no cambiarlas)

- **Cualquiera puede leer** el catálogo y los ajustes públicos.
- **Cualquiera puede enviar** un pedido (entra como *pendiente*).
- **Solo el correo del administrador** puede crear, editar o borrar productos, ajustes, pedidos y proveedores (función `es_admin()` en Supabase, compara el correo en minúsculas).
- El Worker **pregunta a Supabase** si la sesión es del administrador antes de subir, listar o borrar archivos. El público solo puede ver archivos y subir el PDF de su propio pedido (solo PDF, máx. 2 MB).
- En la página solo va la **clave pública** (*publishable* / *anon*). **Nunca** la *secret* ni la *service_role*.
- Proveedores, costos y notas internas están en tablas privadas que solo ve el administrador.

## Lo que se probó antes de entregar

- SQL ejecutado **tres veces seguidas** sobre la misma base: no borra datos y conserva el correo del administrador.
- Seguridad: un visitante no puede editar productos, ver pedidos ni proveedores; otro usuario registrado tampoco; el administrador sí. Aceptar un pedido descuenta el stock del color correcto y borra el pedido.
- Worker: rechaza subidas sin sesión o de otro correo, rechaza tipos de archivo no permitidos, solo acepta PDF reales en `/pedido`, no deja sobrescribir un PDF, sirve con caché larga y borra.
- Tienda y almacén en computadora y celular: crear producto con colores y stock por color, foto aligerada automáticamente (3000 px → 900 px WebP), Excel con fotos, pedido por WhatsApp con PDF, aceptar pedido y ver el stock descontado.

## Nota sobre WhatsApp y el PDF

WhatsApp no permite que una página web adjunte un archivo directamente en el chat. Por eso el botón **sube el PDF a Cloudflare** y lo envía como **enlace** dentro del mensaje, junto con el resumen completo del pedido. La tienda lo abre con un toque.
