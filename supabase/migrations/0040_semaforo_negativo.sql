-- Tablero de post-its con niveles de impacto (PCI consolidado, POAM): el semáforo por nivel
-- (alto/medio/bajo) se invierte para las categorías "negativas" (debilidad, amenaza), donde un
-- impacto alto es lo peor y uno bajo lo mejor — al revés que fortaleza/oportunidad.
update activities
set config = jsonb_set(
  config,
  '{categories}',
  (
    select jsonb_agg(
      case when cat->>'key' in ('debilidad', 'amenaza') then cat || '{"negative": true}'::jsonb else cat end
    )
    from jsonb_array_elements(config->'categories') as cat
  )
)
where activity_type in ('notas', 'notas_matriz')
  and config->>'impactLevels' = 'true';
