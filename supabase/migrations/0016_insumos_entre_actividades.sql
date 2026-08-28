-- Conecta cada actividad con los insumos (resultados) de las actividades anteriores que la alimentan,
-- según las relaciones ya documentadas en las descripciones y salidas esperadas de la ruta.
-- config.inputsFrom = ids de las actividades cuyo resultado se muestra como insumo de solo lectura.

-- S1 "PCI consolidado" <- S0 "Lectura comentada del acumulado anual" (hipótesis de la brecha)
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(3))
where title = 'PCI consolidado (lluvia de ideas silenciosa)';

-- S2 "Mundo café del entorno Socya" <- S0 "Radar de contexto" + "Lectura comentada del acumulado anual"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(2, 3))
where title = 'Mundo café del entorno Socya';

-- S3 "Taller de ajuste de aspiraciones" <- S1 "Matriz EFI" + S2 "Matriz EFE" (el diagnóstico)
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(9, 14))
where title = 'Taller de ajuste de aspiraciones';

-- S3 "Subasta de nuevas metas" <- S2 "POAM" (oportunidades del diagnóstico)
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(13))
where title = 'Subasta de nuevas metas (una nueva meta por aspiración)';

-- S4 "Tres DOFA cruzados" <- S1 "Matriz EFI" + S2 "Matriz EFE" + S0 "Crazy 8 Socya"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(9, 14, 4))
where title = 'Tres DOFA cruzados (uno por aspiración)';

-- S4 "Matriz Interna-Externa (IE)" <- S1 "Matriz EFI" + S2 "Matriz EFE"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(9, 14))
where title = 'Matriz Interna-Externa (IE)';

-- S4 "Priorización QSPM" <- S1 "Matriz EFI" + S2 "Matriz EFE" + S4 "Tres DOFA cruzados"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(9, 14, 21))
where title = 'Priorización QSPM';

-- S5 "El paredón estratégico" <- S4 "Cierre: consenso de estrategias corporativas"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(25))
where title = 'El paredón estratégico';

-- S6 "De objetivo a proyecto estratégico" <- S5 "El paredón estratégico"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(27))
where title = 'De objetivo a proyecto estratégico';

-- S6 "Plan de acción y tablero acumulado anual" <- S3 "Subasta de nuevas metas"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(18))
where title = 'Plan de acción y tablero acumulado anual';

-- S7 "Presentación del mapa y la ruta" <- S5 "Relato estratégico y digitalización" + S6 "Plan de acción y tablero acumulado anual"
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(29, 33))
where title = 'Presentación del mapa y la ruta';
