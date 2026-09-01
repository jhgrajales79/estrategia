-- "Revisión del acumulado anual": la categoría "hipótesis" necesita más espacio
-- que "qué se hizo bien / mal" (que se quedan en el límite general de 60).
update activities
set config = jsonb_set(
  config,
  '{categories}',
  (
    select jsonb_agg(
      case when cat->>'key' = 'hipotesis' then cat || '{"maxLength": 150}'::jsonb else cat end
    )
    from jsonb_array_elements(config->'categories') as cat
  )
)
where title = 'Revisión del acumulado anual';
