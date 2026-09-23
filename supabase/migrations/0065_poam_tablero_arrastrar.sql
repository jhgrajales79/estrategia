-- El POAM pedía retipear a mano cada oportunidad/amenaza que ya se había escrito en Mundo café
-- (activity_type "notas" con el flujo de texto libre + selector de impacto). Se construyó un
-- tablero de arrastrar y soltar (ConsolidacionImpacto.tsx) que trae las notas de Mundo café como
-- tarjetas y usa la columna de destino (Alto/Medio/Bajo) como la calificación de impacto —
-- eliminando el retipeo y facilitando ver todo el universo de ideas junto para deduplicar.
--
-- NotasColectivas.tsx ahora revisa `config.consolidationFrom`: si está presente, delega el
-- render completo a ConsolidacionImpacto en vez del flujo clásico de agregar texto. La
-- actividad sigue siendo activity_type = 'notas' (no se creó un tipo nuevo) y sigue guardando
-- sus resultados con la misma forma de nota (factor/category/impact/aspiration_id) que ya
-- consume el import hacia la Matriz EFE (config.importFactorsFrom) y el panel "Insumos" del
-- Cierre — cero cambios necesarios en esos dos consumidores.
--
-- `impactLevels` ya no aplica (la columna donde se suelta la tarjeta ES el impacto), se retira.
-- `inputsFrom: [11]` (agregado en la migración 0063 para mostrar Mundo café como panel de solo
-- lectura) también se retira: sería una duplicación exacta de lo que ya se ve como bandeja
-- arrastrable en el nuevo tablero.
update activities
set config = (config - 'impactLevels' - 'inputsFrom') || jsonb_build_object('consolidationFrom', 11)
where id = 13
  and activity_type = 'notas'
  and title = 'POAM';
