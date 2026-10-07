-- "Cierre: consenso de estrategias corporativas" (id25) ahora puede importar de un clic las
-- estrategias ya creadas en la Priorización QSPM (id24) como registros de partida, en vez de que
-- el equipo las vuelva a escribir a mano.
update activities set config = config || jsonb_build_object('qspmFrom', 24) where id = 25;
