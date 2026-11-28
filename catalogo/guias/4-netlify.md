# Paso 4 · Netlify: publicar la página (10 minutos)

## 4.1 Antes de subir
- Revisa que `sitio/js/conexion.js` ya tenga la **Project URL** y la **clave pública** de Supabase (Paso 2.6).
- Solo se sube la carpeta **`sitio`**. Los archivos SQL, el Worker y las guías **no** van a Netlify.

## 4.2 Primera publicación (arrastrar la carpeta)
1. Entra a https://app.netlify.com → **Add new project** (o *Add new site*) → **Deploy manually**.
2. **Arrastra la carpeta `sitio` completa** al recuadro que dice *Drag and drop your project folder here*.
3. Espera unos segundos: te da una dirección como `https://nombre-raro-123.netlify.app`. Ábrela: debe verse el catálogo **sin** la franja naranja de "Modo demostración".
4. Ponle un nombre bonito: **Project configuration** → **General** → **Change project name** → por ejemplo `mitienda` → la dirección queda `https://mitienda.netlify.app`.

## 4.3 Publicar cambios después
Cada vez que cambies archivos de la carpeta `sitio` (por ejemplo, una versión nueva que te entregue):
1. Entra al proyecto → pestaña **Deploys**.
2. Arrastra **otra vez la carpeta `sitio` completa** al recuadro de abajo (*Need to update your project? Drag and drop…*).

> Los productos, fotos, precios y ajustes **no** necesitan volver a subirse: se cambian desde el almacén y se ven al instante.

## 4.4 Conectar el dominio (por ejemplo `mitienda.com`)
1. En el proyecto → **Domain management** → **Add a domain** → escribe el dominio → **Verify** → **Add domain**.
2. Netlify te muestra qué hacer:
   - **Opción fácil:** usar los *Name servers* de Netlify. Copias los 4 servidores (`dns1.p0X.nsone.net`…) y los pegas en el panel donde compraste el dominio (GoDaddy, Namecheap, Hostinger…), en la sección *Nameservers / DNS*.
   - **Opción alternativa:** en tu proveedor de dominio crea un registro **CNAME** `www` → `mitienda.netlify.app` y el registro **A** de la raíz que Netlify te indique.
3. Espera (de minutos a 24 horas). Netlify activa el **HTTPS** (candado) automáticamente.

## 4.5 Después de tener el dominio
1. **Supabase** → Authentication → URL Configuration: pon el dominio como **Site URL** y agrega `https://mitienda.com/admin.html` en **Redirect URLs**.
2. **Cloudflare** → tu Worker → Variables: (opcional) `ORIGENES` = `https://mitienda.com,https://mitienda.netlify.app`.
3. En la carpeta `sitio`, abre `robots.txt` y `sitemap.xml` y reemplaza `TU-DOMINIO` por tu dominio (ej. `mitienda.com`). Vuelve a subir la carpeta (4.3).
4. (Opcional) Registra el sitio en Google Search Console y envía `https://mitienda.com/sitemap.xml`.

## Direcciones útiles
- Tienda: `https://mitienda.com`
- Almacén: `https://mitienda.com/admin.html` (también `https://mitienda.com/almacen`)

➡️ Sigue con [Paso 5 · Usar el almacén](5-usar-el-almacen.md).
