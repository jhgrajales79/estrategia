-- Radar de contexto: el límite de votos ahora aplica por ronda (eje), no como
-- total global del radar. Se baja de 3 a 2 votos por participante por ronda.
update activities
set config = config || '{"pointsPerPerson": 2}'::jsonb
where title = 'Radar de contexto';
