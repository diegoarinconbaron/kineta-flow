-- Kineta Flow · Casos destacados para la demostración (datos sintéticos)
do $$
declare
  t uuid := '11111111-1111-1111-1111-111111111111';
  s uuid := '22222222-2222-2222-2222-222222222222';
  cat_t uuid; cat_s uuid; cli uuid; conv uuid; cot uuid; sv record; ts timestamptz;
begin
  select id into cat_t from catalogos where negocio_id = t and estado = 'activo';
  select id into cat_s from catalogos where negocio_id = s and estado = 'activo';

  -- 1) Frame 4: Sandra Pérez escribe a las 10:47 p. m. de ayer y recibe cotización -------------
  ts := (date_trunc('day', now() at time zone 'America/Bogota') - interval '1 day' + interval '22 hours 47 minutes') at time zone 'America/Bogota';
  insert into clientes (negocio_id, nombre, telefono, datos_contexto)
  values (t, 'Sandra Pérez', '+57 311 482 7710', '{"estudiante":"Hijo, primer semestre de Ingeniería"}') returning id into cli;
  select * into sv from servicios where catalogo_id = cat_t and nombre = 'Monitoría Cálculo diferencial';
  insert into conversaciones (negocio_id, cliente_id, estado_lead, fuera_de_horario, necesidad, valor_potencial, iniciada_en, ultimo_mensaje_en)
  values (t, cli, 'cotizado', true, 'Monitoría Cálculo diferencial – Universidad (10 horas)', 405000, ts, ts + interval '4 minutes') returning id into conv;
  insert into cotizaciones (negocio_id, conversacion_id, catalogo_id, subtotal, descuento, total, valida_hasta, creada_en)
  values (t, conv, cat_t, 450000, 45000, 405000, (ts + interval '15 days')::date, ts + interval '2 minutes') returning id into cot;
  insert into items_cotizacion (cotizacion_id, servicio_id, descripcion, cantidad, valor_unitario, valor_total)
  values (cot, sv.id, 'Monitoría Cálculo diferencial – Universidad', 10, 45000, 450000);
  insert into mensajes (conversacion_id, negocio_id, emisor, contenido, adjunto, creado_en) values
    (conv, t, 'cliente', 'Buenas noches, mi hijo está en primer semestre de ingeniería y necesita monitorías de cálculo diferencial. ¿Cuánto cuesta?', null, ts),
    (conv, t, 'ia', '¡Buenas noches, Sandra! Soy Teo, el asistente de Monitorías Teorema. La monitoría de Cálculo diferencial para universidad cuesta $45.000 por hora. Si tomas un paquete de 10 horas o más, tienes 10 % de descuento. ¿Cuántas horas te gustaría?', null, ts + interval '9 seconds'),
    (conv, t, 'cliente', 'Serían 10 horas', null, ts + interval '1 minute 40 seconds'),
    (conv, t, 'ia', 'Perfecto. Te envío la cotización formal del paquete de 10 horas con el descuento aplicado: total $405.000.', jsonb_build_object('tipo','cotizacion','cotizacion_id',cot), ts + interval '2 minutes'),
    (conv, t, 'ia', '¿Quieres agendar la primera monitoría o prefieres hablar con un asesor?', '{"tipo":"botones","opciones":["Agendar monitoría","Hablar con asesor"]}', ts + interval '2 minutes 5 seconds');

  -- 2) Teorema: caso delicado (descuento por hermanos) que pasa a una persona ------------------
  ts := now() - interval '38 minutes';
  insert into clientes (negocio_id, nombre, telefono, datos_contexto)
  values (t, 'Gloria Martínez', '+57 315 220 9134', '{"estudiante":"Dos hijos en colegio (9.° y 11.°)"}') returning id into cli;
  insert into conversaciones (negocio_id, cliente_id, estado_lead, requiere_asesor, fuera_de_horario, necesidad, valor_potencial, iniciada_en, ultimo_mensaje_en)
  values (t, cli, 'listo_para_comprar', true, public._es_fuera_de_horario(t, ts), 'Monitorías de Matemáticas y Física – Colegio para dos hermanos', 568000, ts, ts + interval '3 minutes') returning id into conv;
  insert into mensajes (conversacion_id, negocio_id, emisor, contenido, creado_en) values
    (conv, t, 'cliente', 'Hola, quiero inscribir a mis dos hijos: uno en matemáticas y otro en física, los dos de colegio. ¿Cuánto vale?', ts),
    (conv, t, 'ia', '¡Hola, Gloria! La monitoría de Matemáticas para colegio cuesta $35.000 por hora y la de Física para colegio $36.000 por hora. ¿Cuántas horas necesita cada uno?', ts + interval '8 seconds'),
    (conv, t, 'cliente', 'Unas 8 horas cada uno. ¿Tienen descuento por hermanos?', ts + interval '2 minutes'),
    (conv, t, 'ia', 'Los descuentos por hermanos los define directamente el equipo de Monitorías Teorema. Ya le avisé a un asesor para que te responda en unos minutos.', ts + interval '2 minutes 7 seconds');
  insert into traspasos (negocio_id, conversacion_id, motivo, resumen_ia, solicitado_en)
  values (t, conv, 'Caso delicado: el cliente pregunta por descuento por hermanos',
    jsonb_build_object('necesidad','Monitorías para dos hijos de colegio: 8 h de Matemáticas y 8 h de Física.',
      'cotizacion','Aún sin cotización: depende del descuento por hermanos.',
      'datos','Valor de referencia con tarifas del catálogo: $568.000 sin descuento.',
      'siguiente_paso','Confirmar si aplica descuento por hermanos y enviar la cotización.'), ts + interval '2 minutes 7 seconds');
  insert into notificaciones (negocio_id, conversacion_id, tipo, titulo, creada_en)
  values (t, conv, 'traspaso', 'Gloria Martínez necesita un asesor', ts + interval '2 minutes 7 seconds');

  -- 3) Frame 6: Hernán Rojas pide financiación en Castillo Solar --------------------------------
  ts := now() - interval '25 minutes';
  insert into clientes (negocio_id, nombre, telefono, municipio, datos_contexto)
  values (s, 'Hernán Rojas', '+57 312 845 6620', 'Chía',
    '{"consumo_kwh_mes": 420, "tipo_techo": "Teja de barro", "direccion": "Vereda Fusca, Chía", "factura_energia": "Recibida"}') returning id into cli;
  select * into sv from servicios where catalogo_id = cat_s and nombre = 'Sistema solar on-grid 5 kWp';
  insert into conversaciones (negocio_id, cliente_id, estado_lead, requiere_asesor, fuera_de_horario, necesidad, valor_potencial, iniciada_en, ultimo_mensaje_en)
  values (s, cli, 'listo_para_comprar', true, public._es_fuera_de_horario(s, ts), 'Sistema solar on-grid 5 kWp para vivienda', 22800000, ts, ts + interval '6 minutes') returning id into conv;
  insert into cotizaciones (negocio_id, conversacion_id, catalogo_id, subtotal, descuento, total, valida_hasta, creada_en)
  values (s, conv, cat_s, 22800000, 0, 22800000, (ts + interval '15 days')::date, ts + interval '3 minutes') returning id into cot;
  insert into items_cotizacion (cotizacion_id, servicio_id, descripcion, cantidad, valor_unitario, valor_total)
  values (cot, sv.id, 'Sistema solar on-grid 5 kWp – Residencial', 1, 22800000, 22800000);
  insert into mensajes (conversacion_id, negocio_id, emisor, contenido, adjunto, creado_en) values
    (conv, s, 'cliente', 'Buenas, quiero poner paneles solares en mi casa en Chía. Pago unos $380.000 de luz al mes.', null, ts),
    (conv, s, 'ia', 'Hola, Hernán. Con gusto te ayudo. ¿Me compartes tu consumo mensual en kWh (aparece en la factura) y el tipo de techo de tu casa?', null, ts + interval '7 seconds'),
    (conv, s, 'cliente', 'Consumo como 420 kWh. El techo es de teja de barro. Te mando la factura.', null, ts + interval '2 minutes'),
    (conv, s, 'ia', 'Gracias. Para ese consumo, el sistema que más se ajusta es el on-grid de 5 kWp, con un valor de $22.800.000 instalado. Te envío la cotización formal.', jsonb_build_object('tipo','cotizacion','cotizacion_id',cot), ts + interval '3 minutes'),
    (conv, s, 'cliente', 'Me interesa. ¿Tienen financiación? Y quisiera que alguien venga a mirar el techo.', null, ts + interval '5 minutes 30 seconds'),
    (conv, s, 'ia', 'La financiación y la visita técnica las coordina directamente un asesor de Castillo Solar. Ya le avisé al equipo y te escriben en breve.', null, ts + interval '5 minutes 36 seconds');
  insert into traspasos (negocio_id, conversacion_id, motivo, resumen_ia, solicitado_en)
  values (s, conv, 'El cliente pregunta por financiación y pide visita técnica',
    jsonb_build_object('necesidad','Sistema solar para vivienda en Chía. Consumo de 420 kWh/mes (paga cerca de $380.000).',
      'cotizacion','COT enviada: sistema on-grid 5 kWp por $22.800.000.',
      'datos','Techo de teja de barro. Vereda Fusca, Chía. Ya envió la factura de energía.',
      'siguiente_paso','Explicar opciones de financiación y agendar la visita técnica.'), ts + interval '5 minutes 36 seconds');
  insert into notificaciones (negocio_id, conversacion_id, tipo, titulo, creada_en)
  values (s, conv, 'traspaso', 'Hernán Rojas necesita un asesor', ts + interval '5 minutes 36 seconds');
end $$;
