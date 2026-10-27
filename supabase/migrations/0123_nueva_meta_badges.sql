-- Badges de las nuevas metas (pestaña SINT de "Nuestro trabajo"): cada nueva meta puede llevar
-- varios badges de foco estratégico, alternativa y tipo de recurso necesario. Solo se muestran en
-- el tablero /nuevas-metas. meta_key es la key fija de NUEVAS_METAS (src/lib/nuevasMetas.ts).
create table if not exists nueva_meta_badges (
  id bigint generated always as identity primary key,
  meta_key text not null,
  tipo text not null check (tipo in ('foco', 'alternativa', 'recurso')),
  label text not null check (length(trim(label)) > 0),
  created_at timestamptz not null default now()
);

-- RLS: mismo patrón permisivo que el resto de la app (sin autenticación real).
alter table nueva_meta_badges enable row level security;
drop policy if exists "public select" on nueva_meta_badges;
create policy "public select" on nueva_meta_badges for select using (true);
drop policy if exists "public insert" on nueva_meta_badges;
create policy "public insert" on nueva_meta_badges for insert with check (true);
drop policy if exists "public delete" on nueva_meta_badges;
create policy "public delete" on nueva_meta_badges for delete using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table nueva_meta_badges;
  exception when duplicate_object then null; end;
end $$;
