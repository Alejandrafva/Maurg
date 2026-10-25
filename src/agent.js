// El vendedor con IA: responde usando el inventario, el entrenamiento del negocio y las fotos.
import { createMessage, textOf, CHAT_EFFORT } from "./claude.js";
import { readFile, mimeOf } from "./files.js";
import * as store from "./store.js";

const MAX_HISTORY = 20; // mensajes previos que se le pasan a la IA como contexto
const MAX_PHOTOS_PER_COMPARE = 6;

function productSummary(p, currency) {
  const price = p.price == null ? "precio no definido" : `${p.price} ${currency}`;
  const stock = p.stock == null ? "stock no informado" : p.stock > 0 ? `${p.stock} disponibles` : "AGOTADO";
  const attrs = Object.entries(p.attributes || {}).map(([k, v]) => `${k}: ${v}`).join("; ");
  return [
    `id=${p.id}`,
    p.name,
    p.model && `modelo ${p.model}`,
    p.sku && `SKU ${p.sku}`,
    p.category && `categoría ${p.category}`,
    price,
    stock,
    p.description,
    attrs,
    `${p.photos.length} foto(s)`,
  ]
    .filter(Boolean)
    .join(" | ");
}

const TOOLS = [
  {
    name: "buscar_productos",
    description:
      "Busca en el inventario por nombre, modelo, SKU, categoría, color, etc. Devuelve precio, stock y características actuales. Úsala SIEMPRE antes de dar precios o disponibilidad.",
    input_schema: {
      type: "object",
      properties: { consulta: { type: "string", description: "Palabras clave, p. ej. 'zapatilla negra 42'" } },
      required: ["consulta"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "ver_fotos_productos",
    description:
      "Muestra las fotos del catálogo de uno o varios productos para que puedas compararlas con la foto que envió el cliente y reconocer cuál es.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" }, description: "ids de producto (máx. 6)" } },
      required: ["ids"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "enviar_foto",
    description: "Envía al cliente una foto de un producto del catálogo (por ejemplo cuando pide verlo).",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" }, indice_foto: { type: "integer", description: "0 = primera foto" } },
      required: ["id", "indice_foto"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "pasar_a_humano",
    description:
      "Avisa al dueño para que una persona atienda: el cliente quiere cerrar una compra, pide algo que no sabes, reclama, o pide hablar con una persona.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string" } },
      required: ["motivo"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function buildSystem(settings, products) {
  const catalog =
    products.length <= 300
      ? products.map((p) => "- " + productSummary(p, settings.currency)).join("\n")
      : `(El catálogo tiene ${products.length} productos; usa buscar_productos para encontrarlos.)`;
  const faqs = (settings.faqs || []).map((f) => `P: ${f.q}\nR: ${f.a}`).join("\n\n");
  return `Eres el asistente de ventas de "${settings.businessName}". Atiendes a clientes por WhatsApp, Instagram y Facebook.
Responde en ${settings.language}, con un tono ${settings.tone}. Mensajes cortos, como en un chat (máximo 3-4 líneas salvo que pidan detalle). Sin markdown con tablas ni encabezados.

Reglas:
- Precios, modelos y stock: SOLO los que aparecen en el inventario. Si no está, dilo y ofrece alternativas parecidas. Nunca inventes precios ni promociones.
- Si un producto está agotado, dilo y sugiere uno similar con stock.
- Si el cliente manda una foto, identifica el producto: describe lo que ves, busca candidatos con buscar_productos y compáralos con ver_fotos_productos. Si no estás seguro, pregunta un detalle (color, talla, modelo) antes de afirmar.
- Si te piden ver un producto, usa enviar_foto.
- Si el cliente quiere comprar/pagar, reclama, o pide hablar con una persona, usa pasar_a_humano y avísale que alguien lo atenderá pronto.
- Si el cliente pide borrar sus datos, usa pasar_a_humano con motivo "borrar datos" y confírmale que se eliminarán.
- Moneda: ${settings.currency}.

Información del negocio (entrenamiento):
${settings.knowledge || "(sin información adicional)"}

${faqs ? `Preguntas frecuentes (responde así):\n${faqs}\n` : ""}
Inventario actual:
${catalog || "(vacío)"}`;
}

async function runTool(name, input, ctx) {
  const settings = store.getSettings();
  switch (name) {
    case "buscar_productos": {
      const found = store.searchProducts(input.consulta, 10);
      return found.length ? found.map((p) => productSummary(p, settings.currency)).join("\n") : "Sin resultados.";
    }
    case "ver_fotos_productos": {
      const content = [];
      for (const id of (input.ids || []).slice(0, MAX_PHOTOS_PER_COMPARE)) {
        const p = store.getProduct(id);
        if (!p) {
          content.push({ type: "text", text: `${id}: no existe` });
          continue;
        }
        content.push({ type: "text", text: productSummary(p, settings.currency) });
        for (const photo of p.photos.slice(0, 2)) {
          const buf = await readFile("media", photo);
          if (!buf) continue;
          content.push({ type: "image", source: { type: "base64", media_type: mimeOf(photo), data: buf.toString("base64") } });
        }
        if (!p.photos.length) content.push({ type: "text", text: "(sin fotos cargadas)" });
      }
      return content;
    }
    case "enviar_foto": {
      const p = store.getProduct(input.id);
      const photo = p?.photos[input.indice_foto ?? 0] ?? p?.photos[0];
      if (!photo) return "Ese producto no tiene fotos cargadas.";
      ctx.outgoing.push({ type: "image", file: photo, caption: [p.name, p.model].filter(Boolean).join(" ") });
      return "Foto enviada al cliente.";
    }
    case "pasar_a_humano": {
      ctx.handoff = input.motivo || "sin motivo";
      return "El dueño fue notificado. Dile al cliente que una persona lo atenderá pronto.";
    }
    default:
      return `Herramienta desconocida: ${name}`;
  }
}

/**
 * Procesa un mensaje entrante y devuelve lo que hay que contestar.
 * @param {{role: string, text: string}[]} history mensajes anteriores (sin el mensaje nuevo)
 * @param {{text?: string, images?: {data: string, mediaType: string}[]}} incoming
 * @returns {Promise<{replies: ({type:"text",text:string}|{type:"image",file:string,caption:string})[], handoff: string|null}>}
 */
export async function handleMessage(history, incoming) {
  const settings = store.getSettings();
  const ctx = { outgoing: [], handoff: null };

  // Historial previo en texto (la conversación guardada), luego el mensaje nuevo.
  const messages = [];
  for (const m of history.slice(-MAX_HISTORY)) {
    const role = m.role === "customer" ? "user" : "assistant";
    if (messages.at(-1)?.role === role) messages.at(-1).content += "\n" + m.text;
    else messages.push({ role, content: m.text });
  }
  while (messages[0]?.role === "assistant") messages.shift();

  const userContent = [];
  for (const img of incoming.images || []) {
    userContent.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  }
  userContent.push({ type: "text", text: incoming.text?.trim() || (incoming.images?.length ? "(El cliente envió esta foto)" : "(mensaje vacío)") });
  if (messages.at(-1)?.role === "user") {
    const prev = messages.pop();
    userContent.unshift({ type: "text", text: prev.content });
  }
  messages.push({ role: "user", content: userContent });

  const system = [{ type: "text", text: buildSystem(settings, store.listProducts()), cache_control: { type: "ephemeral" } }];

  for (let turn = 0; turn < 8; turn++) {
    const msg = await createMessage({ system, tools: TOOLS, messages, output_config: { effort: CHAT_EFFORT } });
    messages.push({ role: "assistant", content: msg.content });

    if (msg.stop_reason !== "tool_use") {
      const text = textOf(msg);
      return { replies: [...ctx.outgoing, ...(text ? [{ type: "text", text }] : [])], handoff: ctx.handoff };
    }

    const results = [];
    for (const block of msg.content) {
      if (block.type !== "tool_use") continue;
      try {
        results.push({ type: "tool_result", tool_use_id: block.id, content: await runTool(block.name, block.input, ctx) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(e.message || e), is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { replies: [...ctx.outgoing, { type: "text", text: "Dame un momento, ya te confirmo 🙏" }], handoff: ctx.handoff || "La IA no logró resolver" };
}
