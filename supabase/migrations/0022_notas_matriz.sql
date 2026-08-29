-- "Lectura comentada del acumulado anual" pasa de un tablero de notas con selector de
-- aspiración repetido en cada respuesta a una matriz Aspiración x Categoría: la aspiración
-- se elige una sola vez (la fila), no en cada nota que se agrega.

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
  'tejido_conexiones','notas_matriz'
));

update activities
set activity_type = 'notas_matriz',
    materials = null,
    config = config - 'selectableAspiration'
where title = 'Lectura comentada del acumulado anual';
