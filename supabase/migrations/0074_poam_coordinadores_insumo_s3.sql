-- "Subasta de nuevas metas" (S3, id 18) ya mostraba el POAM de S2 (id 13) como insumo. Ahora
-- también trae el POAM de S2C (id 49). Como ambos se llamaban igual, se renombra el de S2C a
-- "POAM Coordinadores" para distinguirlos de un vistazo (cambio de nombre global, no solo en
-- este panel de insumos) — mismo patrón que la Matriz EFE Coordinadores (migración 0073).
update activities
set title = 'POAM Coordinadores'
where id = 49
  and activity_type = 'notas'
  and title = 'POAM';

update activities
set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(13, 49))
where id = 18
  and activity_type = 'votacion_fichas'
  and title = 'Subasta de nuevas metas (una nueva meta por aspiración)';
