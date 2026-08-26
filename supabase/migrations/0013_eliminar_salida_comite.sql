-- Se elimina la salida esperada ligada a la actividad de conformación del comité (S0),
-- que ya se eliminó en la migración anterior.
delete from outputs
where description = 'Comité de Planeación conformado con un líder responsable por cada aspiración.';
