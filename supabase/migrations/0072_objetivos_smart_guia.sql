-- Mejora el registro de "De aspiración a objetivos SMART" (S3, id 19):
-- 1) Insumos de actividades anteriores: la Revisión del acumulado anual (id 3, línea base) y la
--    Subasta de nuevas metas (id 18, la meta que hay que incorporar sí o sí) — antes había que
--    saltar de pestaña para consultarlos, ahora aparecen colapsados justo encima del formulario.
-- 2) Texto de apoyo bajo cada campo, recordando qué hace SMART a un objetivo y qué información
--    puntual se espera en cada uno (visible tanto para quien escribe como para el facilitador).
-- 3) El plazo casi siempre es el mismo horizonte (2027 según la descripción de la actividad):
--    se prellena en cada objetivo nuevo, editable si un caso concreto lo necesita distinto.
-- 4) Contador "X de 2 objetivos" (la descripción pide 2 por aspiración), para que el equipo sepa
--    de un vistazo si ya cumplió sin tener que contar las tarjetas.
update activities
set config = config || jsonb_build_object(
  'inputsFrom', jsonb_build_array(3, 18),
  'minEntries', 2,
  'minEntriesLabel', 'objetivos SMART',
  'fields', jsonb_build_array(
    jsonb_build_object(
      'key', 'objetivo',
      'type', 'textarea',
      'label', 'Objetivo SMART',
      'helper', 'Específico, Medible, Alcanzable, Relevante y con plazo a 2027. Debe incorporar la nueva meta adoptada en la Subasta.'
    ),
    jsonb_build_object(
      'key', 'linea_base',
      'type', 'text',
      'label', 'Línea base (acumulado anual)',
      'helper', 'El % o valor actual, tomado de la Revisión del acumulado anual (insumos arriba) — el punto de partida frente al que se mide el avance.'
    ),
    jsonb_build_object(
      'key', 'responsable',
      'type', 'text',
      'label', 'Responsable natural',
      'helper', 'Un cargo o equipo (no una persona puntual): quién por su rol debe responder por este objetivo.'
    ),
    jsonb_build_object(
      'key', 'plazo',
      'type', 'text',
      'label', 'Plazo',
      'default', '2027'
    )
  )
)
where id = 19
  and activity_type = 'tarjeta_estructurada'
  and title = 'De aspiración a objetivos SMART';
