-- Modo presentador: el facilitador habilita sesiones y actividades en vivo.
alter table sessions add column if not exists is_enabled boolean not null default false;
alter table activities add column if not exists is_enabled boolean not null default false;

-- La S0 queda habilitada por defecto para que el taller tenga un punto de partida.
update sessions set is_enabled = true where code = 'S0';

do $$
begin
  begin
    alter publication supabase_realtime add table sessions;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table activities;
  exception when duplicate_object then null; end;
end $$;
