-- "Crazy 8 Socya" pasa de un tablero de votación genérico y continuo a un componente
-- propio con las 2 fases reales de la dinámica: boceto individual en papel (donde solo se
-- transcribe la mejor idea, una por persona) y luego galería y votación con fichas, con
-- cierre que anuncia el top 3 que viaja como hipótesis de estrategia a la S4.

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
  'tejido_conexiones','notas_matriz','crazy8'
));

update activities
set activity_type = 'crazy8'
where title = 'Crazy 8 Socya: ocho ideas en ocho minutos';

-- Limpia datos de prueba acumulados durante el desarrollo (no son del taller real: la
-- sesión S0 en curso todavía no ha llegado a esta actividad).
update submissions
set content = '{"candidates": [], "votes": [], "phase": "sketch"}'::jsonb
where activity_id = (select id from activities where title = 'Crazy 8 Socya: ocho ideas en ocho minutos');
