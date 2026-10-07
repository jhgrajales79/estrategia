-- Completa la cobertura de tableros en S4: tejido de conexiones (id42 → /tejido), DOFA cruzado
-- (id21 → /dofacruzado) y Cierre de consenso (id25 → /pilares, tablero genérico que ya sirve
-- para cualquier tarjeta_estructurada repetible sin aspiración).
update activities set config = config || jsonb_build_object('boardRoute', 'tejido') where id = 42;
update activities set config = config || jsonb_build_object('boardRoute', 'dofacruzado') where id = 21;
update activities set config = config || jsonb_build_object('boardRoute', 'pilares') where id = 25;
