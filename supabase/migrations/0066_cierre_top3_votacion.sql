-- El Cierre pedía retipear a mano el "top 3" de oportunidades/amenazas después de mirar el
-- POAM, sin garantía real de que fuera una decisión del grupo (era el criterio de quien
-- escribiera). Se construyó SintesisEntorno.tsx: trae en vivo las notas de impacto "alto" del
-- POAM por categoría y aspiración, y:
--   - si hay 3 o menos candidatas de alto impacto en una categoría, las muestra directo como
--     el top (no tiene sentido votar entre 3 o menos opciones para elegir 3);
--   - si hay más de 3, abre una votación simple (cada participante elige hasta `topN`
--     candidatas por categoría, dentro de la aspiración activa) y ordena por votos.
--
-- NotasColectivas.tsx ahora revisa `config.topFrom` (después de `config.consolidationFrom`) y
-- delega a SintesisEntorno en vez del flujo clásico de agregar texto. Sigue siendo
-- activity_type = 'notas'.
--
-- `categories` (oportunidad_top/amenaza_top, pensadas para el flujo manual anterior) y
-- `inputsFrom: [13]` (panel de solo lectura del POAM, agregado en la migración 0063) ya no
-- aplican: el nuevo tablero lee del POAM directamente y en vivo, sería una duplicación mostrar
-- además el panel de insumos.
update activities
set config = (config - 'categories' - 'inputsFrom') || jsonb_build_object('topFrom', 13, 'topN', 3)
where id = 15
  and activity_type = 'notas'
  and title = 'Cierre: síntesis del entorno';
