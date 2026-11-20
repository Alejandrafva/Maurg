/* =====================================================================
   orbita.js — Vitrina de productos destacados en órbita.
   La sección se queda fija mientras bajas la página; cada tramo de
   scroll trae el siguiente producto: el actual sale girando por arriba
   y el siguiente entra por el otro lado. El título se borra y se vuelve
   a escribir, la tarjeta cambia y el arco de color gira y toma el color
   del producto. También se maneja con flechas, miniaturas, puntos,
   teclado y deslizando el dedo.
   Sin librerías: Web Animations API.
   ===================================================================== */
(function () {
  const T = window.Tienda;
  const esc = T.esc;
  const MAX = 8;            // productos en la vitrina
  const POR_PRODUCTO = 0.7; // alturas de pantalla de scroll por producto
  const GIRO = 42;          // grados que gira cada mueble alrededor del pivote
  const REPOSO = [[66, 104], [72, 118], [60, 98], [76, 112]];
  const BARRIDO = [44, 136];
  const OCULTO_1 = "inset(0% 0% 0% 100%)";
  const OCULTO_2 = "inset(0% 100% 0% 0%)";
  const VISIBLE = "inset(0% 0% 0% 0%)";

  let S = null; // estado de la vitrina actual

  const reducido = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function trazoArco(a0, a1, cx, cy, r, w, pasos) {
    pasos = pasos || 48;
    const fuera = [], dentro = [];
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
      const h = (w / 2) * Math.pow(Math.sin(Math.PI * t), 0.45);
      const c = Math.cos(a), s = Math.sin(a);
      fuera.push((cx + c * (r + h)).toFixed(1) + " " + (cy + s * (r + h)).toFixed(1));
      dentro.push((cx + c * (r - h)).toFixed(1) + " " + (cy + s * (r - h)).toFixed(1));
    }
    return "M" + fuera.join("L") + "L" + dentro.reverse().join("L") + "Z";
  }

  function colorDe(p) {
    const c = T.colores(p).find((x) => /^#[0-9a-f]{6}$/i.test(x.hex));
    if (!c) return "#053359";
    const n = parseInt(c.hex.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.85 ? "#a8a6a7" : c.hex; // los colores muy claros no se verían sobre el fondo
  }

  function elegir(productos) {
    // Las fotos de ambiente van en la portada; aquí lucen las fotos recortadas
    const conFoto = productos.filter((p) => p.disponible !== false && T.fotos(p).some((f) => !T.esVideo(f)) && !T.esAmbiente(p));
    const dest = conFoto.filter((p) => p.destacado);
    const lista = dest.length >= 2 ? dest : conFoto;
    return lista.slice(0, MAX);
  }

  // ---------------------------------------------------------------------
  function pintar(productos, cfg, acciones) {
    const raiz = document.getElementById("orbita");
    if (!raiz) return;
    const items = elegir(productos);
    const firma = items.map((p) => p.id + ":" + T.fotoPrincipal(p) + ":" + T.precio(p, "detal", "divisas") + ":" + T.stockDe(p)).join("|");
    if (S && S.firma === firma) { S.cfg = cfg; S.acciones = acciones; return; }
    if (S) desmontar();
    if (items.length < 2) { raiz.hidden = true; return; }
    raiz.hidden = false;

    const n = items.length;
    raiz.innerHTML =
      '<div class="orbita-pista">' +
      '<div class="orbita-escena" tabindex="0" role="region" aria-roledescription="carrusel" aria-label="Productos destacados">' +
      '<svg class="orbita-arco" aria-hidden="true"><path/></svg>' +
      '<div class="contenedor orbita-rejilla">' +
      '<div class="orbita-puntos" role="tablist" aria-label="Elegir producto">' +
      items.map((p, i) => '<button class="orbita-punto" role="tab" data-ir="' + i + '" aria-label="' + esc(p.nombre) + '"><i></i></button>').join("") +
      "</div>" +
      '<div class="orbita-platos">' +
      items.map((p, i) => '<button class="orbita-plato" data-abrir-orbita="' + i + '" tabindex="-1" aria-hidden="true"><img src="' + esc(T.fotoPrincipal(p)) + '" alt="' + esc(p.nombre) + '" draggable="false"' + (i > 1 ? ' loading="lazy"' : "") + "></button>").join("") +
      "</div>" +
      '<div class="orbita-contador" aria-hidden="true"><b>01</b><span>/ ' + String(n).padStart(2, "0") + "</span></div>" +
      '<div class="orbita-texto"><p class="orbita-ceja"></p><h2 class="orbita-titulo"><span class="t1"></span><span class="t2"></span></h2>' +
      '<div class="orbita-acciones"><button class="orbita-link" data-orbita="ver">' + icono("ojo") + "Ver ficha</button>" +
      '<button class="orbita-link" data-orbita="agregar">' + icono("bolsa") + "Agregar al pedido</button></div></div>" +
      '<div class="orbita-tarjeta" aria-live="polite"></div>' +
      '<div class="orbita-tira">' +
      '<button class="orbita-flecha" data-paso="-1" aria-label="Anterior">' + icono("izquierda") + "</button>" +
      '<div class="orbita-miniaturas">' +
      items.map((p, i) => '<button class="orbita-mini" data-ir="' + i + '"><img src="' + esc(T.fotoPrincipal(p)) + '" alt="" loading="lazy"><span>' + esc(p.nombre) + "</span></button>").join("") +
      "</div>" +
      '<button class="orbita-flecha" data-paso="1" aria-label="Siguiente">' + icono("derecha") + "</button></div>" +
      "</div></div></div>";

    S = {
      raiz, items, n, cfg, acciones, firma,
      pista: raiz.querySelector(".orbita-pista"),
      escena: raiz.querySelector(".orbita-escena"),
      platos: Array.from(raiz.querySelectorAll(".orbita-plato")),
      caja: raiz.querySelector(".orbita-platos"),
      texto: raiz.querySelector(".orbita-texto"),
      tarjeta: raiz.querySelector(".orbita-tarjeta"),
      arco: raiz.querySelector(".orbita-arco"),
      trazo: raiz.querySelector(".orbita-arco path"),
      angulos: { a0: REPOSO[0][0], a1: REPOSO[0][1] },
      geo: null, indice: -1, ficha: 0, rafScroll: 0, rafArco: 0, toque: null,
    };

    medir();
    mostrar(0, 1, true);

    S.alScroll = () => {
      if (S.rafScroll) return;
      S.rafScroll = requestAnimationFrame(() => { S.rafScroll = 0; segunScroll(); });
    };
    S.alMedir = () => { medir(); segunScroll(); };
    window.addEventListener("scroll", S.alScroll, { passive: true });
    window.addEventListener("resize", S.alMedir);
    raiz.addEventListener("click", alClic);
    S.escena.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); paso(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); paso(-1); }
    });
    // Pasar por un acabado muestra su nombre
    raiz.addEventListener("mouseover", (e) => {
      const sp = e.target.closest(".orbita-colores span");
      if (!sp) return;
      sp.parentElement.querySelectorAll("span").forEach((x) => x.classList.toggle("activo", x === sp));
      const et = raiz.querySelector(".orbita-etiqueta");
      if (et) et.textContent = sp.title;
    });
    S.caja.addEventListener("pointerdown", (e) => { S.toque = { x: e.clientX, y: e.clientY }; });
    S.caja.addEventListener("pointerup", (e) => {
      const t = S.toque; S.toque = null;
      if (!t) return;
      const dx = e.clientX - t.x;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - t.y) * 1.4) { S.deslizo = true; paso(dx < 0 ? 1 : -1); }
    });
    segunScroll();
  }

  function desmontar() {
    window.removeEventListener("scroll", S.alScroll);
    window.removeEventListener("resize", S.alMedir);
    cancelAnimationFrame(S.rafArco);
    S.raiz.removeEventListener("click", alClic);
    S = null;
  }

  // Altura de la pista y geometría del arco (solo al cambiar el tamaño)
  function medir() {
    const alto = S.escena.offsetHeight;
    S.pista.style.height = Math.round(alto + (S.n - 1) * POR_PRODUCTO * window.innerHeight) + "px";
    const e = S.escena.getBoundingClientRect();
    const c = S.caja.getBoundingClientRect();
    const lado = c.width;
    // pivote 1.5 lados por encima del mueble (igual que transform-origin en el CSS)
    S.geo = { cx: c.left - e.left + lado / 2, cy: c.top - e.top - lado * 1.5, r: lado * 2, w: lado * 0.36 };
    S.arco.setAttribute("viewBox", "0 0 " + e.width + " " + e.height);
    dibujarArco();
  }

  function dibujarArco() {
    if (!S.geo) return;
    S.trazo.setAttribute("d", trazoArco(S.angulos.a0, S.angulos.a1, S.geo.cx, S.geo.cy, S.geo.r, S.geo.w));
  }

  function moverArco(destino, ms, despues) {
    const ini = { a0: S.angulos.a0, a1: S.angulos.a1 };
    const t0 = performance.now();
    cancelAnimationFrame(S.rafArco);
    const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const cuadro = (ahora) => {
      const t = Math.min(1, (ahora - t0) / ms);
      const k = suave(t);
      S.angulos.a0 = ini.a0 + (destino[0] - ini.a0) * k;
      S.angulos.a1 = ini.a1 + (destino[1] - ini.a1) * k;
      dibujarArco();
      if (t < 1) S.rafArco = requestAnimationFrame(cuadro);
      else if (despues) despues();
    };
    S.rafArco = requestAnimationFrame(cuadro);
  }

  // ¿Qué producto toca según el scroll?
  function recorrido() {
    return S.pista.offsetHeight - S.escena.offsetHeight;
  }
  function topeFijo() {
    return parseFloat(getComputedStyle(S.escena).top) || 0;
  }
  function segunScroll() {
    if (!S) return;
    const r = S.pista.getBoundingClientRect();
    const total = recorrido();
    if (total <= 0) return;
    const avance = Math.max(0, Math.min(1, (topeFijo() - r.top) / total));
    const i = Math.round(avance * (S.n - 1));
    if (i !== S.indice) mostrar(i, i > S.indice ? 1 : -1);
  }

  // Botones, puntos, teclas y deslizar: llevan el scroll al tramo del producto
  function ir(i) {
    i = ((i % S.n) + S.n) % S.n;
    if (i === S.indice) return;
    const r = S.pista.getBoundingClientRect();
    const dentro = r.top <= topeFijo() + 2 && r.bottom >= window.innerHeight - 2;
    const dir = i > S.indice ? 1 : -1;
    if (dentro) {
      const y = window.scrollY + r.top - topeFijo() + (recorrido() * i) / (S.n - 1);
      window.scrollTo({ top: y, behavior: reducido() ? "auto" : "smooth" });
    }
    mostrar(i, dir);
  }
  function paso(d) { ir(S.indice + d); }

  function alClic(e) {
    const b = e.target.closest("button");
    if (!b || !S) return;
    if (b.dataset.ir !== undefined) return ir(Number(b.dataset.ir));
    if (b.dataset.paso) return paso(Number(b.dataset.paso));
    const p = S.items[S.indice];
    if (b.dataset.abrirOrbita !== undefined) {
      if (S.deslizo) { S.deslizo = false; return; }
      return S.acciones.abrir(p.id);
    }
    if (b.dataset.orbita === "ver") return S.acciones.abrir(p.id);
    if (b.dataset.orbita === "agregar") return S.acciones.agregar(p);
  }

  // ---------------------------------------------------------------------
  // El cambio de producto
  // ---------------------------------------------------------------------
  function mostrar(i, dir, inicial) {
    const de = S.indice;
    S.indice = i;
    const ficha = ++S.ficha;
    const p = S.items[i];
    const sin = inicial || reducido() || de < 0;

    // puntos y miniaturas
    S.raiz.querySelectorAll("[data-ir]").forEach((b) => {
      const activo = Number(b.dataset.ir) === i;
      if (activo) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      if (b.classList.contains("orbita-punto")) b.setAttribute("aria-selected", activo ? "true" : "false");
    });
    const tira = S.raiz.querySelector(".orbita-miniaturas");
    const mini = tira.children[i];
    if (mini) tira.scrollTo({ left: mini.offsetLeft - tira.clientWidth / 2 + mini.clientWidth / 2, behavior: sin ? "auto" : "smooth" });

    // color del arco
    S.trazo.style.fill = colorDe(p);

    // muebles
    S.platos.forEach((pl, k) => {
      pl.getAnimations().forEach((a) => a.cancel());
      pl.setAttribute("aria-hidden", k === i ? "false" : "true");
      pl.style.transform = "rotate(0deg)";
      pl.style.opacity = k === de && !sin ? "1" : "0";
      pl.style.visibility = k === de && !sin ? "visible" : "hidden";
    });
    const entra = S.platos[i];
    if (sin) {
      entra.style.opacity = "1";
      entra.style.visibility = "visible";
      pintarTexto(p, i);
      pintarTarjeta(p);
      const rep = REPOSO[i % REPOSO.length];
      S.angulos.a0 = rep[0]; S.angulos.a1 = rep[1];
      dibujarArco();
      return;
    }
    const sale = S.platos[de];
    sale.animate([{ transform: "rotate(0deg)", opacity: 1 }, { transform: "rotate(" + GIRO * dir + "deg)", opacity: 0 }],
      { duration: 620, easing: "cubic-bezier(.55,0,.9,.45)", fill: "forwards" });
    entra.style.visibility = "visible";
    entra.animate([
      { transform: "rotate(" + -GIRO * dir + "deg)", opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: "rotate(0deg)", opacity: 1 },
    ], { duration: 950, delay: 300, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" })
      .finished.then(() => { if (S && S.ficha === ficha) { entra.style.opacity = "1"; } }).catch(() => {});

    // arco: se estira con los muebles y luego se acomoda
    moverArco(BARRIDO, 600, () => { if (S && S.ficha === ficha) moverArco(REPOSO[i % REPOSO.length], 850); });

    // título: la línea fina se borra a la derecha, la gruesa a la izquierda, y entran las nuevas
    const t1 = S.texto.querySelector(".t1"), t2 = S.texto.querySelector(".t2"), ceja = S.texto.querySelector(".orbita-ceja");
    t1.animate([{ clipPath: VISIBLE }, { clipPath: OCULTO_1 }], { duration: 420, easing: "ease-in", fill: "forwards" });
    t2.animate([{ clipPath: VISIBLE }, { clipPath: OCULTO_2 }], { duration: 420, delay: 60, easing: "ease-in", fill: "forwards" });
    ceja.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" });
    S.tarjeta.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 300, delay: 50, easing: "ease-in", fill: "forwards" });

    setTimeout(() => {
      if (!S || S.ficha !== ficha) return;
      pintarTexto(p, i);
      [t1, t2, ceja, S.tarjeta].forEach((x) => x.getAnimations().forEach((a) => a.cancel()));
      ceja.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 400, easing: "ease-out", fill: "both" });
      t1.animate([{ clipPath: OCULTO_1 }, { clipPath: VISIBLE }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" });
      t2.animate([{ clipPath: OCULTO_2 }, { clipPath: VISIBLE }], { duration: 700, delay: 70, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" });
      pintarTarjeta(p);
      Array.from(S.tarjeta.children).forEach((fila, k) =>
        fila.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: k * 60, easing: "ease-out", fill: "both" }));
    }, 500);
  }

  function pintarTexto(p, i) {
    S.texto.querySelector(".orbita-ceja").textContent = "Destacados · " + (p.categoria || "Colección");
    const cont = S.raiz.querySelector(".orbita-contador b");
    if (cont) { cont.textContent = String(i + 1).padStart(2, "0"); cont.animate && cont.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: "ease-out" }); }
    const t1 = S.texto.querySelector(".t1"), t2 = S.texto.querySelector(".t2");
    t1.textContent = p.marca && p.marca !== "ARKEO" ? p.marca : (p.material ? p.material.split(",")[0] : p.categoria || "Colección");
    t2.textContent = p.nombre;
    t2.classList.toggle("larga", p.nombre.length > 18);
  }

  function pintarTarjeta(p) {
    const cfg = S.cfg;
    const st = T.estado(p, cfg);
    const d = T.precio(p, "detal", "divisas"), m = T.precio(p, "mayor", "divisas");
    const colores = T.colores(p);
    const estados = { ok: "Disponible", pocas: "¡Pocas unidades!", agotado: "Agotado", encargo: "Por encargo" };
    S.tarjeta.innerHTML =
      '<div class="orbita-precios"><div><small>Al detal</small><strong>' + T.dinero(d) + "</strong></div>" +
      (T.tieneMayor(p) && m < d ? "<div><small>Al mayor · " + cfg.minimoMayor + "+</small><strong>" + T.dinero(m) + "</strong></div>" : "") + "</div>" +
      '<p class="orbita-estado ' + st.tipo + '">' + estados[st.tipo] + (p.codigo ? " · " + esc(p.codigo) : "") + "</p>" +
      (p.descripcion ? '<p class="orbita-desc">' + esc(p.descripcion) + "</p>" : "") +
      (colores.length ? '<div class="orbita-acabados"><small>Acabados disponibles</small><div class="orbita-colores">' +
        colores.slice(0, 6).map((c, k) => '<span class="' + (k === 0 ? "activo" : "") + '" title="' + esc(c.nombre) + '" style="background:' + esc(c.hex || "#ccc") + '"></span>').join("") +
        '</div><em class="orbita-etiqueta">' + esc(colores[0].nombre) + "</em></div>" : "");
  }

  window.Orbita = { pintar };
})();
