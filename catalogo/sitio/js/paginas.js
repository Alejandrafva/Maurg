/* paginas.js — páginas informativas (pagos, envíos, reseñas, contacto, políticas, privacidad).
   Si en el almacén (Página > Páginas informativas) escribes un texto, reemplaza al texto de fábrica. */
(function () {
  const T = window.Tienda;
  const esc = T.esc;
  const slug = document.body.dataset.pagina;
  const original = document.getElementById("contenido").innerHTML;

  function pintar(cfg) {
    T.pintarComun(cfg);
    document.title = document.querySelector("h1").textContent + " · " + cfg.nombreTienda;
    const cabeza = document.querySelector(".pagina-cabeza");
    if (cabeza) {
      cabeza.classList.add("con-foto");
      cabeza.style.setProperty("--foto", "url('" + new URL(T.fotoDePagina(cfg, slug), location.href).href.replace(/'/g, "%27") + "')");
    }
    const propio = cfg.paginas && cfg.paginas[slug];
    const cont = document.getElementById("contenido");
    cont.innerHTML = original;
    if (propio && String(propio).trim() && slug !== "resenas" && slug !== "contacto") {
      cont.innerHTML = T.textoAHtml(propio) + '<div id="extra-pago"></div><div id="extra-envio"></div>';
    } else
    if (propio && String(propio).trim()) cont.insertAdjacentHTML("afterbegin", T.textoAHtml(propio));

    const lm = document.getElementById("lista-metodos");
    if (slug === "pagos" && lm) {
      const act = (cfg.metodosPago || []).filter((m) => m.activo);
      if (act.length) lm.innerHTML = act.map((m) => '<div class="metodo"><b>' + esc(m.nombre) + "</b><span>" + (m.moneda === "bs" ? "En bolívares" : "En divisas") + "</span>" + (m.detalle ? "<small>" + esc(m.detalle) + "</small>" : "") + "</div>").join("");
    }
    if (slug === "pagos" && cfg.datosPago && document.getElementById("extra-pago")) {
      document.getElementById("extra-pago").innerHTML = "<h2>Datos para pagar</h2>" + T.textoAHtml(cfg.datosPago);
    }
    if (slug === "envios" && document.getElementById("extra-envio")) {
      let h = "";
      if (cfg.agencias) h += "<h2>Agencias</h2>" + T.textoAHtml(cfg.agencias);
      if (cfg.ubicacion) h += "<h2>Retiro y entregas locales</h2>" + T.textoAHtml(cfg.ubicacion);
      document.getElementById("extra-envio").innerHTML = h;
    }
    if (slug === "resenas") {
      const lista = (cfg.resenas || []).filter((r) => r && r.texto);
      document.getElementById("lista-resenas").innerHTML = lista.length
        ? lista.map((r) => {
          const n = Math.max(0, Math.min(5, parseInt(r.estrellas, 10) || 5));
          return '<div class="resena">' + (r.foto ? '<img src="' + esc(r.foto) + '" alt="" loading="lazy">' : "") +
            '<div class="estrellas" aria-label="' + n + ' de 5 estrellas">' + "★".repeat(n) + "☆".repeat(5 - n) + "</div>" +
            "<p>“" + esc(r.texto) + "”</p><strong>" + esc(r.nombre || "Cliente") + (r.ciudad ? " · " + esc(r.ciudad) : "") + "</strong></div>";
        }).join("")
        : "<p>Pronto publicaremos las opiniones de nuestros clientes.</p>";
    }
    if (slug === "contacto") {
      const items = [];
      if (cfg.whatsapp) items.push('<a href="' + T.enlaceWa(cfg.whatsapp, "Hola 👋") + '" target="_blank" rel="noopener">' + icono("whatsapp") + "<span><b>WhatsApp</b><br>" + esc(cfg.telefono || cfg.whatsapp) + "</span></a>");
      if (cfg.instagram) items.push('<a href="https://instagram.com/' + esc(String(cfg.instagram).replace(/^@/, "")) + '" target="_blank" rel="noopener">' + icono("instagram") + "<span><b>Instagram</b><br>@" + esc(String(cfg.instagram).replace(/^@/, "")) + "</span></a>");
      if (cfg.tiktok) items.push('<a href="https://tiktok.com/@' + esc(String(cfg.tiktok).replace(/^@/, "")) + '" target="_blank" rel="noopener">' + icono("tiktok") + "<span><b>TikTok</b><br>@" + esc(String(cfg.tiktok).replace(/^@/, "")) + "</span></a>");
      if (cfg.correo) items.push('<a href="mailto:' + esc(cfg.correo) + '">' + icono("correo") + "<span><b>Correo</b><br>" + esc(cfg.correo) + "</span></a>");
      if (cfg.direccion) items.push((cfg.mapa ? '<a href="' + esc(cfg.mapa) + '" target="_blank" rel="noopener">' : "<div>") + icono("ubicacion") + "<span><b>Dirección</b><br>" + esc(cfg.direccion) + "</span>" + (cfg.mapa ? "</a>" : "</div>"));
      if (cfg.horario) items.push("<div>" + icono("reloj") + "<span><b>Horario</b><br>" + esc(cfg.horario) + "</span></div>");
      document.getElementById("lista-contacto").innerHTML = items.join("") || "<p>Pronto publicaremos nuestros datos de contacto.</p>";
    }
  }

  const guardada = T.leerMemoria("config");
  if (guardada && !T.demo) pintar(T.unirAjustes(guardada));
  T.cargarConfig().then(pintar).catch((e) => {
    console.error(e);
    if (!guardada) pintar(T.unirAjustes({}));
  });
})();
