-- Activa en "Cierre: consenso de estrategias corporativas" (id25) la unificación automática de
-- las estrategias ratificadas en un solo párrafo: borrador por plantilla (sin IA) o redactado con
-- un modelo de lenguaje real vía /api/unificar-estrategia.
update activities set config = config || jsonb_build_object('allowUnify', true) where id = 25;
