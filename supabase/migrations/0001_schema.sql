-- Esquema inicial: Ruta de Planeación Estratégica Socya
create extension if not exists pgcrypto;

create table if not exists aspirations (
  id serial primary key,
  number int not null unique,
  name text not null,
  color text not null check (color in ('naranja','azul','verde')),
  hex text not null
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('patrocinador','facilitador','lider_aspiracion','comite','relator','participante')),
  aspiration_id int references aspirations(id),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists sessions (
  id serial primary key,
  code text not null unique,
  name text not null,
  week_label text,
  duration_label text,
  methodology text,
  objective text,
  aspiration_link text,
  order_index int not null,
  status text not null default 'pendiente' check (status in ('pendiente','en_curso','completada'))
);

create table if not exists activities (
  id serial primary key,
  session_id int not null references sessions(id) on delete cascade,
  title text not null,
  time_minutes int,
  description text,
  materials text,
  activity_type text not null check (activity_type in (
    'notas','matriz_ponderada','matriz_cuadrantes','rueda_evaluacion',
    'votacion_fichas','tarjeta_estructurada','mapa_estrategico',
    'tablero_proyectos','ficha_kpi','checklist_salidas'
  )),
  config jsonb not null default '{}'::jsonb,
  order_index int not null
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id int not null references activities(id) on delete cascade,
  aspiration_id int references aspirations(id),
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references participants(id),
  updated_at timestamptz not null default now(),
  status text not null default 'borrador' check (status in ('borrador','enviado'))
);

create unique index if not exists submissions_unique_team
  on submissions(activity_id, aspiration_id) where aspiration_id is not null;
create unique index if not exists submissions_unique_plenary
  on submissions(activity_id) where aspiration_id is null;

create table if not exists outputs (
  id serial primary key,
  session_id int not null references sessions(id) on delete cascade,
  aspiration_id int references aspirations(id),
  description text not null,
  is_done boolean not null default false,
  linked_submission_id uuid references submissions(id),
  order_index int not null default 0
);

create table if not exists goals (
  id serial primary key,
  aspiration_id int not null references aspirations(id),
  description text not null,
  is_new boolean not null default false,
  owner_participant_id uuid references participants(id),
  target_date date,
  created_at timestamptz not null default now()
);

create table if not exists tracking_board (
  id serial primary key,
  aspiration_id int not null unique references aspirations(id),
  planeacion_pct numeric not null default 0,
  ejecucion_pct numeric not null default 0,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists activity_feed (
  id bigserial primary key,
  session_id int references sessions(id),
  aspiration_id int references aspirations(id),
  participant_id uuid references participants(id),
  activity_id int references activities(id),
  event_type text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_session on activities(session_id);
create index if not exists idx_submissions_activity on submissions(activity_id);
create index if not exists idx_outputs_session on outputs(session_id);
create index if not exists idx_goals_aspiration on goals(aspiration_id);
create index if not exists idx_feed_created on activity_feed(created_at desc);

-- Row Level Security: app interna sin autenticación real (decisión del usuario).
-- Se habilita RLS con políticas permisivas para el rol anon en todas las tablas.
do $$
declare t text;
begin
  for t in select unnest(array[
    'aspirations','participants','sessions','activities','submissions',
    'outputs','goals','tracking_board','activity_feed'
  ]) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public select" on %I;', t);
    execute format('create policy "public select" on %I for select using (true);', t);
    execute format('drop policy if exists "public insert" on %I;', t);
    execute format('create policy "public insert" on %I for insert with check (true);', t);
    execute format('drop policy if exists "public update" on %I;', t);
    execute format('create policy "public update" on %I for update using (true) with check (true);', t);
    execute format('drop policy if exists "public delete" on %I;', t);
    execute format('create policy "public delete" on %I for delete using (true);', t);
  end loop;
end $$;

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table submissions;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table outputs;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table tracking_board;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table activity_feed;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table goals;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table participants;
  exception when duplicate_object then null; end;
end $$;
