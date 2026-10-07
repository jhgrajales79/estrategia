-- Activa el tablero proyectable de la Priorización QSPM (id24): muestra todas las estrategias de
-- las 3 aspiraciones con la misma tarjeta (medidor + tabla de factores) del ejemplo guiado dentro
-- de la actividad, más una calificación global que las compara a todas en un solo ranking.
update activities set config = config || jsonb_build_object('boardRoute', 'qspm') where id = 24;
