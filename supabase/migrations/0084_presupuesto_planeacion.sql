-- Módulo de Presupuesto Financiero de la Planeación.
-- No modifica ni elimina ninguna tabla existente. Aditivo puro.
--
-- Jerarquía: aspirations (existente) → plan_actions ("Acción", nace en el taller S6 id31)
--            → plan_activities ("Actividad" del plan — distinta de `activities`, que son los
--              ejercicios de taller) → budget_items (concepto de costo, por año)
--              → budget_executions (ejecución real, registrada mes a mes).
--
-- Planeación anual (budget_items.year) + monitoreo mensual (budget_executions.month): el
-- presupuesto aprobado/estimado se fija por año, la ejecución real se registra mes a mes y se
-- suma para comparar contra lo aprobado de ese año.

-- Habilita 'plan_presupuesto' como activity_type válido, sin tocar los existentes.
alter table activities drop constraint if exists activities_activity_type_check;
alter table activities add constraint activities_activity_type_check check (activity_type in (
  'notas','matriz_ponderada','matriz_cuadrantes','rueda_evaluacion',
  'votacion_fichas','tarjeta_estructurada','mapa_estrategico',
  'tablero_proyectos','ficha_kpi','checklist_salidas',
  'radar_contexto','tejido_conexiones','notas_matriz','crazy8','compromiso_personal',
  'plan_presupuesto'
));

create table if not exists plan_actions (
  id serial primary key,
  aspiration_id int not null references aspirations(id),
  name text not null,
  scope text,
  owner text,
  -- Trazabilidad al taller S6 (id31, "De objetivo a proyecto estratégico"): de qué submission y
  -- de qué proyecto dentro de su JSON `content.projects[]` se promovió esta Acción.
  source_activity_id int references activities(id),
  source_project_id text,
  status text not null default 'activa' check (status in ('activa','pausada','cerrada')),
  created_at timestamptz not null default now()
);
create unique index if not exists plan_actions_unique_source
  on plan_actions(source_activity_id, source_project_id) where source_project_id is not null;

create table if not exists plan_activities (
  id serial primary key,
  action_id int not null references plan_actions(id) on delete cascade,
  name text not null,
  owner text,
  start_date date,
  end_date date,
  progress_pct numeric not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  status text not null default 'pendiente' check (status in ('pendiente','en_curso','completada','cancelada')),
  cost_center text,
  funding_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budget_items (
  id serial primary key,
  plan_activity_id int not null references plan_activities(id) on delete cascade,
  concept text not null,
  year int not null check (year between 2000 and 2100),
  estimated numeric(14,2) not null default 0 check (estimated >= 0),
  approved numeric(14,2) not null default 0 check (approved >= 0),
  funding_source text,
  cost_center text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_budget_items_activity on budget_items(plan_activity_id);
create index if not exists idx_budget_items_year on budget_items(year);

create table if not exists budget_executions (
  id serial primary key,
  budget_item_id int not null references budget_items(id) on delete cascade,
  month date not null, -- siempre el día 1 del mes, p. ej. 2027-03-01
  amount numeric(14,2) not null default 0 check (amount >= 0),
  registered_by uuid references participants(id),
  registered_at timestamptz not null default now(),
  notes text,
  unique(budget_item_id, month)
);
create index if not exists idx_budget_executions_item on budget_executions(budget_item_id);
create index if not exists idx_budget_executions_month on budget_executions(month);

create table if not exists budget_audit (
  id bigserial primary key,
  entity_type text not null check (entity_type in ('budget_item','budget_execution','plan_activity','plan_action')),
  entity_id text not null,
  plan_activity_id int references plan_activities(id),
  participant_id uuid references participants(id),
  field text not null,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_audit_entity on budget_audit(entity_type, entity_id);
create index if not exists idx_budget_audit_activity on budget_audit(plan_activity_id);

-- Regla de negocio a nivel de base: lo ejecutado (suma de ejecuciones mensuales) nunca puede
-- superar lo aprobado del año de ese concepto — así ningún camino (UI, API, consola) puede
-- saltarse la regla "el saldo nunca es negativo por sobreejecución".
create or replace function check_execution_within_approved() returns trigger as $$
declare
  v_approved numeric(14,2);
  v_total_executed numeric(14,2);
begin
  select approved into v_approved from budget_items where id = new.budget_item_id;
  select coalesce(sum(amount), 0) into v_total_executed
    from budget_executions
    where budget_item_id = new.budget_item_id and id <> coalesce(new.id, -1);
  v_total_executed := v_total_executed + new.amount;
  if v_total_executed > v_approved then
    raise exception 'La ejecución total (%) superaría el presupuesto aprobado (%) para este concepto', v_total_executed, v_approved;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_execution on budget_executions;
create trigger trg_check_execution
  before insert or update on budget_executions
  for each row execute function check_execution_within_approved();

-- Trazabilidad automática: cualquier UPDATE sobre budget_items o plan_activities queda
-- registrado en budget_audit columna por columna, sin depender de que cada pantalla recuerde
-- llamar a una función de auditoría. `updated_by`/`reason` se pasan vía variables de sesión
-- opcionales (set_config), para no forzar columnas nuevas en cada tabla.
create or replace function log_budget_change() returns trigger as $$
declare
  key text;
  old_val text;
  new_val text;
  v_participant uuid;
  v_reason text;
  v_entity_type text;
  v_plan_activity_id int;
begin
  begin
    v_participant := nullif(current_setting('app.participant_id', true), '')::uuid;
  exception when others then v_participant := null; end;
  v_reason := nullif(current_setting('app.change_reason', true), '');

  if tg_table_name = 'budget_items' then
    v_entity_type := 'budget_item';
    v_plan_activity_id := new.plan_activity_id;
  elsif tg_table_name = 'plan_activities' then
    v_entity_type := 'plan_activity';
    v_plan_activity_id := new.id;
  end if;

  for key in select jsonb_object_keys(to_jsonb(new)) loop
    old_val := to_jsonb(old) ->> key;
    new_val := to_jsonb(new) ->> key;
    if old_val is distinct from new_val and key not in ('updated_at') then
      insert into budget_audit (entity_type, entity_id, plan_activity_id, participant_id, field, old_value, new_value, reason)
      values (v_entity_type, new.id::text, v_plan_activity_id, v_participant, key, old_val, new_val, v_reason);
    end if;
  end loop;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_budget_items on budget_items;
create trigger trg_audit_budget_items
  after update on budget_items
  for each row execute function log_budget_change();

drop trigger if exists trg_audit_plan_activities on plan_activities;
create trigger trg_audit_plan_activities
  after update on plan_activities
  for each row execute function log_budget_change();

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_plan_activities_updated_at on plan_activities;
create trigger trg_plan_activities_updated_at before update on plan_activities
  for each row execute function set_updated_at();
drop trigger if exists trg_budget_items_updated_at on budget_items;
create trigger trg_budget_items_updated_at before update on budget_items
  for each row execute function set_updated_at();

-- Consolidación automática: vistas, nunca columnas editables. Lo que el usuario ve en cada
-- nivel siempre se recalcula a partir de budget_items/budget_executions.
create or replace view v_budget_item_totals as
select
  bi.id as budget_item_id,
  bi.plan_activity_id,
  bi.concept,
  bi.year,
  bi.estimated,
  bi.approved,
  coalesce(sum(be.amount), 0)::numeric(14,2) as executed,
  (bi.approved - coalesce(sum(be.amount), 0))::numeric(14,2) as saldo,
  case when bi.approved > 0 then round(coalesce(sum(be.amount), 0) / bi.approved * 100, 2) else 0 end as pct_ejecucion,
  bi.funding_source,
  bi.cost_center
from budget_items bi
left join budget_executions be on be.budget_item_id = bi.id
group by bi.id;

create or replace view v_budget_by_activity as
select
  pa.id as plan_activity_id,
  pa.action_id,
  pa.name,
  pa.owner,
  pa.progress_pct,
  pa.status,
  pa.start_date,
  pa.end_date,
  pa.cost_center,
  pa.funding_source,
  coalesce(sum(t.estimated), 0)::numeric(14,2) as estimated,
  coalesce(sum(t.approved), 0)::numeric(14,2) as approved,
  coalesce(sum(t.executed), 0)::numeric(14,2) as executed,
  coalesce(sum(t.approved), 0) - coalesce(sum(t.executed), 0) as saldo,
  case when coalesce(sum(t.approved), 0) > 0
    then round(coalesce(sum(t.executed), 0) / sum(t.approved) * 100, 2)
    else 0 end as pct_ejecucion
from plan_activities pa
left join v_budget_item_totals t on t.plan_activity_id = pa.id
group by pa.id;

create or replace view v_budget_by_action as
select
  pac.id as action_id,
  pac.aspiration_id,
  pac.name,
  pac.owner,
  pac.status,
  coalesce(sum(a.estimated), 0)::numeric(14,2) as estimated,
  coalesce(sum(a.approved), 0)::numeric(14,2) as approved,
  coalesce(sum(a.executed), 0)::numeric(14,2) as executed,
  coalesce(sum(a.approved), 0) - coalesce(sum(a.executed), 0) as saldo,
  case when coalesce(sum(a.approved), 0) > 0
    then round(coalesce(sum(a.executed), 0) / sum(a.approved) * 100, 2)
    else 0 end as pct_ejecucion,
  count(a.plan_activity_id) as num_actividades
from plan_actions pac
left join v_budget_by_activity a on a.action_id = pac.id
group by pac.id;

create or replace view v_budget_by_aspiration as
select
  asp.id as aspiration_id,
  asp.number,
  asp.name,
  coalesce(sum(ac.estimated), 0)::numeric(14,2) as estimated,
  coalesce(sum(ac.approved), 0)::numeric(14,2) as approved,
  coalesce(sum(ac.executed), 0)::numeric(14,2) as executed,
  coalesce(sum(ac.approved), 0) - coalesce(sum(ac.executed), 0) as saldo,
  case when coalesce(sum(ac.approved), 0) > 0
    then round(coalesce(sum(ac.executed), 0) / sum(ac.approved) * 100, 2)
    else 0 end as pct_ejecucion,
  count(ac.action_id) as num_acciones
from aspirations asp
left join v_budget_by_action ac on ac.aspiration_id = asp.id
group by asp.id;

create or replace view v_budget_total as
select
  coalesce(sum(estimated), 0)::numeric(14,2) as estimated,
  coalesce(sum(approved), 0)::numeric(14,2) as approved,
  coalesce(sum(executed), 0)::numeric(14,2) as executed,
  coalesce(sum(approved), 0) - coalesce(sum(executed), 0) as saldo,
  case when coalesce(sum(approved), 0) > 0
    then round(coalesce(sum(executed), 0) / sum(approved) * 100, 2)
    else 0 end as pct_ejecucion,
  (select count(*) from plan_activities) as num_actividades,
  (select count(distinct bi.plan_activity_id) from budget_items bi) as num_actividades_con_presupuesto
from v_budget_by_aspiration;

create or replace view v_budget_by_year as
select
  bi.year,
  coalesce(sum(bi.estimated), 0)::numeric(14,2) as estimated,
  coalesce(sum(bi.approved), 0)::numeric(14,2) as approved,
  coalesce(sum(t.executed), 0)::numeric(14,2) as executed
from budget_items bi
left join v_budget_item_totals t on t.budget_item_id = bi.id
group by bi.year
order by bi.year;

create or replace view v_budget_by_month as
select
  date_trunc('month', be.month)::date as month,
  bi.year,
  coalesce(sum(be.amount), 0)::numeric(14,2) as executed
from budget_executions be
join budget_items bi on bi.id = be.budget_item_id
group by date_trunc('month', be.month)::date, bi.year
order by month;

create or replace view v_budget_by_owner as
select
  coalesce(pa.owner, 'Sin responsable') as owner,
  coalesce(sum(t.estimated), 0)::numeric(14,2) as estimated,
  coalesce(sum(t.approved), 0)::numeric(14,2) as approved,
  coalesce(sum(t.executed), 0)::numeric(14,2) as executed
from plan_activities pa
left join v_budget_item_totals t on t.plan_activity_id = pa.id
group by pa.owner;

create or replace view v_budget_by_source as
select
  coalesce(bi.funding_source, 'Sin definir') as funding_source,
  coalesce(sum(bi.estimated), 0)::numeric(14,2) as estimated,
  coalesce(sum(bi.approved), 0)::numeric(14,2) as approved,
  coalesce(sum(t.executed), 0)::numeric(14,2) as executed
from budget_items bi
left join v_budget_item_totals t on t.budget_item_id = bi.id
group by bi.funding_source;

-- Avance físico (plan_activities.progress_pct) vs. ejecución financiera (% del presupuesto ya
-- gastado): la vista marca una desviación cuando la diferencia supera 25 puntos porcentuales.
create or replace view v_budget_vs_progress as
select
  ba.plan_activity_id,
  ba.name,
  ba.owner,
  ba.progress_pct as avance_fisico_pct,
  ba.pct_ejecucion as ejecucion_presupuestal_pct,
  (ba.pct_ejecucion - ba.progress_pct) as brecha,
  case when abs(ba.pct_ejecucion - ba.progress_pct) > 25 then true else false end as desviacion_significativa
from v_budget_by_activity ba
where ba.approved > 0;

-- RLS: mismo patrón permisivo que el resto de la app (sin autenticación real).
do $$
declare t text;
begin
  for t in select unnest(array[
    'plan_actions','plan_activities','budget_items','budget_executions','budget_audit'
  ]) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public select" on %I;', t);
    execute format('create policy "public select" on %I for select using (true);', t);
    execute format('drop policy if exists "public insert" on %I;', t);
    execute format('create policy "public insert" on %I for insert with check (true);', t);
    execute format('drop policy if exists "public update" on %I;', t);
    execute format('create policy "public update" on %I for update using (true) with check (true);', t);
    execute format('drop policy if exists "public delete" on %I;', t);
    execute format('create policy "public delete" on %I for delete using (true);', t);
  end loop;
end $$;

-- Realtime, para que el tablero y el dashboard global se actualicen solos.
do $$
begin
  begin
    alter publication supabase_realtime add table plan_actions;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table plan_activities;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table budget_items;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table budget_executions;
  exception when duplicate_object then null; end;
end $$;
