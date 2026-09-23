-- Conecta el panel "Insumos de actividades anteriores" en dos actividades de S2 que lo
-- necesitaban según su propia descripción, pero no lo tenían cableado (a diferencia de Mundo
-- café, que ya recibía insumos de S1 desde su creación):
--
--   POAM (id 13): "Consolidar oportunidades y amenazas... asociándolas a cada aspiración" —
--   es literalmente lo que produce Mundo café (id 11); ahora inputsFrom = [11].
--
--   Cierre: síntesis del entorno (id 15): "Lectura en voz alta de las 3 oportunidades y 3
--   amenazas de mayor impacto... para validación grupal" — necesita ver el POAM ya clasificado
--   por impacto; ahora inputsFrom = [13].
--
-- Matriz EFE (id 14) se deja sin `inputsFrom` a propósito: mismo patrón que Matriz EFI en S1
-- (que tampoco recibe insumos de PCI Consolidado) — en ese paso el facilitador traduce
-- manualmente el POAM a factores EFE, sin panel automático.
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(11)) where id = 13;
update activities set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(13)) where id = 15;
