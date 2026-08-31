-- Renombra la etiqueta del eje "ambiental" del Radar de contexto (la clave del eje,
-- y por lo tanto las señales/votos ya guardados bajo axis="ambiental", no cambian).
update activities
set config = jsonb_set(
  config,
  '{axes}',
  (
    select jsonb_agg(
      case when axis->>'key' = 'ambiental'
        then jsonb_set(axis, '{label}', '"Tecnología"')
        else axis
      end
    )
    from jsonb_array_elements(config->'axes') axis
  )
)
where id = 2 and title = 'Radar de contexto';
