/* Datos de ejemplo para el MODO DEMOSTRACIÓN (cuando conexion.js no está lleno).
   No se usan cuando la tienda está conectada a Supabase. */
(function () {
  const H = { Negro: "#2a2a2a", Gris: "#8e8e8e", Azul: "#8fb3c9", Terracota: "#b5652b", Beige: "#d9cbb5", Verde: "#6f7d5c", Nogal: "#7a4e2d", Roble: "#c49a6c", Blanco: "#efede8", Mostaza: "#c9a227" };
  const img = (base, color) => ({ url: "img/demo/" + base + "-" + color.toLowerCase() + ".svg", color: color, tipo: "foto" });
  let id = 100;
  const p = (o) => {
    const colores = (o.colores || []).map((c) => ({ nombre: c, hex: H[c] || "#999999" }));
    const stock_color = o.stock_color || {};
    const stock = Object.keys(stock_color).length ? Object.values(stock_color).reduce((a, b) => a + b, 0) : (o.stock || 0);
    return Object.assign({
      id: id--, marca: "", codigo: "", descripcion: "", divisa_detal: null, divisa_mayor: null, bcv_detal: null, bcv_mayor: null,
      precio_antes: null, disponible: true, encargo: false, destacado: false, nuevo: false, colecciones: [], orden: 0,
      material: "", alto: "", ancho: "", fondo: "",
    }, o, { colores, stock_color, stock, fotos: (o.colores || []).map((c) => img(o.base, c)) });
  };
  window.DEMO = {
    config: {
      nombreTienda: "Mobiliario",
      eslogan: "Muebles para tu casa y tu oficina",
      whatsapp: "04141234567",
      instagram: "mobiliario.ve",
      correo: "ventas@ejemplo.com",
      telefono: "0414-123-4567",
      direccion: "Av. Principal, Caracas, Venezuela",
      horario: "Lunes a sábado, 9:00 a. m. a 6:00 p. m.",
      tasaBCV: 45.5,
      tasaFecha: new Date().toISOString().slice(0, 10),
      minimoMayor: 6,
      pocasUnidades: 3,
      diasPedidos: 30,
      workerUrl: "",
      categorias: [
        { nombre: "Sillas de oficina", icono: "silla-oficina" },
        { nombre: "Escritorios", icono: "escritorio" },
        { nombre: "Sillas", icono: "silla" },
        { nombre: "Butacas", icono: "butaca" },
        { nombre: "Sofás", icono: "sofa" },
        { nombre: "Mesas", icono: "mesa" },
        { nombre: "Camas", icono: "cama" },
        { nombre: "Almacenaje", icono: "almacenaje" },
        { nombre: "Iluminación", icono: "lampara" },
      ],
      portada: { titulo: "", subtitulo: "Muebles para tu casa y tu oficina. Ventas al mayor y al detal con envíos a toda Venezuela.", boton: "Ver catálogo", imagen: "img/demo/butaca-azul.svg" },
      colecciones: [
        { nombre: "Oficina en casa", descripcion: "Escritorios y sillas ergonómicas", imagen: "img/demo/escritorio-roble.svg" },
        { nombre: "Sala", descripcion: "Sofás, butacas y mesas", imagen: "img/demo/sofa-beige.svg" },
      ],
      resenas: [
        { nombre: "María G.", ciudad: "Valencia", estrellas: 5, texto: "La silla llegó perfecta y muy bien embalada. Atención excelente." },
        { nombre: "Distribuidora Andes", ciudad: "Mérida", estrellas: 5, texto: "Compramos al mayor para una oficina completa. Cumplieron con los tiempos." },
        { nombre: "José R.", ciudad: "Caracas", estrellas: 4, texto: "Muy buena calidad. El sofá es tal cual las fotos." },
      ],
      paginas: {},
      datosPago: "",
      agencias: "MRW, Zoom, Tealca",
      notaEncargo: "Producto por encargo: entrega de 10 a 15 días hábiles.",
    },
    proveedores: [{ id: 1, nombre: "Fábrica Ejemplo C.A.", telefono: "0212-000-0000", contacto: "Carlos", correo: "", direccion: "", notas: "" }],
    productos: [
      p({ nombre: "Silla Ergo Pro", marca: "Ofimax", codigo: "SO-101", categoria: "Sillas de oficina", base: "silla-oficina", colores: ["Negro", "Gris", "Azul"], stock_color: { Negro: 14, Gris: 3, Azul: 0 }, divisa_detal: 145, divisa_mayor: 118, bcv_detal: 160, bcv_mayor: 130, destacado: true, nuevo: true, colecciones: ["Oficina en casa"], material: "Malla, base de nylon", alto: "110-120 cm", ancho: "62 cm", fondo: "60 cm", descripcion: "Silla ergonómica con soporte lumbar, altura regulable y apoyabrazos 2D. Ideal para jornadas largas.", orden: 1 }),
      p({ nombre: "Butaca Nórdica", marca: "Casa Viva", codigo: "BU-220", categoria: "Butacas", base: "butaca", colores: ["Azul", "Terracota", "Beige"], stock_color: { Azul: 4, Terracota: 2, Beige: 6 }, divisa_detal: 230, divisa_mayor: 195, bcv_detal: 255, bcv_mayor: 215, precio_antes: 270, destacado: true, colecciones: ["Sala"], material: "Madera de saqui saqui, tela antimanchas", alto: "82 cm", ancho: "70 cm", fondo: "76 cm", descripcion: "Butaca de estilo mid-century con estructura de madera maciza y cojines removibles.", orden: 2 }),
      p({ nombre: "Sofá Lino 3 puestos", marca: "Casa Viva", codigo: "SF-300", categoria: "Sofás", base: "sofa", colores: ["Beige", "Verde", "Gris"], stock_color: { Beige: 2, Verde: 1, Gris: 0 }, divisa_detal: 620, divisa_mayor: 540, bcv_detal: 690, bcv_mayor: 600, nuevo: true, colecciones: ["Sala"], material: "Lino, espuma alta densidad", alto: "85 cm", ancho: "210 cm", fondo: "90 cm", descripcion: "Sofá de tres puestos con cojines de alta densidad y tela tipo lino.", orden: 3 }),
      p({ nombre: "Escritorio Lineal 120", marca: "Ofimax", codigo: "ES-120", categoria: "Escritorios", base: "escritorio", colores: ["Nogal", "Roble", "Blanco"], stock_color: { Nogal: 8, Roble: 5, Blanco: 7 }, divisa_detal: 180, divisa_mayor: 150, bcv_detal: 199, bcv_mayor: 165, colecciones: ["Oficina en casa"], material: "MDP 18 mm, patas de acero", alto: "75 cm", ancho: "120 cm", fondo: "60 cm", descripcion: "Escritorio con cajonera de dos gavetas y pasacables.", orden: 4 }),
      p({ nombre: "Mesa de centro Luna", marca: "Casa Viva", codigo: "MC-045", categoria: "Mesas", base: "mesa", colores: ["Nogal", "Roble"], stock_color: { Nogal: 3, Roble: 9 }, divisa_detal: 95, divisa_mayor: 78, bcv_detal: 105, bcv_mayor: 86, colecciones: ["Sala"], material: "Madera y base metálica dorada", alto: "45 cm", ancho: "80 cm", descripcion: "Mesa redonda de centro con base de cuatro patas.", orden: 5 }),
      p({ nombre: "Silla Concha", marca: "Diseño", codigo: "SL-010", categoria: "Sillas", base: "silla", colores: ["Terracota", "Blanco", "Negro", "Mostaza"], stock_color: { Terracota: 20, Blanco: 18, Negro: 2, Mostaza: 12 }, divisa_detal: 48, divisa_mayor: 36, bcv_detal: 54, bcv_mayor: 40, destacado: true, material: "Polipropileno y madera de haya", alto: "82 cm", descripcion: "Silla de comedor con asiento envolvente. Ideal para comedores y cafés.", orden: 6 }),
      p({ nombre: "Lámpara de pie Arco", marca: "Luz", codigo: "LA-077", categoria: "Iluminación", base: "lampara", colores: ["Beige", "Negro"], stock_color: { Beige: 5, Negro: 0 }, divisa_detal: 75, divisa_mayor: 60, bcv_detal: 82, bcv_mayor: 66, material: "Metal y pantalla de tela", alto: "160 cm", descripcion: "Lámpara de pie con pantalla de tela y luz cálida. Bombillo no incluido.", orden: 7 }),
      p({ nombre: "Biblioteca Abierta", marca: "Ofimax", codigo: "AL-330", categoria: "Almacenaje", base: "estante", colores: ["Roble", "Nogal"], stock_color: { Roble: 0, Nogal: 0 }, divisa_detal: 210, divisa_mayor: 175, bcv_detal: 230, bcv_mayor: 190, material: "MDP 18 mm", alto: "180 cm", ancho: "90 cm", fondo: "35 cm", descripcion: "Biblioteca de tres niveles con repisas reforzadas.", orden: 8 }),
      p({ nombre: "Cama Tapizada Queen", marca: "Descanso", codigo: "CA-160", categoria: "Camas", base: "cama", colores: ["Gris", "Beige"], encargo: true, divisa_detal: 540, divisa_mayor: 480, bcv_detal: 600, bcv_mayor: 530, material: "Madera y tela", ancho: "160 cm", fondo: "200 cm", descripcion: "Cama tapizada con cabecero acolchado. Se fabrica por encargo en el color que prefieras.", orden: 9 }),
      p({ nombre: "Silla Ejecutiva Alta", marca: "Ofimax", codigo: "SO-140", categoria: "Sillas de oficina", base: "silla-oficina", colores: ["Negro"], stock_color: { Negro: 6 }, divisa_detal: 210, divisa_mayor: 175, bcv_detal: 232, bcv_mayor: 192, precio_antes: 240, material: "Semicuero, base cromada", alto: "118-128 cm", descripcion: "Silla gerencial de espaldar alto con mecanismo reclinable.", orden: 10 }),
    ],
  };
})();
