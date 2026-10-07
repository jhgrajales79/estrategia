-- Activa el cruce automático FO/DO/FA/DA en "Tres DOFA cruzados" (S4 id21): efiFrom/efeFrom
-- apuntan a las Matrices EFI (id9) y EFE (id14) de las que se generan todas las combinaciones
-- posibles por aspiración. No tenía submissions (sin datos que perder).
update activities
set config = config || jsonb_build_object('efiFrom', 9, 'efeFrom', 14)
where id = 21;
