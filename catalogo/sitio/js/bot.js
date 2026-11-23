/* bot.js — asistente sencillo de la página de Contacto.
   Hace unas preguntas, una por una, como un chat, y al final arma el mensaje
   y abre WhatsApp con todo listo para enviar. No guarda nada en la base de datos. */
(function () {
  const T = window.Tienda;
  const esc = T.esc;
  const raiz = document.getElementById("bot-contacto");
  if (!raiz) return;

  const ic = (n) => (window.icono ? window.icono(n) : "");
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cfg = T.unirAjustes(T.leerMemoria("config") || {});

  // Las preguntas. tipo "texto" = escribe; "opciones" = toca una (o escribe otra cosa).
  function preguntas() {
    const cats = (cfg.categorias || []).map((c) => (typeof c === "string" ? c : c.nombre)).filter(Boolean).slice(0, 8);
    return [
      { clave: "nombre", tipo: "texto", texto: () => "¡Hola! 👋 Soy el asistente de " + (cfg.nombreTienda || "ARKEO") + ". ¿Cómo te llamas?", placeholder: "Tu nombre", minimo: 2 },
      { clave: "busca", tipo: "opciones", texto: (r) => "Mucho gusto, " + primerNombre(r.nombre) + ". ¿Qué estás buscando?", opciones: cats.concat("Otro"), placeholder: "O escribe lo que buscas" },
      { clave: "espacio", tipo: "opciones", texto: () => "¿Es para tu casa o para una oficina?", opciones: ["Casa", "Oficina", "Ambos"] },
      { clave: "cantidad", tipo: "opciones", texto: () => "¿Cuántas piezas necesitas más o menos?", opciones: ["1", "2 a 5", "6 a 10", "Más de 10"] },
      { clave: "ciudad", tipo: "texto", texto: () => "¿En qué ciudad estás? Así te decimos cómo te llega.", placeholder: "Ej.: Valencia, Carabobo", minimo: 3 },
      { clave: "entrega", tipo: "opciones", texto: () => "¿Cómo prefieres recibirlo?", opciones: ["Envío a mi ciudad", "Retiro en el showroom", "Aún no sé"] },
      { clave: "notas", tipo: "texto", texto: () => "Por último, ¿algo más que debamos saber? (color, medidas, presupuesto…)", placeholder: "Escribe aquí o toca Omitir", opcional: true },
    ];
  }
  const ETIQUETAS = { nombre: "Nombre", busca: "Busca", espacio: "Para", cantidad: "Cantidad", ciudad: "Ciudad", entrega: "Entrega", notas: "Notas" };
  const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";

  let paso = -1; // -1 = bienvenida
  let resp = {};
  let PREG = preguntas();

  function bienvenida() {
    paso = -1; resp = {}; PREG = preguntas();
    raiz.innerHTML =
      '<div class="bot-tarjeta bot-entrada">' +
        '<span class="bot-avatar grande">' + ic("whatsapp") + "</span>" +
        "<small>Asistente de pedidos</small>" +
        "<h2>Cuéntanos qué necesitas</h2>" +
        "<p>Responde unas preguntas cortas y te llevamos a WhatsApp con tu solicitud lista. Toma menos de un minuto.</p>" +
        '<button class="boton bot-empezar" data-bot="empezar">Empezar ' + ic("flecha") + "</button>" +
      "</div>";
  }

  function marco() {
    raiz.innerHTML =
      '<div class="bot-tarjeta bot-chat">' +
        '<div class="bot-cabeza"><span class="bot-avatar">' + ic("whatsapp") + '</span><div><b>' + esc(cfg.nombreTienda || "ARKEO") + '</b><small><i></i> En línea</small></div>' +
          '<button class="bot-reiniciar" data-bot="reiniciar" aria-label="Empezar de nuevo">' + ic("cerrar") + "</button></div>" +
        '<div class="bot-progreso" aria-hidden="true"><i id="bot-barra"></i></div>' +
        '<div class="bot-mensajes" id="bot-mensajes" aria-live="polite"></div>' +
        '<div class="bot-entrada-zona" id="bot-zona"></div>' +
      "</div>";
  }

  const mensajes = () => document.getElementById("bot-mensajes");
  function bajar() { const m = mensajes(); if (m) m.scrollTo({ top: m.scrollHeight, behavior: quieto ? "auto" : "smooth" }); }
  function progreso() {
    const b = document.getElementById("bot-barra");
    if (b) b.style.width = Math.round((Math.max(0, paso) / PREG.length) * 100) + "%";
  }

  // Mensaje del asistente: primero "escribiendo…", luego el texto letra por letra
  function decir(texto) {
    return new Promise((listo) => {
      const m = mensajes();
      const b = document.createElement("div");
      b.className = "bot-burbuja suya";
      b.innerHTML = '<span class="bot-escribe"><i></i><i></i><i></i></span>';
      m.appendChild(b); bajar();
      setTimeout(() => {
        if (quieto) { b.textContent = texto; bajar(); listo(); return; }
        b.textContent = "";
        let i = 0;
        const tic = () => {
          if (!b.isConnected) return listo();
          b.textContent = texto.slice(0, ++i);
          if (i % 6 === 0) bajar();
          if (i < texto.length) setTimeout(tic, /[.!?,]/.test(texto[i - 1]) ? 60 : 16);
          else { bajar(); listo(); }
        };
        tic();
      }, quieto ? 0 : 550);
    });
  }
  function responder(texto) {
    const b = document.createElement("div");
    b.className = "bot-burbuja mia";
    b.textContent = texto;
    mensajes().appendChild(b); bajar();
  }

  async function preguntar() {
    progreso();
    const zona = document.getElementById("bot-zona");
    zona.innerHTML = "";
    if (paso >= PREG.length) return resumen();
    const q = PREG[paso];
    await decir(q.texto(resp));
    if (!document.getElementById("bot-zona")) return;
    let h = "";
    if (q.tipo === "opciones") h += '<div class="bot-opciones">' + q.opciones.map((o) => '<button type="button" data-opcion="' + esc(o) + '">' + esc(o) + "</button>").join("") + "</div>";
    if (q.tipo === "texto" || (q.tipo === "opciones" && q.placeholder)) {
      h += '<form class="bot-escribir" id="bot-form" autocomplete="on"><input id="bot-input" ' + (q.clave === "nombre" ? 'autocomplete="given-name" ' : q.clave === "ciudad" ? 'autocomplete="address-level2" ' : "") +
        'placeholder="' + esc(q.placeholder || "Escribe tu respuesta") + '" maxlength="300" aria-label="' + esc(q.placeholder || "Respuesta") + '">' +
        '<button type="submit" aria-label="Enviar respuesta">' + ic("flecha") + "</button></form>" +
        (q.opcional ? '<button type="button" class="bot-omitir" data-bot="omitir">Omitir</button>' : "") +
        '<p class="bot-error" id="bot-error" role="alert"></p>';
    }
    zona.innerHTML = h;
    zona.classList.remove("aparece"); void zona.offsetWidth; zona.classList.add("aparece");
    const inp = document.getElementById("bot-input");
    if (inp && q.tipo === "texto" && matchMedia("(hover: hover)").matches) inp.focus({ preventScroll: true });
    bajar();
  }

  function guardar(valor) {
    const q = PREG[paso];
    valor = String(valor || "").trim();
    if (!valor && !q.opcional) return error("Escribe tu respuesta para continuar.");
    if (valor && q.minimo && valor.length < q.minimo) return error("Escribe un poco más, por favor.");
    resp[q.clave] = valor;
    document.getElementById("bot-zona").innerHTML = "";
    responder(valor || "Omitir");
    paso++;
    setTimeout(preguntar, quieto ? 0 : 250);
  }
  function error(t) { const e = document.getElementById("bot-error"); if (e) e.textContent = t; }

  function mensajeWa() {
    const l = ["Hola, vengo de la página web 👋", ""];
    PREG.forEach((q) => { if (resp[q.clave]) l.push("*" + ETIQUETAS[q.clave] + ":* " + resp[q.clave]); });
    l.push("", "¿Me pueden asesorar?");
    return l.join("\n");
  }

  async function resumen() {
    progreso();
    await decir("¡Listo, " + primerNombre(resp.nombre) + "! Revisa tu solicitud y tócala para enviarla por WhatsApp.");
    const zona = document.getElementById("bot-zona");
    if (!zona) return;
    const filas = PREG.filter((q) => resp[q.clave]).map((q) => "<div><span>" + ETIQUETAS[q.clave] + "</span><b>" + esc(resp[q.clave]) + "</b></div>").join("");
    const wa = cfg.whatsapp ? T.enlaceWa(cfg.whatsapp, mensajeWa()) : "";
    zona.innerHTML = '<div class="bot-resumen"><div class="bot-check">' + ic("check") + "</div>" + filas + "</div>" +
      (wa ? '<a class="boton whatsapp bot-enviar" href="' + esc(wa) + '" target="_blank" rel="noopener">' + ic("whatsapp") + "Enviar por WhatsApp</a>"
          : '<p class="bot-error">Falta el número de WhatsApp de la tienda (Ajustes › Contacto).</p>') +
      '<button type="button" class="bot-omitir" data-bot="reiniciar">Empezar de nuevo</button>';
    zona.classList.remove("aparece"); void zona.offsetWidth; zona.classList.add("aparece");
    bajar();
  }

  raiz.addEventListener("click", (e) => {
    const b = e.target.closest("[data-bot], [data-opcion]");
    if (!b) return;
    if (b.dataset.bot === "empezar") { marco(); paso = 0; preguntar(); return; }
    if (b.dataset.bot === "reiniciar") { bienvenida(); return; }
    if (b.dataset.bot === "omitir") { guardar(""); return; }
    if (b.dataset.opcion !== undefined) guardar(b.dataset.opcion);
  });
  raiz.addEventListener("submit", (e) => {
    if (e.target.id !== "bot-form") return;
    e.preventDefault();
    guardar(document.getElementById("bot-input").value);
  });

  bienvenida();
  T.cargarConfig().then((c) => { cfg = c; if (paso === -1) PREG = preguntas(); }).catch(() => { /* se usa lo guardado */ });
})();
