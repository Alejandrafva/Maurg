// Conexión con WhatsApp Cloud API, Facebook Messenger e Instagram (todas son APIs de Meta).
// Un solo webhook (/webhook/meta) recibe los mensajes de los tres canales.
import crypto from "node:crypto";
import { readFile, mimeOf } from "../files.js";

const V = process.env.GRAPH_API_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${V}`;
const IG_GRAPH = `https://${process.env.INSTAGRAM_API_HOST || "graph.instagram.com"}/${V}`;

const env = (k) => process.env[k] || "";

export function channelStatus() {
  return {
    whatsapp: Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID")),
    facebook: Boolean(env("FACEBOOK_PAGE_TOKEN")),
    instagram: Boolean(env("INSTAGRAM_ACCESS_TOKEN") || env("FACEBOOK_PAGE_TOKEN")),
    webhookVerifyToken: Boolean(env("META_VERIFY_TOKEN")),
    signatureCheck: Boolean(env("META_APP_SECRET")),
    publicUrl: env("PUBLIC_URL"),
  };
}

export function verifySignature(req) {
  const secret = env("META_APP_SECRET");
  if (!secret) return true; // sin secreto configurado no se verifica (solo para pruebas)
  const header = req.get("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("hex");
  return header.length === expected.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

async function graph(url, { token, method = "GET", json, form } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${await res.text()}`);
  return res;
}

async function download(url, token) {
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const mediaType = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
  return { data: Buffer.from(await res.arrayBuffer()).toString("base64"), mediaType };
}

// ---------- Recepción ----------
// Convierte el webhook de Meta en una lista de mensajes normalizados:
// { channel, userId, name, messageId, text, imageRefs: [{ url } | { waMediaId }] }
export function parseWebhook(body) {
  const out = [];
  if (body.object === "whatsapp_business_account") {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name || ""]));
        for (const m of v.messages || []) {
          const msg = { channel: "whatsapp", userId: m.from, name: names[m.from] || "", messageId: m.id, text: "", imageRefs: [], phoneNumberId: v.metadata?.phone_number_id };
          if (m.type === "text") msg.text = m.text?.body || "";
          else if (m.type === "image") {
            msg.text = m.image?.caption || "";
            msg.imageRefs.push({ waMediaId: m.image.id });
          } else if (m.type === "button") msg.text = m.button?.text || "";
          else if (m.type === "interactive") msg.text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
          else msg.text = `(El cliente envió un mensaje de tipo ${m.type})`;
          out.push(msg);
        }
      }
    }
  } else if (body.object === "page" || body.object === "instagram") {
    const channel = body.object === "page" ? "facebook" : "instagram";
    for (const entry of body.entry || []) {
      for (const ev of entry.messaging || []) {
        const m = ev.message;
        if (!m || m.is_echo) continue; // ignorar los mensajes que enviamos nosotros
        const msg = { channel, userId: ev.sender.id, name: "", messageId: m.mid, text: m.text || "", imageRefs: [] };
        for (const a of m.attachments || []) {
          if (a.type === "image" && a.payload?.url) msg.imageRefs.push({ url: a.payload.url });
        }
        if (!msg.text && !msg.imageRefs.length) msg.text = "(El cliente envió un adjunto o reacción)";
        out.push(msg);
      }
    }
  }
  return out;
}

export async function fetchImages(msg) {
  const images = [];
  for (const ref of msg.imageRefs) {
    try {
      if (ref.waMediaId) {
        const token = env("WHATSAPP_TOKEN");
        const meta = await (await graph(`${GRAPH}/${ref.waMediaId}`, { token })).json();
        images.push(await download(meta.url, token));
      } else if (ref.url) {
        images.push(await download(ref.url));
      }
    } catch (e) {
      console.error("[meta] imagen:", e.message);
    }
  }
  return images;
}

// ---------- Envío ----------
function chunks(text, size) {
  const parts = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size / 2) cut = rest.lastIndexOf(" ", size);
    if (cut < size / 2) cut = size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

function publicPhotoUrl(file) {
  const base = env("PUBLIC_URL").replace(/\/$/, "");
  if (!base) throw new Error("Configura PUBLIC_URL para poder enviar fotos por Facebook/Instagram");
  return `${base}/media/${encodeURIComponent(file)}`;
}

async function sendWhatsApp(to, reply, phoneNumberId) {
  const token = env("WHATSAPP_TOKEN");
  const url = `${GRAPH}/${phoneNumberId || env("WHATSAPP_PHONE_NUMBER_ID")}/messages`;
  if (reply.type === "text") {
    for (const body of chunks(reply.text, 4000)) {
      await graph(url, { token, method: "POST", json: { messaging_product: "whatsapp", to, type: "text", text: { body } } });
    }
    return;
  }
  // Subimos la foto a WhatsApp (así no hace falta una URL pública).
  const buf = await readFile("media", reply.file);
  if (!buf) throw new Error(`No se encontró la foto ${reply.file}`);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeOf(reply.file));
  form.append("file", new Blob([buf], { type: mimeOf(reply.file) }), reply.file);
  const media = await (await graph(`${GRAPH}/${phoneNumberId || env("WHATSAPP_PHONE_NUMBER_ID")}/media`, { token, method: "POST", form })).json();
  await graph(url, { token, method: "POST", json: { messaging_product: "whatsapp", to, type: "image", image: { id: media.id, caption: reply.caption } } });
}

async function sendMessengerLike(channel, recipientId, reply) {
  const useIgLogin = channel === "instagram" && env("INSTAGRAM_ACCESS_TOKEN");
  const token = useIgLogin ? env("INSTAGRAM_ACCESS_TOKEN") : env("FACEBOOK_PAGE_TOKEN");
  const url = `${useIgLogin ? IG_GRAPH : GRAPH}/me/messages`;
  const send = (message) => graph(url, { token, method: "POST", json: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message } });
  if (reply.type === "text") {
    for (const text of chunks(reply.text, 1000)) await send({ text });
  } else {
    await send({ attachment: { type: "image", payload: { url: publicPhotoUrl(reply.file), is_reusable: true } } });
    if (reply.caption) await send({ text: reply.caption });
  }
}

export async function sendReply(msg, reply) {
  if (msg.channel === "whatsapp") return sendWhatsApp(msg.userId, reply, msg.phoneNumberId);
  return sendMessengerLike(msg.channel, msg.userId, reply);
}
