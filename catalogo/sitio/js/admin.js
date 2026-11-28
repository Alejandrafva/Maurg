/* =====================================================================
   admin.js — Almacén: productos, fotos, stock por color, pedidos,
   categorías, página, proveedores, ajustes y Excel.
   ===================================================================== */
(function () {
  const T = window.Tienda;
  const esc = T.esc;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const EXCELJS = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";

  const E = {
    vista: "productos",
    cfg: T.unirAjustes({}),
    productos: [],
    pedidos: [],
    proveedores: [],
    filtro: { texto: "", categoria: "", estado: "" },
    correo: "",
  };
  let sb = null; // cliente de Supabase

  // ===================================================================
  // Datos (Supabase o demostración)
  // ===================================================================
  const D = {
    async iniciar() {
      if (T.demo) { await T.prepararDemo(); return; }
      await T.cargarScript(SUPABASE_JS);
      sb = window.supabase.createClient(T.url, T.clave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    },
    async sesion() {
      if (T.demo) return T.demoLeer("sesion");
      const { data } = await sb.auth.getSession();
      return data.session ? { correo: data.session.user.email } : null;
    },
    async entrar(correo, clave) {
      if (T.demo) { T.demoGuardar("sesion", { correo }); return; }
      const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
      if (error) throw new Error(/invalid/i.test(error.message) ? "Correo o contraseña incorrectos." : error.message);
    },
    async salir() {
      if (T.demo) { localStorage.removeItem("demo:sesion"); return; }
      await sb.auth.signOut();
    },
    async recuperar(correo) {
      if (T.demo) return;
      const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
    },
    async cambiarClave(clave) {
      if (T.demo) return;
      const { error } = await sb.auth.updateUser({ password: clave });
      if (error) throw error;
    },
    async esAdmin() {
      if (T.demo) return true;
      const { data, error } = await sb.rpc("es_admin");
      if (error) throw error;
      return data === true;
    },
    async token() {
      if (T.demo) return "demo";
      const { data } = await sb.auth.getSession();
      return data.session ? data.session.access_token : "";
    },
    // --- productos
    async productos() {
      if (T.demo) return T.ordenar(T.demoLeer("productos") || []);
      const { data, error } = await sb.from("productos").select("*").order("orden", { ascending: true }).order("id", { ascending: false });
      if (error) throw error;
      return data;
    },
    async guardarProducto(p) {
      const fila = Object.assign({}, p);
      delete fila.creado; delete fila.actualizado;
      if (T.demo) {
        const lista = T.demoLeer("productos") || [];
        if (!fila.id) fila.id = lista.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
        const sc = fila.stock_color || {};
        if (Object.keys(sc).length) fila.stock = Object.values(sc).reduce((a, b) => a + Math.max(0, parseInt(b, 10) || 0), 0);
        const i = lista.findIndex((x) => x.id === fila.id);
        if (i >= 0) lista[i] = Object.assign({}, lista[i], fila); else lista.push(fila);
        T.demoGuardar("productos", lista);
        return lista.find((x) => x.id === fila.id);
      }
      if (fila.id) {
        const id = fila.id; delete fila.id;
        const { data, error } = await sb.from("productos").update(fila).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      delete fila.id;
      const { data, error } = await sb.from("productos").insert(fila).select().single();
      if (error) throw error;
      return data;
    },
    async borrarProducto(id) {
      if (T.demo) { T.demoGuardar("productos", (T.demoLeer("productos") || []).filter((x) => x.id !== id)); return; }
      const { error } = await sb.from("productos").delete().eq("id", id);
      if (error) throw error;
    },
    async privado(id) {
      if (T.demo) return (T.demoLeer("privado") || {})[id] || null;
      const { data, error } = await sb.from("productos_privado").select("*").eq("producto_id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async privados() {
      if (T.demo) return Object.values(T.demoLeer("privado") || {});
      const { data, error } = await sb.from("productos_privado").select("*");
      if (error) throw error;
      return data || [];
    },
    async guardarPrivado(fila) {
      if (T.demo) { const m = T.demoLeer("privado") || {}; m[fila.producto_id] = fila; T.demoGuardar("privado", m); return; }
      const { error } = await sb.from("productos_privado").upsert(fila, { onConflict: "producto_id" });
      if (error) throw error;
    },
    async renombrarCategoria(vieja, nueva) {
      if (T.demo) {
        T.demoGuardar("productos", (T.demoLeer("productos") || []).map((p) => (p.categoria === vieja ? Object.assign(p, { categoria: nueva }) : p)));
        return;
      }
      const { error } = await sb.from("productos").update({ categoria: nueva }).eq("categoria", vieja);
      if (error) throw error;
    },
    // --- config
    async config() {
      if (T.demo) return T.unirAjustes(T.demoLeer("config"));
      const { data, error } = await sb.from("config").select("datos").eq("id", 1).maybeSingle();
      if (error) throw error;
      return T.unirAjustes(data ? data.datos : {});
    },
    async guardarConfig(datos) {
      if (T.demo) { T.demoGuardar("config", datos); return; }
      const { data, error } = await sb.from("config").update({ datos, actualizado: new Date().toISOString() }).eq("id", 1).select("id");
      if (error) throw error;
      if (!data || !data.length) {
        const r = await sb.from("config").insert({ id: 1, datos });
        if (r.error) throw r.error;
      }
    },
    // --- pedidos
    async pedidos() {
      if (T.demo) return T.demoLeer("pedidos") || [];
      await sb.rpc("limpiar_pedidos_viejos").then(() => null, () => null);
      const { data, error } = await sb.from("pedidos").select("*").order("creado", { ascending: false });
      if (error) throw error;
      return data;
    },
    async actualizarPedido(id, cambios) {
      if (T.demo) {
        T.demoGuardar("pedidos", (T.demoLeer("pedidos") || []).map((x) => (x.id === id ? Object.assign({}, x, cambios) : x)));
        return;
      }
      const { error } = await sb.from("pedidos").update(cambios).eq("id", id);
      if (error) throw error;
    },
    async aceptarPedido(id, items) {
      if (T.demo) {
        const lista = T.demoLeer("productos") || [];
        items.forEach((it) => {
          const p = lista.find((x) => String(x.id) === String(it.id));
          if (!p) return;
          const sc = p.stock_color || {};
          if (it.color && Object.prototype.hasOwnProperty.call(sc, it.color)) {
            sc[it.color] = Math.max(0, (parseInt(sc[it.color], 10) || 0) - it.cantidad);
            p.stock = Object.values(sc).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
          } else p.stock = Math.max(0, (p.stock || 0) - it.cantidad);
        });
        T.demoGuardar("productos", lista);
        T.demoGuardar("pedidos", (T.demoLeer("pedidos") || []).filter((x) => x.id !== id));
        return;
      }
      const { error } = await sb.rpc("aceptar_pedido", { p_id: id, p_items: items });
      if (error) throw error;
    },
    async borrarPedido(id) {
      if (T.demo) { T.demoGuardar("pedidos", (T.demoLeer("pedidos") || []).filter((x) => x.id !== id)); return; }
      const { error } = await sb.from("pedidos").delete().eq("id", id);
      if (error) throw error;
    },
    // --- proveedores
    async proveedores() {
      if (T.demo) return T.demoLeer("proveedores") || [];
      const { data, error } = await sb.from("proveedores").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
    async guardarProveedor(p) {
      if (T.demo) {
        const l = T.demoLeer("proveedores") || [];
        if (!p.id) { p.id = l.reduce((m, x) => Math.max(m, x.id), 0) + 1; l.push(p); } else l.splice(l.findIndex((x) => x.id === p.id), 1, p);
        T.demoGuardar("proveedores", l);
        return p;
      }
      const fila = Object.assign({}, p); delete fila.creado;
      if (fila.id) { const id = fila.id; delete fila.id; const { error } = await sb.from("proveedores").update(fila).eq("id", id); if (error) throw error; return p; }
      delete fila.id;
      const { data, error } = await sb.from("proveedores").insert(fila).select().single();
      if (error) throw error;
      return data;
    },
    async borrarProveedor(id) {
      if (T.demo) { T.demoGuardar("proveedores", (T.demoLeer("proveedores") || []).filter((x) => x.id !== id)); return; }
      const { error } = await sb.from("proveedores").delete().eq("id", id);
      if (error) throw error;
    },
  };

  // ===================================================================
  // Archivos en Cloudflare (Worker)
  // ===================================================================
  const F = {
    url() { return E.cfg.workerUrl; },
    esNuestro(u) { return !!(u && F.url() && u.indexOf(F.url() + "/f/") === 0); },
    clave(u) { return decodeURIComponent(u.slice((F.url() + "/f/").length)); },
    async subir(blob, carpeta, nombre) {
      if (T.demo && !F.url()) return await aDataUrl(blob);
      if (!F.url()) throw new Error("Primero pega la dirección del Worker en Ajustes › Fotos.");
      const r = await fetch(F.url() + "/subir?carpeta=" + encodeURIComponent(carpeta) + "&nombre=" + encodeURIComponent(nombre || "foto"), {
        method: "POST",
        headers: { authorization: "Bearer " + (await D.token()), "content-type": blob.type || "application/octet-stream" },
        body: blob,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo subir (" + r.status + ")");
      return j.url;
    },
    async borrar(urls) {
      const claves = (urls || []).filter(F.esNuestro).map(F.clave);
      if (!claves.length) return;
      try {
        await fetch(F.url() + "/borrar", {
          method: "POST",
          headers: { authorization: "Bearer " + (await D.token()), "content-type": "application/json" },
          body: JSON.stringify({ claves }),
        });
      } catch (e) { console.warn("No se pudieron borrar archivos", e); }
    },
    async listar(prefijo) {
      let cursor = null, todos = [];
      do {
        const r = await fetch(F.url() + "/listar?prefijo=" + encodeURIComponent(prefijo || "") + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), { headers: { authorization: "Bearer " + (await D.token()) } });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || r.status);
        todos = todos.concat(j.archivos);
        cursor = j.cursor;
      } while (cursor);
      return todos;
    },
    async probar(url) {
      const r = await fetch(url.replace(/\/+$/, "") + "/");
      const j = await r.json();
      return j;
    },
  };

  function aDataUrl(blob) {
    return new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = mal; fr.readAsDataURL(blob); });
  }

  /** Aligera la foto: máx. 900 px, WebP (o JPEG si el navegador no sabe WebP) */
  async function aligerar(file, max) {
    max = max || 900;
    if (!/^image\/(jpeg|png|webp|heic|heif|bmp|avif)/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "")) return file;
    let fuente;
    try {
      fuente = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      fuente = await new Promise((ok, mal) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => mal(new Error("No se pudo leer la foto " + (file.name || "")));
        img.src = URL.createObjectURL(file);
      });
    }
    const w = fuente.width, h = fuente.height;
    const r = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * r); c.height = Math.round(h * r);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(fuente, 0, 0, c.width, c.height);
    const aBlob = (tipo, q) => new Promise((ok) => c.toBlob(ok, tipo, q));
    let b = await aBlob("image/webp", 0.8);
    if (!b || b.type !== "image/webp") {
      g.globalCompositeOperation = "destination-over"; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      b = await aBlob("image/jpeg", 0.82);
    }
    return b.size < file.size || r < 1 ? b : file;
  }

  // ===================================================================
  // Utilidades de interfaz
  // ===================================================================
  function iconos(raiz) {
    $$("[data-icono]", raiz).forEach((el) => { if (!el.firstChild) el.innerHTML = icono(el.dataset.icono); });
  }
  const num = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/\s/g, "");
    if (!s) return null;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return isNaN(n) ? null : n;
  };
  const ent = (v) => Math.max(0, parseInt(String(v || "0").replace(/\D/g, ""), 10) || 0);
  const fecha = (s) => { try { return new Date(s).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return s; } };

  function campo(etiqueta, nombre, valor, extra) {
    extra = extra || {};
    const tipo = extra.tipo || "text";
    const attrs = (extra.attrs || "") + (extra.placeholder ? ' placeholder="' + esc(extra.placeholder) + '"' : "");
    const clase = extra.doble ? ' class="campo doble"' : ' class="campo"';
    if (tipo === "area") return "<label" + clase + ">" + etiqueta + '<textarea name="' + nombre + '" rows="' + (extra.filas || 3) + '"' + attrs + ">" + esc(valor == null ? "" : valor) + "</textarea>" + (extra.ayuda ? '<span class="ayuda">' + extra.ayuda + "</span>" : "") + "</label>";
    if (tipo === "select") return "<label" + clase + ">" + etiqueta + '<select name="' + nombre + '"' + attrs + ">" + extra.opciones.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(valor == null ? "" : valor) ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>" + (extra.ayuda ? '<span class="ayuda">' + extra.ayuda + "</span>" : "") + "</label>";
    return "<label" + clase + ">" + etiqueta + '<input name="' + nombre + '" type="' + tipo + '" value="' + esc(valor == null ? "" : valor) + '"' + attrs + ">" + (extra.ayuda ? '<span class="ayuda">' + extra.ayuda + "</span>" : "") + "</label>";
  }
  function oculto(nombre, valor) {
    return '<input type="hidden" name="' + nombre + '" value="' + esc(valor == null ? "" : valor) + '">';
  }
  function interruptor(etiqueta, nombre, activo) {
    return '<label class="interruptor"><input type="checkbox" name="' + nombre + '"' + (activo ? " checked" : "") + ">" + etiqueta + "</label>";
  }
  function leerForm(raiz) {
    const o = {};
    $$("input[name], textarea[name], select[name]", raiz).forEach((el) => {
      o[el.name] = el.type === "checkbox" ? el.checked : el.value;
    });
    return o;
  }

  // Modal
  let alCerrarModal = null;
  function abrirModal(titulo, cuerpo, pie, opciones) {
    opciones = opciones || {};
    $("#modal-titulo").textContent = titulo;
    $("#modal-cuerpo").innerHTML = cuerpo;
    $("#modal-pie").innerHTML = pie || "";
    $("#modal").classList.toggle("chico", !!opciones.chico);
    $("#modal-fondo").classList.remove("oculto");
    document.body.classList.add("bloqueado");
    alCerrarModal = opciones.alCerrar || null;
    iconos($("#modal"));
    $("#modal-cuerpo").scrollTop = 0;
  }
  function cerrarModal(forzado) {
    if (alCerrarModal && !forzado) { const f = alCerrarModal; alCerrarModal = null; f(); }
    alCerrarModal = null;
    $("#modal-fondo").classList.add("oculto");
    document.body.classList.remove("bloqueado");
  }
  function confirmar(titulo, texto, botonTexto, peligro) {
    return new Promise((ok) => {
      abrirModal(titulo, "<p style=\"margin:0\">" + texto + "</p>",
        '<button class="boton claro" data-r="no">Cancelar</button><button class="boton ' + (peligro ? "peligro" : "") + '" data-r="si">' + esc(botonTexto || "Aceptar") + "</button>",
        { chico: true, alCerrar: () => ok(false) });
      $("#modal-pie").onclick = (e) => {
        const r = e.target.closest("[data-r]");
        if (!r) return;
        $("#modal-pie").onclick = null;
        cerrarModal(true);
        ok(r.dataset.r === "si");
      };
    });
  }
  function ocupado(boton, texto) {
    if (!boton) return () => {};
    const antes = boton.innerHTML;
    boton.disabled = true;
    boton.textContent = texto || "Guardando…";
    return () => { boton.disabled = false; boton.innerHTML = antes; };
  }
  function errorAmigable(e) {
    const m = (e && (e.message || e.error_description || e.details)) || String(e);
    if (/row-level security|permission denied|42501/i.test(m)) return "Sin permiso: este correo no es el administrador (revisa el archivo 2 del SQL).";
    if (/JWT|expired|401/i.test(m)) return "La sesión venció. Sal y vuelve a entrar.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sin conexión a internet. Intenta de nuevo.";
    return m;
  }
  function falla(e) {
    console.error(e);
    T.tostada("⚠️ " + errorAmigable(e), 5000);
  }

  // ===================================================================
  // Entrada
  // ===================================================================
  let modoRecuperar = false;
  async function iniciar() {
    iconos(document);
    try { await D.iniciar(); } catch (e) { $("#entrada-error").textContent = "No se pudo cargar el sistema. Revisa tu conexión."; return; }
    if (T.demo) {
      $("#entrada-ayuda").innerHTML = "<b>Modo demostración</b>: escribe cualquier correo y contraseña. Los cambios se guardan solo en este navegador.";
    }
    try { E.cfg = await D.config(); T.pintarComun(E.cfg); } catch (e) { /* aún sin tablas */ }

    if (!T.demo) {
      sb.auth.onAuthStateChange((evento) => {
        if (evento === "PASSWORD_RECOVERY") mostrarCambioClave();
      });
      if (/type=recovery/.test(location.hash)) { mostrarCambioClave(); return; }
    }
    const s = await D.sesion();
    if (s) await entrarAlPanel(s.correo);
  }

  function mostrarCambioClave() {
    modoRecuperar = true;
    $("#pantalla-panel").classList.add("oculto");
    $("#pantalla-entrada").classList.remove("oculto");
    $("#entrada-ayuda").textContent = "Escribe tu nueva contraseña.";
    $("#entrada-correo").closest("label").classList.add("oculto");
    $("#entrada-correo").required = false;
    $("#campo-clave").classList.add("oculto");
    $("#entrada-clave").required = false;
    $("#campo-clave-nueva").classList.remove("oculto");
    $("#entrada-clave-nueva").required = true;
    $("#entrada-boton").textContent = "Guardar contraseña";
    $("#olvide").classList.add("oculto");
  }

  $("#form-entrada").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#entrada-error");
    err.textContent = "";
    const listo = ocupado($("#entrada-boton"), "Un momento…");
    try {
      if (modoRecuperar) {
        await D.cambiarClave($("#entrada-clave-nueva").value);
        history.replaceState(null, "", location.pathname);
        location.reload();
        return;
      }
      const correo = $("#entrada-correo").value.trim().toLowerCase();
      await D.entrar(correo, $("#entrada-clave").value);
      await entrarAlPanel(correo);
    } catch (ex) {
      err.textContent = errorAmigable(ex);
    } finally { listo(); }
  });

  $("#olvide").addEventListener("click", async () => {
    const correo = $("#entrada-correo").value.trim();
    if (!correo) { $("#entrada-error").textContent = "Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?»."; return; }
    try {
      await D.recuperar(correo);
      $("#entrada-error").textContent = "";
      $("#entrada-ayuda").textContent = "Te enviamos un correo con un enlace para crear una contraseña nueva. Ábrelo en este mismo dispositivo.";
    } catch (e) { $("#entrada-error").textContent = errorAmigable(e); }
  });

  async function entrarAlPanel(correo) {
    let admin = false;
    try { admin = await D.esAdmin(); } catch (e) {
      $("#entrada-error").textContent = "No se pudo verificar el administrador. ¿Ejecutaste los archivos SQL? (" + errorAmigable(e) + ")";
      return;
    }
    if (!admin) {
      await D.salir();
      $("#entrada-error").textContent = "Este correo no es el administrador de la tienda.";
      return;
    }
    E.correo = correo;
    $("#usuario-correo").textContent = correo;
    $("#pantalla-entrada").classList.add("oculto");
    $("#pantalla-panel").classList.remove("oculto");
    await recargarTodo();
    irA(location.hash.replace("#", "") || "productos");
  }

  $("#salir").addEventListener("click", async () => { await D.salir(); location.reload(); });

  async function recargarTodo() {
    try {
      const [cfg, productos, pedidos, proveedores] = await Promise.all([D.config(), D.productos(), D.pedidos(), D.proveedores()]);
      E.cfg = cfg; E.productos = productos; E.pedidos = pedidos; E.proveedores = proveedores;
      T.pintarComun(E.cfg);
      pintarTasa();
      pintarGlobo();
      avisos();
    } catch (e) { falla(e); }
  }

  function avisos() {
    const a = [];
    if (T.demo) a.push("Modo demostración: nada se guarda en internet. Para conectar la tienda llena <b>js/conexion.js</b>.");
    else if (!E.cfg.workerUrl) a.push('Falta la dirección del Worker de Cloudflare para subir fotos. <button class="enlace" data-ir="ajustes" style="padding:0">Ir a Ajustes</button>');
    if (!E.cfg.whatsapp) a.push('Falta el número de WhatsApp de la tienda. <button class="enlace" data-ir="ajustes" style="padding:0">Ir a Ajustes</button>');
    $("#aviso-panel").innerHTML = a.join("<br>");
    $("#aviso-panel").classList.toggle("oculto", !a.length);
  }

  function pintarTasa() {
    $("#tasa-valor").textContent = E.cfg.tasaBCV ? T.numero(E.cfg.tasaBCV) : "—";
    const falta = !(Number(E.cfg.tasaBCV) > 0);
    $("#aviso-tasa").classList.toggle("oculto", !falta);
    $("#tasa-rapida").classList.toggle("falta", falta);
  }
  $("#aviso-tasa-boton").addEventListener("click", () => $("#tasa-rapida").click());
  function pintarGlobo() {
    const n = E.pedidos.length;
    $("#globo-pedidos").textContent = n;
    $("#globo-pedidos").classList.toggle("oculto", !n);
  }

  $("#tasa-rapida").addEventListener("click", () => {
    abrirModal("Tasa BCV del día", '<form id="form-tasa" class="seccion-form">' + campo("Bolívares por dólar", "tasa", E.cfg.tasaBCV || "", { attrs: ' inputmode="decimal" autofocus', ayuda: "Se usa para mostrar los precios en Bs. Usa coma o punto para los decimales." }) + "</form>",
      '<button class="boton" id="guardar-tasa">Guardar</button>', { chico: true });
    $("#guardar-tasa").onclick = async (e) => {
      const v = num($("#form-tasa [name=tasa]").value);
      if (v == null || v <= 0) { T.tostada("Escribe una tasa válida"); return; }
      const listo = ocupado(e.currentTarget);
      try {
        const cfg = Object.assign({}, await D.config(), { tasaBCV: v, tasaFecha: new Date().toISOString().slice(0, 10) });
        await D.guardarConfig(cfg);
        E.cfg = T.unirAjustes(cfg);
        pintarTasa(); cerrarModal(true); T.tostada("Tasa actualizada: " + T.numero(v));
        if (E.vista === "ajustes") vistaAjustes();
      } catch (ex) { falla(ex); } finally { listo(); }
    };
  });

  // ===================================================================
  // Navegación
  // ===================================================================
  const TITULOS = { productos: "Productos", pedidos: "Pedidos", categorias: "Categorías", pagina: "Página", proveedores: "Proveedores", ajustes: "Ajustes" };
  function irA(vista) {
    if (!TITULOS[vista]) vista = "productos";
    E.vista = vista;
    $("#vista").onchange = null;
    $("#vista").onclick = null;
    $$("#pestanas button").forEach((b) => b.toggleAttribute("aria-current", b.dataset.vista === vista));
    $$("#pestanas button[aria-current]").forEach((b) => b.setAttribute("aria-current", "page"));
    $("#titulo-vista").textContent = TITULOS[vista];
    try { history.replaceState(null, "", "#" + vista); } catch (e) { /* nada */ }
    ({ productos: vistaProductos, pedidos: vistaPedidos, categorias: vistaCategorias, pagina: vistaPagina, proveedores: vistaProveedores, ajustes: vistaAjustes })[vista]();
    window.scrollTo(0, 0);
  }
  $("#pestanas").addEventListener("click", (e) => { const b = e.target.closest("[data-vista]"); if (b) irA(b.dataset.vista); });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-ir]"); if (b) irA(b.dataset.ir); });
  $("#modal-cerrar").addEventListener("click", () => cerrarModal());
  $("#modal-fondo").addEventListener("mousedown", (e) => { if (e.target.id === "modal-fondo") cerrarModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal-fondo").classList.contains("oculto")) cerrarModal(); });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && E.correo) {
      try { E.pedidos = await D.pedidos(); pintarGlobo(); if (E.vista === "pedidos") vistaPedidos(); } catch (e) { /* nada */ }
    }
  });

  function categoriasConfig() {
    return E.cfg.categorias.map((c) => (typeof c === "string" ? { nombre: c, icono: "" } : c)).filter((c) => c && c.nombre);
  }
  function todasCategorias() {
    const n = categoriasConfig().map((c) => c.nombre);
    E.productos.forEach((p) => { if (p.categoria && !n.includes(p.categoria)) n.push(p.categoria); });
    return n;
  }

  // ===================================================================
  // PRODUCTOS
  // ===================================================================
  function vistaProductos() {
    const cats = todasCategorias();
    $("#vista").innerHTML =
      '<div class="barra-vista">' +
      '<label class="buscador"><span class="solo-lector">Buscar</span>' + icono("buscar") + '<input type="search" id="p-buscar" placeholder="Buscar nombre, código, marca…" value="' + esc(E.filtro.texto) + '"></label>' +
      '<select class="selector" id="p-cat"><option value="">Todas las categorías</option>' + cats.map((c) => '<option' + (c === E.filtro.categoria ? " selected" : "") + ">" + esc(c) + "</option>").join("") + "</select>" +
      '<select class="selector" id="p-estado">' + [["", "Todos"], ["agotado", "Agotados"], ["pocas", "Pocas unidades"], ["encargo", "Por encargo"], ["oculto", "Ocultos"]].map(([v, t]) => '<option value="' + v + '"' + (v === E.filtro.estado ? " selected" : "") + ">" + t + "</option>").join("") + "</select>" +
      '<span class="espacio"></span>' +
      '<button class="boton claro pequeno" id="p-excel">' + icono("descargar") + "Excel</button>" +
      '<button class="boton pequeno" id="p-nuevo">' + icono("mas") + "Nuevo producto</button></div>" +
      '<div id="p-lista"></div>';
    pintarListaProductos();
    let t;
    $("#p-buscar").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { E.filtro.texto = e.target.value; pintarListaProductos(); }, 120); });
    $("#p-cat").addEventListener("change", (e) => { E.filtro.categoria = e.target.value; pintarListaProductos(); });
    $("#p-estado").addEventListener("change", (e) => { E.filtro.estado = e.target.value; pintarListaProductos(); });
    $("#p-nuevo").addEventListener("click", () => editarProducto(null));
    $("#p-excel").addEventListener("click", (e) => descargarExcel(e.currentTarget));
  }

  function productosFiltrados() {
    const q = T.normalizar(E.filtro.texto).split(/\s+/).filter(Boolean);
    return E.productos.filter((p) => {
      if (E.filtro.categoria && p.categoria !== E.filtro.categoria) return false;
      if (E.filtro.estado === "oculto" && p.disponible !== false) return false;
      if (E.filtro.estado && E.filtro.estado !== "oculto" && T.estado(p, E.cfg).tipo !== E.filtro.estado) return false;
      if (q.length) {
        const t = T.normalizar([p.nombre, p.codigo, p.marca, p.categoria, T.colores(p).map((c) => c.nombre).join(" ")].join(" "));
        return q.every((w) => t.includes(w));
      }
      return true;
    });
  }

  function pintarListaProductos() {
    const lista = productosFiltrados();
    const el = $("#p-lista");
    if (!E.productos.length) {
      el.innerHTML = '<div class="vacio-admin"><strong>Aún no hay productos</strong>Toca «Nuevo producto» para cargar el primero.</div>';
      return;
    }
    if (!lista.length) { el.innerHTML = '<div class="vacio-admin"><strong>Sin resultados</strong>Prueba con otra búsqueda.</div>'; return; }
    const ordenable = !E.filtro.texto && !E.filtro.estado;
    el.innerHTML = '<div class="tabla"><div class="fila-prod cabeza"><span></span><span></span><span>Producto</span><span>Categoría</span><span>Precio</span><span>Stock</span><span style="text-align:right">Acciones</span></div>' +
      lista.map((p) => {
        const st = T.estado(p, E.cfg);
        const sc = p.stock_color || {};
        const detalleStock = Object.keys(sc).length ? Object.entries(sc).map(([k, v]) => k + ": " + v).join(" · ") : "";
        return '<div class="fila-prod' + (p.disponible === false ? " oculto-tienda" : "") + '" data-id="' + p.id + '">' +
          '<div class="mover">' + (ordenable ? '<button data-mover="-1" aria-label="Subir">' + icono("arriba") + '</button><button data-mover="1" aria-label="Bajar">' + icono("abajo") + "</button>" : "") + "</div>" +
          '<img src="' + esc(T.fotoPrincipal(p)) + '" alt="" loading="lazy">' +
          '<div class="c-info"><div class="nombre">' + esc(p.nombre || "(sin nombre)") + (p.disponible === false ? ' <small style="color:var(--peligro)">· oculto</small>' : "") + '</div><div class="sub">' + esc([p.codigo, p.marca].filter(Boolean).join(" · ")) + "</div></div>" +
          '<div class="c-cat sub">' + esc(p.categoria || "—") + "</div>" +
          '<div class="c-precio"><b>' + T.dinero(T.precio(p, "detal", "divisas")) + "</b>" + (T.tieneMayor(p) ? '<div class="sub">Mayor ' + T.dinero(T.precio(p, "mayor", "divisas")) + "</div>" : T.precioBs(p) ? '<div class="sub">' + T.bs(T.precioBs(p)) + "</div>" : "") + "</div>" +
          '<div class="c-stock"><span class="stock-badge ' + st.tipo + '" title="' + esc(detalleStock) + '"><i></i>' + (p.encargo ? "Encargo" : T.stockDe(p)) + '</span>' + (detalleStock ? '<div class="sub solo-escritorio">' + esc(detalleStock) + "</div>" : "") + "</div>" +
          '<div class="acciones">' +
          '<button class="icono-boton" data-accion="visible" title="' + (p.disponible === false ? "Mostrar en la tienda" : "Ocultar de la tienda") + '">' + icono(p.disponible === false ? "ojo" : "ojo") + "</button>" +
          '<button class="icono-boton" data-accion="duplicar" title="Duplicar">' + icono("copiar") + "</button>" +
          '<button class="icono-boton" data-accion="editar" title="Editar">' + icono("editar") + "</button>" +
          '<button class="icono-boton" data-accion="borrar" title="Borrar">' + icono("basura") + "</button>" +
          "</div></div>";
      }).join("") + "</div>";
    el.onclick = async (e) => {
      const fila = e.target.closest("[data-id]");
      if (!fila) return;
      const p = E.productos.find((x) => String(x.id) === fila.dataset.id);
      const b = e.target.closest("button");
      if (!b) { if (!e.target.closest(".mover")) editarProducto(p); return; }
      if (b.dataset.mover) return moverProducto(p, Number(b.dataset.mover));
      const a = b.dataset.accion;
      if (a === "editar") editarProducto(p);
      if (a === "duplicar") {
        const copia = JSON.parse(JSON.stringify(p));
        delete copia.id;
        copia.nombre = p.nombre + " (copia)";
        copia.fotos = []; // las fotos no se comparten para poder borrarlas sin afectar al original
        editarProducto(copia, true);
      }
      if (a === "visible") {
        try { const g = await D.guardarProducto({ id: p.id, disponible: p.disponible === false }); Object.assign(p, g); pintarListaProductos(); T.tostada(p.disponible === false ? "Oculto de la tienda" : "Visible en la tienda"); } catch (ex) { falla(ex); }
      }
      if (a === "borrar") {
        if (!(await confirmar("Borrar producto", "¿Borrar <b>" + esc(p.nombre) + "</b> y sus fotos? Esto no se puede deshacer.", "Borrar", true))) return;
        try {
          await D.borrarProducto(p.id);
          await F.borrar(T.fotos(p).map((f) => f.url));
          E.productos = E.productos.filter((x) => x !== p);
          pintarListaProductos();
          T.tostada("Producto borrado");
        } catch (ex) { falla(ex); }
      }
    };
  }

  async function moverProducto(p, dir) {
    const lista = productosFiltrados();
    const i = lista.indexOf(p), j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const otro = lista[j];
    // Normalizar si hay órdenes repetidos
    const vistos = new Set();
    const repetidos = E.productos.some((x) => { const r = vistos.has(x.orden); vistos.add(x.orden); return r; });
    try {
      if (repetidos) {
        const cambios = [];
        E.productos.forEach((x, k) => { if (x.orden !== (k + 1) * 10) { x.orden = (k + 1) * 10; cambios.push(x); } });
        for (const x of cambios) await D.guardarProducto({ id: x.id, orden: x.orden });
      }
      const a = p.orden, b = otro.orden;
      p.orden = b; otro.orden = a;
      await D.guardarProducto({ id: p.id, orden: p.orden });
      await D.guardarProducto({ id: otro.id, orden: otro.orden });
      E.productos.sort((x, y) => (x.orden || 0) - (y.orden || 0) || (y.id || 0) - (x.id || 0));
      pintarListaProductos();
    } catch (ex) { falla(ex); }
  }

  // --- Editor de producto ---------------------------------------------
  async function editarProducto(original, esCopia) {
    const nuevo = !original || !original.id;
    const p = JSON.parse(JSON.stringify(original || { nombre: "", disponible: true, colores: [], fotos: [], stock: 0, stock_color: {}, colecciones: [], orden: 0 }));
    if (nuevo && !esCopia) p.orden = (E.productos.reduce((m, x) => Math.min(m, x.orden || 0), 0) || 0) - 10;
    let priv = { proveedor_id: null, costo: null, notas: "" };
    if (!nuevo) { try { priv = Object.assign(priv, await D.privado(p.id)); } catch (e) { /* nada */ } }
    else if (esCopia && original._priv) priv = original._priv;
    const ed = {
      colores: T.colores(p).map((c) => ({ nombre: c.nombre, hex: c.hex || "#999999", stock: (p.stock_color || {})[c.nombre] != null ? p.stock_color[c.nombre] : "" })),
      fotos: T.fotos(p).map((f) => ({ url: f.url, color: f.color || "", tipo: f.tipo || (T.esVideo(f) ? "video" : "foto"), ambiente: !!f.ambiente })),
      subidas: [], quitadas: [], subiendo: 0, guardado: false,
    };
    const cats = todasCategorias();
    const cols = (E.cfg.colecciones || []).map((c) => c.nombre).filter(Boolean);

    const cuerpo =
      '<form id="f-prod" autocomplete="off">' +
      '<div class="seccion-form"><h3>Datos</h3><div class="rejilla-campos">' +
      campo("Nombre *", "nombre", p.nombre, { doble: true, attrs: " required" }) +
      campo("Código", "codigo", p.codigo) + campo("Marca", "marca", p.marca) +
      '<label class="campo">Categoría<input name="categoria" list="lista-cats" value="' + esc(p.categoria || "") + '" placeholder="Elige o escribe una nueva"><datalist id="lista-cats">' + cats.map((c) => "<option>" + esc(c) + "</option>").join("") + "</datalist></label>" +
      campo("Material", "material", p.material) +
      campo("Alto", "alto", p.alto, { placeholder: "Ej.: 75 cm" }) + campo("Ancho", "ancho", p.ancho, { placeholder: "Ej.: 120 cm" }) + campo("Fondo", "fondo", p.fondo, { placeholder: "Ej.: 60 cm" }) +
      campo("Descripción", "descripcion", p.descripcion, { tipo: "area", doble: true, filas: 4 }) +
      "</div>" +
      (cols.length ? '<div><div class="etiqueta-campo">Colecciones</div><div class="interruptores">' + cols.map((c) => interruptor(esc(c), "col::" + c, (p.colecciones || []).includes(c))).join("") + "</div></div>" : "") +
      "</div>" +
      (E.cfg.ventaMayor
        ? '<div class="seccion-form"><h3>Precios (en dólares)</h3><p class="ayuda">«En divisas» = pagando en dólares/Zelle. «A tasa BCV» = pagando en bolívares. Deja vacío lo que no uses.</p><div class="rejilla-campos">' +
          campo("Detal · en divisas", "divisa_detal", p.divisa_detal, { attrs: ' inputmode="decimal"' }) +
          (E.cfg.precioBsAutomatico ? oculto("bcv_detal", p.bcv_detal) : campo("Detal · a tasa BCV", "bcv_detal", p.bcv_detal, { attrs: ' inputmode="decimal"' })) +
          campo("Mayor · en divisas", "divisa_mayor", p.divisa_mayor, { attrs: ' inputmode="decimal"' }) +
          (E.cfg.precioBsAutomatico ? oculto("bcv_mayor", p.bcv_mayor) : campo("Mayor · a tasa BCV", "bcv_mayor", p.bcv_mayor, { attrs: ' inputmode="decimal"' }))
        : '<div class="seccion-form"><h3>Precio</h3><p class="ayuda">Escribe el precio <b>en divisas</b>. ' + (E.cfg.precioBsAutomatico ? "El precio en bolívares se calcula solo con la brecha (" + E.cfg.brecha + " %) y la tasa BCV de Ajustes." : "Escribe también el precio a tasa BCV.") + '</p><div class="rejilla-campos">' +
          campo("Precio en divisas ($) *", "divisa_detal", p.divisa_detal, { attrs: ' inputmode="decimal" id="ed-precio"' }) +
          (E.cfg.precioBsAutomatico ? oculto("bcv_detal", p.bcv_detal) : campo("Precio a tasa BCV ($)", "bcv_detal", p.bcv_detal, { attrs: ' inputmode="decimal"' })) +
          oculto("divisa_mayor", p.divisa_mayor) + oculto("bcv_mayor", p.bcv_mayor)) +
      campo("Precio anterior (oferta)", "precio_antes", p.precio_antes, { attrs: ' inputmode="decimal"', ayuda: "Si es mayor al precio, se muestra tachado con el % de descuento." }) +
      '</div><p class="vista-bs" id="ed-vista-bs"></p></div>' +
      '<div class="seccion-form"><h3>Estado</h3><div class="interruptores">' +
      interruptor("Visible en la tienda", "disponible", p.disponible !== false) +
      interruptor("Por encargo", "encargo", !!p.encargo) +
      interruptor("Destacado", "destacado", !!p.destacado) +
      interruptor("Nuevo", "nuevo", !!p.nuevo) +
      "</div></div>" +
      '<div class="seccion-form"><h3>Colores y stock <button type="button" class="boton claro pequeno" id="ed-agregar-color">' + icono("mas") + "Color</button></h3>" +
      '<p class="ayuda">Si el producto tiene colores, escribe el stock de cada uno y el total se calcula solo.</p>' +
      '<div id="ed-colores" class="lista-orden"></div>' +
      '<div class="rejilla-campos">' + campo("Stock total", "stock", p.stock || 0, { attrs: ' inputmode="numeric" id="ed-stock"' }) + "</div></div>" +
      '<div class="seccion-form"><h3>Fotos y videos <small class="ayuda">Se aligeran solas (máx. 900 px)</small></h3>' +
      '<p class="ayuda">Fotos recortadas con fondo blanco o transparente: lucen flotando con sombra. Fotos <b>de ambiente</b> (el mueble en una sala, cocina…): marca «Ambiente» para que llenen la tarjeta. Si el producto es <b>Destacado</b> y su primera foto es de ambiente, sale en el carrusel grande de la portada.</p>' +
      '<div class="fotos-editor" id="ed-fotos"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="boton claro pequeno" id="ed-enlace">' + icono("mas") + "Agregar por enlace</button></div>" +
      '<input type="file" id="ed-archivo" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden></div>' +
      '<div class="seccion-form"><h3>Datos internos <small class="ayuda">Solo los ves tú</small></h3><div class="rejilla-campos">' +
      campo("Proveedor", "proveedor_id", priv.proveedor_id || "", { tipo: "select", opciones: [["", "— Sin proveedor —"]].concat(E.proveedores.map((x) => [x.id, x.nombre])) }) +
      campo("Costo (USD)", "costo", priv.costo, { attrs: ' inputmode="decimal"' }) +
      campo("Notas internas", "notas_internas", priv.notas, { tipo: "area", doble: true, filas: 2 }) +
      campo("Posición en el catálogo", "orden", p.orden || 0, { attrs: ' inputmode="numeric"', ayuda: "Número menor = aparece primero." }) +
      "</div></div></form>";

    abrirModal(nuevo ? "Nuevo producto" : "Editar producto", cuerpo,
      '<button class="boton claro" id="ed-cancelar">Cancelar</button><button class="boton" id="ed-guardar">' + icono("check") + "Guardar</button>",
      { alCerrar: () => descartar() });

    const form = $("#f-prod");
    const vistaBs = () => {
      const el = $("#ed-vista-bs");
      if (!el) return;
      const d = num(form.divisa_detal.value);
      if (d == null) { el.textContent = ""; return; }
      const prov = { divisa_detal: d, bcv_detal: num(form.bcv_detal ? form.bcv_detal.value : null) };
      const bcv = T.precio(prov, "detal", "bcv");
      el.innerHTML = "En la tienda: <b>" + T.dinero(d) + "</b> en divisas · " + (E.cfg.tasaBCV ? "<b>" + T.bs(bcv * E.cfg.tasaBCV) + "</b> en bolívares" : "<b>" + T.dinero(bcv) + "</b> a tasa BCV (falta la tasa en Ajustes)");
    };
    form.addEventListener("input", (e) => { if (e.target.name === "divisa_detal" || e.target.name === "bcv_detal") vistaBs(); });
    vistaBs();
    pintarColores();
    pintarFotos();

    async function descartar() {
      if (!ed.guardado && ed.subidas.length) await F.borrar(ed.subidas);
    }
    $("#ed-cancelar").onclick = () => cerrarModal();

    function pintarColores() {
      $("#ed-colores").innerHTML = ed.colores.map((c, i) =>
        '<div class="fila-color" data-i="' + i + '"><input type="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#999999") + '" data-c="hex" aria-label="Tono">' +
        '<input class="campo-in" data-c="nombre" value="' + esc(c.nombre) + '" placeholder="Nombre del color" style="border:1px solid var(--linea);border-radius:12px;padding:0 12px">' +
        '<input data-c="stock" value="' + esc(c.stock) + '" inputmode="numeric" placeholder="Stock" style="border:1px solid var(--linea);border-radius:12px;padding:0 12px">' +
        '<button type="button" class="icono-boton" data-quitar-color="' + i + '" aria-label="Quitar color">' + icono("basura") + "</button></div>"
      ).join("") || '<p class="ayuda">Sin colores. Usa «+ Color» si el producto viene en varios colores.</p>';
      actualizarTotal();
      pintarFotos();
    }
    function actualizarTotal() {
      const conStock = ed.colores.filter((c) => String(c.stock).trim() !== "");
      const st = $("#ed-stock");
      if (conStock.length) { st.value = conStock.reduce((a, c) => a + ent(c.stock), 0); st.readOnly = true; st.style.background = "var(--fondo)"; }
      else { st.readOnly = false; st.style.background = ""; }
    }
    $("#ed-colores").addEventListener("input", (e) => {
      const fila = e.target.closest("[data-i]");
      if (!fila) return;
      const c = ed.colores[Number(fila.dataset.i)];
      const viejo = c.nombre;
      c[e.target.dataset.c] = e.target.value;
      if (e.target.dataset.c === "nombre") ed.fotos.forEach((f) => { if (f.color === viejo) f.color = c.nombre; });
      if (e.target.dataset.c === "stock") actualizarTotal();
    });
    $("#ed-colores").addEventListener("change", (e) => { if (e.target.dataset.c === "nombre") pintarFotos(); });
    $("#ed-colores").addEventListener("click", (e) => {
      const b = e.target.closest("[data-quitar-color]");
      if (!b) return;
      const c = ed.colores.splice(Number(b.dataset.quitarColor), 1)[0];
      ed.fotos.forEach((f) => { if (f.color === c.nombre) f.color = ""; });
      pintarColores();
    });
    $("#ed-agregar-color").onclick = () => { ed.colores.push({ nombre: "", hex: "#999999", stock: "" }); pintarColores(); const ins = $$("#ed-colores [data-c=nombre]"); if (ins.length) ins[ins.length - 1].focus(); };

    function pintarFotos() {
      const opciones = ['<option value="">Todos los colores</option>'].concat(ed.colores.filter((c) => c.nombre).map((c) => '<option value="' + esc(c.nombre) + '">' + esc(c.nombre) + "</option>")).join("");
      $("#ed-fotos").innerHTML = ed.fotos.map((f, i) =>
        '<div class="foto-editor" data-i="' + i + '">' + (i === 0 ? '<span class="principal">Principal</span>' : "") +
        (f.tipo === "video" ? '<video src="' + esc(f.url) + '" muted playsinline preload="metadata"></video>' : '<img src="' + esc(f.url) + '" alt="">') +
        '<select data-color-foto aria-label="Color de esta foto">' + opciones.replace('value="' + esc(f.color) + '"', 'value="' + esc(f.color) + '" selected') + "</select>" +
        (f.tipo === "video" ? "" : '<label class="ambiente-foto" title="Foto con fondo (una sala, una cocina…): llena toda la tarjeta y puede salir en el carrusel de portada"><input type="checkbox" data-ambiente' + (f.ambiente ? " checked" : "") + "> Ambiente</label>") +
        '<div class="botones-foto"><button type="button" data-f="-1" aria-label="Mover a la izquierda">' + icono("izquierda") + '</button><button type="button" data-f="x" aria-label="Quitar">' + icono("basura") + '</button><button type="button" data-f="1" aria-label="Mover a la derecha">' + icono("derecha") + "</button></div></div>"
      ).join("") +
        '<label class="zona-subir" id="ed-zona">' + icono("subir") + "<span>" + (ed.subiendo ? "Subiendo… (" + ed.subiendo + ")" : "Toca para subir fotos o videos<br><small>o arrástralos aquí</small>") + "</span></label>";
      $("#ed-zona").onclick = () => $("#ed-archivo").click();
      const zona = $("#ed-zona");
      zona.ondragover = (e) => { e.preventDefault(); zona.classList.add("encima"); };
      zona.ondragleave = () => zona.classList.remove("encima");
      zona.ondrop = (e) => { e.preventDefault(); zona.classList.remove("encima"); subirArchivos(Array.from(e.dataTransfer.files)); };
    }
    $("#ed-fotos").addEventListener("change", (e) => {
      if (e.target.matches("[data-color-foto]")) ed.fotos[Number(e.target.closest("[data-i]").dataset.i)].color = e.target.value;
      if (e.target.matches("[data-ambiente]")) ed.fotos[Number(e.target.closest("[data-i]").dataset.i)].ambiente = e.target.checked;
    });
    $("#ed-fotos").addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]");
      if (!b) return;
      const i = Number(b.closest("[data-i]").dataset.i);
      if (b.dataset.f === "x") {
        const f = ed.fotos.splice(i, 1)[0];
        if (ed.subidas.includes(f.url)) { F.borrar([f.url]); ed.subidas = ed.subidas.filter((u) => u !== f.url); }
        else ed.quitadas.push(f.url);
      } else {
        const j = i + Number(b.dataset.f);
        if (j < 0 || j >= ed.fotos.length) return;
        const t = ed.fotos[i]; ed.fotos[i] = ed.fotos[j]; ed.fotos[j] = t;
      }
      pintarFotos();
    });
    $("#ed-archivo").onchange = (e) => { subirArchivos(Array.from(e.target.files)); e.target.value = ""; };
    $("#ed-enlace").onclick = () => {
      const u = prompt("Pega el enlace de la foto o video (https://…)");
      if (!u || !/^https?:\/\//i.test(u.trim())) return;
      ed.fotos.push({ url: u.trim(), color: "", tipo: /\.(mp4|webm|mov)(\?|$)/i.test(u) ? "video" : "foto" });
      pintarFotos();
    };

    async function subirArchivos(archivos) {
      archivos = archivos.filter((f) => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|heic|mp4|mov|webm)$/i.test(f.name));
      if (!archivos.length) return;
      const nombreBase = T.slug(form.nombre.value || "producto").slice(0, 30) || "producto";
      ed.subiendo += archivos.length; pintarFotos();
      for (const archivo of archivos) {
        try {
          const esVideo = /^video\//.test(archivo.type) || /\.(mp4|mov|webm)$/i.test(archivo.name);
          if (esVideo && archivo.size > 40 * 1024 * 1024) { T.tostada("El video " + archivo.name + " pesa más de 40 MB. Recórtalo o compártelo por enlace.", 5000); continue; }
          const blob = esVideo ? archivo : await aligerar(archivo, 900);
          const url = await F.subir(blob, esVideo ? "videos" : "productos", nombreBase);
          ed.subidas.push(url);
          ed.fotos.push({ url, color: "", tipo: esVideo ? "video" : "foto" });
        } catch (ex) { falla(ex); }
        finally { ed.subiendo--; pintarFotos(); }
      }
    }

    $("#ed-guardar").onclick = async (e) => {
      if (ed.subiendo) { T.tostada("Espera a que terminen de subir las fotos"); return; }
      const v = leerForm(form);
      if (!v.nombre.trim()) { form.nombre.focus(); T.tostada("Escribe el nombre del producto"); return; }
      const colores = ed.colores.filter((c) => c.nombre.trim());
      const nombres = colores.map((c) => c.nombre.trim().toLowerCase());
      if (new Set(nombres).size !== nombres.length) { T.tostada("Hay dos colores con el mismo nombre"); return; }
      const stock_color = {};
      colores.forEach((c) => { if (String(c.stock).trim() !== "") stock_color[c.nombre.trim()] = ent(c.stock); });
      const fila = {
        id: nuevo ? undefined : p.id,
        nombre: v.nombre.trim(), codigo: v.codigo.trim() || null, marca: v.marca.trim() || null, categoria: v.categoria.trim() || null,
        material: v.material.trim() || null, alto: v.alto.trim() || null, ancho: v.ancho.trim() || null, fondo: v.fondo.trim() || null,
        descripcion: v.descripcion.trim() || null,
        divisa_detal: num(v.divisa_detal), bcv_detal: num(v.bcv_detal), divisa_mayor: num(v.divisa_mayor), bcv_mayor: num(v.bcv_mayor), precio_antes: num(v.precio_antes),
        disponible: v.disponible, encargo: v.encargo, destacado: v.destacado, nuevo: v.nuevo,
        colores: colores.map((c) => ({ nombre: c.nombre.trim(), hex: c.hex })),
        stock_color, stock: ent(v.stock),
        fotos: ed.fotos.map((f) => Object.assign({ url: f.url, color: f.color || "", tipo: f.tipo || "foto" }, f.ambiente ? { ambiente: true } : {})),
        colecciones: cols.filter((c) => v["col::" + c]),
        orden: parseInt(v.orden, 10) || 0,
      };
      if (fila.divisa_detal == null && (E.cfg.precioBsAutomatico || fila.bcv_detal == null)) { T.tostada("Escribe el precio en divisas"); form.divisa_detal.focus(); return; }
      const listo = ocupado(e.currentTarget);
      try {
        const g = await D.guardarProducto(fila);
        const costo = num(v.costo);
        if (v.proveedor_id || costo != null || v.notas_internas.trim() || !nuevo) {
          await D.guardarPrivado({ producto_id: g.id, proveedor_id: v.proveedor_id ? Number(v.proveedor_id) : null, costo, notas: v.notas_internas.trim() || null });
        }
        ed.guardado = true;
        if (ed.quitadas.length) F.borrar(ed.quitadas);
        const i = E.productos.findIndex((x) => x.id === g.id);
        if (i >= 0) E.productos[i] = g; else E.productos.unshift(g);
        E.productos.sort((x, y) => (x.orden || 0) - (y.orden || 0) || (y.id || 0) - (x.id || 0));
        cerrarModal(true);
        if (E.vista === "productos") pintarListaProductos();
        T.tostada(nuevo ? "Producto creado" : "Cambios guardados");
      } catch (ex) { falla(ex); } finally { listo(); }
    };
  }

  // --- Excel con fotos --------------------------------------------------
  async function descargarExcel(boton) {
    const listo = ocupado(boton, "Preparando…");
    try {
      await T.cargarScript(EXCELJS);
      const privados = await D.privados().catch(() => []);
      const provPorId = new Map(E.proveedores.map((x) => [x.id, x.nombre]));
      const privPorId = new Map(privados.map((x) => [x.producto_id, x]));
      const wb = new window.ExcelJS.Workbook();
      wb.creator = E.cfg.nombreTienda;
      const ws = wb.addWorksheet("Inventario", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Foto", key: "foto", width: 13 },
        { header: "Código", key: "codigo", width: 12 },
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Marca", key: "marca", width: 14 },
        { header: "Categoría", key: "categoria", width: 18 },
        { header: "Colores", key: "colores", width: 22 },
        { header: "Stock total", key: "stock", width: 11 },
        { header: "Stock por color", key: "stock_color", width: 28 },
        { header: "Detal divisas $", key: "divisa_detal", width: 13 },
        { header: "Detal BCV $", key: "bcv_detal", width: 12 },
        { header: "Mayor divisas $", key: "divisa_mayor", width: 13 },
        { header: "Mayor BCV $", key: "bcv_mayor", width: 12 },
        { header: "Detal BCV Bs", key: "bs", width: 14 },
        { header: "Visible", key: "visible", width: 9 },
        { header: "Encargo", key: "encargo", width: 9 },
        { header: "Proveedor", key: "proveedor", width: 20 },
        { header: "Costo $", key: "costo", width: 10 },
        { header: "Valor inventario (costo) $", key: "valor", width: 16 },
      ];
      const cab = ws.getRow(1);
      cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF151515" } };
      cab.alignment = { vertical: "middle", wrapText: true };
      cab.height = 30;
      const lista = productosFiltrados();
      for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        const pr = privPorId.get(p.id) || {};
        const sc = p.stock_color || {};
        const bcv = T.precio(p, "detal", "bcv");
        const fila = ws.addRow({
          codigo: p.codigo || "", nombre: p.nombre, marca: p.marca || "", categoria: p.categoria || "",
          colores: T.colores(p).map((c) => c.nombre).join(", "),
          stock: T.stockDe(p), stock_color: Object.entries(sc).map(([k, v]) => k + ": " + v).join(", "),
          divisa_detal: num(p.divisa_detal), bcv_detal: num(p.bcv_detal), divisa_mayor: num(p.divisa_mayor), bcv_mayor: num(p.bcv_mayor),
          bs: E.cfg.tasaBCV && T.tieneBcv(p) ? Math.round(bcv * E.cfg.tasaBCV * 100) / 100 : null,
          visible: p.disponible === false ? "No" : "Sí", encargo: p.encargo ? "Sí" : "No",
          proveedor: provPorId.get(pr.proveedor_id) || "", costo: num(pr.costo),
          valor: num(pr.costo) != null ? Math.round(num(pr.costo) * T.stockDe(p) * 100) / 100 : null,
        });
        fila.height = 66;
        fila.alignment = { vertical: "middle", wrapText: true };
        ["divisa_detal", "bcv_detal", "divisa_mayor", "bcv_mayor", "costo", "valor"].forEach((k) => (fila.getCell(k).numFmt = '"$"#,##0.00'));
        fila.getCell("bs").numFmt = '"Bs "#,##0.00';
        const f = T.fotoPrincipal(p);
        if (f && !/sin-foto/.test(f)) {
          const b64 = await miniaturaJpeg(f, 160).catch(() => null);
          if (b64) {
            const id = wb.addImage({ base64: b64, extension: "jpeg" });
            ws.addImage(id, { tl: { col: 0.1, row: i + 1.05 }, ext: { width: 80, height: 80 }, editAs: "oneCell" });
          }
        }
        boton.textContent = "Preparando… " + (i + 1) + "/" + lista.length;
      }
      const tot = ws.addRow({ nombre: "TOTAL", stock: lista.reduce((a, p) => a + T.stockDe(p), 0) });
      tot.font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "inventario-" + T.slug(E.cfg.nombreTienda) + "-" + new Date().toISOString().slice(0, 10) + ".xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      T.tostada("Excel descargado (" + lista.length + " productos)");
    } catch (e) { falla(e); } finally { listo(); }
  }

  function miniaturaJpeg(url, lado) {
    return new Promise((ok, mal) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const t = setTimeout(() => mal(new Error("tiempo")), 8000);
      img.onload = () => {
        clearTimeout(t);
        try {
          const c = document.createElement("canvas");
          c.width = c.height = lado;
          const g = c.getContext("2d");
          g.fillStyle = "#fff"; g.fillRect(0, 0, lado, lado);
          const w = img.naturalWidth || lado, h = img.naturalHeight || lado;
          const r = Math.min(lado / w, lado / h);
          g.drawImage(img, (lado - w * r) / 2, (lado - h * r) / 2, w * r, h * r);
          ok(c.toDataURL("image/jpeg", 0.8));
        } catch (e) { mal(e); }
      };
      img.onerror = () => { clearTimeout(t); mal(new Error("no carga")); };
      img.src = url;
    });
  }

  // ===================================================================
  // PEDIDOS
  // ===================================================================
  function vistaPedidos() {
    $("#vista").innerHTML = '<div class="barra-vista"><p class="ayuda" style="max-width:640px">Los pedidos llegan aquí como <b>pendientes</b>. Al <b>aceptar</b> se descuenta el stock y el pedido se borra. Al <b>rechazar</b> se borra. Los que no atiendas se borran solos a los ' + (E.cfg.diasPedidos || 30) + ' días.</p><span class="espacio"></span><button class="boton claro pequeno" id="pd-recargar">Actualizar</button></div>' +
      '<div class="barra-lote oculto" id="pd-lote"><label class="lote-todos"><input type="checkbox" id="pd-todos"> <span>Seleccionar todos</span></label><span class="lote-n" id="pd-n"></span><span class="espacio"></span>' +
      '<button class="boton verde pequeno" id="pd-aceptar-sel" disabled>' + icono("check") + 'Aceptar</button><button class="boton claro pequeno" id="pd-rechazar-sel" disabled style="color:var(--peligro)">' + icono("basura") + 'Rechazar</button></div>' +
      '<div class="tarjetas-admin" id="pd-lista"></div>';
    E.selPedidos = new Set();
    $("#pd-recargar").onclick = async (e) => {
      const listo = ocupado(e.currentTarget, "Actualizando…");
      try { [E.pedidos, E.productos] = await Promise.all([D.pedidos(), D.productos()]); pintarGlobo(); pintarPedidos(); } catch (ex) { falla(ex); } finally { listo(); }
    };
    pintarPedidos();
    Promise.all([D.pedidos(), D.productos()]).then(([pd, pr]) => {
      E.pedidos = pd; E.productos = pr; pintarGlobo();
      if (E.vista === "pedidos") pintarPedidos();
    }).catch(falla);
  }

  function pintarPedidos() {
    const el = $("#pd-lista");
    E.selPedidos = new Set([...(E.selPedidos || [])].filter((id) => E.pedidos.some((x) => x.id === id)));
    pintarLote();
    if (!E.pedidos.length) { el.innerHTML = '<div class="vacio-admin"><strong>No hay pedidos pendientes</strong>Cuando un cliente envíe un pedido por WhatsApp aparecerá aquí.</div>'; return; }
    el.innerHTML = E.pedidos.map((p) => {
      const c = p.cliente || {};
      const items = (p.items || []).map((i) => {
        const prod = E.productos.find((x) => String(x.id) === String(i.id));
        const hay = prod ? (prod.encargo ? Infinity : T.stockDe(prod, i.color)) : 0;
        const falta = !prod ? "Producto ya no existe" : hay < i.cantidad ? "Stock actual: " + hay : "";
        return "<div><span>" + i.cantidad + " × " + esc(i.nombre) + (i.color ? " (" + esc(i.color) + ")" : "") + (i.codigo ? ' <small class="ayuda">' + esc(i.codigo) + "</small>" : "") + (falta ? '<br><span class="falta">' + esc(falta) + "</span>" : "") + "</span><b>" + T.dinero(i.subtotal != null ? i.subtotal : i.precio * i.cantidad) + "</b></div>";
      }).join("");
      const waCliente = c.telefono ? T.enlaceWa(c.telefono, "Hola " + (c.nombre || "") + ", te escribimos de " + E.cfg.nombreTienda + " por tu pedido " + (p.codigo || "") + ".") : "";
      return '<article class="pedido" data-id="' + esc(p.id) + '">' +
        '<div class="pedido-cabeza"><label class="pedido-sel" title="Seleccionar"><input type="checkbox" data-sel="' + esc(p.id) + '"' + (E.selPedidos.has(p.id) ? " checked" : "") + ' aria-label="Seleccionar pedido ' + esc(p.codigo || "") + '"></label><strong>' + esc(p.codigo || "Pedido") + "</strong><span>" + fecha(p.creado) + (E.cfg.ventaMayor ? " · " + (p.tipo_precio === "mayor" ? "al mayor" : "al detal") : "") + " · " + esc(p.forma_pago === "bcv" ? "Bolívares" : p.forma_pago === "divisas" ? "Divisas" : p.forma_pago || "") + "</span></div>" +
        '<div class="pedido-cliente"><b>' + esc(c.nombre || "") + "</b>" + (c.cedula ? " · " + esc(c.cedula) : "") + " · " + esc(c.telefono || "") + (c.ciudad ? "<br>" + esc(c.ciudad) : "") + (c.entrega ? " · " + esc(c.entrega) : "") + (p.nota ? "<br><i>Nota: " + esc(p.nota) + "</i>" : "") + "</div>" +
        '<div class="pedido-items">' + items + "</div>" +
        '<div class="pedido-total"><span>Total</span><span>' + T.dinero(p.total) + (p.total_bs ? ' <small class="ayuda">· ' + T.bs(p.total_bs) + "</small>" : "") + "</span></div>" +
        '<div class="pedido-acciones">' +
        '<button class="boton verde" data-pd="aceptar">' + icono("check") + "Aceptar</button>" +
        '<button class="boton claro" data-pd="editar">' + icono("editar") + "Editar</button>" +
        (waCliente ? '<a class="boton claro" href="' + esc(waCliente) + '" target="_blank" rel="noopener">' + icono("whatsapp") + "Cliente</a>" : "") +
        (p.pdf_url ? '<a class="boton claro" href="' + esc(p.pdf_url) + '" target="_blank" rel="noopener">' + icono("pagina") + "PDF</a>" : "") +
        '<button class="boton claro" data-pd="rechazar" style="color:var(--peligro)">' + icono("basura") + "Rechazar</button>" +
        "</div></article>";
    }).join("");
    el.onchange = (e) => {
      const c = e.target.closest("[data-sel]"); if (!c) return;
      if (c.checked) E.selPedidos.add(c.dataset.sel); else E.selPedidos.delete(c.dataset.sel);
      c.closest(".pedido").classList.toggle("elegido", c.checked);
      pintarLote();
    };
    $$(".pedido", el).forEach((a) => a.classList.toggle("elegido", E.selPedidos.has(a.dataset.id)));
    el.onclick = async (e) => {
      const b = e.target.closest("[data-pd]");
      if (!b) return;
      const p = E.pedidos.find((x) => x.id === b.closest("[data-id]").dataset.id);
      if (b.dataset.pd === "editar") return editarPedido(p);
      if (b.dataset.pd === "rechazar") {
        if (!(await confirmar("Rechazar pedido", "Se borrará el pedido <b>" + esc(p.codigo) + "</b> y su PDF. El stock no cambia.", "Rechazar", true))) return;
        try { await D.borrarPedido(p.id); F.borrar([p.pdf_url]); E.pedidos = E.pedidos.filter((x) => x !== p); pintarGlobo(); pintarPedidos(); T.tostada("Pedido rechazado"); } catch (ex) { falla(ex); }
      }
      if (b.dataset.pd === "aceptar") {
        const faltas = (p.items || []).filter((i) => { const prod = E.productos.find((x) => String(x.id) === String(i.id)); return prod && !prod.encargo && T.stockDe(prod, i.color) < i.cantidad; });
        const texto = "Se descontará del stock:<br>" + (p.items || []).map((i) => "• " + i.cantidad + " × " + esc(i.nombre) + (i.color ? " (" + esc(i.color) + ")" : "")).join("<br>") +
          (faltas.length ? '<br><br><b style="color:var(--peligro)">Ojo: algunos productos no tienen stock suficiente; quedarán en 0.</b>' : "") + "<br><br>Luego el pedido se borra de la lista.";
        if (!(await confirmar("Aceptar pedido " + (p.codigo || ""), texto, "Aceptar y descontar"))) return;
        try {
          const items = (p.items || []).map((i) => ({ id: i.id, color: i.color || "", cantidad: i.cantidad }));
          await D.aceptarPedido(p.id, items);
          F.borrar([p.pdf_url]);
          E.pedidos = E.pedidos.filter((x) => x !== p);
          E.productos = await D.productos();
          pintarGlobo(); pintarPedidos();
          T.tostada("Pedido aceptado. Stock actualizado.");
        } catch (ex) { falla(ex); }
      }
    };
  }

  function pintarLote() {
    const barra = $("#pd-lote"); if (!barra) return;
    const n = E.selPedidos.size, total = E.pedidos.length;
    barra.classList.toggle("oculto", total < 2);
    $("#pd-n").textContent = n ? n + (n === 1 ? " seleccionado" : " seleccionados") : "";
    $("#pd-todos").checked = n > 0 && n === total;
    $("#pd-todos").indeterminate = n > 0 && n < total;
    $("#pd-aceptar-sel").disabled = $("#pd-rechazar-sel").disabled = !n;
    $("#pd-aceptar-sel").innerHTML = icono("check") + "Aceptar" + (n ? " (" + n + ")" : "");
    $("#pd-rechazar-sel").innerHTML = icono("basura") + "Rechazar" + (n ? " (" + n + ")" : "");
    $("#pd-todos").onchange = (e) => { E.selPedidos = new Set(e.target.checked ? E.pedidos.map((x) => x.id) : []); pintarPedidos(); };
    $("#pd-rechazar-sel").onclick = async () => {
      const sel = E.pedidos.filter((x) => E.selPedidos.has(x.id));
      if (!sel.length) return;
      if (!(await confirmar("Rechazar " + sel.length + " pedidos", "Se borrarán estos pedidos y sus PDF. El stock no cambia:<br>" + sel.map((x) => "• " + esc(x.codigo || "Pedido") + " · " + esc((x.cliente || {}).nombre || "")).join("<br>"), "Rechazar " + sel.length, true))) return;
      await enLote(sel, async (x) => { await D.borrarPedido(x.id); F.borrar([x.pdf_url]); }, "rechazados");
    };
    $("#pd-aceptar-sel").onclick = async () => {
      const sel = E.pedidos.filter((x) => E.selPedidos.has(x.id));
      if (!sel.length) return;
      // suma de lo que se descuenta, para avisar si falta stock
      const suma = {};
      sel.forEach((x) => (x.items || []).forEach((i) => { const k = i.id + "|" + (i.color || ""); suma[k] = (suma[k] || 0) + i.cantidad; }));
      const faltan = Object.keys(suma).filter((k) => { const [id, color] = k.split("|"); const prod = E.productos.find((x) => String(x.id) === id); return prod && !prod.encargo && T.stockDe(prod, color) < suma[k]; });
      const texto = "Se aceptarán y se descontará el stock de:<br>" + sel.map((x) => "• " + esc(x.codigo || "Pedido") + " · " + esc((x.cliente || {}).nombre || "") + " · " + T.dinero(x.total)).join("<br>") +
        (faltan.length ? '<br><br><b style="color:var(--peligro)">Ojo: ' + faltan.length + " producto(s) no alcanzan para todos; quedarán en 0.</b>" : "") + "<br><br>Luego se borran de la lista.";
      if (!(await confirmar("Aceptar " + sel.length + " pedidos", texto, "Aceptar " + sel.length))) return;
      await enLote(sel, async (x) => { await D.aceptarPedido(x.id, (x.items || []).map((i) => ({ id: i.id, color: i.color || "", cantidad: i.cantidad }))); F.borrar([x.pdf_url]); }, "aceptados");
      try { E.productos = await D.productos(); } catch (ex) { /* nada */ }
      pintarPedidos();
    };
  }
  async function enLote(lista, accion, palabra) {
    const btns = [$("#pd-aceptar-sel"), $("#pd-rechazar-sel")]; btns.forEach((b) => (b.disabled = true));
    let ok = 0, mal = 0;
    for (const x of lista) {
      $("#pd-n").textContent = "Procesando " + (ok + mal + 1) + " de " + lista.length + "…";
      try { await accion(x); ok++; E.pedidos = E.pedidos.filter((y) => y !== x); E.selPedidos.delete(x.id); } catch (ex) { mal++; console.error(ex); }
    }
    pintarGlobo(); pintarPedidos();
    T.tostada(ok + " pedido(s) " + palabra + (mal ? " · " + mal + " con error (siguen en la lista)" : ""), mal ? 5000 : 2500);
  }

  function editarPedido(p) {
    const items = JSON.parse(JSON.stringify(p.items || []));
    const c = Object.assign({}, p.cliente || {});
    const tipo = p.tipo_precio === "mayor" ? "mayor" : "detal";
    const pago = p.total_bs ? "bcv" : "divisas"; // en pedidos en Bs el precio ya trae la brecha
    const prodDe = (i) => E.productos.find((x) => String(x.id) === String(i.id));
    // guarda lo escrito en las filas antes de volver a pintar
    function leerFilas() {
      $$("#f-ped [data-k]").forEach((fila) => {
        const i = items[Number(fila.dataset.k)]; if (!i) return;
        i.cantidad = Math.max(1, ent($("[data-k-c=cantidad]", fila).value) || 1);
        i.precio = num($("[data-k-c=precio]", fila).value) || 0;
        const sc = $("[data-k-c=color]", fila); if (sc) i.color = sc.value;
        i.subtotal = Math.round(i.precio * i.cantidad * 100) / 100;
      });
      const f = $("#f-ped"); if (f) Object.assign(c, leerForm(f));
    }
    function totalTexto() {
      const t = items.reduce((a, i) => a + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0);
      return T.dinero(Math.round(t * 100) / 100) + (pago === "bcv" && E.cfg.tasaBCV ? " · " + T.bs(Math.round(t * E.cfg.tasaBCV * 100) / 100) : "");
    }
    const ins = 'style="border:1px solid var(--linea);border-radius:12px;padding:0 10px;min-width:0"';
    function fila(i, k) {
      const prod = prodDe(i);
      const cols = prod ? T.colores(prod) : [];
      const sel = cols.length > 1
        ? '<select data-k-c="color" ' + ins + ' aria-label="Color">' + cols.map((x) => '<option' + (x.nombre === i.color ? " selected" : "") + ">" + esc(x.nombre) + "</option>").join("") + "</select>"
        : '<span class="ayuda">' + esc(i.color || "—") + "</span>";
      const foto = prod ? T.fotoPrincipal(prod) : "";
      return '<div class="fila-ped" data-k="' + k + '">' +
        (foto ? '<img src="' + esc(foto) + '" alt="">' : '<span class="sin-foto"></span>') +
        '<div class="fp-nombre"><b>' + esc(i.nombre) + '</b><small class="ayuda">' + esc(i.codigo || "") + "</small></div>" +
        sel +
        '<input data-k-c="cantidad" value="' + i.cantidad + '" inputmode="numeric" placeholder="Cant." title="Cantidad" ' + ins + ' aria-label="Cantidad">' +
        '<input data-k-c="precio" value="' + i.precio + '" inputmode="decimal" placeholder="Precio $" title="Precio unitario" ' + ins + ' aria-label="Precio unitario">' +
        '<button type="button" class="icono-boton" data-k-quitar aria-label="Quitar">' + icono("basura") + "</button></div>";
    }
    function cuerpo() {
      return '<form id="f-ped"><div class="seccion-form"><h3>Productos</h3>' +
        '<div class="cab-ped ayuda"><span></span><span>Producto</span><span>Color</span><span>Cant.</span><span>Precio $' + (pago === "bcv" ? " (pago en Bs)" : "") + '</span><span></span></div>' +
        items.map(fila).join("") +
        '<div class="agregar-ped"><label class="campo" style="margin:0">Agregar producto<input id="pe-buscar" type="search" autocomplete="off" placeholder="Busca por nombre o código…" ' + ins + '></label><div id="pe-resultados" class="resultados-ped"></div></div>' +
        '<p class="total-ped"><span>Total</span><b id="pe-total">' + totalTexto() + "</b></p></div>" +
        '<div class="seccion-form"><h3>Cliente</h3><div class="rejilla-campos">' +
        campo("Nombre", "nombre", c.nombre) + campo("Teléfono", "telefono", c.telefono) + campo("Cédula / RIF", "cedula", c.cedula) + campo("Ciudad", "ciudad", c.ciudad) + campo("Entrega", "entrega", c.entrega, { doble: true }) +
        campo("Nota", "nota", c.nota != null ? c.nota : p.nota, { tipo: "area", doble: true, filas: 2 }) + "</div></div></form>";
    }
    function repintar(foco) {
      $("#modal-cuerpo").innerHTML = cuerpo();
      enlazar();
      if (foco) { const b = $("#pe-buscar"); b.focus(); }
    }
    function buscar() {
      const q = T.normalizar($("#pe-buscar").value).split(/\s+/).filter(Boolean);
      const caja = $("#pe-resultados");
      if (!q.length) { caja.innerHTML = ""; return; }
      const lista = E.productos.filter((x) => { const t = T.normalizar([x.nombre, x.codigo, x.categoria].join(" ")); return q.every((w) => t.includes(w)); }).slice(0, 8);
      caja.innerHTML = lista.map((x) => {
        const st = x.encargo ? "Por encargo" : "Stock " + T.stockDe(x);
        return '<button type="button" class="res-ped" data-agregar="' + x.id + '">' + (T.fotos(x).length ? '<img src="' + esc(T.fotoPrincipal(x)) + '" alt="">' : '<span class="sin-foto"></span>') +
          "<span><b>" + esc(x.nombre) + "</b><small>" + esc([x.codigo, st].filter(Boolean).join(" · ")) + "</small></span><em>" + T.dinero(T.precio(x, tipo, pago)) + "</em></button>";
      }).join("") || '<p class="ayuda" style="margin:6px 0">No hay productos con esa búsqueda.</p>';
    }
    function enlazar() {
      $("#pe-buscar").oninput = buscar;
      $("#pe-buscar").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); const b = $("#pe-resultados [data-agregar]"); if (b) b.click(); } };
      $("#f-ped").oninput = (e) => { if (e.target.closest("[data-k]")) { leerFilas(); $("#pe-total").textContent = totalTexto(); } };
      $("#f-ped").onchange = $("#f-ped").oninput;
    }
    abrirModal("Editar pedido " + (p.codigo || ""), cuerpo(), '<button class="boton claro" id="pe-cancelar">Cancelar</button><button class="boton" id="pe-guardar">Guardar</button>');
    enlazar();
    $("#pe-cancelar").onclick = () => cerrarModal();
    $("#modal-cuerpo").onclick = (e) => {
      const ag = e.target.closest("[data-agregar]");
      if (ag) {
        leerFilas();
        const prod = E.productos.find((x) => String(x.id) === ag.dataset.agregar);
        const cols = T.colores(prod);
        const color = cols.length ? (cols.find((x) => prod.encargo || T.stockDe(prod, x.nombre) > 0) || cols[0]).nombre : "";
        const ya = items.find((i) => String(i.id) === String(prod.id) && (i.color || "") === color);
        if (ya) ya.cantidad += 1;
        else { const precio = T.precio(prod, tipo, pago); items.push({ id: prod.id, nombre: prod.nombre, codigo: prod.codigo || "", color, cantidad: 1, precio, subtotal: precio }); }
        repintar(true);
        T.tostada("Agregado: " + prod.nombre);
        return;
      }
      const q = e.target.closest("[data-k-quitar]");
      if (!q) return;
      leerFilas();
      if (items.length === 1) { T.tostada("El pedido debe tener al menos un producto. Usa «Rechazar» para borrarlo."); return; }
      items.splice(Number(q.closest("[data-k]").dataset.k), 1);
      repintar();
    };
    $("#pe-guardar").onclick = async (e) => {
      leerFilas();
      const v = leerForm($("#f-ped"));
      const total = Math.round(items.reduce((a, i) => a + i.subtotal, 0) * 100) / 100;
      const cambios = {
        items, total,
        total_bs: p.total_bs && E.cfg.tasaBCV ? Math.round(total * E.cfg.tasaBCV * 100) / 100 : p.total_bs,
        cliente: { nombre: v.nombre, telefono: v.telefono, cedula: v.cedula, ciudad: v.ciudad, entrega: v.entrega },
        nota: v.nota || null,
      };
      const listo = ocupado(e.currentTarget);
      try { await D.actualizarPedido(p.id, cambios); Object.assign(p, cambios); cerrarModal(true); pintarPedidos(); T.tostada("Pedido actualizado"); } catch (ex) { falla(ex); } finally { listo(); }
    };
  }

  // ===================================================================
  // CATEGORÍAS
  // ===================================================================
  function vistaCategorias() {
    const lista = categoriasConfig().map((c) => ({ nombre: c.nombre, icono: c.icono || "", original: c.nombre, oculta: !!c.oculta }));
    todasCategorias().forEach((n) => { if (!lista.some((c) => c.nombre === n)) lista.push({ nombre: n, icono: "", original: n }); });
    const cuenta = (n) => E.productos.filter((p) => p.categoria === n).length;
    function pintar() {
      $("#cat-lista").innerHTML = lista.map((c, i) =>
        '<div class="item-orden" data-i="' + i + '"><div class="mover"><button data-m="-1" aria-label="Subir">' + icono("arriba") + '</button><button data-m="1" aria-label="Bajar">' + icono("abajo") + "</button></div>" +
        '<div class="vista-icono">' + icono(c.icono || "todo") + "</div>" +
        '<div class="campos"><input class="cat-nombre" value="' + esc(c.nombre) + '" placeholder="Nombre de la categoría" style="border:1px solid var(--linea);border-radius:10px;padding:0 10px">' +
        '<select class="cat-icono" style="border:1px solid var(--linea);border-radius:10px;padding:0 8px;background:var(--superficie)">' + ['<option value="">Icono automático</option>'].concat(window.ICONOS_CATEGORIA.map((k) => '<option value="' + k + '"' + (k === c.icono ? " selected" : "") + ">" + k.replace("-", " ") + "</option>")).join("") + "</select>" +
        '<span class="num-prod">' + cuenta(c.original) + " producto(s)</span></div>" +
        '<button class="icono-boton" data-quitar aria-label="Quitar">' + icono("basura") + "</button></div>"
      ).join("") || '<div class="vacio-admin">Sin categorías</div>';
    }
    $("#vista").innerHTML = '<div class="tarjeta-admin"><h3>Categorías del catálogo <small>El orden aquí es el orden en la tienda</small></h3>' +
      '<p class="ayuda">Si cambias el nombre de una categoría, sus productos se actualizan solos. Las categorías sin productos no se muestran en la tienda.</p>' +
      '<div class="lista-orden" id="cat-lista"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between"><button class="boton claro pequeno" id="cat-agregar">' + icono("mas") + 'Agregar categoría</button><button class="boton" id="cat-guardar">Guardar categorías</button></div></div>';
    pintar();
    $("#cat-lista").addEventListener("input", (e) => {
      const fila = e.target.closest("[data-i]"); if (!fila) return;
      const c = lista[Number(fila.dataset.i)];
      if (e.target.classList.contains("cat-nombre")) c.nombre = e.target.value;
      if (e.target.classList.contains("cat-icono")) { c.icono = e.target.value; $(".vista-icono", fila).innerHTML = icono(c.icono || "todo"); }
    });
    $("#cat-lista").addEventListener("click", async (e) => {
      const fila = e.target.closest("[data-i]"); if (!fila) return;
      const i = Number(fila.dataset.i);
      const m = e.target.closest("[data-m]");
      if (m) { const j = i + Number(m.dataset.m); if (j < 0 || j >= lista.length) return; const t = lista[i]; lista[i] = lista[j]; lista[j] = t; pintar(); return; }
      if (e.target.closest("[data-quitar]")) {
        const n = cuenta(lista[i].original);
        if (n && !(await confirmar("Quitar categoría", "La categoría <b>" + esc(lista[i].nombre) + "</b> tiene " + n + " producto(s). Seguirán existiendo, pero sin esa categoría en el orden. ¿Quitarla de la lista?", "Quitar"))) return;
        lista.splice(i, 1); pintar();
      }
    });
    $("#cat-agregar").onclick = () => { lista.push({ nombre: "", icono: "", original: "" }); pintar(); const ins = $$(".cat-nombre"); ins[ins.length - 1].focus(); };
    $("#cat-guardar").onclick = async (e) => {
      const limpias = lista.filter((c) => c.nombre.trim());
      const nombres = limpias.map((c) => c.nombre.trim().toLowerCase());
      if (new Set(nombres).size !== nombres.length) { T.tostada("Hay dos categorías con el mismo nombre"); return; }
      const listo = ocupado(e.currentTarget);
      try {
        for (const c of limpias) if (c.original && c.original !== c.nombre.trim()) await D.renombrarCategoria(c.original, c.nombre.trim());
        const cfg = Object.assign({}, await D.config(), { categorias: limpias.map((c) => ({ nombre: c.nombre.trim(), icono: c.icono })) });
        await D.guardarConfig(cfg);
        E.cfg = T.unirAjustes(cfg);
        E.productos = await D.productos();
        T.tostada("Categorías guardadas");
        vistaCategorias();
      } catch (ex) { falla(ex); } finally { listo(); }
    };
  }

  // ===================================================================
  // PÁGINA (portada, colecciones, reseñas, páginas informativas)
  // ===================================================================
  function vistaPagina() {
    const cfg = JSON.parse(JSON.stringify(E.cfg));
    const cols = cfg.colecciones.slice();
    const res = cfg.resenas.slice();
    const ini = Object.assign({}, cfg.inicio || {});
    const fotosPag = Object.assign({}, cfg.fotosPaginas || {});
    // Fotos del carrusel del héroe: independientes de las fotos de los productos
    const heroeFotos = (Array.isArray(cfg.portada.fotos) ? cfg.portada.fotos : []).filter((f) => f && f.foto).map((f) => ({ foto: f.foto, producto: f.producto != null ? String(f.producto) : "" }));
    if (!heroeFotos.length && cfg.portada.imagen) heroeFotos.push({ foto: cfg.portada.imagen, producto: "" });
    const subtituloViejo = /Al mayor y al detal/i.test(cfg.portada.subtitulo || "");
    const prodOrden = E.productos.slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
    const gal = (cfg.galeria || []).map((g) => Object.assign({}, g));
    const PAGS = [["pagos", "Métodos de pago"], ["envios", "Envíos"], ["resenas", "Reseñas (texto de introducción)"], ["contacto", "Contacto (texto de introducción)"], ["politicas", "Políticas"], ["privacidad", "Privacidad"]];
    $("#vista").innerHTML = '<form id="f-pag" class="tarjetas-admin">' +
      '<div class="tarjeta-admin"><h3>Portada (carrusel grande)</h3>' +
      '<p class="ayuda">La frase pequeña de arriba es el <b>eslogan</b> (Ajustes › Tienda).</p>' +
      '<div class="rejilla-campos">' +
      campo("Título grande", "titulo", cfg.portada.titulo, { doble: true, placeholder: "Encuentra el equilibrio perfecto entre **confort y estilo**.", ayuda: "Escribe **así** para poner palabras en negrita. Vacío = texto de fábrica." }) +
      campo("Texto del botón", "boton", cfg.portada.boton) +
      campo("Subtítulo", "subtitulo", subtituloViejo ? "" : cfg.portada.subtitulo, { tipo: "area", doble: true, filas: 2, placeholder: "Sillas, escritorios, comedores, barras, espejos y vanity. Precios en divisas y en bolívares, con envíos a toda Venezuela." }) +
      "</div></div>" +
      '<div class="tarjeta-admin"><h3>Fotos del carrusel de la portada <button type="button" class="boton claro pequeno" id="hf-agregar">' + icono("mas") + "Foto</button></h3>" +
      '<p class="ayuda">Estas fotos son <b>solo para la portada</b>: no cambian las fotos de los productos. Debajo de cada foto elige <b>qué producto es</b>: la tarjeta de la portada mostrará su nombre, precio en $ y en Bs, y el botón «Ver producto». Hasta 8 fotos; mejor horizontales y de ambiente. Ordénalas con ▲. Si no subes ninguna, se usan los productos <b>Destacados</b> con foto de ambiente.</p>' +
      '<div id="hf-lista" class="hf-lista"></div></div>' +
      '<div class="tarjeta-admin"><h3>Textos de la página de inicio</h3><p class="ayuda">Deja vacío para usar el texto de fábrica (el que ves en gris).</p><div class="rejilla-campos">' +
      campo("Franja bajo la portada · texto corto", "ini_franja1", ini.franja1, { placeholder: "Eleva tus espacios con mobiliario moderno para tu casa y tu oficina." }) +
      campo("Franja bajo la portada · texto grande", "ini_franja2", ini.franja2, { placeholder: "Piezas atemporales para cada espacio de tu hogar y oficina." }) +
      campo("Categorías · palabra pequeña", "ini_catsCeja", ini.catsCeja, { placeholder: "Explora" }) +
      campo("Categorías · título", "ini_catsTitulo", ini.catsTitulo, { placeholder: "Compra por categoría" }) +
      campo("Ventajas · título", "ini_ventTitulo", ini.ventTitulo, { placeholder: "Comprar en ARKEO es sencillo" }) +
      campo("Ventajas · texto", "ini_ventTexto", ini.ventTexto, { placeholder: "Atención cercana, pagos flexibles y entregas en todo el país." }) +
      campo("Banda de asesoría · palabra pequeña", "ini_bandaCeja", ini.bandaCeja, { placeholder: "Empresas y mayoristas" }) +
      campo("Banda de asesoría · título", "ini_bandaTitulo", ini.bandaTitulo, { placeholder: "Equipa tu oficina completa" }) +
      campo("Banda de asesoría · texto", "ini_bandaTexto", ini.bandaTexto, { tipo: "area", doble: true, filas: 2, placeholder: "Precio al mayor desde 6 piezas combinando modelos. Cotiza tu proyecto y te asesoramos." }) +
      "</div>" + bloqueImagen("banda-img", ini.bandaFoto, "Foto de fondo de la banda azul (opcional, horizontal).") +
      '<div class="rejilla-campos">' + [["Envíos nacionales", "A toda Venezuela"], ["Divisas o bolívares", "Precio a tasa BCV"], ["Al mayor y al detal", "Precio al mayor desde N piezas"], ["Clientes felices", "Lee sus reseñas"]].map(([t, d], k) =>
        campo("Ventaja " + (k + 1) + " · título", "ini_vt_" + k, (ini.ventajas && ini.ventajas[k] || {}).titulo, { placeholder: t }) +
        campo("Ventaja " + (k + 1) + " · texto", "ini_vd_" + k, (ini.ventajas && ini.ventajas[k] || {}).texto, { placeholder: d })).join("") +
      "</div></div>" +
      '<div class="tarjeta-admin"><h3>Colecciones <button type="button" class="boton claro pequeno" id="col-agregar">' + icono("mas") + 'Colección</button></h3><p class="ayuda">Grupos especiales (ej.: «Oficina en casa»). Marca los productos de cada colección en su ficha.</p><div id="col-lista" class="lista-orden"></div></div>' +
      '<div class="tarjeta-admin"><h3>Reseñas <button type="button" class="boton claro pequeno" id="res-agregar">' + icono("mas") + 'Reseña</button></h3><div id="res-lista" class="lista-orden"></div></div>' +
      '<div class="tarjeta-admin"><h3>Fotos de las páginas del menú</h3><p class="ayuda">La foto grande de arriba de cada página (Pagos, Envíos, Reseñas, Contacto…). Si no subes una, se usa una foto de fábrica. Mejor horizontal.</p><div class="rejilla-campos">' +
        PAGS.map(([k, t]) => '<div class="campo"><b>' + t.replace(/ \(.*\)$/, "") + "</b>" + bloqueImagen("pagfoto-" + k, fotosPag[k], "") + "</div>").join("") + "</div></div>" +
      '<div class="tarjeta-admin"><h3>Galería de Instagram <button type="button" class="boton claro pequeno" id="gal-agregar">' + icono("mas") + 'Foto</button></h3><p class="ayuda">Fotos que salen en la sección «Instagram» (inicio y páginas del menú). Al tocarlas llevan a tu Instagram. Si pegas el enlace de una publicación, esa foto lleva a esa publicación. Hasta 12 fotos; se ven mejor cuadradas. Si no agregas ninguna se usan las fotos de fábrica.</p><div id="gal-lista" class="lista-orden"></div></div>' +
      '<div class="tarjeta-admin"><h3>Páginas informativas</h3><p class="ayuda">Deja un cuadro vacío para usar el texto de fábrica. Formato sencillo: una línea que empiece con <b>## </b> es un título; con <b>- </b> es una lista; <b>**texto**</b> va en negrita.</p>' +
      PAGS.map(([k, t]) => campo(t, "pag::" + k, cfg.paginas[k] || "", { tipo: "area", filas: 5 })).join("") + "</div>" +
      '<div style="display:flex;justify-content:flex-end"><button type="button" class="boton" id="pag-guardar">Guardar página</button></div></form>';

    function pintarCols() {
      $("#col-lista").innerHTML = cols.map((c, i) => '<div class="bloque-lista" data-i="' + i + '"><div class="encabezado"><span>Colección ' + (i + 1) + '</span><span><button type="button" class="icono-boton" data-col-m="-1" aria-label="Subir">' + icono("arriba") + '</button> <button type="button" class="icono-boton" data-col-x aria-label="Quitar">' + icono("basura") + "</button></span></div>" +
        '<div class="rejilla-campos"><label class="campo">Nombre<input data-col="nombre" value="' + esc(c.nombre || "") + '"></label><label class="campo">Descripción corta<input data-col="descripcion" value="' + esc(c.descripcion || "") + '"></label></div>' +
        bloqueImagen("col-img-" + i, c.imagen, "") + "</div>").join("") || '<p class="ayuda">Sin colecciones.</p>';
    }
    function pintarRes() {
      $("#res-lista").innerHTML = res.map((r, i) => '<div class="bloque-lista" data-i="' + i + '"><div class="encabezado"><span>Reseña ' + (i + 1) + '</span><button type="button" class="icono-boton" data-res-x aria-label="Quitar">' + icono("basura") + "</button></div>" +
        '<div class="rejilla-campos"><label class="campo">Nombre<input data-res="nombre" value="' + esc(r.nombre || "") + '"></label><label class="campo">Ciudad<input data-res="ciudad" value="' + esc(r.ciudad || "") + '"></label>' +
        '<label class="campo">Estrellas<select data-res="estrellas">' + [5, 4, 3, 2, 1].map((n) => "<option" + (Number(r.estrellas || 5) === n ? " selected" : "") + ">" + n + "</option>").join("") + "</select></label>" +
        '<label class="campo doble">Opinión<textarea data-res="texto" rows="2">' + esc(r.texto || "") + "</textarea></label></div>" +
        bloqueImagen("res-img-" + i, r.foto, "Foto opcional (del cliente con su mueble).") + "</div>").join("") || '<p class="ayuda">Sin reseñas.</p>';
    }
    function pintarGal() {
      $("#gal-lista").innerHTML = gal.map((g, i) => '<div class="bloque-lista" data-i="' + i + '"><div class="encabezado"><span>Foto ' + (i + 1) + '</span><span><button type="button" class="icono-boton" data-gal-m="-1" aria-label="Subir">' + icono("arriba") + '</button> <button type="button" class="icono-boton" data-gal-x aria-label="Quitar">' + icono("basura") + "</button></span></div>" +
        bloqueImagen("gal-img-" + i, g.foto, "") +
        '<label class="campo">Enlace de la publicación (opcional)<input data-gal="enlace" value="' + esc(g.enlace || "") + '" placeholder="https://www.instagram.com/p/…"></label></div>').join("") || '<p class="ayuda">Sin fotos: se muestran las de fábrica.</p>';
    }
    function pintarHeroeFotos() {
      $("#hf-lista").innerHTML = heroeFotos.map((f, i) => '<div class="bloque-lista hf-item" data-i="' + i + '"><div class="encabezado"><span>Foto ' + (i + 1) + '</span><span><button type="button" class="icono-boton" data-hf-m="-1" aria-label="Subir">' + icono("arriba") + '</button> <button type="button" class="icono-boton" data-hf-x aria-label="Quitar">' + icono("basura") + "</button></span></div>" +
        (f.foto ? '<img class="hf-foto" src="' + esc(f.foto) + '" alt="">' : "") +
        bloqueImagen("heroe-img-" + i, f.foto, "") +
        '<label class="campo">¿Qué producto es esta foto?<select data-hf="producto"><option value="">— Ninguno (solo la foto) —</option>' +
        prodOrden.map((p) => '<option value="' + p.id + '"' + (String(p.id) === f.producto ? " selected" : "") + ">" + esc(p.nombre) + (p.codigo ? " · " + esc(p.codigo) : "") + (p.disponible === false ? " (oculto)" : "") + "</option>").join("") +
        "</select></label></div>").join("") || '<p class="ayuda">Sin fotos propias: la portada usa los productos Destacados.</p>';
    }
    pintarCols(); pintarRes(); pintarGal(); pintarHeroeFotos();
    $("#hf-agregar").onclick = () => { if (heroeFotos.length >= 8) { T.tostada("Máximo 8 fotos"); return; } heroeFotos.push({ foto: "", producto: "" }); pintarHeroeFotos(); };
    $("#hf-lista").addEventListener("change", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.dataset.hf) heroeFotos[Number(f.dataset.i)][e.target.dataset.hf] = e.target.value; });
    $("#hf-lista").addEventListener("click", (e) => {
      const f = e.target.closest("[data-i]"); if (!f) return; const i = Number(f.dataset.i);
      if (e.target.closest("[data-hf-x]")) { heroeFotos.splice(i, 1); pintarHeroeFotos(); }
      if (e.target.closest("[data-hf-m]") && i > 0) { const t = heroeFotos[i]; heroeFotos[i] = heroeFotos[i - 1]; heroeFotos[i - 1] = t; pintarHeroeFotos(); }
    });
    $("#gal-agregar").onclick = () => { if (gal.length >= 12) { T.tostada("Máximo 12 fotos"); return; } gal.push({ foto: "", enlace: "" }); pintarGal(); };
    $("#gal-lista").addEventListener("input", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.dataset.gal) gal[Number(f.dataset.i)][e.target.dataset.gal] = e.target.value.trim(); });
    $("#gal-lista").addEventListener("click", (e) => {
      const f = e.target.closest("[data-i]"); if (!f) return; const i = Number(f.dataset.i);
      if (e.target.closest("[data-gal-x]")) { gal.splice(i, 1); pintarGal(); }
      if (e.target.closest("[data-gal-m]") && i > 0) { const t = gal[i]; gal[i] = gal[i - 1]; gal[i - 1] = t; pintarGal(); }
    });
    $("#col-agregar").onclick = () => { cols.push({ nombre: "", descripcion: "", imagen: "" }); pintarCols(); };
    $("#res-agregar").onclick = () => { res.push({ nombre: "", ciudad: "", estrellas: 5, texto: "" }); pintarRes(); };
    $("#col-lista").addEventListener("input", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.dataset.col) cols[Number(f.dataset.i)][e.target.dataset.col] = e.target.value; });
    $("#res-lista").addEventListener("input", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.dataset.res) res[Number(f.dataset.i)][e.target.dataset.res] = e.target.value; });
    $("#res-lista").addEventListener("change", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.dataset.res) res[Number(f.dataset.i)][e.target.dataset.res] = e.target.value; });
    $("#col-lista").addEventListener("click", (e) => {
      const f = e.target.closest("[data-i]"); if (!f) return; const i = Number(f.dataset.i);
      if (e.target.closest("[data-col-x]")) { cols.splice(i, 1); pintarCols(); }
      if (e.target.closest("[data-col-m]") && i > 0) { const t = cols[i]; cols[i] = cols[i - 1]; cols[i - 1] = t; pintarCols(); }
    });
    $("#res-lista").addEventListener("click", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.closest("[data-res-x]")) { res.splice(Number(f.dataset.i), 1); pintarRes(); } });

    // Imágenes: el bloque guarda la URL en un input oculto con id = clave
    $("#vista").onchange = async (e) => {
      const inp = e.target.closest("input[type=file][data-img]");
      if (!inp || !inp.files[0]) return;
      const clave = inp.dataset.img;
      const caja = inp.closest(".bloque-img");
      $(".progreso", caja).textContent = "Subiendo…";
      try {
        const blob = await aligerar(inp.files[0], 900);
        const url = await F.subir(blob, clave === "portada-img" || clave === "banda-img" || clave.startsWith("heroe-img-") || clave.startsWith("pagfoto-") || clave.startsWith("gal-img-") ? "portada" : clave.startsWith("res") ? "resenas" : "colecciones", clave);
        ponerImagen(clave, url);
      } catch (ex) { falla(ex); $(".progreso", caja).textContent = ""; }
      inp.value = "";
    };
    $("#vista").onclick = (e) => {
      const q = e.target.closest("[data-img-quitar]");
      if (q) ponerImagen(q.dataset.imgQuitar, "");
    };
    function ponerImagen(clave, url) {
      if (clave === "portada-img") cfg.portada.imagen = url;
      else if (clave === "banda-img") ini.bandaFoto = url;
      else if (clave.startsWith("col-img-")) cols[Number(clave.slice(8))].imagen = url;
      else if (clave.startsWith("res-img-")) res[Number(clave.slice(8))].foto = url;
      else if (clave.startsWith("pagfoto-")) fotosPag[clave.slice(8)] = url;
      else if (clave.startsWith("heroe-img-")) { heroeFotos[Number(clave.slice(10))].foto = url; pintarHeroeFotos(); return; }
      else if (clave.startsWith("gal-img-")) gal[Number(clave.slice(8))].foto = url;
      const caja = $('[data-bloque="' + clave + '"]');
      if (caja) caja.outerHTML = bloqueImagen(clave, url, caja.dataset.ayuda || "");
    }

    $("#pag-guardar").onclick = async (e) => {
      const v = leerForm($("#f-pag"));
      const listo = ocupado(e.currentTarget);
      try {
        const actual = await D.config();
        const paginas = {};
        PAGS.forEach(([k]) => { if ((v["pag::" + k] || "").trim()) paginas[k] = v["pag::" + k].trim(); });
        const nuevo = Object.assign({}, actual, {
          portada: { titulo: v.titulo.trim(), subtitulo: v.subtitulo.trim(), boton: v.boton.trim() || "Ver catálogo", imagen: "", fotos: heroeFotos.filter((f) => f.foto).map((f) => ({ foto: f.foto, producto: f.producto || "" })) },
          colecciones: cols.filter((c) => (c.nombre || "").trim()).map((c) => ({ nombre: c.nombre.trim(), descripcion: (c.descripcion || "").trim(), imagen: c.imagen || "" })),
          resenas: res.filter((r) => (r.texto || "").trim()).map((r) => ({ nombre: (r.nombre || "").trim(), ciudad: (r.ciudad || "").trim(), estrellas: Number(r.estrellas) || 5, texto: r.texto.trim(), foto: r.foto || "" })),
          paginas,
          fotosPaginas: fotosPag,
          galeria: gal.filter((g) => g.foto).map((g) => ({ foto: g.foto, enlace: /^https?:\/\//i.test(g.enlace || "") ? g.enlace : "" })),
          inicio: {
            franja1: v.ini_franja1.trim(), franja2: v.ini_franja2.trim(), catsCeja: v.ini_catsCeja.trim(), catsTitulo: v.ini_catsTitulo.trim(),
            bandaCeja: v.ini_bandaCeja.trim(), bandaTitulo: v.ini_bandaTitulo.trim(), bandaTexto: v.ini_bandaTexto.trim(), bandaFoto: ini.bandaFoto || "", ventTitulo: (v.ini_ventTitulo || "").trim(), ventTexto: (v.ini_ventTexto || "").trim(),
            ventajas: [0, 1, 2, 3].map((k) => ({ titulo: (v["ini_vt_" + k] || "").trim(), texto: (v["ini_vd_" + k] || "").trim() })),
          },
        });
        await D.guardarConfig(nuevo);
        // Renombrar colección en los productos si cambió de nombre: se maneja marcándola de nuevo en la ficha.
        E.cfg = T.unirAjustes(nuevo);
        T.tostada("Página guardada");
      } catch (ex) { falla(ex); } finally { listo(); }
    };
  }

  function bloqueImagen(clave, url, ayuda) {
    return '<div class="bloque-img" data-bloque="' + clave + '" data-ayuda="' + esc(ayuda) + '" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
      (url ? '<img class="mini-foto" src="' + esc(url) + '" alt="">' : '<div class="mini-foto" style="display:grid;place-items:center">' + icono("imagen") + "</div>") +
      '<label class="boton claro pequeno">' + icono("subir") + (url ? "Cambiar" : "Subir imagen") + '<input type="file" accept="image/*" data-img="' + clave + '" hidden></label>' +
      (url ? '<button type="button" class="boton claro pequeno" data-img-quitar="' + clave + '">Quitar</button>' : "") +
      '<span class="progreso"></span>' + (ayuda ? '<span class="ayuda" style="flex-basis:100%">' + ayuda + "</span>" : "") + "</div>";
  }

  // ===================================================================
  // PROVEEDORES
  // ===================================================================
  function vistaProveedores() {
    $("#vista").innerHTML = '<div class="barra-vista"><p class="ayuda">Lista privada: solo tú la ves. Asigna el proveedor en la ficha de cada producto.</p><span class="espacio"></span><button class="boton pequeno" id="pv-nuevo">' + icono("mas") + 'Nuevo proveedor</button></div><div class="tarjetas-admin" id="pv-lista"></div>';
    $("#pv-nuevo").onclick = () => editarProveedor({});
    D.privados().then((privs) => pintar(privs)).catch(() => pintar([]));
    function pintar(privs) {
      const n = (id) => privs.filter((x) => x.proveedor_id === id).length;
      $("#pv-lista").innerHTML = E.proveedores.map((p) => '<div class="tarjeta-admin" data-id="' + p.id + '"><h3>' + esc(p.nombre) + "<small>" + n(p.id) + ' producto(s)</small></h3><div class="ayuda">' +
        esc([p.contacto, p.telefono, p.correo, p.direccion].filter(Boolean).join(" · ")) + (p.notas ? "<br>" + esc(p.notas) : "") + '</div><div class="pedido-acciones">' +
        (p.telefono ? '<a class="boton claro pequeno" target="_blank" rel="noopener" href="' + esc(T.enlaceWa(p.telefono, "Hola")) + '">' + icono("whatsapp") + "WhatsApp</a>" : "") +
        '<button class="boton claro pequeno" data-pv="editar">' + icono("editar") + 'Editar</button><button class="boton claro pequeno" data-pv="borrar" style="color:var(--peligro)">' + icono("basura") + "Borrar</button></div></div>").join("") ||
        '<div class="vacio-admin"><strong>Sin proveedores</strong>Agrega a quién le compras la mercancía.</div>';
    }
    $("#pv-lista").onclick = async (e) => {
      const b = e.target.closest("[data-pv]"); if (!b) return;
      const p = E.proveedores.find((x) => String(x.id) === b.closest("[data-id]").dataset.id);
      if (b.dataset.pv === "editar") editarProveedor(p);
      if (b.dataset.pv === "borrar" && (await confirmar("Borrar proveedor", "¿Borrar <b>" + esc(p.nombre) + "</b>? Los productos quedan sin proveedor.", "Borrar", true))) {
        try { await D.borrarProveedor(p.id); E.proveedores = E.proveedores.filter((x) => x !== p); vistaProveedores(); } catch (ex) { falla(ex); }
      }
    };
  }
  function editarProveedor(p) {
    abrirModal(p.id ? "Editar proveedor" : "Nuevo proveedor", '<form id="f-pv" class="rejilla-campos">' +
      campo("Nombre *", "nombre", p.nombre, { doble: true }) + campo("Persona de contacto", "contacto", p.contacto) + campo("Teléfono", "telefono", p.telefono, { tipo: "tel" }) +
      campo("Correo", "correo", p.correo, { tipo: "email" }) + campo("Dirección", "direccion", p.direccion) + campo("Notas", "notas", p.notas, { tipo: "area", doble: true }) + "</form>",
      '<button class="boton" id="pv-guardar">Guardar</button>');
    $("#pv-guardar").onclick = async (e) => {
      const v = leerForm($("#f-pv"));
      if (!v.nombre.trim()) { T.tostada("Escribe el nombre"); return; }
      const listo = ocupado(e.currentTarget);
      try {
        await D.guardarProveedor(Object.assign({}, p.id ? { id: p.id } : {}, { nombre: v.nombre.trim(), contacto: v.contacto, telefono: v.telefono, correo: v.correo, direccion: v.direccion, notas: v.notas }));
        E.proveedores = await D.proveedores();
        cerrarModal(true); vistaProveedores();
      } catch (ex) { falla(ex); } finally { listo(); }
    };
  }

  // ===================================================================
  // AJUSTES
  // ===================================================================
  function vistaAjustes() {
    const c = E.cfg;
    $("#vista").innerHTML = '<form id="f-aj" class="tarjetas-admin" autocomplete="off">' +
      '<div class="tarjeta-admin"><h3>Tienda</h3><div class="rejilla-campos">' +
      campo("Nombre de la tienda", "nombreTienda", c.nombreTienda) + campo("Eslogan", "eslogan", c.eslogan) + "</div>" +
      bloqueImagen("logo-img", c.logo, "Logo cuadrado (opcional). Aparece junto al nombre.") + "</div>" +
      '<div class="tarjeta-admin"><h3>Contacto</h3><div class="rejilla-campos">' +
      campo("WhatsApp de pedidos *", "whatsapp", c.whatsapp, { tipo: "tel", placeholder: "0414-1234567", ayuda: "Aquí llegan los pedidos. Puede ser 0414… o +58414…" }) +
      campo("Teléfono visible", "telefono", c.telefono) + campo("Instagram", "instagram", c.instagram, { placeholder: "@usuario" }) + campo("TikTok", "tiktok", c.tiktok, { placeholder: "@usuario" }) +
      campo("Correo", "correo", c.correo, { tipo: "email" }) + campo("Horario", "horario", c.horario) +
      campo("Dirección", "direccion", c.direccion, { doble: true }) + campo("Enlace de Google Maps", "mapa", c.mapa, { doble: true, placeholder: "https://maps.app.goo.gl/…" }) + "</div></div>" +
      '<div class="tarjeta-admin"><h3>Precios en bolívares</h3><p class="ayuda">Cada producto lleva un solo precio en divisas. El precio en bolívares se calcula solo: <b>precio en divisas + brecha (%) × tasa BCV</b>. Cambia la brecha o la tasa aquí y se actualizan los precios en Bs de toda la tienda.</p><div class="rejilla-campos">' +
      campo("Tasa BCV (Bs por $)", "tasaBCV", c.tasaBCV || "", { attrs: ' inputmode="decimal" id="aj-tasa"', ayuda: c.tasaFecha ? "Actualizada el " + c.tasaFecha : "" }) +
      campo("Brecha cambiaria (%)", "brecha", c.brecha, { attrs: ' inputmode="decimal" id="aj-brecha"', ayuda: "Ejemplo: 25 = el precio en Bs es un 25 % más que en divisas." }) +
      '</div><p class="vista-bs" id="aj-ejemplo"></p><div class="interruptores">' +
      interruptor("Calcular el precio en Bs automáticamente", "precioBsAutomatico", c.precioBsAutomatico) +
      interruptor("Vender también al mayor", "ventaMayor", c.ventaMayor) + "</div></div>" +
      '<div class="tarjeta-admin"><h3>Métodos de pago <button type="button" class="boton claro pequeno" id="mp-agregar">' + icono("mas") + 'Método</button></h3><p class="ayuda">Marca los que quieres que aparezcan en la tienda y en el carrito. En «Datos» puedes poner el correo de Zelle, el ID de Binance, etc. (salen en la página de pagos).</p><div id="mp-lista" class="lista-orden"></div></div>' +
      '<div class="tarjeta-admin"><h3>Ventas</h3><div class="rejilla-campos">' +
      (c.ventaMayor ? campo("Mínimo de piezas para precio al mayor", "minimoMayor", c.minimoMayor, { attrs: ' inputmode="numeric"' }) : oculto("minimoMayor", c.minimoMayor)) +
      campo("Aviso «¡Pocas unidades!» desde", "pocasUnidades", c.pocasUnidades, { attrs: ' inputmode="numeric"', ayuda: "Si quedan esta cantidad o menos." }) +
      campo("Texto para productos por encargo", "notaEncargo", c.notaEncargo, { doble: true }) +
      campo("Datos para pagar (página de pagos)", "datosPago", c.datosPago, { tipo: "area", doble: true, filas: 4, placeholder: "- Pago móvil: Banco …, C.I. …, Tel. …\n- Zelle: correo@…" }) +
      campo("Agencias de envío", "agencias", c.agencias, { tipo: "area", filas: 2, placeholder: "MRW, Zoom, Tealca" }) +
      campo("Retiro y entregas locales", "ubicacion", c.ubicacion, { tipo: "area", filas: 2 }) + "</div></div>" +
      '<div class="tarjeta-admin"><h3>Fotos (Cloudflare)</h3><div class="rejilla-campos">' +
      campo("Dirección del Worker", "workerUrl", c.workerUrl, { doble: true, tipo: "url", placeholder: "https://fotos-tienda.tu-usuario.workers.dev", ayuda: "La copias en Cloudflare › Workers › tu Worker (arriba, «Visit» o «Domains»)." }) +
      '</div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button type="button" class="boton claro pequeno" id="aj-probar">Probar conexión</button><span id="aj-estado"></span></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button type="button" class="boton claro pequeno" id="aj-espacio">' + icono("nube") + 'Ver espacio usado</button><button type="button" class="boton claro pequeno" id="aj-huerfanas">Buscar fotos sin usar</button></div><div id="aj-archivos"></div></div>' +
      '<div class="tarjeta-admin"><h3>Pedidos</h3><div class="rejilla-campos">' +
      campo("Borrar pedidos no atendidos después de (días)", "diasPedidos", c.diasPedidos, { attrs: ' inputmode="numeric"' }) + "</div></div>" +
      '<div style="display:flex;justify-content:flex-end"><button type="button" class="boton" id="aj-guardar">Guardar ajustes</button></div>' +
      '<div class="tarjeta-admin"><h3>Mi cuenta</h3><p class="ayuda">Entraste como <b>' + esc(E.correo) + '</b>.</p><div class="rejilla-campos"><label class="campo">Nueva contraseña<input type="password" id="aj-clave" autocomplete="new-password" minlength="8"></label></div><div><button type="button" class="boton claro pequeno" id="aj-cambiar-clave">Cambiar contraseña</button></div></div>' +
      "</form>";
    let logo = c.logo || "";
    // Métodos de pago
    const metodos = (c.metodosPago || []).map((m) => Object.assign({}, m));
    const pintarMetodos = () => {
      $("#mp-lista").innerHTML = metodos.map((m, i) =>
        '<div class="fila-metodo" data-i="' + i + '"><label class="interruptor"><input type="checkbox" data-mp="activo"' + (m.activo ? " checked" : "") + "> Activo</label>" +
        '<input data-mp="nombre" value="' + esc(m.nombre) + '" placeholder="Nombre (ej.: Zelle)">' +
        '<select data-mp="moneda"><option value="divisas"' + (m.moneda !== "bs" ? " selected" : "") + '>En divisas</option><option value="bs"' + (m.moneda === "bs" ? " selected" : "") + ">En bolívares</option></select>" +
        '<input data-mp="detalle" value="' + esc(m.detalle || "") + '" placeholder="Datos (opcional)">' +
        '<button type="button" class="icono-boton" data-mp-x aria-label="Quitar">' + icono("basura") + "</button></div>").join("");
    };
    pintarMetodos();
    $("#mp-agregar").onclick = () => { metodos.push({ nombre: "", moneda: "divisas", detalle: "", activo: true }); pintarMetodos(); };
    $("#mp-lista").addEventListener("input", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.dataset.mp) metodos[Number(f.dataset.i)][e.target.dataset.mp] = e.target.type === "checkbox" ? e.target.checked : e.target.value; });
    $("#mp-lista").addEventListener("change", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.dataset.mp) metodos[Number(f.dataset.i)][e.target.dataset.mp] = e.target.type === "checkbox" ? e.target.checked : e.target.value; });
    $("#mp-lista").addEventListener("click", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.closest("[data-mp-x]")) { metodos.splice(Number(f.dataset.i), 1); pintarMetodos(); } });
    // Ejemplo del cálculo en Bs
    const ejemplo = () => {
      const tasa = num($("#aj-tasa").value) || 0, br = num($("#aj-brecha").value) || 0;
      const conBrecha = Math.round(100 * (1 + br / 100) * 100) / 100;
      $("#aj-ejemplo").innerHTML = "Ejemplo: un producto de <b>$100</b> en divisas → <b>$" + T.numero(conBrecha) + "</b> a tasa BCV" + (tasa ? " → <b>" + T.bs(conBrecha * tasa) + "</b>" : " (escribe la tasa para ver los Bs)");
    };
    $("#aj-tasa").addEventListener("input", ejemplo); $("#aj-brecha").addEventListener("input", ejemplo); ejemplo();
    $("#vista").onchange = async (e) => {
      const inp = e.target.closest("input[type=file][data-img]");
      if (!inp || !inp.files[0]) return;
      try {
        const blob = await aligerar(inp.files[0], 400);
        logo = await F.subir(blob, "portada", "logo");
        $('[data-bloque="logo-img"]').outerHTML = bloqueImagen("logo-img", logo, "Logo cuadrado (opcional). Aparece junto al nombre.");
      } catch (ex) { falla(ex); }
    };
    $("#vista").onclick = (e) => {
      if (e.target.closest('[data-img-quitar="logo-img"]')) { logo = ""; $('[data-bloque="logo-img"]').outerHTML = bloqueImagen("logo-img", "", "Logo cuadrado (opcional)."); }
    };
    $("#aj-probar").onclick = async () => {
      const u = $("#f-aj [name=workerUrl]").value.trim().replace(/\/+$/, "");
      const est = $("#aj-estado");
      if (!/^https:\/\//.test(u)) { est.innerHTML = '<span class="estado-conexion mal">Debe empezar con https://</span>'; return; }
      est.textContent = "Probando…";
      try {
        const j = await F.probar(u);
        est.innerHTML = j.ok && j.supabase ? '<span class="estado-conexion ok">' + icono("check") + "Conectado. Bucket y Supabase OK.</span>" : j.ok ? '<span class="estado-conexion mal">El Worker responde, pero faltan las variables SUPABASE_URL / SUPABASE_KEY.</span>' : '<span class="estado-conexion mal">' + esc(j.error || "Respuesta inesperada") + "</span>";
      } catch (ex) { est.innerHTML = '<span class="estado-conexion mal">No responde. Revisa la dirección (y que pegaste el código del Worker).</span>'; }
    };
    $("#aj-espacio").onclick = async (e) => {
      if (!F.url()) { T.tostada("Primero guarda la dirección del Worker"); return; }
      const listo = ocupado(e.currentTarget, "Calculando…");
      try {
        const a = await F.listar("");
        const total = a.reduce((s, x) => s + x.tamano, 0);
        const porCarpeta = {};
        a.forEach((x) => { const k = x.clave.split("/")[0]; porCarpeta[k] = (porCarpeta[k] || 0) + x.tamano; });
        $("#aj-archivos").innerHTML = '<p class="ayuda"><b>' + a.length + " archivos · " + mb(total) + "</b> de 10 GB gratis (" + ((total / (10 * 1024 ** 3)) * 100).toFixed(2) + "%)<br>" + Object.entries(porCarpeta).map(([k, v]) => k + ": " + mb(v)).join(" · ") + "</p>";
      } catch (ex) { falla(ex); } finally { listo(); }
    };
    $("#aj-huerfanas").onclick = async (e) => {
      if (!F.url()) { T.tostada("Primero guarda la dirección del Worker"); return; }
      const listo = ocupado(e.currentTarget, "Buscando…");
      try {
        E.productos = await D.productos();
        const usadas = new Set();
        E.productos.forEach((p) => T.fotos(p).forEach((f) => usadas.add(f.url)));
        const cf = E.cfg;
        // Toda dirección que aparezca en los ajustes (logo, portada, banda, colecciones, reseñas, fotos de páginas, galería…) está en uso
        const recorrer = (v) => { if (typeof v === "string") { if (/^https?:\/\//.test(v)) usadas.add(v); } else if (v && typeof v === "object") Object.values(v).forEach(recorrer); };
        recorrer(cf);
        E.pedidos.forEach((p) => p.pdf_url && usadas.add(p.pdf_url));
        const todos = await F.listar("");
        const hace1h = Date.now() - 3600e3;
        const sobran = todos.filter((x) => !usadas.has(x.url) && new Date(x.subido).getTime() < hace1h);
        if (!sobran.length) { $("#aj-archivos").innerHTML = '<p class="ayuda">✓ No hay archivos sin usar.</p>'; return; }
        $("#aj-archivos").innerHTML = '<p class="ayuda">' + sobran.length + " archivo(s) sin usar (" + mb(sobran.reduce((s, x) => s + x.tamano, 0)) + "). Revisa y borra los que no necesites:</p>" +
          '<div class="archivos-lista">' + sobran.map((x) => '<label><input type="checkbox" checked value="' + esc(x.url) + '">' + (/\.(webp|jpe?g|png|gif|avif)$/i.test(x.clave) ? '<img src="' + esc(x.url) + '" loading="lazy" alt="">' : "") + esc(x.clave.split("/").pop()) + "</label>").join("") + "</div>" +
          '<button type="button" class="boton peligro pequeno" id="aj-borrar-huerfanas" style="margin-top:10px">Borrar seleccionados</button>';
        $("#aj-borrar-huerfanas").onclick = async () => {
          const urls = $$("#aj-archivos input:checked").map((x) => x.value);
          if (!urls.length || !(await confirmar("Borrar archivos", "¿Borrar " + urls.length + " archivo(s) de Cloudflare?", "Borrar", true))) return;
          await F.borrar(urls);
          $("#aj-archivos").innerHTML = '<p class="ayuda">✓ Borrados ' + urls.length + " archivo(s).</p>";
        };
      } catch (ex) { falla(ex); } finally { listo(); }
    };
    $("#aj-guardar").onclick = async (e) => {
      const v = leerForm($("#f-aj"));
      if (v.workerUrl && !/^https:\/\//.test(v.workerUrl.trim())) { T.tostada("La dirección del Worker debe empezar con https://"); return; }
      const listo = ocupado(e.currentTarget);
      try {
        const actual = await D.config();
        const tasa = num(v.tasaBCV) || 0;
        const nuevo = Object.assign({}, actual, {
          nombreTienda: v.nombreTienda.trim() || "Mi tienda", eslogan: v.eslogan.trim(), logo,
          whatsapp: v.whatsapp.trim(), telefono: v.telefono.trim(), instagram: v.instagram.trim().replace(/^@/, ""), tiktok: v.tiktok.trim().replace(/^@/, ""),
          correo: v.correo.trim(), horario: v.horario.trim(), direccion: v.direccion.trim(), mapa: v.mapa.trim(),
          tasaBCV: tasa, tasaFecha: tasa !== Number(actual.tasaBCV) ? new Date().toISOString().slice(0, 10) : actual.tasaFecha || "",
          minimoMayor: Math.max(1, ent(v.minimoMayor) || 1), pocasUnidades: ent(v.pocasUnidades), notaEncargo: v.notaEncargo.trim(),
          brecha: Math.max(0, num(v.brecha) || 0), precioBsAutomatico: !!v.precioBsAutomatico, ventaMayor: !!v.ventaMayor,
          metodosPago: metodos.filter((m) => m.nombre.trim()).map((m) => ({ nombre: m.nombre.trim(), moneda: m.moneda, detalle: (m.detalle || "").trim(), activo: !!m.activo })),
          datosPago: v.datosPago.trim(), agencias: v.agencias.trim(), ubicacion: v.ubicacion.trim(),
          workerUrl: v.workerUrl.trim().replace(/\/+$/, ""), diasPedidos: Math.max(1, ent(v.diasPedidos) || 30),
        });
        await D.guardarConfig(nuevo);
        E.cfg = T.unirAjustes(nuevo);
        T.pintarComun(E.cfg); pintarTasa(); avisos();
        T.tostada("Ajustes guardados");
      } catch (ex) { falla(ex); } finally { listo(); }
    };
    $("#aj-cambiar-clave").onclick = async (e) => {
      const v = $("#aj-clave").value;
      if (v.length < 8) { T.tostada("Usa al menos 8 caracteres"); return; }
      const listo = ocupado(e.currentTarget);
      try { await D.cambiarClave(v); $("#aj-clave").value = ""; T.tostada("Contraseña cambiada"); } catch (ex) { falla(ex); } finally { listo(); }
    };
  }
  const mb = (b) => (b / 1024 / 1024).toFixed(b > 1024 * 1024 * 100 ? 0 : 2) + " MB";

  iniciar();
})();
