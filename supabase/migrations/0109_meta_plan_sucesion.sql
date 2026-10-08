-- Agrega "Plan de sucesión de cargos críticos de la organización ejecutado" como meta nueva de
-- la Aspiración 1 (confirmada por el usuario; venía como candidata de la Subasta sin aspiración
-- asignada).
insert into goals (aspiration_id, description, is_new) values
  (1, 'Plan de sucesión de cargos críticos de la organización ejecutado', true);
