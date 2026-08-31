-- "Revisión del acumulado anual": cada tema (hipótesis / qué se hizo bien / qué se
-- hizo mal) se registra una sola vez por aspiración, con máximo 60 caracteres.
-- Solo aplica a esta actividad, no a "PCI consolidado" (misma notas_matriz pero
-- pensada como lluvia de ideas con múltiples aportes por celda).
update activities
set config = config || '{"maxTextLength": 60, "maxNotesPerCell": 1}'::jsonb
where title = 'Revisión del acumulado anual';
