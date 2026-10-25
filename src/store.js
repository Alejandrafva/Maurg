// Datos del negocio en memoria, guardados como un JSON (en disco o en Supabase, ver files.js).
// Suficiente para un negocio pequeño/mediano; se puede cambiar por una base de datos real después.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, cloudEnabled, loadState, saveState, removeFile } from "./files.js";

export { DATA_DIR };

const DEFAULT_DB = {
  settings: {
    businessName: "Mi Tienda",
    currency: "USD",
    tone: "amable, cercano y breve, como un buen vendedor por WhatsApp",
    language: "español",
    // "Entrenamiento": todo lo que el asistente debe saber del negocio.
    knowledge: "",
    // Preguntas frecuentes que el dueño quiere responder siempre igual.
    faqs: [],
    // Se pueden fijar desde el entorno (p. ej. en Render): INVENTORY_SOURCE=supabase:productos
    inventorySourceUrl: process.env.INVENTORY_SOURCE || "",
    inventorySyncMinutes: Number(process.env.INVENTORY_SYNC_MINUTES || 0),
    // Datos de la tienda leídos automáticamente de la fuente (pagos, envíos...). No se editan a mano.
    storeInfo: "",
  },
  products: [],
  conversations: {},
};

const withDefaults = (raw) => ({ ...DEFAULT_DB, ...raw, settings: { ...DEFAULT_DB.settings, ...raw.settings } });

// En disco se lee al arrancar; en Supabase hay que llamar a init() antes de usar los datos.
let db = structuredClone(DEFAULT_DB);
if (!cloudEnabled) {
  try {
    db = withDefaults(JSON.parse(fs.readFileSync(path.join(DATA_DIR, "db.json"), "utf8")));
  } catch {}
}

export async function init() {
  if (!cloudEnabled) return;
  const raw = await loadState();
  if (raw) db = withDefaults(raw);
}

// Guardado agrupado: muchos cambios seguidos se escriben una sola vez.
let saveTimer = null;
let writing = Promise.resolve();
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, cloudEnabled ? 1500 : 50);
}

export function flush() {
  clearTimeout(saveTimer);
  const json = JSON.stringify(db);
  writing = writing.then(() => saveState(json)).catch((e) => console.error("[guardar]", e.message));
  return writing;
}

export const newId = () => crypto.randomBytes(6).toString("hex");

// ---------- Ajustes / entrenamiento ----------
export const getSettings = () => db.settings;
export function updateSettings(patch) {
  db.settings = { ...db.settings, ...patch };
  save();
  return db.settings;
}

// ---------- Productos ----------
export const listProducts = () => db.products;
export const getProduct = (id) => db.products.find((p) => p.id === id);

// Acepta "1299", "$1.299,90", "1,299.90", "12,5"...
export function parsePrice(v) {
  if (v === "" || v == null) return null;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^0-9.,-]/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot > -1 && lastComma > -1) {
    // El separador que aparece último es el decimal.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // "1,299" (miles) vs "12,5" (decimal)
    s = /,\d{3}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.299" o "1.299.000" como miles
  }
  const n = Number(s);
  return Number.isFinite(n) && s !== "" ? n : null;
}

export function normalizeProduct(p) {
  return {
    id: p.id || newId(),
    name: String(p.name ?? "").trim(),
    model: String(p.model ?? "").trim(),
    sku: String(p.sku ?? "").trim(),
    category: String(p.category ?? "").trim(),
    price: parsePrice(p.price),
    stock: p.stock === "" || p.stock == null || Number.isNaN(parseInt(p.stock, 10)) ? null : parseInt(p.stock, 10),
    description: String(p.description ?? "").trim(),
    attributes: p.attributes && typeof p.attributes === "object" ? p.attributes : {},
    photos: Array.isArray(p.photos) ? p.photos : [],
    // URL de origen -> archivo descargado, para no bajar dos veces la misma foto
    photoSources: p.photoSources && typeof p.photoSources === "object" ? p.photoSources : {},
  };
}

export function upsertProduct(input) {
  const existing = input.id && getProduct(input.id);
  const merged = normalizeProduct({ ...(existing || {}), ...input });
  if (existing) Object.assign(existing, merged);
  else db.products.push(merged);
  save();
  return existing || merged;
}

export function deleteProduct(id) {
  const p = getProduct(id);
  if (!p) return false;
  for (const photo of p.photos) removeFile("media", photo);
  db.products = db.products.filter((x) => x.id !== id);
  save();
  return true;
}

// Importa una lista de productos. Si un producto ya existe (mismo SKU, o mismo nombre+modelo)
// se actualiza conservando sus fotos; si no, se crea.
// Devuelve en `pendingPhotos` las fotos (URLs) que todavía hay que descargar.
export function importProducts(items, { replace = false } = {}) {
  const key = (p) => (p.sku ? `sku:${p.sku.toLowerCase()}` : `nm:${p.name.toLowerCase()}|${p.model.toLowerCase()}`);
  const byKey = new Map(db.products.map((p) => [key(p), p]));
  const seen = new Set();
  let created = 0;
  let updated = 0;
  const pendingPhotos = [];
  for (const raw of items) {
    const p = normalizeProduct(raw);
    if (!p.name) continue;
    let target = byKey.get(key(p));
    if (target) {
      // Solo se actualizan los datos que vienen llenos: así puedes combinar fuentes
      // (p. ej. tu página da precios y fotos, y un Excel da el stock) sin que una borre a la otra.
      for (const f of ["name", "model", "sku", "category", "price", "stock", "description"]) {
        if (p[f] !== null && p[f] !== "") target[f] = p[f];
      }
      target.attributes = { ...target.attributes, ...p.attributes };
      updated++;
    } else {
      target = p;
      db.products.push(p);
      byKey.set(key(p), p);
      created++;
    }
    seen.add(target.id);
    // Fotos por URL que vienen de la fuente (p. ej. tu tabla de Supabase): se usan tal cual, sin descargarlas.
    if (Array.isArray(raw.photoUrls)) {
      target.photos = [...target.photos.filter((f) => !/^https?:\/\//i.test(f)), ...raw.photoUrls];
    }
    for (const url of raw.imageUrls || []) {
      if (!target.photoSources[url]) pendingPhotos.push({ productId: target.id, url });
    }
  }
  let removed = 0;
  if (replace) {
    const before = db.products.length;
    db.products = db.products.filter((p) => seen.has(p.id));
    removed = before - db.products.length;
  }
  save();
  return { created, updated, removed, total: db.products.length, pendingPhotos };
}

export function addPhoto(productId, filename, sourceUrl) {
  const p = getProduct(productId);
  if (!p) return null;
  p.photos.push(filename);
  if (sourceUrl) p.photoSources[sourceUrl] = filename;
  save();
  return p;
}

export function removePhoto(productId, filename) {
  const p = getProduct(productId);
  if (!p) return null;
  p.photos = p.photos.filter((f) => f !== filename);
  // Si la foto vino de tu página, la recordamos como "ya descargada" para que no vuelva a bajarse.
  for (const [url, f] of Object.entries(p.photoSources)) if (f === filename) p.photoSources[url] = "(borrada)";
  removeFile("media", filename);
  save();
  return p;
}

// Búsqueda por palabras (sin acentos, tolerante a mayúsculas).
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function searchProducts(query, limit = 8) {
  const terms = fold(query).split(/[^a-z0-9ñ]+/).filter((t) => t.length > 1);
  if (!terms.length) return db.products.slice(0, limit);
  const scored = db.products
    .map((p) => {
      const hay = fold([p.name, p.model, p.sku, p.category, p.description, ...Object.values(p.attributes)].join(" "));
      const name = fold(`${p.name} ${p.model} ${p.sku}`);
      let score = 0;
      for (const t of terms) {
        if (name.includes(t)) score += 3;
        else if (hay.includes(t)) score += 1;
        else if (t.length > 3 && hay.includes(t.slice(0, -1))) score += 0.5; // plurales simples
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}

// ---------- Conversaciones ----------
// Clave: "<canal>:<id del cliente>". Guardamos el historial en texto para darle contexto a la IA.
export function getConversation(channel, userId) {
  const key = `${channel}:${userId}`;
  if (!db.conversations[key]) {
    db.conversations[key] = { key, channel, userId, name: "", botEnabled: true, needsHuman: false, messages: [], updatedAt: Date.now() };
  }
  return db.conversations[key];
}

export function appendMessage(conv, role, text, extra = {}) {
  conv.messages.push({ role, text, at: Date.now(), ...extra });
  if (conv.messages.length > 200) conv.messages = conv.messages.slice(-200);
  conv.updatedAt = Date.now();
  save();
}

export function updateConversation(key, patch) {
  const c = db.conversations[key];
  if (!c) return null;
  Object.assign(c, patch);
  save();
  return c;
}

export const listConversations = () =>
  Object.values(db.conversations)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ messages, ...c }) => ({ ...c, last: messages.at(-1) }));

export const getConversationByKey = (key) => db.conversations[key];

// Borra la conversación y las fotos que envió el cliente (derecho a eliminar sus datos).
export function deleteConversation(key) {
  const c = db.conversations[key];
  if (!c) return false;
  for (const m of c.messages) {
    if (m.role !== "customer") continue;
    for (const f of m.images || []) removeFile("customer", f);
  }
  delete db.conversations[key];
  save();
  return true;
}
