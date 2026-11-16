# Problemas frecuentes

| Lo que pasa | Por qué | Solución |
|---|---|---|
| La tienda muestra la franja naranja **"Modo demostración"** | `js/conexion.js` no está lleno o tiene un error | Revisa el Paso 2.6: URL que termina en `.supabase.co` y clave pública. Vuelve a subir la carpeta a Netlify |
| "No pudimos cargar el catálogo" | No se ejecutó el SQL, o el proyecto de Supabase está pausado | Ejecuta `01_tablas_y_seguridad.sql`. Si Supabase dice *Paused*, toca **Restore project** |
| Al entrar al almacén: **"Este correo no es el administrador"** | El correo del archivo 2 no coincide con el usuario | Ejecuta de nuevo `02_correo_administrador.sql` con el correo exacto del usuario de Authentication |
| "Correo o contraseña incorrectos" | Contraseña equivocada o usuario sin confirmar | En Supabase › Authentication › Users revisa el usuario (debe estar confirmado). Usa "¿Olvidaste tu contraseña?" |
| El correo de recuperar contraseña lleva a una página que no abre | Falta la dirección en Supabase | Paso 2.5: Site URL y Redirect URLs con `/admin.html` |
| Al subir fotos: **"Primero pega la dirección del Worker"** | Falta en Ajustes | Almacén › Ajustes › Fotos → pega la dirección → Guardar |
| Al subir fotos: **"Este correo no es administrador"** o **"La sesión venció"** | El Worker no reconoce la sesión | Sal y vuelve a entrar. Revisa que `SUPABASE_URL` y `SUPABASE_KEY` del Worker sean del mismo proyecto |
| Al subir fotos: **"Falta conectar el bucket R2…"** | El binding no se llama `BUCKET` | Paso 3.3 |
| **Probar conexión** dice que no responde | Dirección mal copiada o el código del Worker no se desplegó | Copia la dirección completa `https://….workers.dev` y repite 3.2 (pegar el código y **Deploy**) |
| El pedido llega por WhatsApp **sin enlace al PDF** | El Worker no está configurado o `ORIGENES` no incluye la dirección de la tienda | Revisa Ajustes › Fotos y la variable `ORIGENES` (Paso 3.4). El pedido igual queda guardado en el almacén |
| El botón **Enviar pedido por WhatsApp** no aparece | Falta el WhatsApp de la tienda | Almacén › Ajustes › Contacto |
| No aparecen los precios en Bs | Falta la tasa, o el producto no tiene precio "a tasa BCV" | Pon la tasa (botón **Tasa BCV ✎**) y llena los precios BCV del producto |
| Una categoría no aparece en la tienda | No tiene productos visibles | Asigna productos a esa categoría |
| Los cambios de la página (diseño) no se ven | El navegador guardó la versión vieja | Recarga con Ctrl+F5 (o cierra y abre la pestaña en el celular) |
| Se ven fotos viejas después de cambiarlas | — | Las fotos nuevas tienen otro nombre, así que se ven al instante. Si borraste una foto, puede tardar unos minutos en desaparecer de la caché |

## Copia de seguridad
- **Inventario:** descarga el Excel de vez en cuando (Almacén › Productos › Excel).
- **Base de datos completa:** Supabase › **Database** › **Backups** (el plan gratis guarda copias diarias por unos días), o Table Editor › cada tabla › **Export to CSV**.
