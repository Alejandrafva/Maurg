-- =====================================================================
--  MOBILIARIO DE OFICINA · Catálogo · Archivo 2 de 2: correo del administrador
--
--  1) Cambia  admin@ejemplo.com  por el correo REAL del administrador
--     (el mismo con el que lo creas en Authentication > Users).
--  2) Run.
--
--  Solo ese correo puede crear, editar o borrar productos, ajustes,
--  pedidos y proveedores, y subir o borrar fotos en Cloudflare.
--  Se puede ejecutar varias veces (por ejemplo, para cambiar el correo).
-- =====================================================================

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower(trim('admin@ejemplo.com'));
$$;

grant execute on function public.es_admin() to anon, authenticated;

-- Comprobación: debe mostrar el correo que escribiste arriba.
select 'Administrador configurado' as listo,
       substring(pg_get_functiondef('public.es_admin()'::regprocedure) from '''([^'']+@[^'']+)''') as correo;
