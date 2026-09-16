-- Renombra dos mesas temáticas del "Mundo café del entorno Socya" (S2): "Social-territorial"
-- pasa a "Social-territorial-ambiental" y "Ambiental-tecnológica" pasa a "Tecnología". Solo
-- cambia la etiqueta visible — las notas ya registradas siguen asociadas por su clave interna
-- (social/ambiental), que no se toca.
update activities
set config = jsonb_set(
  jsonb_set(
    config,
    '{categories,2,label}',
    '"Social-territorial-ambiental"'
  ),
  '{categories,3,label}',
  '"Tecnología"'
)
where activity_type = 'notas'
  and title = 'Mundo café del entorno Socya';
