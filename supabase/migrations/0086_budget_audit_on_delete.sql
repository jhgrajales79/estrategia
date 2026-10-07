-- Corrige budget_audit.plan_activity_id: sin ON DELETE, la FK bloqueaba borrar una
-- plan_activity (o su plan_action, en cascada) en cuanto tuviera algún registro de auditoría —
-- la trazabilidad terminaba impidiendo el borrado que se supone solo debe acompañar. Se cambia
-- a ON DELETE SET NULL: el registro de auditoría se conserva (quién cambió qué y cuándo),
-- simplemente deja de apuntar a una actividad que ya no existe.
alter table budget_audit drop constraint if exists budget_audit_plan_activity_id_fkey;
alter table budget_audit
  add constraint budget_audit_plan_activity_id_fkey
  foreign key (plan_activity_id) references plan_activities(id) on delete set null;
