-- Indicadores del panel "Resumen del negocio" (HU-02)
create or replace function public.resumen_negocio(p_negocio uuid, p_dias int default 7)
returns jsonb language sql stable security invoker set search_path = public as $$
with rango as (
  select (date_trunc('day', now() at time zone 'America/Bogota') - make_interval(days => p_dias - 1)) at time zone 'America/Bogota' as desde
),
conv as (
  select c.* from conversaciones c, rango r
  where c.negocio_id = p_negocio and c.iniciada_en >= r.desde
),
primeras as (
  select m.conversacion_id,
    min(m.creado_en) filter (where m.emisor = 'cliente') as cli,
    min(m.creado_en) filter (where m.emisor in ('ia','asesor')) as resp
  from mensajes m join conv on conv.id = m.conversacion_id
  group by m.conversacion_id
),
dias as (
  select generate_series(0, p_dias - 1) as n
),
serie as (
  select to_char(((select desde from rango) + make_interval(days => d.n)) at time zone 'America/Bogota', 'YYYY-MM-DD') as dia,
    count(c.id) filter (where not c.fuera_de_horario) as dentro,
    count(c.id) filter (where c.fuera_de_horario) as fuera
  from dias d
  left join conv c on (c.iniciada_en at time zone 'America/Bogota')::date
     = (((select desde from rango) + make_interval(days => d.n)) at time zone 'America/Bogota')::date
  group by d.n order by d.n
)
select jsonb_build_object(
  'conversaciones', (select count(*) from conv),
  'fuera_de_horario', (select count(*) from conv where fuera_de_horario),
  'cotizaciones', (select count(*) from cotizaciones q, rango r where q.negocio_id = p_negocio and q.creada_en >= r.desde),
  'tiempo_respuesta_s', (select coalesce(round(avg(extract(epoch from (resp - cli))))::int, 0) from primeras where resp > cli),
  'serie', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'dentro', dentro, 'fuera', fuera)), '[]') from serie)
);
$$;
