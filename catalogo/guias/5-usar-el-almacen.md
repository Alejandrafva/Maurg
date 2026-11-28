# Paso 5 · Usar el almacén

Entra a `https://tu-tienda/admin.html` (o `/almacen`) con el correo y la contraseña del administrador. Funciona en la computadora y en el celular (en el celular las secciones están abajo).

> Primera vez: ve a **Ajustes** y revisa los datos que ya vienen cargados (logo de ARKEO, WhatsApp 0412-5074777, teléfonos, Instagram @mobiliariodeoficina y showroom en San Diego). Pon la tasa BCV y la dirección del Worker. Después carga productos.

## 5.1 Ajustes (lo primero)
- **Tienda:** nombre, eslogan y logo (opcional).
- **Contacto:** **WhatsApp de pedidos** (obligatorio; ahí llegan los pedidos, puede ser `0414-1234567`), teléfono, Instagram, TikTok, correo, horario, dirección y enlace de Google Maps.
- **Precios en bolívares:**
  - **Tasa BCV:** bolívares por dólar.
  - **Brecha cambiaria (%):** por ejemplo `25`. Cada producto tiene **un solo precio, en divisas**. El precio en bolívares se calcula solo: `precio en divisas + 25 %`, multiplicado por la tasa BCV. Ejemplo: $100 → $125 → con tasa 45,50 = **Bs 5.687,50**.
  - Al cambiar la brecha o la tasa y tocar **Guardar ajustes**, se actualizan los precios en Bs de **toda la tienda** al instante.
  - «Vender también al mayor» está apagado: la tienda vende solo al detal.
- **Métodos de pago:** activa los que quieras mostrar (por ahora Zelle, Binance y Banesco Panamá). En «Datos» puedes escribir el correo de Zelle, el ID de Binance, etc. Aparecen en el carrito y en la página de pagos. Puedes agregar más con «+ Método» (por ejemplo, Pago móvil en bolívares).
- Aviso «¡Pocas unidades!», texto para productos por encargo, agencias de envío y retiro.
- **Fotos (Cloudflare):** pega la **dirección del Worker** (Paso 3.5) y toca **Probar conexión** → debe decir *Conectado*.
- Toca **Guardar ajustes**.

Si la tasa está vacía, el almacén muestra un **aviso rojo**: sin tasa los clientes no ven los precios en bolívares.

**Cambiar la tasa del día rápido:** arriba a la derecha, en cualquier sección, toca **Tasa BCV ✎**.

## 5.2 Productos
**Nuevo producto** → completa:
- **Datos:** nombre (obligatorio), código, marca, categoría (elige una o escribe una nueva), material, medidas y descripción.
- **Precio:** escribe solo el **precio en divisas**. Debajo verás cuánto queda en bolívares. *Precio anterior* muestra la oferta tachada con el %.
- **Estado:** Visible en la tienda · Por encargo (se puede pedir aunque no haya stock) · Destacado (sale primero) · Nuevo.
- **Colores y stock:** toca **+ Color**, elige el **tono**, escribe el **nombre** y el **stock** de ese color. El total se calcula solo. Si no tiene colores, escribe el stock total.
- **Fotos de ambiente:** si la foto muestra el mueble en un espacio (sala, cocina, showroom), marca **Ambiente** debajo de la foto: llena toda la tarjeta. Los productos **Destacados** con foto de ambiente salen en el **carrusel grande de la portada**. Al abrir el producto se muestra primero la foto con fondo blanco.
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
- **Editar:** cambiar cantidades, precios o color, quitar productos, **agregar otro producto** (busca por nombre o código en «Agregar producto») o corregir los datos del cliente. El total se recalcula solo.
- **Cliente:** abre WhatsApp con el cliente.
- **PDF:** ver el PDF del pedido.
- **Rechazar:** borra el pedido y su PDF sin tocar el stock.
- **Varios a la vez:** marca la casilla de cada pedido (o **Seleccionar todos**) y toca **Aceptar** o **Rechazar** en la barra de arriba. Si algún producto no alcanza para todos, te avisa antes.

Los pedidos que nadie atiende se borran solos a los días indicados en Ajustes (30 por defecto). Así no ocupan espacio.

## 5.4 Categorías
Ordena con ▲▼ (ese es el orden de la barra de categorías en la tienda), cambia nombres (los productos se actualizan solos) y elige un icono. Las categorías sin productos no aparecen en la tienda. **Guardar categorías.**

## 5.5 Página (todo lo que se ve en la página de inicio)
| Parte de la página | Dónde se cambia |
|---|---|
| **Fotos del carrusel grande** | Página › **Fotos del carrusel de la portada**: sube cada foto (solo para la portada, no cambia las fotos de los productos) y debajo elige **qué producto es**. La tarjeta muestra su nombre, precio en $ y Bs y «Ver producto». Si no subes ninguna, se usan los productos **Destacados** con foto de **Ambiente**. |
| **Frase pequeña** de la portada | Ajustes › Tienda › Eslogan |
| **Título grande**, subtítulo y botón | Página › Portada. Escribe `**así**` para poner palabras en negrita. |
| **Franja** bajo la portada (dos textos) | Página › Textos de la página de inicio |
| **"Compra por categoría"** (título) | Página › Textos de la página de inicio |
| **Tarjetas de categoría** (nombre, orden, icono) | Categorías. La foto de cada tarjeta es la del primer producto de esa categoría. |
| **"Nuestros productos"** (cuadrícula, 2 por fila en el celular) | Sale sola: los primeros 8 productos según el orden ▲▼ de Productos (los Destacados primero) |
| **Página de Catálogo** (`catalogo.html`) | Sale sola con todos los productos visibles. Los filtros (categoría, precio, material, color, disponibilidad) se arman solos con los datos de cada producto: llena bien **Categoría**, **Material** y **Colores** |
| **Colecciones** (las dos fotos grandes) | Página › Colecciones |
| **Las 4 ventajas** (envíos, pagos…), su título y su texto | Página › Textos de la página de inicio |
| **Banda azul** (título, texto y foto) | Página › Textos de la página de inicio |
| **Reseñas** | Página › Reseñas |
| **Foto grande de cada página del menú** (Pagos, Envíos, Reseñas, Contacto, Políticas, Privacidad) | Página › Fotos de las páginas del menú |
| **Galería de Instagram** (fotos que llevan a tu Instagram o a una publicación) | Página › Galería de Instagram (hasta 12 fotos; pega el enlace de la publicación si quieres) |
| **Menú** (categorías desplegables en la computadora y menú de pantalla completa en el celular) | Sale solo con tus Categorías (las que tienen productos, con la foto del primer producto) |
| **Ubicación con mapa** (antes del pie de página) | Ajustes › Contacto: dirección, horario y enlace de Google Maps (opcional; si no lo pones, el botón «Cómo llegar» busca la dirección) |
| **Asistente de Contacto** (chat que pregunta nombre, qué busca, casa u oficina, cantidad, ciudad y entrega, y luego abre WhatsApp con todo) | Sale solo: usa tus Categorías y el WhatsApp de Ajustes |
| **Pie de página** (columnas y el nombre ARKEO grande) | Sale solo: eslogan, horario, categorías y contacto de Ajustes |
| **Pagos, envíos, políticas, privacidad** | Página › Páginas informativas |
| **Logo, WhatsApp, teléfonos, Instagram, dirección** (cabecera, pie y contacto) | Ajustes |

Si dejas un cuadro vacío se usa el texto de fábrica (el que aparece en gris). Toca **Guardar página** al terminar.

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
