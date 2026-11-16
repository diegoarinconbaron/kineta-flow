-- Mantiene vigentes los datos de demostración.
-- Si la conversación más reciente tiene más de 3 horas, corre todas las fechas hacia adelante
-- para que la última quede hace 20 minutos. Así el panel «Últimos 7 días» siempre muestra datos,
-- sin importar el día en que se presente el prototipo. Se recalcula «fuera de horario» porque
-- al mover las fechas cambia el día de la semana.

create extension if not exists pg_cron;

create or replace function public.refrescar_datos_demo() returns text
language plpgsql security definer set search_path = public as $$
declare
  ultima timestamptz;
  desfase interval;
begin
  select max(iniciada_en) into ultima from conversaciones;
  if ultima is null or ultima > now() - interval '3 hours' then
    return 'sin cambios';
  end if;
  desfase := (now() - interval '20 minutes') - ultima;

  update conversaciones set iniciada_en = iniciada_en + desfase, ultimo_mensaje_en = ultimo_mensaje_en + desfase;
  update mensajes set creado_en = creado_en + desfase;
  update cotizaciones set creada_en = creada_en + desfase, valida_hasta = (valida_hasta + desfase)::date;
  update traspasos set solicitado_en = solicitado_en + desfase,
    tomado_en = tomado_en + desfase, devuelto_en = devuelto_en + desfase;
  update notificaciones set creada_en = creada_en + desfase;
  update clientes set creado_en = creado_en + desfase;
  update conversaciones set fuera_de_horario = _es_fuera_de_horario(negocio_id, iniciada_en);

  return 'fechas movidas ' || desfase::text;
end $$;

revoke execute on function public.refrescar_datos_demo() from anon, authenticated, public;

-- cada hora, al minuto 7
select cron.schedule('refrescar-datos-demo', '7 * * * *', $$select public.refrescar_datos_demo()$$);
