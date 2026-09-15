-- El registro de PCI ya es totalmente digital (matriz notas_matriz) — se quita la referencia
-- a materiales físicos (post-it, pliego) que ya no aplica.
update activities
set materials = null
where activity_type = 'notas_matriz'
  and title = 'PCI Consolidado';
