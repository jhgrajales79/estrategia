-- "Cierre y compromisos de información" (S0) pasa de un formulario con campos
-- Aspiración / Responsable (que no reflejaba compromiso personal) a un compromiso
-- firmado individualmente por cada participante, identificado por su propio nombre.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'activities'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%activity_type%';
  if cname is not null then
    execute format('alter table activities drop constraint %I', cname);
  end if;
end $$;

alter table activities add constraint activities_activity_type_check check (activity_type in (
  'notas','matriz_ponderada','matriz_cuadrantes','rueda_evaluacion',
  'votacion_fichas','tarjeta_estructurada','mapa_estrategico',
  'tablero_proyectos','ficha_kpi','checklist_salidas','radar_contexto',
  'tejido_conexiones','notas_matriz','crazy8','compromiso_personal'
));

update activities
set activity_type = 'compromiso_personal',
    config = '{}'::jsonb
where id = 6 and title = 'Cierre y compromisos de información';

-- Limpia el registro vacío de prueba (sin autor identificado, no aporta datos reales).
update submissions
set content = '{"commitments": []}'::jsonb
where activity_id = 6;
