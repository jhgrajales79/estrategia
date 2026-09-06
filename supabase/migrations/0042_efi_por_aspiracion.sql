-- La Matriz EFI pasa a trabajarse por pestañas de aspiración (igual que la Rueda de
-- capacidades), en lugar del selector de aspiración por fila.
update activities
set config = jsonb_set(config, '{perAspiration}', 'true')
where activity_type = 'matriz_ponderada'
  and title = 'Matriz EFI';
