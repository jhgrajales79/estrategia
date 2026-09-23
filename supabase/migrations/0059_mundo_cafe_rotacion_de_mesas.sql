-- Activa el nuevo tablero de "rotación de mesas" (componente RotationBoard en
-- NotasColectivas.tsx) para el "Mundo café del entorno Socya" (S2): config.rotationMinutes
-- controla la duración de cada ronda (8 minutos, una por cada una de las 5 mesas temáticas).
-- Corrige también la descripción, que aún decía "cada 15 minutos".
update activities
set config = config || jsonb_build_object('rotationMinutes', 8),
    description = 'Cinco mesas temáticas rotan cada 8 minutos aportando oportunidades y amenazas por mesa; un anfitrión fijo consolida. Plenaria: cada anfitrión presenta los 3 hallazgos clave de su mesa, señalando a qué aspiración impactan.'
where id = 11
  and activity_type = 'notas'
  and title = 'Mundo café del entorno Socya';
