// Convierte un archivo de inventario (Excel, CSV, JSON, PDF) o una URL en una lista de productos.
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { createMessage, textOf } from "./claude.js";
import { cloud, cloudEnabled } from "./files.js";

// Nombres de columna que reconocemos (en minúsculas y sin acentos).
const COLUMN_ALIASES = {
  name: ["nombre", "producto", "articulo", "name", "product", "titulo", "title", "descripcion corta"],
  model: ["modelo", "model", "referencia", "ref", "variante", "version"],
  sku: ["sku", "codigo", "cod", "code", "id", "barcode", "codigo de barras", "ean"],
  category: ["categoria", "category", "tipo", "linea", "familia", "rubro"],
  price: ["precio", "price", "pvp", "precio venta", "precio de venta", "valor", "costo venta", "importe"],
  stock: ["stock", "cantidad", "existencia", "existencias", "inventario", "qty", "quantity", "disponible", "unidades"],
  description: ["descripcion", "description", "detalle", "detalles", "caracteristicas", "notas"],
  image: ["imagen", "imagenes", "image", "images", "img", "foto", "fotos", "photo", "photos", "url imagen", "imagen url"],
};

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function mapColumns(headers) {
  const map = {};
  for (const h of headers) {
    const f = fold(h);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[field]) continue;
      if (aliases.includes(f)) {
        map[field] = h;
        break;
      }
    }
  }
  // Segunda pasada: coincidencias parciales ("Precio USD", "Stock bodega"...)
  for (const h of headers) {
    if (Object.values(map).includes(h)) continue;
    const f = fold(h);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (!map[field] && aliases.some((a) => a.length > 3 && f.startsWith(a))) {
        map[field] = h;
        break;
      }
    }
  }
  return map;
}

export function rowsToProducts(rows, baseUrl = "") {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const map = mapColumns(headers);
  if (!map.name && !map.model) return null; // no se reconocen columnas -> usar IA
  const used = new Set(Object.values(map));
  return rows.map((r) => {
    const attributes = {};
    for (const h of headers) if (!used.has(h) && r[h] !== "" && r[h] != null) attributes[h] = String(r[h]);
    const get = (f) => (map[f] ? r[map[f]] : "");
    return {
      name: get("name") || get("model"),
      model: map.name ? get("model") : "",
      sku: get("sku"),
      category: get("category"),
      price: get("price"),
      stock: get("stock"),
      description: get("description"),
      imageUrls: String(get("image") || "")
        .split(/[\s,;|]+/)
        .filter(Boolean)
        .map((u) => abs(u, baseUrl))
        .filter((u) => /^https?:\/\//.test(u)),
      attributes,
    };
  });
}

function sheetRows(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const rows = [];
  for (const name of wb.SheetNames) {
    rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: false }));
  }
  return rows;
}

const PRODUCT_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          model: { type: "string" },
          sku: { type: "string" },
          category: { type: "string" },
          price: { type: ["number", "null"] },
          stock: { type: ["integer", "null"] },
          description: { type: "string" },
          image_urls: {
            type: "array",
            description: "URLs completas de las fotos de este producto (solo si aparecen en el documento)",
            items: { type: "string" },
          },
          attributes: {
            type: "array",
            description: "Otras características: color, talla, material, medidas, garantía, etc.",
            items: {
              type: "object",
              properties: { key: { type: "string" }, value: { type: "string" } },
              required: ["key", "value"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "model", "sku", "category", "price", "stock", "description", "image_urls", "attributes"],
        additionalProperties: false,
      },
    },
  },
  required: ["products"],
  additionalProperties: false,
};

const EXTRACT_PROMPT = `Extrae TODOS los productos de este inventario/catálogo.
Para cada producto: nombre, modelo, SKU o código, categoría, precio (número, sin símbolo de moneda), stock (número de unidades, null si no aparece), una descripción breve y las demás características (color, talla, material, etc.).
Si el documento incluye fotos de productos (etiquetas <img> o URLs de imágenes), pon en image_urls las URLs completas de las fotos de cada producto; si no, deja la lista vacía.
Usa cadena vacía "" para los campos de texto que no aparezcan. No inventes datos.`;

// Usa Claude para leer documentos sin un formato fijo (PDF, tablas con columnas raras, texto libre).
// baseUrl sirve para completar las rutas relativas de las fotos (img/x.jpg -> https://sitio/img/x.jpg).
export async function extractWithAI(content, baseUrl = "") {
  const msg = await createMessage({
    stream: true,
    output_config: { effort: "low", format: { type: "json_schema", schema: PRODUCT_SCHEMA } },
    messages: [{ role: "user", content: [...content, { type: "text", text: EXTRACT_PROMPT }] }],
  });
  const data = JSON.parse(textOf(msg));
  return data.products.map(({ attributes, image_urls, ...p }) => ({
    ...p,
    imageUrls: (image_urls || []).map((u) => abs(u, baseUrl)).filter((u) => /^https?:\/\//.test(u)),
    attributes: Object.fromEntries((attributes || []).map((a) => [a.key, a.value])),
  }));
}

// baseUrl: dirección de donde vino el archivo (para completar los links relativos de las fotos).
export async function parseInventory(buffer, filename = "", mimetype = "", baseUrl = "") {
  const ext = fold(filename).split(".").pop();

  if (ext === "pdf" || mimetype === "application/pdf") {
    return extractWithAI([
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
    ]);
  }

  if (ext === "json" || mimetype.includes("json")) {
    const data = JSON.parse(buffer.toString("utf8"));
    const list = Array.isArray(data) ? data : data.products || data.items || data.data || [];
    return rowsToProducts(list.map(flatten), baseUrl) ?? extractWithAI([{ type: "text", text: JSON.stringify(list).slice(0, 400000) }]);
  }

  if (["xlsx", "xls", "xlsm", "ods", "csv", "tsv"].includes(ext) || /sheet|excel|csv/.test(mimetype)) {
    const rows = sheetRows(buffer);
    const products = rowsToProducts(rows, baseUrl);
    if (products) return products;
    // Columnas no reconocidas: que la IA lo interprete.
    const wb = XLSX.read(buffer, { type: "buffer" });
    const csv = wb.SheetNames.map((n) => `# Hoja: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n\n");
    return extractWithAI([{ type: "text", text: csv }]);
  }

  if (["html", "htm"].includes(ext) || mimetype.startsWith("text/html")) {
    return extractFromHtml(buffer.toString("utf8"), baseUrl);
  }

  if (["txt", "md"].includes(ext) || mimetype.startsWith("text/")) {
    return extractWithAI([{ type: "text", text: buffer.toString("utf8") }]);
  }

  throw new Error(`Formato no soportado: ${filename || mimetype}. Usa Excel, CSV, JSON, PDF o TXT.`);
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, `${prefix}${k} `, out);
    else out[`${prefix}${k}`] = Array.isArray(v) ? v.join(", ") : v;
  }
  return out;
}

// ---------- Páginas web (HTML) ----------
// Lee una página HTML (por ejemplo tu catálogo en Netlify) y extrae productos, precios y fotos.
// Si los productos se cargan desde un archivo .js o .json de la misma página, también se leen.
const LIB_SCRIPT = /jquery|bootstrap|analytics|gtag|googletagmanager|facebook|fbevents|cdn|polyfill|swiper|slick|fontawesome|tailwind/i;
const MAX_TEXT = 600_000;

const abs = (u, base) => {
  try {
    return base ? new URL(u, base).href : u;
  } catch {
    return u;
  }
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al leer ${url}`);
  return res.text();
}

export function cleanHtml(html, baseUrl = "") {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/\s(class|style)="[^"]*"/gi, "")
    .replace(/\s(src|data-src|href|data-image|data-img)=("|')([^"']+)\2/gi, (_m, attr, q, url) => ` ${attr}=${q}${abs(url, baseUrl)}${q}`)
    .replace(/\s+/g, " ");
}

// Archivos .js/.json del mismo sitio que pueden tener la lista de productos.
async function relatedDataFiles(html, baseUrl) {
  if (!baseUrl) return [];
  const origin = new URL(baseUrl).origin;
  const urls = new Set();
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) urls.add(abs(m[1], baseUrl));
  for (const m of html.matchAll(/["']([^"'\s]+\.json)["']/gi)) urls.add(abs(m[1], baseUrl));
  const files = [];
  for (const url of urls) {
    if (!url.startsWith(origin) || LIB_SCRIPT.test(url) || /\.min\.js/.test(url)) continue;
    try {
      const text = await fetchText(url);
      files.push({ url, text });
      // Un .js puede a su vez cargar un .json (fetch("productos.json"))
      for (const m of text.matchAll(/["'`]([^"'`\s]+\.json)["'`]/g)) {
        const j = abs(m[1], url);
        if (j.startsWith(origin) && !urls.has(j) && !files.some((f) => f.url === j)) {
          files.push({ url: j, text: await fetchText(j).catch(() => "") });
        }
      }
    } catch (e) {
      console.error("[html]", e.message);
    }
  }
  return files.filter((f) => f.text);
}

export async function extractFromHtml(html, baseUrl = "", extraFiles) {
  const files = extraFiles ?? (await relatedDataFiles(html, baseUrl));
  let text = `Página: ${baseUrl || "(archivo subido)"}\n${cleanHtml(html, baseUrl)}`;
  for (const f of files) text += `\n\n--- Archivo ${f.url} (las rutas de imágenes son relativas a ${f.url}) ---\n${f.text}`;
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
  return extractWithAI([{ type: "text", text }], baseUrl);
}

// "Conectar el almacén": la dirección de tu página web, un Google Sheet, un CSV/Excel publicado
// o un endpoint JSON de tu sistema de inventario. Se pueden poner varias (una por línea).
export function normalizeSourceUrl(url) {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (m && !url.includes("/export")) {
    const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
  }
  return url;
}

export const splitUrls = (text) =>
  String(text || "")
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter((u) => /^(https?:\/\/|supabase:)/i.test(u));

// ---------- Tabla de productos en Supabase ----------
// "supabase:productos" lee directo la tabla de tu tienda (la misma que usa tu página), sin usar IA.
const toList = (v) => {
  if (!v) return [];
  if (typeof v === "string") {
    try {
      return toList(JSON.parse(v));
    } catch {
      return v.split(/[\s,]+/);
    }
  }
  if (Array.isArray(v)) return v.flatMap(toList);
  if (typeof v === "object") return Object.values(v).flatMap(toList);
  return [];
};

// Columnas de la tienda MAURG (marca, nombre, codigo, divisa_detal, fotos...).
// Si cambia cómo se convierten las filas en productos, subir este número para que se vuelvan a importar.
const SUPABASE_MAPPING_VERSION = "2";

export function mapTiendaRow(r) {
  const attrs = {};
  const add = (k, v) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") attrs[k] = String(v).trim();
  };
  add("Marca", r.marca);
  add("Colores", r.colores);
  add("Colores agotados", r.colores_agotados);
  add("Precio al mayor (divisas)", r.divisa_mayor);
  add("Precio al detal a tasa BCV", r.bcv_detal);
  add("Precio al mayor a tasa BCV", r.bcv_mayor);
  add("Medidas", [["alto", r.alto], ["ancho", r.ancho], ["fondo", r.fondo], ["asa", r.asa]].filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`).join(", "));
  add("Cómo se lleva", r.como_se_lleva && String(r.como_se_lleva).split(",").join(", "));
  add("Disponibilidad", r.encargo ? "Por encargo" : r.disponible === false ? "Agotado" : "Disponible");
  return {
    name: r.nombre,
    model: r.codigo || "", // el código de la tienda puede repetirse entre productos
    sku: r.id || r.codigo, // el id es único: evita mezclar dos carteras con el mismo código
    category: r.marca || "",
    price: r.divisa_detal,
    stock: r.disponible === false && !r.encargo ? 0 : null,
    description: r.descripcion || "",
    attributes: attrs,
    photoUrls: [...new Set([...toList(r.fotos), ...toList(r.fotos_color)].filter((u) => /^https?:\/\//i.test(u)))],
  };
}

export async function fetchSupabaseTable(table) {
  if (!cloudEnabled) throw new Error("Para leer la tabla de Supabase configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  let res = await cloud().from(table).select("*").order("orden", { ascending: true, nullsFirst: false });
  if (res.error) res = await cloud().from(table).select("*"); // la tabla no tiene columna "orden"
  if (res.error) throw new Error(`Supabase (${table}): ${res.error.message}`);
  return res.data;
}

// Datos generales de la tienda (tabla "config" de tu página: pagos, envíos, ubicación...).
// Se guardan aparte del entrenamiento que escribes tú, y se actualizan en cada sincronización.
export function storeInfoFromConfig(d) {
  if (!d || typeof d !== "object") return "";
  const lines = [];
  const add = (label, v) => {
    if (v !== null && v !== undefined && String(v).trim() !== "" && v !== 0) lines.push(`${label}: ${String(v).trim().replace(/\n+/g, ", ")}`);
  };
  add("Tienda", d.nombreTienda);
  add("Ubicación y entregas", d.ubicacion);
  add("Agencias de envío", d.agencias);
  add("Formas de pago", d.datosPago);
  if (d.minimoMayor) lines.push(`Precio al mayor: a partir de ${d.minimoMayor} piezas`);
  add("Productos por encargo", d.notaEncargo);
  add("Tasa BCV de referencia", d.tasaBCV);
  add("Instagram", d.instagram);
  add("WhatsApp", [d.whatsappTexto, d.whatsapp2Texto].filter(Boolean).join(" / "));
  add("Canal de WhatsApp", d.canalWhatsapp);
  add("TikTok", d.tiktok);
  return lines.join("\n");
}

export async function fetchStoreInfo(table = "config") {
  if (!cloudEnabled) return null;
  const { data, error } = await cloud().from(table).select("*").limit(1);
  if (error || !data?.length) return null;
  const row = data[0];
  return { text: storeInfoFromConfig(row.datos ?? row), name: (row.datos ?? row).nombreTienda || "" };
}

export function supabaseRowsToProducts(rows) {
  if (!rows.length) return [];
  if ("nombre" in rows[0] && "divisa_detal" in rows[0]) return rows.map(mapTiendaRow);
  // Otra estructura: usar el reconocimiento de columnas normal
  return rowsToProducts(rows.map(flatten)) ?? [];
}

/**
 * Descarga y lee el inventario de una o varias URLs.
 * Si el contenido no cambió desde la última vez (mismo hash), no vuelve a usar la IA.
 * @returns {Promise<{unchanged: boolean, hash: string, products?: object[]}>}
 */
export async function fetchInventory(sources, headers = {}, previousHash = "") {
  const hash = crypto.createHash("sha256");
  const loaded = [];
  for (const url of splitUrls(sources)) {
    if (/^supabase:/i.test(url)) {
      const rows = await fetchSupabaseTable(url.slice("supabase:".length) || "productos");
      hash.update(SUPABASE_MAPPING_VERSION + JSON.stringify(rows));
      loaded.push({ products: supabaseRowsToProducts(rows) });
      continue;
    }
    const finalUrl = normalizeSourceUrl(url);
    const res = await fetch(finalUrl, { headers });
    if (!res.ok) throw new Error(`No se pudo leer el inventario (${res.status}) desde ${finalUrl}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") || "";
    const name = new URL(finalUrl).pathname.split("/").pop() || "";
    const guessed = finalUrl.includes("format=csv")
      ? "inventario.csv"
      : name.includes(".") ? name : type.includes("html") ? "x.html" : type.includes("json") ? "x.json" : type.includes("pdf") ? "x.pdf" : "x.csv";
    const isHtml = /\.html?$/i.test(guessed) || type.includes("html");
    const extra = isHtml ? await relatedDataFiles(buffer.toString("utf8"), res.url || finalUrl) : [];
    hash.update(buffer);
    for (const f of extra) hash.update(f.text);
    loaded.push({ buffer, guessed, type, url: res.url || finalUrl, isHtml, extra });
  }
  if (!loaded.length) throw new Error("No hay ninguna dirección válida (deben empezar con https:// o ser supabase:tabla)");
  const digest = hash.digest("hex");
  if (previousHash && digest === previousHash) return { unchanged: true, hash: digest };

  const products = [];
  for (const l of loaded) {
    if (l.products) {
      products.push(...l.products);
      continue;
    }
    products.push(...(l.isHtml ? await extractFromHtml(l.buffer.toString("utf8"), l.url, l.extra) : await parseInventory(l.buffer, l.guessed, l.type, l.url)));
  }
  return { unchanged: false, hash: digest, products };
}
