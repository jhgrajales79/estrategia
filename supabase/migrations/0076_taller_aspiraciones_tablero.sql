-- Fija explícitamente qué campo se destaca en el nuevo tablero de resultados
-- (/aspiraciones/[activityId], ver TarjetaEstructurada.tsx "⛶ Ver tablero") del Taller de
-- ajuste de aspiraciones: el enunciado ratificado, no el "sigue siendo correcta" (que es
-- discusión de trabajo, no el resultado a proyectar en la plenaria).
update activities
set config = config || jsonb_build_object('boardHighlightField', 'enunciado_ratificado')
where id = 17
  and activity_type = 'tarjeta_estructurada'
  and title = 'Taller de ajuste de aspiraciones';
