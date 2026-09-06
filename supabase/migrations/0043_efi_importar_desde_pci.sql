-- La Matriz EFI puede importar como punto de partida las fortalezas/debilidades de
-- alto impacto ya registradas en "PCI consolidado" (id 8), por aspiración.
update activities
set config = jsonb_set(config, '{importFactorsFrom}', '8')
where activity_type = 'matriz_ponderada'
  and title = 'Matriz EFI';
