-- Adjuntos multimedia (fotos / enlaces a paneles visuales) y radar de contexto real.

-- 1) Bucket público para fotos y adjuntos de actividades.
insert into storage.buckets (id, name, public)
values ('activity-media', 'activity-media', true)
on conflict (id) do nothing;

drop policy if exists "public read activity-media" on storage.objects;
create policy "public read activity-media" on storage.objects
  for select using (bucket_id = 'activity-media');

drop policy if exists "public upload activity-media" on storage.objects;
create policy "public upload activity-media" on storage.objects
  for insert with check (bucket_id = 'activity-media');

drop policy if exists "public delete activity-media" on storage.objects;
create policy "public delete activity-media" on storage.objects
  for delete using (bucket_id = 'activity-media');

-- 2) Nuevo activity_type: radar_contexto.
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
  'tablero_proyectos','ficha_kpi','checklist_salidas','radar_contexto'
));

-- 3) "El tejido de conexiones": permitir foto y enlace a panel visual (ej. Obsidian).
update activities
set config = config || '{"allowMedia": true, "externalLinkLabel": "Panel visual (Obsidian u otro tablero)"}'::jsonb
where session_id = (select id from sessions where code = 'S0')
  and title = 'El tejido de conexiones';

-- 4) "Radar exprés del contexto" -> "Radar de contexto": radar real de 5 dimensiones
--    x 3 anillos de impacto, en 5 rondas que abre el facilitador.
update activities
set title = 'Radar de contexto',
    activity_type = 'radar_contexto',
    config = '{
      "axes": [
        {"key": "politico", "label": "País y nuevo gobierno"},
        {"key": "financiamiento", "label": "Financiamiento y cooperación internacional"},
        {"key": "social", "label": "Social-territorial"},
        {"key": "ambiental", "label": "Ambiental-tecnológica"},
        {"key": "sector", "label": "Sector, competencia y aliados"}
      ],
      "rings": ["Ya nos afecta", "Nos afectará este año", "En el horizonte"]
    }'::jsonb
where session_id = (select id from sessions where code = 'S0')
  and title = 'Radar exprés del contexto';
