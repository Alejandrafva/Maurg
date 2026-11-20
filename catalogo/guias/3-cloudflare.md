# Paso 3 · Cloudflare: fotos, videos y PDFs (20 minutos)

Las fotos se guardan en **R2** (gratis hasta 10 GB y **no cobra por las visitas**). Un **Worker** hace de puente: cualquiera puede **ver** las fotos, pero solo el administrador puede **subir, listar o borrar**.

## 3.1 Crear el bucket R2
1. Entra a https://dash.cloudflare.com → menú izquierdo **R2 Object Storage** (puede estar dentro de **Storage & databases**).
2. Si es la primera vez, te pide activar R2 y un método de pago (ver Paso 1.3).
3. **Create bucket** → **Bucket name:** `fotos-tienda` (minúsculas, sin espacios) → **Location:** Automatic → **Create bucket**.

### Borrar solos los PDF viejos (recomendado)
1. Abre el bucket → **Settings** → **Object lifecycle rules** → **Add rule**.
2. **Rule name:** `pedidos-viejos` · **Prefix:** `pedidos/` · **Delete objects after:** `30` días → **Save**.

Así los PDF de pedidos no ocupan espacio para siempre (el almacén ya borra el PDF al aceptar o rechazar un pedido; esta regla limpia los que nadie atendió).

## 3.2 Crear el Worker
1. Menú izquierdo → **Workers & Pages** (en **Compute**) → **Create** → **Create Worker** (o **Start with Hello World!**).
2. **Name:** `fotos-tienda` → **Deploy**.
3. Toca **Edit code** (arriba a la derecha).
4. Borra **todo** el código que aparece. Abre `cloudflare/worker.js` con el Bloc de notas/TextEdit, copia **todo** y pégalo.
5. Toca **Deploy** (arriba a la derecha) y confirma.

## 3.3 Conectar el bucket con el nombre `BUCKET`
1. Vuelve a la pantalla del Worker → pestaña **Settings** → **Bindings** → **Add binding** (o **+ Add**).
2. Elige **R2 bucket**.
3. **Variable name:** `BUCKET` (exactamente así, en mayúsculas) · **R2 bucket:** `fotos-tienda` → **Add binding** / **Deploy**.

## 3.4 Variables del Worker
En el Worker → **Settings** → **Variables and Secrets** → **Add**:

| Tipo | Nombre | Valor |
|---|---|---|
| Text | `SUPABASE_URL` | La Project URL de Supabase, ej. `https://abcdxyz.supabase.co` |
| Text | `SUPABASE_KEY` | La **clave pública** (publishable / anon), la misma de `conexion.js` |

Toca **Deploy** / **Save** para aplicar.

> Opcional, cuando ya tengas la dirección final de la tienda: agrega `ORIGENES` = `https://mitienda.com,https://mitienda.netlify.app` (separadas por coma, sin `/` al final). Así **solo tu página** puede enviar PDFs de pedidos al Worker.

## 3.5 Copiar la dirección del Worker y probarla
1. En la pantalla del Worker verás su dirección, algo como `https://fotos-tienda.tu-usuario.workers.dev` (en **Domains & Routes** o junto a **Visit**). **Anótala.**
2. Ábrela en el navegador. Debe mostrar algo así:

```json
{"ok":true,"servicio":"fotos del catálogo","bucket":true,"supabase":true}
```

- Si dice **"Falta conectar el bucket R2 con el nombre BUCKET"** → revisa el 3.3.
- Si `"supabase": false` → revisa el 3.4.

Esta dirección la pegarás en el almacén (**Ajustes › Fotos**) en el Paso 5.

➡️ Sigue con [Paso 4 · Netlify](4-netlify.md).
