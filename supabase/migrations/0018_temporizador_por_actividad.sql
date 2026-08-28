-- El temporizador se mueve de la sesión a cada actividad.
alter table sessions drop column if exists timer_status;
alter table sessions drop column if exists timer_end_at;
alter table sessions drop column if exists timer_remaining_seconds;

alter table activities add column if not exists timer_status text not null default 'idle'
  check (timer_status in ('idle', 'running', 'paused', 'finished'));
alter table activities add column if not exists timer_end_at timestamptz;
alter table activities add column if not exists timer_remaining_seconds integer;
