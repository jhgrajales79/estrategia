-- Campos de la "Pestaña General" del documento de especificación (plataforma de planeación
-- estratégica, cronograma y control presupuestal). El "Proyecto estratégico" del documento se
-- mapea a la Acción actual (plan_actions) — ver PlanActionCard en PlanPresupuesto.tsx. La
-- jerarquía Acción -> Actividad -> Concepto de costo no cambia; name/scope/owner/status ya
-- cubren Nombre/Descripción y alcance/Responsable/Estado.
alter table plan_actions
  add column if not exists objetivo_estrategico text,
  add column if not exists meta_descripcion text,
  add column if not exists kpi text,
  add column if not exists frecuencia_medicion text
    check (frecuencia_medicion is null or frecuencia_medicion in ('semanal', 'mensual', 'trimestral', 'semestral', 'anual')),
  add column if not exists tipo_medida text
    check (tipo_medida is null or tipo_medida in ('valor', 'porcentaje', 'binario')),
  add column if not exists polaridad text
    check (polaridad is null or polaridad in ('ascendente', 'descendente')),
  add column if not exists linea_base text,
  add column if not exists valor_meta text,
  add column if not exists start_date date,
  add column if not exists end_date date
    check (end_date is null or start_date is null or end_date >= start_date);
