# Guía paso a paso: tu Vendedor IA gratis con Render + Supabase

Al terminar vas a tener:

- Un panel en internet (por ejemplo **https://maurg-bot.onrender.com**) donde ves tus productos, entrenas la IA y lees las conversaciones.
- La IA leyendo los productos, precios y fotos de **tu página maurg.shop** automáticamente.
- WhatsApp (y luego Instagram y Facebook) respondiendo solos.

**Costo:** servidor $0 (Render gratis) + datos y fotos $0 (Supabase gratis) + IA en centavos (Claude Haiku) + Meta $0.
**Tiempo:** unas 2 horas, más la espera de las verificaciones de Meta.

> Los planes gratis y los nombres de los botones cambian de vez en cuando. Si algo no aparece igual, busca un nombre parecido. En esta guía, **TU-BOT** es la dirección que te da Render (por ejemplo `https://maurg-bot.onrender.com`).

---

## Parte 0 — El código en tu GitHub

Render instala el programa desde GitHub, así que el código tiene que estar en tu repositorio **Genesis-1**:
- **Opción A:** conecta la app de Claude en https://claude.ai/connect-github y lo subo yo.
- **Opción B:** descomprime `vendedor-ia.zip`, entra a tu repositorio en github.com → **Add file → Upload files**, arrastra **el contenido** de la carpeta `Genesis-1` (no la carpeta misma) y pulsa **Commit changes**.

---

## Parte 1 — Cuentas que necesitas (20 min)

| Cuenta | Dónde | Para qué | Costo |
|---|---|---|---|
| Anthropic | https://console.anthropic.com | La IA | Prepago; la recarga mínima suele ser unos $5 y con Haiku dura meses |
| Supabase | https://supabase.com | Guardar productos, conversaciones y fotos | $0 |
| Render | https://render.com | Tener el programa encendido en internet | $0 |
| cron-job.org | https://cron-job.org | Que Render no "duerma" tu bot | $0 |
| Meta for Developers | https://developers.facebook.com | Conectar WhatsApp/IG/FB | $0 |
| Portafolio comercial de Meta | https://business.facebook.com | Verificar tu negocio | $0 |

Para Render y Supabase puedes entrar con tu cuenta de **GitHub** (botón "Continue with GitHub").

### 1.1 Anthropic (la IA)
1. Regístrate en https://console.anthropic.com.
2. **Settings → Billing**: carga crédito.
3. Ponle un **límite de gasto** mensual bajo (por ejemplo $3) en **Settings → Limits**.
4. **API Keys → Create Key**. Copia la clave: **debe empezar con `sk-ant-api03-`**. Guárdala en un lugar seguro y **no la pegues en chats**.

### 1.2 Empieza YA la verificación de tu negocio en Meta (es lo que más tarda)
1. Entra a https://business.facebook.com y crea un **portafolio comercial** si no tienes. Agrega tu **página de Facebook** y tu **Instagram**.
2. **Configuración → Centro de seguridad → Verificación del negocio → Iniciar verificación**.
3. Te piden datos y documentos del negocio. Tarda de unos días a 2 semanas; mientras tanto sigue con lo demás.

---

## Parte 2 — Supabase: dónde se guardan tus datos (10 min)

1. En https://supabase.com → **Start your project** → entra con GitHub.
2. **New project:**
   - **Name:** `maurg-bot`.
   - **Database password:** genera una y guárdala (este programa no la usa, pero Supabase la pide).
   - **Region:** la más cercana (por ejemplo East US o São Paulo).
   - Plan **Free**. **Create new project.** Espera 1–2 minutos.
3. Ve a **Project Settings → API** (o **Data API / API Keys**) y copia dos cosas:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`).
   - La clave **service_role** (puede aparecer como "secret"). **Es secreta:** solo va en Render, nunca en tu página ni en chats.

No tienes que crear tablas: el programa crea solo su espacio de almacenamiento (un "bucket" privado llamado `vendedor`) la primera vez que arranca.

---

## Parte 3 — Render: poner el bot en internet (15 min)

1. En https://render.com → **Get Started** → entra con GitHub y dale acceso a tu repositorio **Genesis-1**.
2. **New + → Blueprint** → elige **Genesis-1**. Render encuentra el archivo `render.yaml` y crea el servicio **maurg-bot** en el plan **Free**.
   - Si tu código está en otra rama (por ejemplo `claude/nifty-darwin-wpobk1`), elige esa rama.
3. Te pide estos valores:
   - **ANTHROPIC_API_KEY:** tu clave de la Parte 1.1.
   - **ADMIN_PASSWORD:** una contraseña para tu panel (inventa una segura).
   - **SUPABASE_URL** y **SUPABASE_SERVICE_ROLE_KEY:** los de la Parte 2.
4. **Apply / Deploy.** Espera a que diga **Live** (2–5 minutos). Arriba aparece tu dirección, por ejemplo `https://maurg-bot.onrender.com`. Esa es **TU-BOT**.
5. Abre **TU-BOT**. Usuario: `admin`, contraseña: tu ADMIN_PASSWORD.
6. En Render → tu servicio → **Environment**, busca **META_VERIFY_TOKEN**: Render ya generó uno. Lo vas a necesitar para Meta.

> Si no te aparece "Blueprint": **New + → Web Service** → elige el repositorio → **Build Command:** `npm ci --omit=dev`, **Start Command:** `npm start`, **Instance type:** Free. Luego en **Environment** agrega las variables de arriba más `AI_MODEL=claude-haiku-5-5` y `META_VERIFY_TOKEN` (inventa un texto largo).

---

## Parte 4 — Que tu bot no se duerma (5 min)

Render gratis apaga el servicio si pasa 15 minutos sin visitas, y despertar tarda casi un minuto. Eso haría que los mensajes lleguen tarde. Lo solucionamos visitándolo cada 10 minutos:

1. Regístrate en https://cron-job.org.
2. **Create cronjob:**
   - **Title:** `maurg-bot`.
   - **URL:** `TU-BOT/salud` (por ejemplo `https://maurg-bot.onrender.com/salud`).
   - **Execution schedule:** **Every 10 minutes**.
3. **Create.** En el historial deberías ver respuestas "200 OK".

Esto también mantiene activo tu proyecto de Supabase (Supabase pausa los proyectos gratis que pasan una semana sin uso).

> Render gratis da 750 horas al mes, que alcanzan para tener **un** servicio encendido todo el mes.

---

## Parte 5 — (Opcional) Tu propio dominio: bot.maurg.shop

La dirección de Render funciona perfecto para Meta. Si prefieres `bot.maurg.shop`:
1. Render → tu servicio → **Settings → Custom Domains → Add** → `bot.maurg.shop`.
2. En Netlify → **Domains → maurg.shop → DNS settings → Add new record**: tipo **CNAME**, nombre `bot`, valor `maurg-bot.onrender.com` (tu dirección de Render sin `https://`).
   - Si el DNS de tu dominio no está en Netlify, crea el registro donde compraste el dominio.
3. Espera a que Render marque el dominio como verificado y con certificado. Desde ahí, **TU-BOT** es `https://bot.maurg.shop`.

---

## Parte 6 — Cargar tu tienda y entrenar la IA (30 min)

1. **Entrenamiento:** nombre del negocio, moneda, tu email de contacto, tono, y todo lo que un vendedor debe saber: envíos, formas de pago, horarios, cambios y devoluciones, garantía, ubicación. Agrega las preguntas frecuentes. **Guardar.**
2. **Inventario → 2. Conecta tu página:** escribe `https://maurg.shop/`. Si tus productos están en varias páginas (por ejemplo una por categoría), pon cada dirección en una línea. En "Sincronizar cada" pon `60` (una vez por hora). **Sincronizar ahora.**
   - La IA lee tu página, crea los productos con sus precios y **descarga las fotos**.
   - Solo vuelve a usar la IA si tu página cambió, así no gasta de más.
   - **Revisa la tabla de productos.** Si falta algo o un precio está mal, corrígelo en tu página (o con **Editar**).
3. **Stock:** tu página probablemente no muestra cuántas unidades tienes. Si quieres que la IA sepa qué está agotado, sube un **Excel** con columnas `Producto`, `Modelo` y `Stock` en **1. Sube tu inventario** (sin marcar "Reemplazar todo"). Se combina con lo de la página. Cuando sincroniza, la página manda: los productos que quites de tu página se quitan también del bot.
4. **Probar chat:** pregúntale como un cliente ("¿cuánto cuesta el bolso beige?", "¿tienen envío?") y mándale una foto de un producto para ver si lo reconoce. Ajusta el **Entrenamiento** hasta que te guste cómo responde.

---

## Parte 7 — Conectar WhatsApp (1 hora)

### 7.1 El número
Necesitas un número que **no esté registrado en la app de WhatsApp** (ni normal ni Business). Opciones:
- Un chip nuevo (lo más fácil).
- Tu número actual: tendrías que **eliminar** esa cuenta de WhatsApp primero (pierdes el historial en la app).

### 7.2 Crear la app de Meta
1. https://developers.facebook.com → **Comenzar** (regístrate como desarrollador con tu Facebook).
2. **Mis apps → Crear app.** Elige el caso de uso para conectar con clientes por **WhatsApp** (tipo **Negocio/Empresa**) y vincúlala a tu **portafolio comercial**.
3. **Configuración de la app → Básica:**
   - Copia la **Clave secreta de la app**.
   - **URL de la política de privacidad:** `TU-BOT/privacidad`
   - **URL de instrucciones de eliminación de datos:** `TU-BOT/eliminar-datos`
   - Pon un **icono** y una **categoría**. Guarda.

### 7.3 Token permanente
1. https://business.facebook.com → **Configuración → Usuarios → Usuarios del sistema → Agregar**. Nombre: `vendedor-ia`, rol **Administrador**.
2. **Asignar activos:** tu **app** (control total), tu **cuenta de WhatsApp**, tu **página** y tu **Instagram**.
3. **Generar token** → elige tu app → caducidad **Nunca** → permisos: `whatsapp_business_messaging`, `whatsapp_business_management`, `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `instagram_basic`, `instagram_manage_messages`, `business_management`. Copia el token.

### 7.4 Configurar WhatsApp
1. En tu app: **WhatsApp → Configuración de la API → Agregar número de teléfono**. Pon el nombre visible del negocio y verifica con el código SMS.
2. Copia el **Identificador del número de teléfono** (Phone number ID) de tu número real (no el de prueba).
3. **WhatsApp → Configuración → Webhook → Editar:**
   - URL de devolución de llamada: `TU-BOT/webhook/meta`
   - Token de verificación: el **META_VERIFY_TOKEN** de Render (Parte 3, paso 6)
   - **Verificar y guardar.** Luego, en **Campos del webhook**, suscríbete a **messages**.
4. Agrega un **método de pago** en tu cuenta de WhatsApp (Business → Cuentas de WhatsApp → Configuración de pago). **Responder** a clientes que te escriben primero es gratis; lo que se cobra es iniciar tú la conversación con plantillas, y este bot no lo hace.

### 7.5 Poner los datos en Render
Render → tu servicio → **Environment → Add Environment Variable**. Agrega:

| Variable | Valor |
|---|---|
| `META_APP_SECRET` | la clave secreta de la app |
| `WHATSAPP_TOKEN` | el token del usuario del sistema |
| `WHATSAPP_PHONE_NUMBER_ID` | el identificador del número |
| `FACEBOOK_PAGE_TOKEN` | el mismo token del usuario del sistema |

**Save Changes.** Render reinicia solo (1–2 minutos). En el panel → **Conexiones**, WhatsApp debe salir ✔.

### 7.6 Probar
Escribe desde otro celular a tu número de WhatsApp Business. Debe responder en unos segundos. Las conversaciones aparecen en **Conversaciones**, donde puedes **pausar la IA** y responder tú.

> **¿WhatsApp necesita la revisión de Meta?** Para tu propio negocio, normalmente no. Si no responde a números desconocidos, revisa que el número esté aprobado, que el método de pago esté cargado y que la verificación del negocio haya terminado.

---

## Parte 8 — Instagram y Facebook (después de WhatsApp)

### 8.1 Conectar
1. **Instagram:** tu cuenta debe ser **profesional** (Empresa) y estar **vinculada a tu página de Facebook**. En la app de Instagram: **Configuración → Mensajes y respuestas → Herramientas conectadas → Permitir acceso a los mensajes**.
2. En tu app de Meta agrega los casos de uso de **Messenger** e **Instagram**. Conecta tu página.
3. **Webhooks** (en Messenger y en Instagram): misma URL `TU-BOT/webhook/meta`, mismo token de verificación. Suscríbete a **messages**.
4. Suscribe tu página a la app: en la configuración de Messenger, en la sección de tu página, **Agregar suscripciones → messages**.

Mientras la app está "en desarrollo" solo responde a las personas con un rol en la app (tú y los "evaluadores" que agregues en **Roles de la app**). Úsalo para probar.

### 8.2 La revisión de Meta (para que responda a cualquier cliente)
Requisitos: **negocio verificado** (Parte 1.2) y en **Configuración → Básica** la privacidad, la eliminación de datos, el icono y la categoría (Parte 7.2).

1. **Revisión de la app → Permisos y funciones** → pide **Acceso avanzado** para `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `instagram_basic`, `instagram_manage_messages` y `business_management`.
2. Por cada permiso escribe para qué lo usas, por ejemplo:
   > *"Somos una tienda (maurg.shop). Usamos este permiso para que nuestro asistente responda automáticamente los mensajes que los clientes envían a nuestra página e Instagram, con información de productos, precios y disponibilidad. El dueño revisa las conversaciones y puede responder manualmente desde nuestro panel."*
3. **Video (lo más importante).** Graba la pantalla (con OBS, o la grabadora de Windows `Win+Alt+R`) mostrando:
   1. Un cliente escribiendo a tu página o Instagram ("¿tienen el bolso beige?").
   2. La respuesta automática llegando con el precio.
   3. El panel en **Conversaciones** mostrando ese chat, y tú respondiendo manualmente.
   Si te lo piden, agrega subtítulos o texto en inglés explicando cada paso.
4. **Instrucciones para el revisor:** la dirección del panel, usuario `admin` y una contraseña (puedes cambiarla después), y los pasos para probar: "Envía un mensaje a la página X; verás la respuesta y la conversación en el panel".
5. **Enviar.** Tarda unos días a 2 semanas. Si te rechazan, leen el motivo, lo corriges (normalmente el video) y vuelves a enviar.
6. Aprobado → arriba en tu app cambia **Modo: Desarrollo → En vivo**.

---

## Mantenimiento

| Quiero... | Cómo |
|---|---|
| Cambiar precios o productos | Cámbialos en tu página. El bot se actualiza solo (cada hora) o con **Sincronizar ahora** |
| Ver qué está pasando | Render → tu servicio → **Logs** |
| Cambiar claves/tokens | Render → **Environment** → editar → **Save Changes** (reinicia solo) |
| Actualizar el programa | Sube los cambios a GitHub: Render se actualiza solo |
| Respuestas más inteligentes | En **Environment** cambia `AI_MODEL` a `claude-opus-5-5` (cuesta bastante más que Haiku) |
| Ver o respaldar tus datos | Supabase → **Storage → vendedor**: `state/db.json` (productos, entrenamiento, conversaciones), `media/` (fotos de productos) y `customer/` (fotos de clientes) |

## Si algo falla

| Problema | Solución |
|---|---|
| El panel dice "Configura la variable ADMIN_PASSWORD" | Agrégala en Render → **Environment** |
| El deploy falla en Render | Mira **Logs**. Si dice algo de Supabase, revisa `SUPABASE_URL` y que la clave sea la **service_role** |
| Meta dice que no pudo verificar el webhook | Revisa que la URL termine en `/webhook/meta`, que el token sea el META_VERIFY_TOKEN de Render y que el servicio esté **Live** |
| Las respuestas tardan casi un minuto | El bot se durmió: revisa que cron-job.org esté visitando `TU-BOT/salud` cada 10 minutos |
| Llegan mensajes pero no responde | **Conversaciones**: ¿la IA está pausada? Mira **Logs**. ¿Tienes crédito en Anthropic? |
| No encontró productos en mi página | Prueba con la dirección exacta de la página donde se ven los productos. Si tu página carga los productos desde otro sitio, sube un Excel |

## Costos resumidos (aproximados; confírmalos al registrarte)

| Parte | Costo |
|---|---|
| Render (Free) | $0 |
| Supabase (Free: 500 MB de base de datos y 1 GB de archivos) | $0 |
| cron-job.org | $0 |
| IA con Haiku | ~$0.50 por cada 1.000 mensajes |
| WhatsApp (solo responder) | $0 |
| Meta (app y revisión) | $0 |

---

## Apéndice — Si algún día prefieres un servidor propio (RackNerd, ~$1–2/mes)

Un VPS está siempre encendido, sin depender de pings ni de planes gratis. El proyecto trae un instalador para Ubuntu:
1. Contrata un **KVM VPS de al menos 1 GB** con **Ubuntu 24.04** (por ejemplo una oferta anual de RackNerd) y anota la IP y la contraseña de root.
2. En Netlify crea un registro **A** `bot` → la IP del servidor.
3. Entra con `ssh root@TU-IP`, cambia la contraseña con `passwd` y ejecuta:
   ```bash
   apt-get update && apt-get install -y git
   git clone https://github.com/genesisviva11-prog/Genesis-1.git
   cd Genesis-1 && sudo bash deploy/instalar.sh
   ```
4. Te pide el dominio, la clave de Anthropic y la contraseña del panel. Las claves de Meta se ponen en `/etc/vendedor-ia.env` (y luego `sudo systemctl restart vendedor-ia`).

Para pasar tus datos de Supabase al servidor: descarga `state/db.json` y las carpetas de fotos desde Supabase Storage, o deja configuradas `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` también en el servidor y seguirá usando Supabase.
