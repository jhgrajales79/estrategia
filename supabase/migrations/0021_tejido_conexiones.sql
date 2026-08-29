-- "El tejido de conexiones" pasa de un tablero de notas genérico a un componente propio
-- que visualiza la red de hilos como un grafo circular (metáfora del ovillo de lana).

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
  'tejido_conexiones'
));

update activities
set activity_type = 'tejido_conexiones',
    materials = null,
    config = '{}'::jsonb
where session_id = (select id from sessions where code = 'S0')
  and title = 'El tejido de conexiones';
