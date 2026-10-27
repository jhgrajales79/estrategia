-- Badges SINT jerárquicos: cada badge puede tener uno o varios hijos (parent_id), y el facilitador
-- puede marcar un hijo en rojo (alerta). Los hijos heredan meta_key y tipo del padre y se borran
-- con él. Requiere 0123 y 0124.
alter table nueva_meta_badges add column if not exists parent_id bigint references nueva_meta_badges (id) on delete cascade;
alter table nueva_meta_badges add column if not exists alerta boolean not null default false;

-- Marcar/desmarcar en rojo es un update.
drop policy if exists "public update" on nueva_meta_badges;
create policy "public update" on nueva_meta_badges for update using (true) with check (true);
