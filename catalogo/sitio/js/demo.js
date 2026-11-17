/* Datos de ejemplo para el MODO DEMOSTRACIÓN (cuando conexion.js no está lleno).
   No se usan cuando la tienda está conectada a Supabase. */
(function () {
  const H = { Negro: "#1d1b1c", Grafito: "#5a5a5c", Plata: "#a8a6a7", Blanco: "#f2f1ef", Azul: "#053359", Nogal: "#6e4a2e", Roble: "#c49a6c", Rosa: "#e3c4bd" };
  const ARCHIVO = { Negro: "negro", Grafito: "grafito", Plata: "plata", Blanco: "blanco", Azul: "marino", Nogal: "nogal", Roble: "roble", Rosa: "rosa" };
  const img = (base, color) => ({ url: "img/demo/" + base + "-" + ARCHIVO[color] + ".svg", color: color, tipo: "foto" });
  let id = 100;
  const p = (o) => {
    const colores = (o.colores || []).map((c) => ({ nombre: c, hex: H[c] || "#999999" }));
    const stock_color = o.stock_color || {};
    const stock = Object.keys(stock_color).length ? Object.values(stock_color).reduce((a, b) => a + b, 0) : (o.stock || 0);
    return Object.assign({
      id: id--, marca: "ARKEO", codigo: "", descripcion: "", divisa_detal: null, divisa_mayor: null, bcv_detal: null, bcv_mayor: null,
      precio_antes: null, disponible: true, encargo: false, destacado: false, nuevo: false, colecciones: [], orden: 0,
      material: "", alto: "", ancho: "", fondo: "",
    }, o, { colores, stock_color, stock, fotos: (o.colores || []).map((c) => img(o.base, c)) });
  };
  window.DEMO = {
    config: {
      nombreTienda: "ARKEO",
      eslogan: "Home & Office · Mobiliario de oficina y hogar",
      logo: "img/logo-arkeo-blanco.png",
      whatsapp: "04125074777",
      instagram: "mobiliariodeoficina",
      correo: "",
      telefono: "0424-4343284 · 0412-5074777",
      direccion: "Showroom en San Diego, edo. Carabobo",
      horario: "Lunes a sábado, 9:00 a. m. a 6:00 p. m.",
      tasaBCV: 45.5,
      tasaFecha: new Date().toISOString().slice(0, 10),
      minimoMayor: 6,
      pocasUnidades: 3,
      diasPedidos: 30,
      workerUrl: "",
      categorias: [
        { nombre: "Sillas presidenciales", icono: "presidencial" },
        { nombre: "Sillas ejecutivas", icono: "silla-oficina" },
        { nombre: "Sillas de visitante", icono: "visitante" },
        { nombre: "Escritorios", icono: "escritorio" },
        { nombre: "Mesas de reunión", icono: "mesa" },
        { nombre: "Archivadores", icono: "almacenaje" },
        { nombre: "Comedor", icono: "comedor" },
        { nombre: "Espejos", icono: "espejo" },
        { nombre: "Vanity", icono: "tocador" },
      ],
      portada: { titulo: "", subtitulo: "Sillas presidenciales, ejecutivas y de visitante, escritorios, comedores, espejos y vanity. Al mayor y al detal, con envíos a toda Venezuela.", boton: "Ver catálogo", imagen: "" },
      colecciones: [
        { nombre: "Oficina ejecutiva", descripcion: "Presidenciales, escritorios y reunión", imagen: "img/demo/escritorio-nogal.svg" },
        { nombre: "Hogar", descripcion: "Comedores, espejos y vanity", imagen: "img/demo/vanity-blanco.svg" },
      ],
      resenas: [
        { nombre: "Grupo Andino C.A.", ciudad: "Valencia", estrellas: 5, texto: "Equipamos toda la gerencia con ARKEO. Calidad impecable y entrega a tiempo." },
        { nombre: "Andrea M.", ciudad: "Caracas", estrellas: 5, texto: "El vanity llegó perfecto y muy bien embalado. Excelente atención." },
        { nombre: "Despacho Legal R&R", ciudad: "Maracay", estrellas: 5, texto: "Las sillas de visitante y las ejecutivas son muy cómodas. Repetiremos." },
      ],
      paginas: {},
      datosPago: "",
      agencias: "MRW, Zoom, Tealca",
      notaEncargo: "Producto por encargo: entrega de 10 a 15 días hábiles.",
    },
    proveedores: [{ id: 1, nombre: "Proveedor de ejemplo C.A.", telefono: "0212-000-0000", contacto: "Carlos", correo: "", direccion: "", notas: "" }],
    productos: [
      p({ nombre: "Silla Presidencial Imperium", codigo: "PR-900", categoria: "Sillas presidenciales", base: "presidencial", colores: ["Negro", "Azul", "Grafito"], stock_color: { Negro: 8, Azul: 3, Grafito: 0 }, divisa_detal: 390, divisa_mayor: 335, bcv_detal: 430, bcv_mayor: 370, destacado: true, nuevo: true, colecciones: ["Oficina ejecutiva"], material: "Cuero sintético premium, base de aluminio pulido", alto: "125-135 cm", ancho: "68 cm", fondo: "72 cm", descripcion: "Espaldar alto capitoné, mecanismo basculante con bloqueo, apoyabrazos acolchados y base de aluminio.", orden: 1 }),
      p({ nombre: "Silla Ejecutiva Vértice", codigo: "EJ-520", categoria: "Sillas ejecutivas", base: "ejecutiva", colores: ["Negro", "Grafito", "Azul"], stock_color: { Negro: 15, Grafito: 6, Azul: 2 }, divisa_detal: 185, divisa_mayor: 150, bcv_detal: 205, bcv_mayor: 165, destacado: true, colecciones: ["Oficina ejecutiva"], material: "Malla y tela, base de nylon", alto: "110-120 cm", descripcion: "Soporte lumbar ajustable, altura regulable y apoyabrazos 2D. Ideal para jornadas largas.", orden: 2 }),
      p({ nombre: "Silla de Visitante Cantilever", codigo: "VI-210", destacado: true, categoria: "Sillas de visitante", base: "visitante", colores: ["Negro", "Grafito"], stock_color: { Negro: 24, Grafito: 12 }, divisa_detal: 78, divisa_mayor: 60, bcv_detal: 86, bcv_mayor: 66, material: "Estructura cromada, tapizado en cuero sintético", alto: "86 cm", descripcion: "Silla tipo trineo con apoyabrazos, perfecta para salas de espera y despachos.", orden: 3 }),
      p({ nombre: "Escritorio Ejecutivo Atlas 160", codigo: "ES-160", destacado: true, categoria: "Escritorios", base: "escritorio", colores: ["Nogal", "Roble", "Blanco"], stock_color: { Nogal: 5, Roble: 3, Blanco: 2 }, divisa_detal: 420, divisa_mayor: 365, bcv_detal: 465, bcv_mayor: 400, precio_antes: 480, colecciones: ["Oficina ejecutiva"], material: "MDP 25 mm, patas de acero", alto: "75 cm", ancho: "160 cm", fondo: "75 cm", descripcion: "Escritorio con cajonera de dos gavetas con cerradura y pasacables.", orden: 4 }),
      p({ nombre: "Mesa de Reunión Consejo", codigo: "MR-240", categoria: "Mesas de reunión", base: "reunion", colores: ["Nogal", "Blanco"], stock_color: { Nogal: 2, Blanco: 1 }, divisa_detal: 690, divisa_mayor: 610, bcv_detal: 760, bcv_mayor: 670, colecciones: ["Oficina ejecutiva"], material: "Melamina de alta resistencia, base metálica", alto: "75 cm", ancho: "240 cm", fondo: "110 cm", descripcion: "Mesa para 8 personas con pasacables central.", orden: 5 }),
      p({ nombre: "Archivador Vertical 3 Gavetas", codigo: "AR-030", categoria: "Archivadores", base: "archivador", colores: ["Grafito", "Blanco"], stock_color: { Grafito: 0, Blanco: 0 }, divisa_detal: 210, divisa_mayor: 180, bcv_detal: 230, bcv_mayor: 198, material: "Metal con pintura electrostática", alto: "102 cm", descripcion: "Gavetas de extensión completa para carpetas colgantes, con cerradura.", orden: 6 }),
      p({ nombre: "Juego de Comedor Nórdico", codigo: "CO-604", destacado: true, categoria: "Comedor", base: "comedor", colores: ["Roble", "Nogal"], encargo: true, divisa_detal: 780, divisa_mayor: 690, bcv_detal: 860, bcv_mayor: 760, nuevo: true, colecciones: ["Hogar"], material: "Madera maciza y tapizado", ancho: "160 cm", descripcion: "Mesa de 160 cm con 6 sillas tapizadas. Se fabrica por encargo.", orden: 7 }),
      p({ nombre: "Espejo Arco Minimal", codigo: "EP-180", destacado: true, categoria: "Espejos", base: "espejo", colores: ["Negro", "Roble"], stock_color: { Negro: 6, Roble: 2 }, divisa_detal: 140, divisa_mayor: 115, bcv_detal: 155, bcv_mayor: 126, colecciones: ["Hogar"], material: "Marco metálico, cristal 5 mm", alto: "180 cm", ancho: "80 cm", descripcion: "Espejo de cuerpo entero con marco fino en arco.", orden: 8 }),
      p({ nombre: "Vanity Hollywood con Luces", codigo: "VN-120", categoria: "Vanity", base: "vanity", colores: ["Blanco", "Rosa"], stock_color: { Blanco: 4, Rosa: 1 }, divisa_detal: 360, divisa_mayor: 310, bcv_detal: 395, bcv_mayor: 340, destacado: true, colecciones: ["Hogar"], material: "MDF lacado, espejo con 11 bombillos LED", alto: "140 cm", ancho: "120 cm", fondo: "45 cm", descripcion: "Tocador con espejo iluminado de intensidad regulable y cuatro gavetas.", orden: 9 }),
      p({ nombre: "Silla Presidencial Dominus", codigo: "PR-950", categoria: "Sillas presidenciales", base: "presidencial", colores: ["Negro"], stock_color: { Negro: 2 }, divisa_detal: 450, divisa_mayor: 395, bcv_detal: 495, bcv_mayor: 435, precio_antes: 520, material: "Cuero, base cromada", alto: "128-138 cm", descripcion: "Espaldar extra alto con reposacabezas integrado y mecanismo sincronizado.", orden: 10 }),
    ],
  };
})();
