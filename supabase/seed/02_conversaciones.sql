-- Kineta Flow · Conversaciones de demostración (datos sintéticos, últimos 7 días)

create or replace function public._es_fuera_de_horario(p_negocio uuid, p_ts timestamptz) returns boolean
language plpgsql stable set search_path = public as $$
declare h jsonb; local timestamp := p_ts at time zone 'America/Bogota'; franja jsonb;
begin
  select horario_laboral into h from configuracion_asistente where negocio_id = p_negocio;
  franja := h -> extract(isodow from local)::int::text;
  if franja is null then return true; end if;
  return not (local::time >= (franja->>0)::time and local::time < (franja->>1)::time);
end $$;

do $$
declare
  nombres text[] := array['Sandra','Andrés','Paola','Juan Pablo','Natalia','Camilo','Luisa','Felipe','Diana','Sebastián',
    'Valentina','Jorge','Carolina','Mauricio','Daniela','Ricardo','Laura','Óscar','Mónica','Esteban','Adriana','Hernán','Lina','David'];
  apellidos text[] := array['Pérez','Gómez','Rodríguez','Martínez','López','Hernández','Díaz','Moreno','Rojas','Vargas',
    'Castro','Ramírez','Torres','Suárez','Ortiz','Jiménez','Mejía','Cárdenas','Ruiz','Salazar'];
  neg uuid;
  dia int; k int; n int; i int;
  ts timestamptz; hora numeric;
  cli uuid; conv uuid; cot uuid; cat uuid;
  sv record; cant int; sub numeric; dsc numeric; pct numeric; minimo int;
  r float; est estado_lead; tel int := 3000000;
begin
  perform setseed(0.42);
  foreach neg in array array['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222']::uuid[] loop
    select id into cat from catalogos where negocio_id = neg and estado = 'activo';
    select (descuento_paquete->>'porcentaje')::numeric, (descuento_paquete->>'minimo')::int into pct, minimo
      from configuracion_asistente where negocio_id = neg;
    for dia in 0..6 loop
      n := case when neg = '11111111-1111-1111-1111-111111111111' then 44 + floor(random()*24)::int else 4 + floor(random()*4)::int end;
      for k in 1..n loop
        -- 60 % en horario laboral, 40 % en la noche o madrugada
        if random() < 0.6 then hora := 8 + random()*10; else hora := case when random() < 0.85 then 18 + random()*5.5 else random()*7 end; end if;
        ts := (date_trunc('day', now() at time zone 'America/Bogota') - make_interval(days => dia)
               + make_interval(secs => hora*3600)) at time zone 'America/Bogota';
        continue when ts > now() - interval '20 minutes';
        tel := tel + 1;
        insert into clientes (negocio_id, nombre, telefono, municipio, datos_contexto)
        values (neg, nombres[1+floor(random()*array_length(nombres,1))::int] || ' ' || apellidos[1+floor(random()*array_length(apellidos,1))::int],
                '+57 3' || lpad(tel::text, 9, '0'),
                case when neg = '22222222-2222-2222-2222-222222222222' then (array['Chía','Cajicá','Zipaquirá','Tenjo','Sopó','Cota'])[1+floor(random()*6)::int] else 'Bogotá' end,
                case when neg = '22222222-2222-2222-2222-222222222222'
                  then jsonb_build_object('consumo_kwh_mes', 180 + floor(random()*500)::int,
                       'tipo_techo', (array['Teja de barro','Placa de concreto','Teja termoacústica','Fibrocemento'])[1+floor(random()*4)::int])
                  else jsonb_build_object('estudiante', (array['Hijo en colegio','Hija en colegio','Estudiante universitario','Adulto'])[1+floor(random()*4)::int]) end)
        returning id into cli;

        select * into sv from servicios where catalogo_id = cat and estado = 'listo' order by random() limit 1;
        r := random();
        est := case when r < 0.42 then 'nuevo' when r < 0.72 then 'cotizado' when r < 0.80 then 'listo_para_comprar'
                    when r < 0.92 then 'sin_respuesta' else 'cerrado' end;
        if dia >= 2 and est = 'cotizado' and random() < 0.4 then est := 'sin_respuesta'; end if;

        insert into conversaciones (negocio_id, cliente_id, estado_lead, fuera_de_horario, necesidad, valor_potencial, iniciada_en, ultimo_mensaje_en)
        values (neg, cli, est, _es_fuera_de_horario(neg, ts), sv.nombre || coalesce(' – ' || sv.nivel, ''),
                case when est in ('cotizado','listo_para_comprar','sin_respuesta') then sv.tarifa * (case when sv.unidad = 'hora' then 8 else 1 end) end,
                ts, ts + interval '3 minutes')
        returning id into conv;

        insert into mensajes (conversacion_id, negocio_id, emisor, contenido, creado_en) values
          (conv, neg, 'cliente', (array['Hola, ¿cuánto cuesta ','Buenas, quisiera información de ','Hola! me interesa ','Buen día, ¿tienen '])[1+floor(random()*4)::int]
              || lower(sv.nombre) || '?', ts),
          (conv, neg, 'ia', '¡Hola! Claro que sí. ' || sv.nombre || coalesce(' (' || sv.nivel || ')', '') || ' tiene un valor de $'
              || replace(to_char(sv.tarifa, 'FM999,999,999'), ',', '.') || ' por ' || sv.unidad || '. ¿Quieres que te envíe una cotización formal?',
              ts + make_interval(secs => 6 + floor(random()*24)::int));

        if est in ('cotizado','listo_para_comprar','sin_respuesta','cerrado') then
          cant := case when sv.unidad = 'hora' then (array[4,6,8,10,12])[1+floor(random()*5)::int] else 1 end;
          sub := sv.tarifa * cant;
          dsc := case when cant >= minimo then round(sub * pct / 100) else 0 end;
          insert into cotizaciones (negocio_id, conversacion_id, catalogo_id, subtotal, descuento, total, valida_hasta, creada_en)
          values (neg, conv, cat, sub, dsc, sub - dsc, (ts + interval '15 days')::date, ts + interval '1 minute')
          returning id into cot;
          insert into items_cotizacion (cotizacion_id, servicio_id, descripcion, cantidad, valor_unitario, valor_total)
          values (cot, sv.id, sv.nombre || coalesce(' – ' || sv.nivel, ''), cant, sv.tarifa, sub);
          insert into mensajes (conversacion_id, negocio_id, emisor, contenido, creado_en) values
            (conv, neg, 'cliente', 'Sí, por favor', ts + interval '50 seconds'),
            (conv, neg, 'ia', 'Listo, aquí tienes tu cotización.', ts + interval '1 minute');
          update mensajes set adjunto = jsonb_build_object('tipo','cotizacion','cotizacion_id',cot)
           where conversacion_id = conv and contenido = 'Listo, aquí tienes tu cotización.';
        end if;
        if est = 'listo_para_comprar' then
          insert into mensajes (conversacion_id, negocio_id, emisor, contenido, creado_en) values
            (conv, neg, 'cliente', 'Perfecto, ¿cómo hago para empezar?', ts + interval '2 minutes'),
            (conv, neg, 'ia', '¡Excelente! Ya le avisé al equipo para confirmar los detalles contigo.', ts + interval '2 minutes 10 seconds');
        end if;
      end loop;
    end loop;
  end loop;
end $$;

revoke execute on function public._es_fuera_de_horario(uuid, timestamptz) from anon, public;
grant execute on function public._es_fuera_de_horario(uuid, timestamptz) to authenticated;
