# Paso 1 · Crear las cuentas (20 minutos)

Crea las tres cuentas **con el correo del cliente** (el dueño de la tienda). Así todo queda a su nombre y tú solo ayudas a configurarlo.

> Consejo: abre un documento privado (o un gestor de contraseñas) y ve anotando cada usuario, contraseña y enlace. Al final se lo entregas al cliente.

| Servicio | Para qué | Dónde | Costo |
|---|---|---|---|
| **Netlify** | Aloja la página | https://app.netlify.com/signup | $0 |
| **Supabase** | Base de datos y login del almacén | https://supabase.com/dashboard/sign-up | $0 |
| **Cloudflare** | Guarda fotos, videos y PDFs (R2) | https://dash.cloudflare.com/sign-up | $0 hasta 10 GB |

## 1.1 Netlify
1. Entra a https://app.netlify.com/signup y elige **Sign up with email**.
2. Escribe el correo del cliente y una contraseña. Confirma el correo que te llega.
3. Si te pregunta para qué la usarás, elige algo como *Personal* / *Client project*. Si te pide crear un "team", ponle el nombre de la tienda.

## 1.2 Supabase
1. Entra a https://supabase.com/dashboard/sign-up.
2. Usa **correo y contraseña** (no GitHub), con el correo del cliente. Confirma el correo.
3. Si te pide crear una **organización**: nombre de la tienda, tipo *Personal*, plan **Free**.

## 1.3 Cloudflare
1. Entra a https://dash.cloudflare.com/sign-up con el correo del cliente. Confirma el correo.
2. Si te ofrece "agregar un sitio/dominio", puedes **saltarlo** por ahora.
3. **R2 pide un método de pago** (tarjeta o PayPal) para activarse, aunque se use dentro de lo gratis. No cobra mientras se mantenga por debajo de 10 GB guardados y de las operaciones gratis del mes, que para un catálogo es muchísimo. Pídele al cliente que lo agregue él mismo.

## Lista para anotar

```
NETLIFY      correo: ________________  contraseña: ________________
SUPABASE     correo: ________________  contraseña: ________________
             contraseña de la base de datos: ________________
             Project URL: https://________________.supabase.co
             Publishable key: sb_publishable_________________
CLOUDFLARE   correo: ________________  contraseña: ________________
             Worker: https://________________.workers.dev
ALMACÉN      correo admin: ________________  contraseña: ________________
DOMINIO      ________________ (dónde se compró: ________________)
```

➡️ Sigue con [Paso 2 · Supabase](2-supabase.md).
