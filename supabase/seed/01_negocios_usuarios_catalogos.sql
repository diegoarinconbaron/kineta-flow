-- Kineta Flow · Datos de demostración
-- Crea 2 negocios ficticios (los de los perfiles de usuario), sus usuarios de prueba,
-- catálogos y conversaciones de los últimos 7 días. Son datos sintéticos para la demo:
-- no son resultados ni evidencia de uso real.

do $$
declare
  pw text := crypt('KinetaFlow2026', gen_salt('bf'));
  u_marcia uuid := gen_random_uuid();
  u_laura uuid := gen_random_uuid();
  u_alejandro uuid := gen_random_uuid();
  u_camilo uuid := gen_random_uuid();
  rec record;
begin
  for rec in select * from (values
    (u_marcia, 'marcia@demo.kinetaflow.co'),
    (u_laura, 'laura@demo.kinetaflow.co'),
    (u_alejandro, 'alejandro@demo.kinetaflow.co'),
    (u_camilo, 'camilo@demo.kinetaflow.co')) as t(id, email)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', rec.id, 'authenticated', 'authenticated', rec.email, pw, now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), rec.id, rec.id::text,
      jsonb_build_object('sub', rec.id::text, 'email', rec.email, 'email_verified', true),
      'email', now(), now(), now());
  end loop;

  insert into public.negocios (id, nombre, sector, ciudad, telefono_whatsapp) values
    ('11111111-1111-1111-1111-111111111111', 'Monitorías Teorema', 'Educación', 'Bogotá', '+57 310 555 0101'),
    ('22222222-2222-2222-2222-222222222222', 'Castillo Solar', 'Energía solar y electricidad', 'Chía', '+57 320 555 0202');

  insert into public.miembros_negocio (negocio_id, usuario_id, nombre, rol) values
    ('11111111-1111-1111-1111-111111111111', u_marcia, 'Marcia Rodríguez', 'dueno'),
    ('11111111-1111-1111-1111-111111111111', u_laura, 'Laura Gómez', 'asesor'),
    ('22222222-2222-2222-2222-222222222222', u_alejandro, 'Alejandro Castillo', 'dueno'),
    ('22222222-2222-2222-2222-222222222222', u_camilo, 'Camilo Suárez', 'asesor');

  insert into public.configuracion_asistente (negocio_id, nombre_asistente, tono, reglas_traspaso, descuento_paquete) values
    ('11111111-1111-1111-1111-111111111111', 'Teo', 'cercano',
      array['beca','hermanos','cuotas','pago a cuotas','descuento especial','convenio'], '{"minimo": 10, "porcentaje": 10}'),
    ('22222222-2222-2222-2222-222222222222', 'Asistente Castillo Solar', 'profesional',
      array['financiación','financiacion','crédito','credito','garantía','garantia','visita técnica','visita tecnica'], '{"minimo": 3, "porcentaje": 5}');
end $$;

-- Catálogos activos -------------------------------------------------------
do $$
declare
  cat_t uuid := gen_random_uuid();
  cat_s uuid := gen_random_uuid();
begin
  insert into public.catalogos (id, negocio_id, archivo_origen, version, estado, creado_en, activado_en) values
    (cat_t, '11111111-1111-1111-1111-111111111111', 'tarifas_monitorias_2026-2.xlsx', 3, 'activo', now() - interval '20 days', now() - interval '20 days'),
    (cat_s, '22222222-2222-2222-2222-222222222222', 'precios_castillo_solar.xlsx', 2, 'activo', now() - interval '35 days', now() - interval '35 days');

  insert into public.servicios (catalogo_id, negocio_id, nombre, categoria, nivel, unidad, tarifa, estado, observacion, palabras_clave)
  select cat_t, '11111111-1111-1111-1111-111111111111', s.nombre, s.categoria, s.nivel, 'hora', s.tarifa,
         case when s.tarifa is null then 'sin_tarifa' else 'listo' end::estado_servicio,
         case when s.tarifa is null then 'Falta la tarifa: lo cotiza un asesor' end, s.claves
  from (values
    ('Monitoría Cálculo diferencial', 'Matemáticas', 'Universidad', 45000, 'calculo diferencial derivadas limites'),
    ('Monitoría Cálculo integral', 'Matemáticas', 'Universidad', 45000, 'calculo integral integrales'),
    ('Monitoría Cálculo vectorial', 'Matemáticas', 'Universidad', 50000, 'calculo vectorial multivariable'),
    ('Monitoría Álgebra lineal', 'Matemáticas', 'Universidad', 45000, 'algebra lineal matrices vectores'),
    ('Monitoría Ecuaciones diferenciales', 'Matemáticas', 'Universidad', 50000, 'ecuaciones diferenciales'),
    ('Monitoría Estadística', 'Matemáticas', 'Universidad', 45000, 'estadistica probabilidad'),
    ('Monitoría Matemáticas básicas', 'Matemáticas', 'Universidad', 40000, 'matematicas basicas precalculo'),
    ('Monitoría Matemáticas', 'Matemáticas', 'Colegio', 35000, 'matematicas aritmetica'),
    ('Monitoría Álgebra', 'Matemáticas', 'Colegio', 35000, 'algebra'),
    ('Monitoría Trigonometría', 'Matemáticas', 'Colegio', 35000, 'trigonometria'),
    ('Monitoría Geometría', 'Matemáticas', 'Colegio', 35000, 'geometria'),
    ('Monitoría Cálculo', 'Matemáticas', 'Colegio', 38000, 'calculo derivadas'),
    ('Monitoría Física mecánica', 'Física', 'Universidad', 48000, 'fisica mecanica'),
    ('Monitoría Física electricidad y magnetismo', 'Física', 'Universidad', 50000, 'fisica electricidad magnetismo'),
    ('Monitoría Física ondas', 'Física', 'Universidad', 48000, 'fisica ondas'),
    ('Monitoría Física', 'Física', 'Colegio', 36000, 'fisica'),
    ('Monitoría Química general', 'Química', 'Universidad', 45000, 'quimica general'),
    ('Monitoría Química orgánica', 'Química', 'Universidad', 50000, 'quimica organica'),
    ('Monitoría Química', 'Química', 'Colegio', 35000, 'quimica'),
    ('Monitoría Biología', 'Ciencias', 'Colegio', 33000, 'biologia'),
    ('Monitoría Inglés conversación', 'Inglés', 'Adultos', 40000, 'ingles conversacion'),
    ('Monitoría Inglés', 'Inglés', 'Colegio', 33000, 'ingles'),
    ('Monitoría Inglés', 'Inglés', 'Universidad', 38000, 'ingles'),
    ('Preparación examen IELTS', 'Inglés', 'Adultos', 55000, 'ielts examen ingles'),
    ('Preparación examen TOEFL', 'Inglés', 'Adultos', 55000, 'toefl examen ingles'),
    ('Preparación Saber 11 – Matemáticas', 'Preparación', 'Colegio', 38000, 'icfes saber 11 matematicas'),
    ('Preparación Saber 11 – Ciencias', 'Preparación', 'Colegio', 38000, 'icfes saber 11 ciencias'),
    ('Preparación Saber 11 – Lectura crítica', 'Preparación', 'Colegio', 36000, 'icfes saber 11 lectura'),
    ('Preparación Saber 11 – Inglés', 'Preparación', 'Colegio', 36000, 'icfes saber 11 ingles'),
    ('Preparación examen de admisión U. Nacional', 'Preparación', 'Colegio', 40000, 'admision universidad nacional examen'),
    ('Monitoría Programación básica (Python)', 'Tecnología', 'Universidad', 50000, 'programacion python'),
    ('Monitoría Contabilidad', 'Finanzas', 'Universidad', 45000, 'contabilidad'),
    ('Monitoría Microeconomía', 'Economía', 'Universidad', 45000, 'microeconomia economia'),
    ('Acompañamiento de tareas', 'General', 'Primaria', 30000, 'tareas primaria'),
    ('Monitoría grupal (3 a 5 estudiantes)', 'General', 'Colegio', null, 'grupal grupo amigos'),
    ('Taller intensivo de parciales', 'General', 'Universidad', null, 'taller intensivo parciales')
  ) as s(nombre, categoria, nivel, tarifa, claves);

  insert into public.servicios (catalogo_id, negocio_id, nombre, categoria, nivel, unidad, tarifa, estado, observacion, palabras_clave)
  select cat_s, '22222222-2222-2222-2222-222222222222', s.nombre, s.categoria, s.nivel, s.unidad, s.tarifa,
         case when s.tarifa is null then 'sin_tarifa' else 'listo' end::estado_servicio,
         case when s.tarifa is null then 'Requiere visita: lo cotiza un asesor' end, s.claves
  from (values
    ('Sistema solar on-grid 3 kWp', 'Energía solar', 'Residencial', 'sistema', 14500000, 'solar paneles on-grid 3 kwp casa'),
    ('Sistema solar on-grid 5 kWp', 'Energía solar', 'Residencial', 'sistema', 22800000, 'solar paneles on-grid 5 kwp casa'),
    ('Sistema solar on-grid 10 kWp', 'Energía solar', 'Comercial', 'sistema', 42500000, 'solar paneles on-grid 10 kwp comercio negocio'),
    ('Sistema solar off-grid 2 kWp para finca', 'Energía solar', 'Rural', 'sistema', 16900000, 'solar off-grid finca baterias aislado'),
    ('Sistema solar híbrido 5 kWp con batería', 'Energía solar', 'Residencial', 'sistema', 31500000, 'solar hibrido bateria respaldo'),
    ('Batería de litio 5 kWh', 'Almacenamiento', 'Todos', 'unidad', 7900000, 'bateria litio almacenamiento'),
    ('Inversor híbrido 5 kW', 'Equipos', 'Todos', 'unidad', 5600000, 'inversor hibrido'),
    ('Panel solar 550 W', 'Equipos', 'Todos', 'unidad', 690000, 'panel solar modulo 550'),
    ('Mantenimiento de sistema solar', 'Servicios', 'Todos', 'servicio', 380000, 'mantenimiento limpieza paneles'),
    ('Revisión eléctrica residencial', 'Electricidad', 'Residencial', 'servicio', 220000, 'revision electrica casa'),
    ('Instalación de punto eléctrico', 'Electricidad', 'Todos', 'punto', 95000, 'punto electrico tomacorriente'),
    ('Cargador para vehículo eléctrico', 'Electricidad', 'Residencial', 'unidad', 4200000, 'cargador carro electrico vehiculo'),
    ('Certificado RETIE', 'Electricidad', 'Todos', 'servicio', 650000, 'retie certificado'),
    ('Diseño de proyecto solar a la medida', 'Servicios', 'Comercial', 'proyecto', null, 'diseno proyecto medida industrial'),
    ('Visita técnica de evaluación', 'Servicios', 'Todos', 'visita', null, 'visita tecnica evaluacion')
  ) as s(nombre, categoria, nivel, unidad, tarifa, claves);
end $$;
