# 🤖 Vendedor IA

Asistente de ventas con inteligencia artificial que **responde solo los mensajes de WhatsApp, Instagram y Facebook** usando **tu inventario real**: precios, modelos, stock y fotos.

- **Conecta tu tabla de productos en Supabase** (`supabase:productos`): lee productos, precios, disponibilidad, fotos y los datos de la tienda directo, sin gastar IA.
- **Conecta tu página web**: pega la dirección de tu tienda (aunque sea HTML puro, por ejemplo en Netlify) y la IA lee productos, precios y fotos; se actualiza sola.
- **Conecta tu inventario** desde Excel, CSV, JSON, PDF o TXT. Si el archivo no tiene columnas estándar (por ejemplo, un catálogo en PDF), la IA lo lee y extrae los productos.
- **Conecta tu almacén**: pega el link de un Google Sheet, un CSV/Excel publicado o la URL JSON de tu sistema de inventario, y se sincroniza cada X minutos.
- **Fotos**: sube fotos por producto o en lote (nombradas con el SKU). Cuando un cliente manda una foto, la IA la compara con tu catálogo para reconocer el producto, y también puede **enviar fotos** cuando el cliente pide verlas.
- **Entrenamiento**: escribe todo lo que la IA debe saber de tu negocio (horarios, envíos, formas de pago, garantías, promociones) y tus preguntas frecuentes.
- **Chat de prueba** para probar la IA antes de conectarla.
- **Bandeja de conversaciones**: ves todo lo que se habla por cada canal, puedes pausar la IA y responder tú. Cuando el cliente quiere comprar, reclama o pide hablar con una persona, la IA marca la conversación como **"atender"**.

La IA nunca inventa precios: solo usa lo que está en el inventario.

> 📘 **¿Primera vez?** Sigue la [guía paso a paso](GUIA.md): servidor gratis en Render + Supabase, dominio, WhatsApp, Instagram, Facebook y la aprobación de Meta.

## Puesta en marcha (en tu computadora)

Requisitos: Node.js 20 o superior y una clave de API de Anthropic (https://console.anthropic.com).

```bash
npm install
cp .env.example .env     # y completa ANTHROPIC_API_KEY (y lo demás cuando conectes las redes)
npm start
```

Abre http://localhost:3000 y:

1. **Inventario** → sube tu Excel/PDF o conecta la URL de tu almacén.
2. **Inventario → Fotos** → sube las fotos (por ejemplo `ZAP-042.jpg`, `ZAP-042_2.jpg`).
3. **Entrenamiento** → completa la información del negocio y las preguntas frecuentes.
4. **Probar chat** → escríbele como cliente, mándale una foto y revisa sus respuestas.
5. **Conexiones** → conecta WhatsApp, Instagram y Facebook (abajo).

### Formato del Excel

Se reconocen automáticamente columnas como: `Nombre/Producto`, `Modelo`, `SKU/Código`, `Categoría`, `Precio`, `Stock/Cantidad`, `Descripción`. Cualquier otra columna (Color, Talla, Material...) se guarda como característica del producto. Si no se reconoce ninguna columna, la IA interpreta el archivo.

Al importar, si un producto ya existe (mismo SKU, o mismo nombre y modelo) se actualiza y conserva sus fotos.

## Conectar WhatsApp, Instagram y Facebook

Las tres redes se conectan con una sola app de Meta y un solo webhook.

1. **Publica el servidor** en internet con HTTPS (Render, Railway, Fly.io, un VPS...). Para probar en tu computadora puedes usar `ngrok http 3000`. Pon esa dirección en `PUBLIC_URL`.
2. En https://developers.facebook.com crea una app tipo **Empresa** y agrega **WhatsApp**, **Messenger** e **Instagram**.
3. **Webhook**: URL `https://TU-DOMINIO/webhook/meta` y como token de verificación el valor de `META_VERIFY_TOKEN`. Suscríbete al campo `messages` en cada producto (WhatsApp Business Account, Page e Instagram).
4. Copia las credenciales al `.env`:

| Variable | Dónde se obtiene |
|---|---|
| `META_APP_SECRET` | App → Configuración → Básica → Clave secreta (verifica que los mensajes vienen de Meta) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp → Configuración de la API (usa un token permanente de un usuario del sistema en producción) |
| `FACEBOOK_PAGE_TOKEN` | Messenger → Configuración → Tokens de acceso de la página. Sirve también para Instagram si la cuenta de Instagram está vinculada a la página |
| `INSTAGRAM_ACCESS_TOKEN` | Opcional, si usas "Instagram API con inicio de sesión de Instagram" |

5. Reinicia el servidor. En la pestaña **Conexiones** verás qué canales están activos.

> Mientras la app de Meta esté en modo desarrollo solo responde a los números/cuentas de prueba que agregues. Para atender a cualquier cliente tienes que pasar la revisión de la app de Meta (permisos `whatsapp_business_messaging`, `pages_messaging`, `instagram_manage_messages`).

## Configuración avanzada

| Variable | Para qué |
|---|---|
| `ADMIN_PASSWORD` | Protege el panel (usuario `admin`). **Ponla siempre en producción.** |
| `AI_MODEL` | Modelo de IA. Por defecto `claude-opus-5-5`; `claude-haiku-5-5` es mucho más económico (el instalador de servidor lo usa) |
| `CONTACT_EMAIL` | Email que aparece en `/privacidad` (también se puede poner en Entrenamiento) |
| `AI_EFFORT` | `low` (por defecto, rápido y económico), `medium` o `high` si quieres respuestas más pensadas |
| `INVENTORY_SOURCE_AUTH` | Cabecera `Authorization` si tu sistema de inventario la pide |
| `DATA_DIR` | Carpeta donde se guardan los datos (por defecto `./data`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Guarda datos y fotos en Supabase Storage en vez del disco (necesario en Render gratis, que borra el disco al reiniciar) |

La IA usa *fallbacks* automáticos: si el modelo principal se niega a responder un mensaje, la API reintenta con otro modelo recomendado.

## Cómo funciona

```
Cliente (WhatsApp / IG / FB) ──► /webhook/meta ──► IA (Claude)
                                                   │  herramientas:
                                                   │  • buscar_productos   (precio, stock, modelos)
                                                   │  • ver_fotos_productos (compara la foto del cliente)
                                                   │  • enviar_foto
                                                   │  • pasar_a_humano
                                                   ▼
                                           respuesta al cliente
```

- `src/server.js` — servidor, panel y API
- `src/agent.js` — el vendedor IA (instrucciones y herramientas)
- `src/importers.js` — lectura de Excel/CSV/JSON/PDF y sincronización por URL
- `src/channels/meta.js` — WhatsApp, Messenger e Instagram
- `src/store.js` — productos, entrenamiento y conversaciones (en memoria, guardados como JSON)
- `src/files.js` — dónde se guarda todo: disco local o Supabase Storage
- `render.yaml` — despliegue en Render con un clic (Blueprint)
- `public/index.html` — panel de control

- `deploy/instalar.sh` — instalación en un servidor Ubuntu (Node, HTTPS automático con Caddy, servicio)

Páginas públicas para la revisión de Meta: `/privacidad` y `/eliminar-datos`.

Tests: `npm test`.

## Próximos pasos posibles

- Base de datos (PostgreSQL) para catálogos grandes o varios negocios.
- Avisos al dueño por WhatsApp/email cuando una conversación necesita atención.
- Tomar pedidos y generar links de pago.
- Conectores directos a Shopify, WooCommerce o tu ERP.
