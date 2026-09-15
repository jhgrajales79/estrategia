-- Título más corto para la actividad de PCI de S1: quita la aclaración entre paréntesis
-- ("lluvia de ideas silenciosa"), que ya está explicada en la descripción de la actividad.
update activities
set title = 'PCI Consolidado'
where activity_type = 'notas_matriz'
  and title = 'PCI consolidado (lluvia de ideas silenciosa)';
