-- Agrega dos metas nuevas confirmadas por el usuario para la Aspiración 3 — venían como
-- candidatas de la Subasta de nuevas metas sin fichas (o sin aspiración asignada) aún.
insert into goals (aspiration_id, description, is_new) values
  (3, 'Alcanzar un margen operativo del 2%', true),
  (3, 'Plan de optimización y mejora de procesos internos a través de la metodología de métodos, tiempos y herramientas', true);
