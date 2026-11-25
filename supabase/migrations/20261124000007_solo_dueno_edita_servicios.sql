-- Solo el dueño puede crear, cambiar o borrar servicios del catálogo, y borrar catálogos.
-- Antes la pantalla lo impedía, pero la base de datos solo protegía la tabla catalogos.
create policy "solo dueno crea servicios" on public.servicios as restrictive for insert to authenticated
  with check (exists (select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
    and m.negocio_id = servicios.negocio_id and m.rol = 'dueno'));
create policy "solo dueno cambia servicios" on public.servicios as restrictive for update to authenticated
  using (exists (select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
    and m.negocio_id = servicios.negocio_id and m.rol = 'dueno'));
create policy "solo dueno borra servicios" on public.servicios as restrictive for delete to authenticated
  using (exists (select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
    and m.negocio_id = servicios.negocio_id and m.rol = 'dueno'));
create policy "solo dueno borra catalogos" on public.catalogos as restrictive for delete to authenticated
  using (exists (select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
    and m.negocio_id = catalogos.negocio_id and m.rol = 'dueno'));
