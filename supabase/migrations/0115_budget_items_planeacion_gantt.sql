-- Fase 2: campos de programación temporal de cada concepto de costo (pestaña "Planeación de
-- acciones" / Gantt) y las validaciones de fechas en el backend (sección 8 de la especificación).
alter table budget_items
  add column if not exists plan_start_date date,
  add column if not exists plan_end_date date
    check (plan_end_date is null or plan_start_date is null or plan_end_date >= plan_start_date),
  add column if not exists plan_responsable text,
  add column if not exists plan_estado text
    check (plan_estado is null or plan_estado in ('pendiente', 'programado', 'completado')),
  add column if not exists plan_notes text;

-- Regla 8.1/8.2: la planeación de un concepto debe quedar dentro del rango de fechas de la
-- actividad (la "acción" de la especificación) a la que pertenece.
create or replace function validate_budget_item_plan_dates() returns trigger as $$
declare
  v_start date;
  v_end date;
begin
  if new.plan_start_date is not null or new.plan_end_date is not null then
    select start_date, end_date into v_start, v_end from plan_activities where id = new.plan_activity_id;
    if v_start is not null and new.plan_start_date is not null and new.plan_start_date < v_start then
      raise exception 'La fecha de inicio de la planeación no puede ser anterior al inicio de la actividad (%).', v_start;
    end if;
    if v_end is not null and new.plan_end_date is not null and new.plan_end_date > v_end then
      raise exception 'La fecha final de la planeación no puede ser posterior al final de la actividad (%).', v_end;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_budget_item_plan_dates on budget_items;
create trigger trg_validate_budget_item_plan_dates
  before insert or update of plan_start_date, plan_end_date, plan_activity_id on budget_items
  for each row execute function validate_budget_item_plan_dates();

-- Regla 8.4/8.5: si se acorta el período de una actividad, no debe dejar conceptos ya programados
-- por fuera del nuevo rango — el sistema debe avisar (acá, bloqueando el guardado) en vez de
-- mover fechas de conceptos en silencio (regla 8.6).
create or replace function validate_plan_activity_date_range() returns trigger as $$
begin
  if new.start_date is not null and exists (
    select 1 from budget_items where plan_activity_id = new.id and plan_start_date is not null and plan_start_date < new.start_date
  ) then
    raise exception 'Hay conceptos de costo programados antes de la nueva fecha de inicio de la actividad.';
  end if;
  if new.end_date is not null and exists (
    select 1 from budget_items where plan_activity_id = new.id and plan_end_date is not null and plan_end_date > new.end_date
  ) then
    raise exception 'Hay conceptos de costo programados después de la nueva fecha final de la actividad.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_plan_activity_date_range on plan_activities;
create trigger trg_validate_plan_activity_date_range
  before update of start_date, end_date on plan_activities
  for each row execute function validate_plan_activity_date_range();
