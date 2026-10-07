-- "De objetivo a proyecto estratégico" (S6 id31) ya tenía perAspiration: true en su config, pero
-- el componente no separaba realmente por aspiración (dependía de participant.aspiration_id, que
-- en la práctica siempre es null) — todo quedaba en una submission compartida (aspiration_id
-- null), invisible en el tablero /proyectos/31 que sí agrupa por aspiración real. Se corrigió el
-- componente (pestaña local, mismo patrón que MatrizPonderada/TarjetaEstructurada/DofaCruzado) y
-- se eliminó la única submission huérfana existente (ya vacía, sin datos reales que perder).
delete from submissions where activity_id = 31 and aspiration_id is null;
