-- Las 6 metas "nuevas" insertadas en goals (ids 11-16) venían de candidatas de la Subasta que
-- nunca fueron puntuadas (0 fichas). El usuario aclaró que una meta nueva solo debe pasar al plan
-- de acción cuando ya ganó votos en la Subasta — mientras tanto debe seguir siendo candidata ahí,
-- no una meta confirmada en goals. Se revierte la inserción; las candidatas siguen existiendo en
-- la Subasta (actividad 18) para poder votarse.
delete from goals where id in (11, 12, 13, 14, 15, 16);
