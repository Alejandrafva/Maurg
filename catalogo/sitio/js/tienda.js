/* =====================================================================
   tienda.js — catálogo, ficha de producto, carrito y pedido por WhatsApp
   ===================================================================== */
(function () {
  const T = window.Tienda;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = T.esc;
  const POR_PAGINA = 24;
  const EN_CATALOGO = document.body.dataset.pagina === "catalogo";
  const EN_FILA = 8; // productos en la cuadrícula del inicio
  const URLP = new URLSearchParams(location.search);

  const estado = {
    cfg: T.unirAjustes(T.leerMemoria("config")),
    productos: T.leerMemoria("productos") || [],
    categoria: URLP.get("cat") || "",
    coleccion: URLP.get("col") || "",
    texto: URLP.get("q") || "",
    precioMin: null,
    precioMax: null,
    materiales: [],
    coloresSel: [],
    dispSel: [],
    orden: "destacados",
    disponibles: false,
    ofertas: false,
    mostrar: POR_PAGINA,
    carrito: leerCarrito(),
    pago: T.leerMemoria("pago") || "divisas",
    metodo: T.leerMemoria("metodo") || "",
    cliente: T.leerMemoria("cliente") || {},
    cargado: false,
  };

  // -------------------------------------------------------------------
  // Inicio
  // -------------------------------------------------------------------
  async function iniciar() {
    enlazarEventos();
    if (estado.productos.length && !T.demo) {
      estado.cargado = true;
      pintarTodo();
    } else {
      pintarEsqueleto();
    }
    try {
      const [cfg, productos] = await Promise.all([T.cargarConfig(), T.cargarProductos()]);
      estado.cfg = cfg;
      estado.productos = productos || [];
      estado.cargado = true;
      pintarTodo();
    } catch (e) {
      console.error(e);
      if (!estado.productos.length) {
        $("#rejilla").innerHTML = '<div class="vacio"><strong>No pudimos cargar el catálogo</strong>Revisa tu conexión e intenta de nuevo.<br><br><button class="boton claro" onclick="location.reload()">Reintentar</button></div>';
      } else {
        T.tostada("Sin conexión: mostrando el catálogo guardado");
      }
    }
    abrirDesdeEnlace();
    if (EN_CATALOGO && location.hash === "#buscar" && $("#buscar")) setTimeout(() => $("#buscar").focus(), 300);
  }

  function pintarTodo() {
    T.pintarComun(estado.cfg);
    if ($("#heroe")) pintarPortada();
    if ($("#cats-tarjetas")) pintarTarjetasCategoria();
    if ($("#categorias")) pintarCategorias();
    if ($("#colecciones")) pintarColecciones();
    if ($("#filtros")) pintarFiltros();
    pintarLista();
    pintarContador();
    if (window.Orbita) {
      window.Orbita.pintar(visibles(), estado.cfg, {
        abrir: (id) => abrirFicha(id),
        agregar: (p) => {
          const cols = T.colores(p);
          if (cols.length > 1 || T.estado(p, estado.cfg).tipo === "agotado") abrirFicha(p.id);
          else agregar(p.id, (cols[0] || {}).nombre || "", 1);
        },
      });
    }
    if (!$("#carrito").classList.contains("oculto")) pintarCarrito();
  }

  function visibles() {
    return estado.productos.filter((p) => p.disponible !== false);
  }

  // -------------------------------------------------------------------
  // Portada
  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // Portada: carrusel de fotos de ambiente (productos destacados)
  // -------------------------------------------------------------------
  const heroe = { slides: [], i: 0, t: null, firma: "" };
  const INTERVALO = 6500;

  function pintarPortada() {
    const cfg = estado.cfg, por = cfg.portada || {};
    if (por.titulo) $("#portada-titulo").innerHTML = T.negritas(por.titulo);
    const ini = cfg.inicio || {};
    const poner = (sel, v) => { const el = $(sel); if (el && v) el.textContent = v; };
    poner("#franja-1", ini.franja1); poner("#franja-2", ini.franja2);
    poner("#cats-ceja", ini.catsCeja); poner("#cats-titulo", ini.catsTitulo);
    poner("#banda-ceja", ini.bandaCeja); poner("#banda-titulo", ini.bandaTitulo);
    poner("#vent-titulo", ini.ventTitulo); poner("#vent-texto", ini.ventTexto);
    if (ini.bandaFoto) $("#banda-mayor").style.backgroundImage = "linear-gradient(90deg, rgba(11,9,10,.97) 0%, rgba(11,9,10,.85) 50%, rgba(11,9,10,.35) 100%), url('" + ini.bandaFoto.replace(/'/g, "%27") + "')";
    (ini.ventajas || []).forEach((v, k) => {
      if (!v) return;
      const t = document.querySelector('[data-ventaja-t="' + k + '"]'), d = document.querySelector('[data-ventaja-d="' + k + '"]');
      if (t && v.titulo) t.textContent = v.titulo;
      if (d && v.texto) d.textContent = v.texto;
    });
    if (por.subtitulo && !/Al mayor y al detal/i.test(por.subtitulo)) $("#portada-subtitulo").textContent = por.subtitulo;
    $("#portada-boton").textContent = por.boton || "Ver catálogo";
    $("#heroe-ceja").textContent = cfg.eslogan || "";
    const banda = $("#banda-texto");
    if (banda && ini.bandaTexto) banda.textContent = ini.bandaTexto;
    document.title = cfg.nombreTienda + " · Mobiliario de oficina y hogar";

    // Diapositivas: destacados con foto de ambiente; si no hay, la imagen de portada o cualquier foto de ambiente
    let slides = visibles().filter((p) => p.destacado && T.fotoAmbiente(p)).map((p) => ({ p, img: T.fotoAmbiente(p) }));
    if (!slides.length) slides = visibles().filter((p) => T.fotoAmbiente(p)).slice(0, 5).map((p) => ({ p, img: T.fotoAmbiente(p) }));
    if (por.imagen) slides.unshift({ p: null, img: por.imagen });
    if (!slides.length) {
      const d = visibles().find((p) => T.fotos(p).length);
      slides = [{ p: d || null, img: d ? T.fotoPrincipal(d) : "img/sin-foto.svg", recorte: true }];
    }
    slides = slides.slice(0, 6);
    const firma = slides.map((x) => x.img).join("|");
    if (firma === heroe.firma) return;
    heroe.firma = firma;
    heroe.slides = slides;
    heroe.i = 0;
    $("#heroe-fondos").innerHTML = slides.map((x, k) =>
      '<div class="heroe-foto' + (x.recorte ? " recorte" : "") + '">' +
      '<img class="borroso" src="' + esc(x.img) + '" alt="" aria-hidden="true"' + (k ? ' loading="lazy"' : "") + ">" +
      '<img class="nitido" src="' + esc(x.img) + '" alt="' + esc(x.p ? x.p.nombre : cfg.nombreTienda) + '"' + (k ? ' loading="lazy"' : ' fetchpriority="high"') + "></div>").join("");
    $("#heroe-total").textContent = String(slides.length).padStart(2, "0");
    $("#heroe-panel").classList.toggle("solo", slides.length < 2);
    mostrarSlide(0);
  }

  function mostrarSlide(k) {
    const n = heroe.slides.length;
    if (!n) return;
    heroe.i = ((k % n) + n) % n;
    const fotos = document.querySelectorAll(".heroe-foto");
    fotos.forEach((f, j) => f.classList.toggle("activa", j === heroe.i));
    $("#heroe-num").textContent = String(heroe.i + 1).padStart(2, "0");
    const barra = $("#heroe-barra");
    barra.style.transition = "none"; barra.style.width = (heroe.i / Math.max(1, n)) * 100 + "%";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      barra.style.transition = "width " + INTERVALO + "ms linear";
      barra.style.width = ((heroe.i + 1) / n) * 100 + "%";
    }));
    const tarjeta = (x, clase) => {
      if (!x || !x.p) return "";
      const pr = T.precio(x.p, "detal", "divisas");
      return '<button class="heroe-tarjeta ' + clase + '" data-abrir="' + x.p.id + '">' +
        '<img src="' + esc(T.fotoPrincipal(x.p)) + '" alt="" loading="lazy">' +
        (clase === "actual" ? "<span><b>" + esc(x.p.nombre) + "</b><small>" + esc(x.p.categoria || "") + "</small><em>" + T.dinero(pr) + (T.precioBs(x.p) ? " · " + T.bs(T.precioBs(x.p)) : "") + "</em><i>Ver producto</i></span>" : "") + "</button>";
    };
    const act = heroe.slides[heroe.i], sig = heroe.slides[(heroe.i + 1) % n];
    const cont = $("#heroe-tarjetas");
    cont.innerHTML = tarjeta(act, "actual") + (n > 1 ? tarjeta(sig, "siguiente") : "");
    cont.classList.remove("entra"); void cont.offsetWidth; cont.classList.add("entra");
    $("#heroe-mini").src = act.img;
    clearTimeout(heroe.t);
    if (n > 1 && !reducido()) heroe.t = setTimeout(() => { if (!document.hidden) mostrarSlide(heroe.i + 1); else mostrarSlide(heroe.i); }, INTERVALO);
  }
  const reducido = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // -------------------------------------------------------------------
  // Tarjetas de categoría ("Compra por espacio")
  // -------------------------------------------------------------------
  const TINTES = ["#efe7dc", "#e3e8ef", "#e9e9ea", "#e8eef4", "#f1ece6", "#e6e9ec"];
  function pintarTarjetasCategoria() {
    const cont = $("#cats-tarjetas");
    if (!cont) return;
    const cats = listaCategorias();
    $("#categorias-vitrina").classList.toggle("oculto", cats.length < 2);
    cont.innerHTML = cats.slice(0, 8).map((c, k) => {
      const prods = visibles().filter((p) => p.categoria === c.nombre && T.fotos(p).length);
      const amb = prods.find((p) => T.fotoAmbiente(p));
      const elegido = amb || prods[0];
      const img = amb ? T.fotoAmbiente(amb) : elegido ? T.fotoPrincipal(elegido) : "";
      return '<button class="cat-tarjeta revelar" style="--tinte:' + TINTES[k % TINTES.length] + ";--d:" + (k % 4) * 80 + 'ms" data-cat-tarjeta="' + esc(c.nombre) + '">' +
        (img ? '<span class="cat-foto' + (amb ? " ambiente" : "") + '"><img src="' + esc(img) + '" alt="" loading="lazy"></span>' : '<span class="cat-foto">' + icono(iconoPara(c)) + "</span>") +
        '<span class="cat-texto"><b>' + esc(c.nombre) + "</b><small>" + c.n + (c.n === 1 ? " producto" : " productos") + "</small></span>" +
        '<span class="cat-ir">' + icono("flecha") + "</span></button>";
    }).join("");
    observarRevelar();
  }

  // -------------------------------------------------------------------
  // Aparición suave al hacer scroll
  // -------------------------------------------------------------------
  let observador = null;
  function observarRevelar() {
    const els = document.querySelectorAll(".revelar:not(.visible)");
    if (!("IntersectionObserver" in window) || reducido()) { els.forEach((e) => e.classList.add("visible")); return; }
    if (!observador) {
      observador = new IntersectionObserver((entradas) => {
        entradas.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("visible"); observador.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    }
    els.forEach((e) => observador.observe(e));
  }

  // -------------------------------------------------------------------
  // Categorías y colecciones
  // -------------------------------------------------------------------
  function listaCategorias() {
    const cfgCats = estado.cfg.categorias.map((c) => (typeof c === "string" ? { nombre: c, icono: "" } : c)).filter((c) => c && c.nombre);
    const usadas = new Map();
    visibles().forEach((p) => { if (p.categoria) usadas.set(p.categoria, (usadas.get(p.categoria) || 0) + 1); });
    const lista = cfgCats.filter((c) => usadas.has(c.nombre) && !c.oculta);
    usadas.forEach((n, nombre) => { if (!cfgCats.some((c) => c.nombre === nombre)) lista.push({ nombre, icono: "" }); });
    return lista.map((c) => Object.assign({}, c, { n: usadas.get(c.nombre) || 0 }));
  }

  function iconoPara(c) {
    if (c.icono) return c.icono;
    const n = T.normalizar(c.nombre);
    if (/president|gerenc/.test(n)) return "presidencial";
    if (/visit|recep|espera/.test(n)) return "visitante";
    if (/oficina|ejecut|operativ|ergon/.test(n) && /silla/.test(n)) return "silla-oficina";
    if (/espejo/.test(n)) return "espejo";
    if (/reuni|juntas|conferen/.test(n)) return "mesa";
    if (/archiv/.test(n)) return "almacenaje";
    if (/escritor/.test(n)) return "escritorio";
    if (/butac|poltron/.test(n)) return "butaca";
    if (/sofa|mueble de sala/.test(n)) return "sofa";
    if (/silla|banco|taburete/.test(n)) return "silla";
    if (/tocador|vanity|peinador|vanit/.test(n)) return "tocador";
    if (/taburet|banqueta|barra/.test(n)) return "taburete";
    if (/comedor/.test(n)) return "comedor";
    if (/mesa/.test(n)) return "mesa";
    if (/hogar|casa/.test(n)) return "hogar";
    if (/cama|colchon|dormit|noche/.test(n)) return "cama";
    if (/estant|bibliot|archiv|closet|almac|gaveter|organiz/.test(n)) return "almacenaje";
    if (/lamp|luz|ilumin/.test(n)) return "lampara";
    if (/deco|jarr|espej/.test(n)) return "decoracion";
    if (/jardin|exterior|terraza/.test(n)) return "exterior";
    if (/cocina/.test(n)) return "cocina";
    return "todo";
  }

  function pintarCategorias() {
    const cats = listaCategorias();
    const total = visibles().length;
    let html = boton("", "Todo", "todo", total);
    cats.forEach((c) => (html += boton(c.nombre, c.nombre, iconoPara(c), c.n)));
    $("#categorias").innerHTML = html;
    $("#categorias").classList.toggle("oculto", cats.length < 1);
    function boton(valor, texto, ic, n) {
      return '<button class="categoria" data-categoria="' + esc(valor) + '" aria-pressed="' + (estado.categoria === valor && !estado.coleccion) + '">' +
        '<span class="num">' + n + "</span>" + icono(ic) + "<span>" + esc(texto) + "</span></button>";
    }
  }

  function pintarColecciones() {
    const cols = (estado.cfg.colecciones || []).filter((c) => c && c.nombre && visibles().some((p) => (p.colecciones || []).includes(c.nombre)));
    const el = $("#colecciones");
    el.classList.toggle("oculto", !cols.length || !!estado.texto);
    el.innerHTML = cols.map((c) =>
      '<button class="coleccion' + (c.imagen ? "" : " sin-foto") + '" data-coleccion="' + esc(c.nombre) + '">' +
      (c.imagen ? '<img src="' + esc(c.imagen) + '" alt="" loading="lazy" decoding="async">' : "") +
      "<div><span><strong>" + esc(c.nombre) + "</strong><small>" + esc(c.descripcion || "") + "</small></span>" + icono("flecha") + "</div></button>"
    ).join("");
  }

  // -------------------------------------------------------------------
  // Lista de productos
  // -------------------------------------------------------------------
  function filtrar() {
    const q = T.normalizar(estado.texto);
    const palabras = q.split(/\s+/).filter(Boolean);
    let lista = visibles().filter((p) => {
      if (estado.categoria && p.categoria !== estado.categoria) return false;
      if (estado.coleccion && !(p.colecciones || []).includes(estado.coleccion)) return false;
      if (estado.disponibles && T.estado(p, estado.cfg).tipo === "agotado") return false;
      if (estado.ofertas && !(Number(p.precio_antes) > T.precio(p, "detal", "divisas"))) return false;
      const pr = T.precio(p, "detal", "divisas");
      if (estado.precioMin != null && pr < estado.precioMin) return false;
      if (estado.precioMax != null && pr > estado.precioMax) return false;
      if (estado.materiales.length && !estado.materiales.includes(materialDe(p))) return false;
      if (estado.coloresSel.length && !T.colores(p).some((c) => estado.coloresSel.includes(c.nombre))) return false;
      if (estado.dispSel.length) {
        const t = T.estado(p, estado.cfg).tipo;
        const oferta = Number(p.precio_antes) > pr;
        const ok = estado.dispSel.some((d) => (d === "disponible" && (t === "ok" || t === "pocas")) || (d === "encargo" && t === "encargo") || (d === "oferta" && oferta));
        if (!ok) return false;
      }
      if (palabras.length) {
        const texto = T.normalizar([p.nombre, p.marca, p.codigo, p.categoria, p.material, p.descripcion, T.colores(p).map((c) => c.nombre).join(" ")].join(" "));
        return palabras.every((w) => texto.includes(w));
      }
      return true;
    });
    const precio = (p) => T.precio(p, "detal", "divisas");
    const agot = (p) => (T.estado(p, estado.cfg).tipo === "agotado" ? 1 : 0);
    switch (estado.orden) {
      case "precio-asc": lista.sort((a, b) => precio(a) - precio(b)); break;
      case "precio-desc": lista.sort((a, b) => precio(b) - precio(a)); break;
      case "nombre": lista.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es")); break;
      case "nuevos": lista.sort((a, b) => (b.nuevo ? 1 : 0) - (a.nuevo ? 1 : 0) || (b.id || 0) - (a.id || 0)); break;
      default: lista.sort((a, b) => agot(a) - agot(b) || (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0) || (a.orden || 0) - (b.orden || 0));
    }
    return lista;
  }

  function pintarLista() {
    const lista = filtrar();
    const titulo = estado.coleccion || estado.categoria || (estado.texto ? "Resultados" : "Todos los productos");
    if ($("#titulo-lista") && EN_CATALOGO) $("#titulo-lista").textContent = titulo;
    if ($("#resultado")) $("#resultado").textContent = EN_CATALOGO ? lista.length + (lista.length === 1 ? " producto" : " productos") : "";
    if (!EN_CATALOGO) {
      $("#rejilla").innerHTML = lista.slice(0, EN_FILA).map(tarjeta).join("");
      const total = $("#total-catalogo");
      if (total) total.textContent = lista.length ? "Ver los " + lista.length + " productos" : "Ver catálogo";
      observarRevelar();
      return;
    }
    pintarActivos();
    if (!lista.length) {
      $("#rejilla").innerHTML = estado.cargado
        ? '<div class="vacio"><strong>No encontramos productos</strong>' + (estado.productos.length ? "Prueba con otra búsqueda o categoría." : "Pronto agregaremos productos al catálogo.") + (EN_CATALOGO && hayFiltros() ? '<br><br><button class="boton claro" data-limpiar-filtros>Limpiar filtros</button>' : "") + "</div>"
        : "";
      if ($("#mas-productos")) $("#mas-productos").classList.add("oculto");
      return;
    }
    $("#rejilla").innerHTML = lista.slice(0, estado.mostrar).map(tarjeta).join("");
    observarRevelar();
    if ($("#mas-productos")) $("#mas-productos").classList.toggle("oculto", lista.length <= estado.mostrar);
  }

  // -------------------------------------------------------------------
  // Página de catálogo: filtros
  // -------------------------------------------------------------------
  const materialDe = (p) => {
    const m = String(p.material || "").split(/[,;]| y /)[0].trim();
    return m ? m.charAt(0).toUpperCase() + m.slice(1) : "";
  };
  const precioDe = (p) => T.precio(p, "detal", "divisas");
  function limitesPrecio() {
    const ps = visibles().map(precioDe).filter((x) => x > 0);
    const max = ps.length ? Math.ceil(Math.max(...ps) / 10) * 10 : 100;
    return { min: 0, max };
  }

  function pintarFiltros() {
    const cont = $("#filtros-cuerpo");
    if (!cont) return;
    const vis = visibles();
    const cats = listaCategorias();
    const lim = limitesPrecio();
    const pmin = estado.precioMin != null ? estado.precioMin : lim.min;
    const pmax = estado.precioMax != null ? estado.precioMax : lim.max;
    const contar = (fn) => vis.filter(fn).length;
    const mats = [...new Set(vis.map(materialDe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    const colMap = new Map();
    vis.forEach((p) => T.colores(p).forEach((c) => { if (!colMap.has(c.nombre)) colMap.set(c.nombre, c.hex || "#ccc"); }));
    const chip = (attr, val, texto, activo, extra) => '<button class="chip-filtro" ' + attr + '="' + esc(val) + '" aria-pressed="' + !!activo + '">' + (extra || "") + esc(texto) + "</button>";
    const tramos = [[0, 100, "Menos de $100"], [100, 300, "$100 – $300"], [300, null, "Más de $300"]];
    cont.innerHTML =
      '<div class="grupo-filtro"><h3>Categoría</h3><div class="chips-filtro">' + chip("data-f-cat", "", "Todas", !estado.categoria) +
        cats.map((c) => chip("data-f-cat", c.nombre, c.nombre + " · " + c.n, estado.categoria === c.nombre)).join("") + "</div></div>" +
      '<div class="grupo-filtro"><h3>Rango de precio</h3><p class="rango-texto" id="rango-texto">' + T.dinero(pmin) + " – " + T.dinero(pmax) + "</p>" +
        '<div class="rango-doble" style="--a:' + (pmin / lim.max) * 100 + "%;--b:" + (pmax / lim.max) * 100 + '%"><i></i>' +
        '<input type="range" id="rango-min" min="' + lim.min + '" max="' + lim.max + '" step="5" value="' + pmin + '" aria-label="Precio mínimo">' +
        '<input type="range" id="rango-max" min="' + lim.min + '" max="' + lim.max + '" step="5" value="' + pmax + '" aria-label="Precio máximo"></div>' +
        '<div class="chips-filtro">' + tramos.map(([a, b, t]) => chip("data-f-tramo", a + "-" + (b == null ? "" : b), t, estado.precioMin === a && estado.precioMax === b)).join("") + "</div></div>" +
      (mats.length ? '<div class="grupo-filtro"><h3>Material</h3><div class="chips-filtro">' + mats.map((m) => chip("data-f-mat", m, m, estado.materiales.includes(m))).join("") + "</div></div>" : "") +
      (colMap.size ? '<div class="grupo-filtro"><h3>Color</h3><div class="chips-filtro">' + [...colMap].map(([n, h]) => chip("data-f-col", n, n, estado.coloresSel.includes(n), '<i style="background:' + esc(h) + '"></i>')).join("") + "</div></div>" : "") +
      '<div class="grupo-filtro"><h3>Disponibilidad</h3><div class="chips-filtro">' +
        chip("data-f-disp", "disponible", "Disponible · " + contar((p) => ["ok", "pocas"].includes(T.estado(p, estado.cfg).tipo)), estado.dispSel.includes("disponible")) +
        chip("data-f-disp", "encargo", "Por encargo · " + contar((p) => p.encargo), estado.dispSel.includes("encargo")) +
        chip("data-f-disp", "oferta", "En oferta · " + contar((p) => Number(p.precio_antes) > precioDe(p)), estado.dispSel.includes("oferta")) + "</div></div>";
    const rmin = $("#rango-min"), rmax = $("#rango-max");
    const alMover = () => {
      let a = Number(rmin.value), b = Number(rmax.value);
      if (a > b) { if (document.activeElement === rmin) { a = b; rmin.value = a; } else { b = a; rmax.value = b; } }
      estado.precioMin = a <= lim.min ? null : a;
      estado.precioMax = b >= lim.max ? null : b;
      $("#rango-texto").textContent = T.dinero(a) + " – " + T.dinero(b);
      rmin.parentElement.style.setProperty("--a", (a / lim.max) * 100 + "%");
      rmin.parentElement.style.setProperty("--b", (b / lim.max) * 100 + "%");
      estado.mostrar = POR_PAGINA;
      pintarLista();
    };
    rmin.oninput = alMover; rmax.oninput = alMover;
  }

  function hayFiltros() {
    return !!(estado.categoria || estado.coleccion || estado.texto || estado.precioMin != null || estado.precioMax != null || estado.materiales.length || estado.coloresSel.length || estado.dispSel.length);
  }
  function pintarActivos() {
    const el = $("#filtros-activos");
    if (!el) return;
    const a = [];
    if (estado.categoria) a.push(["cat", estado.categoria]);
    if (estado.coleccion) a.push(["colec", estado.coleccion]);
    if (estado.texto) a.push(["q", "“" + estado.texto + "”"]);
    if (estado.precioMin != null || estado.precioMax != null) a.push(["precio", T.dinero(estado.precioMin || 0) + " – " + (estado.precioMax != null ? T.dinero(estado.precioMax) : "más")]);
    estado.materiales.forEach((m) => a.push(["mat:" + m, m]));
    estado.coloresSel.forEach((c) => a.push(["col:" + c, c]));
    estado.dispSel.forEach((d) => a.push(["disp:" + d, { disponible: "Disponible", encargo: "Por encargo", oferta: "En oferta" }[d]]));
    el.innerHTML = a.map(([k, t]) => '<button class="chip-activo" data-quitar-filtro="' + esc(k) + '">' + esc(t) + " " + icono("cerrar") + "</button>").join("") +
      (a.length > 1 ? '<button class="chip-activo limpiar" data-limpiar-filtros>Limpiar todo</button>' : "");
    const n = a.length;
    document.querySelectorAll(".n-filtros").forEach((x) => { x.textContent = n ? String(n) : ""; });
    const ver = $("#ver-resultados");
    if (ver) ver.textContent = "Ver " + filtrar().length + " productos";
  }
  function quitarFiltro(k) {
    if (k === "cat") estado.categoria = "";
    else if (k === "colec") estado.coleccion = "";
    else if (k === "q") { estado.texto = ""; if ($("#buscar")) $("#buscar").value = ""; }
    else if (k === "precio") { estado.precioMin = null; estado.precioMax = null; }
    else if (k.startsWith("mat:")) estado.materiales = estado.materiales.filter((x) => x !== k.slice(4));
    else if (k.startsWith("col:")) estado.coloresSel = estado.coloresSel.filter((x) => x !== k.slice(4));
    else if (k.startsWith("disp:")) estado.dispSel = estado.dispSel.filter((x) => x !== k.slice(5));
  }
  const alternar = (lista, v) => (lista.includes(v) ? lista.filter((x) => x !== v) : lista.concat(v));

  function pintarEsqueleto() {
    $("#rejilla").innerHTML = Array.from({ length: 8 }, () => '<div class="producto cargando"><div class="foto"></div><div class="linea"></div><div class="linea" style="width:40%"></div></div>').join("");
  }

  function etiquetasDe(p, st) {
    const e = [];
    const dd = T.precio(p, "detal", "divisas");
    if (st.tipo === "agotado") e.push('<span class="etiqueta agotado">Agotado</span>');
    else if (st.tipo === "pocas") e.push('<span class="etiqueta pocas">¡Pocas unidades!</span>');
    else if (st.tipo === "encargo") e.push('<span class="etiqueta encargo">Por encargo</span>');
    if (Number(p.precio_antes) > dd && dd > 0) e.push('<span class="etiqueta oferta">-' + Math.round((1 - dd / Number(p.precio_antes)) * 100) + "%</span>");
    if (p.nuevo) e.push('<span class="etiqueta oscura">Nuevo</span>');
    return e.join("");
  }

  function tarjeta(p) {
    const st = T.estado(p, estado.cfg);
    const foto = T.fotoPrincipal(p);
    const dd = T.precio(p, "detal", "divisas");
    const dm = T.precio(p, "mayor", "divisas");
    const bsTarjeta = T.precioBs(p);
    const antes = Number(p.precio_antes) > dd ? "<s>" + T.dinero(p.precio_antes) + "</s>" : "";
    const colores = T.colores(p);
    const puntos = colores.length > 1 ? '<div class="puntos">' + colores.slice(0, 6).map((c) => '<span class="punto" title="' + esc(c.nombre) + '" style="background:' + esc(c.hex || "#ccc") + '"></span>').join("") + "</div>" : "";
    const cubrir = T.esAmbiente(p) ? " cubrir" : "";
    return '<article class="producto revelar' + (st.tipo === "agotado" ? " agotado" : "") + '" style="--d:' + ((tarjeta.k = (tarjeta.k || 0) + 1) % 4) * 70 + 'ms"><div class="marco">' +
      '<button class="foto" data-abrir="' + p.id + '" aria-label="Ver ' + esc(p.nombre) + '">' +
      '<span class="etiquetas">' + etiquetasDe(p, st) + "</span>" +
      '<img src="' + esc(foto) + '" alt="' + esc(p.nombre) + '" loading="lazy" decoding="async" class="' + cubrir + '"></button>' +
      "</div>" +
      '<div class="info"><div class="fila"><h3><button data-abrir="' + p.id + '">' + esc(p.nombre) + '</button></h3><span class="precio">' + antes + T.dinero(dd) + "</span></div>" +
      '<div class="detalle"><span>' + esc(p.codigo || p.marca || p.categoria || "") + "</span>" + (T.tieneMayor(p) && dm < dd ? "<span>Mayor " + T.dinero(dm) + "</span>" : bsTarjeta ? '<span class="precio-bs">' + T.bs(bsTarjeta) + "</span>" : "") + "</div>" +
      puntos + "</div>" + accionesTarjeta(p, st) + "</article>";
  }

  // Botones debajo de cada producto: Añadir al carrito y Pedir
  function accionesTarjeta(p, st) {
    if (st.tipo === "agotado") {
      const wa = estado.cfg.whatsapp ? T.enlaceWa(estado.cfg.whatsapp, "Hola, quisiera saber cuándo vuelve a estar disponible: " + p.nombre + (p.codigo ? " [" + p.codigo + "]" : "")) : "";
      return '<div class="acciones-tarjeta"><button class="boton-tarjeta claro" disabled>Agotado</button>' +
        (wa ? '<a class="boton-tarjeta" href="' + esc(wa) + '" target="_blank" rel="noopener">Consultar</a>' : "") + "</div>";
    }
    return '<div class="acciones-tarjeta"><button class="boton-tarjeta claro" data-anadir="' + p.id + '" aria-label="Añadir ' + esc(p.nombre) + ' al carrito">' + icono("bolsa") + "<span>Añadir</span></button>" +
      '<button class="boton-tarjeta" data-pedir="' + p.id + '" aria-label="Pedir ' + esc(p.nombre) + '">Pedir</button></div>';
  }

  // -------------------------------------------------------------------
  // Ficha de producto
  // -------------------------------------------------------------------
  let ficha = null; // { p, color, cantidad, fotos }

  function abrirFicha(id, color, sinHistorial) {
    const p = estado.productos.find((x) => String(x.id) === String(id));
    if (!p) return;
    const colores = T.colores(p);
    if (!color && colores.length) {
      const conStock = colores.find((c) => T.stockDe(p, c.nombre) > 0) || colores[0];
      color = conStock.nombre;
    }
    ficha = { p, color: color || "", cantidad: 1, empujado: !sinHistorial };
    pintarFicha();
    mostrarPanel($("#ficha"));
    if (!sinHistorial) {
      try { history.pushState({ ficha: id }, "", "#p-" + id); } catch (e) { ficha.empujado = false; }
    }
  }

  function fotosParaColor(p, color) {
    const todas = T.fotos(p);
    if (!color) return blancoPrimero(todas);
    const propias = todas.filter((f) => f.color === color);
    const neutras = todas.filter((f) => !f.color);
    const lista = propias.concat(neutras);
    return blancoPrimero(lista.length ? lista : todas);
  }
  const blancoPrimero = (l) => l.filter((f) => !f.ambiente).concat(l.filter((f) => f.ambiente));

  function pintarFicha() {
    const { p, color } = ficha;
    const cfg = estado.cfg;
    const st = T.estado(p, cfg, color);
    const colores = T.colores(p);
    const fotos = fotosParaColor(p, color);
    const tipoActual = tipoPrecio(unidadesCarrito());
    const stock = T.stockDe(p, color);
    const max = p.encargo ? 999 : stock;
    if (ficha.cantidad > max) ficha.cantidad = Math.max(1, max);

    const media = fotos.length
      ? fotos.map((f, i) => T.esVideo(f)
        ? '<video src="' + esc(f.url) + '" controls playsinline preload="metadata"></video>'
        : '<img src="' + esc(f.url) + '" alt="' + esc(p.nombre + (f.color ? " – " + f.color : "")) + '"' + (i ? ' loading="lazy"' : "") + (f.ambiente ? ' class="cubrir"' : "") + ' decoding="async">').join("")
      : '<img src="img/sin-foto.svg" alt="">';
    const minis = fotos.length > 1
      ? '<div class="miniaturas">' + fotos.map((f, i) => '<button data-mini="' + i + '" aria-label="Foto ' + (i + 1) + '" aria-current="' + (i === 0) + '">' + (T.esVideo(f) ? '<span class="es-video">VIDEO</span>' : '<img src="' + esc(f.url) + '" alt="" loading="lazy">') + "</button>").join("") + "</div>"
      : "";

    const cajaPrecio = (tipo, etiqueta) => {
      const d = T.precio(p, tipo, "divisas");
      const b = T.precio(p, tipo, "bcv");
      const lineaBcv = T.tieneBcv(p) && cfg.tasaBCV ? "<span>A tasa BCV: " + T.dinero(b) + " · " + T.bs(b * cfg.tasaBCV) + "</span>" : T.tieneBcv(p) && b !== d ? "<span>A tasa BCV: " + T.dinero(b) + "</span>" : "";
      return '<div class="caja-precio' + (tipoActual === tipo ? " activa" : "") + '"><small>' + etiqueta + "</small><strong>" + T.dinero(d) + "</strong>" + lineaBcv + "</div>";
    };
    const precioBs = T.precioBs(p);
    const precios = cfg.ventaMayor
      ? '<div class="tabla-precios">' + cajaPrecio("detal", "Al detal") + (T.tieneMayor(p) ? cajaPrecio("mayor", "Al mayor · " + cfg.minimoMayor + "+ piezas") : "") + "</div>"
      : '<div class="tabla-precios dos-monedas"><div class="caja-precio activa"><small>En divisas</small><strong>' + T.dinero(T.precio(p, "detal", "divisas")) + "</strong><span>" + esc(T.metodosActivos().filter((m) => m.moneda === "divisas").map((m) => m.nombre).join(" · ") || "Efectivo y pagos en dólares") + "</span></div>" +
        '<div class="caja-precio"><small>En bolívares</small><strong>' + (precioBs ? T.bs(precioBs) : "Consultar") + "</strong><span>" + (cfg.tasaBCV ? "Tasa BCV " + T.numero(cfg.tasaBCV) + " Bs/$" : "Según la tasa BCV del día") + "</span></div></div>";
    const antes = Number(p.precio_antes) > T.precio(p, "detal", "divisas") ? '<div class="codigo">Antes <s>' + T.dinero(p.precio_antes) + "</s></div>" : "";

    let aviso = "";
    if (st.tipo === "agotado") aviso = '<div class="aviso agotado">' + icono("info") + (color ? "Agotado en " + esc(color) + ". Pregúntanos cuándo llega." : "Agotado por ahora. Pregúntanos cuándo llega.") + "</div>";
    else if (st.tipo === "pocas") aviso = '<div class="aviso pocas">' + icono("alerta") + "¡Pocas unidades! Quedan " + st.stock + (color ? " en " + esc(color) : "") + ".</div>";
    else if (st.tipo === "encargo") aviso = '<div class="aviso encargo">' + icono("reloj") + esc(cfg.notaEncargo || "Producto por encargo.") + "</div>";

    const selColores = colores.length
      ? '<div><div class="etiqueta-campo">Color <span>' + esc(color) + "</span></div><div class=\"colores\">" +
        colores.map((c) => '<button class="color' + (!p.encargo && T.stockDe(p, c.nombre) <= 0 ? " sin-stock" : "") + '" data-color="' + esc(c.nombre) + '" aria-pressed="' + (c.nombre === color) + '"><i style="background:' + esc(c.hex || "#ccc") + '"></i>' + esc(c.nombre) + "</button>").join("") +
        "</div></div>"
      : "";

    const puedeComprar = st.tipo !== "agotado";
    const comprar = puedeComprar
      ? '<div class="comprar"><div class="cantidad"><button data-cant="-1" aria-label="Menos">' + icono("menos") + '</button><input id="ficha-cantidad" type="number" inputmode="numeric" min="1" max="' + max + '" value="' + ficha.cantidad + '" aria-label="Cantidad"><button data-cant="1" aria-label="Más">' + icono("mas") + "</button></div>" +
        '<button class="boton claro" id="ficha-agregar">' + icono("bolsa") + "Añadir al carrito</button>" +
        '<button class="boton ancho" id="ficha-pedir">Pedir ahora</button></div>'
      : "";
    const preguntar = estado.cfg.whatsapp
      ? '<a class="boton ' + (puedeComprar ? "claro" : "whatsapp") + ' ancho" target="_blank" rel="noopener" href="' + T.enlaceWa(estado.cfg.whatsapp, "Hola, me interesa: " + p.nombre + (p.codigo ? " (" + p.codigo + ")" : "") + (color ? ", color " + color : "") + "\n" + enlaceProducto(p)) + '">' + icono("whatsapp") + "Preguntar por WhatsApp</a>"
      : "";

    const datos = [];
    if (p.categoria) datos.push(["Categoría", p.categoria]);
    if (p.material) datos.push(["Material", p.material]);
    const medidas = [["Alto", p.alto], ["Ancho", p.ancho], ["Fondo", p.fondo]].filter((x) => x[1]).map((x) => x[0] + " " + x[1]).join(" · ");
    if (medidas) datos.push(["Medidas", medidas]);

    $("#ficha").innerHTML =
      '<button class="icono-boton cerrar" data-cerrar-ficha aria-label="Cerrar">' + icono("cerrar") + "</button>" +
      '<div class="ficha-cuerpo"><div class="galeria"><div class="galeria-principal" id="galeria">' + media + "</div>" +
      (fotos.length > 1 ? '<button class="flecha-galeria izq" data-galeria="-1" aria-label="Anterior">' + icono("izquierda") + '</button><button class="flecha-galeria der" data-galeria="1" aria-label="Siguiente">' + icono("derecha") + "</button>" : "") +
      minis + "</div>" +
      '<div class="ficha-info"><div><div class="marca-cat">' + esc([p.categoria, p.marca].filter(Boolean).join(" · ")) + '</div><h2 id="ficha-nombre">' + esc(p.nombre) + "</h2>" +
      (p.codigo ? '<div class="codigo">Código ' + esc(p.codigo) + "</div>" : "") + antes + "</div>" +
      precios + aviso + selColores + comprar + preguntar +
      (p.descripcion ? '<div class="descripcion">' + esc(p.descripcion) + "</div>" : "") +
      (datos.length ? '<div class="specs">' + datos.map((d) => "<div><small>" + esc(d[0]) + "</small><span>" + esc(d[1]) + "</span></div>").join("") + "</div>" : "") +
      combinaCon(p) +
      (cfg.ventaMayor ? '<p class="nota-pequena">Precio al mayor desde ' + cfg.minimoMayor + " piezas en total (puedes combinar modelos).</p>" : "") +
      "</div></div>";

    const gal = $("#galeria");
    if (gal) {
      gal.addEventListener("scroll", () => {
        const i = Math.round(gal.scrollLeft / gal.clientWidth);
        document.querySelectorAll("[data-mini]").forEach((b) => b.setAttribute("aria-current", String(Number(b.dataset.mini) === i)));
      }, { passive: true });
    }
  }

  function combinaCon(p) {
    const cols = p.colecciones || [];
    const rel = visibles().filter((q) => q.id !== p.id && T.fotos(q).length && (q.categoria === p.categoria || (q.colecciones || []).some((c) => cols.includes(c))));
    if (!rel.length) return "";
    return '<div class="combina"><p>Combina con</p><div>' + rel.slice(0, 4).map((q) =>
      '<button data-abrir="' + q.id + '" title="' + esc(q.nombre) + '"><img src="' + esc(T.fotoPrincipal(q)) + '" alt="' + esc(q.nombre) + '" loading="lazy"' + (T.esAmbiente(q) ? ' class="cubrir"' : "") + "><span>" + esc(q.nombre) + "</span></button>").join("") + "</div></div>";
  }

  function enlaceProducto(p) {
    return location.origin + location.pathname + "#p-" + p.id;
  }

  function cerrarFicha(desdeHistorial) {
    const empujado = ficha && ficha.empujado;
    ocultarPanel($("#ficha"));
    ficha = null;
    document.querySelectorAll("#ficha video").forEach((v) => v.pause());
    if (!desdeHistorial && /^#p-/.test(location.hash)) {
      if (empujado) history.back();
      else try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* nada */ }
    }
  }

  function abrirDesdeEnlace() {
    const m = location.hash.match(/^#p-(\d+)/);
    if (m) abrirFicha(m[1], "", true);
    else if (location.hash === "#carrito") abrirCarrito();
  }

  // -------------------------------------------------------------------
  // Paneles
  // -------------------------------------------------------------------
  function mostrarPanel(el) {
    const velo = $("#velo");
    velo.classList.remove("oculto");
    el.classList.remove("oculto");
    document.body.classList.add("bloqueado");
    requestAnimationFrame(() => requestAnimationFrame(() => { velo.classList.add("visible"); el.classList.add("visible"); }));
    setTimeout(() => { const f = el.querySelector("[data-cerrar-ficha], #cerrar-carrito"); if (f) f.focus({ preventScroll: true }); }, 50);
  }
  function ocultarPanel(el) {
    el.classList.remove("visible");
    const otros = [$("#ficha"), $("#carrito")].filter((x) => x !== el && x.classList.contains("visible"));
    if (!otros.length) {
      $("#velo").classList.remove("visible");
      document.body.classList.remove("bloqueado");
    }
    setTimeout(() => {
      if (!el.classList.contains("visible")) el.classList.add("oculto");
      if (!otros.length && !$("#velo").classList.contains("visible")) $("#velo").classList.add("oculto");
    }, 320);
  }

  // -------------------------------------------------------------------
  // Carrito
  // -------------------------------------------------------------------
  function leerCarrito() {
    const c = T.leerMemoria("carrito");
    return Array.isArray(c) ? c.filter((x) => x && x.id && x.cantidad > 0) : [];
  }
  function guardarCarrito() {
    T.guardarMemoria("carrito", estado.carrito);
    pintarContador();
  }
  function unidadesCarrito() {
    return estado.carrito.reduce((a, x) => a + (x.cantidad || 0), 0);
  }
  function tipoPrecio(unidades) {
    return unidades >= estado.cfg.minimoMayor ? "mayor" : "detal";
  }
  function pintarContador() {
    const n = unidadesCarrito();
    const el = $("#contador-carrito");
    el.textContent = n ? String(n) : "";
    el.dataset.n = String(n);
    document.querySelectorAll(".contador-nav").forEach((c) => { c.textContent = n ? String(n) : ""; c.dataset.n = String(n); });
  }

  function agregar(id, color, cantidad) {
    const p = estado.productos.find((x) => String(x.id) === String(id));
    if (!p) return;
    const max = p.encargo ? 999 : T.stockDe(p, color);
    const linea = estado.carrito.find((x) => String(x.id) === String(id) && (x.color || "") === (color || ""));
    const actual = linea ? linea.cantidad : 0;
    const nueva = Math.min(max, actual + cantidad);
    if (nueva <= actual) { T.tostada("No hay más unidades disponibles" + (color ? " en " + color : "")); return; }
    if (linea) linea.cantidad = nueva;
    else estado.carrito.push({ id: p.id, color: color || "", cantidad: nueva });
    guardarCarrito();
    const faltan = estado.cfg.minimoMayor - unidadesCarrito();
    T.tostada("Agregado: " + p.nombre + (faltan > 0 && T.tieneMayor(p) ? " · faltan " + faltan + " para precio al mayor" : ""));
    if (nueva - actual < cantidad) T.tostada("Solo quedan " + max + " unidades" + (color ? " en " + color : ""));
  }

  function lineasCarrito() {
    const tipo = tipoPrecio(unidadesCarrito());
    return estado.carrito.map((x) => {
      const p = estado.productos.find((q) => String(q.id) === String(x.id));
      if (!p) return null;
      const precio = T.precio(p, tipo, estado.pago);
      return { x, p, precio, subtotal: precio * x.cantidad, max: p.encargo ? 999 : T.stockDe(p, x.color) };
    }).filter(Boolean);
  }

  function abrirCarrito() {
    pintarCarrito();
    mostrarPanel($("#carrito"));
  }
  function cerrarCarrito() {
    ocultarPanel($("#carrito"));
    if (location.hash === "#carrito") try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* nada */ }
  }

  function pintarCarrito(enviado) {
    const cuerpo = $("#carrito-cuerpo"), pie = $("#carrito-pie");
    if (enviado) {
      cuerpo.innerHTML = '<div class="listo"><div class="circulo">' + icono("check") + "</div><h3>¡Pedido listo!</h3><p>Tu pedido <b>" + esc(enviado.codigo) + "</b> quedó registrado. Termina de enviarlo en WhatsApp.</p>" +
        '<a class="boton whatsapp" href="' + esc(enviado.wa) + '" target="_blank" rel="noopener">' + icono("whatsapp") + "Abrir WhatsApp</a>" +
        (enviado.pdf ? '<a class="boton claro" href="' + esc(enviado.pdf) + '" target="_blank" rel="noopener">' + icono("pagina") + "Ver PDF del pedido</a>" : "") + "</div>";
      pie.innerHTML = '<button class="boton claro ancho" data-cerrar-carrito>Seguir viendo el catálogo</button>';
      return;
    }
    elegirMetodo(T.metodosActivos());
    const lineas = lineasCarrito();
    if (!lineas.length) {
      cuerpo.innerHTML = '<div class="listo"><div class="circulo" style="background:var(--tarjeta);color:var(--tinta)">' + icono("bolsa") + "</div><h3>Tu pedido está vacío</h3><p>Agrega productos desde el catálogo.</p></div>";
      pie.innerHTML = '<button class="boton ancho" data-cerrar-carrito>Ver catálogo</button>';
      return;
    }
    const cfg = estado.cfg;
    const metodos = T.metodosActivos();
    const unidades = unidadesCarrito();
    const tipo = tipoPrecio(unidades);
    const total = lineasCarrito().reduce((a, l) => a + l.subtotal, 0);
    const faltan = cfg.minimoMayor - unidades;
    const hayMayor = lineas.some((l) => T.tieneMayor(l.p));
    const progreso = hayMayor
      ? '<div class="progreso-mayor">' + (tipo === "mayor" ? "✓ Tienes <b>precio al mayor</b> (" + unidades + " piezas)." : "Agrega <b>" + faltan + "</b> pieza" + (faltan === 1 ? "" : "s") + " más para el <b>precio al mayor</b>.") +
        '<div class="barra"><i style="width:' + Math.min(100, (unidades / cfg.minimoMayor) * 100) + '%"></i></div></div>'
      : "";
    const c = estado.cliente;
    cuerpo.innerHTML = progreso + lineas.map((l) =>
      '<div class="linea-carrito"><img src="' + esc(T.fotoPrincipal(l.p, l.x.color)) + '" alt="" loading="lazy">' +
      "<div><h4>" + esc(l.p.nombre) + "</h4><small>" + esc([l.p.codigo, l.x.color].filter(Boolean).join(" · ")) + " · " + T.dinero(l.precio) + " c/u</small>" +
      (l.x.cantidad > l.max ? '<small style="color:var(--peligro)">Solo hay ' + l.max + " disponibles</small>" : "") +
      '<div class="cantidad"><button data-linea="' + lineaClave(l.x) + '" data-delta="-1" aria-label="Menos">' + icono("menos") + '</button><input value="' + l.x.cantidad + '" inputmode="numeric" data-linea-input="' + lineaClave(l.x) + '" aria-label="Cantidad"><button data-linea="' + lineaClave(l.x) + '" data-delta="1" aria-label="Más">' + icono("mas") + "</button></div></div>" +
      '<div class="derecha"><strong>' + T.dinero(l.subtotal) + '</strong><button class="quitar" data-quitar="' + lineaClave(l.x) + '">Quitar</button></div></div>'
    ).join("") +
      '<div class="formulario" id="form-pedido">' +
      "<h3>¿Cómo vas a pagar?</h3>" +
      (metodos.length
        ? '<div class="metodos-pago" role="group" aria-label="Forma de pago">' + metodos.map((m) => '<button data-metodo="' + esc(m.nombre) + '" aria-pressed="' + (estado.metodo === m.nombre) + '"><b>' + esc(m.nombre) + "</b><small>" + (m.moneda === "bs" ? "En bolívares" : "En divisas") + "</small></button>").join("") + "</div>"
        : '<div class="segmentado" role="group" aria-label="Forma de pago"><button data-pago="divisas" aria-pressed="' + (estado.pago === "divisas") + '">En divisas</button><button data-pago="bcv" aria-pressed="' + (estado.pago === "bcv") + '">En bolívares</button></div>') +
      "<h3>Tus datos</h3>" +
      campo("nombre", "Nombre y apellido *", c.nombre, "text", "name") +
      '<div class="dos-columnas">' + campo("telefono", "Teléfono / WhatsApp *", c.telefono, "tel", "tel") + campo("cedula", "Cédula o RIF", c.cedula, "text", "off") + "</div>" +
      campo("ciudad", "Ciudad y estado", c.ciudad, "text", "address-level2") +
      campo("entrega", "Dirección o agencia de envío", c.entrega, "text", "street-address") +
      '<label class="campo">Nota (opcional)<textarea data-cliente="nota" rows="2" placeholder="Ej.: factura a nombre de la empresa">' + esc(c.nota || "") + "</textarea></label>" +
      "</div>";

    const enBs = estado.pago === "bcv";
    const totalBs = cfg.tasaBCV ? total * cfg.tasaBCV : 0;
    pie.innerHTML = '<div class="totales"><div><span>' + unidades + " pieza" + (unidades === 1 ? "" : "s") + (cfg.ventaMayor ? " · precio " + (tipo === "mayor" ? "al mayor" : "al detal") : "") + (estado.metodo ? " · " + esc(estado.metodo) : "") + "</span></div>" +
      (enBs && totalBs
        ? '<div class="total"><span>Total</span><span>' + T.bs(totalBs) + '</span></div><div class="bs"><span>Tasa BCV ' + T.numero(cfg.tasaBCV) + " Bs/$</span><span>Ref. " + T.dinero(total) + "</span></div>"
        : '<div class="total"><span>Total</span><span>' + T.dinero(total) + "</span></div>" + (enBs ? '<div class="bs"><span>En bolívares a la tasa BCV del día</span></div>' : "")) + "</div>" +
      (cfg.whatsapp || T.demo ? '<button class="boton whatsapp ancho" id="enviar-pedido">' + icono("whatsapp") + "Enviar pedido por WhatsApp</button>" : '<p class="nota-pequena" style="color:var(--peligro)">La tienda aún no configuró su WhatsApp.</p>') +
      '<p class="nota-pequena">Te confirmaremos disponibilidad y envío por WhatsApp.</p>';

    function campo(k, etiqueta, v, tipoCampo, auto) {
      return '<label class="campo">' + etiqueta + '<input data-cliente="' + k + '" type="' + tipoCampo + '" autocomplete="' + auto + '" value="' + esc(v || "") + '"></label>';
    }
  }

  function elegirMetodo(metodos) {
    if (!metodos.length) { estado.metodo = ""; return; }
    let m = metodos.find((x) => x.nombre === estado.metodo);
    if (!m) { m = metodos[0]; estado.metodo = m.nombre; }
    estado.pago = m.moneda === "bs" ? "bcv" : "divisas";
  }

  const lineaClave = (x) => esc(x.id + "|" + (x.color || ""));
  function buscarLinea(clave) {
    return estado.carrito.find((x) => x.id + "|" + (x.color || "") === clave);
  }

  // -------------------------------------------------------------------
  // Enviar pedido: PDF → Cloudflare → guardar pendiente → WhatsApp
  // -------------------------------------------------------------------
  async function enviarPedido() {
    const cfg = estado.cfg;
    const c = estado.cliente;
    if (!c.nombre || c.nombre.trim().length < 3) return marcarError("nombre", "Escribe tu nombre");
    if (String(c.telefono || "").replace(/\D/g, "").length < 7) return marcarError("telefono", "Escribe un teléfono válido");
    elegirMetodo(T.metodosActivos());
    const lineas = lineasCarrito();
    const exceso = lineas.find((l) => l.x.cantidad > l.max);
    if (exceso) { T.tostada("Ajusta la cantidad de " + exceso.p.nombre + " (hay " + exceso.max + ")"); return; }
    if (!lineas.length) return;

    const boton = $("#enviar-pedido");
    boton.disabled = true;
    boton.textContent = "Preparando tu pedido…";

    // Abrimos la pestaña ya (los celulares bloquean ventanas abiertas después)
    let ventana = null;
    if (!/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      try { ventana = window.open("", "_blank"); if (ventana) ventana.document.write("<p style='font-family:sans-serif;padding:20px'>Preparando tu pedido…</p>"); } catch (e) { ventana = null; }
    }

    const unidades = unidadesCarrito();
    const tipo = tipoPrecio(unidades);
    const total = lineas.reduce((a, l) => a + l.subtotal, 0);
    const id = T.uuid();
    const ahora = new Date();
    const codigo = "P" + String(ahora.getFullYear()).slice(2) + String(ahora.getMonth() + 1).padStart(2, "0") + String(ahora.getDate()).padStart(2, "0") + "-" + id.slice(0, 4).toUpperCase();
    const pedido = {
      id, codigo,
      cliente: { nombre: c.nombre.trim(), telefono: (c.telefono || "").trim(), cedula: (c.cedula || "").trim(), ciudad: (c.ciudad || "").trim(), entrega: (c.entrega || "").trim() },
      items: lineas.map((l) => ({ id: l.p.id, nombre: l.p.nombre, codigo: l.p.codigo || "", color: l.x.color || "", cantidad: l.x.cantidad, precio: round2(l.precio), subtotal: round2(l.subtotal), foto: T.fotoPrincipal(l.p, l.x.color) })),
      tipo_precio: tipo,
      forma_pago: estado.metodo ? estado.metodo + (estado.pago === "bcv" ? " (Bs)" : " (divisas)") : estado.pago === "bcv" ? "Bolívares" : "Divisas",
      total: round2(total),
      total_bs: estado.pago === "bcv" && cfg.tasaBCV ? round2(total * cfg.tasaBCV) : null,
      nota: (c.nota || "").trim() || null,
      pdf_url: null,
    };

    // 1) PDF + subida a Cloudflare (si falla, seguimos sin PDF)
    try {
      const blob = await crearPdf(pedido);
      pedido.pdf_url = await T.subirPdfPedido(cfg, id, blob);
      if (!pedido.pdf_url && T.demo) pedido.pdf_url = URL.createObjectURL(blob);
    } catch (e) {
      console.warn("PDF no disponible:", e);
    }

    // 2) Guardar como pendiente en el almacén
    let guardado = true;
    try { await T.guardarPedido(pedido); } catch (e) { guardado = false; console.warn("No se guardó el pedido:", e); }

    // 3) WhatsApp
    const texto = mensajePedido(pedido);
    const wa = T.enlaceWa(cfg.whatsapp || "", texto);
    estado.carrito = [];
    guardarCarrito();
    pintarCarrito({ codigo, wa, pdf: pedido.pdf_url });
    if (!guardado) T.tostada("Tu pedido se enviará solo por WhatsApp", 4000);
    if (ventana && !ventana.closed) ventana.location.href = wa;
    else window.location.href = wa;
  }

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  function marcarError(campo, msg) {
    const el = document.querySelector('[data-cliente="' + campo + '"]');
    if (el) { el.focus(); el.style.borderColor = "var(--peligro)"; }
    T.tostada(msg);
  }

  function mensajePedido(p) {
    const cfg = estado.cfg;
    const L = [];
    L.push("Hola 👋 Quiero hacer este pedido:");
    L.push("*Pedido " + p.codigo + "*");
    L.push("");
    p.items.forEach((i) => L.push("• " + i.cantidad + " × " + i.nombre + (i.codigo ? " [" + i.codigo + "]" : "") + (i.color ? " (" + i.color + ")" : "") + " — " + T.dinero(i.subtotal)));
    L.push("");
    L.push(p.total_bs ? "*Total: " + T.bs(p.total_bs) + "* (ref. " + T.dinero(p.total) + ")" : "*Total: " + T.dinero(p.total) + "*" + (cfg.ventaMayor ? " (precio " + (p.tipo_precio === "mayor" ? "al mayor" : "al detal") + ")" : ""));
    L.push("Pago: " + p.forma_pago + (p.total_bs ? " · " + T.bs(p.total_bs) + " (tasa BCV " + T.numero(cfg.tasaBCV) + ")" : ""));
    L.push("");
    L.push("*Cliente:* " + p.cliente.nombre + (p.cliente.cedula ? " · " + p.cliente.cedula : ""));
    L.push("Teléfono: " + p.cliente.telefono);
    if (p.cliente.ciudad) L.push("Ciudad: " + p.cliente.ciudad);
    if (p.cliente.entrega) L.push("Entrega: " + p.cliente.entrega);
    if (p.nota) L.push("Nota: " + p.nota);
    if (p.pdf_url && /^https?:/.test(p.pdf_url)) { L.push(""); L.push("📄 PDF del pedido: " + p.pdf_url); }
    return L.join("\n");
  }

  // PDF del pedido (jsPDF, se carga solo al enviar)
  async function crearPdf(p) {
    await T.cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const cfg = estado.cfg;
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 40;
    let y = M;
    const texto = (t, x, yy, o) => doc.text(String(t == null ? "" : t), x, yy, o);

    doc.setFillColor(246, 246, 247); doc.rect(0, 0, W, 86, "F"); doc.setFillColor(5, 51, 89); doc.rect(0, 86, W, 4, "F");
    doc.setTextColor(11, 9, 10); doc.setFont("helvetica", "bold"); doc.setFontSize(24);
    const logoPdf = !cfg.logo || /logo-arkeo-(blanco|negro)\.png$/.test(cfg.logo) ? "img/logo-arkeo-negro.png" : cfg.logo;
    const logo = await imagenComoDato(logoPdf).catch(() => null);
    if (logo) doc.addImage(logo.dato, "PNG", M, 18, 50 * logo.proporcion, 50);
    else texto(String(cfg.nombreTienda).toUpperCase(), M, 50, { charSpace: 2 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    texto([cfg.telefono || cfg.whatsapp, cfg.instagram ? "@" + String(cfg.instagram).replace(/^@/, "") : "", cfg.correo].filter(Boolean).join("   ·   "), logo ? W - M : M, logo ? 76 : 68, logo ? { align: "right" } : undefined);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    texto("PEDIDO " + p.codigo, W - M, 46, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    texto(new Date().toLocaleString("es-VE"), W - M, 62, { align: "right" });
    y = 116;

    doc.setTextColor(21);
    doc.setFontSize(9); doc.setTextColor(110); texto("CLIENTE", M, y); texto("CONDICIONES", W / 2 + 10, y);
    doc.setTextColor(21); doc.setFontSize(11);
    const cli = [p.cliente.nombre, p.cliente.cedula && "C.I./RIF: " + p.cliente.cedula, "Tel.: " + p.cliente.telefono, p.cliente.ciudad, p.cliente.entrega].filter(Boolean);
    const cond = [cfg.ventaMayor ? "Precio " + (p.tipo_precio === "mayor" ? "al mayor" : "al detal") : "", "Pago: " + p.forma_pago, p.total_bs ? "Tasa BCV: " + T.numero(cfg.tasaBCV) + " Bs/$" : ""].filter(Boolean);
    let y1 = y + 16, y2 = y + 16;
    cli.forEach((l) => { doc.splitTextToSize(l, W / 2 - M - 10).forEach((s) => { texto(s, M, y1); y1 += 15; }); });
    cond.forEach((l) => { texto(l, W / 2 + 10, y2); y2 += 15; });
    y = Math.max(y1, y2) + 12;

    // Tabla
    const col = { foto: M, prod: M + 54, cant: W - M - 200, precio: W - M - 110, sub: W - M };
    const cabecera = () => {
      doc.setFillColor(243, 243, 244); doc.rect(M, y, W - 2 * M, 24, "F");
      doc.setFontSize(9); doc.setTextColor(90); doc.setFont("helvetica", "bold");
      texto("PRODUCTO", col.prod, y + 16); texto("CANT.", col.cant, y + 16, { align: "right" }); texto("PRECIO", col.precio, y + 16, { align: "right" }); texto("SUBTOTAL", col.sub - 4, y + 16, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setTextColor(21);
      y += 30;
    };
    cabecera();
    for (const i of p.items) {
      if (y > H - 140) { doc.addPage(); y = M; cabecera(); }
      const mini = await miniatura(i.foto).catch(() => null);
      if (mini) { try { doc.addImage(mini, "JPEG", col.foto + 2, y - 4, 40, 40); } catch (e) { /* nada */ } }
      doc.setFontSize(10.5); doc.setFont("helvetica", "bold");
      const nombre = doc.splitTextToSize(i.nombre, col.cant - col.prod - 50);
      texto(nombre[0], col.prod, y + 10);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
      texto([i.codigo, i.color].filter(Boolean).join(" · "), col.prod, y + 25);
      doc.setTextColor(21); doc.setFontSize(10.5);
      texto(String(i.cantidad), col.cant, y + 14, { align: "right" });
      texto(T.dinero(i.precio), col.precio, y + 14, { align: "right" });
      doc.setFont("helvetica", "bold"); texto(T.dinero(i.subtotal), col.sub - 4, y + 14, { align: "right" }); doc.setFont("helvetica", "normal");
      y += 44;
      doc.setDrawColor(225, 221, 213); doc.line(M, y - 6, W - M, y - 6);
    }
    y += 6;
    doc.setFontSize(10); doc.setTextColor(110);
    const piezas = p.items.reduce((a, i) => a + i.cantidad, 0);
    texto(piezas + (piezas === 1 ? " pieza" : " piezas"), M, y + 12);
    doc.setTextColor(21); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    texto("TOTAL  " + T.dinero(p.total), W - M - 4, y + 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    if (p.total_bs) { doc.setFontSize(11); doc.setTextColor(90); texto("Aprox. " + T.bs(p.total_bs), W - M - 4, y + 32, { align: "right" }); }
    y += 52;
    if (p.nota) { doc.setFontSize(10); doc.setTextColor(21); doc.splitTextToSize("Nota: " + p.nota, W - 2 * M).forEach((s) => { texto(s, M, y); y += 14; }); }
    doc.setFontSize(8.5); doc.setTextColor(130);
    doc.splitTextToSize("Pedido sujeto a confirmación de disponibilidad. Precios en dólares estadounidenses" + (p.total_bs ? "; el monto en bolívares se calcula a la tasa BCV del día de pago." : "."), W - 2 * M)
      .forEach((s, k) => texto(s, M, H - 46 + k * 11));
    return doc.output("blob");
  }

  // Logo (PNG con transparencia) para el encabezado del PDF
  function imagenComoDato(url) {
    return new Promise((ok, mal) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const t = setTimeout(() => mal(new Error("tiempo")), 5000);
      img.onload = () => {
        clearTimeout(t);
        try {
          const c = document.createElement("canvas");
          const alto = 200;
          c.height = alto; c.width = Math.round(img.width * (alto / img.height));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          ok({ dato: c.toDataURL("image/png"), proporcion: c.width / c.height });
        } catch (e) { mal(e); }
      };
      img.onerror = () => { clearTimeout(t); mal(new Error("no carga")); };
      img.src = url;
    });
  }

  // Miniatura JPEG pequeña para el PDF (si la foto lo permite)
  function miniatura(url) {
    return new Promise((ok, mal) => {
      if (!url || /\.svg(\?|$)/i.test(url)) return mal(new Error("sin foto"));
      const img = new Image();
      img.crossOrigin = "anonymous";
      const t = setTimeout(() => mal(new Error("tiempo")), 5000);
      img.onload = () => {
        clearTimeout(t);
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 120;
          const g = c.getContext("2d");
          g.fillStyle = "#ffffff"; g.fillRect(0, 0, 120, 120);
          const r = Math.min(120 / img.width, 120 / img.height);
          g.drawImage(img, (120 - img.width * r) / 2, (120 - img.height * r) / 2, img.width * r, img.height * r);
          ok(c.toDataURL("image/jpeg", 0.7));
        } catch (e) { mal(e); }
      };
      img.onerror = () => { clearTimeout(t); mal(new Error("no carga")); };
      img.src = url;
    });
  }

  // -------------------------------------------------------------------
  // Eventos
  // -------------------------------------------------------------------
  function enlazarEventos() {
    let tBuscar;
    const en = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    if ($("#buscar") && estado.texto) $("#buscar").value = estado.texto;
    en("#buscar", "input", (e) => {
      clearTimeout(tBuscar);
      tBuscar = setTimeout(() => { estado.texto = e.target.value; estado.mostrar = POR_PAGINA; if ($("#colecciones")) pintarColecciones(); pintarLista(); }, 150);
    });
    en("#ordenar", "change", (e) => { estado.orden = e.target.value; pintarLista(); });
    en("#filtro-disponibles", "click", (e) => { estado.disponibles = !estado.disponibles; e.currentTarget.setAttribute("aria-pressed", estado.disponibles); pintarLista(); });
    en("#filtro-ofertas", "click", (e) => { estado.ofertas = !estado.ofertas; e.currentTarget.setAttribute("aria-pressed", estado.ofertas); pintarLista(); });
    en("#ver-mas", "click", () => { estado.mostrar += POR_PAGINA; pintarLista(); });
    // Filtros del catálogo (en celular se abren como panel)
    const panel = $("#filtros");
    const abrirPanel = (si) => { if (!panel) return; panel.classList.toggle("abierto", si); document.body.classList.toggle("bloqueado", si); };
    en("#abrir-filtros", "click", () => abrirPanel(true));
    en("#cerrar-filtros", "click", () => abrirPanel(false));
    en("#ver-resultados", "click", () => { abrirPanel(false); $("#rejilla").scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#abrir-carrito").addEventListener("click", abrirCarrito);
    const c2 = $("#abrir-carrito-2");
    if (c2) c2.addEventListener("click", abrirCarrito);
    $("#cerrar-carrito").addEventListener("click", cerrarCarrito);
    $("#velo").addEventListener("click", () => { if (ficha) cerrarFicha(); else cerrarCarrito(); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (ficha) cerrarFicha(); else if ($("#carrito").classList.contains("visible")) cerrarCarrito();
    });
    window.addEventListener("popstate", () => {
      const m = location.hash.match(/^#p-(\d+)/);
      if (m) abrirFicha(m[1], "", true);
      else if (ficha) cerrarFicha(true);
    });

    document.addEventListener("click", (e) => {
      const t = e.target.closest("button, a");
      if (!t) return;
      const d = t.dataset;
      if (d.categoria !== undefined) {
        estado.categoria = d.categoria; estado.coleccion = ""; estado.mostrar = POR_PAGINA;
        document.querySelectorAll("[data-categoria]").forEach((b) => b.setAttribute("aria-pressed", b === t));
        pintarLista();
        return;
      }
      if (d.coleccion !== undefined) {
        estado.coleccion = estado.coleccion === d.coleccion ? "" : d.coleccion; estado.categoria = ""; estado.mostrar = POR_PAGINA;
        document.querySelectorAll("[data-categoria]").forEach((b) => b.setAttribute("aria-pressed", !estado.coleccion && b.dataset.categoria === ""));
        pintarLista();
        $("#titulo-lista").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (d.fCat !== undefined) { estado.categoria = d.fCat; estado.coleccion = ""; estado.mostrar = POR_PAGINA; pintarFiltros(); pintarLista(); return; }
      if (d.fTramo !== undefined) {
        const [a, b] = d.fTramo.split("-");
        const mismo = estado.precioMin === Number(a) && estado.precioMax === (b === "" ? null : Number(b));
        estado.precioMin = mismo ? null : Number(a); estado.precioMax = mismo || b === "" ? null : Number(b);
        if (!mismo && estado.precioMin === 0) estado.precioMin = 0;
        pintarFiltros(); pintarLista(); return;
      }
      if (d.fMat !== undefined) { estado.materiales = alternar(estado.materiales, d.fMat); pintarFiltros(); pintarLista(); return; }
      if (d.fCol !== undefined) { estado.coloresSel = alternar(estado.coloresSel, d.fCol); pintarFiltros(); pintarLista(); return; }
      if (d.fDisp !== undefined) { estado.dispSel = alternar(estado.dispSel, d.fDisp); pintarFiltros(); pintarLista(); return; }
      if (d.quitarFiltro !== undefined) { quitarFiltro(d.quitarFiltro); pintarFiltros(); pintarLista(); return; }
      if (d.limpiarFiltros !== undefined) {
        Object.assign(estado, { categoria: "", coleccion: "", texto: "", precioMin: null, precioMax: null, materiales: [], coloresSel: [], dispSel: [] });
        if ($("#buscar")) $("#buscar").value = "";
        pintarFiltros(); pintarLista(); return;
      }
      if (d.catTarjeta !== undefined && !EN_CATALOGO) { location.href = "catalogo.html?cat=" + encodeURIComponent(d.catTarjeta); return; }
      if (d.coleccion !== undefined && !EN_CATALOGO) { location.href = "catalogo.html?col=" + encodeURIComponent(d.coleccion); return; }
      if (d.catTarjeta !== undefined) {
        estado.categoria = d.catTarjeta; estado.coleccion = ""; estado.mostrar = POR_PAGINA;
        document.querySelectorAll("[data-categoria]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.categoria === d.catTarjeta));
        pintarLista();
        $("#titulo-lista").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (d.heroe) { mostrarSlide(heroe.i + Number(d.heroe)); return; }
      if (d.nav === "buscar" && !$("#buscar")) { e.preventDefault(); location.href = "catalogo.html#buscar"; return; }
      if (d.nav === "buscar") { e.preventDefault(); $("#buscar").scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => $("#buscar").focus({ preventScroll: true }), 450); return; }
      if (d.nav === "inicio") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (d.abrir) { abrirFicha(d.abrir); return; }
      if (d.anadir || d.pedir) {
        const id = d.anadir || d.pedir;
        const p = estado.productos.find((x) => String(x.id) === String(id));
        if (!p) return;
        const cols = T.colores(p);
        if (cols.length > 1) { abrirFicha(p.id); if (ficha) ficha.pedir = !!d.pedir; T.tostada("Elige el color"); return; }
        const antes = unidadesCarrito();
        agregar(p.id, (cols[0] || {}).nombre || "", 1);
        if (d.pedir && unidadesCarrito() >= antes) abrirCarrito();
        return;
      }
      if (d.rapido) {
        const p = estado.productos.find((x) => String(x.id) === d.rapido);
        if (p && T.colores(p).length > 1) abrirFicha(p.id);
        else if (p) agregar(p.id, (T.colores(p)[0] || {}).nombre || "", 1);
        return;
      }
      if (d.cerrarFicha !== undefined) { cerrarFicha(); return; }
      if (d.color !== undefined && ficha) { ficha.color = d.color; ficha.cantidad = 1; pintarFicha(); return; }
      if (d.cant && ficha) {
        const inp = $("#ficha-cantidad");
        const max = Number(inp.max) || 1;
        ficha.cantidad = Math.max(1, Math.min(max, (Number(inp.value) || 1) + Number(d.cant)));
        inp.value = ficha.cantidad;
        return;
      }
      if ((t.id === "ficha-agregar" || t.id === "ficha-pedir") && ficha) {
        ficha.cantidad = Math.max(1, Number($("#ficha-cantidad").value) || 1);
        const antes = unidadesCarrito();
        agregar(ficha.p.id, ficha.color, ficha.cantidad);
        if (t.id === "ficha-pedir" || ficha.pedir) {
          if (unidadesCarrito() > antes || estado.carrito.some((x) => String(x.id) === String(ficha.p.id))) { cerrarFicha(); setTimeout(abrirCarrito, 60); }
          return;
        }
        pintarFicha();
        return;
      }
      if (d.galeria) {
        const g = $("#galeria");
        g.scrollBy({ left: g.clientWidth * Number(d.galeria), behavior: "smooth" });
        return;
      }
      if (d.mini !== undefined) {
        const g = $("#galeria");
        g.scrollTo({ left: g.clientWidth * Number(d.mini), behavior: "smooth" });
        return;
      }
      if (d.linea) {
        const l = buscarLinea(d.linea);
        if (!l) return;
        const p = estado.productos.find((x) => String(x.id) === String(l.id));
        const max = p ? (p.encargo ? 999 : T.stockDe(p, l.color)) : 0;
        const nueva = l.cantidad + Number(d.delta);
        if (nueva > max) { T.tostada("Solo hay " + max + " disponibles"); return; }
        l.cantidad = nueva;
        if (l.cantidad <= 0) estado.carrito = estado.carrito.filter((x) => x !== l);
        guardarCarrito(); pintarCarrito();
        return;
      }
      if (d.quitar) {
        const l = buscarLinea(d.quitar);
        estado.carrito = estado.carrito.filter((x) => x !== l);
        guardarCarrito(); pintarCarrito();
        return;
      }
      if (d.pago) { estado.pago = d.pago; T.guardarMemoria("pago", d.pago); pintarCarrito(); return; }
      if (d.metodo !== undefined) { estado.metodo = d.metodo; T.guardarMemoria("metodo", d.metodo); pintarCarrito(); return; }
      if (d.cerrarCarrito !== undefined) { cerrarCarrito(); return; }
      if (t.id === "enviar-pedido") { enviarPedido(); return; }
    });

    document.addEventListener("input", (e) => {
      const k = e.target.dataset.cliente;
      if (k) {
        estado.cliente[k] = e.target.value;
        e.target.style.borderColor = "";
        T.guardarMemoria("cliente", estado.cliente);
      }
    });
    document.addEventListener("change", (e) => {
      const clave = e.target.dataset.lineaInput;
      if (clave) {
        const l = buscarLinea(clave);
        if (!l) return;
        const p = estado.productos.find((x) => String(x.id) === String(l.id));
        const max = p ? (p.encargo ? 999 : T.stockDe(p, l.color)) : 0;
        l.cantidad = Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0));
        if (!l.cantidad) estado.carrito = estado.carrito.filter((x) => x !== l);
        guardarCarrito(); pintarCarrito();
      }
      if (e.target.id === "ficha-cantidad" && ficha) {
        const max = Number(e.target.max) || 1;
        ficha.cantidad = Math.max(1, Math.min(max, parseInt(e.target.value, 10) || 1));
        e.target.value = ficha.cantidad;
      }
    });
  }

  iniciar();
})();
