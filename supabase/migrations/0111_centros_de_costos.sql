-- Catálogo de centros y subcentros de costos — únicamente los que aparecen en la imagen "CC.png"
-- (subconjunto curado de "CENTRO DE COSTOS (55).xlsx"), para relacionarlos en "Plan de acción y
-- tablero acumulado anual" (S7 id33, PlanPresupuesto.tsx) en vez de un campo de texto libre.
create table if not exists cost_centers (
  id bigint generated always as identity primary key,
  centro text not null,
  subcentro_codigo text not null unique,
  descripcion text,
  responsable text,
  estado text,
  created_at timestamptz not null default now()
);

alter table cost_centers enable row level security;
create policy "public select" on cost_centers for select using (true);

insert into cost_centers (centro, subcentro_codigo, descripcion, responsable, estado) values
  ('011-DIRECCION EJECUTIVA', '001102', '011-PE DIRECCION EJECUTIVA', null, 'ACTIVO'),
  ('021-PERSONAS Y ORGANIZACIÓN', '002110', '021-PE PERSONAS Y ORGANIZACIÓN', 'LADY CATALINA BAENA CEBALLOS', 'ACTIVO'),
  ('021-PERSONAS Y ORGANIZACIÓN', '002111', '021-PE SEGURIDAD Y CUIDADO', 'LADY CATALINA BAENA CEBALLOS', 'ACTIVO'),
  ('021-PERSONAS Y ORGANIZACIÓN', '002112', '021-PE GESTION DE CAPACIDADES', 'LADY CATALINA BAENA CEBALLOS', 'ACTIVO'),
  ('021-PERSONAS Y ORGANIZACIÓN', '002113', '021-PE BIENESTAR Y CULTURA', 'LADY CATALINA BAENA CEBALLOS', 'ACTIVO'),
  ('021-PERSONAS Y ORGANIZACIÓN', '002114', '021-PE SELECCION Y VINCULACION', 'LADY CATALINA BAENA CEBALLOS', 'ACTIVO'),
  ('022-VALOR DIGITAL Y ESTRATEGICO', '004102', '041-PE ESTRATEGIA', 'JORGE HERNANDO GRAJALES LOPEZ', 'ACTIVO'),
  ('022-VALOR DIGITAL Y ESTRATEGICO', '002203', '022-PE VALOR DIGITAL', 'JORGE HERNANDO GRAJALES LOPEZ', 'ACTIVO'),
  ('023-GESTION DE RECURSOS', '002306', '025-PE PLANEACION FINANCIERA', 'YENNY AMPARO GIRALDO QUINTERO', 'ACTIVO'),
  ('023-GESTION DE RECURSOS', '002402', '024-PE ABASTECIMIENTO', null, 'ACTIVO'),
  ('023-GESTION DE RECURSOS', '002502', '025-PE GESTION DE ACTIVOS', null, 'ACTIVO'),
  ('031-COMUNICACIONES', '003103', '031-PE COMUNICACIONES', 'LAURA OROZCO BEDOYA', 'ACTIVO'),
  ('201-AMBIENTAL Y DE EC', '201102', '201-PE AMBIENTAL Y DE EC', 'SANTIAGO JARAMILLO JARAMILLO', 'ACTIVO'),
  ('700-DIRECCION DE ALIANZAS', '700002', '700-PE DIRECCION DE ALIANZAS', 'CARLOS ALBERTO SALAZAR VELASQUEZ', 'ACTIVO'),
  ('G01-DIR PROY SOCIOAMBIENTALES', 'G01002', 'G01- PEADMON DIR PROY SOCIOAMB', 'MARULANDA CARVAJAL MARIO ALBERTO', 'ACTIVO');
