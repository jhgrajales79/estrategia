-- Se elimina la actividad "Conformación del Comité de Planeación y reglas de juego" (S0).
-- Las submissions ligadas a esta actividad se eliminan en cascada (FK on delete cascade).
delete from activities
where title = 'Conformación del Comité de Planeación y reglas de juego';
