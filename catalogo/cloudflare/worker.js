/**
 * =====================================================================
 *  MOBILIARIO DE OFICINA · Catálogo · Worker "puente" de fotos (Cloudflare R2)
 *
 *  Pega TODO este archivo en Cloudflare > Workers > tu Worker > Edit code.
 *
 *  Necesita (Settings del Worker):
 *   - Binding R2 llamado  BUCKET  (tu bucket de fotos)
 *   - Variable  SUPABASE_URL   = https://xxxx.supabase.co
 *   - Variable  SUPABASE_KEY   = la clave PÚBLICA (publishable / anon)
 *   - (Opcional) ORIGENES = https://tutienda.com,https://tu-sitio.netlify.app
 *       Si la pones, solo esas páginas pueden subir pedidos/fotos.
 *
 *  Qué hace:
 *   GET    /f/<archivo>          Público. Muestra la foto/video/PDF (caché larga).
 *   POST   /subir?carpeta=...    Solo ADMINISTRADOR. Sube un archivo.
 *   GET    /listar?prefijo=...   Solo ADMINISTRADOR. Lista archivos.
 *   DELETE /f/<archivo>          Solo ADMINISTRADOR. Borra un archivo.
 *   POST   /pedido?id=<id>       Público, muy limitado: solo el PDF de un
 *                               pedido (máx. 2 MB) en la carpeta pedidos/.
 *
 *  ¿Quién es administrador? El Worker le pregunta a Supabase con la sesión
 *  del usuario (función es_admin). Así la regla del correo vive en un solo
 *  lugar: la base de datos.
 * =====================================================================
 */

const CARPETAS = ["productos", "portada", "colecciones", "videos", "archivos", "resenas"];
const TIPOS_PERMITIDOS = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};
const MAX_ADMIN = 95 * 1024 * 1024; // 95 MB (límite de Cloudflare gratis: 100 MB)
const MAX_PEDIDO = 2 * 1024 * 1024; // 2 MB

export default {
  async fetch(request, env, ctx) {
    try {
      return await atender(request, env, ctx);
    } catch (e) {
      return json({ error: "Error del servidor: " + (e && e.message ? e.message : String(e)) }, 500, request, env);
    }
  },
};

async function atender(request, env, ctx) {
  const url = new URL(request.url);
  const ruta = url.pathname.replace(/\/+$/, "") || "/";
  const metodo = request.method.toUpperCase();

  if (metodo === "OPTIONS") return new Response(null, { status: 204, headers: cors(request, env) });

  if (!env.BUCKET) {
    return json({ error: "Falta conectar el bucket R2 con el nombre BUCKET (Settings > Bindings)." }, 500, request, env);
  }

  // ---- Público: ver archivos -----------------------------------------
  if ((metodo === "GET" || metodo === "HEAD") && ruta.startsWith("/f/")) {
    return servirArchivo(request, env, ctx, decodeURIComponent(ruta.slice(3)));
  }

  if (metodo === "GET" && ruta === "/") {
    return json({ ok: true, servicio: "fotos del catálogo", bucket: true, supabase: !!env.SUPABASE_URL }, 200, request, env);
  }

  // ---- Público limitado: PDF del pedido -------------------------------
  if (metodo === "POST" && ruta === "/pedido") {
    if (!origenPermitido(request, env)) return json({ error: "Origen no permitido" }, 403, request, env);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      return json({ error: "Id de pedido inválido" }, 400, request, env);
    }
    const largo = Number(request.headers.get("content-length") || 0);
    if (largo > MAX_PEDIDO) return json({ error: "El PDF es muy grande" }, 413, request, env);
    const datos = await request.arrayBuffer();
    if (datos.byteLength === 0 || datos.byteLength > MAX_PEDIDO) return json({ error: "PDF vacío o muy grande" }, 413, request, env);
    const cabecera = new TextDecoder().decode(new Uint8Array(datos.slice(0, 5)));
    if (cabecera !== "%PDF-") return json({ error: "Solo se aceptan PDF" }, 415, request, env);
    const clave = "pedidos/" + id + ".pdf";
    if (await env.BUCKET.head(clave)) return json({ error: "Ese pedido ya tiene PDF" }, 409, request, env);
    await env.BUCKET.put(clave, datos, {
      httpMetadata: {
        contentType: "application/pdf",
        contentDisposition: 'inline; filename="pedido-' + id.slice(0, 8) + '.pdf"',
      },
    });
    return json({ ok: true, clave, url: url.origin + "/f/" + clave }, 200, request, env);
  }

  // ---- Solo administrador --------------------------------------------
  const necesitaAdmin =
    (metodo === "POST" && ruta === "/subir") ||
    (metodo === "GET" && ruta === "/listar") ||
    (metodo === "DELETE" && ruta.startsWith("/f/")) ||
    (metodo === "POST" && ruta === "/borrar");
  if (!necesitaAdmin) return json({ error: "Ruta no encontrada" }, 404, request, env);

  const admin = await esAdministrador(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status, request, env);

  if (metodo === "POST" && ruta === "/subir") {
    const carpeta = (url.searchParams.get("carpeta") || "productos").toLowerCase();
    if (!CARPETAS.includes(carpeta)) return json({ error: "Carpeta no permitida" }, 400, request, env);
    const tipo = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = TIPOS_PERMITIDOS[tipo];
    if (!ext) return json({ error: "Tipo de archivo no permitido: " + (tipo || "desconocido") }, 415, request, env);
    const largo = Number(request.headers.get("content-length") || 0);
    if (largo > MAX_ADMIN) return json({ error: "Archivo muy grande (máx. 95 MB)" }, 413, request, env);
    const nombre = limpiarNombre(url.searchParams.get("nombre") || "archivo");
    const hoy = new Date();
    const mes = hoy.getUTCFullYear() + String(hoy.getUTCMonth() + 1).padStart(2, "0");
    const azar = crypto.randomUUID().slice(0, 8);
    const clave = carpeta + "/" + mes + "/" + azar + "-" + nombre + "." + ext;
    await env.BUCKET.put(clave, request.body, { httpMetadata: { contentType: tipo } });
    return json({ ok: true, clave, url: url.origin + "/f/" + clave, tipo }, 200, request, env);
  }

  if (metodo === "GET" && ruta === "/listar") {
    const prefijo = url.searchParams.get("prefijo") || "";
    const cursor = url.searchParams.get("cursor") || undefined;
    const res = await env.BUCKET.list({ prefix: prefijo, cursor, limit: 500 });
    let total = 0;
    const archivos = res.objects.map((o) => {
      total += o.size;
      return { clave: o.key, url: url.origin + "/f/" + o.key, tamano: o.size, subido: o.uploaded };
    });
    return json({ archivos, total, cursor: res.truncated ? res.cursor : null }, 200, request, env);
  }

  if (metodo === "DELETE" && ruta.startsWith("/f/")) {
    const clave = decodeURIComponent(ruta.slice(3));
    await borrar(env, ctx, url.origin, [clave]);
    return json({ ok: true, borrados: [clave] }, 200, request, env);
  }

  if (metodo === "POST" && ruta === "/borrar") {
    const cuerpo = await request.json().catch(() => ({}));
    const claves = (Array.isArray(cuerpo.claves) ? cuerpo.claves : []).filter((c) => typeof c === "string" && c).slice(0, 1000);
    await borrar(env, ctx, url.origin, claves);
    return json({ ok: true, borrados: claves }, 200, request, env);
  }

  return json({ error: "Ruta no encontrada" }, 404, request, env);
}

async function servirArchivo(request, env, ctx, clave) {
  if (!clave || clave.includes("..")) return new Response("No encontrado", { status: 404, headers: cors(request, env) });
  const cache = caches.default;
  const conRango = request.headers.has("range");
  const llaveCache = new Request(new URL(request.url).origin + "/f/" + encodeURI(clave), { method: "GET" });

  if (!conRango && request.method === "GET") {
    const guardado = await cache.match(llaveCache);
    if (guardado) return guardado;
  }

  const obj = await env.BUCKET.get(clave, conRango ? { range: request.headers } : {});
  if (!obj) return new Response("No encontrado", { status: 404, headers: { ...cors(request, env), "cache-control": "no-store" } });

  const h = new Headers(cors(request, env));
  obj.writeHttpMetadata(h);
  h.set("etag", obj.httpEtag);
  h.set("accept-ranges", "bytes");
  // Los nombres de las fotos nunca se repiten, así que pueden guardarse en caché 1 año.
  // Los PDF de pedidos se borran al atenderlos: caché corta.
  h.set("cache-control", clave.startsWith("pedidos/") ? "public, max-age=600" : "public, max-age=31536000, immutable");
  h.set("x-content-type-options", "nosniff");

  if (conRango && obj.range) {
    const inicio = obj.range.offset || 0;
    const largo = obj.range.length != null ? obj.range.length : obj.size - inicio;
    h.set("content-range", "bytes " + inicio + "-" + (inicio + largo - 1) + "/" + obj.size);
    h.set("content-length", String(largo));
    return new Response(request.method === "HEAD" ? null : obj.body, { status: 206, headers: h });
  }

  h.set("content-length", String(obj.size));
  const respuesta = new Response(request.method === "HEAD" ? null : obj.body, { status: 200, headers: h });
  if (request.method === "GET") ctx.waitUntil(cache.put(llaveCache, respuesta.clone()));
  return respuesta;
}

async function borrar(env, ctx, origen, claves) {
  if (!claves.length) return;
  await env.BUCKET.delete(claves);
  const cache = caches.default;
  ctx.waitUntil(Promise.all(claves.map((c) => cache.delete(new Request(origen + "/f/" + encodeURI(c))))));
}

// --- ¿La sesión pertenece al administrador? -----------------------------
const memoria = new Map(); // token -> { ok, hasta }

async function esAdministrador(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
    return { ok: false, status: 500, error: "Faltan las variables SUPABASE_URL y SUPABASE_KEY en el Worker." };
  }
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.split(".").length !== 3) return { ok: false, status: 401, error: "Inicia sesión como administrador." };

  const ahora = Date.now();
  const previo = memoria.get(token);
  if (previo && previo.hasta > ahora) return previo.ok ? { ok: true } : { ok: false, status: 403, error: "Este correo no es administrador." };

  const res = await fetch(env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/es_admin", {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_KEY,
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: "La sesión venció. Vuelve a entrar al almacén." };
  if (!res.ok) return { ok: false, status: 502, error: "No se pudo verificar la sesión con Supabase (" + res.status + ")." };
  const esAdmin = (await res.json().catch(() => false)) === true;
  if (memoria.size > 200) memoria.clear();
  memoria.set(token, { ok: esAdmin, hasta: ahora + 60_000 });
  return esAdmin ? { ok: true } : { ok: false, status: 403, error: "Este correo no es administrador." };
}

// --- Utilidades ----------------------------------------------------------
function origenPermitido(request, env) {
  const lista = (env.ORIGENES || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  if (!lista.length) return true;
  const origen = request.headers.get("origin") || "";
  return lista.includes(origen);
}

function cors(request, env) {
  const origen = request.headers.get("origin") || "*";
  const lista = (env.ORIGENES || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const permitido = !lista.length ? "*" : lista.includes(origen) ? origen : lista[0];
  return {
    "access-control-allow-origin": permitido,
    "access-control-allow-methods": "GET, HEAD, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, range",
    "access-control-expose-headers": "content-length, content-range, etag",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function json(datos, status, request, env) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { ...cors(request, env), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function limpiarNombre(s) {
  return (
    String(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,5}$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "archivo"
  );
}
