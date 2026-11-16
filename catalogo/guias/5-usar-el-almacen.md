# Paso 5 · Usar el almacén

Entra a `https://tu-tienda/admin.html` (o `/almacen`) con el correo y la contraseña del administrador. Funciona en la computadora y en el celular (en el celular las secciones están abajo).

> Primera vez: ve directo a **Ajustes**: sube el **logo de ARKEO** (PNG blanco con fondo transparente se ve mejor sobre la cabecera negra), escribe el **WhatsApp de pedidos**, teléfonos, Instagram y dirección, pon la tasa BCV y la dirección del Worker. Después carga productos.

## 5.1 Ajustes (lo primero)
- **Tienda:** nombre, eslogan y logo (opcional).
- **Contacto:** **WhatsApp de pedidos** (obligatorio; ahí llegan los pedidos, puede ser `0414-1234567`), teléfono, Instagram, TikTok, correo, horario, dirección y enlace de Google Maps.
- **Ventas:**
  - **Tasa BCV:** bolívares por dólar. La tienda muestra los precios "a tasa BCV" también en Bs.
  - **Mínimo de piezas para precio al mayor** (ej. 6). Se cuenta el total del carrito, combinando modelos.
  - **Aviso «¡Pocas unidades!» desde** (ej. 3).
  - Texto para productos por encargo, datos para pagar, agencias de envío, retiro.
- **Fotos (Cloudflare):** pega la **dirección del Worker** (Paso 3.5) y toca **Probar conexión** → debe decir *Conectado*.
- Toca **Guardar ajustes**.

**Cambiar la tasa del día rápido:** arriba a la derecha, en cualquier sección, toca **Tasa BCV ✎**.

## 5.2 Productos
**Nuevo producto** → completa:
- **Datos:** nombre (obligatorio), código, marca, categoría (elige una o escribe una nueva), material, medidas y descripción.
- **Precios en dólares:**
  - *Detal · en divisas* y *Mayor · en divisas*: pagando en dólares/Zelle.
  - *Detal · a tasa BCV* y *Mayor · a tasa BCV*: pagando en bolívares (se muestra en Bs con la tasa).
  - Deja vacío lo que no uses. *Precio anterior* muestra la oferta tachada con el %.
- **Estado:** Visible en la tienda · Por encargo (se puede pedir aunque no haya stock) · Destacado (sale primero) · Nuevo.
- **Colores y stock:** toca **+ Color**, elige el **tono**, escribe el **nombre** y el **stock** de ese color. El total se calcula solo. Si no tiene colores, escribe el stock total.
- **Fotos y videos:** toca el recuadro o arrastra los archivos. Las fotos **se aligeran solas** (máx. 900 px, WebP) antes de subir. En cada foto elige **de qué color es**: en la tienda, al tocar un color, se muestran sus fotos. La primera foto es la principal (muévela con las flechas).
- **Datos internos** (solo tú los ves): proveedor, costo, notas, posición.
- **Guardar.**

En la lista: 👁 ocultar/mostrar en la tienda · ⧉ duplicar · ✎ editar · 🗑 borrar (también borra sus fotos de Cloudflare). Las flechas ▲▼ cambian el orden en el catálogo.

**Avisos automáticos en la tienda:** *Agotado* (stock 0), *¡Pocas unidades!* (según Ajustes), *Por encargo*, *-X%* (oferta) y *Nuevo*.

## 5.3 Pedidos
Cuando un cliente toca **Enviar pedido por WhatsApp**:
1. Se arma un **PDF** del pedido y se sube a Cloudflare.
2. El pedido queda **pendiente** aquí, con un número (ej. `P261116-8D0D`).
3. Se abre WhatsApp con el resumen y el enlace del PDF, dirigido al número de la tienda.

En **Pedidos** puedes:
- **Aceptar:** descuenta el stock (del color correcto) y borra el pedido y su PDF. Si falta stock te avisa en rojo.
- **Editar:** cambiar cantidades, precios, quitar productos o corregir datos del cliente.
- **Cliente:** abre WhatsApp con el cliente.
- **PDF:** ver el PDF del pedido.
- **Rechazar:** borra el pedido y su PDF sin tocar el stock.

Los pedidos que nadie atiende se borran solos a los días indicados en Ajustes (30 por defecto). Así no ocupan espacio.

## 5.4 Categorías
Ordena con ▲▼ (ese es el orden de la barra de categorías en la tienda), cambia nombres (los productos se actualizan solos) y elige un icono. Las categorías sin productos no aparecen en la tienda. **Guardar categorías.**

## 5.5 Página
- **Portada:** título grande (vacío = nombre de la tienda), subtítulo, texto del botón e imagen (mejor un mueble con fondo blanco o transparente).
- **Colecciones:** grupos como "Oficina en casa" con foto. Luego marca la colección en la ficha de cada producto.
- **Reseñas:** nombre, ciudad, estrellas, opinión y foto opcional.
- **Páginas informativas:** pagos, envíos, políticas, privacidad… Si dejas un cuadro vacío se usa el texto de fábrica. Formato: `## Título`, `- elemento de lista`, `**negrita**`.

## 5.6 Proveedores
Lista privada con contacto, teléfono (botón de WhatsApp), correo y notas. Se asignan en la ficha de cada producto.

## 5.7 Descargar el inventario en Excel
**Productos** → **Excel**. Descarga un `.xlsx` **con la foto de cada producto**, código, colores, stock total y por color, todos los precios, el equivalente en Bs, proveedor, costo y valor del inventario. Respeta los filtros (ej. solo una categoría, o solo agotados).

## 5.8 Espacio en Cloudflare
**Ajustes › Fotos:**
- **Ver espacio usado:** cuánto ocupan las fotos (de 10 GB gratis).
- **Buscar fotos sin usar:** encuentra archivos que ya no usa ningún producto y te deja borrarlos.

## 5.9 Contraseña
- Cambiarla: **Ajustes › Mi cuenta**.
- ¿La olvidaste? En la pantalla de entrada escribe el correo y toca **¿Olvidaste tu contraseña?**. Llega un correo; ábrelo **en el mismo dispositivo** y escribe la nueva.

## Consejos
- Fotos: con buena luz y fondo blanco o liso se ven mucho mejor en las tarjetas grises del catálogo.
- Cada producto se puede compartir: abre su ficha y copia la dirección (termina en `#p-123`).
- La tienda guarda una copia del catálogo en el celular del cliente: abre al instante aunque la señal sea mala.
