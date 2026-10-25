// Dónde se guardan los datos y las fotos.
// - Sin configurar nada: en la carpeta DATA_DIR del servidor (sirve para un VPS con disco propio).
// - Con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: en Supabase Storage (gratis). Es lo que hay que usar
//   en Render gratis, porque Render borra el disco cada vez que el servicio se reinicia.
//   El disco local queda como caché para no descargar la misma foto muchas veces.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const DIRS = { media: path.join(DATA_DIR, "uploads"), customer: path.join(DATA_DIR, "customer-media") };
for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });

const BUCKET = process.env.SUPABASE_BUCKET || "vendedor";
const STATE_PATH = "state/db.json";
export const cloudEnabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let sb = null;
export function cloud() {
  sb ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return sb;
}

// Crea el "bucket" privado la primera vez.
export async function initCloud() {
  if (!cloudEnabled) return;
  const { error } = await cloud().storage.getBucket(BUCKET);
  if (!error) return;
  const created = await cloud().storage.createBucket(BUCKET, { public: false });
  if (created.error && !/exist/i.test(created.error.message)) throw new Error(`Supabase: ${created.error.message}`);
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".json": "application/json" };
export const mimeOf = (file) => MIME[path.extname(file).toLowerCase()] || "image/jpeg";

const localPath = (kind, name) => path.join(DIRS[kind], path.basename(name));
const cloudPath = (kind, name) => `${kind}/${path.basename(name)}`;

async function upload(objectPath, body, contentType) {
  const { error } = await cloud().storage.from(BUCKET).upload(objectPath, body, { contentType, upsert: true });
  if (error) throw new Error(`Supabase (subir ${objectPath}): ${error.message}`);
}

async function download(objectPath) {
  const { data, error } = await cloud().storage.from(BUCKET).download(objectPath);
  if (error) return null; // no existe
  return Buffer.from(await data.arrayBuffer());
}

/** kind: "media" (fotos de productos) o "customer" (fotos que mandan los clientes) */
export async function saveFile(kind, name, buffer) {
  fs.writeFileSync(localPath(kind, name), buffer);
  if (cloudEnabled) await upload(cloudPath(kind, name), buffer, mimeOf(name));
}

export async function readFile(kind, name) {
  const file = localPath(kind, name);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (!cloudEnabled) return null;
  const buf = await download(cloudPath(kind, name));
  if (buf) fs.writeFileSync(file, buf); // guardar en caché
  return buf;
}

// Una "foto" puede ser un archivo guardado o una URL externa (p. ej. fotos de tu tienda en Shopify).
export const isUrl = (name) => /^https?:\/\//i.test(String(name));

export function removeFile(kind, name) {
  if (isUrl(name)) return; // las fotos externas no se borran de su sitio
  fs.rm(localPath(kind, name), { force: true }, () => {});
  if (cloudEnabled) {
    cloud()
      .storage.from(BUCKET)
      .remove([cloudPath(kind, name)])
      .then(({ error }) => error && console.error("[supabase] borrar:", error.message));
  }
}

// ---------- Estado (productos, entrenamiento, conversaciones) ----------
const STATE_FILE = path.join(DATA_DIR, "db.json");

export async function loadState() {
  if (cloudEnabled) {
    const buf = await download(STATE_PATH);
    return buf ? JSON.parse(buf.toString("utf8")) : null;
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

export async function saveState(json) {
  if (cloudEnabled) return upload(STATE_PATH, Buffer.from(json), "application/json");
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, STATE_FILE);
}

// Una consulta mínima para que Supabase vea actividad y no pause el proyecto gratis.
export async function touchCloud() {
  if (!cloudEnabled) return;
  await cloud().storage.from(BUCKET).list("state", { limit: 1 });
}
