-- Ajusta la rotación de mesas de "Mundo café del entorno Socya" en S2C (coordinadores, id 47)
-- de 7 a 5 minutos por ronda, corrigiendo también la descripción.
update activities
set config = config || jsonb_build_object('rotationMinutes', 5),
    description = 'Cinco mesas temáticas rotan cada 5 minutos aportando oportunidades y amenazas por mesa; un anfitrión fijo consolida. Plenaria: cada anfitrión presenta los 3 hallazgos clave de su mesa, señalando a qué aspiración impactan.'
where id = 47
  and activity_type = 'notas'
  and title = 'Mundo café del entorno Socya';
