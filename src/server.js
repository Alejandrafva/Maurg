import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import multer from "multer";
import * as store from "./store.js";
import * as files from "./files.js";
import { handleMessage } from "./agent.js";
import { parseInventory, fetchInventory, fetchStoreInfo } from "./importers.js";
import * as meta from "./channels/meta.js";

// En Render la dirección pública viene en RENDER_EXTERNAL_URL.
process.env.PUBLIC_URL ||= process.env.RENDER_EXTERNAL_URL || "";

const app = express();
app.use(express.json({ limit: "25mb", verify: (req, _res, buf) => (req.rawBody = buf) }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

// ---------- Acceso al panel ----------
// Si defines ADMIN_PASSWORD, el panel y la API piden usuario/contraseña (usuario: admin).
function requireAdmin(req, res, next) {
  const pass = process.env.ADMIN_PASSWORD;
  // En un servidor público (Render) no dejamos el panel abierto sin contraseña.
  if (!pass && process.env.RENDER) return res.status(503).send("Configura la variable ADMIN_PASSWORD en Render para usar el panel.");
  if (!pass) return next();
  const [, b64] = (req.get("authorization") || "").split(" ");
  const [, given] = Buffer.from(b64 || "", "base64").toString().split(":");
  const ok = given && given.length === pass.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(pass));
  if (ok) return next();
  res.set("WWW-Authenticate", 'Basic realm="Panel"').status(401).send("Acceso restringido");
}

// Envía una foto guardada (en disco o en Supabase).
const sendStored = (kind) => async (req, res) => {
  try {
    const buf = await files.readFile(kind, req.params.file);
    if (!buf) return res.sendStatus(404);
    res.set("Cache-Control", "public, max-age=86400").type(files.mimeOf(req.params.file)).send(buf);
  } catch (e) {
    console.error("[foto]", e.message);
    res.sendStatus(500);
  }
};

// Fotos de productos: públicas para que Facebook/Instagram puedan descargarlas al enviarlas.
app.get("/media/:file", sendStored("media"));

// Para el "ping" (cron-job.org) que mantiene despierto el servicio gratis de Render.
let lastTouch = 0;
app.get("/salud", (_req, res) => {
  res.send("ok");
  if (Date.now() - lastTouch > 3600_000) {
    lastTouch = Date.now();
    files.touchCloud().catch((e) => console.error("[supabase]", e.message));
  }
});

// ---------- Webhook de Meta (WhatsApp, Facebook, Instagram) ----------
app.get("/webhook/meta", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

const seenMessageIds = new Set();
app.post("/webhook/meta", (req, res) => {
  if (!meta.verifySignature(req)) return res.sendStatus(401);
  res.sendStatus(200); // Meta exige responder rápido; procesamos después.
  for (const msg of meta.parseWebhook(req.body)) {
    if (seenMessageIds.has(msg.messageId)) continue; // Meta a veces reenvía el mismo evento
    seenMessageIds.add(msg.messageId);
    if (seenMessageIds.size > 5000) seenMessageIds.delete(seenMessageIds.values().next().value);
    enqueue(`${msg.channel}:${msg.userId}`, () => processIncoming(msg));
  }
});

// Procesa los mensajes de un mismo cliente en orden, uno a la vez.
const queues = new Map();
function enqueue(key, job) {
  const next = (queues.get(key) || Promise.resolve()).then(job).catch((e) => console.error(`[${key}]`, e));
  queues.set(key, next);
  next.finally(() => queues.get(key) === next && queues.delete(key));
  return next;
}

async function processIncoming(msg) {
  const conv = store.getConversation(msg.channel, msg.userId);
  if (msg.name && !conv.name) conv.name = msg.name;
  const images = await meta.fetchImages(msg);
  const savedImages = await Promise.all(images.map(saveCustomerImage));
  store.appendMessage(conv, "customer", msg.text || (images.length ? "[foto]" : ""), { images: savedImages });

  if (!conv.botEnabled) return; // una persona está atendiendo esta conversación

  const { replies, handoff } = await respond(conv, { text: msg.text, images });
  for (const r of replies) {
    try {
      await meta.sendReply(msg, r);
    } catch (e) {
      console.error(`[${msg.channel}] error al enviar:`, e.message);
    }
  }
  if (handoff) console.log(`[HUMANO] ${conv.key} (${conv.name}): ${handoff}`);
}

// Fotos que mandan los clientes: privadas, solo visibles desde el panel.
async function saveCustomerImage(img) {
  const ext = { "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[img.mediaType] || ".jpg";
  const name = `cliente-${store.newId()}${ext}`;
  await files.saveFile("customer", name, Buffer.from(img.data, "base64"));
  return name;
}

// El mensaje del cliente ya está guardado en conv; la IA recibe el historial anterior + el mensaje nuevo.
async function respond(conv, incoming) {
  let result;
  try {
    result = await handleMessage(conv.messages.slice(0, -1), incoming);
  } catch (e) {
    console.error("[IA]", e);
    result = { replies: [{ type: "text", text: "Disculpa, tuve un problema para responder. Ya te atiende una persona 🙏" }], handoff: `Error de la IA: ${e.message}` };
  }
  for (const r of result.replies) {
    store.appendMessage(conv, "assistant", r.type === "text" ? r.text : `[foto: ${r.caption}]`, r.type === "image" ? { images: [r.file] } : {});
  }
  if (result.handoff) store.updateConversation(conv.key, { needsHuman: true, handoffReason: result.handoff });
  return result;
}

// ---------- API del panel ----------
const api = express.Router();
api.use(requireAdmin);

api.get("/status", (_req, res) =>
  res.json({ ai: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN), channels: meta.channelStatus(), products: store.listProducts().length }),
);

api.get("/settings", (_req, res) => res.json(store.getSettings()));
api.put("/settings", (req, res) => {
  const allowed = ["businessName", "contactEmail", "currency", "tone", "language", "knowledge", "faqs", "inventorySourceUrl", "inventorySyncMinutes"];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ("inventorySourceUrl" in patch && patch.inventorySourceUrl !== store.getSettings().inventorySourceUrl) patch.lastSourceHash = "";
  const s = store.updateSettings(patch);
  scheduleSync();
  res.json(s);
});

api.get("/products", (_req, res) => res.json(store.listProducts()));
api.post("/products", (req, res) => res.json(store.upsertProduct({ ...req.body, id: undefined })));
api.put("/products/:id", (req, res) => {
  if (!store.getProduct(req.params.id)) return res.sendStatus(404);
  const { photos, ...rest } = req.body;
  res.json(store.upsertProduct({ ...rest, id: req.params.id }));
});
api.delete("/products/:id", (req, res) => res.sendStatus(store.deleteProduct(req.params.id) ? 204 : 404));

async function savePhoto(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new Error(`${file.originalname}: solo se aceptan imágenes JPG, PNG, WEBP o GIF`);
  const name = `${store.newId()}${ext === ".jpeg" ? ".jpg" : ext}`;
  await files.saveFile("media", name, file.buffer);
  return name;
}

api.post("/products/:id/photos", upload.array("photos", 20), async (req, res) => {
  const p = store.getProduct(req.params.id);
  if (!p) return res.sendStatus(404);
  try {
    for (const f of req.files || []) store.addPhoto(p.id, await savePhoto(f));
    res.json(store.getProduct(p.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
api.delete("/products/:id/photos/:file", (req, res) => {
  const p = store.removePhoto(req.params.id, req.params.file);
  p ? res.json(p) : res.sendStatus(404);
});

// Fotos en lote: el nombre del archivo indica el producto (SKU, modelo o nombre), p. ej. "ZAP-042.jpg" o "ZAP-042_2.jpg".
api.post("/photos/bulk", upload.array("photos", 200), async (req, res) => {
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const products = store.listProducts();
  const matched = [];
  const unmatched = [];
  for (const f of req.files || []) {
    const base = fold(path.basename(f.originalname, path.extname(f.originalname)).replace(/[_ -]\d{1,2}$/, ""));
    const p =
      products.find((x) => x.sku && fold(x.sku) === base) ||
      products.find((x) => x.model && fold(x.model) === base) ||
      products.find((x) => fold(`${x.name}${x.model}`) === base || fold(x.name) === base);
    if (!p) {
      unmatched.push(f.originalname);
      continue;
    }
    try {
      store.addPhoto(p.id, await savePhoto(f));
      matched.push({ file: f.originalname, product: p.name });
    } catch {
      unmatched.push(f.originalname);
    }
  }
  res.json({ matched, unmatched });
});

api.post("/inventory/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Falta el archivo" });
  try {
    const items = await parseInventory(req.file.buffer, req.file.originalname, req.file.mimetype);
    const { pendingPhotos, ...r } = store.importProducts(items, { replace: req.body.replace === "true" });
    res.json({ ...r, read: items.length, photos: await downloadPhotos(pendingPhotos) });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

// Descarga las fotos de los productos que vienen de tu página / Excel con links de imágenes.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const EXT_BY_TYPE = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
async function downloadPhotos(pending) {
  let ok = 0;
  for (const { productId, url } of pending.slice(0, 1000)) {
    try {
      const res = await fetch(url);
      const type = (res.headers.get("content-type") || "").split(";")[0];
      if (!res.ok || !EXT_BY_TYPE[type]) throw new Error(`${res.status} ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_PHOTO_BYTES) throw new Error("foto demasiado grande");
      const name = `${store.newId()}${EXT_BY_TYPE[type]}`;
      await files.saveFile("media", name, buf);
      store.addPhoto(productId, name, url);
      ok++;
    } catch (e) {
      console.error(`[fotos] ${url}: ${e.message}`);
    }
  }
  return { downloaded: ok, failed: pending.length - ok };
}

let syncing = null;
function syncFromSource(opts) {
  // Si ya hay una sincronización en curso, se reutiliza en vez de empezar otra.
  syncing ??= runSync(opts).finally(() => (syncing = null));
  return syncing;
}

async function runSync({ force = false } = {}) {
  const { inventorySourceUrl, lastSourceHash } = store.getSettings();
  if (!inventorySourceUrl) throw new Error("No hay una URL de inventario configurada");
  const headers = process.env.INVENTORY_SOURCE_AUTH ? { Authorization: process.env.INVENTORY_SOURCE_AUTH } : {};
  if (/supabase:/i.test(inventorySourceUrl)) {
    // Además de los productos, los datos de la tienda (pagos, envíos, ubicación).
    const info = await fetchStoreInfo().catch((e) => console.error("[config]", e.message));
    if (info?.text) {
      const patch = { storeInfo: info.text };
      if (info.name && store.getSettings().businessName === "Mi Tienda") patch.businessName = info.name;
      store.updateSettings(patch);
    }
  }
  const result = await fetchInventory(inventorySourceUrl, headers, force ? "" : lastSourceHash);
  store.updateSettings({ lastSyncAt: Date.now() });
  if (result.unchanged) return { unchanged: true, total: store.listProducts().length };
  if (!result.products.length) throw new Error("No se encontraron productos en esa dirección");
  const { pendingPhotos, ...r } = store.importProducts(result.products, { replace: true });
  store.updateSettings({ lastSourceHash: result.hash });
  return { ...r, read: result.products.length, photos: await downloadPhotos(pendingPhotos) };
}

api.post("/inventory/sync", async (_req, res) => {
  try {
    res.json(await syncFromSource({ force: true }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

let syncTimer;
function scheduleSync() {
  clearInterval(syncTimer);
  const { inventorySourceUrl, inventorySyncMinutes } = store.getSettings();
  const minutes = Number(inventorySyncMinutes);
  if (!inventorySourceUrl || !minutes || minutes < 1) return;
  syncTimer = setInterval(() => syncFromSource().then((r) => console.log("[sync]", r)).catch((e) => console.error("[sync]", e.message)), minutes * 60_000);
}

// Chat de prueba: para entrenar y probar la IA antes de conectarla a las redes.
api.post("/chat/test", async (req, res) => {
  const conv = store.getConversation("prueba", "panel");
  conv.botEnabled = true;
  const images = req.body.image ? [{ data: req.body.image.data, mediaType: req.body.image.mediaType }] : [];
  store.appendMessage(conv, "customer", req.body.text || (images.length ? "[foto]" : ""), { images: await Promise.all(images.map(saveCustomerImage)) });
  const { replies, handoff } = await respond(conv, { text: req.body.text, images });
  res.json({ replies: replies.map((r) => (r.type === "image" ? { ...r, url: files.isUrl(r.file) ? r.file : `/media/${r.file}` } : r)), handoff });
});
api.post("/chat/test/reset", (_req, res) => {
  store.updateConversation("prueba:panel", { messages: [], needsHuman: false });
  res.sendStatus(204);
});

api.get("/customer-media/:file", sendStored("customer"));
api.get("/conversations", (_req, res) => res.json(store.listConversations()));
api.get("/conversations/:key", (req, res) => {
  const c = store.getConversationByKey(req.params.key);
  c ? res.json(c) : res.sendStatus(404);
});
api.patch("/conversations/:key", (req, res) => {
  const { botEnabled, needsHuman } = req.body;
  const patch = {};
  if (typeof botEnabled === "boolean") patch.botEnabled = botEnabled;
  if (typeof needsHuman === "boolean") patch.needsHuman = needsHuman;
  const c = store.updateConversation(req.params.key, patch);
  c ? res.json(c) : res.sendStatus(404);
});
api.delete("/conversations/:key", (req, res) => res.sendStatus(store.deleteConversation(req.params.key) ? 204 : 404));
// El dueño responde a mano desde el panel.
api.post("/conversations/:key/send", async (req, res) => {
  const c = store.getConversationByKey(req.params.key);
  if (!c) return res.sendStatus(404);
  try {
    if (c.channel !== "prueba") await meta.sendReply({ channel: c.channel, userId: c.userId }, { type: "text", text: req.body.text });
    store.appendMessage(c, "owner", req.body.text);
    res.json(c);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- Páginas públicas que Meta exige para aprobar la app ----------
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function legalPage(title, body) {
  const { businessName, contactEmail } = store.getSettings();
  const name = escapeHtml(businessName);
  const email = escapeHtml(contactEmail || process.env.CONTACT_EMAIL || "");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - ${name}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px;color:#1c1f24;background:#fff}h1{font-size:24px}h2{font-size:18px;margin-top:28px}</style></head>
<body><h1>${title}</h1>${body.replaceAll("{NEGOCIO}", name).replaceAll("{EMAIL}", email ? `<a href="mailto:${email}">${email}</a>` : "nuestros canales de atención")}
<p style="color:#6b7280;margin-top:40px">Última actualización: ${new Date().toISOString().slice(0, 10)}</p></body></html>`;
}

app.get("/privacidad", (_req, res) =>
  res.send(
    legalPage(
      "Política de privacidad",
      `<p>{NEGOCIO} usa un asistente automático para responder los mensajes que nos envías por WhatsApp, Instagram y Facebook Messenger.</p>
<h2>Qué datos recibimos</h2><p>Tu nombre o usuario público, tu identificador en la plataforma (por ejemplo, tu número de WhatsApp), los mensajes que nos escribes y las fotos que nos envías.</p>
<h2>Para qué los usamos</h2><p>Solo para responder tus consultas sobre nuestros productos, precios, disponibilidad y pedidos. No vendemos ni compartimos tus datos con terceros para publicidad.</p>
<h2>Con quién se comparten</h2><p>Los mensajes se procesan con un proveedor de inteligencia artificial (Anthropic) únicamente para generar la respuesta, y se transmiten a través de Meta (WhatsApp, Instagram, Facebook) según sus propias políticas.</p>
<h2>Cuánto tiempo los guardamos</h2><p>Guardamos el historial de conversación mientras sea necesario para atenderte. Puedes pedir que lo borremos en cualquier momento.</p>
<h2>Tus derechos</h2><p>Puedes pedir acceso, corrección o eliminación de tus datos escribiéndonos a {EMAIL}. Ver también <a href="/eliminar-datos">cómo eliminar tus datos</a>.</p>`,
    ),
  ),
);

app.get("/eliminar-datos", (_req, res) =>
  res.send(
    legalPage(
      "Eliminación de datos",
      `<p>Para eliminar tus conversaciones y datos guardados por {NEGOCIO}:</p>
<ol><li>Escríbenos por el mismo chat (WhatsApp, Instagram o Facebook) el mensaje <b>"borrar mis datos"</b>, o envía un correo a {EMAIL} indicando tu usuario o número.</li>
<li>Eliminaremos tu historial de conversación y las fotos que nos enviaste en un plazo máximo de 30 días y te confirmaremos por el mismo medio.</li></ol>`,
    ),
  ),
);

app.use("/api", api);
app.use("/", requireAdmin, express.static(path.resolve("public")));

// Antes de atender, cargar los datos (desde Supabase si está configurado).
await files.initCloud();
await store.init();
console.log(files.cloudEnabled ? "Datos guardados en Supabase" : `Datos guardados en ${store.DATA_DIR}`);
// Primera vez con una fuente configurada (p. ej. INVENTORY_SOURCE=supabase:productos): cargar el catálogo ya.
if (store.getSettings().inventorySourceUrl && !store.listProducts().length) {
  syncFromSource({ force: true })
    .then((r) => console.log("[sync inicial]", r))
    .catch((e) => console.error("[sync inicial]", e.message));
}

// Render/servidor apagándose: guardar lo pendiente antes de salir.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    await store.flush();
    process.exit(0);
  });
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Panel listo en http://localhost:${PORT}`);
  console.log(`Webhook de Meta: ${process.env.PUBLIC_URL || "https://TU-DOMINIO"}/webhook/meta`);
  scheduleSync();
});
