-- Temporizador de sesión: el facilitador lo inicia/pausa/reinicia y todos los participantes
-- lo ven en vivo (misma fila de sessions, ya está en la publicación de realtime).
alter table sessions add column if not exists timer_status text not null default 'idle'
  check (timer_status in ('idle', 'running', 'paused', 'finished'));
alter table sessions add column if not exists timer_end_at timestamptz;
alter table sessions add column if not exists timer_remaining_seconds integer;
