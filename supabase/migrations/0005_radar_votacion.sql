-- Radar de contexto: descripción actualizada + parámetros de votación de foco.
update activities
set description = 'El radar tiene 5 dimensiones (política, financiamiento, social-territorial, ambiental-tecnológica y sector) y 3 anillos de impacto (ya nos afecta / nos afectará este año / en el horizonte). El facilitador abre una ronda por dimensión; en cada ronda los participantes ubican señales de cambio del entorno directamente sobre el radar, en el anillo que corresponda a su cercanía. Al cierre, el grupo vota las señales más impactantes: las más votadas quedan como foco para las siguientes sesiones.',
    config = config || '{"pointsPerPerson": 3, "focusCount": 3}'::jsonb
where title = 'Radar de contexto';
