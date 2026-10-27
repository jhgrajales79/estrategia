-- Las nuevas metas del tablero /nuevas-metas pasan de estar fijas en el código a una tabla, para
-- que el facilitador las agregue o quite desde la pestaña SINT de "Nuestro trabajo". Requiere
-- 0123_nueva_meta_badges.sql. `key` es lo que referencian los badges (nueva_meta_badges.meta_key);
-- las 10 metas iniciales conservan las keys que ya usaban, así no se pierde ningún badge.
create table if not exists nuevas_metas (
  key text primary key default gen_random_uuid()::text,
  aspiracion int not null check (aspiracion between 1 and 3),
  texto text not null check (length(trim(texto)) > 0),
  orden int not null default 0,
  created_at timestamptz not null default now()
);

insert into nuevas_metas (key, aspiracion, texto, orden) values
  ('lineas-servicio', 2, 'Líneas de servicio', 1),
  ('capacidades-tendencias', 2, 'Capacidades y tendencias', 2),
  ('anticipacion-tendencias', 2, 'Anticipación tendencias / oportunidades', 3),
  ('gestion-conocimiento', 1, 'Gestión del conocimiento', 4),
  ('ia-tecnologia', 2, 'IA / tecnología al servicio de SOCYA', 5),
  ('optimizacion-organizacional', 3, 'Optimización organizacional → Competitividad (eficiencia operativa) ERP', 6),
  ('retencion-talento', 1, 'Retención talento Vs Rotación', 7),
  ('coworking', 2, 'Coworking', 8),
  ('posicionamiento-marca', 3, 'Posicionamiento de marca', 9),
  ('sostenibilidad-financiera', 3, 'Sostenibilidad financiera', 10)
on conflict (key) do nothing;

-- Al quitar una meta se van sus badges con ella.
delete from nueva_meta_badges where meta_key not in (select key from nuevas_metas);
alter table nueva_meta_badges drop constraint if exists nueva_meta_badges_meta_key_fkey;
alter table nueva_meta_badges
  add constraint nueva_meta_badges_meta_key_fkey foreign key (meta_key) references nuevas_metas (key) on delete cascade;

-- RLS: mismo patrón permisivo que el resto de la app (sin autenticación real).
alter table nuevas_metas enable row level security;
drop policy if exists "public select" on nuevas_metas;
create policy "public select" on nuevas_metas for select using (true);
drop policy if exists "public insert" on nuevas_metas;
create policy "public insert" on nuevas_metas for insert with check (true);
drop policy if exists "public delete" on nuevas_metas;
create policy "public delete" on nuevas_metas for delete using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table nuevas_metas;
  exception when duplicate_object then null; end;
end $$;
