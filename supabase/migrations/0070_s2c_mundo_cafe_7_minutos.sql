-- Ajusta la rotación de mesas de "Mundo café del entorno Socya" en S2C (coordinadores, id 47)
-- de 9 a 7 minutos por ronda, corrigiendo también la descripción.
update activities
set config = config || jsonb_build_object('rotationMinutes', 7),
    description = 'Cinco mesas temáticas rotan cada 7 minutos aportando oportunidades y amenazas por mesa; un anfitrión fijo consolida. Plenaria: cada anfitrión presenta los 3 hallazgos clave de su mesa, señalando a qué aspiración impactan.'
where id = 47
  and activity_type = 'notas'
  and title = 'Mundo café del entorno Socya';
