import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
// Esfuerzo de razonamiento: "low" es rápido y barato para chat; súbelo a "medium"/"high" si hace falta.
export const CHAT_EFFORT = process.env.AI_EFFORT || "low";

let client;
export function getClient() {
  if (!client) client = new Anthropic(); // usa ANTHROPIC_API_KEY del entorno
  return client;
}

// Llamada a Claude con "fallbacks" del lado del servidor: si el modelo principal rechaza
// la petición, la API la reintenta automáticamente con el modelo recomendado.
// Con { stream: true } usa streaming (para respuestas largas, p. ej. extraer un catálogo entero).
// Solo algunos modelos aceptan fallbacks (Haiku, el más económico, no).
const SUPPORTS_FALLBACKS = ["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"].includes(MODEL);

export async function createMessage({ stream = false, ...params }) {
  const body = {
    model: MODEL,
    max_tokens: stream ? 64000 : 16000,
    ...(SUPPORTS_FALLBACKS ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    ...params,
  };
  const msg = stream
    ? await getClient().beta.messages.stream(body).finalMessage()
    : await getClient().beta.messages.create(body);
  if (msg.stop_reason === "refusal") {
    const err = new Error("La IA no pudo responder a este mensaje.");
    err.refusal = msg.stop_details;
    throw err;
  }
  return msg;
}

export const textOf = (msg) =>
  msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
