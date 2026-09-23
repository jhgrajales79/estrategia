-- Dos ajustes al "Mundo café del entorno Socya" (S2):
-- 1) rotationMinutes pasa de 8 a 9 minutos por ronda (y se corrige la descripción).
-- 2) Se activa `polarityTags`, que hace obligatorio marcar cada nota como 🟢 Oportunidad o
--    🔴 Amenaza (nuevo campo `polarity` en cada nota) — antes el módulo no distinguía entre
--    ambas, solo capturaba texto libre. Ver NotasColectivas.tsx: POLARITY_META, el selector de
--    dos botones antes del textarea, y el badge de color en cada nota ya guardada.
update activities
set config = config || jsonb_build_object('rotationMinutes', 9, 'polarityTags', true),
    description = 'Cinco mesas temáticas rotan cada 9 minutos aportando oportunidades y amenazas por mesa; un anfitrión fijo consolida. Plenaria: cada anfitrión presenta los 3 hallazgos clave de su mesa, señalando a qué aspiración impactan.'
where id = 11
  and activity_type = 'notas'
  and title = 'Mundo café del entorno Socya';
