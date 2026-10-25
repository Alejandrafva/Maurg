import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "vendedor-test-"));
const store = await import("../src/store.js");
const { rowsToProducts, parseInventory, normalizeSourceUrl } = await import("../src/importers.js");
const { parseWebhook } = await import("../src/channels/meta.js");

test("parsePrice entiende formatos latinos y anglosajones", () => {
  assert.equal(store.parsePrice("$1.299,90"), 1299.9);
  assert.equal(store.parsePrice("1,299.90"), 1299.9);
  assert.equal(store.parsePrice("12,5"), 12.5);
  assert.equal(store.parsePrice("1.299"), 1299);
  assert.equal(store.parsePrice("45.50"), 45.5);
  assert.equal(store.parsePrice(""), null);
});

test("mapea columnas de Excel en español", async () => {
  const ws = XLSX.utils.json_to_sheet([
    { Producto: "Zapatilla Runner", Modelo: "R-200", Código: "ZAP-042", Precio: "$59,90", Cantidad: 12, Color: "Negro" },
    { Producto: "Gorra", Modelo: "", Código: "GOR-1", Precio: "15", Cantidad: 0, Color: "Rojo" },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const items = await parseInventory(buf, "inventario.xlsx");
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "Zapatilla Runner");
  assert.equal(items[0].sku, "ZAP-042");
  assert.equal(items[0].attributes.Color, "Negro");

  const r = store.importProducts(items);
  assert.deepEqual([r.created, r.updated], [2, 0]);
  const again = store.importProducts(items);
  assert.deepEqual([again.created, again.updated], [0, 2]);
  // Otra fuente sin stock (p. ej. la página web) no borra el stock que vino del Excel
  store.importProducts([{ name: "Zapatilla Runner", model: "R-200", sku: "ZAP-042", price: "59,90", stock: null }]);
  const p = store.searchProducts("zapatillas negras")[0];
  assert.equal(p.name, "Zapatilla Runner");
  assert.equal(p.price, 59.9);
  assert.equal(p.stock, 12);
});

test("sin columnas reconocibles devuelve null (se usa la IA)", () => {
  assert.equal(rowsToProducts([{ a: 1, b: 2 }]), null);
});

test("Google Sheets se convierte a CSV exportable", () => {
  assert.equal(
    normalizeSourceUrl("https://docs.google.com/spreadsheets/d/ABC123/edit#gid=77"),
    "https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=77",
  );
});

test("lee webhooks de WhatsApp, Messenger e Instagram", () => {
  const wa = parseWebhook({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: { metadata: { phone_number_id: "PN" }, contacts: [{ wa_id: "549111", profile: { name: "Ana" } }], messages: [{ from: "549111", id: "w1", type: "image", image: { id: "MEDIA", caption: "¿tienen esta?" } }] } }] }],
  });
  assert.deepEqual(wa[0], { channel: "whatsapp", userId: "549111", name: "Ana", messageId: "w1", text: "¿tienen esta?", imageRefs: [{ waMediaId: "MEDIA" }], phoneNumberId: "PN" });

  const fb = parseWebhook({ object: "page", entry: [{ messaging: [{ sender: { id: "u1" }, message: { mid: "m1", text: "hola" } }, { sender: { id: "pg" }, message: { mid: "m2", text: "eco", is_echo: true } }] }] });
  assert.equal(fb.length, 1);
  assert.equal(fb[0].channel, "facebook");

  const ig = parseWebhook({ object: "instagram", entry: [{ messaging: [{ sender: { id: "ig1" }, message: { mid: "i1", attachments: [{ type: "image", payload: { url: "https://x/y.jpg" } }] } }] }] });
  assert.equal(ig[0].channel, "instagram");
  assert.deepEqual(ig[0].imageRefs, [{ url: "https://x/y.jpg" }]);
});

test("lee la tabla de productos y la config de la tienda en Supabase", async () => {
  const { mapTiendaRow, storeInfoFromConfig, supabaseRowsToProducts } = await import("../src/importers.js");
  const row = {
    id: "coach-1", marca: "Coach", nombre: "Cartera Coach Barril", codigo: "2607", colores: "Negro", colores_agotados: "",
    descripcion: "Tipo barril", divisa_detal: "25", divisa_mayor: "20", bcv_detal: "32", bcv_mayor: "28", encargo: false,
    disponible: true, fotos: ["https://cdn.x/a.png", "https://cdn.x/b.jpg"], fotos_color: { negro: "https://cdn.x/c.jpg" },
    alto: 20, ancho: null, fondo: null, asa: null, como_se_lleva: "mano,hombro", orden: 1,
  };
  const p = mapTiendaRow(row);
  assert.equal(p.name, "Cartera Coach Barril");
  assert.equal(p.sku, "2607");
  assert.equal(p.price, "25");
  assert.equal(p.attributes["Precio al mayor (divisas)"], "20");
  assert.equal(p.attributes["Medidas"], "alto 20");
  assert.equal(p.attributes["Disponibilidad"], "Disponible");
  assert.deepEqual(p.photoUrls, ["https://cdn.x/a.png", "https://cdn.x/b.jpg", "https://cdn.x/c.jpg"]);
  assert.equal(mapTiendaRow({ ...row, disponible: false }).stock, 0);
  assert.equal(mapTiendaRow({ ...row, disponible: false, encargo: true }).attributes["Disponibilidad"], "Por encargo");
  assert.equal(supabaseRowsToProducts([row]).length, 1);

  // Las fotos de la fuente se usan por URL y reemplazan a las anteriores de esa fuente
  store.importProducts([p]);
  store.importProducts([{ ...p, photoUrls: ["https://cdn.x/a.png"] }]);
  assert.deepEqual(store.searchProducts("coach")[0].photos, ["https://cdn.x/a.png"]);

  const info = storeInfoFromConfig({ nombreTienda: "MAURG", datosPago: "Zinli\nBinance", minimoMayor: 3, tasaBCV: 0, tiktok: "" });
  assert.equal(info, "Tienda: MAURG\nFormas de pago: Zinli, Binance\nPrecio al mayor: a partir de 3 piezas");
});
