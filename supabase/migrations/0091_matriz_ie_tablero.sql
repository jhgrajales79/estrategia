-- Activa el tablero proyectable de la Matriz Interna-Externa (id23), que ahora calcula
-- automáticamente la posición de cada aspiración a partir de los totales ponderados de EFI/EFE
-- (config.inputsFrom = [9, 14]) en vez de ubicarla a mano.
update activities set config = config || jsonb_build_object('boardRoute', 'matrizie') where id = 23;
