-- La Rueda de capacidades por aspiración (id 7) identifica en plenaria las capacidades
-- más débiles que explican las brechas del acumulado anual, pero ese resultado no llegaba
-- a ningún lado: no se mostraba como insumo en ninguna actividad posterior. El PCI
-- consolidado (id 8) es donde esas debilidades deberían quedar registradas formalmente,
-- así que se agrega la Rueda como insumo de solo lectura junto a la hipótesis de brecha
-- de S0 (id 3) que ya estaba wireada.
update activities
set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(3, 7))
where activity_type = 'notas_matriz'
  and title = 'PCI consolidado (lluvia de ideas silenciosa)';
