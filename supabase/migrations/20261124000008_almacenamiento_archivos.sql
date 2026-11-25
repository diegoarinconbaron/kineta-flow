-- Almacenamiento de archivos: el Excel o CSV original de cada catálogo y el PDF de cada cotización.
-- Bucket privado; cada negocio solo accede a su carpeta (la primera parte de la ruta es su id).
--   <negocio_id>/catalogos/<catalogo_id>/<archivo>
--   <negocio_id>/cotizaciones/<numero>.pdf

alter table public.catalogos add column if not exists archivo_ruta text;
alter table public.cotizaciones add column if not exists pdf_ruta text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archivos', 'archivos', false, 10485760, array[
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream'
])
on conflict (id) do nothing;

create policy "miembros leen archivos de su negocio" on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] in (select mis_negocios()::text));

create policy "miembros suben archivos de su negocio" on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and (storage.foldername(name))[1] in (select mis_negocios()::text));

-- solo el dueño sube el archivo de un catálogo; las cotizaciones las genera cualquier miembro
create policy "solo dueno sube catalogos" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'archivos' or (storage.foldername(name))[2] <> 'catalogos' or exists (
    select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
      and m.negocio_id::text = (storage.foldername(name))[1] and m.rol = 'dueno'));
