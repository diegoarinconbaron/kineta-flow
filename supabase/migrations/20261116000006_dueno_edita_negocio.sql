-- La configuración guiada deja al dueño corregir los datos básicos de su negocio.
-- Solo esas columnas: el plan y el identificador no se pueden cambiar desde la app.
create policy "dueno edita su negocio" on public.negocios for update
  using (exists (select 1 from miembros_negocio m where m.usuario_id = auth.uid() and m.negocio_id = negocios.id and m.rol = 'dueno'))
  with check (exists (select 1 from miembros_negocio m where m.usuario_id = auth.uid() and m.negocio_id = negocios.id and m.rol = 'dueno'));

revoke update on public.negocios from authenticated, anon;
grant update (nombre, sector, ciudad, telefono_whatsapp) on public.negocios to authenticated;
