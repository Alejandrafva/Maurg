# Paso 2 · Supabase: base de datos y login (20 minutos)

## 2.1 Crear el proyecto
1. Entra a https://supabase.com/dashboard → **New project**.
2. **Name:** el nombre de la tienda (por ejemplo `muebles-tienda`).
3. **Database Password:** toca **Generate a password** y **anótala** (casi nunca se usa, pero guárdala).
4. **Region:** la más cercana a Venezuela, por ejemplo **East US (North Virginia)**.
5. **Create new project** y espera 1–2 minutos a que termine.

## 2.2 Ejecutar el SQL (crea tablas y seguridad)
1. Menú izquierdo → **SQL Editor** → **New query** (o el botón **+**).
2. Abre en tu computadora el archivo `supabase/01_tablas_y_seguridad.sql` con el Bloc de notas (Windows) o TextEdit (Mac), **selecciona todo**, copia y pégalo en Supabase.
3. Toca **Run** (o Ctrl+Enter). Debe decir **Success. No rows returned**.
   - Si aparece un aviso de "destructive operation" o "RLS", toca **Run this query** igual: el archivo **no borra datos**.
4. **New query** otra vez. Abre `supabase/02_correo_administrador.sql`, pégalo y **cambia `admin@ejemplo.com` por el correo real del administrador** (está una sola vez, entre comillas simples). **Run**.
   - Debe mostrar una tablita con *Administrador configurado* y el correo que escribiste.

> Puedes volver a ejecutar estos archivos cuando quieras (por ejemplo, si te entrego una versión nueva): **no borran productos, pedidos ni ajustes**. Para cambiar el correo del administrador, ejecuta de nuevo solo el archivo 2 con el correo nuevo.

## 2.3 Crear el usuario administrador
1. Menú izquierdo → **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email:** el mismo correo del archivo 2. **Password:** una contraseña segura (mínimo 8 caracteres).
3. Marca **Auto Confirm User** → **Create user**.

## 2.4 Cerrar el registro público (importante)
Nadie más debe poder crearse una cuenta.
1. **Authentication** → **Sign In / Providers** (en algunas versiones: **Providers** o **Settings**).
2. Desactiva **Allow new users to sign up** → **Save**.

## 2.5 Direcciones permitidas (para "olvidé mi contraseña")
1. **Authentication** → **URL Configuration**.
2. **Site URL:** la dirección de la tienda, por ejemplo `https://mitienda.netlify.app` (cuando tengas dominio, cámbiala por `https://mitienda.com`).
3. **Redirect URLs** → **Add URL** → `https://mitienda.netlify.app/admin.html` (y después también la del dominio). **Save**.

> Si todavía no tienes la dirección de Netlify, haz este paso al terminar el Paso 4.

## 2.6 Copiar la dirección y la clave PÚBLICA a `conexion.js`
1. Arriba toca **Connect** o ve a **Project Settings** → **API Keys** (y **Data API** para la URL).
2. Copia:
   - **Project URL** → algo como `https://abcdxyz.supabase.co`
   - **Publishable key** → empieza con `sb_publishable_…`
     (si tu proyecto solo muestra "Legacy API keys", usa la **anon public**, que empieza con `eyJ…`)
3. ⚠️ **Nunca** copies la **secret** (`sb_secret_…`) ni la **service_role**. Esas no van en la página.
4. Abre `sitio/js/conexion.js` con el Bloc de notas / TextEdit y reemplaza:

```js
window.CONEXION = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
  WORKER_URL: "",
};
```

5. Guarda el archivo (en TextEdit: *Formato › Convertir a texto normal* antes de guardar). Deja las comillas y las comas tal cual.

> Si por error pegas una clave secreta, la página la detecta, **no la usa** y se queda en modo demostración.

## Qué se creó

| Tabla | Para qué | Quién la ve |
|---|---|---|
| `productos` | Catálogo: nombre, marca, código, categoría, colores con su tono, descripción, precios (detal/mayor, en divisas y a tasa BCV), disponible, por encargo, fotos (cada una con su color), orden, stock total y stock por color, medidas y material | Todos leen · solo el admin edita |
| `config` | Una sola fila con todos los ajustes en JSON (WhatsApp, tasa del día, categorías, portada, colecciones, reseñas, textos de páginas, dirección del Worker…) | Todos leen · solo el admin edita |
| `pedidos` | Pedidos **temporales**: entran como *pendiente*; al aceptarlos se descuenta el stock y se borran; al rechazarlos se borran; los viejos se borran solos | Cualquiera envía · solo el admin ve |
| `proveedores` | Datos de proveedores | **Solo el admin** |
| `productos_privado` | Proveedor, costo y notas internas de cada producto | **Solo el admin** |

> **Plan gratis de Supabase:** si el proyecto pasa 7 días **sin ninguna visita**, Supabase lo pausa. Las visitas de los clientes al catálogo lo mantienen activo. Si alguna vez se pausa, entra al panel de Supabase y toca **Restore project**: los datos no se pierden.

➡️ Sigue con [Paso 3 · Cloudflare](3-cloudflare.md).
