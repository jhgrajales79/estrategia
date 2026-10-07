-- Evoluciona la actividad 33 de S6 ("Plan de acción y tablero acumulado anual") de
-- tablero_proyectos (presupuesto como texto plano, no consolidable) al nuevo activity_type
-- 'plan_presupuesto' (migración 0084): promueve Acciones desde el taller S6 id31 ("De objetivo
-- a proyecto estratégico") y permite costearlas con conceptos de costo consolidables.
-- La actividad no tenía submissions (sin datos que perder).
update activities
set activity_type = 'plan_presupuesto',
    config = jsonb_build_object('actionsFrom', 31, 'boardRoute', 'presupuesto')
where id = 33;
