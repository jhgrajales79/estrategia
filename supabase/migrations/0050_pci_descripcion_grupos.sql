-- La actividad se hace por grupos (mesas), no persona por persona, y ya no se agrupa por
-- afinidad dentro de la matriz digital (eso queda para el post-it físico si aplica).
update activities
set description = 'Cada grupo escribe fortalezas y debilidades específicas, marcando a la aspiración que pertenece. Se califica el impacto (alto/medio/bajo) en la matriz PCI.'
where activity_type = 'notas_matriz'
  and title = 'PCI Consolidado';
