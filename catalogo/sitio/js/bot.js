/* bot.js — Contacto estilo chat (página contacto.html).
   Hace unas preguntas, una por una, y al final abre WhatsApp con la solicitud lista.
   No guarda nada en la base de datos. */
(function () {
  const T = window.Tienda;
  const esc = T.esc;
  const raiz = document.getElementById("bot-contacto");
  if (!raiz) return;

  const ic = (n) => (window.icono ? window.icono(n) : "");
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cfg = T.unirAjustes(T.leerMemoria("config") || {});
  const nombreTienda = () => cfg.nombreTienda || "ARKEO";
  const AVATAR = '<img src="img/marca-silla-blanca.png" alt="" width="14" height="20">';
  const FLECHA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  const WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M12 2C6.48 2 2 6.48 2 12c0 1.89.53 3.66 1.44 5.17L2 22l4.98-1.41A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>';

  function preguntas() {
    const cats = (cfg.categorias || []).map((c) => (typeof c === "string" ? c : c.nombre)).filter(Boolean).slice(0, 8);
    return [
      { clave: "nombre", tipo: "texto", texto: () => "¡Hola! ¿Cómo te llamas? 😊", placeholder: "Tu nombre…", minimo: 2 },
      { clave: "busca", tipo: "opciones", texto: (r) => "¡Mucho gusto, " + primerNombre(r.nombre) + "! ¿Qué estás buscando?", opciones: cats.concat("Otro"), escribir: "O escribe lo que buscas…" },
      { clave: "espacio", tipo: "opciones", texto: () => "¿Es para tu casa o para una oficina?", opciones: ["🏠 Casa", "🏢 Oficina", "Ambos"] },
      { clave: "cantidad", tipo: "opciones", texto: () => "¿Cuántas piezas necesitas más o menos?", opciones: ["1", "2 a 5", "6 a 10", "Más de 10"] },
      { clave: "ciudad", tipo: "texto", texto: () => "¿En qué ciudad estás? Así te decimos cómo te llega 🚚", placeholder: "Ej.: Valencia, Carabobo", minimo: 3 },
      { clave: "entrega", tipo: "opciones", texto: () => "¿Cómo prefieres recibirlo?", opciones: ["Envío a mi ciudad", "Retiro en el showroom", "Aún no sé"] },
      { clave: "notas", tipo: "texto", texto: () => "¿Algo más que debamos saber? Color, medidas, presupuesto… (opcional)", placeholder: "Escribe aquí o toca Omitir…", opcional: true },
    ];
  }
  const ETIQUETAS = { nombre: "Nombre", busca: "Busca", espacio: "Para", cantidad: "Cantidad", ciudad: "Ciudad", entrega: "Entrega", notas: "Notas" };
  const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const limpio = (v) => String(v || "").replace(/^[^\p{L}\p{N}]+/u, "").trim(); // quita el emoji del inicio

  let paso = -1;
  let resp = {};
  let PREG = preguntas();
  let ronda = 0; // para cortar animaciones viejas al empezar de nuevo

  // ---------- Estructura ----------
  raiz.innerHTML =
    '<div class="cc-fondo" aria-hidden="true"></div><div class="cc-rejilla" aria-hidden="true"></div>' +
    '<div class="cc-caja">' +
      '<div class="cc-cabeza"><span class="cc-avatar">' + AVATAR + '</span><div class="cc-cabeza-info"><b id="cc-nombre"></b><small><i></i>En línea ahora</small></div>' +
        '<button type="button" class="cc-reiniciar oculto" data-bot="reiniciar" aria-label="Empezar de nuevo" title="Empezar de nuevo">' + ic("cerrar") + "</button></div>" +
      '<div class="cc-progreso" aria-hidden="true"><div><i id="cc-barra"></i></div></div>' +
      '<div class="cc-mensajes" id="cc-mensajes" aria-live="polite"></div>' +
      '<div class="cc-entrada oculto" id="cc-entrada"></div>' +
    "</div>";
  const msgs = document.getElementById("cc-mensajes");
  const entrada = document.getElementById("cc-entrada");
  const barra = document.getElementById("cc-barra");

  function bajar() { msgs.scrollTop = msgs.scrollHeight; }
  function progreso(p) { barra.style.width = p + "%"; }

  function bienvenida() {
    ronda++;
    paso = -1; resp = {}; PREG = preguntas();
    document.getElementById("cc-nombre").textContent = nombreTienda();
    raiz.querySelector(".cc-reiniciar").classList.add("oculto");
    entrada.classList.add("oculto"); entrada.innerHTML = "";
    progreso(0);
    msgs.innerHTML =
      '<div class="cc-bienvenida">' +
        '<div class="cc-bienvenida-emoji">👋</div>' +
        '<h2 class="cc-bienvenida-titulo">¡Bienvenido a <span>' + esc(nombreTienda()) + "</span>!</h2>" +
        '<p class="cc-bienvenida-sub">Te hacemos unas preguntas rápidas para saber qué mueble necesitas y ayudarte mejor.</p>' +
        '<button type="button" class="cc-empezar" data-bot="empezar">Comenzar ' + FLECHA + "</button>" +
      "</div>";
  }

  // Mensaje del asistente: puntos de "escribiendo", luego el texto letra por letra
  function decir(texto) {
    const mia = ronda;
    return new Promise((listo) => {
      const fila = document.createElement("div");
      fila.className = "cc-msg-suyo";
      fila.innerHTML = '<span class="cc-msg-avatar">' + AVATAR + '</span><div class="cc-burbuja-suya"><div class="cc-escribe"><span></span><span></span><span></span></div></div>';
      msgs.appendChild(fila); bajar();
      const burbuja = fila.querySelector(".cc-burbuja-suya");
      setTimeout(() => {
        if (mia !== ronda) return;
        if (quieto) { burbuja.textContent = texto; bajar(); return listo(); }
        burbuja.textContent = "";
        const letras = Array.from(texto);
        let i = 0;
        const tic = () => {
          if (mia !== ronda) return;
          burbuja.textContent += letras[i++];
          bajar();
          if (i < letras.length) setTimeout(tic, 12);
          else listo();
        };
        tic();
      }, quieto ? 0 : Math.min(texto.length * 18, 1100));
    });
  }
  function responder(texto) {
    const fila = document.createElement("div");
    fila.className = "cc-msg-mio";
    fila.innerHTML = '<div class="cc-burbuja-mia"></div>';
    fila.firstChild.textContent = texto;
    msgs.appendChild(fila); bajar();
  }

  async function siguiente() {
    if (paso >= PREG.length) return fin();
    const q = PREG[paso];
    progreso(Math.round(((paso + 0.5) / PREG.length) * 95));
    const mia = ronda;
    await decir(q.texto(resp));
    if (mia !== ronda) return;
    mostrarEntrada(q);
  }

  function mostrarEntrada(q) {
    let h = "";
    if (q.tipo === "opciones") h += '<div class="cc-opciones">' + q.opciones.map((o) => '<button type="button" class="cc-opcion" data-opcion="' + esc(o) + '">' + esc(o) + "</button>").join("") + "</div>";
    if (q.tipo === "texto" || q.escribir) {
      h += '<form class="cc-fila-texto" id="cc-form"><input class="cc-texto" id="cc-texto" type="text" maxlength="300" ' +
        (q.clave === "nombre" ? 'autocomplete="given-name" ' : q.clave === "ciudad" ? 'autocomplete="address-level2" ' : 'autocomplete="off" ') +
        'placeholder="' + esc(q.placeholder || q.escribir || "Escribe tu respuesta…") + '" aria-label="' + esc(q.placeholder || q.escribir || "Respuesta") + '">' +
        '<button type="submit" class="cc-enviar" aria-label="Enviar">' + FLECHA + "</button></form>";
    }
    if (q.opcional) h += '<button type="button" class="cc-omitir" data-bot="omitir">Omitir</button>';
    h += '<p class="cc-error" id="cc-error" role="alert"></p>';
    entrada.innerHTML = h;
    entrada.classList.remove("oculto");
    const inp = document.getElementById("cc-texto");
    if (inp && q.tipo === "texto" && matchMedia("(hover: hover)").matches) inp.focus({ preventScroll: true });
  }

  function guardar(valor) {
    const q = PREG[paso];
    if (!q) return;
    valor = String(valor || "").trim();
    const e = document.getElementById("cc-error");
    if (!valor && !q.opcional) { if (e) e.textContent = "Escribe tu respuesta para continuar."; return; }
    if (valor && q.minimo && valor.length < q.minimo) { if (e) e.textContent = "Escribe un poco más, por favor."; return; }
    resp[q.clave] = valor ? limpio(valor) || valor : "";
    entrada.classList.add("oculto"); entrada.innerHTML = "";
    responder(valor || "Omitir");
    paso++;
    setTimeout(siguiente, quieto ? 0 : 600);
  }

  function mensajeWa() {
    const l = ["Hola, vengo de la página web 👋", ""];
    PREG.forEach((q) => { if (resp[q.clave]) l.push("*" + ETIQUETAS[q.clave] + ":* " + resp[q.clave]); });
    l.push("", "¿Me pueden asesorar?");
    return l.join("\n");
  }

  function fin() {
    progreso(100);
    const mia = ronda;
    setTimeout(() => {
      if (mia !== ronda) return;
      const wa = cfg.whatsapp ? T.enlaceWa(cfg.whatsapp, mensajeWa()) : "";
      const filas = PREG.filter((q) => resp[q.clave]).map((q) => "<div><span>" + ETIQUETAS[q.clave] + "</span><b>" + esc(resp[q.clave]) + "</b></div>").join("");
      const listo = document.createElement("div");
      listo.className = "cc-listo";
      listo.innerHTML =
        '<div class="cc-listo-check">✓</div>' +
        '<div class="cc-listo-titulo">¡Listo, ' + esc(primerNombre(resp.nombre)) + "! 🎉</div>" +
        '<div class="cc-listo-sub">Revisa tu solicitud y envíala por WhatsApp. Te respondemos enseguida.</div>' +
        '<div class="cc-resumen">' + filas + "</div>" +
        (wa ? '<a class="cc-boton-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + WA + "Enviar por WhatsApp</a>"
            : '<p class="cc-error">Falta el número de WhatsApp de la tienda (Ajustes › Contacto).</p>') +
        '<button type="button" class="cc-omitir" data-bot="reiniciar">Empezar de nuevo</button>';
      msgs.appendChild(listo); bajar();
    }, quieto ? 0 : 500);
  }

  raiz.addEventListener("click", (e) => {
    const b = e.target.closest("[data-bot], [data-opcion]");
    if (!b) return;
    if (b.dataset.bot === "empezar") {
      ronda++;
      msgs.innerHTML = "";
      raiz.querySelector(".cc-reiniciar").classList.remove("oculto");
      paso = 0; progreso(5);
      setTimeout(siguiente, quieto ? 0 : 300);
      return;
    }
    if (b.dataset.bot === "reiniciar") { bienvenida(); return; }
    if (b.dataset.bot === "omitir") { guardar(""); return; }
    if (b.dataset.opcion !== undefined) guardar(b.dataset.opcion);
  });
  raiz.addEventListener("submit", (e) => {
    if (e.target.id !== "cc-form") return;
    e.preventDefault();
    guardar(document.getElementById("cc-texto").value);
  });

  bienvenida();
  T.cargarConfig().then((c) => { cfg = c; if (paso === -1) bienvenida(); }).catch(() => { /* se usa lo guardado */ });
})();
