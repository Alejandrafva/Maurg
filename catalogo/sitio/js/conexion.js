/* =====================================================================
   CONEXIÓN CON SUPABASE  —  el único archivo que debes editar.

   Dónde están los datos: Supabase > tu proyecto > Project Settings > API Keys
   (o el botón "Connect" arriba).

   1) SUPABASE_URL: la "Project URL", por ejemplo https://abcdxyz.supabase.co
   2) SUPABASE_KEY: la clave PÚBLICA:
        - "Publishable key" (empieza con  sb_publishable_ ), o
        - la "anon public" (en Legacy API keys, empieza con  eyJ ).
      ⚠️ NUNCA pegues aquí la "secret" ni la "service_role".

   Mientras esto no esté lleno, la página funciona en MODO DEMOSTRACIÓN
   (productos de ejemplo guardados solo en tu navegador).
   ===================================================================== */
window.CONEXION = {
  SUPABASE_URL: "https://sgtqpermnrazxbatcyix.supabase.co",
  SUPABASE_KEY: "sb_publishable_Ipyxf2FDO55xQ5ZX7vGCTg_JdAcA3uO",

  // Opcional: dirección del Worker de Cloudflare. Es mejor ponerla en
  // el almacén (Ajustes > Fotos), pero si la pones aquí también funciona.
  WORKER_URL: "",
};
