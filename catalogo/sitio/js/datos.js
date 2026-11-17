/* =====================================================================
   datos.js — conexión con Supabase, ajustes y utilidades compartidas
   (lo usan la tienda y las páginas informativas)
   ===================================================================== */
(function () {
  const C = window.CONEXION || {};
  const URL_OK = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)\/?$/i.test(String(C.SUPABASE_URL || "").trim());
  const CLAVE_OK = String(C.SUPABASE_KEY || "").trim().length > 30 && !/PEGA_AQUI/i.test(C.SUPABASE_KEY);
  const T = (window.Tienda = {});

  T.demo = !(URL_OK && CLAVE_OK);
  T.url = String(C.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  T.clave = String(C.SUPABASE_KEY || "").trim();
  if (/^sb_secret_/i.test(T.clave) || /service_role/i.test(atobSeguro(T.clave.split(".")[1] || ""))) {
    console.error("⚠️ En conexion.js pegaste una clave SECRETA. Usa la clave pública (publishable/anon).");
    T.demo = true;
  }

  function atobSeguro(s) {
    try { return atob(s.replace(/-/g, "+").replace(/_/g, "/")); } catch (e) { return ""; }
  }

  // ---------------------------------------------------------------------
  // Ajustes por defecto (los reales vienen de la tabla config)
  // ---------------------------------------------------------------------
  T.AJUSTES_BASE = {
    nombreTienda: "ARKEO",
    eslogan: "Home & Office · Mobiliario de oficina y hogar",
    logo: "img/logo-arkeo-negro.png",
    whatsapp: "",
    instagram: "",
    tiktok: "",
    correo: "",
    telefono: "",
    direccion: "",
    horario: "Lunes a sábado, 9:00 a. m. a 6:00 p. m.",
    mapa: "",
    tasaBCV: 0,
    tasaFecha: "",
    minimoMayor: 6,
    pocasUnidades: 3,
    diasPedidos: 30,
    workerUrl: "",
    notaEncargo: "Producto por encargo: consulta el tiempo de entrega.",
    categorias: [],
    portada: { titulo: "", subtitulo: "Sillas presidenciales, ejecutivas y de visitante, escritorios, comedores, espejos y vanity. Al mayor y al detal, con envíos a toda Venezuela.", boton: "Ver catálogo", imagen: "" },
    colecciones: [],
    resenas: [],
    paginas: {},
    datosPago: "",
    agencias: "",
    ubicacion: "",
  };

  T.unirAjustes = function (datos) {
    const d = Object.assign({}, T.AJUSTES_BASE, datos || {});
    d.portada = Object.assign({}, T.AJUSTES_BASE.portada, (datos && datos.portada) || {});
    ["categorias", "colecciones", "resenas"].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.paginas || typeof d.paginas !== "object") d.paginas = {};
    d.tasaBCV = Number(d.tasaBCV) || 0;
    d.minimoMayor = Math.max(1, parseInt(d.minimoMayor, 10) || 6);
    d.pocasUnidades = Math.max(0, parseInt(d.pocasUnidades, 10) || 0);
    d.workerUrl = String(d.workerUrl || C.WORKER_URL || "").trim().replace(/\/+$/, "");
    return d;
  };

  // ---------------------------------------------------------------------
  // Memoria local (para que la página abra al instante en el celular)
  // ---------------------------------------------------------------------
  const MEM = "cat1:";
  T.leerMemoria = function (k) {
    try { const v = localStorage.getItem(MEM + k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  };
  T.guardarMemoria = function (k, v) {
    try { localStorage.setItem(MEM + k, JSON.stringify(v)); } catch (e) { /* sin espacio o privado */ }
  };

  // ---------------------------------------------------------------------
  // Modo demostración (sin Supabase): datos de ejemplo en este navegador
  // ---------------------------------------------------------------------
  let demoListo = null;
  T.prepararDemo = function () {
    if (!demoListo) {
      demoListo = T.cargarScript("js/demo.js").then(() => {
        const D = window.DEMO;
        if (!T.demoLeer("config")) T.demoGuardar("config", D.config);
        if (!T.demoLeer("productos")) T.demoGuardar("productos", D.productos);
        if (!T.demoLeer("pedidos")) T.demoGuardar("pedidos", []);
        if (!T.demoLeer("proveedores")) T.demoGuardar("proveedores", D.proveedores || []);
        if (!T.demoLeer("privado")) T.demoGuardar("privado", {});
      });
    }
    return demoListo;
  };
  T.demoLeer = function (k) {
    try { const v = localStorage.getItem("demo:" + k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  };
  T.demoGuardar = function (k, v) {
    try { localStorage.setItem("demo:" + k, JSON.stringify(v)); } catch (e) { console.warn("Sin espacio en el navegador", e); }
  };

  // ---------------------------------------------------------------------
  // Lectura pública (sin librerías: más rápido)
  // ---------------------------------------------------------------------
  async function rest(ruta, opciones) {
    opciones = opciones || {};
    const r = await fetch(T.url + "/rest/v1/" + ruta, {
      method: opciones.method || "GET",
      headers: Object.assign({ apikey: T.clave, "content-type": "application/json" }, opciones.headers || {}),
      body: opciones.body,
    });
    if (!r.ok) {
      let msg = r.status + "";
      try { const j = await r.json(); msg = j.message || j.error || msg; } catch (e) { /* nada */ }
      throw new Error(msg);
    }
    if (r.status === 204 || r.status === 201) return null;
    return r.json();
  }
  T.rest = rest;

  T.cargarConfig = async function () {
    if (T.demo) {
      await T.prepararDemo();
      return T.unirAjustes(T.demoLeer("config"));
    }
    const filas = await rest("config?select=datos&id=eq.1");
    const datos = T.unirAjustes(filas && filas[0] ? filas[0].datos : {});
    T.guardarMemoria("config", datos);
    return datos;
  };

  T.cargarProductos = async function () {
    if (T.demo) {
      await T.prepararDemo();
      return ordenar(T.demoLeer("productos") || []);
    }
    const filas = await rest("productos?select=*&order=orden.asc,id.desc");
    T.guardarMemoria("productos", filas);
    return filas;
  };

  function ordenar(lista) {
    return lista.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0) || (b.id || 0) - (a.id || 0));
  }
  T.ordenar = ordenar;

  // Guarda el pedido como "pendiente" en el almacén
  T.guardarPedido = async function (pedido) {
    if (T.demo) {
      const lista = T.demoLeer("pedidos") || [];
      lista.unshift(Object.assign({}, pedido, { estado: "pendiente", creado: new Date().toISOString() }));
      T.demoGuardar("pedidos", lista);
      return;
    }
    await rest("pedidos", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(pedido) });
  };

  // Sube el PDF del pedido a Cloudflare (público, solo PDF, máx. 2 MB)
  T.subirPdfPedido = async function (cfg, id, blob) {
    if (!cfg.workerUrl) return null;
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), 20000);
    try {
      const r = await fetch(cfg.workerUrl + "/pedido?id=" + encodeURIComponent(id), {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: blob,
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!r.ok) throw new Error("Worker " + r.status);
      const j = await r.json();
      return j.url || null;
    } finally {
      clearTimeout(t);
    }
  };

  // ---------------------------------------------------------------------
  // Precios y stock
  // ---------------------------------------------------------------------
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

  /** precio(p, "detal"|"mayor", "divisas"|"bcv") en dólares */
  T.precio = function (p, tipo, pago) {
    const dd = num(p.divisa_detal), dm = num(p.divisa_mayor), bd = num(p.bcv_detal), bm = num(p.bcv_mayor);
    const detal = pago === "bcv" ? (bd != null ? bd : dd) : (dd != null ? dd : bd);
    const mayor = pago === "bcv" ? (bm != null ? bm : dm) : (dm != null ? dm : bm);
    if (tipo === "mayor") return mayor != null ? mayor : detal != null ? detal : 0;
    return detal != null ? detal : 0;
  };
  T.tieneMayor = (p) => num(p.divisa_mayor) != null || num(p.bcv_mayor) != null;
  T.tieneBcv = (p) => num(p.bcv_detal) != null || num(p.bcv_mayor) != null;

  T.stockDe = function (p, color) {
    const sc = p.stock_color && typeof p.stock_color === "object" ? p.stock_color : {};
    if (color && Object.prototype.hasOwnProperty.call(sc, color)) return Math.max(0, parseInt(sc[color], 10) || 0);
    return Math.max(0, parseInt(p.stock, 10) || 0);
  };

  /** Estado para avisos: ok | pocas | agotado | encargo */
  T.estado = function (p, cfg, color) {
    if (p.encargo) return { tipo: "encargo", texto: "Por encargo" };
    const s = T.stockDe(p, color);
    if (s <= 0) return { tipo: "agotado", texto: "Agotado" };
    if (cfg && cfg.pocasUnidades && s <= cfg.pocasUnidades) return { tipo: "pocas", texto: "¡Pocas unidades!", stock: s };
    return { tipo: "ok", texto: "Disponible", stock: s };
  };

  T.colores = function (p) {
    const c = Array.isArray(p.colores) ? p.colores : [];
    return c.map((x) => (typeof x === "string" ? { nombre: x, hex: "" } : { nombre: x.nombre || "", hex: x.hex || "" })).filter((x) => x.nombre);
  };

  T.fotos = function (p) {
    const f = Array.isArray(p.fotos) ? p.fotos : [];
    return f.map((x) => (typeof x === "string" ? { url: x, color: "", tipo: "" } : x)).filter((x) => x && x.url);
  };
  T.esVideo = (f) => f.tipo === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(f.url || "");

  T.fotoPrincipal = function (p, color) {
    const fs = T.fotos(p).filter((f) => !T.esVideo(f));
    if (color) {
      const c = fs.find((f) => f.color === color);
      if (c) return c.url;
    }
    return fs[0] ? fs[0].url : "img/sin-foto.svg";
  };

  // ---------------------------------------------------------------------
  // Formatos
  // ---------------------------------------------------------------------
  const fmt2 = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });
  T.dinero = function (n) {
    n = Number(n) || 0;
    return "$" + (Number.isInteger(Math.round(n * 100) / 100) ? fmt0.format(n) : fmt2.format(n));
  };
  T.bs = (n) => "Bs " + fmt2.format(Number(n) || 0);
  T.numero = (n) => fmt0.format(Number(n) || 0);

  T.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };
  T.normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  T.slug = (s) => T.normalizar(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  T.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  };

  /** Número de WhatsApp en formato internacional (Venezuela por defecto) */
  T.numeroWa = function (n) {
    let d = String(n || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("0") && d.length === 11) d = "58" + d.slice(1); // 0414xxxxxxx
    if (d.length === 10 && /^4/.test(d)) d = "58" + d; // 414xxxxxxx
    return d;
  };
  T.enlaceWa = function (numero, texto) {
    const n = T.numeroWa(numero);
    return "https://wa.me/" + n + (texto ? "?text=" + encodeURIComponent(texto) : "");
  };

  T.cargarScript = function (src) {
    return new Promise((ok, mal) => {
      if (document.querySelector('script[data-src="' + src + '"]')) {
        const s = document.querySelector('script[data-src="' + src + '"]');
        if (s.dataset.listo) return ok();
        s.addEventListener("load", () => ok());
        s.addEventListener("error", () => mal(new Error("No se pudo cargar " + src)));
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.src = src;
      s.onload = () => { s.dataset.listo = "1"; ok(); };
      s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  };

  let tTostada;
  T.tostada = function (texto, ms) {
    let el = document.getElementById("tostada");
    if (!el) {
      el = document.createElement("div");
      el.id = "tostada";
      el.className = "tostada";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = texto;
    requestAnimationFrame(() => el.classList.add("visible"));
    clearTimeout(tTostada);
    tTostada = setTimeout(() => el.classList.remove("visible"), ms || 2600);
  };

  // Texto simple -> HTML (## Título, - lista, párrafos). Para las páginas editables.
  T.textoAHtml = function (txt) {
    const lineas = String(txt || "").replace(/\r/g, "").split("\n");
    let html = "", lista = false, parrafo = [];
    const cerrarP = () => { if (parrafo.length) { html += "<p>" + parrafo.join("<br>") + "</p>"; parrafo = []; } };
    const cerrarL = () => { if (lista) { html += "</ul>"; lista = false; } };
    const enlaces = (s) => T.esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    lineas.forEach((l) => {
      const t = l.trim();
      if (!t) { cerrarP(); cerrarL(); return; }
      if (/^#{1,3}\s/.test(t)) { cerrarP(); cerrarL(); html += "<h2>" + enlaces(t.replace(/^#+\s*/, "")) + "</h2>"; return; }
      if (/^[-•*]\s/.test(t)) { cerrarP(); if (!lista) { html += "<ul>"; lista = true; } html += "<li>" + enlaces(t.replace(/^[-•*]\s*/, "")) + "</li>"; return; }
      cerrarL(); parrafo.push(enlaces(t));
    });
    cerrarP(); cerrarL();
    return html;
  };

  // ---------------------------------------------------------------------
  // Partes comunes de todas las páginas (nombre, WhatsApp, pie)
  // ---------------------------------------------------------------------
  T.pintarComun = function (cfg) {
    document.querySelectorAll("[data-nombre-tienda]").forEach((el) => (el.textContent = cfg.nombreTienda));
    document.querySelectorAll("[data-eslogan]").forEach((el) => (el.textContent = cfg.eslogan || ""));
    document.querySelectorAll("[data-anio]").forEach((el) => (el.textContent = new Date().getFullYear()));
    document.querySelectorAll("[data-logo]").forEach((el) => {
      if (cfg.logo) { el.src = cfg.logo; el.classList.remove("oculto"); }
    });
    const wa = cfg.whatsapp ? T.enlaceWa(cfg.whatsapp, "Hola, vengo del catálogo web 👋") : "";
    document.querySelectorAll("[data-wa]").forEach((el) => {
      if (wa) { el.href = wa; el.classList.remove("oculto"); } else el.classList.add("oculto");
    });
    const redes = document.getElementById("pie-redes");
    if (redes) {
      const r = [];
      if (cfg.whatsapp) r.push('<a href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>');
      if (cfg.instagram) r.push('<a href="https://instagram.com/' + T.esc(String(cfg.instagram).replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, "").replace(/\/$/, "")) + '" target="_blank" rel="noopener">Instagram</a>');
      if (cfg.tiktok) r.push('<a href="https://tiktok.com/@' + T.esc(String(cfg.tiktok).replace(/^@|https?:\/\/(www\.)?tiktok\.com\/@?/g, "").replace(/\/$/, "")) + '" target="_blank" rel="noopener">TikTok</a>');
      if (cfg.correo) r.push('<a href="mailto:' + T.esc(cfg.correo) + '">' + T.esc(cfg.correo) + "</a>");
      if (cfg.direccion) r.push("<span>" + T.esc(cfg.direccion) + "</span>");
      redes.innerHTML = r.join("") || "<span>Escríbenos por nuestras redes.</span>";
    }
    if (T.demo && !document.querySelector(".banda-demo")) {
      const b = document.createElement("div");
      b.className = "banda-demo";
      b.innerHTML = 'Modo demostración: productos de ejemplo. Para conectar la tienda llena <b>js/conexion.js</b> (ver guías).';
      document.body.prepend(b);
    }
    // Menú móvil
    const btnMenu = document.getElementById("abrir-menu");
    const menuMovil = document.getElementById("menu-movil");
    if (btnMenu && menuMovil && !btnMenu.dataset.listo) {
      btnMenu.dataset.listo = "1";
      btnMenu.addEventListener("click", () => {
        const abierto = menuMovil.classList.toggle("oculto") === false;
        btnMenu.setAttribute("aria-expanded", abierto ? "true" : "false");
      });
    }
    const cab = document.querySelector(".cabecera");
    if (cab && !cab.dataset.listo) {
      cab.dataset.listo = "1";
      const f = () => cab.classList.toggle("con-borde", window.scrollY > 8);
      window.addEventListener("scroll", f, { passive: true });
      f();
    }
  };
})();
