-- Kineta Flow · Esquema principal
-- 12 tablas, tipos enumerados, índices y seguridad a nivel de fila (RLS)

create extension if not exists pgcrypto;

-- Tipos -----------------------------------------------------------------
create type rol_miembro as enum ('dueno', 'asesor');
create type estado_catalogo as enum ('borrador', 'activo', 'archivado');
create type estado_servicio as enum ('listo', 'sin_tarifa', 'revisar');
create type estado_lead as enum ('nuevo', 'cotizado', 'listo_para_comprar', 'sin_respuesta', 'cerrado');
create type atendido_por as enum ('ia', 'asesor');
create type emisor_mensaje as enum ('cliente', 'ia', 'asesor', 'sistema');

-- 1. negocios -------------------------------------------------------------
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sector text not null,
  ciudad text not null,
  plan text not null default 'pyme',
  telefono_whatsapp text,
  creado_en timestamptz not null default now()
);

-- 2. miembros_negocio --------------------------------------------------------
create table public.miembros_negocio (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  rol rol_miembro not null default 'asesor',
  creado_en timestamptz not null default now(),
  unique (negocio_id, usuario_id)
);

-- 3. configuracion_asistente ---------------------------------------------
create table public.configuracion_asistente (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  activo boolean not null default true,
  nombre_asistente text not null default 'Asistente',
  tono text not null default 'cercano',
  -- {"1":["08:00","18:00"], ... "6":["08:00","13:00"]}  (1 = lunes ... 7 = domingo)
  horario_laboral jsonb not null default '{"1":["08:00","18:00"],"2":["08:00","18:00"],"3":["08:00","18:00"],"4":["08:00","18:00"],"5":["08:00","18:00"],"6":["08:00","13:00"]}',
  -- palabras que obligan a pasar la conversación a una persona
  reglas_traspaso text[] not null default array['beca','hermanos','cuotas','financiación','financiacion','descuento especial'],
  -- descuento por paquete: aplica cuando la cantidad >= minimo
  descuento_paquete jsonb not null default '{"minimo": 10, "porcentaje": 10}',
  vigencia_cotizacion_dias int not null default 15,
  actualizado_en timestamptz not null default now()
);

-- 4. catalogos ------------------------------------------------------------
create table public.catalogos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  archivo_origen text not null,
  version int not null default 1,
  estado estado_catalogo not null default 'borrador',
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  activado_en timestamptz
);
-- un solo catálogo activo por negocio
create unique index un_catalogo_activo on public.catalogos(negocio_id) where estado = 'activo';

-- 5. servicios ------------------------------------------------------------
create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  catalogo_id uuid not null references public.catalogos(id) on delete cascade,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  categoria text,
  nivel text,
  unidad text not null default 'unidad',
  tarifa numeric(14,2),
  estado estado_servicio not null default 'listo',
  observacion text,
  palabras_clave text,
  -- un servicio sin tarifa nunca puede quedar como "listo"
  constraint servicio_listo_con_tarifa check (estado <> 'listo' or tarifa is not null)
);
create index on public.servicios(catalogo_id);

-- 6. clientes -------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  telefono text not null,
  municipio text,
  datos_contexto jsonb not null default '{}',
  creado_en timestamptz not null default now(),
  unique (negocio_id, telefono)
);

-- 7. conversaciones -----------------------------------------------------------
create table public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estado_lead estado_lead not null default 'nuevo',
  atendida_por atendido_por not null default 'ia',
  asesor_id uuid references public.miembros_negocio(id),
  requiere_asesor boolean not null default false,
  fuera_de_horario boolean not null default false,
  necesidad text,
  valor_potencial numeric(14,2),
  iniciada_en timestamptz not null default now(),
  ultimo_mensaje_en timestamptz not null default now()
);
create index on public.conversaciones(negocio_id, iniciada_en desc);
create index on public.conversaciones(negocio_id, estado_lead);

-- 8. mensajes -------------------------------------------------------------
create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  emisor emisor_mensaje not null,
  contenido text not null,
  adjunto jsonb,            -- {"tipo":"cotizacion","cotizacion_id":"..."} o botones
  creado_en timestamptz not null default now()
);
create index on public.mensajes(conversacion_id, creado_en);

-- 9. cotizaciones ---------------------------------------------------------
create sequence public.cotizacion_consecutivo start 418;
create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  catalogo_id uuid not null references public.catalogos(id),
  numero text not null unique default ('COT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.cotizacion_consecutivo')::text, 4, '0')),
  subtotal numeric(14,2) not null,
  descuento numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  valida_hasta date not null,
  creada_en timestamptz not null default now()
);

-- 10. items_cotizacion ----------------------------------------------------
create table public.items_cotizacion (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  servicio_id uuid not null references public.servicios(id),
  descripcion text not null,
  cantidad numeric(10,2) not null check (cantidad > 0),
  valor_unitario numeric(14,2) not null,
  valor_total numeric(14,2) not null
);

-- La base de datos impide cotizar un servicio sin tarifa o de un catálogo no activo
create or replace function public.validar_item_cotizacion() returns trigger
language plpgsql as $$
declare s record;
begin
  select sv.tarifa, sv.estado, c.estado as estado_catalogo
    into s
    from public.servicios sv join public.catalogos c on c.id = sv.catalogo_id
   where sv.id = new.servicio_id;
  if s.tarifa is null or s.estado <> 'listo' then
    raise exception 'El servicio no tiene una tarifa validada y no se puede cotizar';
  end if;
  if s.estado_catalogo <> 'activo' then
    raise exception 'Solo se puede cotizar con el catálogo activo';
  end if;
  return new;
end $$;
create trigger trg_validar_item before insert on public.items_cotizacion
for each row execute function public.validar_item_cotizacion();

-- 11. traspasos -----------------------------------------------------------
create table public.traspasos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  motivo text not null,
  resumen_ia jsonb not null default '{}',
  tomado_por uuid references public.miembros_negocio(id),
  solicitado_en timestamptz not null default now(),
  tomado_en timestamptz,
  devuelto_en timestamptz
);
create index on public.traspasos(conversacion_id);

-- 12. notificaciones ------------------------------------------------------
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  conversacion_id uuid references public.conversaciones(id) on delete cascade,
  tipo text not null,          -- 'traspaso' | 'listo_para_comprar'
  titulo text not null,
  leida boolean not null default false,
  creada_en timestamptz not null default now()
);

-- Seguridad a nivel de fila ---------------------------------------------
create or replace function public.mis_negocios() returns setof uuid
language sql stable security definer set search_path = public as $$
  select negocio_id from public.miembros_negocio where usuario_id = auth.uid()
$$;

do $$
declare t text;
begin
  foreach t in array array['configuracion_asistente','catalogos','servicios','clientes',
    'conversaciones','mensajes','cotizaciones','traspasos','notificaciones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "acceso por negocio" on public.%I for all to authenticated
      using (negocio_id in (select public.mis_negocios()))
      with check (negocio_id in (select public.mis_negocios()))', t);
  end loop;
end $$;

alter table public.negocios enable row level security;
create policy "ver mi negocio" on public.negocios for select to authenticated
  using (id in (select public.mis_negocios()));

alter table public.miembros_negocio enable row level security;
create policy "ver miembros de mi negocio" on public.miembros_negocio for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

alter table public.items_cotizacion enable row level security;
create policy "acceso por cotizacion" on public.items_cotizacion for all to authenticated
  using (cotizacion_id in (select id from public.cotizaciones))
  with check (cotizacion_id in (select id from public.cotizaciones));

-- Solo el dueño puede cambiar catálogo y configuración
create policy "solo dueno edita catalogos" on public.catalogos as restrictive for insert to authenticated
  with check (exists (select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
    and m.negocio_id = catalogos.negocio_id and m.rol = 'dueno'));
create policy "solo dueno activa catalogos" on public.catalogos as restrictive for update to authenticated
  using (exists (select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
    and m.negocio_id = catalogos.negocio_id and m.rol = 'dueno'));
create policy "solo dueno edita configuracion" on public.configuracion_asistente as restrictive for update to authenticated
  using (exists (select 1 from public.miembros_negocio m where m.usuario_id = auth.uid()
    and m.negocio_id = configuracion_asistente.negocio_id and m.rol = 'dueno'));

-- Activar un catálogo de forma atómica (archiva el anterior)
create or replace function public.activar_catalogo(p_catalogo uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare v_negocio uuid;
begin
  select negocio_id into v_negocio from catalogos where id = p_catalogo and estado = 'borrador';
  if v_negocio is null then raise exception 'Catálogo no encontrado o ya procesado'; end if;
  update catalogos set estado = 'archivado' where negocio_id = v_negocio and estado = 'activo';
  update catalogos set estado = 'activo', activado_en = now() where id = p_catalogo;
end $$;

-- Tiempo real
alter publication supabase_realtime add table public.conversaciones, public.mensajes, public.notificaciones, public.traspasos;
