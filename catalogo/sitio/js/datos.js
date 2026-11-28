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
    logo: "img/logo-arkeo-blanco.png",
    whatsapp: "",
    instagram: "",
    tiktok: "",
    correo: "",
    telefono: "",
    direccion: "",
    horario: "Lunes a sábado, 9:00 a. m. a 6:00 p. m.",
    mapa: "",
    fotosPaginas: {},
    galeria: [],
    tasaBCV: 0,
    tasaFecha: "",
    minimoMayor: 6,
    ventaMayor: false,
    brecha: 25,
    precioBsAutomatico: true,
    metodosPago: [
      { nombre: "Zelle", moneda: "divisas", detalle: "", activo: true },
      { nombre: "Binance", moneda: "divisas", detalle: "", activo: true },
      { nombre: "Banesco Panamá", moneda: "divisas", detalle: "", activo: true },
      { nombre: "Bizum", moneda: "divisas", detalle: "", activo: false },
      { nombre: "Efectivo en tienda", moneda: "divisas", detalle: "", activo: false },
      { nombre: "Pago móvil / transferencia en Bs", moneda: "bs", detalle: "", activo: false },
    ],
    pocasUnidades: 3,
    diasPedidos: 30,
    workerUrl: "",
    notaEncargo: "Producto por encargo: consulta el tiempo de entrega.",
    categorias: [],
    portada: { titulo: "", subtitulo: "Sillas, escritorios, comedores, barras, espejos y vanity. Precios en divisas y en bolívares, con envíos a toda Venezuela.", boton: "Ver catálogo", imagen: "" },
    inicio: {},
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
    if (!d.inicio || typeof d.inicio !== "object") d.inicio = {};
    if (!d.fotosPaginas || typeof d.fotosPaginas !== "object") d.fotosPaginas = {};
    d.galeria = (Array.isArray(d.galeria) ? d.galeria : []).filter((g) => g && g.foto);
    d.tasaBCV = Number(d.tasaBCV) || 0;
    d.minimoMayor = Math.max(1, parseInt(d.minimoMayor, 10) || 6);
    d.ventaMayor = d.ventaMayor === true;
    d.brecha = Math.max(0, Number(d.brecha) || 0);
    d.precioBsAutomatico = d.precioBsAutomatico !== false;
    if (!Array.isArray(d.metodosPago) || !d.metodosPago.length) d.metodosPago = T.AJUSTES_BASE.metodosPago.map((m) => Object.assign({}, m));
    d.metodosPago = d.metodosPago.filter((m) => m && m.nombre).map((m) => ({ nombre: String(m.nombre), moneda: m.moneda === "bs" ? "bs" : "divisas", detalle: m.detalle || "", activo: m.activo !== false }));
    d.pocasUnidades = Math.max(0, parseInt(d.pocasUnidades, 10) || 0);
    d.workerUrl = String(d.workerUrl || C.WORKER_URL || "").trim().replace(/\/+$/, "");
    T.ajustes = d;
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
        if (T.demoLeer("version") !== 4) {
          ["config", "productos", "pedidos", "proveedores", "privado"].forEach((k) => { try { localStorage.removeItem("demo:" + k); } catch (e) { /* nada */ } });
          T.demoGuardar("version", 4);
        }
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
  /**
   * precio(p, "detal"|"mayor", "divisas"|"bcv") en dólares.
   * "bcv" = pagando en bolívares: precio en divisas + la brecha (%) de Ajustes,
   * que luego se multiplica por la tasa BCV para mostrarlo en Bs.
   */
  T.precio = function (p, tipo, pago) {
    const cfg = T.ajustes || {};
    if (!cfg.ventaMayor) tipo = "detal";
    const dd = num(p.divisa_detal), dm = num(p.divisa_mayor), bd = num(p.bcv_detal), bm = num(p.bcv_mayor);
    const divisa = tipo === "mayor" ? (dm != null ? dm : dd) : dd;
    if (pago === "bcv") {
      if (cfg.precioBsAutomatico !== false) {
        const base = divisa != null ? divisa : (tipo === "mayor" ? (bm != null ? bm : bd) : bd);
        return base == null ? 0 : Math.round(base * (1 + (Number(cfg.brecha) || 0) / 100) * 100) / 100;
      }
      const b = tipo === "mayor" ? (bm != null ? bm : bd) : bd;
      return b != null ? b : divisa != null ? divisa : 0;
    }
    return divisa != null ? divisa : (bd != null ? bd : 0);
  };
  /** Precio en bolívares (0 si no hay tasa cargada) */
  T.precioBs = function (p, tipo) {
    const tasa = Number((T.ajustes || {}).tasaBCV) || 0;
    return tasa ? Math.round(T.precio(p, tipo || "detal", "bcv") * tasa * 100) / 100 : 0;
  };
  T.tieneMayor = (p) => !!(T.ajustes && T.ajustes.ventaMayor) && (num(p.divisa_mayor) != null || num(p.bcv_mayor) != null);
  T.tieneBcv = (p) => ((T.ajustes || {}).precioBsAutomatico !== false) || num(p.bcv_detal) != null || num(p.bcv_mayor) != null;
  T.metodosActivos = () => ((T.ajustes || {}).metodosPago || []).filter((m) => m.activo);

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

  /**
   * Fotos "de ambiente" (con fondo: sala, cocina, showroom) van en los carruseles.
   * En la tarjeta y la ficha del producto se prefiere la foto de fondo blanco.
   */
  const soloFotos = (p) => T.fotos(p).filter((f) => !T.esVideo(f));
  T.fotoObj = function (p, color) {
    let fs = soloFotos(p);
    if (color && fs.some((f) => f.color === color)) fs = fs.filter((f) => f.color === color);
    return fs.find((f) => !f.ambiente) || fs[0] || null;
  };
  T.esAmbiente = function (p, color) {
    const f = T.fotoObj(p, color);
    return !!(f && f.ambiente);
  };
  T.fotoPrincipal = function (p, color) {
    const f = T.fotoObj(p, color);
    return f ? f.url : "img/sin-foto.svg";
  };
  /** Foto real para carruseles (la primera de ambiente; si no hay, la principal) */
  T.fotoAmbiente = function (p) {
    const f = soloFotos(p).find((x) => x.ambiente);
    return f ? f.url : "";
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
  T.negritas = (txt) => T.esc(txt).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

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
      // La cabecera es blanca: el logo de fábrica se muestra en azul marino
      const logo = !cfg.logo || /logo-arkeo-(negro|blanco)\.png$/.test(cfg.logo) ? "img/logo-arkeo-azul.png" : cfg.logo;
      el.src = logo; el.classList.remove("oculto");
    });
    const wa = cfg.whatsapp ? T.enlaceWa(cfg.whatsapp, "Hola, vengo del catálogo web 👋") : "";
    document.querySelectorAll("[data-wa]").forEach((el) => {
      if (wa) { el.href = wa; el.classList.remove("oculto"); } else el.classList.add("oculto");
    });
    document.querySelectorAll("[data-horario]").forEach((el) => { if (cfg.horario) el.textContent = "Showroom abierto · " + cfg.horario; });
    document.querySelectorAll("[data-pie-redes]").forEach((redes) => {
      const r = [];
      if (cfg.whatsapp) r.push('<a href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>');
      if (cfg.instagram) r.push('<a href="https://instagram.com/' + T.esc(String(cfg.instagram).replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, "").replace(/\/$/, "")) + '" target="_blank" rel="noopener">Instagram</a>');
      if (cfg.tiktok) r.push('<a href="https://tiktok.com/@' + T.esc(String(cfg.tiktok).replace(/^@|https?:\/\/(www\.)?tiktok\.com\/@?/g, "").replace(/\/$/, "")) + '" target="_blank" rel="noopener">TikTok</a>');
      if (cfg.correo) r.push('<a href="mailto:' + T.esc(cfg.correo) + '">' + T.esc(cfg.correo) + "</a>");
      if (cfg.direccion) r.push("<span>" + T.esc(cfg.direccion) + "</span>");
      redes.innerHTML = r.join("") || "<span>Escríbenos por nuestras redes.</span>";
    });
    if (T.demo && !document.querySelector(".banda-demo")) {
      const b = document.createElement("div");
      b.className = "banda-demo";
      b.innerHTML = 'Modo demostración: productos de ejemplo. Para conectar la tienda llena <b>js/conexion.js</b> (ver guías).';
      document.body.prepend(b);
    }
    if (!document.getElementById("contador-carrito")) {
      const n = (T.leerMemoria("carrito") || []).reduce((t, x) => t + (Number(x.cantidad) || 0), 0);
      document.querySelectorAll(".contador-nav").forEach((c) => { c.textContent = n ? String(n) : ""; c.dataset.n = String(n); });
    }
    pintarMenus(cfg);
    pintarUbicacion(cfg);
    pintarGaleria(cfg);
    const cab = document.querySelector(".cabecera");
    if (cab && !cab.dataset.listo) {
      cab.dataset.listo = "1";
      const f = () => cab.classList.toggle("con-borde", window.scrollY > 8);
      window.addEventListener("scroll", f, { passive: true });
      f();
    }
  };

  // ---------------------------------------------------------------------
  // Menú de lujo (celular), categorías desplegables (computadora),
  // ubicación en el pie y galería de Instagram. Se usan en todas las páginas.
  // ---------------------------------------------------------------------
  T.CAT_RECORTES = ["archivadores", "bibliotecas-y-gabinetes", "closets-y-hogar", "combos-de-oficina", "comedor", "escritorios", "espejos", "lockers", "mesas-de-barra", "mesas-de-centro", "mesas-de-comedor", "mesas-de-reunion", "poltronas-y-sofas", "recepcion", "sillas-de-barberia", "sillas-de-barra", "sillas-de-cajero", "sillas-de-comedor", "sillas-de-visitante", "sillas-ejecutivas", "sillas-gamer", "sillas-operativas", "sillas-presidenciales", "spa-y-salon", "taburetes", "tandem", "vanity"];
  const FOTOS_FABRICA = ["silla-velvet-negra", "taburete-velvet", "silla-barra-nordica", "vanity-petalo", "silla-patchwork", "taburete-concha"];
  T.FOTO_PAGINA = { pagos: "taburete-velvet", envios: "silla-barra-nordica", resenas: "vanity-petalo", contacto: "silla-patchwork", politicas: "taburete-concha", privacidad: "silla-velvet-negra", catalogo: "taburete-velvet" };
  T.fotoDePagina = function (cfg, slug) {
    return (cfg.fotosPaginas && cfg.fotosPaginas[slug]) || "img/fotos/" + (T.FOTO_PAGINA[slug] || FOTOS_FABRICA[0]) + ".webp";
  };
  T.instagramUsuario = (cfg) => String(cfg.instagram || "").replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, "").replace(/\/.*$/, "");
  T.enlaceMapa = function (cfg) {
    if (cfg.mapa) return cfg.mapa;
    if (!cfg.direccion) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cfg.direccion + (/venezuela/i.test(cfg.direccion) ? "" : ", Venezuela"));
  };
  const ic = (n) => (window.icono ? window.icono(n) : "");

  // Categorías con productos (usa el catálogo guardado en el teléfono) y una foto de cada una
  function categoriasMenu(cfg) {
    const prods = ((T.demo ? T.demoLeer && T.demoLeer("productos") : T.leerMemoria("productos")) || []).filter((p) => p && p.disponible !== false);
    const base = (cfg.categorias || []).map((c) => (typeof c === "string" ? { nombre: c } : c)).filter((c) => c && c.nombre);
    const nombres = base.map((c) => c.nombre);
    prods.forEach((p) => { if (p.categoria && !nombres.includes(p.categoria)) { nombres.push(p.categoria); base.push({ nombre: p.categoria }); } });
    return base.map((c) => {
      const de = prods.filter((p) => p.categoria === c.nombre);
      const conFoto = de.find((p) => T.fotos(p).length);
      const recorte = c.foto || (T.CAT_RECORTES.includes(T.slug(c.nombre)) ? "img/categorias/" + T.slug(c.nombre) + ".webp" : "");
      return { nombre: c.nombre, icono: c.icono || "silla", n: de.length, foto: recorte || (conFoto ? T.fotoPrincipal(conFoto) : ""), recorte: !!recorte };
    }).filter((c) => !prods.length || c.n > 0);
  }

  function pintarMenus(cfg) {
    const cats = categoriasMenu(cfg);
    const enlaceCat = (c) => "catalogo.html?cat=" + encodeURIComponent(c.nombre);
    const ig = T.instagramUsuario(cfg);
    const wa = cfg.whatsapp ? T.enlaceWa(cfg.whatsapp, "Hola, vengo de la página web 👋") : "";
    const mapa = T.enlaceMapa(cfg);
    const actual = document.body.dataset.pagina;

    // Desplegable de categorías (computadora)
    const mega = document.querySelector("[data-mega]");
    if (mega) {
      const foto = (cfg.portada && cfg.portada.imagen) || "img/fotos/taburete-velvet.webp";
      mega.innerHTML = '<div class="mega-cats">' + cats.map((c) =>
        '<a href="' + enlaceCat(c) + '"><span class="mega-img">' + (c.foto ? '<img src="' + T.esc(c.foto) + '" alt="" loading="lazy"' + (c.recorte ? ' class="recorte"' : "") + ">" : ic(c.icono)) + "</span><span><b>" + T.esc(c.nombre) + "</b>" + (c.n ? "<small>" + c.n + (c.n === 1 ? " producto" : " productos") + "</small>" : "") + "</span></a>").join("") + "</div>" +
        '<a class="mega-destacado" href="catalogo.html" style="background-image:linear-gradient(180deg,rgba(5,51,89,.05),rgba(3,36,65,.85)),url(\'' + T.esc(foto) + '\')"><small>Colección ' + new Date().getFullYear() + "</small><b>Ver todo el catálogo</b><span>" + ic("flecha") + "</span></a>";
      const btn = document.getElementById("menu-cats-boton");
      const caja = btn && btn.parentElement;
      if (btn && !btn.dataset.listo) {
        btn.dataset.listo = "1";
        let t = null;
        const abrir = (si) => { clearTimeout(t); caja.classList.toggle("abierto", si); btn.setAttribute("aria-expanded", si ? "true" : "false"); };
        btn.addEventListener("click", () => abrir(!caja.classList.contains("abierto")));
        caja.addEventListener("mouseenter", () => { if (matchMedia("(hover: hover)").matches) abrir(true); });
        caja.addEventListener("mouseleave", () => { t = setTimeout(() => abrir(false), 180); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") abrir(false); });
        document.addEventListener("click", (e) => { if (!caja.contains(e.target)) abrir(false); });
      }
    }

    // Categorías en el pie
    document.querySelectorAll("[data-pie-cats]").forEach((pieCats) => { pieCats.innerHTML = cats.slice(0, 7).map((c) => '<a href="' + enlaceCat(c) + '">' + T.esc(c.nombre) + "</a>").join(""); });

    // Menú de lujo (pantalla completa en el celular)
    const ml = document.querySelector("[data-menu-lujo]");
    if (!ml) return;
    const num = (n) => "<small>" + String(n).padStart(2, "0") + "</small>";
    const item = (n, href, texto, slug) => '<a class="ml-enlace" href="' + href + '"' + (slug === actual ? ' aria-current="page"' : "") + ' style="--i:' + n + '">' + num(n) + "<span>" + texto + "</span>" + ic("flecha") + "</a>";
    const abierto = ml.classList.contains("abierto");
    ml.innerHTML = '<div class="ml-fondo" data-cerrar-menu></div><div class="ml-panel" role="dialog" aria-modal="true" aria-label="Menú">' +
      '<div class="ml-cabeza"><img src="img/logo-arkeo-blanco.png" alt="ARKEO Home &amp; Office"><button class="ml-cerrar" data-cerrar-menu aria-label="Cerrar menú">' + ic("cerrar") + "</button></div>" +
      '<nav class="ml-enlaces">' + item(1, "./", "Inicio", "inicio") +
      '<button type="button" class="ml-enlace ml-desplegar" aria-expanded="false" style="--i:2">' + num(2) + "<span>Categorías</span>" + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>' +
      '<div class="ml-cats"><div>' + cats.map((c) => '<a href="' + enlaceCat(c) + '">' + (c.foto ? '<img src="' + T.esc(c.foto) + '" alt="" loading="lazy"' + (c.recorte ? ' class="recorte"' : "") + ">" : '<i>' + ic(c.icono) + "</i>") + "<span>" + T.esc(c.nombre) + "</span></a>").join("") +
        '<a class="ml-todo" href="catalogo.html"><i>' + ic("flecha") + "</i><span>Ver todo</span></a></div></div>" +
      item(3, "catalogo.html", "Catálogo", "catalogo") + item(4, "pagos.html", "Métodos de pago", "pagos") + item(5, "envios.html", "Envíos", "envios") +
      item(6, "resenas.html", "Reseñas", "resenas") + item(7, "contacto.html", "Contacto", "contacto") + "</nav>" +
      '<div class="ml-pie">' +
        (wa ? '<a class="boton blanco ml-wa" href="' + wa + '" target="_blank" rel="noopener">' + ic("whatsapp") + "Escríbenos por WhatsApp</a>" : "") +
        '<div class="ml-datos">' +
          (ig ? '<a href="https://instagram.com/' + T.esc(ig) + '" target="_blank" rel="noopener">' + ic("instagram") + "<span>@" + T.esc(ig) + "</span></a>" : "") +
          (cfg.direccion ? '<a href="' + T.esc(mapa) + '" target="_blank" rel="noopener">' + ic("ubicacion") + "<span>" + T.esc(cfg.direccion) + "</span></a>" : "") +
          (cfg.telefono ? '<span class="ml-tel">' + ic("telefono") + "<span>" + T.esc(cfg.telefono) + "</span></span>" : "") +
        "</div></div></div>";
    if (abierto) ml.classList.add("abierto");
    const btn = document.getElementById("abrir-menu");
    const abrir = (si) => {
      ml.classList.toggle("abierto", si);
      ml.setAttribute("aria-hidden", si ? "false" : "true");
      document.body.classList.toggle("menu-abierto", si);
      if (btn) btn.setAttribute("aria-expanded", si ? "true" : "false");
    };
    if (btn && !btn.dataset.listo) {
      btn.dataset.listo = "1";
      btn.addEventListener("click", () => abrir(!ml.classList.contains("abierto")));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ml.classList.contains("abierto")) abrir(false); });
    }
    ml.onclick = (e) => {
      if (e.target.closest("[data-cerrar-menu]")) { abrir(false); return; }
      const d = e.target.closest(".ml-desplegar");
      if (d) { const si = d.getAttribute("aria-expanded") !== "true"; d.setAttribute("aria-expanded", si); d.nextElementSibling.classList.toggle("abierta", si); return; }
      if (e.target.closest("a")) abrir(false);
    };
  }

  function pintarUbicacion(cfg) {
    const el = document.getElementById("pie-ubicacion");
    if (!el) return;
    if (!cfg.direccion) { el.classList.add("oculto"); return; }
    const q = encodeURIComponent(cfg.direccion + (/venezuela/i.test(cfg.direccion) ? "" : ", Venezuela"));
    const clave = cfg.direccion;
    el.classList.remove("oculto");
    if (el.dataset.dir === clave) return; // no recargar el mapa
    el.dataset.dir = clave;
    el.innerHTML = '<div class="ubi-texto"><small>Ubicación</small><h2>Visita nuestro showroom</h2><p class="ubi-dir">' + ic("ubicacion") + "<span>" + T.esc(cfg.direccion) + "</span></p>" +
      (cfg.horario ? '<p class="ubi-hora">' + ic("reloj") + "<span>" + T.esc(cfg.horario) + "</span></p>" : "") +
      '<a class="boton blanco" href="' + T.esc(T.enlaceMapa(cfg)) + '" target="_blank" rel="noopener">Cómo llegar ' + ic("flecha") + "</a></div>" +
      '<div class="ubi-mapa"><iframe title="Mapa de ' + T.esc(cfg.nombreTienda || "la tienda") + '" src="https://www.google.com/maps?q=' + q + '&amp;z=15&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>';
  }

  function pintarGaleria(cfg) {
    const el = document.querySelector("[data-galeria]");
    if (!el) return;
    const ig = T.instagramUsuario(cfg);
    const perfil = ig ? "https://instagram.com/" + ig : "";
    let fotos = (cfg.galeria || []).slice(0, 12);
    if (!fotos.length) fotos = FOTOS_FABRICA.map((f) => ({ foto: "img/fotos/" + f + "-m.webp", enlace: "" }));
    if (!perfil && !fotos.some((f) => f.enlace)) { el.classList.add("oculto"); return; }
    el.classList.remove("oculto");
    el.innerHTML = '<div class="titulo-bloque"><div><small>Instagram</small><h2>' + (ig ? "@" + T.esc(ig) : "Síguenos") + "</h2></div>" +
      (perfil ? '<a class="boton" href="' + perfil + '" target="_blank" rel="noopener">' + ic("instagram") + "Seguir en Instagram</a>" : "") + "</div>" +
      '<div class="galeria-rejilla">' + fotos.map((f, i) => {
        const href = f.enlace || perfil;
        return '<a href="' + T.esc(href) + '" target="_blank" rel="noopener" style="--i:' + i + '"><img src="' + T.esc(f.foto) + '" alt="Foto de Instagram ' + (i + 1) + '" loading="lazy"><span>' + ic("instagram") + "</span></a>";
      }).join("") + "</div>";
  }
})();
