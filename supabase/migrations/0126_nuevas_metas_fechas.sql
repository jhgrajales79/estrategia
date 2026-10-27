-- Fechas de inicio/fin de cada nueva meta, para el Roadmap Gantt del tablero /nuevas-metas. Las
-- define el facilitador en la pestaña SINT. Requiere 0124.
alter table nuevas_metas add column if not exists fecha_inicio date;
alter table nuevas_metas add column if not exists fecha_fin date;

drop policy if exists "public update" on nuevas_metas;
create policy "public update" on nuevas_metas for update using (true) with check (true);
