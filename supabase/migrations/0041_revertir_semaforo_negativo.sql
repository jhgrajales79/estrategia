-- Revierte 0040: quita el flag "negative" de las categorías de PCI consolidado y POAM.
update activities
set config = jsonb_set(
  config,
  '{categories}',
  (
    select jsonb_agg(cat - 'negative')
    from jsonb_array_elements(config->'categories') as cat
  )
)
where activity_type in ('notas', 'notas_matriz')
  and config->>'impactLevels' = 'true';
