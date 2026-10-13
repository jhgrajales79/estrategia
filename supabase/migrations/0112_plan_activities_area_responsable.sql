-- Separa "Área responsable" (departamento) de "Responsable" (persona/rol) en cada actividad del
-- plan — inspirado en el mockup "front.jpg" de "Detalle de Acción Estratégica". Ver
-- PlanActivityCard en PlanPresupuesto.tsx.
alter table plan_activities add column if not exists area_responsable text;
