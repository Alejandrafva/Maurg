import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "vendedor-html-"));
process.env.ANTHROPIC_API_KEY = "test";
process.env.AI_MODEL = "claude-haiku-5-5";

// Sitio de prueba: los productos se cargan con JavaScript desde productos.json
const site = {
  "/": `<html><head><style>.x{}</style><script src="/app.js"></script><script src="https://cdn.example.com/jquery.min.js"></script></head>
        <body class="c"><h1>Catálogo</h1><img src="img/logo.png"></body></html>`,
  "/app.js": `fetch("productos.json").then(r => r.json()).then(render)`,
  "/productos.json": `[{"nombre":"Bolso Luna","precio":"35","foto":"img/luna.jpg"}]`,
};
let aiRequests = [];
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/v1/messages")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      aiRequests.push(JSON.parse(body));
      const out = { products: [{ name: "Bolso Luna", model: "", sku: "", category: "", price: 35, stock: null, description: "", image_urls: ["img/luna.jpg"], attributes: [] }] };
      const msg = { id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
      // El SDK pide streaming: respondemos como eventos SSE
      res.writeHead(200, { "content-type": "text/event-stream" });
      const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      ev("message_start", { message: { ...msg, content: [], stop_reason: null } });
      ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: msg.content[0].text } });
      ev("content_block_stop", { index: 0 });
      ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } });
      ev("message_stop", {});
      res.end();
    });
    return;
  }
  const page = site[req.url];
  if (!page) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": req.url === "/" ? "text/html" : req.url.endsWith(".json") ? "application/json" : "text/javascript" });
  res.end(page);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
process.env.ANTHROPIC_BASE_URL = base;
after(() => server.close());

const { cleanHtml, fetchInventory, splitUrls } = await import("../src/importers.js");

test("cleanHtml quita estilos y completa las rutas de imágenes", () => {
  const out = cleanHtml(`<div class="a" style="b"><style>p{}</style><img src="img/x.jpg" alt="X"></div>`, "https://maurg.shop/catalogo/");
  assert.equal(out, `<div><img src="https://maurg.shop/catalogo/img/x.jpg" alt="X"></div>`);
});

test("splitUrls acepta varias direcciones", () => {
  assert.deepEqual(splitUrls("https://a.com/\nhttps://a.com/b.html  nada"), ["https://a.com/", "https://a.com/b.html"]);
});

test("lee una página HTML, sus datos en JSON y no repite la IA si no cambió", async () => {
  const r = await fetchInventory(`${base}/`);
  assert.equal(r.unchanged, false);
  assert.equal(r.products[0].name, "Bolso Luna");
  assert.deepEqual(r.products[0].imageUrls, [`${base}/img/luna.jpg`]);

  const sent = aiRequests[0].messages[0].content[0].text;
  assert.match(sent, /productos\.json/);
  assert.match(sent, /Bolso Luna/); // el contenido del JSON llegó a la IA
  assert.doesNotMatch(sent, /Archivo https:\/\/cdn/); // no descarga librerías externas
  assert.equal(aiRequests[0].fallbacks, undefined); // Haiku no admite fallbacks

  const again = await fetchInventory(`${base}/`, {}, r.hash);
  assert.equal(again.unchanged, true);
  assert.equal(aiRequests.length, 1);
});
