-- El cierre de priorización por votación ponderada puede importar como candidatas
-- las debilidades ya registradas en "PCI consolidado" (id 8), con su aspiración e
-- impacto de origen, en vez de tener que volver a escribirlas.
update activities
set config = config || jsonb_build_object('importCandidatesFrom', 8, 'importCategory', 'debilidad')
where activity_type = 'votacion_fichas'
  and title = 'Cierre: priorización por votación ponderada';
